// Main game loop - runs every 500ms
// Separated from UI so it's easy to modify game logic without touching components

import { generateMonster, rollDrops, generateIncursionBoss, DUNGEON_RANKS, FLOORS_PER_RANK } from '../data/monsters.js';
import { SKILL_DEFINITIONS, MARTIAL_SKILLS, ESSENCE_SKILLS } from '../data/skills.js';
import { JOBS, getActiveRecipe, getJobXpNeeded } from '../data/jobs.js';
import { DAY_SECONDS, FOOD_DAILY_COST, INCURSION_BASE_TIMER } from '../data/regression.js';
import { createInitialState } from './state.js';
import {
  getMaxHp, getMaxCombatEnergy, getCombatEnergyRegen, getMatCap, getPoolMax, getRefinedCap,
  getRestRate, corePassiveRate, getProcessingRate,
  getAtk, getDef, getDodge, getJobMultiplier,
  getRent, hasMats, subtractMats, addMats, regLevel, calcRegressionPts,
} from './helpers.js';

export function gameTick(prev) {
  // Shallow clone with mutable sub-objects
  const s = {
    ...prev,
    mats: { ...prev.mats },
    skills: { ...(prev.skills || {}) },
    martialSkills: { ...(prev.martialSkills || { basicMartialArts: { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 50 }] } }) },
    essenceSkills: { ...(prev.essenceSkills || { essenceStrike: { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 60 }] } }) },
    essenceCooldowns: { ...(prev.essenceCooldowns || {}) },
    martialMontages: { ...(prev.martialMontages || {}) },
    essenceMontages: { ...(prev.essenceMontages || {}) },
    equippedMartialSkills: (prev.equippedMartialSkills || [{ schoolId: "basicMartialArts", techIdx: 0 }])
      .map(sl => (!sl ? { schoolId: "basicMartialArts", techIdx: 0 } : typeof sl === 'string' ? { schoolId: sl, techIdx: 0 } : sl)),
    equippedEssenceSkills: (prev.equippedEssenceSkills || [{ schoolId: "essenceStrike", techIdx: 0 }])
      .map(sl => (!sl ? { schoolId: "essenceStrike", techIdx: 0 } : typeof sl === 'string' ? { schoolId: sl, techIdx: 0 } : sl)),
    hiredWorkers: { ...prev.hiredWorkers },
    hireProgress: { ...prev.hireProgress },
    dailyIncome: prev.dailyIncome.slice(),
    weekPurchases: prev.weekPurchases.slice(),
    ownedBodyTechs: { ...(prev.ownedBodyTechs || {}) },
    equippedBodyTechs: (prev.equippedBodyTechs || []).slice(),
    combatLog: (prev.combatLog || []).slice(),
  };

  // Ensure all martial schools are in new format (techLevels), fix old flat format on-the-fly
  Object.keys(s.martialSkills).forEach(sid => {
    const sc = s.martialSkills[sid];
    if (!sc || !sc.techLevels || sc.techLevels.length === 0) {
      const def = MARTIAL_SKILLS[sid];
      const expBase = def?.expBase || 50;
      const techIdx = Math.max(0, (sc?.level || 1) - 1);
      const techLevels = [];
      for (let i = 0; i < techIdx; i++) techLevels.push({ level: 5, exp: 0, expToNext: Math.floor(expBase * Math.pow(1.3, i)) });
      techLevels.push({ level: Math.min(5, sc?.level || 1), exp: sc?.exp || 0, expToNext: Math.floor(expBase * Math.pow(1.3, techIdx)) });
      s.martialSkills[sid] = { activeTechIdx: techIdx, techLevels };
    }
  });
  if (!s.martialSkills.basicMartialArts) {
    s.martialSkills.basicMartialArts = { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 50 }] };
  }
  // Same for essence skills
  Object.keys(s.essenceSkills).forEach(sid => {
    const sc = s.essenceSkills[sid];
    if (!sc || !sc.techLevels || sc.techLevels.length === 0) {
      const def = ESSENCE_SKILLS[sid];
      const expBase = def?.expBase || 60;
      const techIdx = Math.max(0, (sc?.level || 1) - 1);
      const techLevels = [];
      for (let i = 0; i < techIdx; i++) techLevels.push({ level: 5, exp: 0, expToNext: Math.floor(expBase * Math.pow(1.3, i)) });
      techLevels.push({ level: Math.min(5, sc?.level || 1), exp: sc?.exp || 0, expToNext: Math.floor(expBase * Math.pow(1.3, techIdx)) });
      s.essenceSkills[sid] = { activeTechIdx: techIdx, techLevels };
    }
  });
  if (!s.essenceSkills.essenceStrike) {
    s.essenceSkills.essenceStrike = { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 60 }] };
  }

  // ═══ MONTAGE TIMERS ═══
  // Martial montages
  if (Object.keys(s.martialMontages).length > 0) {
    const newMontages = { ...s.martialMontages };
    Object.keys(newMontages).forEach(schoolId => {
      newMontages[schoolId] -= 0.5;
      if (newMontages[schoolId] <= 0) {
        const def = MARTIAL_SKILLS[schoolId];
        const school = s.martialSkills[schoolId];
        if (def && school) {
          const oldIdx = school.activeTechIdx;
          const newIdx = oldIdx + 1;
          if (newIdx < def.levels.length) {
            const newExpToNext = Math.floor((def.expBase || 50) * Math.pow(1.3, newIdx));
            const newTechLevels = [...school.techLevels];
            newTechLevels[newIdx] = { level: 1, exp: 0, expToNext: newExpToNext };
            s.martialSkills = {
              ...s.martialSkills,
              [schoolId]: { ...school, activeTechIdx: newIdx, techLevels: newTechLevels },
            };
            // Auto-advance any slot that was using the old technique to the new one
            s.equippedMartialSkills = s.equippedMartialSkills.map(slot =>
              (slot && slot.schoolId === schoolId && slot.techIdx === oldIdx)
                ? { schoolId, techIdx: newIdx }
                : slot
            );
            s.log = [...s.log.slice(-80), `⚡ Training complete! ${def.name}: ${def.levels[newIdx].name} (Lv.1)`];
          }
        }
        delete newMontages[schoolId];
      }
    });
    s.martialMontages = newMontages;
  }
  // Essence montages
  if (Object.keys(s.essenceMontages).length > 0) {
    const newMontages = { ...s.essenceMontages };
    Object.keys(newMontages).forEach(schoolId => {
      newMontages[schoolId] -= 0.5;
      if (newMontages[schoolId] <= 0) {
        const def = ESSENCE_SKILLS[schoolId];
        const school = s.essenceSkills[schoolId];
        if (def && school) {
          const oldIdx = school.activeTechIdx;
          const newIdx = oldIdx + 1;
          if (newIdx < def.levels.length) {
            const newExpToNext = Math.floor((def.expBase || 60) * Math.pow(1.3, newIdx));
            const newTechLevels = [...school.techLevels];
            newTechLevels[newIdx] = { level: 1, exp: 0, expToNext: newExpToNext };
            s.essenceSkills = {
              ...s.essenceSkills,
              [schoolId]: { ...school, activeTechIdx: newIdx, techLevels: newTechLevels },
            };
            s.equippedEssenceSkills = s.equippedEssenceSkills.map(slot =>
              (slot && slot.schoolId === schoolId && slot.techIdx === oldIdx)
                ? { schoolId, techIdx: newIdx }
                : slot
            );
            s.essenceCooldowns = { ...(s.essenceCooldowns || {}), [schoolId]: 0 };
            s.log = [...s.log.slice(-80), `⚡ Training complete! ${def.name}: ${def.levels[newIdx].name} (Lv.1)`];
          }
        }
        delete newMontages[schoolId];
      }
    });
    s.essenceMontages = newMontages;
  }

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
    s.combatEnergy = Math.min(s.maxCombatEnergy, s.combatEnergy + getCombatEnergyRegen(s) * 0.5);
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

  // ═══ ESSENCE COOLDOWN DECAY (every tick) ═══
  if (s.essenceCooldowns) {
    const cds = {};
    let changed = false;
    Object.entries(s.essenceCooldowns).forEach(([k, v]) => {
      const nv = Math.max(0, v - 0.5);
      cds[k] = nv;
      if (nv !== v) changed = true;
    });
    if (changed) s.essenceCooldowns = cds;
  }

  // ═══ COMBAT TIMER ═══
  // One exchange every 1.5 seconds — slow enough to read, fast enough to feel active
  const COMBAT_INTERVAL = 3.0;
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
    // Martial combo damage
    let playerDmg = 0;
    (s.equippedMartialSkills || ["basicMartialArts"]).forEach((skillId, idx) => {
      const def = MARTIAL_SKILLS[skillId];
      const st = (s.martialSkills || {})[skillId];
      if (!def || !st) return;
      const lvData = def.levels[Math.min((st.level || 1) - 1, def.levels.length - 1)];
      playerDmg += Math.floor(getAtk(s) * lvData.dmgMult * (1 + idx * 0.3));
    });
    if (playerDmg === 0) playerDmg = getAtk(s);
    // Essence skills
    (s.equippedEssenceSkills || []).forEach(skillId => {
      const def = ESSENCE_SKILLS[skillId];
      const st = (s.essenceSkills || {})[skillId];
      if (!def || !st) return;
      const lvData = def.levels[Math.min((st.level || 1) - 1, def.levels.length - 1)];
      const cdLeft = (s.essenceCooldowns || {})[skillId] || 0;
      const t = lvData.trigger;
      const condMet = t.type === "cooldown" ? cdLeft <= 0 : (cdLeft <= 0 && s.hp / s.maxHp < t.threshold);
      if (condMet && s.combatEnergy >= lvData.energyCost) {
        s.combatEnergy -= lvData.energyCost;
        s.essenceCooldowns = { ...(s.essenceCooldowns || {}), [skillId]: t.type === "cooldown" ? t.seconds : (t.cooldown || 4) };
        if (lvData.dmgMult) playerDmg += Math.floor(getAtk(s) * lvData.dmgMult);
        if (lvData.healPct) s.hp = Math.min(s.maxHp, s.hp + Math.floor(s.maxHp * lvData.healPct));
      }
    });
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

    // ── MARTIAL SKILLS: all equipped slots fire in sequence (combo) ──
    const equippedMartial = s.equippedMartialSkills || [{ schoolId: "basicMartialArts", techIdx: 0 }];
    let totalMartialDmg = 0;
    const martialHits = [];
    let roundDefBonus = 0;   // accumulated from defensive techniques this round
    let roundDodgeBonus = 0; // accumulated from evasive techniques this round

    equippedMartial.forEach((slot, idx) => {
      if (!slot) return;
      const { schoolId, techIdx } = slot;
      const def = MARTIAL_SKILLS[schoolId];
      const school = (s.martialSkills || {})[schoolId];
      if (!def || !school) return;
      const lvData = def.levels[techIdx];
      if (!lvData) return;
      const comboMult = 1 + idx * 0.3; // +30% per successive hit in combo
      let dmg = Math.floor(getAtk(s) * lvData.dmgMult * comboMult);
      const dodged = Math.random() * 100 < (mon.dodge || 0);
      if (dodged) dmg = 0;
      else dmg = Math.max(lvData.dmgMult > 0 ? 1 : 0, dmg - (mon.def || 0));
      totalMartialDmg += dmg;
      martialHits.push({ name: lvData.name, dmg, dodged, defBuff: lvData.defBuff, dodgeBuff: lvData.dodgeBuff });
      if (lvData.defBuff) roundDefBonus += lvData.defBuff;
      if (lvData.dodgeBuff) roundDodgeBonus += lvData.dodgeBuff;

      // Martial skill sub-level exp (per-technique, 5 sub-levels before montage)
      const techLevels = [...(school.techLevels || [])];
      const tl = techLevels[techIdx] ? { ...techLevels[techIdx] } : { level: 1, exp: 0, expToNext: def.expBase || 50 };
      const isActiveTech = school.activeTechIdx === techIdx;
      const alreadyMastered = school.activeTechIdx > techIdx;
      const montageRunning = !!(s.martialMontages || {})[schoolId];

      tl.exp += 1;
      if (tl.exp >= tl.expToNext) {
        if (tl.level < 5 || alreadyMastered) {
          // Normal level up, or past-level-5 leveling on a mastered/re-slotted technique
          tl.level += 1;
          tl.exp = 0;
        } else {
          // At level 5 on active tech — cap exp, wait for montage
          tl.exp = tl.expToNext;
        }
      }
      techLevels[techIdx] = tl;
      s.martialSkills = { ...s.martialSkills, [schoolId]: { ...school, techLevels } };
    });

    s.monsterHp -= totalMartialDmg;

    // Martial combat log
    if (martialHits.length === 1) {
      const h = martialHits[0];
      s.combatLog = [...s.combatLog.slice(-11), h.dodged ? `🗡 ${h.name} — dodged!` : `🗡 ${h.name}: ${h.dmg} dmg`];
    } else if (martialHits.length > 1) {
      const parts = martialHits.map(h => h.dodged ? "✗" : String(h.dmg)).join("→");
      s.combatLog = [...s.combatLog.slice(-11), `🗡 Combo [${parts}] = ${totalMartialDmg} dmg`];
    }

    // ── ESSENCE SKILLS: auto-trigger by condition ──
    const equippedEssence = s.equippedEssenceSkills || [];
    equippedEssence.forEach(slot => {
      if (!slot) return;
      const { schoolId, techIdx } = slot;
      const def = ESSENCE_SKILLS[schoolId];
      const school = (s.essenceSkills || {})[schoolId];
      if (!def || !school) return;
      const lvData = def.levels[techIdx];
      if (!lvData) return;
      const trigger = lvData.trigger;
      const cdLeft = (s.essenceCooldowns || {})[schoolId] || 0;

      let shouldFire = false;
      if (trigger.type === "cooldown" && cdLeft <= 0) shouldFire = true;
      else if (trigger.type === "hp_below" && cdLeft <= 0 && s.hp / s.maxHp < trigger.threshold) shouldFire = true;

      if (shouldFire && s.combatEnergy >= lvData.energyCost) {
        s.combatEnergy -= lvData.energyCost;
        const newCd = trigger.type === "cooldown" ? trigger.seconds : (trigger.cooldown || 4);
        s.essenceCooldowns = { ...(s.essenceCooldowns || {}), [schoolId]: newCd };

        if (lvData.healPct) {
          const heal = Math.floor(s.maxHp * lvData.healPct);
          s.hp = Math.min(s.maxHp, s.hp + heal);
          s.combatLog = [...s.combatLog.slice(-11), `💚 ${lvData.name}: +${heal} HP`];
        } else if (lvData.dmgMult) {
          let dmg = Math.floor(getAtk(s) * lvData.dmgMult);
          const dodged = Math.random() * 100 < (mon.dodge || 0);
          if (dodged) dmg = 0;
          else dmg = Math.max(1, dmg - (mon.def || 0));
          s.monsterHp -= dmg;
          s.combatLog = [...s.combatLog.slice(-11), dodged ? `✦ ${lvData.name} — dodged!` : `✦ ${lvData.name}: ${dmg} dmg`];
        }

        // Essence skill sub-level exp (same 5-level system)
        const techLevels = [...(school.techLevels || [])];
        const tl = techLevels[techIdx] ? { ...techLevels[techIdx] } : { level: 1, exp: 0, expToNext: def.expBase || 60 };
        const isActiveTech = school.activeTechIdx === techIdx;
        const alreadyMastered = school.activeTechIdx > techIdx;
        const montageRunning = !!(s.essenceMontages || {})[schoolId];

        tl.exp += 1;
        if (tl.exp >= tl.expToNext) {
          if (tl.level < 5 || alreadyMastered) {
            tl.level += 1;
            tl.exp = 0;
          } else {
            tl.exp = tl.expToNext;
          }
        }
        techLevels[techIdx] = tl;
        s.essenceSkills = { ...s.essenceSkills, [schoolId]: { ...school, techLevels } };
      }
    });

    // Passive skill exp (windStep, ironBody)
    ["windStep", "ironBody"].forEach(skillId => {
      if (s.skills?.[skillId]) {
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

    // Monster martial attack (roundDefBonus/roundDodgeBonus from defensive techniques this round)
    s.monsterEssenceCd = Math.max(0, (s.monsterEssenceCd || 0) - 1.5);
    const effectiveDodge = getDodge(s) + roundDodgeBonus * 100;
    if (Math.random() * 100 > effectiveDodge) {
      const bonusDef = Math.round(getDef(s) * roundDefBonus);
      let monDmg = Math.max(1, mon.dmg - getDef(s) - bonusDef);
      const blocked = s.shield;
      if (s.shield) { monDmg = Math.floor(monDmg * 0.2); s.shield = false; }
      s.hp -= monDmg;
      s.lastHit = monDmg;
      const attackName = mon.martialName || "Strike";
      s.combatLog = [...s.combatLog.slice(-11), blocked
        ? `🛡 Shield absorbs ${mon.name}'s ${attackName} — ${monDmg} dmg`
        : `💥 ${mon.name}: ${attackName} — ${monDmg} dmg`];
    } else {
      s.lastHit = 0;
      s.combatLog = [...s.combatLog.slice(-11), `💨 You dodge ${mon.name}'s attack!`];
    }

    // Monster essence skill
    if (mon.essenceSkill && s.monsterHp > 0) {
      const esk = mon.essenceSkill;
      let esFires = false;
      if (esk.type === "cooldown" && s.monsterEssenceCd <= 0) esFires = true;
      else if (esk.type === "hp_below" && s.monsterEssenceCd <= 0 && s.monsterHp / s.monsterMaxHp < esk.threshold) esFires = true;
      if (esFires) {
        s.monsterEssenceCd = esk.cooldown || 4;
        if (Math.random() * 100 > getDodge(s)) {
          const esDmg = Math.max(1, Math.floor(mon.dmg * esk.dmgMult) - getDef(s));
          s.hp -= esDmg;
          s.lastHit = Math.max(s.lastHit, esDmg);
          s.combatLog = [...s.combatLog.slice(-11), `✦ ${mon.name}: ${esk.name} — ${esDmg} dmg!`];
        } else {
          s.combatLog = [...s.combatLog.slice(-11), `💨 You dodge ${mon.name}'s ${esk.name}!`];
        }
      }
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
      s.monsterEssenceCd = 0;
      const eLabel = nextMon.essenceSkill ? ` ✦ ${nextMon.essenceSkill.name}` : "";
      s.combatLog = [`⚔ ${nextMon.name} appears! HP: ${nextMon.hp}${eLabel}`];
    }
  }

  s.tick += 1;
  return s;
}
