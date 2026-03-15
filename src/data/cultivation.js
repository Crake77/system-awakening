// Cultivation system data
// All cultivation costs are in processed essence (✦) — no gold

// Meditation Technique level costs (processed essence)
export const MED_TECH_COSTS = [];
for (let i = 0; i < 50; i++) {
  MED_TECH_COSTS.push(Math.floor(10 + i * 6 + Math.pow(i, 1.5)));
}

// Core: unlocked at Med Tech level 3
export const CORE_UNLOCK_MED_TECH = 3;

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

// Body Techniques — purchased from shop (gold+mats), then leveled with ✦ processed essence
export const BODY_TECHNIQUES = [
  {
    id: "ironSkin", name: "Iron Skin", icon: "🛡️",
    desc: "HP & DEF per level",
    shopCost: 250, shopMats: { iron: 6, bone: 4 },
    perLevel: { hp: 8, def: 1 },
    maxLevel: 30, essCostBase: 8, essCostScale: 1.4,
  },
  {
    id: "manaVeins", name: "Mana Veins", icon: "💠",
    desc: "Combat EN per level",
    shopCost: 300, shopMats: { crystal: 4, bone: 3 },
    perLevel: { combatEn: 3 },
    maxLevel: 25, essCostBase: 10, essCostScale: 1.4,
  },
  {
    id: "steelMuscles", name: "Steel Muscles", icon: "💪",
    desc: "ATK per level",
    shopCost: 400, shopMats: { iron: 8, leather: 5 },
    perLevel: { atk: 2 },
    maxLevel: 25, essCostBase: 12, essCostScale: 1.5,
  },
  {
    id: "ghostStep", name: "Ghost Step", icon: "👻",
    desc: "Dodge per level",
    shopCost: 500, shopMats: { bone: 6, crystal: 3 },
    perLevel: { dodge: 0.8 },
    maxLevel: 20, essCostBase: 15, essCostScale: 1.5,
  },
  {
    id: "vitalBreath", name: "Vital Breath", icon: "🌿",
    desc: "VIT + regen per level",
    shopCost: 600, shopMats: { crystal: 5, manastone: 2 },
    perLevel: { vit: 1, hpRegen: 0.3 },
    maxLevel: 20, essCostBase: 18, essCostScale: 1.6,
  },
  {
    id: "voidBody", name: "Void Body", icon: "🌑",
    desc: "All stats per level (rare)",
    shopCost: 5000, shopMats: { voidstone: 5, manastone: 5 },
    perLevel: { hp: 5, def: 1, atk: 1, combatEn: 2, dodge: 0.5 },
    maxLevel: 15, essCostBase: 40, essCostScale: 1.7,
  },
];

// Calculate essence cost for body tech at a given level
export function bodyTechEssCost(tech, currentLevel) {
  return Math.floor(tech.essCostBase * Math.pow(tech.essCostScale, currentLevel));
}

// Pool expansion cost (processed essence)
export function poolExpandCost(currentCap) {
  return Math.floor(8 + currentCap * 0.15);
}

export const POOL_EXPAND_AMOUNT = 20;
