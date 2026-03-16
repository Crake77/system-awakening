// All derived stat calculations
import { getWeapon, getArmor, getAccessory } from '../data/equipment.js';
import { BODY_TECHNIQUES, CORE_TIERS } from '../data/cultivation.js';
import { HOUSING, BEDS } from '../data/housing.js';
import { getManual } from '../data/meridianManuals.js';

// Regression level shorthand
export function regLevel(state, id) {
  return (state.regression.ups[id]) || 0;
}

// Material helpers
export function hasMats(state, mats) {
  for (const k in mats) {
    if ((state.mats[k] || 0) < mats[k]) return false;
  }
  return true;
}

export function subtractMats(mats, cost) {
  const result = { ...mats };
  for (const k in cost) result[k] = (result[k] || 0) - cost[k];
  return result;
}

export function addMats(mats, drops, cap) {
  const result = { ...mats };
  for (const k in drops) result[k] = Math.min((result[k] || 0) + drops[k], cap);
  return result;
}

// Body technique bonus calculator
export function bodyTechBonus(state, stat) {
  let total = 0;
  const equipped = state.equippedBodyTechs || [];
  equipped.forEach(id => {
    const tech = BODY_TECHNIQUES.find(t => t.id === id);
    const owned = (state.ownedBodyTechs || {})[id];
    if (!tech || !owned) return;
    const perLv = (tech.tiers[owned.tier] || tech.tiers[0]).perLevel;
    if (perLv[stat]) total += perLv[stat] * owned.level;
  });
  return total;
}

// Core passive essence generation rate
export function corePassiveRate(state) {
  if (state.coreTier < 0) return 0;
  const manual = getManual(state.meridianManualId);
  const mult = manual.passive?.type === "essGenMult" ? (1 + manual.passive.value) : 1;
  return CORE_TIERS[state.coreTier].passiveEss * mult;
}

// Processing rate (raw → processed per second)
export function getProcessingRate(state) {
  const base = 0.5 + state.medTechLevel * 0.4;
  const matBonus = state.residenceUpgrades.medMat ? 1.2 : 1.0;
  const regBonus = 1 + regLevel(state, "r8") * 0.1;
  const pillBonus = state.procBoostTimer > 0 ? 1.5 : 1.0;
  const manual = getManual(state.meridianManualId);
  const manualMult = manual.passive?.type === "refineMult" ? (1 + manual.passive.value) : 1;
  const processBonus = 1 + bodyTechBonus(state, 'processBonus');
  return base * matBonus * regBonus * pillBonus * manualMult * processBonus;
}

// Pool maximum (raw essence storage)
export function getPoolMax(state) {
  const acc = getAccessory(state.accessory);
  return state.poolCap + (acc.bonus.poolBonus || 0) + regLevel(state, "r10") * 20 + bodyTechBonus(state, 'poolBonus');
}

// Refined essence cap
export function getRefinedCap(state) {
  return (state.refinedCap || 50) + bodyTechBonus(state, 'refinedBonus');
}

// Stat calculations
export function getStr(state) { return state.baseStr + state.cultStr; }
export function getVit(state) { return state.baseVit + state.cultVit + state.bonusVit + bodyTechBonus(state, "vit"); }
export function getAgi(state) { return state.baseAgi + state.cultAgi + bodyTechBonus(state, 'agi'); }
export function getInt(state) { return state.baseInt + state.cultInt + bodyTechBonus(state, 'int'); }
export function getWis(state) { return state.baseWis + state.cultWis + bodyTechBonus(state, 'wis'); }

export function getAtk(state) {
  const acc = getAccessory(state.accessory);
  return Math.floor(
    5 + regLevel(state, "r1") * 3
    + getWeapon(state.weapon).atk
    + (acc.bonus.atkFlat || 0)
    + getStr(state) * 0.5
    + state.bonusAtk
    + bodyTechBonus(state, "atk")
  );
}

export function getDef(state) {
  const acc = getAccessory(state.accessory);
  const ironBodyLv = (state.skills.ironBody || {}).level || 0;
  return Math.floor(
    2 + regLevel(state, "r2") * 3
    + getArmor(state.armor).def
    + (acc.bonus.defFlat || 0)
    + ironBodyLv * 2
    + getVit(state) * 0.3
    + state.bonusDef
    + bodyTechBonus(state, "def")
  );
}

export function getDodge(state) {
  const acc = getAccessory(state.accessory);
  const windStepLv = (state.skills.windStep || {}).level || 0;
  const manual = getManual(state.meridianManualId);
  const manualDodge = manual.passive?.type === "dodgeFlat" ? manual.passive.value : 0;
  return Math.min(50,
    2 + windStepLv * 3
    + regLevel(state, "r6") * 2
    + getAgi(state) * 0.2
    + (acc.bonus.dodgeFlat || 0)
    + bodyTechBonus(state, "dodge")
    + manualDodge
  );
}

export function getMaxHp(state) {
  const acc = getAccessory(state.accessory);
  const manual = getManual(state.meridianManualId);
  const manualMult = manual.passive?.type === "maxHpMult" ? (1 + manual.passive.value) : 1;
  return Math.floor((
    80 + regLevel(state, "r4") * 15
    + getVit(state) * 5
    + state.medTechLevel * 2
    + (acc.bonus.maxHp || 0)
    + bodyTechBonus(state, "hp")
  ) * manualMult);
}

export function getMaxCombatEnergy(state) {
  return 30 + state.medTechLevel * 3 + bodyTechBonus(state, "combatEn");
}

export function getRestRate(state) {
  const housing = HOUSING[state.housingLevel];
  const bed = BEDS[state.bedLevel];
  const herbBonus = state.residenceUpgrades.herbGarden ? 1 : 0;
  return (2 + bed.restBonus + herbBonus + bodyTechBonus(state, "hpRegen")) * housing.restMult;
}

// Job income multiplier — r5 "Merchant's Eye" gives +5% per level
export function getJobMultiplier(state) {
  const manual = getManual(state.meridianManualId);
  const manualBonus = manual.passive?.type === "jobMult" ? manual.passive.value : 0;
  return (1 + regLevel(state, "r5") * 0.05) * (1 + manualBonus);
}

// Keep alias for any existing UI references
export function getGoldMultiplier(state) {
  return getJobMultiplier(state);
}

export function getMatCap(state) {
  return 100
    + (state.residenceUpgrades.storage1 ? 50 : 0)
    + (state.residenceUpgrades.storage2 ? 100 : 0);
}

export function getRent(state) {
  return HOUSING[state.housingLevel].rent;
}

export function getAvgDailyIncome(state) {
  return Math.floor(state.dailyIncome.reduce((a, b) => a + b, 0) / 7);
}

// Regression points earned on death/reset
// Requires meaningful progress (highFloorSum >= 10) before any points are awarded.
// This prevents the exploit of dying immediately for free points.
//   1 pt per 10 total floors cleared across all ranks
//   1 pt per 5 med tech levels (secondary contribution)
export function calcRegressionPts(highestFloors, medTechLevel) {
  const highFloorSum = Object.values(highestFloors).reduce((a, b) => a + b, 0);
  if (highFloorSum < 10) return 0;
  return Math.floor(highFloorSum / 10) + Math.floor(medTechLevel / 5);
}

// Formatting helpers
export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}

export function fmtDecimal(n) {
  return n.toFixed(1);
}

export function fmtTime(seconds) {
  return Math.floor(seconds / 60) + ":" + Math.floor(seconds % 60).toString().padStart(2, "0");
}
