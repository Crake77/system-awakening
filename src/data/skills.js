// Combat skills and skill manuals

export const SKILL_DEFINITIONS = {
  basicAttack: { name: "Basic Attack", icon: "👊", type: "active", dmgMult: 1, energyCost: 0 },
  powerStrike: { name: "Power Strike", icon: "💥", type: "active", dmgMult: 2.2, energyCost: 8 },
  manaShield: { name: "Mana Shield", icon: "🛡️", type: "active", dmgMult: 0, energyCost: 12 },
  windStep: { name: "Wind Step", icon: "💨", type: "passive", dmgMult: 0, energyCost: 0 },
  flameBurst: { name: "Flame Burst", icon: "🔥", type: "active", dmgMult: 3, energyCost: 18 },
  ironBody: { name: "Iron Body", icon: "🪨", type: "passive", dmgMult: 0, energyCost: 0 },
};

export const SKILL_MANUALS = [
  { id: "sm1", skill: "powerStrike", cost: 150, mats: { iron: 3 } },
  { id: "sm2", skill: "manaShield", cost: 250, mats: { crystal: 2 } },
  { id: "sm3", skill: "windStep", cost: 400, mats: { bone: 5 } },
  { id: "sm4", skill: "flameBurst", cost: 900, mats: { crystal: 5, manastone: 2 } },
  { id: "sm5", skill: "ironBody", cost: 600, mats: { iron: 8 } },
];
