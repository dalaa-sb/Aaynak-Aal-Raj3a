import { useState, useEffect, useCallback } from "react";
import { ScrollText, Filter, RefreshCw, Loader, Search, Calendar, User, Globe } from "lucide-react";
import { FONT, MONO, C } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import { fetchAuditLogs, fetchAuditActions } from "../services/api";
import { useI18n } from "../context/I18nContext";

// Action -> display color and short label
const ACTION_META = {
  "user.login.success":         { color: "#34d399", short: "LOGIN OK" },
  "user.login.failure":         { color: "#f87171", short: "LOGIN FAIL" },
  "user.signup":                { color: "#7dd3fc", short: "SIGNUP" },
  "user.email_verify":          { color: "#34d399", short: "EMAIL OK" },
  "user.id_verify":             { color: "#34d399", short: "ID OK" },
  "user.deleted":               { color: "#f87171", short: "DELETED" },
  "user.password_reset_issued": { color: "#fbbf24", short: "RESET ISSUED" },
  "user.password_reset_used":   { color: "#34d399", short: "RESET USED" },
  "alert.created":              { color: "#fb923c", short: "ALERT NEW" },
  "alert.status_changed":       { color: "#7dd3fc", short: "STATUS" },
  "suspicious_report.filed":    { color: "#a78bfa", short: "SUSPICIOUS" },
  "report.generated":           { color: "#a78bfa", short: "REPORT GEN" },
  "report.downloaded":          { color: "#7dd3fc", short: "PDF DL" },
  "report.deleted":             { color: "#f87171", short: "REPORT DEL" },
  "settings.changed":           { color: "#fbbf24", short: "SETTINGS" },
};

export default function AuditLogPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionsList, setActionsList] = useState([]);

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [limit, setLimit] = useState(200);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await fetchAuditLogs({
        action: filterAction || undefined,
        actor: filterActor.trim().toLowerCase() || undefined,
        target_type: filterTarget || undefined,
        limit,
      });
      setLogs(data);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [filterAction, filterActor, filterTarget, limit]);

  useEffect(() => {
    fetchAuditActions().then((d) => setActionsList(d?.actions || [])).catch(() => {});
    refresh();
  }, [refresh]);

  const ss = {
    padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: FONT,
    border: `1px solid ${C.border}`, background: "rgba(15,23,42,0.6)",
    color: C.text, outline: "none",
  };

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")}>
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
          <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap",
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(15,23,42,0.3)", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569" }}>
            <Filter size={12} /> <span style={{ fontSize: 10, fontFamily: MONO, letterSpacing: "0.08em" }}>FILTERS</span>
          </div>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={ss}>
            <option value="">All actions</option>
            {actionsList.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input placeholder="Actor (username)" value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)} maxLength={64} style={{ ...ss, width: 180 }} />
          <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} style={ss}>
            <option value="">Any target type</option>
            <option value="user">user</option>
            <option value="alert">alert</option>
            <option value="report">report</option>
            <option value="suspicious_report">suspicious_report</option>
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={ss}>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
            <option value={500}>500 rows</option>
            <option value={1000}>1000 rows</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 50, gap: 8, color: "#475569" }}>
            <Loader size={14} className="spin" /> <span style={{ fontSize: 12 }}>Loading audit logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 16,
            background: "rgba(15,23,42,0.2)", border: `1px dashed ${C.border}` }}>
            <ScrollText size={32} color="#334155" style={{ marginBottom: 10 }} />
            <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>No audit events match your filters</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {logs.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function LogRow({ log }) {
  const meta = ACTION_META[log.action] || { color: "#64748b", short: "ACTION" };
  const when = log.created_at ? new Date(log.created_at) : null;
  const [showMeta, setShowMeta] = useState(false);

  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${meta.color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700,
          color: meta.color, letterSpacing: "0.08em",
          padding: "2px 8px", borderRadius: 4,
          background: `${meta.color}10`, border: `1px solid ${meta.color}25`,
          minWidth: 90, textAlign: "center" }}>
          {meta.short}
        </span>
        <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: MONO }}>
          {log.action}
        </span>
        <div style={{ flex: 1 }} />
        {log.actor_username && (
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#7dd3fc",
            display: "inline-flex", alignItems: "center", gap: 4 }}>
            <User size={10} /> {log.actor_username}
            {log.actor_role && <span style={{ color: "#475569" }}> ({log.actor_role})</span>}
          </span>
        )}
        {log.target_type && log.target_id && (
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#a78bfa" }}>
            → {log.target_type}:{log.target_id.slice(0, 16)}{log.target_id.length > 16 ? "…" : ""}
          </span>
        )}
        {when && (
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#475569",
            display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Calendar size={10} /> {when.toLocaleString()}
          </span>
        )}
        {log.metadata && (
          <button onClick={() => setShowMeta(!showMeta)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: showMeta ? "#7dd3fc" : "#475569",
            fontSize: 10, fontFamily: MONO, padding: "2px 6px",
          }}>
            {showMeta ? "− META" : "+ META"}
          </button>
        )}
      </div>
      {showMeta && log.metadata && (
        <pre style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6,
          background: "rgba(8,12,22,0.7)", border: `1px solid ${C.border}`,
          fontSize: 10, fontFamily: MONO, color: "#94a3b8",
          overflow: "auto", lineHeight: 1.5 }}>
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
      {log.ip_address && (
        <div style={{ marginTop: 4, fontSize: 9, fontFamily: MONO, color: "#475569",
          display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Globe size={9} /> {log.ip_address}
        </div>
      )}
    </div>
  );
}
