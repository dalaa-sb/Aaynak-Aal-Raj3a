import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { FONT, MONO } from "../../services/config";

const CLR = { low: "#10b981", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };

export default function SeverityBreakdown({ alerts }) {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  const active = alerts.filter((a) => !a.acknowledged);
  active.forEach((a) => { if (counts[a.severity] !== undefined) counts[a.severity]++; });
  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
  const total = active.length;

  if (total === 0) return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
      <p style={{ color: "#334155", fontSize: 12 }}>No active alerts</p>
    </div>
  );

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 10px", fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>Severity breakdown</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 120, height: 120, position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data} innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">{data.map((e) => <Cell key={e.name} fill={CLR[e.name]} />)}</Pie></PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <p style={{ color: "#f0f9ff", fontSize: 22, fontWeight: 800, margin: 0, fontFamily: MONO }}>{total}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {Object.entries(counts).map(([sev, count]) => (
            <div key={sev} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CLR[sev], flexShrink: 0 }} />
              <span style={{ color: "#64748b", fontSize: 10, fontFamily: MONO, textTransform: "uppercase", flex: 1, letterSpacing: "0.05em" }}>{sev}</span>
              <span style={{ color: count > 0 ? "#e2e8f0" : "#1e293b", fontSize: 14, fontWeight: 700, fontFamily: MONO }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
