import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { C, FONT } from "../../services/config";
import { useI18n } from "../../context/I18nContext";

export default function AppLayout({ wsConnected }) {
  const [collapsed, setCollapsed] = useState(false);
  const { isRTL } = useI18n();
  const w = collapsed ? 68 : 230;
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.012, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(56,189,248,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.6) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} wsConnected={wsConnected} />
      <main style={{
        flex: 1,
        [isRTL ? "marginRight" : "marginLeft"]: w,
        transition: "margin 0.25s cubic-bezier(0.4,0,0.2,1)",
        position: "relative", zIndex: 1, minHeight: "100vh",
      }}>
        <Outlet />
      </main>
    </div>
  );
}
