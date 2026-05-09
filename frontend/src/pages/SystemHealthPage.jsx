import { useState, useEffect, useCallback } from "react";
import {
  Server, Database, Bell, BarChart3, Activity, Shield, Zap,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader,
} from "lucide-react";
import { FONT, MONO, C } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import { fetchHealthDetails } from "../services/api";
import { useI18n } from "../context/I18nContext";

const STATUS_META = {
  online:    { color: "#10b981", label: "ONLINE",    Icon: CheckCircle2 },
  available: { color: "#10b981", label: "AVAILABLE", Icon: CheckCircle2 },
  ok:        { color: "#10b981", label: "OK",        Icon: CheckCircle2 },
  warning:   { color: "#f59e0b", label: "WARNING",   Icon: AlertTriangle },
  degraded:  { color: "#f59e0b", label: "DEGRADED",  Icon: AlertTriangle },
  demo_mode: { color: "#7dd3fc", label: "DEMO MODE", Icon: Activity },
  unknown:   { color: "#64748b", label: "UNKNOWN",   Icon: AlertTriangle },
  offline:   { color: "#ef4444", label: "OFFLINE",   Icon: XCircle },
  missing_or_default: { color: "#ef4444", label: "WEAK",  Icon: XCircle },
  weak:      { color: "#f59e0b", label: "WEAK",      Icon: AlertTriangle },
  strong:    { color: "#10b981", label: "STRONG",    Icon: CheckCircle2 },
};

const COMPONENT_META = {
  api:        { Icon: Server,    label: "FastAPI Server" },
  database:   { Icon: Database,  label: "MongoDB" },
  reports:    { Icon: BarChart3, label: "Reports Service" },
  websockets: { Icon: Bell,      label: "WebSocket Manager" },
  ai_module:  { Icon: Zap,       label: "AI Module" },
};

export default function SystemHealthPage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await fetchHealthDetails();
      setData(d);
      setLastChecked(new Date());
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);  // auto-refresh every 30s
    return () => clearInterval(id);
  }, [refresh]);

  const overall = data?.status || "unknown";
  const overallMeta = STATUS_META[overall] || STATUS_META.unknown;

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader title={t("health.title")} subtitle={t("health.subtitle")}>
        <button onClick={refresh} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8, border: "none", cursor: loading ? "wait" : "pointer",
          background: "rgba(56,189,248,0.1)", color: "#38bdf8",
          fontSize: 11, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.05em",
        }}>
          {loading ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />}
          REFRESH
        </button>
      </PageHeader>

      <div style={{ padding: "20px 32px" }}>
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171", fontSize: 13 }}>
            Failed to fetch health details: {error}
          </div>
        )}

        {/* Overall banner */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "20px 24px", borderRadius: 14, marginBottom: 22,
          background: `${overallMeta.color}10`,
          border: `1px solid ${overallMeta.color}40`,
        }}>
          <overallMeta.Icon size={24} color={overallMeta.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: MONO, color: overallMeta.color,
              letterSpacing: "0.08em", fontWeight: 700 }}>
              SYSTEM STATUS · {overallMeta.label}
            </div>
            <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 2 }}>
              {overall === "ok" && "All components are operational."}
              {overall === "degraded" && "One or more components require attention."}
            </div>
          </div>
          {lastChecked && (
            <div style={{ fontSize: 10, fontFamily: MONO, color: "#475569", textAlign: "right" }}>
              Last checked<br />
              <span style={{ color: "#94a3b8" }}>{lastChecked.toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Components grid */}
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 12px",
          fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Components
        </h3>
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12, marginBottom: 28 }}>
          {Object.entries(data?.components || {}).map(([key, val]) => {
            const meta = COMPONENT_META[key] || { Icon: Activity, label: key };
            const status = (val && val.status) || "unknown";
            const sm = STATUS_META[status] || STATUS_META.unknown;
            return (
              <div key={key} style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8,
                    background: `${sm.color}10`, display: "flex",
                    alignItems: "center", justifyContent: "center", border: `1px solid ${sm.color}30` }}>
                    <meta.Icon size={14} color={sm.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
                    <div style={{ fontSize: 9, fontFamily: MONO, color: sm.color,
                      letterSpacing: "0.08em", fontWeight: 700 }}>{sm.label}</div>
                  </div>
                  <sm.Icon size={14} color={sm.color} />
                </div>
                {val?.error && (
                  <p style={{ color: "#fb923c", fontSize: 11, margin: 0, lineHeight: 1.4,
                    fontFamily: MONO }}>{val.error}</p>
                )}
                {val?.note && (
                  <p style={{ color: "#64748b", fontSize: 11, margin: 0, lineHeight: 1.4 }}>{val.note}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Configuration */}
        {data?.configuration && (
          <>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: "0 0 12px",
              fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Configuration
            </h3>
            <div style={{ padding: "16px 18px", borderRadius: 12,
              background: "rgba(15,23,42,0.3)", border: `1px solid ${C.border}` }}>
              <ConfigRow label="MongoDB connection" ok={data.configuration.mongo_configured} />
              <ConfigRow label="Database name" ok={data.configuration.db_name_configured} />
              <ConfigRow label="JWT secret strength"
                value={data.configuration.jwt_secret_strength}
                ok={["ok","strong"].includes(data.configuration.jwt_secret_strength)} />
              <ConfigRow label="CORS origins"
                value={`${data.configuration.cors_origins_count} configured`}
                ok={data.configuration.cors_origins_configured} />
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function ConfigRow({ label, value, ok }) {
  const meta = ok ? STATUS_META.ok : STATUS_META.warning;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
      borderBottom: `1px solid rgba(56,189,248,0.04)` }}>
      <Shield size={12} color={meta.color} />
      <div style={{ flex: 1, color: "#cbd5e1", fontSize: 13 }}>{label}</div>
      {value && <span style={{ fontSize: 10, fontFamily: MONO, color: "#94a3b8" }}>{value}</span>}
      <meta.Icon size={14} color={meta.color} />
    </div>
  );
}
