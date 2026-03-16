// Regression (prestige) upgrades

export const REGRESSION_UPGRADES = [
  { id: "r1", name: "Karmic STR", icon: "💪", desc: "+3 ATK per level", cost: 1, maxLevel: 15 },
  { id: "r2", name: "Karmic DEF", icon: "🛡️", desc: "+3 DEF per level", cost: 1, maxLevel: 15 },
  { id: "r3", name: "Echo", icon: "⏳", desc: "+100g starting gold per level", cost: 1, maxLevel: 10 },
  { id: "r4", name: "Iron Will", icon: "🧠", desc: "+15 max HP per level", cost: 1, maxLevel: 15 },
  { id: "r5", name: "Merchant's Eye", icon: "🗺️", desc: "+5% job income per level", cost: 1, maxLevel: 10 },
  { id: "r6", name: "Precognition", icon: "🔮", desc: "+2% dodge per level", cost: 2, maxLevel: 5 },
  { id: "r7", name: "Timeline", icon: "🌀", desc: "+30s incursion timer per level", cost: 3, maxLevel: 5 },
  { id: "r8", name: "Deep Focus", icon: "🧘", desc: "+10% processing speed per level", cost: 2, maxLevel: 5 },
  { id: "r9", name: "Essence Memory", icon: "💜", desc: "+10 starting processed essence per level", cost: 2, maxLevel: 5 },
  { id: "r10", name: "Pool Memory", icon: "💠", desc: "+20 starting pool capacity per level", cost: 1, maxLevel: 10 },
  { id: "r11", name: "Body Mastery", icon: "🔥", desc: "+1 body cultivation slot per level", cost: 4, maxLevel: 3 },
];

export const INCURSION_BASE_TIMER = 900; // 15 minutes
export const DAY_SECONDS = 60; // 1 game day = 60 real seconds
export const FOOD_DAILY_COST = 5;
export const CLINIC_COST = 50;
