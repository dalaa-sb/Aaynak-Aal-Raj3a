import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/api";
import { FONT, ARABIC } from "../../services/config";
import { KeyRound, ArrowLeft, User, Mail } from "lucide-react";

const wrap = { position: "relative", width: "100%" };
const ic = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" };
const inp = {
  width: "100%", padding: "13px 14px 13px 42px", borderRadius: 10, fontSize: 14,
  fontFamily: FONT, color: "#e2e8f0", outline: "none",
  background: "rgba(8,12,22,0.55)", border: "1px solid rgba(56,189,248,0.12)",
};

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!identifier) return setErr("Enter your username or email");
    setErr(""); setBusy(true);
    try {
      await forgotPassword(identifier.trim().toLowerCase());
      setDone(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
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
        <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 600, margin: 0 }}>Forgot Password</h1>
        <p style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, margin: "4px 0 0", fontFamily: ARABIC }}>عينك عالرجعة</p>
      </div>

      <div style={{
        width: "100%", maxWidth: 420, padding: "26px 30px", borderRadius: 14, position: "relative", zIndex: 1,
        background: "rgba(11,20,38,0.55)", border: "1px solid rgba(56,189,248,0.12)",
        backdropFilter: "blur(20px)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%",
              background: "rgba(16,185,129,0.15)", marginBottom: 14 }}>
              <KeyRound size={26} color="#34d399" />
            </div>
            <h3 style={{ color: "#34d399", fontSize: 16, fontWeight: 600, margin: 0 }}>Request Received</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "10px 0 0", lineHeight: 1.5 }}>
              If the account exists, a reset link was sent. Contact your admin if you don't receive it.
            </p>
            <Link to="/reset-password" style={{ display: "inline-block", color: "#7dd3fc", fontSize: 13, marginTop: 16, textDecoration: "none", fontWeight: 500 }}>
              Have a reset token? →
            </Link>
          </div>
        ) : (
          <>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 }}>
              Enter your username or email. If the account exists, an admin will issue you a reset token.
            </p>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Username or Email</label>
            <div style={wrap}>
              {identifier.includes("@") ? <Mail size={16} style={ic} /> : <User size={16} style={ic} />}
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="username or you@example.com"
                maxLength={64} style={inp} autoFocus />
            </div>

            {err && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center", padding: "10px 0 0" }}>{err}</div>}

            <button onClick={submit} disabled={busy} style={{
              width: "100%", padding: "13px", marginTop: 16, borderRadius: 10, border: "none",
              cursor: busy ? "wait" : "pointer", fontFamily: FONT,
              background: "linear-gradient(90deg, #5b9cd0 0%, #4673e6 50%, #2d5cd6 100%)",
              color: "#fff", fontSize: 15, fontWeight: 600, opacity: busy ? 0.7 : 1,
              boxShadow: "0 6px 22px rgba(70,115,230,0.32)",
            }}>
              {busy ? "Sending..." : "Request Reset"}
            </button>

            <Link to="/reset-password" style={{ display: "block", textAlign: "center", color: "#7dd3fc", fontSize: 12, marginTop: 12, textDecoration: "none", fontWeight: 500 }}>
              Already have a reset token? →
            </Link>
          </>
        )}

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
