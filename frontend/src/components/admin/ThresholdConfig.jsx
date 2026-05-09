import { useState, useEffect, useCallback } from "react";
import { Sliders, Save, Loader, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { FONT, MONO, C } from "../../services/config";
import { fetchSettings, saveThresholds } from "../../services/api";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";

const FIELDS = [
  { key: "queue_warning",        type: "int",   min: 0,   max: 10000, color: "#f59e0b", labelKey: "settings.thresholds.queueWarning",        descKey: "settings.thresholds.queueWarningDesc" },
  { key: "queue_critical",       type: "int",   min: 0,   max: 10000, color: "#ef4444", labelKey: "settings.thresholds.queueCritical",       descKey: "settings.thresholds.queueCriticalDesc" },
  { key: "density_warning",      type: "int",   min: 0,   max: 100,   color: "#f59e0b", labelKey: "settings.thresholds.densityWarning",      descKey: "settings.thresholds.densityWarningDesc",   suffix: "%" },
  { key: "density_critical",     type: "int",   min: 0,   max: 100,   color: "#ef4444", labelKey: "settings.thresholds.densityCritical",     descKey: "settings.thresholds.densityCriticalDesc",  suffix: "%" },
  { key: "loiter_minutes",       type: "int",   min: 0,   max: 1440,  color: "#f97316", labelKey: "settings.thresholds.loiterMinutes",       descKey: "settings.thresholds.loiterMinutesDesc" },
  { key: "max_stay_minutes",     type: "int",   min: 0,   max: 1440,  color: "#ef4444", labelKey: "settings.thresholds.maxStayMinutes",      descKey: "settings.thresholds.maxStayMinutesDesc" },
  { key: "confidence_threshold", type: "float", min: 0,   max: 1.0,   color: "#7dd3fc", labelKey: "settings.thresholds.confidenceThreshold", descKey: "settings.thresholds.confidenceThresholdDesc", step: 0.05 },
];

const DEFAULTS = {
  queue_warning: 100, queue_critical: 200,
  density_warning: 60, density_critical: 85,
  loiter_minutes: 15, max_stay_minutes: 30,
  confidence_threshold: 0.5,
};

export default function ThresholdConfig() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();

  const [vals, setVals] = useState(DEFAULTS);
  const [originalVals, setOriginalVals] = useState(DEFAULTS);
  const [meta, setMeta] = useState({ updatedAt: null, updatedBy: null });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      const cleaned = {};
      for (const f of FIELDS) {
        cleaned[f.key] = data[f.key] !== undefined ? data[f.key] : DEFAULTS[f.key];
      }
      setVals(cleaned);
      setOriginalVals(cleaned);
      setMeta({ updatedAt: data._updated_at || null, updatedBy: data._updated_by || null });
      setGlobalError("");
    } catch (e) {
      setGlobalError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /** Local validation — mirrors backend Pydantic rules so UX is fast. */
  const validate = useCallback((v) => {
    const errs = {};
    for (const f of FIELDS) {
      const val = v[f.key];
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) {
        errs[f.key] = "required";
      } else if (val < 0) {
        errs[f.key] = t("settings.errors.negativeNotAllowed");
      } else if (val < f.min || val > f.max) {
        errs[f.key] = t("settings.errors.outOfRange");
      }
    }
    if (!errs.queue_critical && !errs.queue_warning && Number(v.queue_critical) < Number(v.queue_warning)) {
      errs.queue_critical = t("settings.errors.criticalLessThanWarning");
    }
    if (!errs.density_critical && !errs.density_warning && Number(v.density_critical) < Number(v.density_warning)) {
      errs.density_critical = t("settings.errors.criticalLessThanWarning");
    }
    return errs;
  }, [t]);

  const onChange = (key, raw) => {
    const f = FIELDS.find((x) => x.key === key);
    let parsed = f.type === "float" ? parseFloat(raw) : parseInt(raw, 10);
    if (Number.isNaN(parsed)) parsed = "";
    // Clamp negative at input level (defense in depth — backend rejects too)
    if (typeof parsed === "number" && parsed < 0) parsed = 0;
    const next = { ...vals, [key]: parsed };
    setVals(next);
    setErrors(validate(next));
    setSaved(false);
  };

  const isDirty = JSON.stringify(vals) !== JSON.stringify(originalVals);
  const hasErrors = Object.keys(errors).length > 0;

  const onSave = async () => {
    if (!isAdmin) return;
    const errs = validate(vals);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true); setGlobalError("");
    try {
      const saved = await saveThresholds(vals);
      const cleaned = {};
      for (const f of FIELDS) cleaned[f.key] = saved[f.key];
      setVals(cleaned);
      setOriginalVals(cleaned);
      setMeta({ updatedAt: saved._updated_at || null, updatedBy: saved._updated_by || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setGlobalError(e.message || t("settings.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 50, display: "flex", justifyContent: "center", gap: 8, color: "#475569" }}>
        <Loader size={14} className="spin" />
        <span style={{ fontSize: 12 }}>{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16,
      background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>

      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: 0,
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <Sliders size={13} color="#38bdf8" /> {t("settings.thresholds.title")}
          {!isAdmin && <Lock size={11} color="#64748b" />}
        </h3>

        {isAdmin && (
          <button onClick={onSave} disabled={saving || !isDirty || hasErrors} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, border: "none",
            cursor: (saving || !isDirty || hasErrors) ? "not-allowed" : "pointer",
            background: saved ? "rgba(16,185,129,0.15)"
                       : hasErrors ? "rgba(239,68,68,0.1)"
                       : isDirty ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.05)",
            color: saved ? "#34d399"
                 : hasErrors ? "#f87171"
                 : isDirty ? "#7dd3fc" : "#475569",
            fontSize: 11, fontWeight: 600, fontFamily: MONO,
            opacity: (!isDirty && !saved) ? 0.6 : 1, transition: "all 0.2s",
          }}>
            {saving ? <Loader size={11} className="spin" />
             : saved ? <CheckCircle2 size={11} />
             : <Save size={11} />}
            {saving ? t("common.saving").toUpperCase()
             : saved ? t("common.saved").toUpperCase()
             : t("common.save").toUpperCase()}
          </button>
        )}
      </div>

      {!isAdmin && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14,
          background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.2)",
          color: "#94a3b8", fontSize: 12,
          display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={13} />
          You can view current system thresholds. Only administrators can change them.
        </div>
      )}

      {globalError && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", fontSize: 12 }}>{globalError}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FIELDS.map((f) => {
          const err = errors[f.key];
          return (
            <div key={f.key} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(15,23,42,0.4)",
              border: err ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(56,189,248,0.03)",
            }}>
              <div style={{ width: 4, height: 28, borderRadius: 2,
                background: f.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, margin: 0 }}>
                  {t(f.labelKey)}
                </p>
                <p style={{ color: err ? "#f87171" : "#475569",
                  fontSize: 10, margin: "2px 0 0",
                  display: "flex", alignItems: "center", gap: 4 }}>
                  {err && <AlertCircle size={10} />}
                  {err || t(f.descKey)}
                </p>
              </div>
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step || 1}
                value={vals[f.key] === "" ? "" : vals[f.key]}
                onChange={(e) => onChange(f.key, e.target.value)}
                disabled={!isAdmin}
                style={{
                  width: f.suffix ? 95 : 90,
                  padding: "8px 10px", borderRadius: 8,
                  fontSize: 13, fontFamily: MONO, textAlign: "center",
                  border: err ? "1px solid rgba(239,68,68,0.4)" : `1px solid ${C.border}`,
                  background: isAdmin ? "rgba(15,23,42,0.6)" : "rgba(8,12,22,0.4)",
                  color: isAdmin ? C.text : "#64748b",
                  outline: "none",
                  cursor: isAdmin ? "text" : "not-allowed",
                }}
              />
              {f.suffix && (
                <span style={{ color: "#475569", fontSize: 11, fontFamily: MONO, marginLeft: -6 }}>
                  {f.suffix}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {meta.updatedAt && (
        <div style={{ marginTop: 14, fontSize: 10, fontFamily: MONO, color: "#475569",
          display: "flex", gap: 6 }}>
          <span>{t("settings.lastUpdated")}:</span>
          <span style={{ color: "#94a3b8" }}>{new Date(meta.updatedAt).toLocaleString()}</span>
          {meta.updatedBy && <span>{t("settings.by")} <span style={{ color: "#7dd3fc" }}>{meta.updatedBy}</span></span>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
