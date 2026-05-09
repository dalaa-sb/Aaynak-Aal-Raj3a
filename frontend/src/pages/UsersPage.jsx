import { FONT } from "../services/config";
import PageHeader from "../components/shared/PageHeader";
import UserManagement from "../components/admin/UserManagement";
import { useI18n } from "../context/I18nContext";

export default function UsersPage() {
  const { t } = useI18n();
  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />
      <div style={{ padding: "20px 32px" }}><UserManagement /></div>
    </div>
  );
}
