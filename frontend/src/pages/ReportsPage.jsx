import { useState, useEffect, useCallback } from "react";
import {
  FileText, Download, Calendar, Sparkles, Eye, Trash2, ShieldAlert,
  X, Clock, BarChart3, Zap, AlertOctagon, Loader,
} from "lucide-react";
import { FONT, MONO, ARABIC, C } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import {
  fetchReports, generateReport, getReport, deleteReport,
  downloadReportPdf, fetchSuspiciousReports,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

const REPORT_TYPES = [
  { value: "daily",   labelKey: "reports.aiAssistant.generateDaily",   hours: 24 },
  { value: "weekly",  labelKey: "reports.aiAssistant.generateWeekly",  hours: 168 },
  { value: "monthly", labelKey: "reports.aiAssistant.generateMonthly", hours: 720 },
];

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [reports, setReports] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("generated");  // generated | suspicious
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [viewing, setViewing] = useState(null);  // full report doc
  const [downloadingId, setDownloadingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rep, susp] = await Promise.all([
        fetchReports().catch(() => []),
        fetchSuspiciousReports().catch(() => []),
      ]);
      setReports(rep);
      setSuspicious(susp);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const generate = async (type) => {
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const doc = await generateReport(type);
      setOkMsg(`AI generated: "${doc.title}". You can now download it as PDF.`);
      setTimeout(() => setOkMsg(""), 5000);
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const view = async (id) => {
    try { setViewing(await getReport(id)); }
    catch (e) { setError(e.message); }
  };

  const download = async (id, title) => {
    setDownloadingId(id);
    try {
      const safe = (title || `report-${id}`).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
      await downloadReportPdf(id, `${safe}.pdf`);
    } catch (e) { setError(e.message); }
    finally { setDownloadingId(null); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    try { await deleteReport(id); await refresh(); }
    catch (e) { setError(e.message); }
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.report_type === filter);

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")}>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "generated",  label: t("reports.tabs.generated") },
            { k: "suspicious", label: t("reports.tabs.suspicious") },
          ].map((tabItem) => (
            <button
              key={tabItem.k}
              onClick={() => setTab(tabItem.k)}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: tab === tabItem.k ? "rgba(56,189,248,0.1)" : "transparent",
                color: tab === tabItem.k ? "#38bdf8" : "#475569",
                fontSize: 10, fontWeight: 600, fontFamily: MONO,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}
            >{tabItem.label}</button>
          ))}
        </div>
      </PageHeader>

      <div style={{ padding: "20px 32px" }}>
        {error && <Banner type="error">{error}</Banner>}
        {okMsg && <Banner type="ok">{okMsg}</Banner>}

        {/* AI Generate panel — admin only, only shows on generated tab */}
        {tab === "generated" && isAdmin && (
          <div style={{
            padding: "18px 22px", borderRadius: 14, marginBottom: 18,
            background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(56,189,248,0.04))",
            border: "1px solid rgba(139,92,246,0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Sparkles size={16} color="#a78bfa" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd",
                fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t("reports.aiAssistant.title")}
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
              {t("reports.aiAssistant.description")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => generate(rt.value)}
                  disabled={busy}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 16px", borderRadius: 10, border: "none",
                    cursor: busy ? "wait" : "pointer", fontFamily: FONT,
                    background: "linear-gradient(90deg, #8b5cf6 0%, #5b9cd0 100%)",
                    color: "#fff", fontSize: 12, fontWeight: 600,
                    opacity: busy ? 0.6 : 1, transition: "all 0.2s",
                    boxShadow: "0 4px 14px rgba(139,92,246,0.25)",
                  }}
                >
                  {busy ? <Loader size={13} className="spin" /> : <Zap size={13} />}
                  {t(rt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter chips for generated tab */}
        {tab === "generated" && reports.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {["all", "daily", "weekly", "monthly", "custom"].map((x) => (
              <button key={x} onClick={() => setFilter(x)} style={{
                padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: filter === x ? "rgba(56,189,248,0.1)" : "transparent",
                color: filter === x ? "#38bdf8" : "#475569",
                fontSize: 10, fontWeight: 600, fontFamily: MONO,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{x}</button>
            ))}
          </div>
        )}

        {/* Generated reports list */}
        {tab === "generated" && (
          loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("reports.noReports")}
              text={isAdmin
                ? t("reports.noReportsAdmin")
                : t("reports.noReportsUser")}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((r) => (
                <ReportRow
                  key={r.id} report={r} isAdmin={isAdmin}
                  onView={() => view(r.id)}
                  onDownload={() => download(r.id, r.title)}
                  onDelete={() => remove(r.id)}
                  downloading={downloadingId === r.id}
                />
              ))}
            </div>
          )
        )}

        {/* Suspicious activity list */}
        {tab === "suspicious" && (
          loading ? (
            <Loading />
          ) : suspicious.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t("reports.noSuspicious")}
              text={t("reports.noSuspiciousHint")}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suspicious.map((s) => <SuspiciousRow key={s.id} item={s} />)}
            </div>
          )
        )}
      </div>

      {viewing && <ReportViewer report={viewing} onClose={() => setViewing(null)} onDownload={() => download(viewing.id, viewing.title)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function Banner({ type, children }) {
  const style = type === "error"
    ? { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)", color: "#f87171" }
    : { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)", color: "#34d399" };
  return (
    <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14,
      background: style.bg, border: `1px solid ${style.border}`,
      color: style.color, fontSize: 12 }}>{children}</div>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 50, gap: 8, color: "#475569" }}>
      <Loader size={14} className="spin" /> <span style={{ fontSize: 12 }}>Loading…</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 16,
      background: "rgba(15,23,42,0.2)", border: `1px dashed ${C.border}` }}>
      <Icon size={32} color="#334155" style={{ marginBottom: 12 }} />
      <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</p>
      <p style={{ color: "#475569", fontSize: 12, margin: "6px 0 0", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function ReportRow({ report, isAdmin, onView, onDownload, onDelete, downloading }) {
  const { t } = useI18n();
  const created = report.created_at ? new Date(report.created_at).toLocaleString() : "-";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", borderRadius: 12,
      background: "rgba(15,23,42,0.3)", border: `1px solid ${C.border}`,
      transition: "all 0.2s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10,
        background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Sparkles size={15} color="#a78bfa" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, margin: 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{report.title}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#475569",
            display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Calendar size={10} /> {created}
          </span>
          <span style={{ fontSize: 9, fontFamily: MONO, textTransform: "uppercase",
            letterSpacing: "0.05em", color: "#a78bfa", padding: "1px 6px",
            borderRadius: 4, background: "rgba(139,92,246,0.06)" }}>
            {report.report_type}
          </span>
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#475569" }}>
            by {report.generated_by}
          </span>
        </div>
      </div>
      <button onClick={onView} title={t("reports.actions.preview")} style={iconBtn}>
        <Eye size={12} /> {t("reports.actions.preview")}
      </button>
      <button onClick={onDownload} disabled={downloading} title={t("reports.actions.downloadPdf")}
        style={{ ...iconBtn, color: "#38bdf8", borderColor: "rgba(56,189,248,0.2)" }}>
        {downloading ? <Loader size={12} className="spin" /> : <Download size={12} />}
        {downloading ? "..." : "PDF"}
      </button>
      {isAdmin && (
        <button onClick={onDelete} title={t("reports.actions.delete")} style={{ ...iconBtn, padding: "6px 8px" }}>
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function SuspiciousRow({ item }) {
  const created = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
  const sevColor = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#10b981" }[item.severity] || "#64748b";

  return (
    <div style={{
      padding: "12px 16px", borderRadius: 12,
      background: "rgba(15,23,42,0.3)", border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${sevColor}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, margin: 0,
            fontFamily: ARABIC, direction: "rtl", textAlign: "right" }}>
            {item.activity_type}
          </p>
          {item.notes && (
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0", lineHeight: 1.5 }}>
              {item.notes}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <Pill icon={Calendar}>{created}</Pill>
            <Pill>{item.zone?.replace(/_/g, " ")}</Pill>
            <Pill>{item.camera_id}</Pill>
            <Pill>by {item.reported_by}</Pill>
            <span style={{ fontSize: 9, fontFamily: MONO, textTransform: "uppercase",
              letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 4,
              color: sevColor, background: `${sevColor}10`, border: `1px solid ${sevColor}30` }}>
              {item.severity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children }) {
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, color: "#475569",
      display: "inline-flex", alignItems: "center", gap: 4 }}>
      {Icon && <Icon size={10} />}
      {children}
    </span>
  );
}

function ReportViewer({ report, onClose, onDownload }) {
  const period_from = report.period_from ? new Date(report.period_from).toLocaleString() : "-";
  const period_to = report.period_to ? new Date(report.period_to).toLocaleString() : "-";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)", zIndex: 200, padding: 20,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 740, maxHeight: "90vh", overflowY: "auto",
        padding: "28px 30px", borderRadius: 14,
        background: "rgba(11,20,38,0.97)", border: "1px solid rgba(56,189,248,0.2)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, background: "none",
          border: "none", cursor: "pointer", padding: 4, color: "#64748b",
        }}><X size={18} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Sparkles size={14} color="#a78bfa" />
          <span style={{ fontSize: 10, fontFamily: MONO, color: "#a78bfa",
            letterSpacing: "0.08em", textTransform: "uppercase" }}>AI-Generated Report</span>
        </div>
        <h2 style={{ color: "#f0f9ff", fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
          {report.title}
        </h2>

        <div style={{ display: "flex", gap: 16, fontSize: 11, fontFamily: MONO, color: "#64748b", marginBottom: 18, flexWrap: "wrap" }}>
          <span><Clock size={10} style={{ verticalAlign: "middle" }} /> Period: {period_from} → {period_to}</span>
          <span>by {report.generated_by}</span>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 10,
          background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.1)",
          marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontFamily: MONO, color: "#7dd3fc",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Executive Summary
          </div>
          <p style={{ color: "#cbd5e1", fontSize: 13, margin: 0, lineHeight: 1.65 }}>
            {report.summary}
          </p>
        </div>

        {report.sections?.map((sec, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <h3 style={{ color: "#a78bfa", fontSize: 13, fontWeight: 600,
              margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart3 size={13} />
              {sec.heading}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>{sec.content}</p>
            {sec.data && <SectionData data={sec.data} />}
          </div>
        ))}

        <button onClick={onDownload} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "12px", marginTop: 12, borderRadius: 10, border: "none",
          background: "linear-gradient(90deg, #5b9cd0 0%, #2d5cd6 100%)",
          color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          boxShadow: "0 6px 22px rgba(70,115,230,0.32)",
        }}>
          <Download size={14} /> Download as PDF
        </button>
      </div>
    </div>
  );
}

function SectionData({ data }) {
  const { t } = useI18n();
  const dataType = data?.type;
  if (dataType === "alerts_breakdown") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <KvBox title={t("reports.kv.bySeverity")} entries={data.by_severity} />
        <KvBox title={t("reports.kv.byZone")} entries={data.by_zone} />
      </div>
    );
  }
  if (dataType === "queue_zones") {
    return (
      <div style={{ padding: "10px 12px", borderRadius: 8,
        background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}` }}>
        {Object.entries(data.zones || {}).map(([z, v]) => (
          <div key={z} style={{ display: "flex", justifyContent: "space-between",
            padding: "4px 0", fontSize: 12 }}>
            <span style={{ color: "#cbd5e1" }}>{z.replace(/_/g, " ")}</span>
            <span style={{ color: "#7dd3fc", fontFamily: MONO }}>
              avg {v.avg} · peak {v.peak}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (dataType === "suspicious_breakdown") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <KvBox title={t("reports.kv.byType")} entries={data.by_type} arabic />
        {data.items?.length > 0 && (
          <div style={{ padding: "8px 12px", borderRadius: 8,
            background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontFamily: MONO, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Recent Items
            </div>
            {data.items.slice(0, 5).map((it, i) => (
              <div key={i} style={{ fontSize: 11, color: "#94a3b8",
                padding: "3px 0", lineHeight: 1.5 }}>
                <span style={{ fontFamily: ARABIC, direction: "rtl" }}>{it.activity_type}</span>
                <span style={{ color: "#475569", marginLeft: 8 }}>· {it.zone} · {it.reported_by}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (dataType === "alert_list") {
    return (
      <div style={{ padding: "8px 12px", borderRadius: 8,
        background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}` }}>
        {(data.items || []).map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 11 }}>
            <span style={{ color: "#475569", fontFamily: MONO, fontSize: 9 }}>
              {it.severity?.toUpperCase()}
            </span>
            <span style={{ color: "#cbd5e1", flex: 1 }}>{it.message}</span>
            <span style={{ color: "#475569", fontFamily: MONO, fontSize: 9 }}>{it.zone}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function KvBox({ title, entries, arabic }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8,
      background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      {Object.entries(entries || {}).map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between",
          padding: "3px 0", fontSize: 12 }}>
          <span style={{ color: "#cbd5e1", fontFamily: arabic ? ARABIC : "inherit",
            direction: arabic ? "rtl" : "ltr" }}>{k}</span>
          <span style={{ color: "#7dd3fc", fontFamily: MONO }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const iconBtn = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600,
  fontFamily: MONO, cursor: "pointer", transition: "all 0.2s",
};
