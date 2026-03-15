// Initial game state and init function
import { MERIDIANS } from '../data/cultivation.js';
import { INCURSION_BASE_TIMER } from '../data/regression.js';

export function createInitialState(regression) {
  const reg = regression || { count: 0, pts: 0, totalPts: 0, ups: {} };
  const rl = (id) => reg.ups[id] || 0;

  return {
    tab: "dungeon",
    gold: 100 * rl("r3"),

    // Materials
    mats: { leather: 0, iron: 0, bone: 0, crystal: 0, manastone: 0, voidstone: 0 },

    // Base stats (modified by meridians, pills, body techs)
    baseStr: 5, baseVit: 5, baseAgi: 5, baseInt: 5, baseWis: 5,
    cultStr: 0, cultVit: 0, cultAgi: 0, cultInt: 0, cultWis: 0,
    bonusVit: 0, bonusAtk: 0, bonusDef: 0,

    // Health & combat energy
    hp: 80 + rl("r4") * 15,
    maxHp: 80 + rl("r4") * 15,
    combatEnergy: 30,
    maxCombatEnergy: 30,

    // ═══ ESSENCE SYSTEM ═══
    rawEssence: 0,
    poolCap: 50 + rl("r10") * 20,
    processedEssence: rl("r9") * 10,
    medTechLevel: 0,
    coreTier: -1, // -1 = no core

    // Meridians
    meridians: MERIDIANS.map(() => ({ opened: false, hardened: false })),

    // Body techniques (id -> level, 0 = owned but not leveled)
    bodyTechsOwned: {},
    bodyTechLevels: {},

    // Equipment
    weapon: "w0", armor: "a0", accessory: "ac0",
    ownedWeapons: ["w0"], ownedArmors: ["a0"], ownedAccessories: ["ac0"],

    // Skills
    skills: { basicAttack: { level: 1, exp: 0, expToNext: 999 } },
    activeSkill: "basicAttack",

    // Activity: "idle" | "dungeon" | "meditating" | "working"
    activity: "idle",

    // Dungeon state
    dungeonRank: 0, dungeonFloor: 1, highestFloors: {},
    currentMonster: null, monsterHp: 0, monsterMaxHp: 0,

    // Residence
    housingLevel: 0, bedLevel: 0,
    residenceUpgrades: { medMat: false, storage1: false, storage2: false, herbGarden: false },

    // Jobs
    activeJob: null, jobProgress: 0,
    hiredWorkers: {}, hireProgress: {},

    // Incursion
    incursionTimer: INCURSION_BASE_TIMER + rl("r7") * 30,
    incursionActive: false,
    incursionBossHp: 0, incursionBossMaxHp: 0,
    incursionPhase: 1, incursionWon: false,

    // Regression (prestige)
    regression: { ...reg },

    // Budget tracking
    dayTimer: 0, dayCount: 0, weekDay: 0,
    dailyIncome: [0, 0, 0, 0, 0, 0, 0],
    todayIncome: 0, todaySpending: 0,
    weekPurchases: [],
    rentPaid: true, rentOverdue: 0,
    totalWeekIncome: 0, totalWeekSpend: 0,

    // Pill timers
    procBoostTimer: 0,

    // Combat state
    shield: false, lastHit: 0,

    // UI
    showConfirm: false,

    // Log
    log: reg.count > 0
      ? [`⟳ Loop #${reg.count}. ${reg.pts} pts available.`]
      : ["[SYSTEM] Kill monsters → raw essence. Meditate → process it. Spend → get stronger.", "⚠ Incursion ETA: 15 min."],

    tick: 0,
  };
}
