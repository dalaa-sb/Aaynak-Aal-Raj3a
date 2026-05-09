import { useState, useMemo } from "react";
import {
  Bell, ShieldCheck, Filter, Trash2, XCircle,
  AlertCircle, CheckCircle2, Loader,
} from "lucide-react";
import { MONO, FONT, C } from "../../services/config";
import AlertItem from "./AlertItem";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";
import { bulkDismissAlerts, bulkDeleteAlerts } from "../../services/api";

/**
 * Simplified status workflow per project policy.
 *
 * Filter chips visible in the UI:           ["all", "acknowledged", "resolved", "dismissed"]
 * Action buttons available per alert:       [acknowledge, resolve, dismiss]
 *
 * Backend may still hold legacy "new" / "active" / "investigating" rows.
 * Display rule: "investigating" rows are folded into the "acknowledged" filter
 * so they remain visible. "new" / "active" rows show only under "all".
 */
const STATUS_KEYS = ["all", "acknowledged", "resolved", "dismissed"];
const STATUS_COLORS = {
  all:          "#94a3b8",
  acknowledged: "#7dd3fc",
  resolved:     "#34d399",
  dismissed:    "#64748b",
};

const SEVERITY_KEYS   = ["all", "critical", "high", "medium", "low"];
const SEVERITY_COLORS = {
  all: "#94a3b8", critical: "#f87171", high: "#fb923c",
  medium: "#fbbf24", low: "#34d399",
};

