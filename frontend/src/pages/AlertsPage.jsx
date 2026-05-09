import { FONT } from "../services/config";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import PageHeader from "../components/shared/PageHeader";
import AlertFeed from "../components/alerts/AlertFeed";
import SuspiciousReport from "../components/alerts/SuspiciousReport";

export default function AlertsPage({ data }) {
  const { isSecurity, isAdmin } = useAuth();
  const { t } = useI18n();

  const active = (data.alerts || []).filter((a) => {
    const s = a.status || (a.acknowledged ? "acknowledged" : "new");
    return s !== "resolved" && s !== "dismissed";
  }).length;

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader
        title={t("alerts.title")}
        subtitle={t("alerts.subtitle", { count: active })}
      />
      <div style={{ padding: "20px 32px" }}>
        <div className="aar-alerts-grid" style={{
          display: "grid",
          gridTemplateColumns: (isSecurity || isAdmin) ? "1fr 380px" : "1fr",
          gap: 16,
        }}>
          <AlertFeed
            alerts={data.alerts}
            onUpdated={data.handleAlertUpdate}
            onBulkChange={data.refresh}
            limit={50}
          />
          {(isSecurity || isAdmin) && <SuspiciousReport />}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .aar-alerts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
