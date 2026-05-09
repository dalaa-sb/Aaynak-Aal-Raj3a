import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { MONO } from "../../services/config";

export default function QueuePrediction({ queueHistory }) {
  const data = useMemo(() => {
    if (!queueHistory || queueHistory.length < 3) return [];
    const recent = queueHistory.slice(-15);
    const n = recent.length;
    const avg = recent.reduce((s, d) => s + d.count, 0) / n;
    // Linear regression slope (least-squares) over the recent window
    // — grounded in the actual data, no synthetic wobble.
    const xMean = (n - 1) / 2;
    let num = 0, den = 0;
    recent.forEach((d, i) => {
      num += (i - xMean) * (d.count - avg);
      den += (i - xMean) ** 2;
    });
    const slope = den ? num / den : 0;

    const pts = [];
    // Show last 8 actual points
    recent.slice(-8).forEach((d) => pts.push({ time: d.time, actual: d.count, predicted: null }));

    // Bridge last actual to first prediction so the line connects visually
    const last = recent[n - 1];
    pts[pts.length - 1].predicted = last.count;

    // Project 6 future points (2 minutes apart)
    const now = Date.now();
    for (let i = 1; i <= 6; i++) {
      const projected = avg + slope * (n - 1 + i);
      pts.push({
        time: new Date(now + i * 120000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actual: null,
        predicted: Math.max(0, Math.round(projected)),
      });
    }
    return pts;
  }, [queueHistory]);

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <TrendingUp size={13} color="#8b5cf6" /> Queue Length Prediction
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" />
            <XAxis dataKey="time" stroke="#1e293b" fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} />
            <YAxis stroke="#1e293b" fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgba(6,8,13,0.95)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10, fontSize: 11, fontFamily: "JetBrains Mono", color: "#e2e8f0" }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono", color: "#64748b" }} />
            <Line type="monotone" dataKey="actual" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: "#0ea5e9" }} name="Actual" connectNulls={false} />
            <Line type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: "#8b5cf6" }} name="Predicted" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#334155", fontSize: 12 }}>Collecting data for predictions...</p>
        </div>
      )}
    </div>
  );
}