export default function AlertFeed({ alerts, onUpdated, onBulkChange, limit = 50 }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();

  const [statusFilter,   setStatusFilter]   = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Bulk-action state
  const [busy, setBusy]       = useState(null);    // "dismiss" | "delete" | null
  const [confirm, setConfirm] = useState(null);    // "dismiss" | "delete" | null
  const [bulkMsg, setBulkMsg] = useState(null);    // {type, text}

  const filtered = useMemo(() => {
    return (alerts || []).filter((a) => {
      const raw = a.status || (a.acknowledged ? "acknowledged" : "new");

      // Display mapping for the simplified workflow:
      //  - legacy "investigating" → folded under "acknowledged" filter
      //  - legacy "new" / "active" → only visible under "all"
      let display = raw;
      if (raw === "investigating") display = "acknowledged";

      if (statusFilter !== "all" && display !== statusFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, severityFilter]);

  const totalVisible = filtered.length;

  const runBulk = async (action) => {
    setBusy(action);
    setBulkMsg(null);
    try {
      const res = action === "dismiss"
        ? await bulkDismissAlerts({ status: statusFilter, severity: severityFilter })
        : await bulkDeleteAlerts ({ status: statusFilter, severity: severityFilter });

      const count = res?.affected ?? 0;
      setBulkMsg({
        type: "ok",
        text: action === "dismiss"
          ? t("alerts.bulk.dismissedN", { count })
          : t("alerts.bulk.deletedN",   { count }),
      });
      if (onBulkChange) onBulkChange();
    } catch (e) {
      setBulkMsg({ type: "err", text: e?.message || t("alerts.bulk.failed") });
    } finally {
      setBusy(null);
      setConfirm(null);
      setTimeout(() => setBulkMsg(null), 4500);
    }
  };

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16,
      background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: 0,
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <Bell size={13} color="#38bdf8" /> {t("alerts.feed")}
        </h3>
        <span style={{ fontSize: 9, fontFamily: MONO, color: "#64748b", letterSpacing: "0.05em" }}>
          {t("alerts.showing", { count: totalVisible })}
        </span>
      </div>

      {/* Status filter chips — simplified workflow */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={11} color="#475569" style={{ marginRight: 2 }} />
        <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569",
          letterSpacing: "0.06em", marginRight: 4, textTransform: "uppercase" }}>
          {t("alerts.filterStatus")}
        </span>
        {STATUS_KEYS.map((k) => {
          const color = STATUS_COLORS[k];
          const active = statusFilter === k;
          return (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "3px 9px", borderRadius: 6, border: "none", cursor: "pointer",
              background: active ? `${color}15` : "transparent",
              color: active ? color : "#475569",
              fontSize: 9, fontFamily: MONO, fontWeight: 600,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{t(`alerts.status.${k}`)}</button>
          );
        })}
      </div>

      {/* Severity filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569",
          letterSpacing: "0.06em", marginRight: 4, marginLeft: 17, textTransform: "uppercase" }}>
          {t("alerts.filterSeverity")}
        </span>
        {SEVERITY_KEYS.map((k) => {
          const color = SEVERITY_COLORS[k];
          const active = severityFilter === k;
          const labelKey = k === "all" ? "alerts.status.all" : `alerts.severity.${k}`;
          return (
            <button key={k} onClick={() => setSeverityFilter(k)} style={{
              padding: "3px 9px", borderRadius: 6, border: "none", cursor: "pointer",
              background: active ? `${color}15` : "transparent",
              color: active ? color : "#475569",
              fontSize: 9, fontFamily: MONO, fontWeight: 600,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{t(labelKey)}</button>
          );
        })}
      </div>

      {/* Bulk action toolbar — admin only.
         The buttons act on whatever is currently filtered. We use clear labels
         ("Dismiss filtered", "Delete filtered") so users always know the scope. */}
      {isAdmin && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setConfirm("dismiss")}
            disabled={busy !== null || totalVisible === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid rgba(100,116,139,0.25)",
              background: "rgba(100,116,139,0.08)", color: "#94a3b8",
              fontSize: 10, fontFamily: MONO, fontWeight: 600,
              cursor: (busy !== null || totalVisible === 0) ? "not-allowed" : "pointer",
              opacity: (busy !== null || totalVisible === 0) ? 0.5 : 1,
            }}>
            <XCircle size={11} /> {t("alerts.bulk.dismissFiltered")}
          </button>

          <button
            onClick={() => setConfirm("delete")}
            disabled={busy !== null || totalVisible === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.25)",
              background: "rgba(239,68,68,0.08)", color: "#f87171",
              fontSize: 10, fontFamily: MONO, fontWeight: 600,
              cursor: (busy !== null || totalVisible === 0) ? "not-allowed" : "pointer",
              opacity: (busy !== null || totalVisible === 0) ? 0.5 : 1,
            }}>
            <Trash2 size={11} /> {t("alerts.bulk.deleteFiltered")}
          </button>
        </div>
      )}

      {/* Result banner */}
      {bulkMsg && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6, fontSize: 11,
          background: bulkMsg.type === "ok" ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          border: bulkMsg.type === "ok" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)",
          color:  bulkMsg.type === "ok" ? "#34d399" : "#f87171",
        }}>
          {bulkMsg.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {bulkMsg.text}
        </div>
      )}

      {/* Confirmation overlay */}
      {confirm && (
        <ConfirmDialog
          action={confirm}
          count={totalVisible}
          busy={busy === confirm}
          onConfirm={() => runBulk(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Alert list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6,
        maxHeight: 600, overflowY: "auto", paddingRight: 4 }}>
        {filtered.slice(0, limit).map((a, i) =>
          <AlertItem key={a.id || i} alert={a} onUpdated={onUpdated} />
        )}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <ShieldCheck size={28} color="#1e293b" style={{ margin: "0 auto 8px" }} />
            <p style={{ color: "#334155", fontSize: 12, fontFamily: FONT }}>
              {(alerts || []).length === 0 ? t("alerts.noAlerts") : t("alerts.noMatches")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


function ConfirmDialog({ action, count, busy, onConfirm, onCancel }) {
  const { t } = useI18n();
  const isDelete = action === "delete";

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 420,
        padding: "24px 26px", borderRadius: 14,
        background: "rgba(11,20,38,0.97)",
        border: `1px solid ${isDelete ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.3)"}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        fontFamily: FONT,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {isDelete
            ? <Trash2 size={18} color="#f87171" />
            : <XCircle size={18} color="#94a3b8" />}
          <h3 style={{ margin: 0, color: "#f0f9ff", fontSize: 16 }}>
            {isDelete ? t("alerts.bulk.deleteConfirmTitle")
                      : t("alerts.bulk.dismissConfirmTitle")}
          </h3>
        </div>

        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
          {isDelete
            ? t("alerts.bulk.deleteConfirmBody",  { count })
            : t("alerts.bulk.dismissConfirmBody", { count })}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: "9px 16px", borderRadius: 8, cursor: busy ? "not-allowed" : "pointer",
            background: "transparent", color: "#94a3b8",
            border: `1px solid ${C.border}`,
            fontSize: 12, fontFamily: FONT, opacity: busy ? 0.5 : 1,
          }}>{t("common.cancel")}</button>

          <button onClick={onConfirm} disabled={busy} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 8, border: "none",
            cursor: busy ? "wait" : "pointer",
            background: isDelete
              ? "linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)"
              : "linear-gradient(90deg, #475569 0%, #64748b 100%)",
            color: "#fff", fontSize: 12, fontFamily: FONT, fontWeight: 600,
            opacity: busy ? 0.7 : 1,
          }}>
            {busy && <Loader size={12} className="spin" />}
            {isDelete ? t("alerts.bulk.confirmDelete")
                      : t("alerts.bulk.confirmDismiss")}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
      </div>
    </div>
  );
}
