// Processing jobs — monsters drop raw loot → jobs convert to gold
// Each job has recipes unlocked by leveling (XP per completion)

export const JOBS = [
  {
    id: "brewPotions",
    name: "Brew Potions",
    icon: "🧪",
    recipes: [
      { level: 0, product: "Mana Potion [Initiate]", input: { slimeGel: 2 },                       output: 18,  time: 3 },
      { level: 3, product: "Mana Potion [Adept]",    input: { slimeGel: 2, crystal: 1 },            output: 52,  time: 4 },
      { level: 8, product: "Mana Elixir [Master]",   input: { crystal: 1, manastone: 1 },           output: 115, time: 5 },
    ],
  },
  {
    id: "tanning",
    name: "Tan Hide",
    icon: "🟤",
    recipes: [
      { level: 0, product: "Cured Hide",         input: { leather: 2 },            output: 22,  time: 3 },
      { level: 3, product: "Reinforced Leather", input: { leather: 2, bone: 1 },   output: 60,  time: 4 },
      { level: 8, product: "Runed Leather",      input: { leather: 2, iron: 1 },   output: 125, time: 5 },
    ],
  },
  {
    id: "smithing",
    name: "Smithing",
    icon: "⚒️",
    recipes: [
      { level: 0,  product: "Iron Ingot",        input: { iron: 2, bone: 1 },          output: 52,  time: 5 },
      { level: 4,  product: "Enchanted Ingot",   input: { iron: 3, crystal: 1 },       output: 138, time: 6 },
      { level: 10, product: "Mana-Forged Steel", input: { iron: 2, manastone: 2 },     output: 285, time: 8 },
    ],
  },
  {
    id: "alchemy",
    name: "Alchemy",
    icon: "⚗️",
    recipes: [
      { level: 0,  product: "Essence Vial",      input: { crystal: 1, manastone: 1 },  output: 130, time: 6 },
      { level: 5,  product: "Concentrated Vial", input: { crystal: 2, manastone: 1 },  output: 270, time: 7 },
      { level: 10, product: "Void Elixir",       input: { manastone: 2, voidstone: 1 },output: 525, time: 9 },
    ],
  },
  {
    id: "enchanting",
    name: "Enchanting",
    icon: "✨",
    recipes: [
      { level: 0,  product: "Void Rune",      input: { voidstone: 1, crystal: 2 },          output: 320,  time: 8  },
      { level: 6,  product: "Soul Rune",      input: { voidstone: 1, manastone: 3 },         output: 630,  time: 9  },
      { level: 12, product: "Ascendant Rune", input: { voidstone: 2, manastone: 2 },         output: 1200, time: 12 },
    ],
  },
];

// Returns the recipe the player currently has selected for this job
export function getActiveRecipe(job, jobLevels = {}, activeJobRecipe = {}) {
  const level = jobLevels[job.id] || 0;
  const selected = activeJobRecipe[job.id] || 0;
  const unlocked = job.recipes.filter(r => r.level <= level);
  if (unlocked.length === 0) return job.recipes[0];
  return unlocked[Math.min(selected, unlocked.length - 1)];
}

// XP needed to reach next job level
export function getJobXpNeeded(level) {
  return (level + 1) * 5;
}

export const HIRES = [
  { id: "h1", name: "Hire Tanner",    cost: 1500, mats: { leather: 10, bone: 5 },           job: "tanning"    },
  { id: "h2", name: "Hire Smith",     cost: 3000, mats: { iron: 15, bone: 8 },               job: "smithing"   },
  { id: "h3", name: "Hire Alchemist", cost: 8000, mats: { crystal: 10, manastone: 5 },       job: "alchemy"    },
];
