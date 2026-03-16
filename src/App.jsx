// Main App - imports from separated data and game logic modules
// Tab components can be split into individual files later using Claude Code
import React, { useState, useEffect, useRef } from 'react';
import { Bar, Btn, TabBtn, Sec, MatCost, StatBox } from './components/ui/common.jsx';
import { DUNGEON_RANKS, FLOORS_PER_RANK, MATERIALS, MAT_ICONS, MAT_LABELS, generateMonster } from './data/monsters.js';
import { WEAPONS, ARMORS, ACCESSORIES, getWeapon, getArmor, getAccessory } from './data/equipment.js';
import { MED_TECH_COSTS, CORE_TIERS, CORE_UNLOCK_POOL_CAP, BODY_TECHNIQUES, bodyTechEssCost, poolExpandCost, POOL_EXPAND_AMOUNT } from './data/cultivation.js';
import { MERIDIAN_MANUALS, getManual, rollMeridianGrant } from './data/meridianManuals.js';
import {
  SKILL_DEFINITIONS, SKILL_MANUALS,
  MARTIAL_SKILLS, ESSENCE_SKILLS,
  MARTIAL_MANUALS, ESSENCE_MANUALS,
  MARTIAL_SLOT_COSTS, ESSENCE_SLOT_COSTS,
  MAX_MARTIAL_SLOTS, MAX_ESSENCE_SLOTS,
} from './data/skills.js';
import { HOUSING, BEDS, RESIDENCE_UPGRADES } from './data/housing.js';
import { JOBS, HIRES, getActiveRecipe, getJobXpNeeded } from './data/jobs.js';
import { PILLS } from './data/pills.js';
import { REGRESSION_UPGRADES, INCURSION_BASE_TIMER, FOOD_DAILY_COST, CLINIC_COST } from './data/regression.js';
import { createInitialState } from './game/state.js';
import { gameTick } from './game/tick.js';
import { saveGame, loadGame, hasSave, deleteSave, AUTO_SAVE_INTERVAL } from './game/save.js';
import { cloudSave, cloudLoad, getUser } from './game/cloudSave.js';
import { supabase } from './lib/supabase.js';
import AuthModal from './components/AuthModal.jsx';
import {
  fmt, fmtDecimal, fmtTime,
  getAtk, getDef, getDodge, getMaxHp, getMaxCombatEnergy,
  getStr, getVit, getAgi, getInt, getWis,
  getRestRate, getProcessingRate, getPoolMax, getRefinedCap, corePassiveRate,
  getRent, getAvgDailyIncome, getGoldMultiplier, getMatCap,
  hasMats, subtractMats, regLevel, calcRegressionPts,
} from './game/helpers.js';

const TABS = [
  ["dungeon", "⚔ Dungeon"],
  ["cultivation", "🧘 Cultivate"],
  ["character", "👤 Char"],
  ["inventory", "🎒 Inventory"],
  ["shop", "🏪 Shop"],
  ["skills", "📜 Skills"],
  ["residence", "🏠 Home"],
  ["jobs", "⚒️ Jobs"],
  ["budget", "💰 Budget"],
  ["regression", "⟳ Regress"],
];

const ACTIVITY_COLORS = { idle: "#444", dungeon: "#f44", meditating: "#a6f", working: "#fc0" };
const ACTIVITY_LABELS = { idle: "Idle", dungeon: "Dungeon", meditating: "Meditating", working: "Working" };

// Migrate old saves to new skill system
function normSchool(old, expBase) {
  if (!old) return { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: expBase }] };
  if (old.activeTechIdx !== undefined && old.techLevels?.length > 0) return old; // already new format
  // Old flat format: { level, exp, expToNext }
  const techIdx = Math.max(0, (old.level || 1) - 1);
  const techLevels = [];
  for (let i = 0; i < techIdx; i++) {
    techLevels.push({ level: 5, exp: 0, expToNext: Math.floor(expBase * Math.pow(1.3, i)) });
  }
  techLevels.push({ level: Math.min(5, old.level || 1), exp: old.exp || 0, expToNext: Math.floor(expBase * Math.pow(1.3, techIdx)) });
  return { activeTechIdx: techIdx, techLevels };
}

function migrateState(s) {
  // --- Martial skills: migrate each school to { activeTechIdx, techLevels[] }
  const rawMartial = s.martialSkills || {};
  const newMartial = {};
  Object.keys(rawMartial).forEach(schoolId => {
    const def = MARTIAL_SKILLS[schoolId];
    newMartial[schoolId] = normSchool(rawMartial[schoolId], def?.expBase || 50);
  });
  // Always ensure basicMartialArts exists
  if (!newMartial.basicMartialArts) {
    newMartial.basicMartialArts = { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 50 }] };
  }
  s.martialSkills = newMartial;

  // Normalize every slot in equippedMartialSkills — handle null, strings, and bad schoolId refs
  const rawEquipped = s.equippedMartialSkills || ["basicMartialArts"];
  s.equippedMartialSkills = rawEquipped.map(slot => {
    if (!slot) return { schoolId: "basicMartialArts", techIdx: 0 };
    if (typeof slot === 'string') {
      const schoolId = s.martialSkills[slot] ? slot : "basicMartialArts";
      return { schoolId, techIdx: s.martialSkills[schoolId]?.activeTechIdx || 0 };
    }
    // Object format — ensure the referenced school exists
    if (!s.martialSkills[slot.schoolId]) return { schoolId: "basicMartialArts", techIdx: 0 };
    // Ensure techIdx is within bounds
    const school = s.martialSkills[slot.schoolId];
    const techIdx = (slot.techIdx != null && slot.techIdx < school.techLevels.length) ? slot.techIdx : 0;
    return { schoolId: slot.schoolId, techIdx };
  });
  if (!s.martialSlots) s.martialSlots = 1;
  if (!s.martialMontages) s.martialMontages = {};

  // --- Essence skills: same migration
  const rawEssence = s.essenceSkills || {};
  const newEssence = {};
  Object.keys(rawEssence).forEach(schoolId => {
    const def = ESSENCE_SKILLS[schoolId];
    newEssence[schoolId] = normSchool(rawEssence[schoolId], def?.expBase || 60);
  });
  if (!newEssence.essenceStrike) {
    newEssence.essenceStrike = { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: 60 }] };
  }
  s.essenceSkills = newEssence;

  const rawEquippedEss = s.equippedEssenceSkills || ["essenceStrike"];
  s.equippedEssenceSkills = rawEquippedEss.map(slot => {
    if (!slot) return { schoolId: "essenceStrike", techIdx: 0 };
    if (typeof slot === 'string') {
      const schoolId = s.essenceSkills[slot] ? slot : "essenceStrike";
      return { schoolId, techIdx: s.essenceSkills[schoolId]?.activeTechIdx || 0 };
    }
    if (!s.essenceSkills[slot.schoolId]) return { schoolId: "essenceStrike", techIdx: 0 };
    const school = s.essenceSkills[slot.schoolId];
    const techIdx = (slot.techIdx != null && slot.techIdx < school.techLevels.length) ? slot.techIdx : 0;
    return { schoolId: slot.schoolId, techIdx };
  });
  if (!s.essenceSlots) s.essenceSlots = 1;
  if (!s.essenceCooldowns) s.essenceCooldowns = { essenceStrike: 0 };
  if (!s.essenceMontages) s.essenceMontages = {};

  // Clean up removed old-system fields
  if (s.skills) {
    ["basicAttack", "powerStrike", "manaShield", "flameBurst"].forEach(k => delete s.skills[k]);
  }
  delete s.activeSkill; delete s.skillSlots; delete s.equippedSkills;
  return s;
}

