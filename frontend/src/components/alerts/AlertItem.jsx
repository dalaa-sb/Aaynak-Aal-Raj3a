import { useState } from "react";
import { Eye, Search, CheckCircle2, XCircle, Loader, History } from "lucide-react";
import { SEV, MONO, FONT, C } from "../../services/config";
import { updateAlertStatus } from "../../services/api";
import { useI18n } from "../../context/I18nContext";

// STATUS_META keeps an "investigating" entry purely for legacy display
// (alerts already in that state show their badge correctly), but the user
// can no longer transition TO it — the simplified workflow is
// new/acknowledged → resolved | dismissed.
const STATUS_META = {
  new:           { color: "#fb923c", Icon: null },
  acknowledged:  { color: "#7dd3fc", Icon: Eye },
  investigating: { color: "#a78bfa", Icon: Search },
  resolved:      { color: "#34d399", Icon: CheckCircle2 },
  dismissed:     { color: "#64748b", Icon: XCircle },
};

// Each transition: [target_status, action_key]. Action keys map to i18n entries.
// "investigate" action removed per simplified workflow. Legacy "investigating"
// rows can still transition to resolved/dismissed.
const NEXT_TRANSITIONS = {
  new:           [["acknowledged", "acknowledge"], ["dismissed", "dismiss"]],
  acknowledged:  [["resolved", "resolve"], ["dismissed", "dismiss"]],
  investigating: [["resolved", "resolve"], ["dismissed", "dismiss"]],
  resolved:      [],
  dismissed:     [],
};


export default function AlertItem({ alert, onUpdated }) {
  const { t } = useI18n();
  const s = SEV[alert.severity] || SEV.low;
  const status = alert.status || (alert.acknowledged ? "acknowledged" : "new");
  const sm = STATUS_META[status] || STATUS_META.new;
  const transitions = NEXT_TRANSITIONS[status] || [];

  const ts = alert.created_at ? new Date(alert.created_at) : null;
  const time = ts ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const date = ts ? ts.toLocaleDateString([], { month: "short", day: "numeric" }) : "";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null);  // status name when prompting for notes
  const [notesInput, setNotesInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const isTerminal = status === "resolved" || status === "dismissed";

  const handleTransition = async (newStatus, withNotes = false) => {
    if (withNotes && !notesInput.trim() && (newStatus === "resolved" || newStatus === "dismissed")) {
      setShowNoteFor(newStatus);
      return;
    }
    setBusy(true); setError("");
    try {
      const updated = await updateAlertStatus(alert.id, newStatus, notesInput.trim() || null);
      setShowNoteFor(null);
      setNotesInput("");
      if (onUpdated) onUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: s.bg, border: `1px solid ${s.border}`,
      borderLeft: `3px solid ${sm.color}`,
      opacity: isTerminal ? 0.6 : 1, transition: "all 0.3s",
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: s.color, fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: "0.05em" }}>
                {alert.alert_type?.replace(/_/g, " ").toUpperCase()}
              </span>
              <span style={{
                fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.06em",
                color: sm.color, padding: "1px 7px", borderRadius: 4,
                background: `${sm.color}15`, border: `1px solid ${sm.color}30`,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                {sm.Icon && <sm.Icon size={9} />} {t(`alerts.status.${status}`).toUpperCase()}
              </span>
            </div>
            <span style={{ color: "#334155", fontSize: 9, fontFamily: MONO }}>
              {date} · {time}
            </span>
          </div>

          <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0", lineHeight: 1.4 }}>{alert.message}</p>

          {alert.resolution_notes && isTerminal && (
            <p style={{ color: "#64748b", fontSize: 11, margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.4 }}>
              Note: {alert.resolution_notes}
            </p>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#475569", fontSize: 9, fontFamily: MONO }}>
              {alert.camera_id} · {alert.zone?.replace(/_/g, " ")}
            </span>
            {alert.value != null && (
              <span style={{ fontSize: 9, fontFamily: MONO, color: s.color, fontWeight: 600,
                padding: "1px 5px", borderRadius: 4, background: `${s.color}10` }}>
                {Math.round(alert.value)}
              </span>
            )}
            {alert.status_history?.length > 1 && (
              <button onClick={() => setShowHistory(!showHistory)} style={{
                padding: "2px 7px", borderRadius: 5, border: `1px solid ${C.border}`,
                background: "transparent", color: showHistory ? "#7dd3fc" : "#475569",
                fontSize: 9, cursor: "pointer", fontFamily: MONO, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                <History size={9} /> {showHistory ? t("alerts.actions.hide").toUpperCase() : t("alerts.actions.trail").toUpperCase()}
              </button>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
              {transitions.map(([next, actionKey]) => (
                <button key={next} onClick={() => handleTransition(next, next === "resolved" || next === "dismissed")}
                  disabled={busy}
                  style={{
                    padding: "2px 8px", borderRadius: 5,
                    border: `1px solid ${STATUS_META[next].color}40`,
                    background: "transparent", color: STATUS_META[next].color,
                    fontSize: 9, cursor: busy ? "wait" : "pointer", fontWeight: 600, fontFamily: MONO,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = `${STATUS_META[next].color}15`}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  {busy ? "..." : t(`alerts.actions.${actionKey}`).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: "#f87171", fontSize: 10, marginTop: 6, fontFamily: MONO }}>
              {error}
            </div>
          )}

          {showNoteFor && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 8,
              background: "rgba(8,12,22,0.6)", border: `1px solid ${C.border}` }}>
              <input
                placeholder={t("alerts.noteFor", { status: t(`alerts.status.${showNoteFor}`) })}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTransition(showNoteFor)}
                maxLength={500}
                autoFocus
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 6,
                  border: `1px solid ${C.border}`, background: "rgba(15,23,42,0.6)",
                  color: C.text, fontSize: 12, fontFamily: FONT, outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => handleTransition(showNoteFor)} disabled={busy} style={{
                  padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: STATUS_META[showNoteFor].color, color: "#0a0f1a",
                  fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: "0.05em",
                }}>{t("common.confirm").toUpperCase()}</button>
                <button onClick={() => { setShowNoteFor(null); setNotesInput(""); }} style={{
                  padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${C.border}`, background: "transparent",
                  color: "#94a3b8", fontSize: 10, fontFamily: MONO, cursor: "pointer",
                }}>{t("common.cancel").toUpperCase()}</button>
              </div>
            </div>
          )}

          {showHistory && alert.status_history && (
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6,
              background: "rgba(8,12,22,0.6)", border: `1px solid ${C.border}` }}>
              {alert.status_history.map((h, i) => {
                const hm = STATUS_META[h.status] || STATUS_META.new;
                const ht = h.at ? new Date(h.at).toLocaleString() : "-";
                return (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: 10, fontFamily: MONO }}>
                    <span style={{ color: hm.color, fontWeight: 700, minWidth: 100 }}>{t(`alerts.status.${h.status}`).toUpperCase()}</span>
                    <span style={{ color: "#94a3b8" }}>by {h.by}</span>
                    <span style={{ color: "#475569", marginLeft: "auto" }}>{ht}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
