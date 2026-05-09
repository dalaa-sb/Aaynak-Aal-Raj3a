import { FONT, MONO } from "../services/config";
import { User, Sliders, Lock } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import EditProfile from "../components/profile/EditProfile";
import ThresholdConfig from "../components/admin/ThresholdConfig";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();

  return (
    <div style={{ fontFamily: FONT, color: "#e2e8f0", animation: "fadeIn 0.4s ease" }}>
      <PageHeader
        title={t("settings.title")}
        subtitle={isAdmin ? t("settings.subtitle") : t("settings.subtitleNonAdmin")}
      />
      <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Section: Personal Information + Language Preference */}
        <section>
          <SectionHeader icon={User} label={t("settings.sections.personal")} />
          <EditProfile />
        </section>

        {/* Section: System Thresholds — always visible, editable only by admin */}
        <section>
          <SectionHeader
            icon={Sliders}
            label={t("settings.sections.systemThresholds")}
            badge={!isAdmin ? { icon: Lock, text: t("settings.adminOnly") } : null}
          />
          <ThresholdConfig />
        </section>

      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      {Icon && <Icon size={14} color="#7dd3fc" />}
      <h2 style={{
        fontSize: 11, fontWeight: 700, color: "#7dd3fc", margin: 0,
        fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase",
      }}>{label}</h2>
      <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,0.08)", marginLeft: 8 }} />
      {badge && (
        <span style={{
          fontSize: 9, fontFamily: MONO, fontWeight: 600,
          color: "#94a3b8", letterSpacing: "0.06em",
          padding: "2px 8px", borderRadius: 4,
          background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {badge.icon && <badge.icon size={9} />} {badge.text}
        </span>
      )}
    </div>
  );
}
