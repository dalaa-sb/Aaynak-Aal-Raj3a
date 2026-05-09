import { useMemo } from "react";
import { Clock, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { MONO } from "../../services/config";

export default function WaitTimePrediction({ zones }) {
  const rows = useMemo(() => {
    if (!zones) return [];
    return zones.map((z) => {
      const c = Math.max(0, Math.round(z.avg_wait_minutes || 0));
      const occ = z.current_occupancy || 0;
      // Load factor: how busy is the zone?
      // <100 people = below capacity (waits should shrink)
      // 100–200 = steady (waits roughly constant)
      // >200 = above capacity (waits will grow)
      let drift15, drift30;
      if (occ > 200) {
        drift15 = Math.round(c * 0.18) + 2;     // +20-30%
        drift30 = Math.round(c * 0.35) + 4;     // +40-60%
      } else if (occ > 100) {
        drift15 = Math.round(random(-1, 2));
        drift30 = Math.round(random(-2, 4));
      } else {
        drift15 = -Math.round(c * 0.15) - 1;    // shrinking
        drift30 = -Math.round(c * 0.30) - 2;
      }
      const p15 = Math.max(0, c + drift15);
      const p30 = Math.max(0, c + drift30);

      let trend = "flat";
      if (p15 < c - 1)      trend = "down";
      else if (p15 > c + 1) trend = "up";

      return {
        zone: z.zone?.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
        c, p15, p30, trend,
      };
    });
  }, [zones]);

  // Stable pseudo-random in [-x..x] without breaking memo (deterministic within render)
  function random(min, max) { return min + (max - min) * 0.5; /* center: avoids jitter */ }

  const ic = (t) => t === "down" ? TrendingDown : t === "up" ? TrendingUp : Minus;
  const tc = (t) => t === "down" ? "#10b981" : t === "up" ? "#ef4444" : "#64748b";

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <Clock size={13} color="#10b981" /> Wait Time Predictions
      </h3>
      {rows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 0.5fr", gap: 8, padding: "0 12px" }}>
            {["ZONE", "NOW", "+15 MIN", "+30 MIN", ""].map((h) => <span key={h} style={{ fontSize: 9, fontFamily: MONO, color: "#334155", letterSpacing: "0.08em" }}>{h}</span>)}
          </div>
          {rows.map((r, i) => {
            const I = ic(r.trend);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 0.5fr", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(15,23,42,0.4)", border: "1px solid rgba(56,189,248,0.03)", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{r.zone}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f9ff", fontFamily: MONO }}>{r.c}<span style={{ fontSize: 10, color: "#64748b" }}>m</span></span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#8b5cf6", fontFamily: MONO }}>{r.p15}<span style={{ fontSize: 10, color: "#64748b" }}>m</span></span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0ea5e9", fontFamily: MONO }}>{r.p30}<span style={{ fontSize: 10, color: "#64748b" }}>m</span></span>
                <I size={14} color={tc(r.trend)} />
              </div>
            );
          })}
        </div>
      ) : <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#334155", fontSize: 12 }}>Waiting for data...</p></div>}
    </div>
  );
}
