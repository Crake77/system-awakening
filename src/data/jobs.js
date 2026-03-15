// Processing jobs and hired workers

export const JOBS = [
  { id: "tanning", name: "Tanning", icon: "🟤", input: { leather: 2, bone: 1 }, output: 25, time: 5 },
  { id: "smithing", name: "Smithing", icon: "⚒️", input: { iron: 2, leather: 1 }, output: 35, time: 5 },
  { id: "alchemy", name: "Alchemy", icon: "⚗️", input: { crystal: 1, manastone: 1 }, output: 100, time: 6 },
  { id: "enchanting", name: "Enchanting", icon: "✨", input: { voidstone: 1, crystal: 2 }, output: 250, time: 8 },
];

export const HIRES = [
  { id: "h1", name: "Hire Tanner", cost: 1500, mats: { leather: 10, bone: 5 }, job: "tanning" },
  { id: "h2", name: "Hire Smith", cost: 3000, mats: { iron: 15, bone: 8 }, job: "smithing" },
  { id: "h3", name: "Hire Alchemist", cost: 8000, mats: { crystal: 10, manastone: 5 }, job: "alchemy" },
];
