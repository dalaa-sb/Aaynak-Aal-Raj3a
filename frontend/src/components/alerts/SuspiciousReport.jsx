import { useState, useEffect } from "react";
import { AlertTriangle, Send, FileText, Info } from "lucide-react";
import { FONT, MONO, ARABIC, C } from "../../services/config";
import { submitSuspiciousReport, fetchActivityTypes } from "../../services/api";
import { useI18n } from "../../context/I18nContext";

const ZONES = ["check_in_a", "check_in_b", "security_1", "duty_free", "gates_d"];
const CAMS = ["CAM-01", "CAM-02", "CAM-03", "CAM-04", "CAM-05"];
const SEVERITY_KEYS = ["low", "medium", "high", "critical"];

// Fallback list — backend is source of truth; show these immediately while loading.
// Values stay in Arabic intentionally — they are official operational labels.
const DEFAULT_ARABIC_TYPES = [
  "سلوك مريب",
  "دخول متكرر لمنطقة حساسة",
  "التواجد لفترة طويلة بشكل غير طبيعي",
  "حقيبة متروكة بدون مالك",
  "تجمع غير عادي للأشخاص",
  "محاولة تجاوز نقطة تفتيش",
  "تصوير غير مصرح به",
  "مشاجرة أو سلوك عدائي",
  "أخرى",
];
const OTHER_LABEL = "أخرى";

export default function SuspiciousReport() {
  const { t } = useI18n();
  const [zone, setZone] = useState("");
  const [cam, setCam] = useState("");
  const [activity, setActivity] = useState("");
  const [customActivity, setCustomActivity] = useState("");
  const [notes, setNotes] = useState("");
  const [severity, setSeverity] = useState("high");
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [types, setTypes] = useState(DEFAULT_ARABIC_TYPES);

  useEffect(() => {
    fetchActivityTypes().then((d) => {
      if (Array.isArray(d?.types) && d.types.length > 0) setTypes(d.types);
    }).catch(() => {});
  }, []);

  const ss = {
    width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
    fontFamily: FONT, border: `1px solid ${C.border}`, background: "rgba(15,23,42,0.6)",
    color: C.text, outline: "none",
  };
  const arabicSelect = { ...ss, fontFamily: ARABIC, direction: "rtl", textAlign: "right" };

  const isOther = activity === OTHER_LABEL;
  const finalActivity = isOther ? customActivity.trim() : activity;

  const submit = async () => {
    setErrMsg(""); setOkMsg("");
    if (!zone) return setErrMsg(t("suspicious.selectZoneError"));
    if (!cam)  return setErrMsg(t("suspicious.selectCameraError"));
    if (!finalActivity) return setErrMsg(isOther ? t("suspicious.typeCustomError") : t("suspicious.selectActivityError"));

    setBusy(true);
    try {
      await submitSuspiciousReport({
        camera_id: cam,
        zone,
        activity_type: finalActivity,
        notes: notes.trim() || null,
        severity,
      });
      setOkMsg(t("suspicious.success"));
      setActivity(""); setCustomActivity(""); setNotes("");
      setTimeout(() => setOkMsg(""), 4500);
    } catch (e) {
      setErrMsg(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16,
      background: "rgba(15,23,42,0.3)", border: "1px solid rgba(249,115,22,0.08)" }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569",
        margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8,
        fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <AlertTriangle size={13} color="#fb923c" /> {t("suspicious.title")}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <select value={zone} onChange={(e) => setZone(e.target.value)} style={ss}>
          <option value="">{t("suspicious.selectZone")}</option>
          {ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>

        <select value={cam} onChange={(e) => setCam(e.target.value)} style={ss}>
          <option value="">{t("suspicious.selectCamera")}</option>
          {CAMS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div>
          <label style={{ display: "block", fontSize: 10, fontFamily: MONO, color: "#64748b",
            letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
            {t("suspicious.officialArabicLabel")}
          </label>
          <p style={{
            fontSize: 10, color: "#475569", margin: "0 0 6px",
            display: "flex", alignItems: "flex-start", gap: 4, lineHeight: 1.5,
          }}>
            <Info size={10} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{t("suspicious.officialArabicHelper")}</span>
          </p>
          <select value={activity} onChange={(e) => setActivity(e.target.value)} style={arabicSelect}>
            <option value="" dir="rtl">— اختر نوع النشاط —</option>
            {types.map((typ) => <option key={typ} value={typ} dir="rtl">{typ}</option>)}
          </select>
        </div>

        {isOther && (
          <input
            placeholder={t("suspicious.customActivity")}
            value={customActivity}
            onChange={(e) => setCustomActivity(e.target.value)}
            maxLength={80}
            style={{ ...ss, fontFamily: ARABIC, direction: "rtl", textAlign: "right" }}
          />
        )}

        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={ss}>
          {SEVERITY_KEYS.map((s) => (
            <option key={s} value={s}>
              {t("suspicious.severityPrefix")}: {t(`alerts.severity.${s}`)}
            </option>
          ))}
        </select>

        <textarea
          placeholder={t("suspicious.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={500}
          style={{ ...ss, resize: "vertical", minHeight: 70 }}
        />

        {errMsg && <div style={{ padding: "8px 12px", borderRadius: 8,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", fontSize: 12 }}>{errMsg}</div>}
        {okMsg && <div style={{ padding: "8px 12px", borderRadius: 8,
          background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
          color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={12} /> {okMsg}
        </div>}

        <button
          onClick={submit}
          disabled={busy}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: 12, borderRadius: 10, border: "none", cursor: busy ? "wait" : "pointer",
            background: "rgba(249,115,22,0.12)", color: "#fb923c",
            fontSize: 13, fontWeight: 600, fontFamily: FONT,
            opacity: busy ? 0.5 : 1, transition: "all 0.2s",
          }}
        >
          <Send size={14} />
          {busy ? t("suspicious.submitting") : t("suspicious.submit")}
        </button>
      </div>
    </div>
  );
}