export default function App() {
  // Initialize from save or fresh
  const [gs, setGs] = useState(() => {
    const saved = loadGame();
    return saved ? migrateState(saved) : createInitialState(null);
  });
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(''); // '', 'saving', 'saved', 'error'

  // Auth listener + initial cloud load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        cloudLoad().then(cloudData => {
          if (cloudData) {
            saveGame(cloudData);
            setGs(cloudData);
          }
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        cloudLoad().then(cloudData => {
          if (cloudData) {
            saveGame(cloudData);
            setGs(cloudData);
          }
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Game tick (500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setGs(prev => gameTick(prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-save (local + cloud if signed in)
  useEffect(() => {
    const interval = setInterval(() => {
      setGs(prev => {
        saveGame(prev);
        getUser().then(u => {
          if (u) {
            setCloudStatus('saving');
            cloudSave(prev).then(ok => setCloudStatus(ok ? 'saved' : 'error'));
          }
        });
        return prev;
      });
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, []);


  // ═══════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════

  function setTab(tab) { setGs(p => ({ ...p, tab })); }

  function enterDungeon(rankIdx) {
    if (gs.incursionActive || gs.hp <= 5) return;
    const rank = DUNGEON_RANKS[rankIdx];
    const best = gs.highestFloors[rank] || 0;
    // Checkpoint every 5 floors — start at highest cleared checkpoint
    const startFloor = Math.max(1, Math.floor(best / 5) * 5);
    const mon = generateMonster(rank, startFloor);
    setGs(p => ({ ...p, activity: "dungeon", dungeonRank: rankIdx, dungeonFloor: startFloor, currentMonster: mon, monsterHp: mon.hp, monsterMaxHp: mon.hp, monsterEssenceCd: 0, log: [...p.log.slice(-80), `🚪 ${rank}-Rank F${startFloor}`] }));
  }

  function leaveDungeon() { setGs(p => ({ ...p, activity: "idle", currentMonster: null })); }
  function startMeditate() { setGs(p => ({ ...p, activity: "meditating", currentMonster: null })); }
  function startWork(jobId) { setGs(p => ({ ...p, activity: "working", activeJob: jobId, jobProgress: 0, currentMonster: null })); }
  function stopActivity() { setGs(p => ({ ...p, activity: "idle", currentMonster: null, activeJob: null, jobProgress: 0 })); }

  function healClinic() {
    if (gs.gold < CLINIC_COST) return;
    setGs(p => ({
      ...p, gold: p.gold - CLINIC_COST,
      hp: getMaxHp(p), combatEnergy: getMaxCombatEnergy(p),
      todaySpending: p.todaySpending + CLINIC_COST,
      weekPurchases: [...p.weekPurchases, { name: "Clinic", cost: CLINIC_COST }],
      totalWeekSpend: p.totalWeekSpend + CLINIC_COST,
    }));
  }

  function canAfford(cost, mats) { return gs.gold >= cost && hasMats(gs, mats); }

  function purchase(name, cost, matCost, callback) {
    if (!canAfford(cost, matCost)) return;
    setGs(p => {
      const s = {
        ...p, gold: p.gold - cost, mats: subtractMats(p.mats, matCost),
        todaySpending: p.todaySpending + cost,
        weekPurchases: [...p.weekPurchases, { name, cost }],
        totalWeekSpend: p.totalWeekSpend + cost,
      };
      return callback(s);
    });
  }

  function payRent() {
    const rent = getRent(gs);
    if (gs.gold < rent || gs.rentPaid) return;
    setGs(p => ({
      ...p, gold: p.gold - rent, rentPaid: true, rentOverdue: 0,
      todaySpending: p.todaySpending + rent,
      weekPurchases: [...p.weekPurchases, { name: "Rent", cost: rent }],
      totalWeekSpend: p.totalWeekSpend + rent,
      log: [...p.log.slice(-80), `🏠 Rent: -${rent}g`],
    }));
  }

  // ═══ CULTIVATION (all essence costs) ═══

  function levelMedTech() {
    const cost = MED_TECH_COSTS[gs.medTechLevel] || 999;
    if (gs.processedEssence < cost) return;
    setGs(p => ({
      ...p, processedEssence: p.processedEssence - cost, medTechLevel: p.medTechLevel + 1,
      log: [...p.log.slice(-80), `⬆ Med Tech Lv.${p.medTechLevel + 1}`],
    }));
  }

  function expandVeins() {
    const cost = poolExpandCost(gs.poolCap);
    if (gs.processedEssence < cost) return;
    setGs(p => ({
      ...p, processedEssence: p.processedEssence - cost, poolCap: p.poolCap + POOL_EXPAND_AMOUNT,
      log: [...p.log.slice(-80), `🌊 Mana Veins → raw cap ${p.poolCap + POOL_EXPAND_AMOUNT}`],
    }));
  }

  function expandRefinedPool() {
    const cap = gs.refinedCap || 50;
    const cost = poolExpandCost(cap);
    if (gs.processedEssence < cost) return;
    setGs(p => {
      const c = p.refinedCap || 50;
      return {
        ...p, processedEssence: p.processedEssence - cost, refinedCap: c + POOL_EXPAND_AMOUNT,
        log: [...p.log.slice(-80), `💜 Mana Pool → refined cap ${c + POOL_EXPAND_AMOUNT}`],
      };
    });
  }

  function upgradeCore() {
    const nextTier = gs.coreTier + 1;
    if (nextTier >= CORE_TIERS.length || (gs.refinedCap || 50) < CORE_UNLOCK_POOL_CAP) return;
    const tier = CORE_TIERS[nextTier];
    if (gs.processedEssence < tier.procEssCost) return;
    setGs(p => ({
      ...p, processedEssence: p.processedEssence - tier.procEssCost, coreTier: nextTier,
      log: [...p.log.slice(-80), `💎 Core → ${tier.name}`],
    }));
  }

  function trainMeridian() {
    const manual = getManual(gs.meridianManualId || "wanderer");
    const cost = manual.clickCost;
    if (gs.processedEssence < cost) return;
    setGs(p => {
      const { stat, amount } = rollMeridianGrant(manual);
      const key = "cult" + stat.charAt(0).toUpperCase() + stat.slice(1);
      return {
        ...p,
        processedEssence: p.processedEssence - cost,
        [key]: (p[key] || 0) + amount,
        meridianClicks: (p.meridianClicks || 0) + 1,
      };
    });
  }

  function setMeridianManual(id) {
    if (!(gs.ownedMeridianManuals || ["wanderer"]).includes(id)) return;
    setGs(p => ({ ...p, meridianManualId: id }));
  }

  function buyMeridianManual(manual) {
    if ((gs.ownedMeridianManuals || ["wanderer"]).includes(manual.id)) return;
    purchase(manual.name, manual.cost, manual.shopMats, s => ({
      ...s,
      ownedMeridianManuals: [...(s.ownedMeridianManuals || ["wanderer"]), manual.id],
      meridianManualId: manual.id,
    }));
  }

  function buyBodyTech(tech) {
    if ((gs.ownedBodyTechs || {})[tech.id]) return;
    purchase(tech.category, tech.shopCost, tech.shopMats, s => ({
      ...s,
      ownedBodyTechs: { ...(s.ownedBodyTechs || {}), [tech.id]: { level: 0, tier: 0 } },
    }));
  }

  function equipBodyTech(id) {
    const slots = gs.bodySlots || 1;
    const equipped = gs.equippedBodyTechs || [];
    if (equipped.includes(id)) return;
    if (equipped.length >= slots) return;
    setGs(p => ({
      ...p,
      equippedBodyTechs: [...(p.equippedBodyTechs || []), id],
      log: [...p.log.slice(-80), `💪 ${BODY_TECHNIQUES.find(t=>t.id===id)?.category} equipped`],
    }));
  }

  function unequipBodyTech(id) {
    setGs(p => ({
      ...p,
      equippedBodyTechs: (p.equippedBodyTechs || []).filter(x => x !== id),
    }));
  }

  function levelUpBodyTech(id) {
    const tech = BODY_TECHNIQUES.find(t => t.id === id);
    const owned = (gs.ownedBodyTechs || {})[id];
    if (!tech || !owned) return;
    if (owned.level >= 10) return; // must evolve first
    const cost = bodyTechEssCost(tech, owned.level, owned.tier);
    if (gs.processedEssence < cost) return;
    setGs(p => {
      const o = (p.ownedBodyTechs || {})[id];
      return {
        ...p,
        processedEssence: p.processedEssence - cost,
        ownedBodyTechs: { ...p.ownedBodyTechs, [id]: { ...o, level: o.level + 1 } },
      };
    });
  }

  function evolveBodyTech(id) {
    const tech = BODY_TECHNIQUES.find(t => t.id === id);
    const owned = (gs.ownedBodyTechs || {})[id];
    if (!tech || !owned || owned.level < 10) return;
    const nextTier = owned.tier + 1;
    if (nextTier >= tech.tiers.length) return;
    const evolveCost = tech.evolveCosts[owned.tier];
    if (gs.processedEssence < evolveCost.ess) return;
    if (!hasMats(gs, evolveCost.mats)) return;
    const tierName = tech.tiers[nextTier].name;
    setGs(p => ({
      ...p,
      processedEssence: p.processedEssence - evolveCost.ess,
      mats: subtractMats(p.mats, evolveCost.mats),
      ownedBodyTechs: { ...p.ownedBodyTechs, [id]: { level: 0, tier: nextTier } },
      log: [...p.log.slice(-80), `✨ Evolved → ${tierName}!`],
    }));
  }

  function usePill(pill) {
    if (!canAfford(pill.cost, pill.mats)) return;
    purchase(pill.name, pill.cost, pill.mats, (s) => {
      if (pill.type === "heal") s.hp = Math.min(s.maxHp, s.hp + pill.value);
      if (pill.type === "procBoost") s.procBoostTimer = pill.value;
      if (pill.type === "rawEssence") s.rawEssence = Math.min(getPoolMax(s), s.rawEssence + pill.value);
      if (pill.type === "bonusVit") s.bonusVit += pill.value;
      if (pill.type === "bonusAtkDef") { s.bonusAtk += 5; s.bonusDef += 3; }
      return s;
    });
  }

  function buyRegressionUpgrade(upg) {
    const curLv = gs.regression.ups[upg.id] || 0;
    if (curLv >= upg.maxLevel || gs.regression.pts < upg.cost) return;
    setGs(p => {
      const newUps = { ...p.regression.ups, [upg.id]: curLv + 1 };
      return { ...p, regression: { ...p.regression, pts: p.regression.pts - upg.cost, ups: newUps } };
    });
  }

  function manualReset() {
    const pts = calcRegressionPts(gs.highestFloors, gs.medTechLevel);
    const newReg = { count: gs.regression.count + 1, pts: gs.regression.pts + pts, totalPts: gs.regression.totalPts + pts, ups: { ...gs.regression.ups } };
    deleteSave();
    setGs(createInitialState(newReg));
  }

  function manualSave() {
    saveGame(gs);
    setGs(p => ({ ...p, log: [...p.log.slice(-80), "💾 Game saved!"] }));
    if (user) {
      setCloudStatus('saving');
      cloudSave(gs).then(ok => setCloudStatus(ok ? 'saved' : 'error'));
    }
  }

  function hardReset() {
    deleteSave();
    setGs(createInitialState(null));
  }

  // ═══════════════════════════════════════
  // DERIVED VALUES
  // ═══════════════════════════════════════

  const atk = getAtk(gs), def = getDef(gs), dodge = getDodge(gs);
  const rent = getRent(gs), avgIncome = getAvgDailyIncome(gs);
  const poolMax = getPoolMax(gs), processRate = getProcessingRate(gs);
  const medTechCost = MED_TECH_COSTS[gs.medTechLevel] || 999;
  const nextCore = gs.coreTier < CORE_TIERS.length - 1 ? CORE_TIERS[gs.coreTier + 1] : null;
  const coreUnlocked = (gs.refinedCap || 50) >= CORE_UNLOCK_POOL_CAP;
  const nextHouse = gs.housingLevel < HOUSING.length - 1 ? HOUSING[gs.housingLevel + 1] : null;
  const nextBed = gs.bedLevel < BEDS.length - 1 ? BEDS[gs.bedLevel + 1] : null;

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#141430" }}>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {/* HEADER */}
      <div style={{ background: "#181838", borderBottom: "1px solid #363658", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Orbitron'", fontSize: 12, color: "#0ff", fontWeight: 900 }}>SYSTEM</span>
          <span style={{ color: "#a6f", fontSize: 10 }}>MT:{gs.medTechLevel}</span>
          <span style={{ fontSize: 9, color: ACTIVITY_COLORS[gs.activity], fontWeight: 700, textTransform: "uppercase" }}>{ACTIVITY_LABELS[gs.activity]}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#fc0", fontSize: 11 }}>💰{fmt(gs.gold)}g</span>
          <span style={{ color: "#f80", fontSize: 10 }}>✦{fmt(gs.processedEssence)}</span>
          <span style={{ color: gs.incursionTimer <= 120 ? "#f44" : "#f80", fontSize: 10, fontWeight: 700, animation: gs.incursionTimer <= 60 ? "pulse .5s infinite" : "none" }}>
            {gs.incursionActive ? "⚠INC" : gs.incursionWon ? "🏆" : "👾" + fmtTime(gs.incursionTimer)}
          </span>
          <Btn onClick={manualSave} small color="#4a4">💾</Btn>
          {user ? (
            <>
              {cloudStatus === 'saving' && <span style={{ fontSize: 9, color: '#888' }}>☁ syncing…</span>}
              {cloudStatus === 'saved' && <span style={{ fontSize: 9, color: '#4a4' }}>☁ synced</span>}
              {cloudStatus === 'error' && <span style={{ fontSize: 9, color: '#f44' }}>☁ err</span>}
              <Btn onClick={() => supabase.auth.signOut()} small color="#bbb">Sign Out</Btn>
            </>
          ) : (
            <Btn onClick={() => setShowAuthModal(true)} small color="#5b4fcf">Sign In</Btn>
          )}
        </div>
      </div>

      {/* STATUS BARS */}
      <div style={{ padding: "4px 10px", display: "flex", gap: 4, background: "#151532" }}>
        <div style={{ flex: 1 }}><Bar value={gs.hp} max={gs.maxHp} color="#e44" label={`HP ${fmt(gs.hp)}/${fmt(gs.maxHp)}`} /></div>
        <div style={{ flex: 1 }}><Bar value={gs.rawEssence} max={poolMax} color="#a6f" label={`Raw ${fmt(gs.rawEssence)}/${fmt(poolMax)}`} /></div>
        <div style={{ flex: 1 }}><Bar value={gs.combatEnergy} max={gs.maxCombatEnergy} color="#48f" label={`EN ${fmt(gs.combatEnergy)}/${fmt(gs.maxCombatEnergy)}`} /></div>
      </div>

      {/* INCURSION BAR */}
      {!gs.incursionActive && !gs.incursionWon ? (
        <div style={{ padding: "0 10px 3px", background: "#151532" }}>
          <Bar value={(1 - gs.incursionTimer / (INCURSION_BASE_TIMER + regLevel(gs, "r7") * 30)) * 100} max={100} color={gs.incursionTimer <= 120 ? "#f44" : "#f80"} label={`INC: ${fmtTime(gs.incursionTimer)}`} h={10} />
        </div>
      ) : null}

      {/* MATERIALS BAR */}
      <div style={{ padding: "2px 10px 3px", background: "#151532", display: "flex", gap: 5, flexWrap: "wrap", borderBottom: "1px solid #363658" }}>
        {MATERIALS.map(m => gs.mats[m] > 0 ? (<span key={m} style={{ fontSize: 8, color: "#ccddee" }}>{MAT_ICONS[m]}{gs.mats[m]}</span>) : null)}
        {gs.procBoostTimer > 0 ? (<span style={{ fontSize: 8, color: "#a6f", animation: "pulse 1s infinite" }}>⚡{Math.ceil(gs.procBoostTimer)}s</span>) : null}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 2, padding: "4px 8px", background: "#151532", flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => (
          <TabBtn key={id} active={gs.tab === id} onClick={() => setTab(id)}
            alert={(id === "regression" && gs.regression.pts > 0) || (id === "budget" && !gs.rentPaid && rent > 0)}>
            {label}
          </TabBtn>
        ))}
      </div>

      {/* MAIN CONTENT + LOG */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ flex: 1, padding: 8, overflowY: "auto", minHeight: 0 }}>

          {/* ══════════════════════════════ */}
          {/* DUNGEON TAB                    */}
          {/* ══════════════════════════════ */}
          {gs.tab === "dungeon" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

              {/* ── DUNGEON HEADER ── */}
              {gs.activity === "dungeon" && gs.currentMonster && !gs.incursionActive ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181838", borderRadius: 5, padding: "5px 8px", border: "1px solid #34345c" }}>
                  <span style={{ fontSize: 13, color: "#0ff", fontFamily: "'Orbitron'", fontWeight: 900, letterSpacing: 2 }}>
                    {DUNGEON_RANKS[gs.dungeonRank]}-RANK &nbsp; F{gs.dungeonFloor}
                  </span>
                  <span style={{ fontSize: 8, color: "#bbccee" }}>Best: F{gs.highestFloors[DUNGEON_RANKS[gs.dungeonRank]] || 0}</span>
                  <Btn onClick={leaveDungeon} color="#f44" small>🏃 Leave</Btn>
                </div>
              ) : null}

              {gs.incursionActive ? (
                <div style={{ background: "#180808", borderRadius: 5, padding: "5px 8px", border: "1px solid #f4422a" }}>
                  <div style={{ fontSize: 11, color: "#f44", fontWeight: 900, fontFamily: "'Orbitron'", letterSpacing: 1 }}>⚠️ INCURSION — Ph{gs.incursionPhase}/3</div>
                  <Bar value={gs.incursionBossHp} max={gs.incursionBossMaxHp} color="#f44" h={10} label={`${fmt(gs.incursionBossHp)}/${fmt(gs.incursionBossMaxHp)}`} />
                </div>
              ) : null}

              {gs.incursionWon ? (
                <div style={{ background: "#141a08", borderRadius: 5, padding: "8px", border: "1px solid #fc0", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#fc0", fontWeight: 900 }}>🏆 VICTORY!</div>
                  <div style={{ fontSize: 9, color: "#fda" }}>Earth is saved.</div>
                </div>
              ) : null}

              {/* ── IDLE STATE ── */}
              {gs.activity !== "dungeon" && !gs.incursionActive && !gs.incursionWon ? (
                <div>
                  <div style={{ fontSize: 9, color: "#4a4", marginBottom: 6 }}>
                    {gs.hp < gs.maxHp ? `💤 Resting (${fmtDecimal(getRestRate(gs))}HP/s)` : "✓ Full HP"}
                  </div>
                  <Sec title="🚪 Enter Dungeon" color="#0af">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(60px,1fr))", gap: 4 }}>
                      {DUNGEON_RANKS.map((rk, i) => {
                        const ok = i <= gs.dungeonRank;
                        return (
                          <button key={rk} onClick={() => ok && enterDungeon(i)} disabled={!ok || gs.hp <= 5}
                            style={{ background: ok ? "#111128" : "#181836", border: `1px solid ${ok ? "#3a3a5e" : "#181828"}`, borderRadius: 5, padding: 5, cursor: ok ? "pointer" : "default", textAlign: "center", opacity: ok ? 1 : 0.3 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: ok ? "#0ff" : "#333", fontFamily: "'Orbitron'" }}>{rk}</div>
                            <div style={{ fontSize: 7, color: "#ccddee" }}>{ok ? `▶F${Math.max(1, Math.floor((gs.highestFloors[rk] || 0) / 5) * 5)}` : "🔒"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </Sec>
                  <Btn onClick={healClinic} disabled={gs.gold < CLINIC_COST} color="#4a4" small>🏥 Clinic {CLINIC_COST}g</Btn>
                </div>
              ) : null}

              {/* ── COMBAT VIEW ── */}
              {gs.activity === "dungeon" && gs.currentMonster && !gs.incursionActive ? (() => {
                const mon = gs.currentMonster;
                const bossColor = "#f80";
                const monColor = mon.isBoss ? bossColor : "#f44";
                // Shared grid: 2 columns, rows align automatically
                const cell = (bg, border) => ({
                  background: bg, borderLeft: `2px solid ${border}`, padding: "6px 8px",
                });
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8 }}>

                    {/* ROW 1 — Headers */}
                    <div style={{ ...cell("#181838", "#1a3a5e"), borderRadius: "6px 6px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#0af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Me</span>
                      <div style={{ width: 44 }}><Bar value={gs.combatTimer || 0} max={1.5} color="#0af" h={4} /></div>
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66"), borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: monColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{mon.isBoss ? "⚔ Boss" : "Enemy"}</span>
                    </div>

                    {/* ROW 2 — Sprites */}
                    <div style={{ ...cell("#181838", "#1a3a5e"), textAlign: "center" }}>
                      <div style={{ fontSize: 38, lineHeight: 1 }}>🥷</div>
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66"), textAlign: "center" }}>
                      <div style={{ fontSize: 38, lineHeight: 1 }}>{mon.icon}</div>
                      <div style={{ fontSize: 10, color: monColor, fontWeight: 700, marginTop: 2 }}>{mon.name}</div>
                    </div>

                    {/* ROW 3 — HP bars */}
                    <div style={{ ...cell("#181838", "#1a3a5e") }}>
                      <Bar value={gs.hp} max={gs.maxHp} color="#e44" h={11} label={`HP ${fmt(gs.hp)}/${fmt(gs.maxHp)}`} />
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66") }}>
                      <Bar value={gs.monsterHp} max={gs.monsterMaxHp} color={monColor} h={11} label={`HP ${fmt(gs.monsterHp)}/${fmt(gs.monsterMaxHp)}`} />
                    </div>

                    {/* ROW 4 — Secondary bars */}
                    <div style={{ ...cell("#181838", "#1a3a5e") }}>
                      <Bar value={gs.combatEnergy} max={gs.maxCombatEnergy} color="#48f" h={8} label={`EN ${fmt(gs.combatEnergy)}/${fmt(gs.maxCombatEnergy)}`} />
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66"), display: "flex", alignItems: "center" }}>
                      <div style={{ width: "100%", height: 8, background: "#111", borderRadius: 2 }} />
                    </div>

                    {/* ROW 5 — Stats (matched layout) */}
                    <div style={{ ...cell("#181838", "#1a3a5e") }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                        <StatBox label="⚔ ATK" value={atk} color="#f80" />
                        <StatBox label="🛡 DEF" value={def} color="#08f" />
                        <StatBox label="💨 Dodge" value={dodge.toFixed(0) + "%"} color="#0f0" />
                        <StatBox label="✦ Raw" value={`${fmt(gs.rawEssence)}/${fmt(poolMax)}`} color="#a6f" />
                      </div>
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66") }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                        <StatBox label="⚔ DMG" value={mon.dmg} color="#f44" />
                        <StatBox label="🛡 DEF" value={mon.def || 0} color="#08f" />
                        <StatBox label="💨 Dodge" value={(mon.dodge || 0) + "%"} color="#0f0" />
                        <StatBox label="✦ Ess" value={mon.essence} color="#a6f" />
                      </div>
                    </div>

                    {/* ROW 6 — Martial skill */}
                    <div style={{ ...cell("#181838", "#1a3a5e") }}>
                      <div style={{ fontSize: 7, color: "#8899cc", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>⚔ Martial</div>
                      {(gs.equippedMartialSkills || []).map((slot, i) => {
                        if (!slot) return null;
                        const def = MARTIAL_SKILLS[slot.schoolId];
                        const school = (gs.martialSkills || {})[slot.schoolId];
                        if (!def || !school) return null;
                        const tl = (school.techLevels || [])[slot.techIdx];
                        const lvData = def.levels[slot.techIdx];
                        if (!lvData) return null;
                        return (
                          <div key={i} style={{ fontSize: 8, color: "#f80" }}>
                            {def.icon} {lvData.name}
                            <span style={{ color: "#bbccee", marginLeft: 3 }}>Lv.{tl?.level || 1}</span>
                            {i > 0 && <span style={{ color: "#99aacc", marginLeft: 3 }}>+{i * 30}%</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66") }}>
                      <div style={{ fontSize: 7, color: "#8899cc", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>⚔ Martial</div>
                      <div style={{ fontSize: 8, color: monColor }}>
                        {mon.martialName || "Strike"}
                      </div>
                    </div>

                    {/* ROW 7 — Essence skill + last hit */}
                    <div style={{ ...cell("#181838", "#1a3a5e"), borderRadius: "0 0 6px 6px" }}>
                      <div style={{ fontSize: 7, color: "#8899cc", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>✦ Essence</div>
                      {(gs.equippedEssenceSkills || []).length === 0
                        ? <div style={{ fontSize: 7, color: "#556" }}>No skill equipped</div>
                        : (gs.equippedEssenceSkills || []).map((slot, i) => {
                            if (!slot) return null;
                            const def = ESSENCE_SKILLS[slot.schoolId];
                            const school = (gs.essenceSkills || {})[slot.schoolId];
                            if (!def || !school) return null;
                            const lvData = def.levels[slot.techIdx];
                            const cd = (gs.essenceCooldowns || {})[slot.schoolId] || 0;
                            if (!lvData) return null;
                            return (
                              <div key={i} style={{ fontSize: 8, color: "#a6f" }}>
                                {def.icon} {lvData.name}
                                <span style={{ marginLeft: 3, color: cd > 0 ? "#f80" : "#4a4" }}>
                                  {cd > 0 ? `⏳${cd.toFixed(1)}s` : "✓"}
                                </span>
                              </div>
                            );
                          })}
                    </div>
                    <div style={{ ...cell("#0e0a0a", monColor + "66"), borderRadius: "0 0 6px 6px" }}>
                      <div style={{ fontSize: 7, color: "#8899cc", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>✦ Essence</div>
                      {mon.essenceSkill
                        ? <div style={{ fontSize: 8, color: "#a6f" }}>
                            ✦ {mon.essenceSkill.name}
                            <span style={{ fontSize: 7, color: "#8899cc", marginLeft: 3 }}>
                              {mon.essenceSkill.type === "cooldown" ? `${mon.essenceSkill.cooldown}s cd` : `HP<${Math.round(mon.essenceSkill.threshold * 100)}%`}
                            </span>
                          </div>
                        : <div style={{ fontSize: 7, color: "#556" }}>No essence skill</div>
                      }
                    </div>

                  </div>
                );
              })() : null}

              {/* ── COMBAT LOG ── */}
              {gs.activity === "dungeon" && gs.currentMonster && !gs.incursionActive ? (
                <div style={{ background: "#141430", borderRadius: 5, border: "1px solid #363658", padding: "6px 8px", maxHeight: 110, overflowY: "auto", display: "flex", flexDirection: "column-reverse" }}>
                  {[...(gs.combatLog || [])].reverse().map((line, i) => {
                    const color = line.startsWith("🗡") ? "#ddd"
                      : line.startsWith("💥") ? "#f88"
                      : line.startsWith("💨") ? "#4cf"
                      : line.startsWith("🛡") ? "#48f"
                      : line.startsWith("✦") && line.includes("+") ? "#4e4"
                      : line.startsWith("✦") ? "#a6f"
                      : line.startsWith("💚") ? "#4e4"
                      : line.startsWith("⚔") ? "#fc0"
                      : "#bbccdd";
                    return (
                      <div key={i} style={{ fontSize: 9, color, lineHeight: 1.6, opacity: 1 - i * 0.07 }}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : null}

            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* CULTIVATION TAB                */}
          {/* ══════════════════════════════ */}
          {gs.tab === "cultivation" ? (
            <div>
              {/* Meditation control */}
              {(() => {
                const refinedCap = getRefinedCap(gs);
                const refinedFull = gs.processedEssence >= refinedCap;
                return (
                  <div style={{ background: gs.activity === "meditating" ? "#1a102a" : "#1a1a3a", borderRadius: 5, padding: 8, border: `1px solid ${gs.activity === "meditating" ? "#a6f" : "#3e3e62"}`, marginBottom: 8 }}>
                    {gs.activity === "meditating" ? (
                      <div>
                        <div style={{ fontSize: 11, color: "#a6f", fontWeight: 700 }}>🧘 Refining — {fmtDecimal(processRate)}/s</div>
                        <div style={{ fontSize: 9, color: "#ccddee" }}>Raw → ✦ refined essence{refinedFull ? " (pool full!)" : ""}</div>
                        <Btn onClick={stopActivity} small color="#ccd" style={{ marginTop: 4 }}>Stop</Btn>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 9, color: "#ccddee" }}>Meditate to refine raw → ✦ refined. Core generates raw passively.</div>
                        <Btn onClick={startMeditate} disabled={gs.activity === "dungeon" || gs.activity === "working"} color="#a6f" small style={{ marginTop: 3 }}>🧘 Meditate</Btn>
                        {gs.activity !== "idle" ? (<span style={{ fontSize: 8, color: "#f44", marginLeft: 6 }}>Stop first!</span>) : null}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Med Technique */}
              <Sec title={`📖 Med Technique Lv.${gs.medTechLevel}`} color="#a6f">
                <div style={{ fontSize: 9, color: "#ccddee", marginBottom: 4 }}>Refine: {fmtDecimal(processRate)}/s</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#a6f" }}>{medTechCost}✦</span>
                  <Btn onClick={levelMedTech} disabled={gs.processedEssence < medTechCost} color="#a6f" small glow={gs.processedEssence >= medTechCost}>⬆ Level</Btn>
                </div>
                <Bar value={gs.processedEssence} max={medTechCost} color="#a6f" h={8} label={`${fmt(gs.processedEssence)}/${medTechCost}`} />
              </Sec>

              {/* Two-column: left=raw+veins+meridians | right=refined+pool+core */}
              {(() => {
                const refinedCap = getRefinedCap(gs);
                const veinCost = poolExpandCost(gs.poolCap);
                const poolCostNext = poolExpandCost(refinedCap);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8, alignItems: "start" }}>
                    {/* LEFT: Raw + Mana Veins + Meridians */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ background: "#1a1a3a", borderRadius: 5, padding: 8, border: "1px solid #2a1a3a", textAlign: "center" }}>
                        <div style={{ fontSize: 8, color: "#a6f" }}>RAW ESSENCE</div>
                        <div style={{ fontSize: 14, color: "#a6f", fontWeight: 700 }}>{fmtDecimal(gs.rawEssence)}<span style={{ fontSize: 9, color: "#ccddee" }}>/{poolMax}</span></div>
                        <Bar value={gs.rawEssence} max={poolMax} color="#a6f" h={5} />
                      </div>
                      <div style={{ background: "#0b0b1e", borderRadius: 5, padding: 6, border: "1px solid #343458", textAlign: "center" }}>
                        {(() => { const cnt = Math.round((gs.poolCap - 50) / POOL_EXPAND_AMOUNT); return (
                          <div style={{ fontSize: 8, color: "#68f", marginBottom: 3 }}>🌊 Mana Veins — cap {poolMax} <span style={{ color: "#f80" }}>{cnt}</span></div>
                        ); })()}
                        <Btn onClick={expandVeins} disabled={gs.processedEssence < veinCost} color="#68f" small>+{POOL_EXPAND_AMOUNT} — {veinCost}✦</Btn>
                      </div>
                      {(() => {
                        const manual = getManual(gs.meridianManualId || "wanderer");
                        const clicks = gs.meridianClicks || 0;
                        const ownedManuals = gs.ownedMeridianManuals || ["wanderer"];
                        const cultStats = [
                          { key: "str", label: "STR", val: gs.cultStr || 0 },
                          { key: "vit", label: "VIT", val: gs.cultVit || 0 },
                          { key: "agi", label: "AGI", val: gs.cultAgi || 0 },
                          { key: "int", label: "INT", val: gs.cultInt || 0 },
                          { key: "wis", label: "WIS", val: gs.cultWis || 0 },
                        ].filter(s => s.val > 0.05);
                        return (
                          <div style={{ background: "#0a0f0a", borderRadius: 5, padding: 6, border: "1px solid #0d200d" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 9, color: "#0f0", fontWeight: 700 }}>☯️ Meridians</span>
                              <span style={{ fontSize: 9, color: "#f80", fontWeight: 700 }}>{clicks}</span>
                            </div>
                            <div style={{ fontSize: 8, color: "#4a6", marginBottom: 2 }}>{manual.icon} {manual.name}</div>
                            {manual.passiveDesc !== "No passive bonus" && (
                              <div style={{ fontSize: 7, color: "#6a4", marginBottom: 3 }}>▸ {manual.passiveDesc}</div>
                            )}
                            {cultStats.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 4 }}>
                                {cultStats.map(s => (
                                  <span key={s.key} style={{ fontSize: 8, color: "#8c8", background: "#0d1a0d", padding: "1px 4px", borderRadius: 3 }}>
                                    {s.label} +{s.val.toFixed(1)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 8, color: "#aabbee", marginBottom: 4 }}>No stats trained yet</div>
                            )}
                            <Btn onClick={trainMeridian} disabled={gs.processedEssence < manual.clickCost} color="#0f0" small glow={gs.processedEssence >= manual.clickCost}>
                              Train ({manual.clickCost}✦)
                            </Btn>
                            {ownedManuals.length > 1 && (
                              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                {ownedManuals.map(mid => {
                                  const m = getManual(mid);
                                  const active = mid === (gs.meridianManualId || "wanderer");
                                  return (
                                    <div key={mid} onClick={() => setMeridianManual(mid)} style={{
                                      fontSize: 7, padding: "2px 4px", borderRadius: 3, cursor: "pointer",
                                      background: active ? "#0d1a0d" : "#0a0a0a",
                                      border: `1px solid ${active ? "#0f0" : "#222"}`,
                                      color: active ? "#0f0" : "#444",
                                    }}>{m.icon} {m.name}{active ? " ✓" : ""}</div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* RIGHT: Refined + Mana Pool + Core */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ background: "#1a1a3a", borderRadius: 5, padding: 8, border: "1px solid #3a2a1a", textAlign: "center" }}>
                        <div style={{ fontSize: 8, color: "#f80" }}>✦ REFINED ESSENCE</div>
                        <div style={{ fontSize: 14, color: "#f80", fontWeight: 700 }}>{fmt(gs.processedEssence)}<span style={{ fontSize: 9, color: "#ccddee" }}>/{refinedCap}</span></div>
                        <Bar value={gs.processedEssence} max={refinedCap} color="#f80" h={5} />
                      </div>
                      <div style={{ background: "#0e0b0b", borderRadius: 5, padding: 6, border: "1px solid #3a1a1a", textAlign: "center" }}>
                        {(() => { const cnt = Math.round(((gs.refinedCap || 50) - 50) / POOL_EXPAND_AMOUNT); return (
                          <div style={{ fontSize: 8, color: "#fa6", marginBottom: 3 }}>💜 Mana Pool — cap {refinedCap} <span style={{ color: "#f80" }}>{cnt}</span></div>
                        ); })()}
                        <Btn onClick={expandRefinedPool} disabled={gs.processedEssence < poolCostNext} color="#fa6" small>+{POOL_EXPAND_AMOUNT} — {poolCostNext}✦</Btn>
                      </div>
                      <div style={{ background: "#0f0b00", borderRadius: 5, padding: 6, border: `1px solid ${gs.coreTier >= 0 ? "#f80" : "#2a1a00"}` }}>
                        <div style={{ fontSize: 9, color: "#f80", fontWeight: 700, marginBottom: 4 }}>💎 Core{gs.coreTier >= 0 ? ` — ${CORE_TIERS[gs.coreTier].name}` : ""}{gs.coreTier >= 0 ? <span style={{ color: "#f80", fontSize: 8 }}> {gs.coreTier + 1}</span> : null}</div>
                        {!coreUnlocked ? (<div style={{ fontSize: 9, color: "#bbb" }}>🔒 Pool ≥{CORE_UNLOCK_POOL_CAP} ({gs.refinedCap || 50})</div>)
                          : gs.coreTier < 0 ? (
                            <div>
                              <div style={{ fontSize: 8, color: "#ccddee", marginBottom: 4 }}>Passive raw essence gen.</div>
                              <Btn onClick={upgradeCore} disabled={gs.processedEssence < CORE_TIERS[0].procEssCost} color="#f80" small>Form ({CORE_TIERS[0].procEssCost}✦)</Btn>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 10, color: "#f80" }}>+{CORE_TIERS[gs.coreTier].passiveEss}/s</div>
                              {nextCore ? (<Btn onClick={upgradeCore} disabled={gs.processedEssence < nextCore.procEssCost} color="#f80" small style={{ marginTop: 4 }}>→{nextCore.name} ({nextCore.procEssCost}✦)</Btn>)
                                : (<div style={{ fontSize: 9, color: "#4a4" }}>Max!</div>)}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Body Cultivation */}
              <Sec title="💪 Body Cultivation" color="#0af">
                <div style={{ fontSize: 9, color: "#ccddee", marginBottom: 6 }}>Equip a technique to gain its stats. Evolves at Lv.10.</div>

                {/* Equipped slots */}
                {Array.from({ length: gs.bodySlots || 1 }).map((_, slotIdx) => {
                  const equippedId = (gs.equippedBodyTechs || [])[slotIdx];
                  if (!equippedId) {
                    return (
                      <div key={slotIdx} style={{ background: "#1a1a36", borderRadius: 5, padding: 8, border: "1px dashed #1a1a3a", marginBottom: 6, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#aabbee" }}>Slot {slotIdx + 1} — Empty</div>
                        <div style={{ fontSize: 8, color: "#223", marginTop: 2 }}>Equip a technique below</div>
                      </div>
                    );
                  }
                  const tech = BODY_TECHNIQUES.find(t => t.id === equippedId);
                  const owned = (gs.ownedBodyTechs || {})[equippedId];
                  if (!tech || !owned) return null;
                  const tierData = tech.tiers[owned.tier] || tech.tiers[0];
                  const lvCost = bodyTechEssCost(tech, owned.level, owned.tier);
                  const canEvolve = owned.level >= 10 && owned.tier < tech.tiers.length - 1;
                  const maxed = owned.level >= 10 && owned.tier >= tech.tiers.length - 1;
                  const evolveCost = tech.evolveCosts[owned.tier];
                  const statsStr = Object.entries(tierData.perLevel)
                    .filter(([k]) => !['poolBonus','refinedBonus','processBonus'].includes(k))
                    .map(([k, v]) => `+${(v * owned.level).toFixed(1)} ${k.toUpperCase()}`)
                    .join('  ');
                  const specialStr = Object.entries(tierData.perLevel)
                    .filter(([k]) => ['poolBonus','refinedBonus'].includes(k))
                    .map(([k, v]) => k === 'poolBonus' ? `+${v*owned.level} raw cap` : `+${v*owned.level} refined cap`)
                    .join('  ');
                  return (
                    <div key={slotIdx} style={{ background: "#0d1018", borderRadius: 5, padding: 8, border: "1px solid #1a2a3a", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 14 }}>{tierData.icon}</span>
                          <span style={{ fontSize: 11, color: "#0af", fontWeight: 700, marginLeft: 4 }}>{tierData.name}</span>
                          <span style={{ fontSize: 8, color: "#f80", marginLeft: 6 }}>Lv.{owned.level}/10</span>
                          {owned.tier > 0 && <span style={{ fontSize: 7, color: "#fa6", marginLeft: 4 }}>Tier {owned.tier + 1}</span>}
                        </div>
                        <Btn onClick={() => unequipBodyTech(equippedId)} small color="#bbb">Unequip</Btn>
                      </div>
                      {statsStr && <div style={{ fontSize: 8, color: "#6af", marginBottom: 2 }}>{statsStr}</div>}
                      {specialStr && <div style={{ fontSize: 8, color: "#6cf", marginBottom: 2 }}>{specialStr}</div>}
                      {owned.level > 0 && tierData.perLevel.processBonus && (
                        <div style={{ fontSize: 8, color: "#a6f", marginBottom: 2 }}>+{(tierData.perLevel.processBonus * owned.level * 100).toFixed(0)}% refine speed</div>
                      )}
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {!maxed && !canEvolve && (
                          <Btn onClick={() => levelUpBodyTech(equippedId)} disabled={gs.processedEssence < lvCost || owned.level >= 10} color="#0af" small glow={gs.processedEssence >= lvCost && owned.level < 10}>
                            Lv.{owned.level}→{owned.level+1} ({lvCost}✦)
                          </Btn>
                        )}
                        {canEvolve && evolveCost && (
                          <Btn onClick={() => evolveBodyTech(equippedId)}
                            disabled={gs.processedEssence < evolveCost.ess || !hasMats(gs, evolveCost.mats)}
                            color="#fa6" small glow={gs.processedEssence >= evolveCost.ess && hasMats(gs, evolveCost.mats)}>
                            ✨ Evolve → {tech.tiers[owned.tier+1]?.name} ({evolveCost.ess}✦{Object.entries(evolveCost.mats).map(([k,v])=>' +'+v+k).join('')})
                          </Btn>
                        )}
                        {maxed && <span style={{ fontSize: 9, color: "#fa6" }}>★ MAX TIER</span>}
                      </div>
                      {!maxed && !canEvolve && owned.level < 10 && (
                        <Bar value={owned.level} max={10} color="#0af" h={4} label={`${owned.level}/10 → Evolve`} />
                      )}
                    </div>
                  );
                })}

                {/* Owned but not equipped */}
                {Object.entries(gs.ownedBodyTechs || {})
                  .filter(([id]) => !(gs.equippedBodyTechs || []).includes(id))
                  .map(([id, owned]) => {
                    const tech = BODY_TECHNIQUES.find(t => t.id === id);
                    if (!tech) return null;
                    const tierData = tech.tiers[owned.tier] || tech.tiers[0];
                    const slotsOpen = (gs.equippedBodyTechs || []).length < (gs.bodySlots || 1);
                    return (
                      <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", background: "#181836", borderRadius: 4, border: "1px solid #363658", marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 12 }}>{tierData.icon}</span>
                          <span style={{ fontSize: 9, color: "#bbb", marginLeft: 4 }}>{tierData.name}</span>
                          <span style={{ fontSize: 8, color: "#f80", marginLeft: 4 }}>Lv.{owned.level}/10</span>
                          {owned.tier > 0 && <span style={{ fontSize: 7, color: "#fa6", marginLeft: 4 }}>T{owned.tier+1}</span>}
                        </div>
                        <Btn onClick={() => equipBodyTech(id)} disabled={!slotsOpen} small color="#0af">
                          {slotsOpen ? "Equip" : "No slots"}
                        </Btn>
                      </div>
                    );
                  })}

                {Object.keys(gs.ownedBodyTechs || {}).length === 0 && (
                  <div style={{ fontSize: 9, color: "#aabbee" }}>No body techniques yet. Buy one in the Shop.</div>
                )}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* CHARACTER TAB                  */}
          {/* ══════════════════════════════ */}
          {gs.tab === "character" ? (() => {
            const manual = getManual(gs.meridianManualId || "wanderer");
            const refinedCap = getRefinedCap(gs);
            const str = getStr(gs), vit = getVit(gs), agi = getAgi(gs), int_ = getInt(gs), wis = getWis(gs);
            const weapon = getWeapon(gs.weapon), armor = getArmor(gs.armor), acc = getAccessory(gs.accessory);
            return (
              <div>
                {/* Equipped Gear */}
                <Sec title="⚔ Equipped Gear" color="#0ff">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Weapon", item: weapon, key: "weapon", owned: gs.ownedWeapons, ownedKey: "ownedWeapons", statLabel: `ATK +${weapon.atk}`, statColor: "#f80" },
                      { label: "Armor",  item: armor,  key: "armor",  owned: gs.ownedArmors,  ownedKey: "ownedArmors",  statLabel: `DEF +${armor.def}`,  statColor: "#08f" },
                      { label: "Accessory", item: acc, key: "accessory", owned: gs.ownedAccessories, ownedKey: "ownedAccessories", statLabel: Object.entries(acc.bonus || {}).map(([k,v]) => `${k} +${v}`).join(" ") || "—", statColor: "#fc0" },
                    ].map(({ label, item, key, owned, ownedKey, statLabel, statColor }) => (
                      <div key={key}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 22 }}>{item.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 8, color: "#bbccee" }}>{label}</div>
                            <div style={{ fontSize: 11, color: "#0ff", fontWeight: 700 }}>{item.name}</div>
                            <div style={{ fontSize: 9, color: statColor }}>{statLabel}</div>
                          </div>
                        </div>
                        {owned.filter(id => id !== gs[key]).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3, paddingLeft: 30 }}>
                            {owned.filter(id => id !== gs[key]).map(id => {
                              const it = key === "weapon" ? getWeapon(id) : key === "armor" ? getArmor(id) : getAccessory(id);
                              return (<Btn key={id} onClick={() => setGs(p => ({ ...p, [key]: id }))} small color="#0af">{it.icon} {it.name}</Btn>);
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Sec>

                {/* Base Attributes */}
                <Sec title="📊 Attributes" color="#a6f">
                  {[
                    { label: "STR", val: str, base: gs.baseStr, cult: gs.cultStr || 0, color: "#f84", effect: `→ ATK +${(str * 0.5).toFixed(1)}` },
                    { label: "VIT", val: vit, base: gs.baseVit, cult: gs.cultVit || 0, color: "#e44", effect: `→ HP +${(vit * 5).toFixed(0)}, DEF +${(vit * 0.3).toFixed(1)}` },
                    { label: "AGI", val: agi, base: gs.baseAgi, cult: gs.cultAgi || 0, color: "#0f0", effect: `→ Dodge +${(agi * 0.2).toFixed(1)}%` },
                    { label: "INT", val: int_, base: gs.baseInt, cult: gs.cultInt || 0, color: "#48f", effect: "→ Combat energy pool size" },
                    { label: "WIS", val: wis, base: gs.baseWis, cult: gs.cultWis || 0, color: "#a6f", effect: "→ Essence insight (future)" },
                  ].map(({ label, val, base, cult, color, effect }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 32, display: "inline-block" }}>{label}</span>
                        <span style={{ fontSize: 9, color: "#ccddee" }}>{base} base{cult > 0.05 ? ` + ${cult.toFixed(1)} trained` : ""}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{val.toFixed(1)}</span>
                        <div style={{ fontSize: 8, color: "#bbccee" }}>{effect}</div>
                      </div>
                    </div>
                  ))}
                </Sec>

                {/* Combat Stats */}
                <Sec title="⚔ Combat Stats" color="#f80">
                  {[
                    { label: "Attack Power", val: atk, color: "#f80", desc: "Damage dealt per hit. Reduced by monster DEF." },
                    { label: "Defense",       val: def, color: "#08f", desc: "Reduces damage taken each hit. Min 1 damage." },
                    { label: "Dodge",         val: dodge.toFixed(1) + "%", color: "#0f0", desc: "Chance to avoid a hit entirely. Capped at 50%." },
                    { label: "Max HP",        val: gs.maxHp, color: "#e44", desc: "Total health. Reaching 0 ends the dungeon run." },
                    { label: "Combat Energy", val: gs.maxCombatEnergy, color: "#48f", desc: "Fuel for essence skills. INT = pool size, WIS = regen speed." },
                  ].map(({ label, val, color, desc }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#bbb" }}>{label}</div>
                        <div style={{ fontSize: 8, color: "#bbccee" }}>{desc}</div>
                      </div>
                      <span style={{ fontSize: 14, color, fontWeight: 700 }}>{val}</span>
                    </div>
                  ))}
                </Sec>

                {/* Cultivation Profile */}
                <Sec title="🧘 Cultivation" color="#a6f">
                  {[
                    { label: "Med Technique", val: `Lv.${gs.medTechLevel}`, sub: `${fmtDecimal(processRate)}/s refine rate`, color: "#a6f" },
                    { label: "Meridian Scripture", val: `${manual.icon} ${manual.name}`, sub: `${gs.meridianClicks || 0} sessions trained${manual.passiveDesc !== "No passive bonus" ? " · " + manual.passiveDesc : ""}`, color: "#0f0" },
                    { label: "Dao Core", val: gs.coreTier >= 0 ? CORE_TIERS[gs.coreTier].name : "None", sub: gs.coreTier >= 0 ? `+${CORE_TIERS[gs.coreTier].passiveEss}/s raw essence` : `Unlock: expand Mana Pool to ${CORE_UNLOCK_POOL_CAP}`, color: "#f80" },
                    { label: "Raw Pool", val: `${fmtDecimal(gs.rawEssence)} / ${poolMax}`, sub: `+${POOL_EXPAND_AMOUNT} per Mana Vein upgrade`, color: "#68f" },
                    { label: "Refined Pool", val: `${fmt(gs.processedEssence)} / ${refinedCap}`, sub: `+${POOL_EXPAND_AMOUNT} per Mana Pool upgrade`, color: "#fa6" },
                  ].map(({ label, val, sub, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#ccd" }}>{label}</div>
                        <div style={{ fontSize: 8, color: "#bbccee" }}>{sub}</div>
                      </div>
                      <span style={{ fontSize: 10, color, fontWeight: 700, textAlign: "right", maxWidth: 120 }}>{val}</span>
                    </div>
                  ))}
                </Sec>
              </div>
            );
          })() : null}

          {/* ══════════════════════════════ */}
          {/* INVENTORY TAB                  */}
          {/* ══════════════════════════════ */}
          {gs.tab === "inventory" ? (
            <div>
              {/* Monster drops / crafting materials */}
              <Sec title="🪣 Materials" color="#ccd">
                <div style={{ fontSize: 9, color: "#bbccee", marginBottom: 6 }}>Dropped by monsters. Convert to gold via Jobs.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {MATERIALS.map(m => (
                    <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", background: "#1a1a36", borderRadius: 4, border: "1px solid #363658" }}>
                      <span style={{ fontSize: 16 }}>{MAT_ICONS[m]}</span>
                      <div>
                        <div style={{ fontSize: 9, color: gs.mats[m] > 0 ? "#bbb" : "#444" }}>{MAT_LABELS[m]}</div>
                        <div style={{ fontSize: 11, color: gs.mats[m] > 0 ? "#fff" : "#333", fontWeight: 700 }}>{gs.mats[m] || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Sec>

              {/* Owned Gear */}
              <Sec title="⚔ Owned Gear" color="#0ff">
                {[
                  { label: "Weapons", owned: gs.ownedWeapons, getFn: getWeapon, equipped: gs.weapon, key: "weapon", statFn: w => `ATK +${w.atk}` },
                  { label: "Armor",   owned: gs.ownedArmors,  getFn: getArmor,  equipped: gs.armor,  key: "armor",  statFn: a => `DEF +${a.def}` },
                  { label: "Accessories", owned: gs.ownedAccessories, getFn: getAccessory, equipped: gs.accessory, key: "accessory", statFn: a => Object.entries(a.bonus || {}).map(([k,v]) => `+${v} ${k}`).join(" ") || "—" },
                ].map(({ label, owned, getFn, equipped, key, statFn }) => (
                  <div key={label} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, color: "#bbccee", marginBottom: 3 }}>{label}</div>
                    {owned.map(id => {
                      const it = getFn(id);
                      const isEquipped = id === equipped;
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #2c2c48" }}>
                          <div>
                            <span style={{ marginRight: 4 }}>{it.icon}</span>
                            <span style={{ fontSize: 10, color: isEquipped ? "#0ff" : "#ccd" }}>{it.name}</span>
                            <span style={{ fontSize: 8, color: "#bbccee", marginLeft: 4 }}>{statFn(it)}</span>
                          </div>
                          {isEquipped
                            ? <span style={{ fontSize: 8, color: "#0ff" }}>Equipped</span>
                            : <Btn onClick={() => setGs(p => ({ ...p, [key]: id }))} small color="#0af">Equip</Btn>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </Sec>

              {/* Known Manuals */}
              <Sec title="📖 Known Manuals" color="#a6f">
                <div style={{ fontSize: 9, color: "#bbccee", marginBottom: 4 }}>All scriptures and techniques you have acquired.</div>

                {/* Meridian manuals */}
                {(gs.ownedMeridianManuals || ["wanderer"]).length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 8, color: "#0f0", marginBottom: 3 }}>☯️ Meridian Scriptures</div>
                    {(gs.ownedMeridianManuals || ["wanderer"]).map(id => {
                      const m = getManual(id);
                      const active = id === (gs.meridianManualId || "wanderer");
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                          <span style={{ fontSize: 9, color: active ? "#0f0" : "#bbb" }}>{m.icon} {m.name}</span>
                          {active ? <span style={{ fontSize: 8, color: "#0f0" }}>Active</span>
                            : <Btn onClick={() => setMeridianManual(id)} small color="#0f0">Use</Btn>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Body tech manuals */}
                {Object.keys(gs.ownedBodyTechs || {}).length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 8, color: "#0af", marginBottom: 3 }}>💪 Body Techniques</div>
                    {Object.entries(gs.ownedBodyTechs || {}).map(([id, owned]) => {
                      const tech = BODY_TECHNIQUES.find(t => t.id === id);
                      if (!tech) return null;
                      const tierData = tech.tiers[owned.tier] || tech.tiers[0];
                      const isEquipped = (gs.equippedBodyTechs || []).includes(id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                          <span style={{ fontSize: 9, color: isEquipped ? "#0af" : "#bbb" }}>{tierData.icon} {tierData.name}</span>
                          <span style={{ fontSize: 8, color: "#bbccee" }}>Lv.{owned.level}/10 T{owned.tier+1}{isEquipped ? " ✓" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Combat skills summary */}
                {(() => {
                  const allMartial = Object.keys(gs.martialSkills || {});
                  const allEssence = Object.keys(gs.essenceSkills || {});
                  const passives = Object.keys(gs.skills || {});
                  if (allMartial.length + allEssence.length + passives.length === 0) return null;
                  return (
                    <div>
                      <div style={{ fontSize: 8, color: "#a6f", marginBottom: 3 }}>📜 Combat Skills</div>
                      {allMartial.map(schoolId => {
                        const def = MARTIAL_SKILLS[schoolId];
                        const school = (gs.martialSkills || {})[schoolId];
                        if (!def || !school) return null;
                        const techIdx = school.activeTechIdx || 0;
                        const tl = (school.techLevels || [])[techIdx] || { level: 1 };
                        const techName = def.levels[techIdx]?.name || def.name;
                        return (
                          <div key={schoolId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                            <span style={{ fontSize: 9, color: "#f80" }}>{def.icon} {techName}</span>
                            <span style={{ fontSize: 8, color: "#bbccee" }}>Lv.{tl.level}/5</span>
                          </div>
                        );
                      })}
                      {allEssence.map(schoolId => {
                        const def = ESSENCE_SKILLS[schoolId];
                        const school = (gs.essenceSkills || {})[schoolId];
                        if (!def || !school) return null;
                        const techIdx = school.activeTechIdx || 0;
                        const tl = (school.techLevels || [])[techIdx] || { level: 1 };
                        const techName = def.levels[techIdx]?.name || def.name;
                        return (
                          <div key={schoolId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                            <span style={{ fontSize: 9, color: "#a6f" }}>{def.icon} {techName}</span>
                            <span style={{ fontSize: 8, color: "#bbccee" }}>Lv.{tl.level}/5</span>
                          </div>
                        );
                      })}
                      {passives.map(id => {
                        const def = SKILL_DEFINITIONS[id];
                        const st = (gs.skills || {})[id];
                        if (!def || !st) return null;
                        return (
                          <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                            <span style={{ fontSize: 9, color: "#8af" }}>{def.icon} {def.name}</span>
                            <span style={{ fontSize: 8, color: "#bbccee" }}>Lv.{st.level}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {(gs.ownedMeridianManuals || ["wanderer"]).length <= 1 && Object.keys(gs.ownedBodyTechs || {}).length === 0 && Object.keys(gs.skills || {}).length === 0 && Object.keys(gs.martialSkills || { basicMartialArts: {} }).length <= 1 && (
                  <div style={{ fontSize: 9, color: "#aabbee" }}>No additional manuals yet. Visit the Shop.</div>
                )}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* SHOP TAB                       */}
          {/* ══════════════════════════════ */}
          {gs.tab === "shop" ? (
            <div>
              {[["⚔ Weapons", WEAPONS.filter(w => w.cost > 0), "weapon", gs.ownedWeapons, "ownedWeapons"],
                ["🛡 Armor", ARMORS.filter(a => a.cost > 0), "armor", gs.ownedArmors, "ownedArmors"]
              ].map(([title, items, equipKey, ownedList, ownedKey]) => (
                <Sec key={title} title={title}>
                  {items.map(it => {
                    const owned = ownedList.includes(it.id);
                    return (
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                        <div>
                          <span style={{ marginRight: 2 }}>{it.icon}</span>
                          <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{it.name}</span>
                          <span style={{ color: "#bbccee", fontSize: 8, marginLeft: 3 }}>+{it.atk || it.def || ""}</span>
                          {Object.keys(it.mats).length > 0 ? (<span style={{ marginLeft: 3 }}><MatCost mats={it.mats} state={gs} /></span>) : null}
                        </div>
                        {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                          : (<Btn onClick={() => purchase(it.name, it.cost, it.mats, s => ({ ...s, [ownedKey]: [...s[ownedKey], it.id], [equipKey]: it.id }))} disabled={!canAfford(it.cost, it.mats)} small color="#fc0">{it.cost}g</Btn>)}
                      </div>
                    );
                  })}
                </Sec>
              ))}

              <Sec title="☯️ Meridian Manuals" color="#0f0">
                <div style={{ fontSize: 9, color: "#ccddee", marginBottom: 6 }}>Your scripture shapes how meridian training develops your stats.</div>
                {MERIDIAN_MANUALS.filter(m => m.cost > 0).map(manual => {
                  const owned = (gs.ownedMeridianManuals || ["wanderer"]).includes(manual.id);
                  return (
                    <div key={manual.id} style={{ padding: "5px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ marginRight: 3 }}>{manual.icon}</span>
                          <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{manual.name}</span>
                          <span style={{ fontSize: 7, color: "#f80", marginLeft: 4 }}>Tier {manual.tier}</span>
                        </div>
                        {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                          : (<Btn onClick={() => buyMeridianManual(manual)} disabled={!canAfford(manual.cost, manual.shopMats)} small color="#0f0">{manual.cost}g</Btn>)}
                      </div>
                      <div style={{ fontSize: 8, color: "#bbccee", marginTop: 2 }}>{manual.desc}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 8, color: "#6a6" }}>▸ {manual.passiveDesc}</span>
                        {manual.recommendedSkills.length > 0 && (
                          <span style={{ fontSize: 8, color: "#a6f" }}>★ Rec: {manual.recommendedSkills.map(id => SKILL_DEFINITIONS[id]?.name).join(", ")}</span>
                        )}
                      </div>
                      {Object.keys(manual.shopMats).length > 0 && (
                        <div style={{ marginTop: 2 }}><MatCost mats={manual.shopMats} state={gs} /></div>
                      )}
                    </div>
                  );
                })}
              </Sec>

              <Sec title="💪 Body Cultivation" color="#0af">
                <div style={{ fontSize: 9, color: "#ccddee", marginBottom: 6 }}>Master one technique per run. Evolves at Lv.10. Expand slots via regression.</div>
                {BODY_TECHNIQUES.map(tech => {
                  const owned = !!(gs.ownedBodyTechs || {})[tech.id];
                  return (
                    <div key={tech.id} style={{ padding: "5px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ marginRight: 4 }}>{tech.icon}</span>
                          <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{tech.tiers[0].name}</span>
                          <span style={{ fontSize: 7, color: "#0af", marginLeft: 4 }}>→ {tech.tiers[1].name} → {tech.tiers[2].name}</span>
                        </div>
                        {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓ Owned</span>)
                          : (<Btn onClick={() => buyBodyTech(tech)} disabled={!canAfford(tech.shopCost, tech.shopMats)} small color="#0af">{tech.shopCost}g</Btn>)}
                      </div>
                      <div style={{ fontSize: 8, color: "#bbccee", marginTop: 2 }}>{tech.desc}</div>
                      <div style={{ fontSize: 8, color: "#4a6", marginTop: 1 }}>
                        {Object.entries(tech.tiers[0].perLevel).map(([k,v]) => {
                          if (k === 'poolBonus') return `+${v}/lv raw cap`;
                          if (k === 'refinedBonus') return `+${v}/lv refined cap`;
                          if (k === 'processBonus') return `+${(v*100).toFixed(0)}%/lv refine speed`;
                          return `+${v}/lv ${k.toUpperCase()}`;
                        }).join('  ')}
                      </div>
                      {Object.keys(tech.shopMats).length > 0 && <div style={{ marginTop: 2 }}><MatCost mats={tech.shopMats} state={gs} /></div>}
                    </div>
                  );
                })}
              </Sec>

              <Sec title="⚔️ Martial Schools">
                {MARTIAL_MANUALS.map(m => {
                  const def = MARTIAL_SKILLS[m.skill];
                  const owned = !!(gs.martialSkills || {})[m.skill];
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{def?.icon} {def?.name}</span>
                        <span style={{ fontSize: 7, color: "#8899cc", marginLeft: 4 }}>10 levels · combo ready</span>
                        {Object.keys(m.mats).length > 0 && <span style={{ marginLeft: 3 }}><MatCost mats={m.mats} state={gs} /></span>}
                      </div>
                      {owned ? <span style={{ fontSize: 8, color: "#4a4" }}>✓ Learned</span>
                        : <Btn onClick={() => purchase(def?.name, m.cost, m.mats, s => ({
                            ...s,
                            martialSkills: { ...(s.martialSkills || {}), [m.skill]: { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: def?.expBase || 60 }] } },
                          }))} disabled={!canAfford(m.cost, m.mats)} small color="#f80">{m.cost}g</Btn>}
                    </div>
                  );
                })}
              </Sec>
              <Sec title="✦ Essence Schools">
                {ESSENCE_MANUALS.map(m => {
                  const def = ESSENCE_SKILLS[m.skill];
                  const owned = !!(gs.essenceSkills || {})[m.skill];
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{def?.icon} {def?.name}</span>
                        <span style={{ fontSize: 7, color: "#8899cc", marginLeft: 4 }}>condition-triggered</span>
                        {Object.keys(m.mats).length > 0 && <span style={{ marginLeft: 3 }}><MatCost mats={m.mats} state={gs} /></span>}
                      </div>
                      {owned ? <span style={{ fontSize: 8, color: "#4a4" }}>✓ Learned</span>
                        : <Btn onClick={() => purchase(def?.name, m.cost, m.mats, s => ({
                            ...s,
                            essenceSkills: { ...(s.essenceSkills || {}), [m.skill]: { activeTechIdx: 0, techLevels: [{ level: 1, exp: 0, expToNext: def?.expBase || 70 }] } },
                            essenceCooldowns: { ...(s.essenceCooldowns || {}), [m.skill]: 0 },
                          }))} disabled={!canAfford(m.cost, m.mats)} small color="#a6f">{m.cost}g</Btn>}
                    </div>
                  );
                })}
              </Sec>
              <Sec title="🛡 Passive Techniques">
                {SKILL_MANUALS.map(m => {
                  const owned = !!(gs.skills || {})[m.skill];
                  const def2 = SKILL_DEFINITIONS[m.skill];
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                      <div>
                        <span style={{ color: owned ? "#4a4" : "#ccd", fontSize: 10 }}>{def2?.icon} {def2?.name}</span>
                        {Object.keys(m.mats).length > 0 && <span style={{ marginLeft: 3 }}><MatCost mats={m.mats} state={gs} /></span>}
                      </div>
                      {owned ? <span style={{ fontSize: 8, color: "#4a4" }}>✓ Learned</span>
                        : <Btn onClick={() => purchase(def2?.name, m.cost, m.mats, s => ({
                            ...s,
                            skills: { ...(s.skills || {}), [m.skill]: { level: 1, exp: 0, expToNext: 50 } },
                          }))} disabled={!canAfford(m.cost, m.mats)} small color="#8af">{m.cost}g</Btn>}
                    </div>
                  );
                })}
              </Sec>

              <Sec title="💊 Pills">
                {PILLS.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                    <div>
                      <span style={{ marginRight: 2 }}>{p.icon}</span>
                      <span style={{ color: "#ccd", fontSize: 10 }}>{p.name}</span>
                      <span style={{ color: "#bbccee", fontSize: 8, marginLeft: 3 }}>{p.desc}</span>
                      {Object.keys(p.mats).length > 0 ? (<span style={{ marginLeft: 3 }}><MatCost mats={p.mats} state={gs} /></span>) : null}
                    </div>
                    <Btn onClick={() => usePill(p)} disabled={!canAfford(p.cost, p.mats)} small color="#0f0">{p.cost}g</Btn>
                  </div>
                ))}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* SKILLS TAB                     */}
          {/* ══════════════════════════════ */}
          {gs.tab === "skills" ? (
            <div>
              {/* ── MARTIAL SKILLS ── */}
              {(() => {
                const slots = gs.martialSlots || 1;
                const equipped = gs.equippedMartialSkills || [{ schoolId: "basicMartialArts", techIdx: 0 }];
                // Collect all unlocked (schoolId, techIdx) pairs from all schools
                const allAvailableTechs = [];
                Object.keys(gs.martialSkills || {}).forEach(schoolId => {
                  const school = gs.martialSkills[schoolId];
                  (school.techLevels || []).forEach((_, techIdx) => {
                    allAvailableTechs.push({ schoolId, techIdx });
                  });
                });
                return (
                  <Sec title={`⚔️ Martial Skills (${equipped.length}/${slots})`} color="#f80">
                    <div style={{ fontSize: 8, color: "#99aacc", marginBottom: 5 }}>All equipped slots fire every round — later hits get a combo bonus.</div>
                    {Array.from({ length: slots }).map((_, slotIdx) => {
                      const slot = equipped[slotIdx];
                      const def = slot ? MARTIAL_SKILLS[slot.schoolId] : null;
                      const school = slot ? (gs.martialSkills || {})[slot.schoolId] : null;
                      const tl = (school?.techLevels || [])[slot?.techIdx];
                      if (!def || !school || !tl) return (
                        <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #2c2c48", marginBottom: 3 }}>
                          <span style={{ fontSize: 8, color: "#bbccee", width: 14 }}>#{slotIdx + 1}</span>
                          <span style={{ fontSize: 9, color: "#8899cc", flex: 1 }}>— Empty —</span>
                          <Btn onClick={() => setGs(p => ({ ...p, tab: "shop" }))} color="#f80" small>🛒 Shop</Btn>
                        </div>
                      );
                      const lvData = def.levels[slot.techIdx];
                      const comboBonus = slotIdx > 0 ? `+${slotIdx * 30}% combo` : "lead hit";
                      const isActiveTech = school.activeTechIdx === slot.techIdx;
                      const alreadyMastered = school.activeTechIdx > slot.techIdx;
                      const montageTimer = (gs.martialMontages || {})[slot.schoolId];
                      const montageRunning = montageTimer != null && montageTimer > 0;
                      const montageReady = isActiveTech && tl.level >= 5 && !montageRunning
                        && slot.techIdx < def.levels.length - 1;

                      // Build effect label
                      const effectParts = [];
                      if (lvData.dmgMult) effectParts.push(`base dmg x${lvData.dmgMult}`);
                      if (lvData.defBuff) effectParts.push(`+${Math.round(lvData.defBuff * 100)}% def`);
                      if (lvData.dodgeBuff) effectParts.push(`+${Math.round(lvData.dodgeBuff * 100)}% dodge`);

                      function cycleMartial() {
                        const cur = allAvailableTechs.findIndex(t => t.schoolId === slot.schoolId && t.techIdx === slot.techIdx);
                        const next = allAvailableTechs[(cur + 1) % allAvailableTechs.length];
                        const newEq = [...equipped]; newEq[slotIdx] = next;
                        setGs(p => ({ ...p, equippedMartialSkills: newEq }));
                      }
                      function startMontage() {
                        setGs(p => ({ ...p, martialMontages: { ...(p.martialMontages || {}), [slot.schoolId]: 5 } }));
                      }
                      return (
                        <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                          <span style={{ fontSize: 8, color: "#bbccee", width: 14 }}>#{slotIdx + 1}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ color: "#f80", fontWeight: 700, fontSize: 10 }}>{def.icon} {lvData.name}</span>
                              <span style={{ fontSize: 7, color: "#8899cc" }}>
                                {comboBonus} · {effectParts.join(' · ')} · Lv.{tl.level}{tl.level <= 5 ? "/5" : ""}
                              </span>
                            </div>
                            {montageRunning ? (
                              <Bar value={montageTimer} max={5} color="#fc0" h={12}
                                label={`⚡ Training... ${montageTimer.toFixed(1)}s`} />
                            ) : montageReady ? (
                              <Btn onClick={startMontage} color="#fc0" small>⚡ Start Training Montage!</Btn>
                            ) : (
                              <Bar value={tl.exp} max={tl.expToNext} color={alreadyMastered ? "#888" : "#f80"} h={6} />
                            )}
                          </div>
                          {allAvailableTechs.length > 1 && <Btn onClick={cycleMartial} color="#bbccee" small>⟳</Btn>}
                        </div>
                      );
                    })}
                    {slots < MAX_MARTIAL_SLOTS ? (() => {
                      const sc = MARTIAL_SLOT_COSTS[slots - 1];
                      return sc ? (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #363658" }}>
                          <Btn onClick={() => purchase("Martial Seal Breaker", sc.cost, sc.mats, s => {
                            // Find lowest unlocked technique not already in a slot
                            const allTechs = [];
                            Object.keys(s.martialSkills || {}).forEach(schoolId => {
                              (s.martialSkills[schoolId].techLevels || []).forEach((_, techIdx) => {
                                allTechs.push({ schoolId, techIdx });
                              });
                            });
                            const current = (s.equippedMartialSkills || []).map(sl => `${sl.schoolId}-${sl.techIdx}`);
                            const newSlot = allTechs.find(t => !current.includes(`${t.schoolId}-${t.techIdx}`)) || allTechs[0] || { schoolId: "basicMartialArts", techIdx: 0 };
                            return {
                              ...s,
                              martialSlots: (s.martialSlots || 1) + 1,
                              equippedMartialSkills: [...(s.equippedMartialSkills || []), newSlot],
                            };
                          })} disabled={!canAfford(sc.cost, sc.mats)} color="#fc0" small>
                            🔓 Open Slot — {sc.cost}g
                          </Btn>
                          <MatCost mats={sc.mats} state={gs} />
                        </div>
                      ) : null;
                    })() : <div style={{ fontSize: 8, color: "#4a4", marginTop: 4 }}>All martial slots unlocked.</div>}
                  </Sec>
                );
              })()}

              {/* ── ESSENCE SKILLS ── */}
              {(() => {
                const slots = gs.essenceSlots || 1;
                const equipped = gs.equippedEssenceSkills || [];
                const allAvailableEssence = [];
                Object.keys(gs.essenceSkills || {}).forEach(schoolId => {
                  const school = gs.essenceSkills[schoolId];
                  (school.techLevels || []).forEach((_, techIdx) => {
                    allAvailableEssence.push({ schoolId, techIdx });
                  });
                });
                return (
                  <Sec title={`✦ Essence Skills (${equipped.length}/${slots})`} color="#a6f">
                    <div style={{ fontSize: 8, color: "#99aacc", marginBottom: 5 }}>Auto-trigger when conditions are met. Drain combat energy.</div>
                    {Array.from({ length: slots }).map((_, slotIdx) => {
                      const slot = equipped[slotIdx];
                      const def = slot ? ESSENCE_SKILLS[slot.schoolId] : null;
                      const school = slot ? (gs.essenceSkills || {})[slot.schoolId] : null;
                      const tl = (school?.techLevels || [])[slot?.techIdx];
                      if (!def || !school || !tl) return (
                        <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #2c2c48", marginBottom: 3 }}>
                          <span style={{ fontSize: 8, color: "#bbccee", width: 14 }}>#{slotIdx + 1}</span>
                          <span style={{ fontSize: 9, color: "#8899cc", flex: 1 }}>— Empty —</span>
                          <Btn onClick={() => setGs(p => ({ ...p, tab: "shop" }))} color="#a6f" small>🛒 Shop</Btn>
                        </div>
                      );
                      const lvData = def.levels[slot.techIdx];
                      const t = lvData.trigger;
                      const triggerDesc = t.type === "cooldown" ? `every ${t.seconds}s` : `HP < ${Math.round(t.threshold * 100)}%`;
                      const isActiveTech = school.activeTechIdx === slot.techIdx;
                      const alreadyMastered = school.activeTechIdx > slot.techIdx;
                      const montageTimer = (gs.essenceMontages || {})[slot.schoolId];
                      const montageRunning = montageTimer != null && montageTimer > 0;
                      const montageReady = isActiveTech && tl.level >= 5 && !montageRunning
                        && slot.techIdx < def.levels.length - 1;

                      const effectLabel = lvData.dmgMult
                        ? `base dmg x${lvData.dmgMult}`
                        : lvData.healPct ? `+${Math.round(lvData.healPct * 100)}% HP` : "";

                      function cycleEssence() {
                        const cur = allAvailableEssence.findIndex(e => e.schoolId === slot.schoolId && e.techIdx === slot.techIdx);
                        const next = allAvailableEssence[(cur + 1) % allAvailableEssence.length];
                        const newEq = [...equipped]; newEq[slotIdx] = next;
                        setGs(p => ({ ...p, equippedEssenceSkills: newEq }));
                      }
                      function startEssenceMontage() {
                        setGs(p => ({ ...p, essenceMontages: { ...(p.essenceMontages || {}), [slot.schoolId]: 5 } }));
                      }
                      return (
                        <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                          <span style={{ fontSize: 8, color: "#bbccee", width: 14 }}>#{slotIdx + 1}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ color: "#a6f", fontWeight: 700, fontSize: 10 }}>{def.icon} {lvData.name}</span>
                              <span style={{ fontSize: 7, color: "#8899cc" }}>
                                {triggerDesc} · {lvData.energyCost}EN · {effectLabel} · Lv.{tl.level}{tl.level <= 5 ? "/5" : ""}
                              </span>
                            </div>
                            {montageRunning ? (
                              <Bar value={montageTimer} max={5} color="#fc0" h={12}
                                label={`⚡ Training... ${montageTimer.toFixed(1)}s`} />
                            ) : montageReady ? (
                              <Btn onClick={startEssenceMontage} color="#fc0" small>⚡ Start Training Montage!</Btn>
                            ) : (
                              <Bar value={tl.exp} max={tl.expToNext} color={alreadyMastered ? "#888" : "#a6f"} h={6} />
                            )}
                          </div>
                          {allAvailableEssence.length > 1 && <Btn onClick={cycleEssence} color="#bbccee" small>⟳</Btn>}
                        </div>
                      );
                    })}
                    {slots < MAX_ESSENCE_SLOTS ? (() => {
                      const sc = ESSENCE_SLOT_COSTS[slots - 1];
                      return sc ? (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #363658" }}>
                          <Btn onClick={() => purchase("Essence Seal Breaker", sc.cost, sc.mats, s => {
                            const allTechs = [];
                            Object.keys(s.essenceSkills || {}).forEach(schoolId => {
                              (s.essenceSkills[schoolId].techLevels || []).forEach((_, techIdx) => {
                                allTechs.push({ schoolId, techIdx });
                              });
                            });
                            const current = (s.equippedEssenceSkills || []).map(sl => `${sl.schoolId}-${sl.techIdx}`);
                            const newSlot = allTechs.find(t => !current.includes(`${t.schoolId}-${t.techIdx}`)) || allTechs[0] || { schoolId: "essenceStrike", techIdx: 0 };
                            return {
                              ...s,
                              essenceSlots: (s.essenceSlots || 1) + 1,
                              equippedEssenceSkills: [...(s.equippedEssenceSkills || []), newSlot],
                            };
                          })} disabled={!canAfford(sc.cost, sc.mats)} color="#a6f" small>
                            🔓 Open Slot — {sc.cost}g
                          </Btn>
                          <MatCost mats={sc.mats} state={gs} />
                        </div>
                      ) : null;
                    })() : <div style={{ fontSize: 8, color: "#4a4", marginTop: 4 }}>All essence slots unlocked.</div>}
                  </Sec>
                );
              })()}

              {/* ── PASSIVE SKILLS ── */}
              {Object.keys(gs.skills || {}).length > 0 && (
                <Sec title="🛡 Passive Skills" color="#8af">
                  {Object.entries(gs.skills).map(([id, sk]) => {
                    const d = SKILL_DEFINITIONS[id];
                    if (!d) return null;
                    return (
                      <div key={id} style={{ padding: "4px 0", borderBottom: "1px solid #2c2c48" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{d.icon} <span style={{ color: "#ccd", fontWeight: 600, fontSize: 10 }}>{d.name}</span>
                            <span style={{ color: "#f80", fontSize: 9, marginLeft: 3 }}>Lv.{sk.level}</span>
                          </span>
                          <span style={{ fontSize: 8, color: "#8af" }}>
                            {id === "windStep" ? `+${sk.level * 3}% dodge` : `+${sk.level * 2} DEF`}
                          </span>
                        </div>
                        <Bar value={sk.exp} max={sk.expToNext} color="#8af" h={4} />
                      </div>
                    );
                  })}
                </Sec>
              )}
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* RESIDENCE TAB                  */}
          {/* ══════════════════════════════ */}
          {gs.tab === "residence" ? (
            <div>
              <Sec title={`${HOUSING[gs.housingLevel].icon} ${HOUSING[gs.housingLevel].name}`} color="#fc0">
                <div style={{ fontSize: 9, color: "#ccddee" }}>Rest x{HOUSING[gs.housingLevel].restMult} | Rent: {HOUSING[gs.housingLevel].rent}g/wk</div>
                {nextHouse ? (<Btn onClick={() => purchase(nextHouse.name, nextHouse.cost, nextHouse.mats, s => ({ ...s, housingLevel: s.housingLevel + 1 }))} disabled={!canAfford(nextHouse.cost, nextHouse.mats)} small color="#fc0" style={{ marginTop: 4 }}>→ {nextHouse.name} (x{nextHouse.restMult}) {nextHouse.cost}g</Btn>) : null}
              </Sec>
              <Sec title={`🛏️ ${BEDS[gs.bedLevel].name}`} color="#8af">
                <div style={{ fontSize: 9, color: "#ccddee" }}>+{BEDS[gs.bedLevel].restBonus}/s</div>
                {nextBed ? (<Btn onClick={() => purchase(nextBed.name, nextBed.cost, nextBed.mats, s => ({ ...s, bedLevel: s.bedLevel + 1 }))} disabled={!canAfford(nextBed.cost, nextBed.mats)} small color="#8af" style={{ marginTop: 4 }}>→ {nextBed.name} (+{nextBed.restBonus}/s) {nextBed.cost}g</Btn>) : null}
              </Sec>
              <Sec title="Upgrades">
                {RESIDENCE_UPGRADES.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                    <div><span style={{ marginRight: 2 }}>{u.icon}</span><span style={{ color: gs.residenceUpgrades[u.field] ? "#4a4" : "#ccd", fontSize: 10 }}>{u.name}</span><span style={{ fontSize: 8, color: "#bbccee", marginLeft: 3 }}>{u.desc}</span></div>
                    {gs.residenceUpgrades[u.field] ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                      : (<Btn onClick={() => purchase(u.name, u.cost, u.mats, s => ({ ...s, residenceUpgrades: { ...s.residenceUpgrades, [u.field]: true } }))} disabled={!canAfford(u.cost, u.mats)} small color="#fc0">{u.cost}g</Btn>)}
                  </div>
                ))}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* JOBS TAB                       */}
          {/* ══════════════════════════════ */}
          {gs.tab === "jobs" ? (
            <div>
              <Sec title="⚒️ Jobs" color="#fc0">
                {JOBS.map(j => {
                  const active = gs.activity === "working" && gs.activeJob === j.id;
                  const jLevel = (gs.jobLevels || {})[j.id] || 0;
                  const jXp = (gs.jobXp || {})[j.id] || 0;
                  const xpNeeded = getJobXpNeeded(jLevel);
                  const selectedRecipeIdx = (gs.activeJobRecipe || {})[j.id] || 0;
                  const unlockedRecipes = j.recipes.filter(r => r.level <= jLevel);
                  const recipe = getActiveRecipe(j, gs.jobLevels, gs.activeJobRecipe);
                  const nextRecipe = j.recipes.find(r => r.level > jLevel);

                  // Drawdown: how many full cycles can run with current mats
                  const cyclesLeft = Math.floor(Math.min(...Object.entries(recipe.input).map(([k, v]) => (gs.mats[k] || 0) / v)));
                  const secsLeft = cyclesLeft * recipe.time;
                  const minsLeft = Math.floor(secsLeft / 60);
                  const timeStr = secsLeft < 60 ? `${secsLeft}s` : `${minsLeft}m ${secsLeft % 60}s`;
                  const maxCycles = 20;

                  const drawColor = cyclesLeft < 3 ? "#f44" : "#4a4";
                  return (
                    <div key={j.id} style={{ background: active ? "#1a1a08" : "#0c0c1a", borderRadius: 5, padding: 8, border: `1px solid ${active ? "#fc0" : "#3e3e62"}`, marginBottom: 5 }}>
                      {/* Header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span>{j.icon}</span>
                          <span style={{ color: active ? "#fc0" : "#ccc", fontWeight: 700, fontSize: 11 }}>{j.name}</span>
                          <span style={{ fontSize: 9, color: "#f80", background: "#1a0f00", border: "1px solid #3a2000", borderRadius: 3, padding: "1px 4px" }}>Lv.{jLevel}</span>
                          {gs.hiredWorkers[j.id] && <span style={{ fontSize: 8, color: "#4a4" }}>👤</span>}
                        </div>
                        {!active
                          ? <Btn onClick={() => startWork(j.id)} disabled={gs.activity === "dungeon" || !hasMats(gs, recipe.input)} small color="#fc0">Start</Btn>
                          : <Btn onClick={stopActivity} small color="#ccd">Stop</Btn>}
                      </div>

                      {/* XP row: label + bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 8, color: "#f80", whiteSpace: "nowrap", minWidth: 50 }}>XP {jXp}/{xpNeeded}</span>
                        <div style={{ flex: 1 }}><Bar value={jXp} max={xpNeeded} color="#f80" h={8} /></div>
                        {nextRecipe
                          ? <span style={{ fontSize: 7, color: "#bbccee", whiteSpace: "nowrap" }}>Lv.{nextRecipe.level} → {nextRecipe.product}</span>
                          : <span style={{ fontSize: 7, color: "#4a4", whiteSpace: "nowrap" }}>max</span>}
                      </div>

                      {/* Recipe selector if multiple unlocked */}
                      {unlockedRecipes.length > 1 && (
                        <div style={{ display: "flex", gap: 3, marginBottom: 5, flexWrap: "wrap" }}>
                          {unlockedRecipes.map((r, idx) => (
                            <div key={idx} onClick={() => setGs(p => ({ ...p, activeJobRecipe: { ...(p.activeJobRecipe || {}), [j.id]: idx } }))}
                              style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                                background: idx === selectedRecipeIdx ? "#2a1a00" : "#1a1a36",
                                border: `1px solid ${idx === selectedRecipeIdx ? "#fc0" : "#333"}`,
                                color: idx === selectedRecipeIdx ? "#fc0" : "#ccddee" }}>
                              {r.product}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active recipe formula */}
                      <div style={{ fontSize: 8, color: "#bbccdd", marginBottom: 5, background: "#181836", borderRadius: 3, padding: "3px 6px" }}>
                        {Object.entries(recipe.input).map(([k, v]) => MAT_ICONS[k] + v).join(" + ")} → <span style={{ color: "#ddd" }}>{recipe.product}</span> <span style={{ color: "#fc0" }}>+{recipe.output}g</span> <span style={{ color: "#bbccee" }}>{recipe.time}s</span>
                      </div>

                      {/* Drawdown row: label + bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: active ? 5 : 0 }}>
                        <span style={{ fontSize: 8, color: drawColor, whiteSpace: "nowrap", minWidth: 50 }}>
                          {cyclesLeft === 0 ? "No mats" : `${cyclesLeft} cycles`}
                        </span>
                        <div style={{ flex: 1 }}><Bar value={Math.min(cyclesLeft, maxCycles)} max={maxCycles} color={drawColor} h={8} /></div>
                        <span style={{ fontSize: 7, color: "#bbccee", whiteSpace: "nowrap" }}>
                          {cyclesLeft === 0 ? "—" : `~${timeStr}`}
                        </span>
                      </div>

                      {/* Progress bar (active only) */}
                      {active && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 8, color: "#fc0", whiteSpace: "nowrap", minWidth: 50 }}>Working</span>
                          <div style={{ flex: 1 }}><Bar value={gs.jobProgress} max={recipe.time} color="#fc0" h={10} /></div>
                          <span style={{ fontSize: 8, color: "#fc0", whiteSpace: "nowrap" }}>{(recipe.time - gs.jobProgress).toFixed(1)}s</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Sec>
              <Sec title="👤 Hire" color="#0af">
                {HIRES.map(h => (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                    <span style={{ color: gs.hiredWorkers[h.job] ? "#4a4" : "#ccd", fontSize: 10 }}>{h.name}</span>
                    {gs.hiredWorkers[h.job] ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                      : (<Btn onClick={() => purchase(h.name, h.cost, h.mats, s => ({ ...s, hiredWorkers: { ...s.hiredWorkers, [h.job]: true } }))} disabled={!canAfford(h.cost, h.mats)} small color="#0af">{h.cost}g</Btn>)}
                  </div>
                ))}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* BUDGET TAB                     */}
          {/* ══════════════════════════════ */}
          {gs.tab === "budget" ? (
            <div>
              <Sec title="🏠 Rent" color={!gs.rentPaid && rent > 0 ? "#f44" : "#fc0"} border={!gs.rentPaid && rent > 0 ? "#f44" : undefined}>
                {rent === 0 ? (<div style={{ fontSize: 10, color: "#4a4" }}>No rent.</div>) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: gs.rentPaid ? "#4a4" : "#f44", fontWeight: 700 }}>{gs.rentPaid ? "✓ PAID" : "⚠ DUE"}: {rent}g/wk</span>
                      {!gs.rentPaid ? (<Btn onClick={payRent} disabled={gs.gold < rent} color="#f44" small glow>Pay {rent}g</Btn>) : null}
                    </div>
                    {!gs.rentPaid && gs.rentOverdue > 0 ? (<div style={{ fontSize: 9, color: "#f44" }}>Overdue {gs.rentOverdue}d!</div>) : null}
                  </div>
                )}
              </Sec>
              <Sec title="🍖 Food" color="#fc0">
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#ccddee" }}>Daily</span><span style={{ color: "#fc0", fontWeight: 700 }}>-{FOOD_DAILY_COST}g</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#ccddee" }}>Weekly</span><span style={{ color: "#fc0", fontWeight: 700 }}>-{FOOD_DAILY_COST * 7}g</span></div>
              </Sec>
              <Sec title="📈 Income" color="#0f0">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#ccddee" }}>Avg</span><span style={{ color: "#0f0", fontWeight: 700 }}>+{avgIncome}g/d</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                  {gs.dailyIncome.map((inc, i) => (
                    <div key={i} style={{ textAlign: "center", background: i === gs.weekDay ? "#0f022" : "#18183a", borderRadius: 3, padding: 3, border: `1px solid ${i === gs.weekDay ? "#0f044" : "#151525"}` }}>
                      <div style={{ fontSize: 7, color: i === gs.weekDay ? "#0f0" : "#bbccee" }}>D{i + 1}</div>
                      <div style={{ fontSize: 9, color: i === gs.weekDay ? "#0f0" : "#ccddee", fontWeight: 700 }}>{fmt(inc)}</div>
                    </div>
                  ))}
                </div>
              </Sec>
              <Sec title="📋 Purchases" color="#f80">
                {gs.weekPurchases.length === 0 ? (<div style={{ fontSize: 9, color: "#bbccee" }}>None.</div>) : (
                  <div style={{ maxHeight: 120, overflowY: "auto" }}>
                    {gs.weekPurchases.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #2c2c48" }}>
                        <span style={{ fontSize: 9, color: "#ccd" }}>{p.name}</span>
                        <span style={{ fontSize: 9, color: "#f44" }}>-{p.cost}g</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 3, borderTop: "1px solid #3c3c58" }}>
                  <span style={{ color: "#ccddee" }}>Total</span><span style={{ color: "#f44", fontWeight: 700 }}>-{fmt(gs.totalWeekSpend)}g</span>
                </div>
              </Sec>
              <Sec title="🏦 Balance" color="#fc0">
                <div style={{ fontSize: 16, color: "#fc0", fontWeight: 700, textAlign: "center" }}>💰 {fmt(gs.gold)}g</div>
                <div style={{ fontSize: 9, color: "#ccddee", textAlign: "center" }}>Day {gs.dayCount} | Wk {gs.weekDay + 1}/7</div>
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* REGRESSION TAB                 */}
          {/* ══════════════════════════════ */}
          {gs.tab === "regression" ? (
            <div>
              <Sec title={`⟳ Loop #${gs.regression.count}`} color="#a6f">
                <div style={{ color: "#a6f", fontSize: 12, fontWeight: 700 }}>Pts: {gs.regression.pts}</div>
                {(() => {
                  const pending = calcRegressionPts(gs.highestFloors, gs.medTechLevel);
                  const highFloorSum = Object.values(gs.highestFloors).reduce((a, b) => a + b, 0);
                  return (
                    <div style={{ fontSize: 8, color: "#ccddee", marginTop: 3 }}>
                      {pending > 0
                        ? <span style={{ color: "#a6f88" }}>Reset now → <span style={{ color: "#a6f", fontWeight: 700 }}>+{pending} pts</span></span>
                        : <span>Reach F-10 to earn points on reset. ({highFloorSum}/10 floors)</span>
                      }
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <Btn onClick={() => setGs(p => ({ ...p, showConfirm: true }))} color="#f44" small>☠ Reset</Btn>
                  <Btn onClick={hardReset} color="#ccd" small>🗑️ Full Wipe</Btn>
                </div>
              </Sec>
              {REGRESSION_UPGRADES.map(u => {
                const curLv = gs.regression.ups[u.id] || 0;
                const maxed = curLv >= u.maxLevel;
                const canBuy = gs.regression.pts >= u.cost && !maxed;
                return (
                  <div key={u.id} style={{ background: "#1a1a3a", borderRadius: 5, padding: 7, border: `1px solid ${maxed ? "#4a4" : canBuy ? "#a6f44" : "#3e3e62"}`, marginBottom: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ marginRight: 3 }}>{u.icon}</span>
                      <span style={{ color: maxed ? "#4a4" : "#ccc", fontWeight: 600, fontSize: 10 }}>{u.name}</span>
                      <span style={{ color: "#f80", fontSize: 9, marginLeft: 3 }}>{curLv}/{u.maxLevel}</span>
                      <div style={{ fontSize: 7, color: "#ccddee", marginLeft: 19 }}>{u.desc}</div>
                    </div>
                    <Btn onClick={() => buyRegressionUpgrade(u)} disabled={!canBuy} small color={maxed ? "#4a4" : "#a6f"}>{maxed ? "MAX" : u.cost + "pt"}</Btn>
                  </div>
                );
              })}
            </div>
          ) : null}

        </div>

        {/* ═══ LOG PANEL ═══ */}
        <div style={{ width: 170, background: "#18183a", borderLeft: "1px solid #2e2e48", padding: 5, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", boxSizing: "border-box" }}>
          <div style={{ fontSize: 8, color: "#2a2a3e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 2, flexShrink: 0 }}>Log</div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {[...gs.log].reverse().map((msg, i) => {
              let c = "#3a3a4e";
              if (msg.includes("⚠")) c = "#f80";
              else if (msg.includes("💀")) c = "#f44";
              else if (msg.includes("🏆")) c = "#0ff";
              else if (msg.includes("⟳")) c = "#a6f";
              else if (msg.includes("⬆")) c = "#8af";
              else if (msg.includes("💎")) c = "#f80";
              else if (msg.includes("💰")) c = "#fc0";
              else if (msg.includes("📖")) c = "#0af";
              return (<div key={i} style={{ fontSize: 8, padding: "1px 0", borderBottom: "1px solid #2a2a44", color: c }}>{msg}</div>);
            })}
          </div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {gs.showConfirm ? (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#12122a", border: "1px solid #f44", borderRadius: 10, padding: 18, maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontFamily: "'Orbitron'", fontSize: 14, color: "#f44", marginBottom: 8 }}>☠ RESET TIMELINE?</div>
            <div style={{ fontSize: 10, color: "#ccd", marginBottom: 12 }}>All progress lost. Earn pts from floors + med tech.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn onClick={() => setGs(p => ({ ...p, showConfirm: false }))} color="#ccd">Cancel</Btn>
              <Btn onClick={() => { setGs(p => ({ ...p, showConfirm: false })); manualReset(); }} color="#f44">RESET</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
