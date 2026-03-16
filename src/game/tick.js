// Main game loop - runs every 500ms
// Separated from UI so it's easy to modify game logic without touching components

import { generateMonster, rollDrops, generateIncursionBoss, DUNGEON_RANKS, FLOORS_PER_RANK } from '../data/monsters.js';
import { SKILL_DEFINITIONS } from '../data/skills.js';
import { JOBS, getActiveRecipe, getJobXpNeeded } from '../data/jobs.js';
import { DAY_SECONDS, FOOD_DAILY_COST, INCURSION_BASE_TIMER } from '../data/regression.js';
import { createInitialState } from './state.js';
import {
  getMaxHp, getMaxCombatEnergy, getMatCap, getPoolMax, getRefinedCap,
  getRestRate, corePassiveRate, getProcessingRate,
  getAtk, getDef, getDodge, getJobMultiplier,
  getRent, hasMats, subtractMats, addMats, regLevel, calcRegressionPts,
} from './helpers.js';

export function gameTick(prev) {
  // Shallow clone with mutable sub-objects
  const s = {
    ...prev,
    mats: { ...prev.mats },
    skills: { ...prev.skills },
    hiredWorkers: { ...prev.hiredWorkers },
    hireProgress: { ...prev.hireProgress },
    dailyIncome: prev.dailyIncome.slice(),
    weekPurchases: prev.weekPurchases.slice(),
    ownedBodyTechs: { ...(prev.ownedBodyTechs || {}) },
    equippedBodyTechs: (prev.equippedBodyTechs || []).slice(),
    combatLog: (prev.combatLog || []).slice(),
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

  // ═══ MEDITATING (process raw → refined) ═══
  if (s.activity === "meditating" && !s.incursionActive) {
    const refinedCap = getRefinedCap(s);
    const rate = getProcessingRate(s) * 0.5;
    const toProcess = Math.min(s.rawEssence, rate, Math.max(0, refinedCap - s.processedEssence));
    if (toProcess > 0) {
      s.rawEssence -= toProcess;
      s.processedEssence = Math.min(refinedCap, s.processedEssence + toProcess);
    }
  }

  // Pill timers
  if (s.procBoostTimer > 0) s.procBoostTimer -= 0.5;

  // ═══ WORKING ═══
  if (s.activity === "working" && s.activeJob && !s.incursionActive) {
    const job = JOBS.find(j => j.id === s.activeJob);
    if (job) {
      const recipe = getActiveRecipe(job, s.jobLevels, s.activeJobRecipe);
      if (hasMats(s, recipe.input)) {
        s.jobProgress += 0.5;
        if (s.jobProgress >= recipe.time) {
          s.jobProgress = 0;
          s.mats = subtractMats(s.mats, recipe.input);
          const goldGain = Math.floor(recipe.output * getJobMultiplier(s));
          s.gold += goldGain;
          s.todayIncome += goldGain;
          s.log = [...s.log.slice(-80), `💰 ${job.name}: ${recipe.product} +${goldGain}g`];
          // Job XP & leveling
          const curLevel = (s.jobLevels || {})[job.id] || 0;
          const curXp = ((s.jobXp || {})[job.id] || 0) + 1;
          const xpNeeded = getJobXpNeeded(curLevel);
          if (curXp >= xpNeeded) {
            s.jobLevels = { ...(s.jobLevels || {}), [job.id]: curLevel + 1 };
            s.jobXp = { ...(s.jobXp || {}), [job.id]: 0 };
            s.log = [...s.log.slice(-80), `⬆ ${job.name} Lv.${curLevel + 1}!`];
          } else {
            s.jobXp = { ...(s.jobXp || {}), [job.id]: curXp };
          }
        }
      } else {
        s.activity = "idle";
        s.activeJob = null;
        s.jobProgress = 0;
        s.log = [...s.log.slice(-80), `⚠ Out of materials for ${job.name}. Return to dungeon.`];
      }
    }
  }

  // ═══ HIRED WORKERS (background) ═══
  Object.keys(s.hiredWorkers).forEach(jobId => {
    if (!s.hiredWorkers[jobId]) return;
    const job = JOBS.find(j => j.id === jobId);
    if (!job) return;
    const recipe = getActiveRecipe(job, s.jobLevels, s.activeJobRecipe);
    if (!hasMats(s, recipe.input)) return;
    s.hireProgress[jobId] = (s.hireProgress[jobId] || 0) + 0.5;
    if (s.hireProgress[jobId] >= recipe.time * 1.5) {
      s.hireProgress[jobId] = 0;
      s.mats = subtractMats(s.mats, recipe.input);
      const goldGain = Math.floor(recipe.output * getJobMultiplier(s));
      s.gold += goldGain;
      s.todayIncome += goldGain;
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
    const pts = calcRegressionPts(s.highestFloors, s.medTechLevel);
    const newReg = {
      count: s.regression.count + 1,
      pts: s.regression.pts + pts,
      totalPts: s.regression.totalPts + pts,
      ups: { ...s.regression.ups },
    };
    const newState = createInitialState(newReg);
    if (pts > 0) {
      newState.log = [...newState.log, `💀 Killed.`, `⟳ +${pts} Regression Points!`];
      newState.tab = "regression";
    } else {
      newState.log = [...newState.log, `💀 Killed. No points — reach F-10 first.`];
    }
    return newState;
  }

  // ═══ COMBAT TIMER ═══
  // One exchange every 1.5 seconds — slow enough to read, fast enough to feel active
  const COMBAT_INTERVAL = 1.5;
  let combatReady = false;
  if (s.incursionActive || (s.activity === "dungeon" && s.currentMonster)) {
    s.combatTimer = (s.combatTimer || 0) + 0.5;
    if (s.combatTimer >= COMBAT_INTERVAL) {
      s.combatTimer = 0;
      combatReady = true;
    }
  } else {
    s.combatTimer = 0;
  }

  // ═══ INCURSION COMBAT ═══
  if (combatReady && s.incursionActive && !s.incursionWon) {
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
  if (combatReady && s.activity === "dungeon" && s.currentMonster && !s.incursionActive) {
    const mon = s.currentMonster;

    // Guard: activeSkill must be in equippedSkills (handles old saves / edge cases)
    const equipped = s.equippedSkills || ["basicAttack"];
    if (!equipped.includes(s.activeSkill)) s.activeSkill = equipped[0] || "basicAttack";

    let playerDmg = getAtk(s);
    const skill = SKILL_DEFINITIONS[s.activeSkill];
    let skillFired = false;

    if (skill && skill.type === "active") {
      if (skill.energyCost === 0) {
        // Zero-cost skills (basicAttack) always fire
        skillFired = true;
      } else if (s.combatEnergy >= skill.energyCost) {
        s.combatEnergy -= skill.energyCost;
        if (s.activeSkill === "manaShield") {
          s.shield = true;
        } else {
          playerDmg = Math.floor(playerDmg * skill.dmgMult);
        }
        skillFired = true;
      }
    }
    // Monster dodge check
    const monDodged = Math.random() * 100 < (mon.dodge || 0);
    if (monDodged) playerDmg = 0;
    // Monster DEF reduces player damage
    if (playerDmg > 0) playerDmg = Math.max(1, playerDmg - (mon.def || 0));
    s.monsterHp -= playerDmg;

    // Combat log — player action
    {
      const sk = SKILL_DEFINITIONS[s.activeSkill];
      let entry;
      if (monDodged) {
        entry = `🗡 ${sk?.name || "Attack"} — ${mon.name} dodged!`;
      } else if (sk && sk.energyCost > 0 && skillFired) {
        entry = `🗡 ${sk.name} hits ${mon.name} for ${playerDmg} dmg`;
      } else {
        entry = `🗡 You strike ${mon.name} for ${playerDmg} dmg`;
      }
      s.combatLog = [...s.combatLog.slice(-11), entry];
    }

    // Skill experience — fires whenever the skill was actually used
    if (s.skills[s.activeSkill] && skillFired) {
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
      const blocked = s.shield;
      if (s.shield) { monDmg = Math.floor(monDmg * 0.2); s.shield = false; }
      s.hp -= monDmg;
      s.lastHit = monDmg;
      const entry = blocked
        ? `🛡 Shield absorbs ${mon.name}'s attack — ${monDmg} dmg`
        : `💥 ${mon.name} strikes you for ${monDmg} dmg`;
      s.combatLog = [...s.combatLog.slice(-11), entry];
    } else {
      s.lastHit = 0;
      s.combatLog = [...s.combatLog.slice(-11), `💨 You dodge ${mon.name}'s attack!`];
    }

    // Player dies
    if (s.hp <= 0) {
      s.hp = 0;
      s.activity = "idle";
      s.currentMonster = null;
      s.log = [...s.log.slice(-80), `💀 Defeated on ${DUNGEON_RANKS[s.dungeonRank]}-${s.dungeonFloor}F`];
    }

    // Monster killed → essence + loot drops (no direct gold — convert via jobs)
    if (s.monsterHp <= 0 && s.hp > 0) {
      const essenceGain = mon.essence;

      // Raw essence (capped by pool)
      const overflow = Math.max(0, (s.rawEssence + essenceGain) - poolMax);
      s.rawEssence = Math.min(poolMax, s.rawEssence + essenceGain);
      if (overflow > 0) {
        s.log = [...s.log.slice(-80), `⚠ Pool full! -${Math.floor(overflow)} essence lost!`];
      }

      // Loot drops — convert via jobs to earn gold
      const drops = rollDrops(mon.rank, s.dungeonFloor, mon.isBoss);
      if (Object.keys(drops).length > 0) {
        s.mats = addMats(s.mats, drops, matCap);
        if (mon.isBoss) {
          const dropStr = Object.entries(drops).map(([k, v]) => `${v}x ${k}`).join(", ");
          s.log = [...s.log.slice(-80), `📦 Boss loot: ${dropStr}`];
        }
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
      s.combatLog = [`⚔ ${nextMon.name} appears! HP: ${nextMon.hp}`];
    }
  }

  s.tick += 1;
  return s;
}
