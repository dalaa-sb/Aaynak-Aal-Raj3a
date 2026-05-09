import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { verifyEmail, resendVerification } from "../../services/api";
import { FONT, ARABIC } from "../../services/config";
import { MailCheck, ArrowLeft, RefreshCw } from "lucide-react";

const inp = {
  width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 18,
  fontFamily: "monospace", color: "#e2e8f0", outline: "none",
  background: "rgba(8,12,22,0.55)", border: "1px solid rgba(56,189,248,0.12)",
  textAlign: "center", letterSpacing: "0.5em",
};

export default function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const [username, setUsername] = useState(params.get("username") || "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const nav = useNavigate();

  // If username is missing, prompt for it
  const hasUsername = !!username;

  const submit = async () => {
    setErr(""); setInfo("");
    if (!username) return setErr("Username required");
    if (!/^[0-9]{6}$/.test(code)) return setErr("Enter the 6-digit code");
    setBusy(true);
    try {
      await verifyEmail(username.trim().toLowerCase(), code);
      setInfo("Email verified! Redirecting to login...");
      setTimeout(() => nav("/login", { replace: true }), 1500);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    if (!username) return setErr("Enter your username first");
    setErr(""); setInfo(""); setResendBusy(true);
    try {
      await resendVerification(username.trim().toLowerCase());
      setInfo("If the account exists, a new code was sent.");
    } catch (e) { setErr(e.message); }
    finally { setResendBusy(false); }
  };

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
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
          <img src="/logo.jpeg" alt="AAR" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 600, margin: 0 }}>Verify Your Email</h1>
        <p style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, margin: "4px 0 0", fontFamily: ARABIC }}>عينك عالرجعة</p>
      </div>

      <div style={{
        width: "100%", maxWidth: 420, padding: "26px 30px", borderRadius: 14, position: "relative", zIndex: 1,
        background: "rgba(11,20,38,0.55)", border: "1px solid rgba(56,189,248,0.12)",
        backdropFilter: "blur(20px)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <MailCheck size={18} color="#7dd3fc" />
          <p style={{ color: "#cbd5e1", fontSize: 13, margin: 0 }}>
            We sent a 6-digit code to your email. Enter it below.
          </p>
        </div>

        {!hasUsername && (
          <>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64}
              style={{ ...inp, fontFamily: FONT, fontSize: 14, letterSpacing: 0, textAlign: "left" }}
              placeholder="your.username" />
            <div style={{ height: 14 }} />
          </>
        )}

        <label style={{ display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Verification Code</label>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="000000" maxLength={6}
          style={inp} inputMode="numeric" autoFocus={hasUsername} />

        {err && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center", padding: "10px 0 0" }}>{err}</div>}
        {info && <div style={{ color: "#34d399", fontSize: 12, textAlign: "center", padding: "10px 0 0" }}>{info}</div>}

        <button onClick={submit} disabled={busy} style={{
          width: "100%", padding: "13px", marginTop: 16, borderRadius: 10, border: "none",
          cursor: busy ? "wait" : "pointer", fontFamily: FONT,
          background: "linear-gradient(90deg, #5b9cd0 0%, #4673e6 50%, #2d5cd6 100%)",
          color: "#ffffff", fontSize: 15, fontWeight: 600, opacity: busy ? 0.7 : 1,
          boxShadow: "0 6px 22px rgba(70,115,230,0.32)",
        }}>
          {busy ? "Verifying..." : "Verify Email"}
        </button>

        <button onClick={resend} disabled={resendBusy} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%", padding: "10px", marginTop: 10, borderRadius: 10,
          border: "1px solid rgba(56,189,248,0.15)", cursor: resendBusy ? "wait" : "pointer", fontFamily: FONT,
          background: "transparent", color: "#94a3b8", fontSize: 12, fontWeight: 500,
        }}>
          <RefreshCw size={12} /> {resendBusy ? "Sending..." : "Resend Code"}
        </button>

        <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", marginTop: 18, paddingTop: 14, textAlign: "center" }}>
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
