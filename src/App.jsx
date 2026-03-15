// Main App - imports from separated data and game logic modules
// Tab components can be split into individual files later using Claude Code
import React, { useState, useEffect, useRef } from 'react';
import { Bar, Btn, TabBtn, Sec, MatCost, StatBox } from './components/ui/common.jsx';
import { DUNGEON_RANKS, FLOORS_PER_RANK, MATERIALS, MAT_ICONS, generateMonster } from './data/monsters.js';
import { WEAPONS, ARMORS, ACCESSORIES, getWeapon, getArmor, getAccessory } from './data/equipment.js';
import { MED_TECH_COSTS, CORE_TIERS, CORE_UNLOCK_MED_TECH, MERIDIANS, BODY_TECHNIQUES, bodyTechEssCost, poolExpandCost, POOL_EXPAND_AMOUNT } from './data/cultivation.js';
import { SKILL_DEFINITIONS, SKILL_MANUALS } from './data/skills.js';
import { HOUSING, BEDS, RESIDENCE_UPGRADES } from './data/housing.js';
import { JOBS, HIRES } from './data/jobs.js';
import { PILLS } from './data/pills.js';
import { REGRESSION_UPGRADES, INCURSION_BASE_TIMER, FOOD_DAILY_COST, CLINIC_COST } from './data/regression.js';
import { createInitialState } from './game/state.js';
import { gameTick } from './game/tick.js';
import { saveGame, loadGame, hasSave, deleteSave, AUTO_SAVE_INTERVAL } from './game/save.js';
import {
  fmt, fmtDecimal, fmtTime,
  getAtk, getDef, getDodge, getMaxHp, getMaxCombatEnergy,
  getRestRate, getProcessingRate, getPoolMax, corePassiveRate,
  getRent, getAvgDailyIncome, getGoldMultiplier, getMatCap,
  hasMats, subtractMats, regLevel,
} from './game/helpers.js';

const TABS = [
  ["dungeon", "⚔ Dungeon"],
  ["cultivation", "🧘 Cultivate"],
  ["equipment", "🎒 Equip"],
  ["shop", "🏪 Shop"],
  ["skills", "📜 Skills"],
  ["residence", "🏠 Home"],
  ["jobs", "⚒️ Jobs"],
  ["budget", "💰 Budget"],
  ["regression", "⟳ Regress"],
];

const ACTIVITY_COLORS = { idle: "#444", dungeon: "#f44", meditating: "#a6f", working: "#fc0" };
const ACTIVITY_LABELS = { idle: "Idle", dungeon: "Dungeon", meditating: "Meditating", working: "Working" };

