import { FONT, MONO } from "../../services/config";

export default function StatCard({ icon: Icon, label, value, sub, color = "#38bdf8" }) {
  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, flex: 1, minWidth: 180, background: "rgba(15,23,42,0.4)", border: "1px solid rgba(56,189,248,0.04)", backdropFilter: "blur(10px)", fontFamily: FONT, transition: "border-color 0.3s, box-shadow 0.3s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.boxShadow = `0 0 30px ${color}08`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.04)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "#475569", fontSize: 10, fontWeight: 600, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO }}>{label}</p>
          <p style={{ color: "#f0f9ff", fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</p>
          {sub && <p style={{ color: "#475569", fontSize: 11, marginTop: 8 }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `color-mix(in srgb, ${color} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={color} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
