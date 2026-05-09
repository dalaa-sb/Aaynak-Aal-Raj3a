import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { History } from "lucide-react";
import { MONO } from "../../services/config";

const ZC = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f97316"];

export default function HistoricalAnalysis({ zones, alerts }) {
  const zd = useMemo(() => (zones || []).map((z, i) => ({
    name: z.zone?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    occupancy: z.current_occupancy || 0, color: ZC[i % ZC.length],
  })), [zones]);

  const ad = useMemo(() => {
    const counts = {};
    (alerts || []).forEach((a) => { if (a.zone) counts[a.zone] = (counts[a.zone] || 0) + 1; });
    return (zones || []).map((z, i) => ({
      name: z.zone?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      alerts: counts[z.zone] || 0, color: ZC[i % ZC.length],
    }));
  }, [alerts, zones]);

  const tt = { background: "rgba(6,8,13,0.95)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono", color: "#e2e8f0" };

  if (!zones || zones.length === 0) return null;

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <History size={13} color="#38bdf8" /> Historical Analysis
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontFamily: MONO, color: "#64748b", marginBottom: 8, letterSpacing: "0.05em" }}>CURRENT OCCUPANCY</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={zd} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" />
              <XAxis dataKey="name" fontSize={8} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} angle={-20} textAnchor="end" height={50} />
              <YAxis fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} allowDecimals={false} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>{zd.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.7} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p style={{ fontSize: 10, fontFamily: MONO, color: "#64748b", marginBottom: 8, letterSpacing: "0.05em" }}>ALERTS BY ZONE</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ad} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.04)" />
              <XAxis dataKey="name" fontSize={8} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} angle={-20} textAnchor="end" height={50} />
              <YAxis fontSize={9} fontFamily="JetBrains Mono" tick={{ fill: "#475569" }} allowDecimals={false} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="alerts" radius={[4, 4, 0, 0]}>{ad.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.5} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
