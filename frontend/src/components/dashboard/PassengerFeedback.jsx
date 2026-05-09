import { SmilePlus, Meh, Frown, ThumbsUp } from "lucide-react";
import { MONO } from "../../services/config";

/**
 * Compute passenger satisfaction from wait time (and crowding) in a smooth,
 * deterministic way so two zones with different waits show different scores.
 *
 * - 0 min wait        → 100%
 * - 5 min wait        → ~85%
 * - 15 min wait       → ~65%
 * - 30 min wait       → ~35%
 * - 45+ min wait      → ~10%
 *
 * Heavy crowding (occupancy > 150) drops the score by an extra 5–10pts.
 */
function classify(waitMin, occupancy = 0) {
  const w = Math.max(0, Number(waitMin) || 0);
  // Smooth exponential decay: 100 at w=0, ~50 at w=20, ~20 at w=40
  let pct = Math.round(100 * Math.exp(-w / 22));
  if (occupancy > 250) pct -= 12;
  else if (occupancy > 150) pct -= 6;
  pct = Math.max(0, Math.min(100, pct));

  let label, color, Icon;
  if (pct >= 85)      { label = "Very Satisfied";   color = "#10b981"; Icon = ThumbsUp; }
  else if (pct >= 65) { label = "Satisfied";        color = "#34d399"; Icon = SmilePlus; }
  else if (pct >= 45) { label = "Neutral";          color = "#f59e0b"; Icon = Meh; }
  else if (pct >= 25) { label = "Unsatisfied";      color = "#f97316"; Icon = Frown; }
  else                { label = "Very Unsatisfied"; color = "#ef4444"; Icon = Frown; }

  return { label, color, Icon, pct };
}

export default function PassengerFeedback({ zones }) {
  if (!zones || zones.length === 0) return null;
  const zd = zones.map((z) => ({
    ...z,
    fb: classify(z.avg_wait_minutes || 0, z.current_occupancy || 0),
    name: z.zone?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
  const avg = Math.round(zd.reduce((s, z) => s + z.fb.pct, 0) / zd.length);
  const ac = avg >= 70 ? "#10b981" : avg >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <SmilePlus size={13} color="#38bdf8" /> AI Passenger Feedback
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: `${ac}10`, border: `1px solid ${ac}20` }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: ac, fontFamily: MONO }}>{avg}%</span>
          <span style={{ fontSize: 9, color: "#64748b", fontFamily: MONO }}>AVG</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zd.map((z, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: `${z.fb.color}06`, border: `1px solid ${z.fb.color}12` }}>
            <z.fb.Icon size={16} color={z.fb.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{z.name}</span>
                <span style={{ fontSize: 10, fontFamily: MONO, color: z.fb.color, fontWeight: 600 }}>{z.fb.label}</span>
              </div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, width: `${z.fb.pct}%`, background: `linear-gradient(90deg, ${z.fb.color}80, ${z.fb.color})`, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569" }}>Wait: {z.avg_wait_minutes}m</span>
                <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569" }}>{z.fb.pct}% satisfaction</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
