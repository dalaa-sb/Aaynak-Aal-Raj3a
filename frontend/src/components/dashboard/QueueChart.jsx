import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity } from "lucide-react";
import { MONO } from "../../services/config";

export default function QueueChart({ data }) {
  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <Activity size={13} color="#38bdf8" /> Live queue detection
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" />
            <XAxis dataKey="time" stroke="#1e293b" fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} />
            <YAxis stroke="#1e293b" fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgba(6,8,13,0.95)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10, fontSize: 11, fontFamily: "JetBrains Mono", color: "#e2e8f0" }} labelStyle={{ color: "#64748b" }} />
            <ReferenceLine y={100} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" />
            <ReferenceLine y={200} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} fill="url(#qGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <Activity size={24} color="#1e293b" style={{ marginBottom: 8 }} />
            <p style={{ color: "#334155", fontSize: 12 }}>Waiting for AI detection data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
