// Shared UI components
import React from 'react';
import { MAT_ICONS } from '../../data/monsters.js';

export function Bar({ value, max, color, label, h = 14 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ position: "relative", width: "100%", height: h, background: "#18183a", borderRadius: 3, overflow: "hidden", border: "1px solid #424268" }}>
      <div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg, ${color}66, ${color})`, transition: "width 0.3s", borderRadius: 3 }} />
      {label ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#ccc", fontFamily: "monospace", textShadow: "0 0 3px #000" }}>
          {label}
        </div>
      ) : null}
    </div>
  );
}

// Expand 3-digit or 6-digit hex to rgba()
function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const [r, g, b] = c.length === 3
    ? [parseInt(c[0] + c[0], 16), parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16)]
    : [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Btn({ onClick, disabled, children, color = "#0af", small, glow }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "3px 7px" : "6px 12px",
      background: disabled ? "#222240" : hexToRgba(color, 0.1),
      color: disabled ? "#888" : color,
      border: "1px solid " + (disabled ? "#4e4e6e" : hexToRgba(color, 0.55)),
      borderRadius: 4, cursor: disabled ? "default" : "pointer",
      fontSize: small ? 9 : 11,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      boxShadow: glow ? `0 0 10px ${hexToRgba(color, 0.27)}` : "none",
      whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

export function TabBtn({ active, onClick, children, alert }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 8px",
      background: active ? "#0af15" : "transparent",
      color: active ? "#0ff" : "#ccddee",
      border: active ? "1px solid #0af55" : "1px solid #3e3e60",
      borderRadius: 4, cursor: "pointer", fontSize: 9,
      fontWeight: active ? 700 : 400,
      textTransform: "uppercase", letterSpacing: 0.5,
      fontFamily: "'JetBrains Mono', monospace",
      position: "relative",
    }}>
      {children}
      {alert ? (
        <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, background: "#f44", borderRadius: "50%", animation: "pulse 1s infinite" }} />
      ) : null}
    </button>
  );
}

export function Sec({ title, children, color = "#0af", border }) {
  return (
    <div style={{ background: "#1a1a3a", borderRadius: 6, padding: 9, border: `1px solid ${border || "#3e3e60"}`, marginBottom: 7 }}>
      {title ? (
        <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function MatCost({ mats, state }) {
  return (
    <span style={{ fontSize: 8, color: "#ccddee" }}>
      {Object.entries(mats).map(([key, val], i) => (
        <span key={key} style={{ color: (state.mats[key] || 0) >= val ? "#4a4" : "#f44", marginLeft: i ? 3 : 0 }}>
          {MAT_ICONS[key]}{val}
        </span>
      ))}
    </span>
  );
}

export function StatBox({ label, value, color }) {
  return (
    <div style={{ background: "#18183a", borderRadius: 3, padding: 3, textAlign: "center", border: "1px solid #383860" }}>
      <div style={{ fontSize: 7, color: "#bbccee" }}>{label}</div>
      <div style={{ fontSize: 10, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
