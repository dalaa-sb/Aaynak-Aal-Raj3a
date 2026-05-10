const IS_DEV = window.location.port === "3000";
const PROD_API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const PROD_WS_BASE  = import.meta.env.VITE_WS_BASE_URL  || "ws://localhost:8000";

export const API_BASE = IS_DEV ? "" : PROD_API_BASE;
export const WS_URL   = IS_DEV ? `ws://localhost:3000/ws` : `${PROD_WS_BASE}/ws`;

export const FONT = "'Inter', sans-serif";
export const MONO = "'JetBrains Mono', monospace";
export const ARABIC = "'IBM Plex Sans Arabic', 'Inter', sans-serif";

export const C = {
  bg: "#06080d", surface: "#0a0f1a", surfaceLight: "#0f1729",
  border: "rgba(56,189,248,0.06)", borderHover: "rgba(56,189,248,0.15)",
  accent: "#0ea5e9", accentLight: "#38bdf8",
  text: "#f0f9ff", textMuted: "#94a3b8", textDim: "#475569", textDark: "#334155",
  green: "#10b981", greenLight: "#34d399",
  yellow: "#f59e0b", orange: "#f97316",
  red: "#ef4444", redLight: "#f87171", purple: "#8b5cf6",
};

export const STATUS_COLORS = {
  normal:   { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)",  text: "#34d399", dot: "#10b981", glow: "rgba(16,185,129,0.3)" },
  warning:  { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)",  text: "#fbbf24", dot: "#f59e0b", glow: "rgba(245,158,11,0.3)" },
  critical: { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  text: "#f87171", dot: "#ef4444", glow: "rgba(239,68,68,0.4)" },
};

export const SEV = {
  low:      { bg: "rgba(16,185,129,0.05)", border: "rgba(16,185,129,0.12)", icon: "\u2705", color: "#34d399" },
  medium:   { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.12)", icon: "\u26a0\ufe0f", color: "#fbbf24" },
  high:     { bg: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.15)", icon: "\ud83d\udd36", color: "#fb923c" },
  critical: { bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.18)",  icon: "\ud83d\udea8", color: "#f87171" },
};

// Only two user roles per spec: admin and security.
export const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",   icon: "LayoutDashboard", roles: ["admin","security"], i18n: "nav.dashboard" },
  { key: "cameras",    label: "Cameras",      icon: "Cctv",            roles: ["admin","security"], i18n: "nav.cameras" },
  { key: "alerts",     label: "Alerts",       icon: "Bell",            roles: ["admin","security"], i18n: "nav.alerts" },
  { key: "analytics",  label: "Analytics",    icon: "BarChart3",       roles: ["admin"],            i18n: "nav.analytics" },
  { key: "reports",    label: "Reports",      icon: "FileText",        roles: ["admin"],            i18n: "nav.reports" },
  { key: "users",      label: "User Mgmt",    icon: "Users",           roles: ["admin"],            i18n: "nav.users" },
  { key: "audit",      label: "Audit Log",    icon: "ScrollText",      roles: ["admin"],            i18n: "nav.audit" },
  { key: "health",     label: "System Health",icon: "Activity",        roles: ["admin"],            i18n: "nav.health" },
  { key: "settings",   label: "Settings",     icon: "Settings",        roles: ["admin","security"], i18n: "nav.settings" },
];