export default function App() {
  // Initialize from save or fresh
  const [gs, setGs] = useState(() => {
    const saved = loadGame();
    return saved || createInitialState(null);
  });
  const logRef = useRef(null);

  // Game tick (500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setGs(prev => gameTick(prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      setGs(prev => {
        saveGame(prev);
        return prev;
      });
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollIntoView({ behavior: "smooth" });
  }, [gs.log.length]);

  // ═══════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════

  function setTab(tab) { setGs(p => ({ ...p, tab })); }

  function enterDungeon(rankIdx) {
    if (gs.incursionActive || gs.hp <= 5) return;
    const rank = DUNGEON_RANKS[rankIdx];
    const mon = generateMonster(rank, 1);
    setGs(p => ({ ...p, activity: "dungeon", dungeonRank: rankIdx, dungeonFloor: 1, currentMonster: mon, monsterHp: mon.hp, monsterMaxHp: mon.hp, log: [...p.log.slice(-80), `🚪 ${rank}-Rank F1`] }));
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

  function expandPool() {
    const cost = poolExpandCost(gs.poolCap);
    if (gs.processedEssence < cost) return;
    setGs(p => ({
      ...p, processedEssence: p.processedEssence - cost, poolCap: p.poolCap + POOL_EXPAND_AMOUNT,
      log: [...p.log.slice(-80), `💠 Pool → ${p.poolCap + POOL_EXPAND_AMOUNT}`],
    }));
  }

  function upgradeCore() {
    const nextTier = gs.coreTier + 1;
    if (nextTier >= CORE_TIERS.length || gs.medTechLevel < CORE_UNLOCK_MED_TECH) return;
    const tier = CORE_TIERS[nextTier];
    if (gs.processedEssence < tier.procEssCost) return;
    setGs(p => ({
      ...p, processedEssence: p.processedEssence - tier.procEssCost, coreTier: nextTier,
      log: [...p.log.slice(-80), `💎 Core → ${tier.name}`],
    }));
  }

  function openMeridian(idx) {
    const m = MERIDIANS[idx];
    if (gs.meridians[idx].opened || gs.processedEssence < m.essCost) return;
    setGs(p => {
      const merids = p.meridians.slice();
      merids[idx] = { ...merids[idx], opened: true };
      const ns = { ...p, processedEssence: p.processedEssence - m.essCost, meridians: merids };
      if (m.stat === "all") { ns.cultStr += m.bonus; ns.cultVit += m.bonus; ns.cultAgi += m.bonus; ns.cultInt += m.bonus; ns.cultWis += m.bonus; }
      else { const k = "cult" + m.stat.charAt(0).toUpperCase() + m.stat.slice(1); ns[k] = (ns[k] || 0) + m.bonus; }
      ns.log = [...p.log.slice(-80), `🔓 ${m.name} +${m.bonus} ${m.stat.toUpperCase()}`];
      return ns;
    });
  }

  function hardenMeridian(idx) {
    const m = MERIDIANS[idx];
    if (!gs.meridians[idx].opened || gs.meridians[idx].hardened || gs.processedEssence < m.hardenEssCost) return;
    setGs(p => {
      const merids = p.meridians.slice();
      merids[idx] = { ...merids[idx], hardened: true };
      const ns = { ...p, processedEssence: p.processedEssence - m.hardenEssCost, meridians: merids };
      if (m.stat === "all") { ns.cultStr += m.bonus; ns.cultVit += m.bonus; ns.cultAgi += m.bonus; ns.cultInt += m.bonus; ns.cultWis += m.bonus; }
      else { const k = "cult" + m.stat.charAt(0).toUpperCase() + m.stat.slice(1); ns[k] = (ns[k] || 0) + m.bonus; }
      ns.log = [...p.log.slice(-80), `🔒 ${m.name} hardened!`];
      return ns;
    });
  }

  function levelBodyTech(techId) {
    const tech = BODY_TECHNIQUES.find(t => t.id === techId);
    if (!tech || !gs.bodyTechsOwned[techId]) return;
    const curLv = gs.bodyTechLevels[techId] || 0;
    if (curLv >= tech.maxLevel) return;
    const cost = bodyTechEssCost(tech, curLv);
    if (gs.processedEssence < cost) return;
    setGs(p => {
      const levels = { ...p.bodyTechLevels, [techId]: (p.bodyTechLevels[techId] || 0) + 1 };
      return { ...p, processedEssence: p.processedEssence - cost, bodyTechLevels: levels, log: [...p.log.slice(-80), `⬆ ${tech.name} Lv.${curLv + 1}`] };
    });
  }

  function buyBodyTechManual(tech) {
    if (gs.bodyTechsOwned[tech.id] || !canAfford(tech.shopCost, tech.shopMats)) return;
    purchase(tech.name, tech.shopCost, tech.shopMats, (s) => ({
      ...s,
      bodyTechsOwned: { ...s.bodyTechsOwned, [tech.id]: true },
      bodyTechLevels: { ...s.bodyTechLevels, [tech.id]: 0 },
      log: [...s.log.slice(-80), `📖 Learned ${tech.name}!`],
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
    const highFloorSum = Object.values(gs.highestFloors).reduce((a, b) => a + b, 0);
    const pts = 1 + Math.floor(highFloorSum / 10) + Math.floor(gs.medTechLevel / 2);
    const newReg = { count: gs.regression.count + 1, pts: gs.regression.pts + pts, totalPts: gs.regression.totalPts + pts, ups: { ...gs.regression.ups } };
    deleteSave();
    setGs(createInitialState(newReg));
  }

  function manualSave() {
    saveGame(gs);
    setGs(p => ({ ...p, log: [...p.log.slice(-80), "💾 Game saved!"] }));
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
  const coreUnlocked = gs.medTechLevel >= CORE_UNLOCK_MED_TECH;
  const nextHouse = gs.housingLevel < HOUSING.length - 1 ? HOUSING[gs.housingLevel + 1] : null;
  const nextBed = gs.bedLevel < BEDS.length - 1 ? BEDS[gs.bedLevel + 1] : null;

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* HEADER */}
      <div style={{ background: "#0b0b1c", borderBottom: "1px solid #1a1a2e", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
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
        </div>
      </div>

      {/* STATUS BARS */}
      <div style={{ padding: "4px 10px", display: "flex", gap: 4, background: "#09091a" }}>
        <div style={{ flex: 1 }}><Bar value={gs.hp} max={gs.maxHp} color="#e44" label={`HP ${fmt(gs.hp)}/${fmt(gs.maxHp)}`} /></div>
        <div style={{ flex: 1 }}><Bar value={gs.rawEssence} max={poolMax} color="#a6f" label={`Raw ${fmt(gs.rawEssence)}/${fmt(poolMax)}`} /></div>
        <div style={{ flex: 1 }}><Bar value={gs.combatEnergy} max={gs.maxCombatEnergy} color="#48f" label={`EN ${fmt(gs.combatEnergy)}/${fmt(gs.maxCombatEnergy)}`} /></div>
      </div>

      {/* INCURSION BAR */}
      {!gs.incursionActive && !gs.incursionWon ? (
        <div style={{ padding: "0 10px 3px", background: "#09091a" }}>
          <Bar value={(1 - gs.incursionTimer / (INCURSION_BASE_TIMER + regLevel(gs, "r7") * 30)) * 100} max={100} color={gs.incursionTimer <= 120 ? "#f44" : "#f80"} label={`INC: ${fmtTime(gs.incursionTimer)}`} h={10} />
        </div>
      ) : null}

      {/* MATERIALS BAR */}
      <div style={{ padding: "2px 10px 3px", background: "#09091a", display: "flex", gap: 5, flexWrap: "wrap", borderBottom: "1px solid #1a1a2e" }}>
        {MATERIALS.map(m => gs.mats[m] > 0 ? (<span key={m} style={{ fontSize: 8, color: "#556" }}>{MAT_ICONS[m]}{gs.mats[m]}</span>) : null)}
        {gs.procBoostTimer > 0 ? (<span style={{ fontSize: 8, color: "#a6f", animation: "pulse 1s infinite" }}>⚡{Math.ceil(gs.procBoostTimer)}s</span>) : null}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 2, padding: "4px 8px", background: "#09091a", flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => (
          <TabBtn key={id} active={gs.tab === id} onClick={() => setTab(id)}
            alert={(id === "regression" && gs.regression.pts > 0) || (id === "budget" && !gs.rentPaid && rent > 0)}>
            {label}
          </TabBtn>
        ))}
      </div>

      {/* MAIN CONTENT + LOG */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: 8, overflowY: "auto", maxHeight: "calc(100vh - 155px)" }}>

          {/* ══════════════════════════════ */}
          {/* DUNGEON TAB                    */}
          {/* ══════════════════════════════ */}
          {gs.tab === "dungeon" ? (
            <div>
              {gs.activity !== "dungeon" && !gs.incursionActive ? (
                <div style={{ fontSize: 9, color: "#4a4", marginBottom: 6 }}>
                  {gs.hp < gs.maxHp ? `💤 Resting (${fmtDecimal(getRestRate(gs))}HP/s)` : "✓ Full HP"}
                </div>
              ) : null}

              {gs.incursionActive ? (
                <Sec title="⚠️ INCURSION" color="#f44" border="#f44">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 30, animation: "shake .3s infinite" }}>👾</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f88", fontWeight: 700 }}>Kha'zul Ph{gs.incursionPhase}/3</div>
                      <Bar value={gs.incursionBossHp} max={gs.incursionBossMaxHp} color="#f44" h={14} label={`${fmt(gs.incursionBossHp)}/${fmt(gs.incursionBossMaxHp)}`} />
                    </div>
                  </div>
                </Sec>
              ) : null}

              {gs.incursionWon ? (<Sec title="🏆 VICTORY!" color="#fc0"><div style={{ color: "#fda" }}>Earth is saved!</div></Sec>) : null}

              {gs.activity !== "dungeon" && !gs.incursionActive && !gs.incursionWon ? (
                <div>
                  <Sec title="🚪 Dungeons — Gold + Essence + Drops">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(70px,1fr))", gap: 4 }}>
                      {DUNGEON_RANKS.map((rk, i) => {
                        const ok = i <= gs.dungeonRank;
                        return (
                          <button key={rk} onClick={() => ok && enterDungeon(i)} disabled={!ok || gs.hp <= 5}
                            style={{ background: ok ? "#111128" : "#0a0a15", border: `1px solid ${ok ? "#3a3a5e" : "#181828"}`, borderRadius: 5, padding: 5, cursor: ok ? "pointer" : "default", textAlign: "center", opacity: ok ? 1 : 0.3 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: ok ? "#0ff" : "#333", fontFamily: "'Orbitron'" }}>{rk}</div>
                            <div style={{ fontSize: 7, color: "#556" }}>{ok ? `Best:F${gs.highestFloors[rk] || 0}` : "🔒"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </Sec>
                  <Btn onClick={healClinic} disabled={gs.gold < CLINIC_COST} color="#4a4" small>🏥 Clinic {CLINIC_COST}g</Btn>
                </div>
              ) : null}

              {gs.activity === "dungeon" && gs.currentMonster && !gs.incursionActive ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#0af", fontFamily: "'Orbitron'", fontWeight: 700 }}>{DUNGEON_RANKS[gs.dungeonRank]}-{gs.dungeonFloor}F</span>
                    <Btn onClick={leaveDungeon} color="#f44" small>🏃Leave</Btn>
                  </div>
                  <Sec>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 26 }}>{gs.currentMonster.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: gs.currentMonster.isBoss ? "#f80" : "#fff", fontWeight: 700, fontSize: 12 }}>{gs.currentMonster.name}</div>
                        <div style={{ fontSize: 8, color: "#556" }}>DMG:{gs.currentMonster.dmg} | {gs.currentMonster.gold}g +{gs.currentMonster.essence}ess</div>
                        <Bar value={gs.monsterHp} max={gs.monsterMaxHp} color={gs.currentMonster.isBoss ? "#f80" : "#e44"} h={13} label={`${fmt(gs.monsterHp)}/${fmt(gs.monsterMaxHp)}`} />
                      </div>
                    </div>
                    {gs.lastHit > 0 ? (<div style={{ fontSize: 9, color: "#f66" }}>-{gs.lastHit}</div>) : null}
                  </Sec>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 3 }}>
                    <StatBox label="⚔" value={atk} color="#f80" />
                    <StatBox label="🛡" value={def} color="#08f" />
                    <StatBox label="💨" value={dodge.toFixed(0) + "%"} color="#0f0" />
                    <StatBox label="💜" value={`${fmt(gs.rawEssence)}/${fmt(poolMax)}`} color="#a6f" />
                  </div>
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
              <div style={{ background: gs.activity === "meditating" ? "#1a102a" : "#0e0e1e", borderRadius: 5, padding: 8, border: `1px solid ${gs.activity === "meditating" ? "#a6f55" : "#1a1a2e"}`, marginBottom: 8 }}>
                {gs.activity === "meditating" ? (
                  <div>
                    <div style={{ fontSize: 11, color: "#a6f", fontWeight: 700 }}>🧘 Processing — {fmtDecimal(processRate)}/s</div>
                    <div style={{ fontSize: 9, color: "#556" }}>Raw:{fmtDecimal(gs.rawEssence)} → ✦{fmt(gs.processedEssence)}</div>
                    <Btn onClick={stopActivity} small color="#888" style={{ marginTop: 4 }}>Stop</Btn>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 9, color: "#556" }}>Meditate to process raw → ✦ processed. Core generates raw passively.</div>
                    <Btn onClick={startMeditate} disabled={gs.activity === "dungeon" || gs.activity === "working"} color="#a6f" small style={{ marginTop: 3 }}>🧘 Meditate</Btn>
                    {gs.activity !== "idle" ? (<span style={{ fontSize: 8, color: "#f44", marginLeft: 6 }}>Stop first!</span>) : null}
                  </div>
                )}
              </div>

              {/* Essence display */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <div style={{ background: "#0e0e1e", borderRadius: 5, padding: 8, border: "1px solid #2a1a3a", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "#a6f" }}>RAW</div>
                  <div style={{ fontSize: 14, color: "#a6f", fontWeight: 700 }}>{fmtDecimal(gs.rawEssence)}<span style={{ fontSize: 9, color: "#556" }}>/{poolMax}</span></div>
                  <Bar value={gs.rawEssence} max={poolMax} color="#a6f" h={6} />
                </div>
                <div style={{ background: "#0e0e1e", borderRadius: 5, padding: 8, border: "1px solid #3a2a1a", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "#f80" }}>✦ PROCESSED</div>
                  <div style={{ fontSize: 14, color: "#f80", fontWeight: 700 }}>{fmt(gs.processedEssence)}</div>
                </div>
              </div>

              {/* Med Technique */}
              <Sec title={`📖 Med Technique Lv.${gs.medTechLevel}`} color="#a6f">
                <div style={{ fontSize: 9, color: "#556", marginBottom: 4 }}>Process: {fmtDecimal(processRate)}/s</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#a6f" }}>{medTechCost}✦</span>
                  <Btn onClick={levelMedTech} disabled={gs.processedEssence < medTechCost} color="#a6f" small glow={gs.processedEssence >= medTechCost}>⬆ Level</Btn>
                </div>
                <Bar value={gs.processedEssence} max={medTechCost} color="#a6f" h={8} label={`${fmt(gs.processedEssence)}/${medTechCost}`} />
              </Sec>

              {/* Pool */}
              <Sec title={`💠 Pool — ${poolMax}`} color="#48f">
                <div style={{ fontSize: 9, color: "#556", marginBottom: 4 }}>Raw storage. Overflow lost!</div>
                <Btn onClick={expandPool} disabled={gs.processedEssence < poolExpandCost(gs.poolCap)} color="#48f" small>+{POOL_EXPAND_AMOUNT} — {poolExpandCost(gs.poolCap)}✦</Btn>
              </Sec>

              {/* Meridians */}
              <Sec title="☯️ Meridians" color="#0f0">
                {MERIDIANS.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #0d0d18" }}>
                    <div>
                      <span style={{ marginRight: 2 }}>{m.icon}</span>
                      <span style={{ fontSize: 10, color: gs.meridians[i].hardened ? "#f80" : gs.meridians[i].opened ? "#0f0" : "#444" }}>{m.name}</span>
                      <span style={{ fontSize: 8, color: "#556", marginLeft: 3 }}>+{m.bonus} {m.stat.toUpperCase()}</span>
                    </div>
                    {!gs.meridians[i].opened ? (<Btn onClick={() => openMeridian(i)} disabled={gs.processedEssence < m.essCost} small color="#0f0">{m.essCost}✦</Btn>)
                      : !gs.meridians[i].hardened ? (<Btn onClick={() => hardenMeridian(i)} disabled={gs.processedEssence < m.hardenEssCost} small color="#f80">{m.hardenEssCost}✦</Btn>)
                      : (<span style={{ fontSize: 8, color: "#f80" }}>🔒</span>)}
                  </div>
                ))}
              </Sec>

              {/* Core */}
              <Sec title={`💎 Core${gs.coreTier >= 0 ? " — " + CORE_TIERS[gs.coreTier].name : ""}`} color="#f80" border={gs.coreTier >= 0 ? "#f80" : undefined}>
                {!coreUnlocked ? (<div style={{ fontSize: 9, color: "#555" }}>🔒 Need MT Lv.{CORE_UNLOCK_MED_TECH} (have: {gs.medTechLevel})</div>)
                  : gs.coreTier < 0 ? (
                    <div>
                      <div style={{ fontSize: 9, color: "#556", marginBottom: 4 }}>Passive raw essence gen.</div>
                      <Btn onClick={upgradeCore} disabled={gs.processedEssence < CORE_TIERS[0].procEssCost} color="#f80" small>Form ({CORE_TIERS[0].procEssCost}✦) → +{CORE_TIERS[0].passiveEss}/s</Btn>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 10, color: "#f80" }}>+{CORE_TIERS[gs.coreTier].passiveEss}/s passive</div>
                      {nextCore ? (<Btn onClick={upgradeCore} disabled={gs.processedEssence < nextCore.procEssCost} color="#f80" small style={{ marginTop: 4 }}>→{nextCore.name} ({nextCore.procEssCost}✦) +{nextCore.passiveEss}/s</Btn>)
                        : (<div style={{ fontSize: 9, color: "#4a4" }}>Max!</div>)}
                    </div>
                  )}
              </Sec>

              {/* Body Techniques */}
              <Sec title="💪 Body Techniques" color="#0af">
                <div style={{ fontSize: 9, color: "#556", marginBottom: 6 }}>Buy manuals in Shop → level with ✦ here.</div>
                {BODY_TECHNIQUES.map(tech => {
                  const owned = gs.bodyTechsOwned[tech.id];
                  const lv = gs.bodyTechLevels[tech.id] || 0;
                  const maxed = lv >= tech.maxLevel;
                  const cost = bodyTechEssCost(tech, lv);

                  if (!owned) {
                    return (
                      <div key={tech.id} style={{ padding: "4px 0", borderBottom: "1px solid #0d0d18", opacity: 0.4 }}>
                        <span style={{ marginRight: 3 }}>{tech.icon}</span>
                        <span style={{ fontSize: 10, color: "#555" }}>{tech.name}</span>
                        <span style={{ fontSize: 8, color: "#444", marginLeft: 4 }}>🔒 Buy from Shop</span>
                      </div>
                    );
                  }

                  return (
                    <div key={tech.id} style={{ padding: "5px 0", borderBottom: "1px solid #0d0d18" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ marginRight: 3 }}>{tech.icon}</span>
                          <span style={{ fontSize: 10, color: "#0af", fontWeight: 600 }}>{tech.name}</span>
                          <span style={{ fontSize: 9, color: "#f80", marginLeft: 4 }}>Lv.{lv}/{tech.maxLevel}</span>
                        </div>
                        {!maxed ? (<Btn onClick={() => levelBodyTech(tech.id)} disabled={gs.processedEssence < cost} small color="#0af" glow={gs.processedEssence >= cost}>{cost}✦</Btn>)
                          : (<span style={{ fontSize: 8, color: "#4a4" }}>MAX</span>)}
                      </div>
                      <div style={{ fontSize: 8, color: "#556", marginLeft: 18 }}>{tech.desc}</div>
                      {!maxed ? (<Bar value={gs.processedEssence} max={cost} color="#0af" h={4} />) : null}
                    </div>
                  );
                })}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* EQUIPMENT TAB                  */}
          {/* ══════════════════════════════ */}
          {gs.tab === "equipment" ? (
            <div>
              <Sec title="🗡️ Weapon">
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{getWeapon(gs.weapon).icon}</span>
                  <div><div style={{ color: "#0ff", fontWeight: 700 }}>{getWeapon(gs.weapon).name}</div><div style={{ fontSize: 9, color: "#f80" }}>ATK+{getWeapon(gs.weapon).atk}</div></div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {gs.ownedWeapons.filter(id => id !== gs.weapon).map(id => {
                    const w = getWeapon(id);
                    return (<Btn key={id} onClick={() => setGs(p => ({ ...p, weapon: id }))} small color="#0af">{w.icon}{w.name}</Btn>);
                  })}
                </div>
              </Sec>
              <Sec title="🛡️ Armor">
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{getArmor(gs.armor).icon}</span>
                  <div><div style={{ color: "#0ff", fontWeight: 700 }}>{getArmor(gs.armor).name}</div><div style={{ fontSize: 9, color: "#08f" }}>DEF+{getArmor(gs.armor).def}</div></div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {gs.ownedArmors.filter(id => id !== gs.armor).map(id => {
                    const a = getArmor(id);
                    return (<Btn key={id} onClick={() => setGs(p => ({ ...p, armor: id }))} small color="#0af">{a.icon}{a.name}</Btn>);
                  })}
                </div>
              </Sec>
              <Sec title="Stats" color="#fc0">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
                  <StatBox label="ATK" value={atk} color="#f80" />
                  <StatBox label="DEF" value={def} color="#08f" />
                  <StatBox label="Dodge" value={dodge.toFixed(1) + "%"} color="#0f0" />
                  <StatBox label="HP" value={gs.maxHp} color="#e44" />
                  <StatBox label="EN" value={gs.maxCombatEnergy} color="#48f" />
                  <StatBox label="MT" value={gs.medTechLevel} color="#a6f" />
                </div>
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
                      <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                        <div>
                          <span style={{ marginRight: 2 }}>{it.icon}</span>
                          <span style={{ color: owned ? "#4a4" : "#888", fontSize: 10 }}>{it.name}</span>
                          <span style={{ color: "#445", fontSize: 8, marginLeft: 3 }}>+{it.atk || it.def || ""}</span>
                          {Object.keys(it.mats).length > 0 ? (<span style={{ marginLeft: 3 }}><MatCost mats={it.mats} state={gs} /></span>) : null}
                        </div>
                        {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                          : (<Btn onClick={() => purchase(it.name, it.cost, it.mats, s => ({ ...s, [ownedKey]: [...s[ownedKey], it.id], [equipKey]: it.id }))} disabled={!canAfford(it.cost, it.mats)} small color="#fc0">{it.cost}g</Btn>)}
                      </div>
                    );
                  })}
                </Sec>
              ))}

              <Sec title="📖 Body Technique Manuals" color="#0af">
                {BODY_TECHNIQUES.map(tech => {
                  const owned = gs.bodyTechsOwned[tech.id];
                  return (
                    <div key={tech.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #0d0d18" }}>
                      <div>
                        <span style={{ marginRight: 2 }}>{tech.icon}</span>
                        <span style={{ color: owned ? "#4a4" : "#888", fontSize: 10 }}>{tech.name}</span>
                        <span style={{ fontSize: 8, color: "#445", marginLeft: 3 }}>{tech.desc}</span>
                        {Object.keys(tech.shopMats).length > 0 ? (<span style={{ marginLeft: 3 }}><MatCost mats={tech.shopMats} state={gs} /></span>) : null}
                      </div>
                      {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                        : (<Btn onClick={() => buyBodyTechManual(tech)} disabled={!canAfford(tech.shopCost, tech.shopMats)} small color="#0af">{tech.shopCost}g</Btn>)}
                    </div>
                  );
                })}
              </Sec>

              <Sec title="📖 Combat Skills">
                {SKILL_MANUALS.map(m => {
                  const owned = !!gs.skills[m.skill];
                  const def2 = SKILL_DEFINITIONS[m.skill];
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                      <div>
                        <span style={{ color: owned ? "#4a4" : "#888", fontSize: 10 }}>{def2?.icon} {def2?.name}</span>
                        {Object.keys(m.mats).length > 0 ? (<span style={{ marginLeft: 3 }}><MatCost mats={m.mats} state={gs} /></span>) : null}
                      </div>
                      {owned ? (<span style={{ fontSize: 8, color: "#4a4" }}>✓</span>)
                        : (<Btn onClick={() => purchase(def2?.name, m.cost, m.mats, s => ({ ...s, skills: { ...s.skills, [m.skill]: { level: 1, exp: 0, expToNext: 40 } } }))} disabled={!canAfford(m.cost, m.mats)} small color="#a6f">{m.cost}g</Btn>)}
                    </div>
                  );
                })}
              </Sec>

              <Sec title="💊 Pills">
                {PILLS.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                    <div>
                      <span style={{ marginRight: 2 }}>{p.icon}</span>
                      <span style={{ color: "#888", fontSize: 10 }}>{p.name}</span>
                      <span style={{ color: "#445", fontSize: 8, marginLeft: 3 }}>{p.desc}</span>
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
              <Sec title="Active" color="#f80">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {Object.keys(gs.skills).filter(id => SKILL_DEFINITIONS[id]?.type === "active").map(id => (
                    <Btn key={id} onClick={() => setGs(p => ({ ...p, activeSkill: id }))} color={gs.activeSkill === id ? "#0ff" : "#556"} small glow={gs.activeSkill === id}>
                      {SKILL_DEFINITIONS[id]?.icon} {SKILL_DEFINITIONS[id]?.name} {gs.skills[id].level}
                    </Btn>
                  ))}
                </div>
              </Sec>
              <Sec title="All (level via combat)">
                {Object.entries(gs.skills).map(([id, sk]) => {
                  const d = SKILL_DEFINITIONS[id];
                  if (!d) return null;
                  return (
                    <div key={id} style={{ padding: "3px 0", borderBottom: "1px solid #0d0d18" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ marginRight: 2 }}>{d.icon}</span>
                          <span style={{ color: gs.activeSkill === id ? "#0ff" : "#ccc", fontWeight: 600, fontSize: 10 }}>{d.name}</span>
                          <span style={{ color: "#f80", fontSize: 9, marginLeft: 3 }}>Lv.{sk.level}</span>
                        </div>
                        {d.type === "active" && d.energyCost > 0 ? (<span style={{ fontSize: 8, color: "#556" }}>x{d.dmgMult} {d.energyCost}EN</span>) : null}
                      </div>
                      {d.type === "passive" ? (<div style={{ fontSize: 8, color: "#8af" }}>{id === "windStep" ? `+${sk.level * 3}%dodge` : `+${sk.level * 2}DEF`}</div>) : null}
                      {sk.expToNext < 900 ? (<Bar value={sk.exp} max={sk.expToNext} color="#a6f" h={4} />) : null}
                    </div>
                  );
                })}
              </Sec>
            </div>
          ) : null}

          {/* ══════════════════════════════ */}
          {/* RESIDENCE TAB                  */}
          {/* ══════════════════════════════ */}
          {gs.tab === "residence" ? (
            <div>
              <Sec title={`${HOUSING[gs.housingLevel].icon} ${HOUSING[gs.housingLevel].name}`} color="#fc0">
                <div style={{ fontSize: 9, color: "#556" }}>Rest x{HOUSING[gs.housingLevel].restMult} | Rent: {HOUSING[gs.housingLevel].rent}g/wk</div>
                {nextHouse ? (<Btn onClick={() => purchase(nextHouse.name, nextHouse.cost, nextHouse.mats, s => ({ ...s, housingLevel: s.housingLevel + 1 }))} disabled={!canAfford(nextHouse.cost, nextHouse.mats)} small color="#fc0" style={{ marginTop: 4 }}>→ {nextHouse.name} (x{nextHouse.restMult}) {nextHouse.cost}g</Btn>) : null}
              </Sec>
              <Sec title={`🛏️ ${BEDS[gs.bedLevel].name}`} color="#8af">
                <div style={{ fontSize: 9, color: "#556" }}>+{BEDS[gs.bedLevel].restBonus}/s</div>
                {nextBed ? (<Btn onClick={() => purchase(nextBed.name, nextBed.cost, nextBed.mats, s => ({ ...s, bedLevel: s.bedLevel + 1 }))} disabled={!canAfford(nextBed.cost, nextBed.mats)} small color="#8af" style={{ marginTop: 4 }}>→ {nextBed.name} (+{nextBed.restBonus}/s) {nextBed.cost}g</Btn>) : null}
              </Sec>
              <Sec title="Upgrades">
                {RESIDENCE_UPGRADES.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                    <div><span style={{ marginRight: 2 }}>{u.icon}</span><span style={{ color: gs.residenceUpgrades[u.field] ? "#4a4" : "#888", fontSize: 10 }}>{u.name}</span><span style={{ fontSize: 8, color: "#445", marginLeft: 3 }}>{u.desc}</span></div>
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
                  return (
                    <div key={j.id} style={{ background: active ? "#1a1a10" : "#0c0c1a", borderRadius: 4, padding: 6, border: `1px solid ${active ? "#fc055" : "#1a1a2e"}`, marginBottom: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ marginRight: 2 }}>{j.icon}</span>
                          <span style={{ color: active ? "#fc0" : "#ccc", fontWeight: 600, fontSize: 10 }}>{j.name}</span>
                          <span style={{ color: "#445", fontSize: 8, marginLeft: 3 }}>{Object.entries(j.input).map(([k, v]) => MAT_ICONS[k] + v).join("+") + "→" + j.output + "g"}</span>
                          {gs.hiredWorkers[j.id] ? (<span style={{ fontSize: 8, color: "#4a4", marginLeft: 3 }}>👤</span>) : null}
                        </div>
                        {!active ? (<Btn onClick={() => startWork(j.id)} disabled={gs.activity === "dungeon" || !hasMats(gs, j.input)} small color="#fc0">Start</Btn>)
                          : (<Btn onClick={stopActivity} small color="#888">Stop</Btn>)}
                      </div>
                      {active ? (<Bar value={gs.jobProgress} max={j.time} color="#fc0" h={7} />) : null}
                    </div>
                  );
                })}
              </Sec>
              <Sec title="👤 Hire" color="#0af">
                {HIRES.map(h => (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                    <span style={{ color: gs.hiredWorkers[h.job] ? "#4a4" : "#888", fontSize: 10 }}>{h.name}</span>
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
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#556" }}>Daily</span><span style={{ color: "#fc0", fontWeight: 700 }}>-{FOOD_DAILY_COST}g</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#556" }}>Weekly</span><span style={{ color: "#fc0", fontWeight: 700 }}>-{FOOD_DAILY_COST * 7}g</span></div>
              </Sec>
              <Sec title="📈 Income" color="#0f0">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#556" }}>Avg</span><span style={{ color: "#0f0", fontWeight: 700 }}>+{avgIncome}g/d</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                  {gs.dailyIncome.map((inc, i) => (
                    <div key={i} style={{ textAlign: "center", background: i === gs.weekDay ? "#0f022" : "#0a0a18", borderRadius: 3, padding: 3, border: `1px solid ${i === gs.weekDay ? "#0f044" : "#151525"}` }}>
                      <div style={{ fontSize: 7, color: i === gs.weekDay ? "#0f0" : "#445" }}>D{i + 1}</div>
                      <div style={{ fontSize: 9, color: i === gs.weekDay ? "#0f0" : "#556", fontWeight: 700 }}>{fmt(inc)}</div>
                    </div>
                  ))}
                </div>
              </Sec>
              <Sec title="📋 Purchases" color="#f80">
                {gs.weekPurchases.length === 0 ? (<div style={{ fontSize: 9, color: "#445" }}>None.</div>) : (
                  <div style={{ maxHeight: 120, overflowY: "auto" }}>
                    {gs.weekPurchases.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #0d0d18" }}>
                        <span style={{ fontSize: 9, color: "#888" }}>{p.name}</span>
                        <span style={{ fontSize: 9, color: "#f44" }}>-{p.cost}g</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 3, borderTop: "1px solid #2a2a3e" }}>
                  <span style={{ color: "#556" }}>Total</span><span style={{ color: "#f44", fontWeight: 700 }}>-{fmt(gs.totalWeekSpend)}g</span>
                </div>
              </Sec>
              <Sec title="🏦 Balance" color="#fc0">
                <div style={{ fontSize: 16, color: "#fc0", fontWeight: 700, textAlign: "center" }}>💰 {fmt(gs.gold)}g</div>
                <div style={{ fontSize: 9, color: "#556", textAlign: "center" }}>Day {gs.dayCount} | Wk {gs.weekDay + 1}/7</div>
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
                <div style={{ fontSize: 8, color: "#556", marginTop: 3 }}>From floors + med tech. Persist forever.</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <Btn onClick={() => setGs(p => ({ ...p, showConfirm: true }))} color="#f44" small>☠ Reset</Btn>
                  <Btn onClick={hardReset} color="#888" small>🗑️ Full Wipe</Btn>
                </div>
              </Sec>
              {REGRESSION_UPGRADES.map(u => {
                const curLv = gs.regression.ups[u.id] || 0;
                const maxed = curLv >= u.maxLevel;
                const canBuy = gs.regression.pts >= u.cost && !maxed;
                return (
                  <div key={u.id} style={{ background: "#0e0e1e", borderRadius: 5, padding: 7, border: `1px solid ${maxed ? "#4a4" : canBuy ? "#a6f44" : "#1a1a2e"}`, marginBottom: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ marginRight: 3 }}>{u.icon}</span>
                      <span style={{ color: maxed ? "#4a4" : "#ccc", fontWeight: 600, fontSize: 10 }}>{u.name}</span>
                      <span style={{ color: "#f80", fontSize: 9, marginLeft: 3 }}>{curLv}/{u.maxLevel}</span>
                      <div style={{ fontSize: 7, color: "#556", marginLeft: 19 }}>{u.desc}</div>
                    </div>
                    <Btn onClick={() => buyRegressionUpgrade(u)} disabled={!canBuy} small color={maxed ? "#4a4" : "#a6f"}>{maxed ? "MAX" : u.cost + "pt"}</Btn>
                  </div>
                );
              })}
            </div>
          ) : null}

        </div>

        {/* ═══ LOG PANEL ═══ */}
        <div style={{ width: 170, background: "#0a0a18", borderLeft: "1px solid #151525", padding: 5, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 8, color: "#2a2a3e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>Log</div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {gs.log.map((msg, i) => {
              let c = "#3a3a4e";
              if (msg.includes("⚠")) c = "#f80";
              else if (msg.includes("💀")) c = "#f44";
              else if (msg.includes("🏆")) c = "#0ff";
              else if (msg.includes("⟳")) c = "#a6f";
              else if (msg.includes("⬆")) c = "#8af";
              else if (msg.includes("💎")) c = "#f80";
              else if (msg.includes("💰")) c = "#fc0";
              else if (msg.includes("📖")) c = "#0af";
              return (<div key={i} style={{ fontSize: 8, padding: "1px 0", borderBottom: "1px solid #0d0d1a", color: c }}>{msg}</div>);
            })}
            <div ref={logRef} />
          </div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {gs.showConfirm ? (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#12122a", border: "1px solid #f44", borderRadius: 10, padding: 18, maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontFamily: "'Orbitron'", fontSize: 14, color: "#f44", marginBottom: 8 }}>☠ RESET TIMELINE?</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 12 }}>All progress lost. Earn pts from floors + med tech.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn onClick={() => setGs(p => ({ ...p, showConfirm: false }))} color="#888">Cancel</Btn>
              <Btn onClick={() => { setGs(p => ({ ...p, showConfirm: false })); manualReset(); }} color="#f44">RESET</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
