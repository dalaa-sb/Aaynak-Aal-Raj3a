import { useState, useEffect, useCallback } from "react";
import { Trash2, Shield, ShieldCheck, KeyRound, X, Eye, BadgeCheck, Copy } from "lucide-react";
import { FONT, MONO, C } from "../../services/config";
import { fetchUsers, deleteUser, adminIssueReset, adminVerifyId, getIdImageUrl } from "../../services/api";

const RI = { admin: ShieldCheck, security: Shield };
const RC = { admin: "#8b5cf6", security: "#f59e0b" };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetTokenModal, setResetTokenModal] = useState(null);  // { username, token, expires_at }
  const [idImageModal, setIdImageModal] = useState(null);  // { username, blobUrl }

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setUsers(await fetchUsers()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const issueReset = async (username) => {
    setError(""); setInfo("");
    try {
      const r = await adminIssueReset(username);
      setResetTokenModal({ username: r.target_username, token: r.reset_token, expires_at: r.expires_at });
    } catch (e) { setError(e.message); }
  };

  const remove = async (username) => {
    if (!window.confirm(`Delete user "${username}"? This will also remove their ID image.`)) return;
    try { await deleteUser(username); await refresh(); setInfo(`Deleted ${username}`); }
    catch (e) { setError(e.message); }
  };

  const verifyId = async (username) => {
    try { await adminVerifyId(username); await refresh(); setInfo(`ID verified for ${username}`); }
    catch (e) { setError(e.message); }
  };

  const viewId = async (username) => {
    setError("");
    try {
      const token = JSON.parse(sessionStorage.getItem("aar_user") || "{}").token;
      const res = await fetch(getIdImageUrl(username), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load ID image");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setIdImageModal({ username, blobUrl });
    } catch (e) { setError(e.message); }
  };

  const closeIdImage = () => {
    if (idImageModal?.blobUrl) URL.revokeObjectURL(idImageModal.blobUrl);
    setIdImageModal(null);
  };

  const copyToken = (t) => {
    navigator.clipboard?.writeText(t).then(() => setInfo("Token copied to clipboard"));
  };

  return (
    <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(15,23,42,0.3)", border: "1px solid rgba(56,189,248,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#475569", margin: 0, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          System Users
        </h3>
        <button onClick={refresh} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
          REFRESH
        </button>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {info && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399", fontSize: 12, marginBottom: 10 }}>{info}</div>}

      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 14px", lineHeight: 1.5 }}>
        New accounts are created via the public Sign-Up page. Use this panel to verify uploaded IDs, reset passwords, or remove accounts.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {loading ? (
          <p style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: 24 }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: 24 }}>No users.</p>
        ) : users.map((u) => {
          const Ic = RI[u.role] || Shield; const c = RC[u.role] || "#64748b";
          return (
            <div key={u.username} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(15,23,42,0.4)", border: "1px solid rgba(56,189,248,0.03)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}10`, border: `1px solid ${c}20`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic size={14} color={c} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: 0 }}>{u.full_name || u.username}</p>
                  {u.email_verified ? (
                    <span title="Email verified" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: "#34d399", fontFamily: MONO }}>
                      <BadgeCheck size={11} /> EMAIL
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, color: "#f59e0b", fontFamily: MONO }}>EMAIL UNVERIFIED</span>
                  )}
                  {u.id_verified ? (
                    <span title="ID verified" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: "#34d399", fontFamily: MONO }}>
                      <BadgeCheck size={11} /> ID
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, color: "#f59e0b", fontFamily: MONO }}>ID PENDING</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontFamily: MONO, color: c, textTransform: "uppercase", letterSpacing: "0.08em" }}>{u.role}</span>
                  <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569" }}>· {u.username}</span>
                  {u.email && <span style={{ fontSize: 9, fontFamily: MONO, color: "#475569" }}>· {u.email}</span>}
                </div>
              </div>
              <span style={{ fontSize: 10, fontFamily: MONO, color: "#475569", whiteSpace: "nowrap" }}>
                {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
              </span>

              {u.id_image_path && (
                <button onClick={() => viewId(u.username)} title="View ID image"
                  style={iconBtnStyle("#7dd3fc", "rgba(56,189,248,0.1)", "rgba(56,189,248,0.3)")}>
                  <Eye size={12} />
                </button>
              )}
              {!u.id_verified && u.id_image_path && (
                <button onClick={() => verifyId(u.username)} title="Mark ID verified"
                  style={iconBtnStyle("#34d399", "rgba(16,185,129,0.1)", "rgba(16,185,129,0.3)")}>
                  <BadgeCheck size={12} />
                </button>
              )}
              <button onClick={() => issueReset(u.username)} title="Issue password reset token"
                style={iconBtnStyle("#7dd3fc", "rgba(56,189,248,0.1)", "rgba(56,189,248,0.3)")}>
                <KeyRound size={12} />
              </button>
              <button onClick={() => remove(u.username)} title="Delete user"
                style={iconBtnStyle("#f87171", "rgba(239,68,68,0.1)", "rgba(239,68,68,0.3)")}>
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Reset token modal */}
      {resetTokenModal && (
        <Modal onClose={() => setResetTokenModal(null)}>
          <h3 style={{ color: "#f0f9ff", fontSize: 16, fontWeight: 600, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={16} color="#38bdf8" /> Reset Token Issued
          </h3>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
            Send this token to <strong style={{ color: "#7dd3fc" }}>{resetTokenModal.username}</strong> through a secure channel.
            They can use it at <code style={{ background: "rgba(56,189,248,0.05)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>/reset-password</code>.
            Single-use, expires in 15 minutes.
          </p>
          <div style={{
            padding: "12px", borderRadius: 8, background: "rgba(8,12,22,0.7)",
            border: "1px solid rgba(56,189,248,0.15)", fontFamily: "monospace",
            fontSize: 11, color: "#7dd3fc", wordBreak: "break-all", lineHeight: 1.5,
          }}>{resetTokenModal.token}</div>
          <button onClick={() => copyToken(resetTokenModal.token)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: "10px", marginTop: 12, borderRadius: 8, border: "none",
            cursor: "pointer", background: "rgba(56,189,248,0.12)", color: "#7dd3fc",
            fontSize: 12, fontWeight: 600, fontFamily: FONT,
          }}><Copy size={12} /> Copy Token</button>
          <p style={{ color: "#475569", fontSize: 10, margin: "10px 0 0", textAlign: "center", fontFamily: MONO }}>
            Expires: {new Date(resetTokenModal.expires_at).toLocaleString()}
          </p>
        </Modal>
      )}

      {/* ID image modal */}
      {idImageModal && (
        <Modal onClose={closeIdImage}>
          <h3 style={{ color: "#f0f9ff", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>
            ID — {idImageModal.username}
          </h3>
          <img src={idImageModal.blobUrl} alt="ID" style={{ width: "100%", borderRadius: 8, display: "block" }} />
        </Modal>
      )}
    </div>
  );
}

function iconBtnStyle(hoverColor, hoverBg, hoverBorder) {
  return {
    padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.05)",
    background: "transparent", cursor: "pointer", color: "#64748b", transition: "all 0.2s",
    flexShrink: 0,
  };
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, padding: "24px 26px", borderRadius: 14,
        background: "rgba(11,20,38,0.97)", border: "1px solid rgba(56,189,248,0.2)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, background: "none", border: "none",
          cursor: "pointer", padding: 4, color: "#64748b",
        }}><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}
