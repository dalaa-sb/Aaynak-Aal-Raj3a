import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { FONT, MONO, C, NAV_ITEMS } from "../../services/config";
import {
  LayoutDashboard, Cctv, Bell, BarChart3, FileText, Users, Settings,
  ScrollText, Activity, UserCircle,
  LogOut, Radio, WifiOff, ChevronLeft, ChevronRight
} from "lucide-react";

const ICONS = { LayoutDashboard, Cctv, Bell, BarChart3, FileText, Users, Settings, ScrollText, Activity, UserCircle };

export default function Sidebar({ collapsed, onToggle, wsConnected }) {
  const { user, logout, hasRole } = useAuth();
  const { t, isRTL } = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const cur = loc.pathname.replace("/", "") || "dashboard";
  const items = NAV_ITEMS.filter((n) => hasRole(n.roles));

  return (
    <aside style={{
      width: collapsed ? 68 : 230, minHeight: "100vh",
      background: "linear-gradient(180deg, #070b14 0%, #0a0f1a 100%)",
      [isRTL ? "borderLeft" : "borderRight"]: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      position: "fixed", top: 0, [isRTL ? "right" : "left"]: 0, zIndex: 100, overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "18px 14px" : "18px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, minHeight: 68 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          border: "1px solid rgba(56,189,248,0.18)",
        }}>
          <img src="/logo.jpeg" alt="AAR" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <h1 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT }}>عينك عالرجعة</h1>
            <p style={{ fontSize: 8, color: C.textDim, margin: 0, fontFamily: MONO, letterSpacing: "0.08em" }}>AI OPERATIONS CENTER</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(({ key, label, icon, i18n }) => {
          const Ic = ICONS[icon];
          const active = cur === key;
          const navLabel = i18n ? t(i18n) : label;
          return (
            <button key={key} onClick={() => nav(`/${key}`)} title={collapsed ? navLabel : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: collapsed ? "10px 0" : "10px 14px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 10, border: "none", cursor: "pointer", width: "100%",
                fontFamily: FONT, fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? C.accentLight : C.textDim,
                background: active ? "rgba(56,189,248,0.08)" : "transparent",
                transition: "all 0.15s", position: "relative",
                textAlign: isRTL ? "right" : "left",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(56,189,248,0.04)"; e.currentTarget.style.color = C.textMuted; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textDim; } }}
            >
              {active && <div style={{ position: "absolute", [isRTL ? "right" : "left"]: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 2, background: C.accentLight }} />}
              {Ic && <Ic size={18} strokeWidth={active ? 2 : 1.5} />}
              {!collapsed && <span>{navLabel}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "10px 8px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: collapsed ? "8px 0" : "8px 14px", justifyContent: collapsed ? "center" : "flex-start", marginBottom: 4 }}>
          {wsConnected ? <Radio size={12} color={C.green} /> : <WifiOff size={12} color={C.red} />}
          {!collapsed && <span style={{ fontSize: 10, fontFamily: MONO, color: wsConnected ? C.greenLight : C.redLight, fontWeight: 600 }}>{wsConnected ? "LIVE" : "OFFLINE"}</span>}
        </div>
        {!collapsed && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(56,189,248,0.03)", border: `1px solid ${C.border}`, marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{user?.username}</p>
            <p style={{ fontSize: 9, fontFamily: MONO, color: C.accentLight, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{user?.role}</p>
          </div>
        )}
        <button onClick={logout} title={t("nav.logout")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: collapsed ? "10px 0" : "10px 14px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: C.textDim, fontFamily: FONT, fontSize: 12, transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.redLight; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.background = "transparent"; }}
        ><LogOut size={16} />{!collapsed && <span>{t("nav.logout")}</span>}</button>
        <button onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: 8, marginTop: 4, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer" }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
