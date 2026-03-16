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

// Martial attack names by rank
const MONSTER_MARTIAL_NAMES = {
  F: ["Gnaw", "Claw Swipe", "Bite", "Tail Slap", "Lunge"],
  E: ["Bone Crush", "Dark Slash", "Feral Lunge", "Venom Fang", "Spectral Claw"],
  D: ["Crushing Slam", "Wyvern Talon", "Bone Shatter", "Dragon Tail", "Phantom Claw"],
  C: ["Death Strike", "Demon Slash", "Titan Fist", "Mind Crush", "Soul Rend"],
  B: ["Dragon Claw", "Void Strike", "Phoenix Burst", "Kraken Crush", "Arch Surge"],
  A: ["Sovereign Strike", "Void Rend", "World Cleave", "Horror Touch", "Divine Wrath"],
  S: ["God Fist", "Emperor's Wrath", "World Shatter", "Entropy Crush", "Tyrant's Rage"],
};

// Essence skills monsters can have — assigned based on rank/floor/boss
const MONSTER_ESSENCE_POOL = {
  // E rank bosses
  venomSpew:      { name: "Venom Spew",      type: "cooldown",  cooldown: 4, dmgMult: 1.4 },
  // D rank
  feralSurge:     { name: "Feral Surge",      type: "hp_below",  threshold: 0.5, cooldown: 5, dmgMult: 1.8 },
  darkPulse:      { name: "Dark Pulse",       type: "cooldown",  cooldown: 4, dmgMult: 1.6 },
  // C rank
  deathCoil:      { name: "Death Coil",       type: "hp_below",  threshold: 0.4, cooldown: 6, dmgMult: 2.4 },
  shadowBlast:    { name: "Shadow Blast",     type: "cooldown",  cooldown: 5, dmgMult: 2.0 },
  // B rank
  voidSurge:      { name: "Void Surge",       type: "cooldown",  cooldown: 5, dmgMult: 2.5 },
  rampage:        { name: "Rampage",          type: "hp_below",  threshold: 0.4, cooldown: 4, dmgMult: 3.0 },
  // A–S rank
  calamityStrike: { name: "Calamity Strike",  type: "cooldown",  cooldown: 6, dmgMult: 3.2 },
  worldRend:      { name: "World Rend",       type: "hp_below",  threshold: 0.35, cooldown: 5, dmgMult: 4.0 },
};

// Pick essence skill(s) for a monster — higher rank/boss = more likely / stronger
function pickMonsterEssenceSkill(rank, floor, isBoss) {
  const roll = Math.random();
  const rankIdx = ["F", "E", "D", "C", "B", "A", "S"].indexOf(rank);
  // Base chance: F=0%, E boss=40%, D=25%/boss=70%, C+=always on boss
  if (rank === "F") return null;
  if (rank === "E") return isBoss && roll < 0.5 ? MONSTER_ESSENCE_POOL.venomSpew : null;
  if (rank === "D") {
    if (isBoss) return roll < 0.5 ? MONSTER_ESSENCE_POOL.feralSurge : MONSTER_ESSENCE_POOL.darkPulse;
    return roll < 0.25 + floor * 0.01 ? MONSTER_ESSENCE_POOL.darkPulse : null;
  }
  if (rank === "C") {
    if (isBoss) return roll < 0.5 ? MONSTER_ESSENCE_POOL.deathCoil : MONSTER_ESSENCE_POOL.shadowBlast;
    return roll < 0.35 + floor * 0.01 ? MONSTER_ESSENCE_POOL.shadowBlast : null;
  }
  if (rank === "B") {
    if (isBoss) return roll < 0.5 ? MONSTER_ESSENCE_POOL.rampage : MONSTER_ESSENCE_POOL.voidSurge;
    return MONSTER_ESSENCE_POOL.voidSurge;
  }
  // A, S — always have one
  if (isBoss) return roll < 0.5 ? MONSTER_ESSENCE_POOL.worldRend : MONSTER_ESSENCE_POOL.calamityStrike;
  return MONSTER_ESSENCE_POOL.calamityStrike;
}

// Generate a monster for a given rank and floor
export function generateMonster(rank, floor) {
  const s = RANK_SCALING[rank];
  const nameIdx = Math.floor((floor - 1) / 2) % MONSTER_NAMES[rank].length;
  const isBoss = floor % 5 === 0;
  const bossMultiplier = isBoss ? 2.5 : 1;

  const martialNames = MONSTER_MARTIAL_NAMES[rank];
  const martialName = martialNames[Math.floor(Math.random() * martialNames.length)];
  const essenceSkill = pickMonsterEssenceSkill(rank, floor, isBoss);

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
    martialName,
    essenceSkill,
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
