import { FONT } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import QueuePrediction from "../components/analytics/QueuePrediction";
import HistoricalAnalysis from "../components/analytics/HistoricalAnalysis";
import WaitTimePrediction from "../components/analytics/WaitTimePrediction";
import PassengerFeedback from "../components/dashboard/PassengerFeedback";
import { useI18n } from "../context/I18nContext";

export default function AnalyticsPage({ data }) {
  const { t } = useI18n();
  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
      <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="aar-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <QueuePrediction queueHistory={data.queueHistory} />
          <WaitTimePrediction zones={data.summary?.zone_statuses} />
        </div>
        <HistoricalAnalysis zones={data.summary?.zone_statuses} alerts={data.alerts} />
        <PassengerFeedback zones={data.summary?.zone_statuses} />
      </div>
      <style>{`@media (max-width: 900px) { .aar-grid2 { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
