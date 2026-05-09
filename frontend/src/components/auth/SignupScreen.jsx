import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "../../services/api";
import { FONT, ARABIC } from "../../services/config";
import { useI18n, LANGUAGE_OPTIONS } from "../../context/I18nContext";
import { User, Lock, Mail, Briefcase, UserPlus, ArrowLeft, Upload, Contact, X, Globe } from "lucide-react";

const wrap = { position: "relative", width: "100%" };
const ic = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" };
const inp = {
  width: "100%", padding: "13px 14px 13px 42px", borderRadius: 10, fontSize: 14,
  fontFamily: FONT, color: "#e2e8f0", outline: "none",
  background: "rgba(8,12,22,0.55)", border: "1px solid rgba(56,189,248,0.12)",
  transition: "all 0.2s",
};
const lbl = { display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8 };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export default function SignupScreen() {
  const { lang, setLang } = useI18n();
  const [form, setForm] = useState({ username: "", password: "", confirm: "", full_name: "", email: "", role: "security" });
  const [language, setLanguage] = useState(lang);
  const [idFile, setIdFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const nav = useNavigate();

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) { setErr("ID must be JPEG, PNG, or WebP"); return; }
    if (f.size > MAX_SIZE) { setErr("ID image must be under 5 MB"); return; }
    setErr("");
    setIdFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const clearFile = () => {
    setIdFile(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    setErr("");
    // Client-side validation (mirrors backend rules)
    if (!form.full_name || form.full_name.length < 2) return setErr("Full name is required");
    if (!form.username || !/^[a-zA-Z0-9_.\-]{3,32}$/.test(form.username)) return setErr("Username must be 3-32 chars (letters, digits, . _ -)");
    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setErr("Valid email required");
    if (!["admin", "security"].includes(form.role)) return setErr("Invalid role");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters");
    if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) return setErr("Password must contain letters and digits");
    if (form.password !== form.confirm) return setErr("Passwords do not match");
    if (!idFile) return setErr("General Security ID image is required");

    setBusy(true);
    try {
      await signup({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        language,
        idImage: idFile,
      });
      // Redirect to email verification
      nav(`/verify-email?username=${encodeURIComponent(form.username.trim().toLowerCase())}`, { replace: true });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const focusBorder = (e) => { e.target.style.borderColor = "rgba(56,189,248,0.4)"; };
  const blurBorder = (e) => { e.target.style.borderColor = "rgba(56,189,248,0.12)"; };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
      background: "radial-gradient(ellipse at top, #0e2a52 0%, #081429 45%, #050a18 100%)",
      fontFamily: FONT, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)",
        backgroundSize: "70px 70px" }} />

      <div style={{ textAlign: "center", marginBottom: 22, position: "relative", zIndex: 1 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px", background: "#fff", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
          <img src="/logo.jpeg" alt="AAR" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 600, margin: 0 }}>Aaynak Aal Raj3a</h1>
        <p style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 800, margin: "4px 0 0", fontFamily: ARABIC }}>عينك عالرجعة</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 10 }}>Create your account</p>
      </div>

      <div style={{
        width: "100%", maxWidth: 480, padding: "26px 30px", borderRadius: 14, position: "relative", zIndex: 1,
        background: "rgba(11,20,38,0.55)", border: "1px solid rgba(56,189,248,0.12)",
        backdropFilter: "blur(20px)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        animation: "fadeIn 0.5s ease",
      }}>
        <label style={lbl}>Full Name</label>
        <div style={wrap}>
          <User size={16} style={ic} />
          <input placeholder="Officer Smith" value={form.full_name} onChange={set("full_name")} maxLength={80} style={inp}
            onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Officer ID / Username</label>
        <div style={wrap}>
          <User size={16} style={ic} />
          <input placeholder="3-32 chars, letters/digits/. _ -" value={form.username} onChange={set("username")} maxLength={32} style={inp}
            onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Email</label>
        <div style={wrap}>
          <Mail size={16} style={ic} />
          <input type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} maxLength={120} style={inp}
            onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Role</label>
        <div style={wrap}>
          <Briefcase size={16} style={ic} />
          <select value={form.role} onChange={set("role")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
            <option value="security">Security</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Globe size={13} /> Preferred Language
          </span>
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          {LANGUAGE_OPTIONS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => { setLanguage(l.value); setLang(l.value); }}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: language === l.value
                  ? "1px solid rgba(56,189,248,0.4)"
                  : "1px solid rgba(56,189,248,0.12)",
                background: language === l.value
                  ? "rgba(56,189,248,0.1)"
                  : "rgba(8,12,22,0.55)",
                color: language === l.value ? "#7dd3fc" : "#94a3b8",
                fontSize: 13, fontFamily: l.value === "ar" ? ARABIC : FONT,
                fontWeight: 600, transition: "all 0.2s",
              }}>
              {l.label}
              <span style={{ marginLeft: 6, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
                {l.short}
              </span>
            </button>
          ))}
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Password</label>
        <div style={wrap}>
          <Lock size={16} style={ic} />
          <input type="password" placeholder="8+ chars, letters and digits" value={form.password} onChange={set("password")} maxLength={128} style={inp}
            onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Confirm Password</label>
        <div style={wrap}>
          <Lock size={16} style={ic} />
          <input type="password" placeholder="Re-enter password" value={form.confirm} onChange={set("confirm")} maxLength={128} style={inp}
            onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Contact size={13} /> General Security ID Image
          </span>
        </label>

        {!preview ? (
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "16px", borderRadius: 10, border: "1.5px dashed rgba(56,189,248,0.25)",
            background: "rgba(8,12,22,0.45)", color: "#7dd3fc", fontSize: 13, cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Upload size={14} /> Upload ID Image (JPEG/PNG/WebP, max 5 MB)
          </button>
        ) : (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(56,189,248,0.2)" }}>
            <img src={preview} alt="ID preview" style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
            <button type="button" onClick={clearFile} style={{
              position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%",
              border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><X size={14} /></button>
            <div style={{ padding: "6px 10px", fontSize: 11, color: "#7dd3fc", background: "rgba(8,12,22,0.7)", fontFamily: "monospace" }}>
              {idFile?.name} · {Math.round((idFile?.size || 0) / 1024)} KB
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: "none" }} />

        {err && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center", padding: "10px 0 0" }}>{err}</div>}

        <button onClick={submit} disabled={busy} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "13px", marginTop: 20,
          borderRadius: 10, border: "none", cursor: busy ? "wait" : "pointer", fontFamily: FONT,
          background: "linear-gradient(90deg, #5b9cd0 0%, #4673e6 50%, #2d5cd6 100%)",
          color: "#ffffff", fontSize: 15, fontWeight: 600, opacity: busy ? 0.7 : 1,
          boxShadow: "0 6px 22px rgba(70,115,230,0.32)",
        }}>
          <UserPlus size={16} />{busy ? "Creating Account..." : "Create Account"}
        </button>

        <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", marginTop: 20, paddingTop: 14, textAlign: "center" }}>
          <Link to="/login" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            <ArrowLeft size={13} /> Back to Login
          </Link>
        </div>
      </div>

      <p style={{ color: "#475569", fontSize: 13, marginTop: 24, position: "relative", zIndex: 1 }}>
        © 2025 Lebanese General Security
      </p>
    </div>
  );
}
