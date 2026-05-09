import { useState, useEffect } from "react";
import { User, Save, Mail, Shield, AtSign, Phone, Globe, CheckCircle2, Loader, AlertCircle } from "lucide-react";
import { FONT, MONO, ARABIC, C } from "../../services/config";
import { fetchMe, updateMe } from "../../services/api";
import { useI18n, LANGUAGE_OPTIONS } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";

export default function EditProfile() {
  const { t, lang, setLang } = useI18n();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState(lang);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        // Use server-stored preference if present, otherwise current i18n lang
        if (p.language && ["en", "ar", "fr"].includes(p.language)) {
          setLanguage(p.language);
          if (p.language !== lang) setLang(p.language);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setError(""); setSuccess(""); setSaving(true);
    try {
      const payload = {};
      if (fullName.trim() !== (profile?.full_name || "")) payload.full_name = fullName.trim();
      if ((phone.trim() || null) !== (profile?.phone || null)) payload.phone = phone.trim() || null;
      if (language !== profile?.language) payload.language = language;

      if (Object.keys(payload).length === 0) {
        setSuccess(t("profile.savedSuccessfully"));
        setSaving(false);
        return;
      }

      const updated = await updateMe(payload);
      setProfile(updated);
      // Apply language change immediately
      if (updated.language && updated.language !== lang) setLang(updated.language);
      // Refresh AuthContext so rest of app sees new full_name etc
      if (refreshUser) refreshUser(updated);

      setSuccess(t("profile.savedSuccessfully"));
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 50, display: "flex", justifyContent: "center",
        alignItems: "center", gap: 8, color: "#475569" }}>
        <Loader size={14} className="spin" />
        <span style={{ fontSize: 12, fontFamily: FONT }}>{t("common.loading")}</span>
      </div>
    );
  }

  const inputBase = {
    width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
    fontFamily: FONT, border: `1px solid ${C.border}`,
    background: "rgba(15,23,42,0.6)", color: C.text, outline: "none",
  };
  const readonlyStyle = { ...inputBase, background: "rgba(8,12,22,0.5)", color: "#64748b", cursor: "not-allowed" };

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16,
      background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)",
      maxWidth: 640 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <User size={14} color="#38bdf8" />
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: 0,
          fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {t("profile.title")}
        </h3>
      </div>
      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>{t("profile.subtitle")}</p>

      {/* Username (read-only) */}
      <Field label={t("profile.username")} icon={AtSign} note={t("profile.usernameNote")}>
        <input value={profile?.username || ""} disabled style={readonlyStyle} />
      </Field>

      {/* Email (read-only for now) */}
      <Field label={t("profile.email")} icon={Mail} note={t("profile.emailNote")}>
        <input value={profile?.email || ""} disabled style={readonlyStyle} />
      </Field>

      {/* Role (read-only) */}
      <Field label={t("profile.role")} icon={Shield} note={t("profile.roleNote")}>
        <input value={(profile?.role || "").toUpperCase()} disabled style={readonlyStyle} />
      </Field>

      {/* Full name (editable) */}
      <Field label={t("profile.fullName")} icon={User}>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
          minLength={2}
          style={inputBase}
          placeholder={t("profile.fullName")}
        />
      </Field>

      {/* Phone (editable) */}
      <Field label={t("profile.phone")} icon={Phone}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={24}
          style={inputBase}
          placeholder={t("profile.phonePlaceholder")}
        />
      </Field>

      {/* Language (editable, applies live) */}
      <Field label={t("profile.language")} icon={Globe} note={t("profile.languageNote")}>
        <div style={{ display: "flex", gap: 6 }}>
          {LANGUAGE_OPTIONS.map((l) => (
            <button key={l.value}
              onClick={() => { setLanguage(l.value); setLang(l.value); }}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                border: language === l.value
                  ? "1px solid rgba(56,189,248,0.4)"
                  : `1px solid ${C.border}`,
                background: language === l.value
                  ? "rgba(56,189,248,0.1)" : "rgba(15,23,42,0.4)",
                color: language === l.value ? "#7dd3fc" : "#94a3b8",
                fontSize: 12, fontFamily: l.value === "ar" ? ARABIC : FONT,
                fontWeight: 600, transition: "all 0.2s",
              }}>
              {l.label}
              <span style={{ marginLeft: 6, fontSize: 10, fontFamily: MONO, color: "#475569" }}>
                {l.short}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10, marginTop: 14,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", fontSize: 12 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10, marginTop: 14,
          background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
          color: "#34d399", fontSize: 12 }}>
          <CheckCircle2 size={13} /> {success}
        </div>
      )}

      <button onClick={onSave} disabled={saving} style={{
        marginTop: 18,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", padding: "12px", borderRadius: 10, border: "none",
        cursor: saving ? "wait" : "pointer",
        background: "linear-gradient(90deg, #5b9cd0 0%, #2d5cd6 100%)",
        color: "#fff", fontSize: 13, fontFamily: FONT, fontWeight: 600,
        opacity: saving ? 0.6 : 1, transition: "opacity 0.2s",
      }}>
        {saving ? <Loader size={13} className="spin" /> : <Save size={13} />}
        {saving ? t("common.saving") : t("profile.saveProfile")}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function Field({ label, icon: Icon, note, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6,
        fontSize: 10, fontFamily: MONO, color: "#64748b",
        letterSpacing: "0.06em", marginBottom: 5, textTransform: "uppercase" }}>
        {Icon && <Icon size={11} />} {label}
      </label>
      {children}
      {note && <p style={{ fontSize: 10, color: "#475569", margin: "4px 0 0", fontStyle: "italic" }}>{note}</p>}
    </div>
  );
}
