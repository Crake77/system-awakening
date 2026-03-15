// Main game loop - runs every 500ms
// Separated from UI so it's easy to modify game logic without touching components

import { generateMonster, rollDrops, generateIncursionBoss, DUNGEON_RANKS, FLOORS_PER_RANK } from '../data/monsters.js';
import { SKILL_DEFINITIONS } from '../data/skills.js';
import { JOBS } from '../data/jobs.js';
import { DAY_SECONDS, FOOD_DAILY_COST, INCURSION_BASE_TIMER } from '../data/regression.js';
import { createInitialState } from './state.js';
import {
  getMaxHp, getMaxCombatEnergy, getMatCap, getPoolMax,
  getRestRate, corePassiveRate, getProcessingRate,
  getAtk, getDef, getDodge, getGoldMultiplier,
  getRent, hasMats, subtractMats, addMats, regLevel,
} from './helpers.js';

export function gameTick(prev) {
  // Shallow clone with mutable sub-objects
  const s = {
    ...prev,
    mats: { ...prev.mats },
    skills: { ...prev.skills },
    hiredWorkers: { ...prev.hiredWorkers },
    hireProgress: { ...prev.hireProgress },
    meridians: prev.meridians.slice(),
    dailyIncome: prev.dailyIncome.slice(),
    weekPurchases: prev.weekPurchases.slice(),
    bodyTechLevels: { ...prev.bodyTechLevels },
    bodyTechsOwned: { ...prev.bodyTechsOwned },
  };

  if (s.incursionWon) return s;

  // Recalculate maxes
  s.maxHp = getMaxHp(s);
  s.maxCombatEnergy = getMaxCombatEnergy(s);
  s.hp = Math.min(s.hp, s.maxHp);
  s.combatEnergy = Math.min(s.combatEnergy, s.maxCombatEnergy);
  const poolMax = getPoolMax(s);
  const matCap = getMatCap(s);

  // ═══ PASSIVE REST (always when not in dungeon) ═══
  if (s.activity !== "dungeon") {
    s.hp = Math.min(s.maxHp, s.hp + getRestRate(s) * 0.5);
    s.combatEnergy = Math.min(s.maxCombatEnergy, s.combatEnergy + 0.5);
  }

  // ═══ CORE PASSIVE (always generates raw essence) ═══
  if (s.coreTier >= 0) {
    s.rawEssence = Math.min(poolMax, s.rawEssence + corePassiveRate(s) * 0.5);
  }

  // ═══ MEDITATING (process raw → processed) ═══
  if (s.activity === "meditating" && !s.incursionActive) {
    const rate = getProcessingRate(s) * 0.5;
    const toProcess = Math.min(s.rawEssence, rate);
    if (toProcess > 0) {
      s.rawEssence -= toProcess;
      s.processedEssence += toProcess;
    }
  }

  // Pill timers
  if (s.procBoostTimer > 0) s.procBoostTimer -= 0.5;

  // ═══ WORKING ═══
  if (s.activity === "working" && s.activeJob && !s.incursionActive) {
    const job = JOBS.find(j => j.id === s.activeJob);
    if (job && hasMats(s, job.input)) {
      s.jobProgress += 0.5;
      if (s.jobProgress >= job.time) {
        s.jobProgress = 0;
        s.mats = subtractMats(s.mats, job.input);
        s.gold += job.output;
        s.todayIncome += job.output;
        s.log = [...s.log.slice(-80), `💰 ${job.name}: +${job.output}g`];
      }
    }
  }

  // ═══ HIRED WORKERS (background) ═══
  Object.keys(s.hiredWorkers).forEach(jobId => {
    if (!s.hiredWorkers[jobId]) return;
    const job = JOBS.find(j => j.id === jobId);
    if (!job || !hasMats(s, job.input)) return;
    s.hireProgress[jobId] = (s.hireProgress[jobId] || 0) + 0.5;
    if (s.hireProgress[jobId] >= job.time * 1.5) {
      s.hireProgress[jobId] = 0;
      s.mats = subtractMats(s.mats, job.input);
      s.gold += job.output;
      s.todayIncome += job.output;
    }
  });

  // ═══ INCURSION TIMER ═══
  if (!s.incursionActive && s.incursionTimer > 0) {
    s.incursionTimer -= 0.5;
    if (s.incursionTimer <= 0) {
      s.incursionTimer = 0;
      s.incursionActive = true;
      s.activity = "idle";
      s.currentMonster = null;
      const boss = generateIncursionBoss(s.regression.count);
      s.incursionBossHp = boss.hp;
      s.incursionBossMaxHp = boss.hp;
      s.incursionPhase = 1;
      s.tab = "dungeon";
      s.log = [...s.log.slice(-80), "═══════", "⚠️ INCURSION!", `👾 ${boss.name} descends!`, "═══════"];
    }
  }

  // ═══ DAY TIMER ═══
  s.dayTimer += 0.5;
  if (s.dayTimer >= DAY_SECONDS) {
    s.dayTimer = 0;
    s.dayCount += 1;
    const prevWeekDay = s.weekDay;
    s.weekDay = (s.weekDay + 1) % 7;

    // Food
    if (s.gold >= FOOD_DAILY_COST) {
      s.gold -= FOOD_DAILY_COST;
      s.todaySpending += FOOD_DAILY_COST;
    } else {
      s.hp = Math.max(1, s.hp - 10);
      s.log = [...s.log.slice(-80), "⚠ No food! -10HP"];
    }

    // Rent overdue penalty
    if (!s.rentPaid && getRent(s) > 0) {
      s.rentOverdue += 1;
      const penalty = Math.floor(15 + s.rentOverdue * 5);
      s.hp = Math.max(1, s.hp - penalty);
      s.log = [...s.log.slice(-80), `🏠 Rent overdue! -${penalty}HP`];
    }

    // Week boundary
    if (s.weekDay === 0 && s.dayCount > 0) {
      s.dailyIncome[prevWeekDay] = s.todayIncome;
      s.totalWeekIncome = s.dailyIncome.reduce((a, b) => a + b, 0);
      s.rentPaid = false;
      s.rentOverdue = 0;
      s.weekPurchases = [];
      s.totalWeekSpend = 0;
      const rent = getRent(s);
      if (rent > 0) s.log = [...s.log.slice(-80), `📋 Rent due: ${rent}g`];
    }
    s.dailyIncome[s.weekDay] = s.todayIncome;
    s.todayIncome = 0;
    s.todaySpending = 0;
  }

  // ═══ REGRESSION ON DEATH ═══
  function triggerRegression() {
    const highFloorSum = Object.values(s.highestFloors).reduce((a, b) => a + b, 0);
    const pts = 1 + Math.floor(highFloorSum / 10) + Math.floor(s.medTechLevel / 2);
    const newReg = {
      count: s.regression.count + 1,
      pts: s.regression.pts + pts,
      totalPts: s.regression.totalPts + pts,
      ups: { ...s.regression.ups },
    };
    const newState = createInitialState(newReg);
    newState.log = [...newState.log, `💀 Killed.`, `⟳ +${pts} Regression Points!`];
    newState.tab = "regression";
    return newState;
  }

  // ═══ INCURSION COMBAT ═══
  if (s.incursionActive && !s.incursionWon) {
    const boss = generateIncursionBoss(s.regression.count);
    let playerDmg = getAtk(s);
    const skill = SKILL_DEFINITIONS[s.activeSkill];
    if (skill && skill.type === "active" && skill.energyCost > 0 && s.combatEnergy >= skill.energyCost) {
      playerDmg = Math.floor(playerDmg * skill.dmgMult);
      s.combatEnergy -= skill.energyCost;
    }
    s.incursionBossHp = Math.max(0, s.incursionBossHp - playerDmg);

    // Boss attacks
    if (Math.random() * 100 > getDodge(s)) {
      let bossDmg = Math.max(1, boss.dmg * s.incursionPhase - getDef(s));
      if (s.shield) { bossDmg = Math.floor(bossDmg * 0.2); s.shield = false; }
      s.hp -= bossDmg;
      s.lastHit = bossDmg;
    }

    // Phase transition
    if (s.incursionBossHp <= 0 && s.incursionPhase < boss.phases) {
      s.incursionPhase += 1;
      s.incursionBossHp = Math.floor(boss.hp * (0.7 + s.incursionPhase * 0.3));
      s.incursionBossMaxHp = s.incursionBossHp;
      s.log = [...s.log.slice(-80), `Phase ${s.incursionPhase}!`];
    }

    // Victory
    if (s.incursionBossHp <= 0 && s.incursionPhase >= boss.phases) {
      s.incursionWon = true;
      s.incursionActive = false;
      s.log = [...s.log.slice(-80), "══════", "🏆 INCURSION DEFEATED!", "══════"];
    }

    // Death → regression
    if (s.hp <= 0) return triggerRegression();
  }

  // ═══ DUNGEON COMBAT ═══
  if (s.activity === "dungeon" && s.currentMonster && !s.incursionActive) {
    const mon = s.currentMonster;
    let playerDmg = getAtk(s);
    const skill = SKILL_DEFINITIONS[s.activeSkill];
    let usedSkill = false;

    if (skill && skill.type === "active" && skill.energyCost > 0 && s.combatEnergy >= skill.energyCost) {
      if (s.activeSkill === "manaShield") {
        s.shield = true;
        s.combatEnergy -= skill.energyCost;
      } else {
        playerDmg = Math.floor(playerDmg * skill.dmgMult);
        s.combatEnergy -= skill.energyCost;
        usedSkill = true;
      }
    }
    s.monsterHp -= playerDmg;

    // Skill experience
    if (s.skills[s.activeSkill] && usedSkill) {
      const skillState = { ...s.skills[s.activeSkill] };
      skillState.exp += 1;
      if (skillState.exp >= skillState.expToNext) {
        skillState.level += 1;
        skillState.exp = 0;
        skillState.expToNext = Math.floor(skillState.expToNext * 1.5);
        s.log = [...s.log.slice(-80), `⬆ ${SKILL_DEFINITIONS[s.activeSkill]?.name} Lv.${skillState.level}`];
      }
      s.skills = { ...s.skills, [s.activeSkill]: skillState };
    }

    // Passive skill exp
    ["windStep", "ironBody"].forEach(skillId => {
      if (s.skills[skillId]) {
        const ps = { ...s.skills[skillId] };
        ps.exp += 0.3;
        if (ps.exp >= ps.expToNext) {
          ps.level += 1;
          ps.exp = 0;
          ps.expToNext = Math.floor(ps.expToNext * 1.4);
          s.log = [...s.log.slice(-80), `⬆ ${SKILL_DEFINITIONS[skillId]?.name} Lv.${ps.level}`];
        }
        s.skills = { ...s.skills, [skillId]: ps };
      }
    });

    // Monster attacks player
    if (Math.random() * 100 > getDodge(s)) {
      let monDmg = Math.max(1, mon.dmg - getDef(s));
      if (s.shield) { monDmg = Math.floor(monDmg * 0.2); s.shield = false; }
      s.hp -= monDmg;
      s.lastHit = monDmg;
    } else {
      s.lastHit = 0;
    }

    // Player dies
    if (s.hp <= 0) {
      s.hp = 0;
      s.activity = "idle";
      s.currentMonster = null;
      s.log = [...s.log.slice(-80), `💀 Defeated on ${DUNGEON_RANKS[s.dungeonRank]}-${s.dungeonFloor}F`];
    }

    // Monster killed → gold + essence + drops
    if (s.monsterHp <= 0 && s.hp > 0) {
      const goldGain = Math.floor(mon.gold * getGoldMultiplier(s) * (1 + s.dungeonFloor * 0.05));
      const essenceGain = mon.essence;
      s.gold += goldGain;
      s.todayIncome += goldGain;

      // Raw essence (capped by pool)
      const overflow = Math.max(0, (s.rawEssence + essenceGain) - poolMax);
      s.rawEssence = Math.min(poolMax, s.rawEssence + essenceGain);
      if (overflow > 0) {
        s.log = [...s.log.slice(-80), `⚠ Pool full! -${Math.floor(overflow)} essence lost!`];
      }

      // Material drops
      const drops = rollDrops(mon.rank, s.dungeonFloor, mon.isBoss);
      if (Object.keys(drops).length > 0) {
        s.mats = addMats(s.mats, drops, matCap);
      }

      // Track highest floor
      const rank = DUNGEON_RANKS[s.dungeonRank];
      if (s.dungeonFloor > (s.highestFloors[rank] || 0)) {
        s.highestFloors = { ...s.highestFloors, [rank]: s.dungeonFloor };
      }

      // Advance floor or rank
      if (s.dungeonFloor < FLOORS_PER_RANK) {
        s.dungeonFloor += 1;
      } else if (s.dungeonRank < DUNGEON_RANKS.length - 1) {
        s.log = [...s.log.slice(-80), `🏆 ${rank}-Rank CLEARED!`];
        s.dungeonRank += 1;
        s.dungeonFloor = 1;
      }

      // Spawn next monster
      const nextRank = DUNGEON_RANKS[s.dungeonRank];
      const nextMon = generateMonster(nextRank, s.dungeonFloor);
      s.currentMonster = nextMon;
      s.monsterHp = nextMon.hp;
      s.monsterMaxHp = nextMon.hp;
    }
  }

  s.tick += 1;
  return s;
}
