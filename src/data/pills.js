// Consumable pills and potions

export const PILLS = [
  { id: "p1", name: "Minor Healing", icon: "💊", type: "heal", value: 30, cost: 15, mats: {}, desc: "+30 HP" },
  { id: "p2", name: "Healing Potion", icon: "🧪", type: "heal", value: 80, cost: 40, mats: {}, desc: "+80 HP" },
  { id: "p3", name: "Processing Pill", icon: "⚡", type: "procBoost", value: 60, cost: 200, mats: { crystal: 2 }, desc: "+50% proc 60s" },
  { id: "p4", name: "Essence Pill", icon: "💜", type: "rawEssence", value: 15, cost: 150, mats: { bone: 3 }, desc: "+15 raw essence" },
  { id: "p5", name: "Body Tempering", icon: "💪", type: "bonusVit", value: 2, cost: 300, mats: { bone: 4, iron: 3 }, desc: "+2 VIT permanent" },
  { id: "p6", name: "Breakthrough Elixir", icon: "⭐", type: "bonusAtkDef", value: 1, cost: 2000, mats: { manastone: 3 }, desc: "+5 ATK +3 DEF" },
];
