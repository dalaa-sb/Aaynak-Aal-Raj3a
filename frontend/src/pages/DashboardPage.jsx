import { Users, AlertTriangle, ShieldAlert, Clock } from "lucide-react";
import { FONT, MONO } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import StatCard from "../components/dashboard/StatCard";
import ZonePanel from "../components/dashboard/ZonePanel";
import QueueChart from "../components/dashboard/QueueChart";
import PassengerFeedback from "../components/dashboard/PassengerFeedback";
import { useI18n } from "../context/I18nContext";

/**
 * Dashboard page.
 *
 * Per project policy, the Dashboard now focuses on high-level operational KPIs
 * and does NOT render:
 *   - the interactive airport map (moved off the dashboard entirely;
 *     InteractiveMap deleted entirely — no longer in the codebase)
 *   - the alert feed/list (alerts are managed only on the dedicated /alerts page)
 *
 * The "active alerts" stat-card KPI is kept because it is a high-level summary
 * value, not a feed.
 */
export default function DashboardPage({ data }) {
  const { t } = useI18n();
  // Defensive: every field below may be undefined on first render before
  // the dashboard fetch resolves. Use safe defaults so we never call .filter
  // on undefined and never crash the whole dashboard.
  const summary      = data?.summary      ?? null;
  const alerts       = data?.alerts       ?? [];
  const queueHistory = data?.queueHistory ?? [];
  const lastUpdate   = data?.lastUpdate   ?? null;

  // Critical-count badge on the "Active Alerts" stat card.
  // Lifecycle-aware: counts an alert as critical-active only if it's not yet
  // resolved/dismissed.
  const criticalCount = alerts.filter((a) => {
    const status = a?.status ?? (a?.acknowledged ? "acknowledged" : "new");
    return a?.severity === "critical"
        && status !== "resolved"
        && status !== "dismissed";
  }).length;

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={lastUpdate
          ? `${t("dashboard.lastSync").toUpperCase()}: ${lastUpdate.toLocaleTimeString()}`
          : t("dashboard.connecting").toUpperCase()
        }
      />

      <div style={{ padding: "20px 32px" }}>
        {/* High-level KPI strip */}
        <div className="aar-stats" style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard icon={Users}         label={t("dashboard.passengers")}    value={summary?.total_passengers || 0}    sub={t("dashboard.acrossAllZones")} color="#38bdf8" />
          <StatCard icon={AlertTriangle} label={t("dashboard.activeAlerts")}  value={summary?.active_alerts || 0}       sub={`${criticalCount} ${t("dashboard.criticalSuffix")}`} color={criticalCount > 0 ? "#ef4444" : "#f59e0b"} />
          <StatCard icon={ShieldAlert}   label={t("dashboard.criticalZones")} value={summary?.zones_critical || 0}      sub={t("dashboard.immediateAction")} color="#ef4444" />
          <StatCard icon={Clock}         label={t("dashboard.avgWait")}       value={`${summary?.avg_wait_minutes || 0}m`} sub={t("dashboard.allQueues")} color="#10b981" />
        </div>

        {/* Operational pane: zone status table + live queue chart */}
        <div className="aar-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 20 }}>
          <ZonePanel zones={summary?.zone_statuses} />
          <QueueChart data={queueHistory} />
        </div>

        {/* Passenger satisfaction (full width) */}
        <PassengerFeedback zones={summary?.zone_statuses} />

        {/* Footer */}
        <div style={{ marginTop: 24, padding: "16px 0", borderTop: "1px solid rgba(56,189,248,0.04)",
          display: "flex", justifyContent: "space-between" }}>
          <p style={{ color: "#1e293b", fontSize: 10, fontFamily: MONO }}>
            عينك عالرجعة · AI Airport Security · Beirut–Rafic Hariri International Airport
          </p>
          <p style={{ color: "#1e293b", fontSize: 10, fontFamily: MONO }}>
            {lastUpdate ? `${t("dashboard.lastSync")}: ${lastUpdate.toLocaleTimeString()}` : "..."}
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) { .aar-grid2 { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px)  { .aar-stats { flex-direction: column !important; } }
      `}</style>
    </div>
  );
}
