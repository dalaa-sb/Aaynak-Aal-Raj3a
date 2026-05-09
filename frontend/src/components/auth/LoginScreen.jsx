import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { login } from "../../services/api";
import { FONT, ARABIC } from "../../services/config";
import { User, Lock, Shield, KeyRound } from "lucide-react";

const fieldWrap = { position: "relative", width: "100%" };
const iconStyle = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" };
const inputStyle = {
  width: "100%", padding: "13px 14px 13px 42px", borderRadius: 10, fontSize: 14,
  fontFamily: FONT, color: "#e2e8f0", outline: "none",
  background: "rgba(8,12,22,0.55)", border: "1px solid rgba(56,189,248,0.12)",
  transition: "all 0.2s",
};

export default function LoginScreen() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { login: setUser } = useAuth();
  const { setLang } = useI18n();
  const nav = useNavigate();

  const submit = async () => {
    if (!u || !p) return setErr("Please fill in all fields");
    setBusy(true); setErr("");
    try {
      const data = await login(u.trim(), p);
      setUser(data);

      // Apply server-stored language preference if and only if the user
      // has explicitly set one. If data.language is null/undefined, we
      // keep whatever language the I18nContext already resolved
      // (localStorage → browser → English).
      if (data?.language && ["en", "ar", "fr"].includes(data.language)) {
        setLang(data.language);
      }

      nav("/dashboard", { replace: true });
    } catch (e) {
      // Detect "email not verified" → route to verification
      if (/not verified/i.test(e.message)) {
        nav(`/verify-email?username=${encodeURIComponent(u.trim())}`);
      } else {
        setErr(e.message);
      }
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 20px",
      background: "radial-gradient(ellipse at top, #0e2a52 0%, #081429 45%, #050a18 100%)",
      fontFamily: FONT, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)",
        backgroundSize: "70px 70px" }} />

      <div style={{ textAlign: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
        <div style={{ width: 76, height: 76, borderRadius: 18, margin: "0 auto 22px",
          background: "#ffffff", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.4), 0 0 24px rgba(56,189,248,0.12)" }}>
          <img src="/logo.jpeg" alt="AAR" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
          Aaynak Aal Raj3a
        </h1>
        <p style={{ color: "#e2e8f0", fontSize: 24, fontWeight: 800, margin: "6px 0 0", fontFamily: ARABIC, letterSpacing: "0.01em" }}>
          عينك عالرجعة
        </p>
        <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 14 }}>الأمن العام اللبناني</p>
      </div>

      <div style={{
        width: "100%", maxWidth: 460, padding: "28px 30px", borderRadius: 14, position: "relative", zIndex: 1,
        background: "rgba(11,20,38,0.55)", border: "1px solid rgba(56,189,248,0.12)",
        backdropFilter: "blur(20px)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        animation: "fadeIn 0.5s ease",
      }}>
        <label style={{ display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          Officer ID / Email
        </label>
        <div style={fieldWrap}>
          <User size={16} style={iconStyle} />
          <input placeholder="Enter your ID or email" value={u} maxLength={64}
            onChange={(e) => setU(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "rgba(56,189,248,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(56,189,248,0.12)"; }}
            autoComplete="username" />
        </div>

        <label style={{ display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8, marginTop: 18 }}>
          Password
        </label>
        <div style={fieldWrap}>
          <Lock size={16} style={iconStyle} />
          <input placeholder="Enter your password" type="password" value={p} maxLength={128}
            onChange={(e) => setP(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "rgba(56,189,248,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(56,189,248,0.12)"; }}
            autoComplete="current-password" />
        </div>

        {err && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center", padding: "10px 0 0" }}>{err}</div>}

        <button onClick={submit} disabled={busy} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "13px", marginTop: 22,
          borderRadius: 10, border: "none", cursor: busy ? "wait" : "pointer", fontFamily: FONT,
          background: "linear-gradient(90deg, #5b9cd0 0%, #4673e6 50%, #2d5cd6 100%)",
          color: "#ffffff", fontSize: 15, fontWeight: 600,
          opacity: busy ? 0.7 : 1, boxShadow: "0 6px 22px rgba(70,115,230,0.32)",
        }}>
          <Shield size={16} />{busy ? "Authenticating..." : "Secure Login"}
        </button>

        <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", marginTop: 22, paddingTop: 18, textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Authorized personnel only</p>
          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>All actions are logged and monitored</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 16, flexWrap: "wrap" }}>
            <Link to="/signup" style={{ color: "#7dd3fc", fontSize: 12, textDecoration: "none", fontWeight: 500 }}>
              Create Account
            </Link>
            <span style={{ color: "#334155", fontSize: 12 }}>·</span>
            <Link to="/forgot-password" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <KeyRound size={11} /> Forgot Password
            </Link>
          </div>
        </div>
      </div>

      <p style={{ color: "#475569", fontSize: 13, marginTop: 28, position: "relative", zIndex: 1 }}>
        © 2026 Lebanese General Security
      </p>
    </div>
  );
}
