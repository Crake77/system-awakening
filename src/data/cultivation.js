// Cultivation system data
// All cultivation costs are in processed essence (✦) — no gold

// Meditation Technique level costs (processed essence)
export const MED_TECH_COSTS = [];
for (let i = 0; i < 50; i++) {
  MED_TECH_COSTS.push(Math.floor(10 + i * 6 + Math.pow(i, 1.5)));
}


export const CORE_TIERS = [
  { name: "Cracked", passiveEss: 0.3, procEssCost: 30, desc: "+0.3 raw ess/s" },
  { name: "Flawed", passiveEss: 0.8, procEssCost: 80, desc: "+0.8 raw ess/s" },
  { name: "Common", passiveEss: 2.0, procEssCost: 200, desc: "+2.0 raw ess/s" },
  { name: "Pristine", passiveEss: 4.5, procEssCost: 500, desc: "+4.5 raw ess/s" },
  { name: "Perfect", passiveEss: 10, procEssCost: 1200, desc: "+10 raw ess/s" },
  { name: "Dao-Infused", passiveEss: 25, procEssCost: 3000, desc: "+25 raw ess/s" },
];

// Meridians — stat boosts, cost processed essence only
export const MERIDIANS = [
  { name: "Heart", stat: "vit", bonus: 5, essCost: 15, hardenEssCost: 40, icon: "❤️" },
  { name: "Arm", stat: "str", bonus: 5, essCost: 15, hardenEssCost: 40, icon: "💪" },
  { name: "Leg", stat: "agi", bonus: 5, essCost: 15, hardenEssCost: 40, icon: "🦿" },
  { name: "Mind", stat: "int", bonus: 5, essCost: 15, hardenEssCost: 40, icon: "🧠" },
  { name: "Soul", stat: "wis", bonus: 5, essCost: 15, hardenEssCost: 40, icon: "👁️" },
  { name: "Dao", stat: "all", bonus: 3, essCost: 60, hardenEssCost: 150, icon: "☯️" },
];

// Body Cultivation Techniques — 5 categories, 3 tiers each (evolve at level 10)
export const BODY_TECHNIQUES = [
  {
    id: "skin",
    category: "Skin", icon: "🌳",
    desc: "Tempers outer flesh into an impenetrable shell.",
    shopCost: 250, shopMats: { bone: 3, iron: 2 },
    tiers: [
      { name: "Bark Skin",           icon: "🌳", perLevel: { def: 1.5, hp: 5 } },
      { name: "Iron Skin",           icon: "🛡️", perLevel: { def: 3.5, hp: 12 } },
      { name: "Adamantine Carapace", icon: "💎", perLevel: { def: 7,   hp: 25 } },
    ],
    essCostBase: 8, essCostScale: 1.4,
    evolveCosts: [
      { ess: 80,  mats: { iron: 5 } },
      { ess: 400, mats: { iron: 8, crystal: 3 } },
    ],
  },
  {
    id: "veins",
    category: "Veins", icon: "🩸",
    desc: "Widens mana channels for vast essence capacity.",
    shopCost: 300, shopMats: { crystal: 3, bone: 2 },
    tiers: [
      { name: "Flowing Veins",     icon: "🩸", perLevel: { poolBonus: 12, refinedBonus: 12 } },
      { name: "Crystalline Veins", icon: "💠", perLevel: { poolBonus: 28, refinedBonus: 28 } },
      { name: "Void Conduits",     icon: "🌑", perLevel: { poolBonus: 60, refinedBonus: 60 } },
    ],
    essCostBase: 10, essCostScale: 1.4,
    evolveCosts: [
      { ess: 100, mats: { crystal: 5, manastone: 2 } },
      { ess: 500, mats: { crystal: 8, manastone: 5, voidstone: 1 } },
    ],
  },
  {
    id: "mind",
    category: "Mind", icon: "🧠",
    desc: "Refines mental clarity for accelerated cultivation.",
    shopCost: 400, shopMats: { crystal: 4, bone: 2 },
    tiers: [
      { name: "Focused Mind",     icon: "🧠", perLevel: { int: 2, wis: 1, processBonus: 0.04 } },
      { name: "Scholar's Mind",   icon: "📚", perLevel: { int: 3, wis: 2, processBonus: 0.08 } },
      { name: "Enlightened Sage", icon: "👁️", perLevel: { int: 6, wis: 4, processBonus: 0.14 } },
    ],
    essCostBase: 12, essCostScale: 1.5,
    evolveCosts: [
      { ess: 120, mats: { manastone: 3, crystal: 4 } },
      { ess: 600, mats: { manastone: 6, voidstone: 2 } },
    ],
  },
  {
    id: "heart",
    category: "Heart", icon: "❤️",
    desc: "Fortifies the vital core for life and endurance.",
    shopCost: 350, shopMats: { bone: 5, iron: 2 },
    tiers: [
      { name: "Tempering Heart", icon: "❤️", perLevel: { vit: 2, hpRegen: 0.3 } },
      { name: "Iron Heart",      icon: "🔴", perLevel: { vit: 4, hpRegen: 0.7 } },
      { name: "Dragon Heart",    icon: "🐉", perLevel: { vit: 8, hpRegen: 1.5 } },
    ],
    essCostBase: 10, essCostScale: 1.45,
    evolveCosts: [
      { ess: 90,  mats: { iron: 4, bone: 4 } },
      { ess: 450, mats: { iron: 8, bone: 6, manastone: 3 } },
    ],
  },
  {
    id: "breathing",
    category: "Breathing", icon: "💨",
    desc: "Masters breath for agility and combat energy flow.",
    shopCost: 450, shopMats: { bone: 4, crystal: 2 },
    tiers: [
      { name: "Wind Breath",  icon: "💨", perLevel: { agi: 1, combatEn: 3, dodge: 0.5 } },
      { name: "Storm Breath", icon: "⚡", perLevel: { agi: 2, combatEn: 6, dodge: 1.0 } },
      { name: "Void Breath",  icon: "🌪️", perLevel: { agi: 4, combatEn: 12, dodge: 2.0 } },
    ],
    essCostBase: 12, essCostScale: 1.45,
    evolveCosts: [
      { ess: 100, mats: { crystal: 3, bone: 5 } },
      { ess: 500, mats: { crystal: 6, manastone: 4, voidstone: 1 } },
    ],
  },
];

// Essence cost to level up a body technique
export function bodyTechEssCost(tech, level, tier = 0) {
  return Math.floor(tech.essCostBase * Math.pow(tech.essCostScale, level) * (1 + tier * 0.3));
}

// Pool expansion cost — shared by Mana Veins (raw cap) and Mana Pool (refined cap)
export function poolExpandCost(currentCap) {
  return Math.floor(8 + currentCap * 0.15);
}

export const POOL_EXPAND_AMOUNT = 20;

// Core unlocks once refined pool cap reaches this threshold (~3 upgrades from start)
export const CORE_UNLOCK_POOL_CAP = 100;
