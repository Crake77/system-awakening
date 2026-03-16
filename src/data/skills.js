// Combat skills — Martial Schools and Essence Skills

// Passive skills kept for backward compat (getDef uses ironBody.level, getDodge uses windStep.level)
export const SKILL_DEFINITIONS = {
  windStep: { name: "Wind Step", icon: "💨", type: "passive", dmgMult: 0, energyCost: 0 },
  ironBody: { name: "Iron Body", icon: "🪨", type: "passive", dmgMult: 0, energyCost: 0 },
};

// Passive skill manuals (still sold in shop)
export const SKILL_MANUALS = [
  { id: "sm3", skill: "windStep", cost: 400, mats: { bone: 5 } },
  { id: "sm5", skill: "ironBody", cost: 600, mats: { iron: 8 } },
];

// ═══ MARTIAL SKILLS ═══
// All equipped martial slots fire every combat round in sequence (combo).
// Each successive hit in the combo gets +30% damage multiplier.
// levels[i] = stats for level (i+1)
export const MARTIAL_SKILLS = {
  basicMartialArts: {
    name: "Basic Martial Arts",
    icon: "👊",
    expBase: 50,
    levels: [
      { name: "Hand Slap",               dmgMult: 0.8  },
      { name: "Light Punch",             dmgMult: 1.0  },
      { name: "Jab Combo",               dmgMult: 1.3  },
      { name: "Swift Strike",            dmgMult: 1.65 },
      { name: "Iron Fist",               dmgMult: 2.05 },
      { name: "Tiger Claw",              dmgMult: 2.55 },
      { name: "Spinning Kick",           dmgMult: 3.0  },
      { name: "Elbow Smash",             dmgMult: 3.4  },
      { name: "Haymaker",                dmgMult: 3.85 },
      { name: "Dragon Palm",             dmgMult: 4.3  },
    ],
  },
  windingRiverStyle: {
    name: "Winding River Style",
    icon: "🌊",
    expBase: 60,
    levels: [
      { name: "Drifting Step",           dmgMult: 0.75 },
      { name: "Current Strike",          dmgMult: 1.0  },
      { name: "Flowing Fist",            dmgMult: 1.35 },
      { name: "River Sweep",             dmgMult: 1.75 },
      { name: "Torrential Barrage",      dmgMult: 2.15 },
      { name: "Whirlpool Kick",          dmgMult: 2.65 },
      { name: "Tidal Surge",             dmgMult: 3.25 },
      { name: "Raging Flood",            dmgMult: 3.95 },
      { name: "Deluge Palm",             dmgMult: 4.8  },
      { name: "Primordial Tidal Wave",   dmgMult: 5.9  },
    ],
  },
};

// ═══ ESSENCE SKILLS ═══
// Auto-trigger when their condition is met, draining combat energy.
// trigger.type "cooldown": fires every N seconds
// trigger.type "hp_below": fires when HP fraction < threshold (with a refire cooldown)
export const ESSENCE_SKILLS = {
  essenceStrike: {
    name: "Essence Strike",
    icon: "✦",
    expBase: 60,
    levels: [
      { name: "Essence Flicker",        energyCost: 5,  dmgMult: 1.5, trigger: { type: "cooldown", seconds: 4 } },
      { name: "Essence Strike",         energyCost: 8,  dmgMult: 2.0, trigger: { type: "cooldown", seconds: 4 } },
      { name: "Essence Burst",          energyCost: 12, dmgMult: 2.7, trigger: { type: "cooldown", seconds: 5 } },
      { name: "Essence Eruption",       energyCost: 18, dmgMult: 3.5, trigger: { type: "cooldown", seconds: 5 } },
      { name: "Surging Essence Wave",   energyCost: 25, dmgMult: 4.5, trigger: { type: "cooldown", seconds: 6 } },
      { name: "Void Essence Blast",     energyCost: 35, dmgMult: 5.8, trigger: { type: "cooldown", seconds: 7 } },
      { name: "Heaven Piercing Burst",  energyCost: 50, dmgMult: 7.5, trigger: { type: "cooldown", seconds: 8 } },
    ],
  },
  healingWave: {
    name: "Healing Wave",
    icon: "💚",
    expBase: 70,
    levels: [
      { name: "Mending Touch",          energyCost: 15, healPct: 0.12, trigger: { type: "hp_below", threshold: 0.40, cooldown: 5 } },
      { name: "Healing Pulse",          energyCost: 20, healPct: 0.20, trigger: { type: "hp_below", threshold: 0.38, cooldown: 4 } },
      { name: "Restorative Flow",       energyCost: 28, healPct: 0.30, trigger: { type: "hp_below", threshold: 0.35, cooldown: 4 } },
      { name: "Vital Surge",            energyCost: 38, healPct: 0.42, trigger: { type: "hp_below", threshold: 0.32, cooldown: 3 } },
      { name: "Essence Mending",        energyCost: 50, healPct: 0.55, trigger: { type: "hp_below", threshold: 0.30, cooldown: 3 } },
    ],
  },
};

// Manuals sold in shop to unlock additional martial/essence schools
export const MARTIAL_MANUALS = [
  { id: "mm1", skill: "windingRiverStyle", name: "Winding River Manual", cost: 350, mats: { leather: 5, bone: 3 } },
];

export const ESSENCE_MANUALS = [
  { id: "em1", skill: "healingWave", name: "Healing Wave Manual", cost: 600, mats: { crystal: 4, manastone: 1 } },
];

// Seal Breaker costs per category (each unlocks one more slot)
export const MARTIAL_SLOT_COSTS = [
  { cost: 800,   mats: { crystal: 3 } },         // slot 2
  { cost: 5000,  mats: { manastone: 4 } },        // slot 3
  { cost: 30000, mats: { voidstone: 3 } },        // slot 4
];

export const ESSENCE_SLOT_COSTS = [
  { cost: 1200,  mats: { crystal: 4 } },          // slot 2
  { cost: 8000,  mats: { manastone: 5 } },        // slot 3
  { cost: 50000, mats: { voidstone: 4 } },        // slot 4
];

export const MAX_MARTIAL_SLOTS = 4;
export const MAX_ESSENCE_SLOTS = 4;
