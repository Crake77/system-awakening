// Dungeon ranks and monster generation

export const DUNGEON_RANKS = ["F", "E", "D", "C", "B", "A", "S"];
export const FLOORS_PER_RANK = 20;

export const RANK_SCALING = {
  F: { hpBase: 15, hpScale: 4, dmgBase: 3, dmgScale: 1.2, goldBase: 3, goldScale: 1.5, essBase: 2, essScale: 0.8 },
  E: { hpBase: 80, hpScale: 12, dmgBase: 12, dmgScale: 2.5, goldBase: 10, goldScale: 4, essBase: 6, essScale: 2 },
  D: { hpBase: 250, hpScale: 35, dmgBase: 30, dmgScale: 5, goldBase: 30, goldScale: 10, essBase: 15, essScale: 5 },
  C: { hpBase: 800, hpScale: 90, dmgBase: 70, dmgScale: 10, goldBase: 80, goldScale: 25, essBase: 40, essScale: 12 },
  B: { hpBase: 2500, hpScale: 250, dmgBase: 150, dmgScale: 25, goldBase: 200, goldScale: 60, essBase: 100, essScale: 30 },
  A: { hpBase: 8000, hpScale: 800, dmgBase: 400, dmgScale: 60, goldBase: 600, goldScale: 180, essBase: 300, essScale: 80 },
  S: { hpBase: 25000, hpScale: 2500, dmgBase: 1000, dmgScale: 150, goldBase: 2000, goldScale: 500, essBase: 800, essScale: 200 },
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
export const MATERIALS = ["leather", "iron", "bone", "crystal", "manastone", "voidstone"];

export const MAT_ICONS = {
  leather: "🟤", iron: "⚙️", bone: "🦴",
  crystal: "💎", manastone: "💜", voidstone: "🌑",
};

export const MAT_DROPS = {
  F: [["leather", 0.7], ["iron", 0.3]],
  E: [["leather", 0.4], ["iron", 0.5], ["bone", 0.3]],
  D: [["iron", 0.3], ["bone", 0.5], ["crystal", 0.35]],
  C: [["bone", 0.3], ["crystal", 0.5], ["manastone", 0.3]],
  B: [["crystal", 0.2], ["manastone", 0.5], ["voidstone", 0.25]],
  A: [["manastone", 0.3], ["voidstone", 0.5]],
  S: [["voidstone", 0.6], ["manastone", 0.4]],
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
    gold: Math.floor((s.goldBase + s.goldScale * floor) * (isBoss ? 3 : 1)),
    essence: Math.floor((s.essBase + s.essScale * floor) * (isBoss ? 4 : 1)),
    isBoss,
    rank,
  };
}

// Roll material drops from a kill
export function rollDrops(rank, floor, isBoss) {
  const drops = {};
  const dropTable = MAT_DROPS[rank] || [];
  dropTable.forEach(([mat, chance]) => {
    const qty = Math.floor(
      (Math.random() < chance ? 1 : 0) * (1 + floor / 10) * (isBoss ? 3 : 1)
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
