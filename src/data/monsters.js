// Dungeon ranks and monster generation

export const DUNGEON_RANKS = ["F", "E", "D", "C", "B", "A", "S"];
export const FLOORS_PER_RANK = 20;

export const RANK_SCALING = {
  F: { hpBase: 15, hpScale: 4, dmgBase: 3, dmgScale: 1.2, essBase: 2, essScale: 0.8, defBase: 0, defScale: 0.3, dodge: 0  },
  E: { hpBase: 80, hpScale: 12, dmgBase: 12, dmgScale: 2.5, essBase: 6, essScale: 2,  defBase: 3, defScale: 0.8, dodge: 3  },
  D: { hpBase: 250, hpScale: 35, dmgBase: 30, dmgScale: 5, essBase: 15, essScale: 5,  defBase: 8, defScale: 1.5, dodge: 7  },
  C: { hpBase: 800, hpScale: 90, dmgBase: 70, dmgScale: 10, essBase: 40, essScale: 12, defBase: 18, defScale: 3, dodge: 12 },
  B: { hpBase: 2500, hpScale: 250, dmgBase: 150, dmgScale: 25, essBase: 100, essScale: 30, defBase: 35, defScale: 5, dodge: 18 },
  A: { hpBase: 8000, hpScale: 800, dmgBase: 400, dmgScale: 60, essBase: 300, essScale: 80, defBase: 65, defScale: 9, dodge: 25 },
  S: { hpBase: 25000, hpScale: 2500, dmgBase: 1000, dmgScale: 150, essBase: 800, essScale: 200, defBase: 120, defScale: 15, dodge: 32 },
};

export const MONSTER_NAMES = {
  F: ["Mana Rat", "Slime", "Goblin", "Kobold", "Spider", "Bat", "Wolf", "Creeper", "Golem", "Troll"],
  E: ["Orc", "Skeleton", "Dire Wolf", "Lizard", "Wraith", "Jelly", "Gargoyle", "Dark Elf", "Imp", "Beetle"],
  D: ["Ogre", "Lich", "Wyvern", "Basilisk", "Phantom", "Serpent", "Frost Giant", "Assassin", "Golem Lord", "Drake"],
  C: ["Vampire", "Wyrm", "Demon", "Construct", "Death Knight", "Chimera", "Mind Flayer", "Turtle", "Stalker", "Titan"],
  B: ["Dragon", "General", "Void Lord", "Titan", "Phoenix", "Kraken", "Arch-Lich", "Behemoth", "Seraph", "Serpent"],
  A: ["Dragon King", "Prince", "Sovereign", "Guardian", "Beast", "Horror", "Weaver", "Bender", "Devourer", "Knight"],
  S: ["Dragon God", "Emperor", "Monarch", "Guard", "World Eater", "Fate Break", "Origin", "Entropy", "Tyrant", "Architect"],
};

export const MONSTER_ICONS = {
  F: ["🐀", "🟢", "👺", "🐲", "🕷️", "🦇", "🐺", "🌿", "🗿", "👹"],
  E: ["👹", "💀", "🐕", "🦎", "👻", "🧪", "🗿", "🧝", "🔥", "🪲"],
  D: ["👹", "💀", "🐉", "🐍", "⚔️", "🔥", "❄️", "🗡️", "🤖", "🦎"],
  C: ["🧛", "⛈️", "😈", "⚙️", "💀", "🦁", "🧠", "🐢", "🌀", "🐜"],
  B: ["🐉", "👿", "🌀", "⛈️", "🔥", "🦑", "💀", "🦏", "👼", "🐍"],
  A: ["👑", "😈", "🌌", "✨", "🦕", "👁️", "⏳", "🌀", "⭐", "🗡️"],
  S: ["🐉", "👑", "🌑", "⚡", "🌍", "💫", "🦴", "☠️", "🌀", "🏛️"],
};

