import { STATUS_COLORS, MONO } from "../../services/config";

export default function ZoneCard({ zone }) {
  const s = STATUS_COLORS[zone.status] || STATUS_COLORS.normal;
  const name = zone.zone?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || zone.zone;
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`, transition: "all 0.3s", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: s.dot, boxShadow: `0 0 10px ${s.glow}, 0 0 4px ${s.dot}`, animation: zone.status === "critical" ? "pulse 1.2s infinite" : "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: s.text, fontSize: 13, fontWeight: 600 }}>{name}</span>
        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: s.text, padding: "2px 6px", borderRadius: 4, fontFamily: MONO, background: `${s.dot}15`, letterSpacing: "0.05em" }}>{zone.status}</span>
      </div>
      <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#475569", fontSize: 9, margin: 0, fontFamily: MONO, letterSpacing: "0.05em" }}>PEOPLE</p>
          <p style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, margin: 0, fontFamily: MONO }}>{zone.current_occupancy}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#475569", fontSize: 9, margin: 0, fontFamily: MONO, letterSpacing: "0.05em" }}>WAIT</p>
          <p style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, margin: 0, fontFamily: MONO }}>{zone.avg_wait_minutes}<span style={{ fontSize: 11, color: "#64748b" }}>m</span></p>
        </div>
      </div>
    </div>
  );
}
