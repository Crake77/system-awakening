// Meridian Manuals — purchased in shop, define how meridian training develops stats

export const MERIDIAN_MANUALS = [
  {
    id: "wanderer",
    name: "Wanderer's Scripture",
    icon: "📜",
    cost: 0, shopMats: {},
    passive: null,
    passiveDesc: "No passive bonus",
    recommendedSkills: [],
    weights: { str: 1, vit: 1, agi: 1, int: 1, wis: 1 },
    grantBase: 0.20, grantVariance: 0.30,
    clickCost: 2,
    tier: 1,
    desc: "A balanced scripture with no particular focus. Good for beginners.",
  },
  {
    id: "ironFortress",
    name: "Iron Fortress Codex",
    icon: "🛡️",
    cost: 700, shopMats: { iron: 5, bone: 3 },
    passive: { type: "maxHpMult", value: 0.08 },
    passiveDesc: "+8% Max HP",
    recommendedSkills: ["ironBody"],
    weights: { str: 2, vit: 5, agi: 1, int: 1, wis: 1 },
    grantBase: 0.40, grantVariance: 0.50,
    clickCost: 4,
    tier: 2,
    desc: "Tempers flesh into unbreakable iron. Tank build. Pairs with Iron Body & Mana Shield.",
  },
  {
    id: "phantomStep",
    name: "Phantom Step Manual",
    icon: "👻",
    cost: 1200, shopMats: { bone: 4, crystal: 2 },
    passive: { type: "dodgeFlat", value: 5 },
    passiveDesc: "+5 Dodge",
    recommendedSkills: ["windStep"],
    weights: { str: 2, vit: 1, agi: 6, int: 1, wis: 1 },
    grantBase: 0.40, grantVariance: 0.50,
    clickCost: 4,
    tier: 2,
    desc: "Trains meridians for explosive speed and evasion. Rogue/dodge build. Pairs with Wind Step.",
  },
  {
    id: "scholarGrimoire",
    name: "Scholar's Grimoire",
    icon: "📗",
    cost: 2000, shopMats: { crystal: 5, manastone: 2 },
    passive: { type: "refineMult", value: 0.20 },
    passiveDesc: "+20% Refining Speed",
    recommendedSkills: [],
    weights: { str: 1, vit: 2, agi: 1, int: 5, wis: 4 },
    grantBase: 0.50, grantVariance: 0.60,
    clickCost: 5,
    tier: 3,
    desc: "Channels essence through the mind, accelerating cultivation. Mage/refiner build.",
  },
  {
    id: "merchantPath",
    name: "Merchant Sovereign Path",
    icon: "💰",
    cost: 3500, shopMats: { manastone: 3, crystal: 3 },
    passive: { type: "jobMult", value: 0.15 },
    passiveDesc: "+15% Job Income",
    recommendedSkills: [],
    weights: { str: 1, vit: 2, agi: 2, int: 3, wis: 4 },
    grantBase: 0.50, grantVariance: 0.70,
    clickCost: 5,
    tier: 3,
    desc: "Business-minded scripture. Wisdom channels wealth. Income-focused builds.",
  },
  {
    id: "voidAscendant",
    name: "Void Ascendant Scripture",
    icon: "🌑",
    cost: 15000, shopMats: { voidstone: 5, manastone: 5 },
    passive: { type: "essGenMult", value: 0.25 },
    passiveDesc: "+25% Core Essence Generation",
    recommendedSkills: [],
    weights: { str: 3, vit: 3, agi: 3, int: 3, wis: 3 },
    grantBase: 0.80, grantVariance: 1.00,
    clickCost: 8,
    tier: 4,
    desc: "Forged from void scripture. All meridians bloom equally. Apex of general cultivation.",
  },
];

export function getManual(id) {
  return MERIDIAN_MANUALS.find(m => m.id === id) || MERIDIAN_MANUALS[0];
}

// Returns { stat: "str"|"vit"|"agi"|"int"|"wis", amount: number }
export function rollMeridianGrant(manual) {
  const stats = Object.keys(manual.weights);
  const total = stats.reduce((s, k) => s + manual.weights[k], 0);
  let r = Math.random() * total;
  for (const k of stats) {
    r -= manual.weights[k];
    if (r <= 0) {
      return { stat: k, amount: manual.grantBase + Math.random() * manual.grantVariance };
    }
  }
  return { stat: stats[stats.length - 1], amount: manual.grantBase + Math.random() * manual.grantVariance };
}