// Material drops by rank
// Monsters drop raw loot — process it via jobs to earn gold
// slimeGel:  F rank oozes/slimes → brew into Mana Potions
// leather:   F-E rank beasts/wolves → tan into Cured Hides
// bone:      E-D rank skeletons/undead → smelt with iron
// iron:      E-D rank golems/armored → smelt into ingots
// crystal:   D-C rank elementals → refine into Essence Vials
// manastone: C-B rank arcane beasts → concentrate for Alchemy
// voidstone: A-S rank void entities → enchant into Void Runes
export const MATERIALS = ["slimeGel", "leather", "iron", "bone", "crystal", "manastone", "voidstone"];

export const MAT_ICONS = {
  slimeGel: "🟢", leather: "🟤", iron: "⚙️", bone: "🦴",
  crystal: "💎", manastone: "💜", voidstone: "🌑",
};

export const MAT_LABELS = {
  slimeGel: "Slime Gel", leather: "Leather", iron: "Iron Ore", bone: "Bone",
  crystal: "Crystal", manastone: "Manastone", voidstone: "Voidstone",
};

export const MAT_DROPS = {
  // F rank: slimes + beasts — slimeGel is your first crafting resource
  F: [["slimeGel", 0.55], ["leather", 0.60], ["iron", 0.15]],
  // E rank: undead + armored — bone from skeletons, iron from golems, some leather still
  E: [["leather", 0.30], ["iron", 0.45], ["bone", 0.50]],
  // D rank: drakes, golems, liches — iron fades, bone heavy, first crystals appear
  D: [["iron", 0.20], ["bone", 0.35], ["crystal", 0.45]],
  // C rank: demonic/arcane — crystal + manastone core loop
  C: [["bone", 0.15], ["crystal", 0.50], ["manastone", 0.40]],
  // B rank: powerful magical — manastone primary, first voidstone
  B: [["crystal", 0.15], ["manastone", 0.55], ["voidstone", 0.25]],
  // A rank: void-touched sovereigns
  A: [["manastone", 0.20], ["voidstone", 0.60]],
  // S rank: pure void origin — dense voidstone
  S: [["voidstone", 0.70], ["manastone", 0.30]],
};

// Generate a monster for a given rank and floor
export function generateMonster(rank, floor) {
  const s = RANK_SCALING[rank];
  const nameIdx = Math.floor((floor - 1) / 2) % MONSTER_NAMES[rank].length;
  const isBoss = floor % 5 === 0;
  const bossMultiplier = isBoss ? 2.5 : 1;

  return {
    name: (isBoss ? "⚔ " : "") + MONSTER_NAMES[rank][nameIdx],
    icon: MONSTER_ICONS[rank][nameIdx],
    hp: Math.floor((s.hpBase + s.hpScale * floor) * bossMultiplier),
    dmg: Math.floor((s.dmgBase + s.dmgScale * floor) * (isBoss ? 1.8 : 1)),
    def: Math.floor((s.defBase + s.defScale * floor) * (isBoss ? 1.5 : 1)),
    dodge: s.dodge,
    essence: Math.floor((s.essBase + s.essScale * floor) * (isBoss ? 4 : 1)),
    isBoss,
    rank,
  };
}

// Roll material drops from a kill
// Deeper floors and bosses yield more — stockpile loot then convert via jobs
export function rollDrops(rank, floor, isBoss) {
  const drops = {};
  const dropTable = MAT_DROPS[rank] || [];
  // Floors 6-10 give ~1.25x, 11-15 give ~1.5x, 16-20 give ~1.75x loot
  const floorBonus = 1 + Math.floor((floor - 1) / 5) * 0.25;
  dropTable.forEach(([mat, chance]) => {
    const qty = Math.floor(
      (Math.random() < chance ? 1 : 0) * floorBonus * (isBoss ? 3 : 1)
    );
    if (qty > 0) drops[mat] = (drops[mat] || 0) + qty;
  });
  return drops;
}

// Incursion boss scaling
export function generateIncursionBoss(regressionCount) {
  const power = Math.max(0.4, 3 - regressionCount * 0.25);
  return {
    name: "Kha'zul, Vanguard of the Swarm",
    icon: "👾",
    hp: Math.floor(5000 * power),
    dmg: Math.floor(120 * power),
    phases: 3,
  };
}
