import { MapPin } from "lucide-react";
import { MONO } from "../../services/config";
import ZoneCard from "./ZoneCard";

export default function ZonePanel({ zones }) {
  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <MapPin size={13} color="#38bdf8" /> Zone status
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(zones || []).map((z, i) => <ZoneCard key={i} zone={z} />)}
        {(!zones || zones.length === 0) && <p style={{ color: "#334155", fontSize: 12, textAlign: "center", padding: 24 }}>Waiting for zone data...</p>}
      </div>
    </div>
  );
}
