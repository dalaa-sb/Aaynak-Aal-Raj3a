import { FONT } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import CameraGrid, { CAMERAS } from "../components/cameras/CameraGrid";
import { useI18n } from "../context/I18nContext";

export default function CamerasPage({ data }) {
  const { t } = useI18n();
  const camCount = CAMERAS.length;
  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader
        title={t("nav.cameras")}
        subtitle={`${camCount} ${t("cameras.activeFeeds").toUpperCase()}`}
      />
      <div style={{ padding: "20px 32px" }}>
        <CameraGrid zones={data?.summary?.zone_statuses} alerts={data?.alerts} />
      </div>
    </div>
  );
}
