// Weapons, Armor, Accessories

export const WEAPONS = [
  { id: "w0", name: "Rusty Sword", icon: "🗡️", atk: 0, cost: 0, mats: {} },
  { id: "w1", name: "Iron Blade", icon: "⚔️", atk: 5, cost: 50, mats: { iron: 3, leather: 2 } },
  { id: "w2", name: "Steel Sword", icon: "⚔️", atk: 15, cost: 200, mats: { iron: 8, bone: 3 } },
  { id: "w3", name: "Mana Edge", icon: "🔮", atk: 35, cost: 800, mats: { iron: 5, crystal: 6 } },
  { id: "w4", name: "Adamant Blade", icon: "💎", atk: 80, cost: 3000, mats: { crystal: 10, manastone: 4 } },
  { id: "w5", name: "Dragon Fang", icon: "🐉", atk: 180, cost: 12000, mats: { manastone: 8, voidstone: 5 } },
  { id: "w6", name: "Void Reaver", icon: "🌀", atk: 400, cost: 40000, mats: { voidstone: 15, manastone: 10 } },
];

export const ARMORS = [
  { id: "a0", name: "Cloth Tunic", icon: "👕", def: 0, cost: 0, mats: {} },
  { id: "a1", name: "Leather Armor", icon: "🦺", def: 3, cost: 40, mats: { leather: 5 } },
  { id: "a2", name: "Chainmail", icon: "⛓️", def: 10, cost: 180, mats: { iron: 10, leather: 4 } },
  { id: "a3", name: "Mana Plate", icon: "🛡️", def: 25, cost: 700, mats: { iron: 6, crystal: 5 } },
  { id: "a4", name: "Adamant Plate", icon: "💎", def: 55, cost: 2800, mats: { crystal: 8, manastone: 4 } },
  { id: "a5", name: "Dragon Scale", icon: "🐉", def: 120, cost: 11000, mats: { manastone: 8, voidstone: 4 } },
  { id: "a6", name: "Void Aegis", icon: "🌀", def: 280, cost: 38000, mats: { voidstone: 12, manastone: 8 } },
];

export const ACCESSORIES = [
  { id: "ac0", name: "None", icon: "—", bonus: {}, cost: 0, mats: {}, desc: "—" },
  { id: "ac1", name: "Mana Ring", icon: "💍", bonus: { poolBonus: 20 }, cost: 80, mats: { crystal: 2 }, desc: "+20 pool" },
  { id: "ac2", name: "Vitality Pendant", icon: "📿", bonus: { maxHp: 30 }, cost: 150, mats: { bone: 4 }, desc: "+30HP" },
  { id: "ac3", name: "Hunter Charm", icon: "🔮", bonus: { atkFlat: 8 }, cost: 350, mats: { iron: 5, bone: 3 }, desc: "+8ATK" },
  { id: "ac4", name: "Wind Talisman", icon: "💨", bonus: { dodgeFlat: 5 }, cost: 600, mats: { crystal: 4 }, desc: "+5%dodge" },
  { id: "ac5", name: "Blood Ruby", icon: "❤️‍🔥", bonus: { maxHp: 80, atkFlat: 12 }, cost: 2500, mats: { manastone: 6 }, desc: "+80HP+12ATK" },
  { id: "ac6", name: "Void Emblem", icon: "🌑", bonus: { atkFlat: 30, defFlat: 15, poolBonus: 50 }, cost: 10000, mats: { voidstone: 8 }, desc: "+30ATK+15DEF+50pool" },
];

// Lookup helpers
export function getWeapon(id) {
  return WEAPONS.find(w => w.id === id) || WEAPONS[0];
}

export function getArmor(id) {
  return ARMORS.find(a => a.id === id) || ARMORS[0];
}

export function getAccessory(id) {
  return ACCESSORIES.find(a => a.id === id) || ACCESSORIES[0];
}
