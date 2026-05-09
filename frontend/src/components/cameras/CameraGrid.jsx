import { useState } from "react";
import CameraFeed from "./CameraFeed";
import CameraDetailModal from "./CameraDetailModal";
import { useI18n } from "../../context/I18nContext";
import { MONO } from "../../services/config";

/**
 * Six-camera demo configuration.
 *
 * - id           : stable backend identifier (CAM-01 … CAM-06)
 * - zone         : matches the zone codes used in alerts/queue_snapshots
 * - source       : { kind: "webcam" } uses getUserMedia; { kind: "video", src }
 *                  plays a local demo MP4 from /demo-videos/
 * - profile      : per-camera demo behavior — wait time, queue, alert flavor.
 *                  Drives the satisfaction score so each camera looks distinct.
 *
 * Demo videos are expected at frontend/public/demo-videos/*.mp4 (see README).
 * If a video file is missing, the <video> tag will fail gracefully and the
 * tile will display the offline placeholder.
 */
export const CAMERAS = [
  {
    id: "CAM-01", zone: "check_in_a", nameKey: "cameras.names.checkInA",
    source: { kind: "webcam" },
    profile: { queueBase: 8,  waitMinutes: 4,  alertFreq: "low" },
  },
  {
    id: "CAM-02", zone: "check_in_b", nameKey: "cameras.names.checkInB",
    source: { kind: "video", src: "/demo-videos/check-in-hall.mp4" },
    profile: { queueBase: 22, waitMinutes: 12, alertFreq: "medium" },
  },
  {
    id: "CAM-03", zone: "security_1", nameKey: "cameras.names.securityCheckpoint",
    source: { kind: "video", src: "/demo-videos/security.mp4" },
    profile: { queueBase: 35, waitMinutes: 22, alertFreq: "high" },
  },
  {
    id: "CAM-04", zone: "duty_free", nameKey: "cameras.names.dutyFree",
    source: { kind: "video", src: "/demo-videos/duty-free.mp4" },
    profile: { queueBase: 14, waitMinutes: 6,  alertFreq: "low" },
  },
  {
    id: "CAM-05", zone: "gates_d", nameKey: "cameras.names.gateD",
    source: { kind: "video", src: "/demo-videos/gate-area.mp4" },
    profile: { queueBase: 18, waitMinutes: 9,  alertFreq: "low" },
  },
  {
    id: "CAM-06", zone: "passport_control", nameKey: "cameras.names.passportControl",
    source: { kind: "video", src: "/demo-videos/passport-control.mp4" },
    profile: { queueBase: 42, waitMinutes: 28, alertFreq: "high" },
  },
];


/**
 * Compute a passenger satisfaction score (0–100) from wait time.
 *
 * Short waits → very satisfied. Long waits → frustrated.
 * Pure function — same input always produces the same score, but each
 * camera has a different baseline because each `profile.waitMinutes` differs.
 */
export function satisfactionFromWait(waitMinutes) {
  const w = Number(waitMinutes) || 0;
  if (w <= 3)  return 95;
  if (w <= 6)  return 85;
  if (w <= 10) return 72;
  if (w <= 15) return 58;
  if (w <= 22) return 42;
  if (w <= 30) return 28;
  return 15;
}

export function satisfactionLabel(score, t) {
  if (score >= 85) return t("cameras.modal.satisfactionVerySatisfied");
  if (score >= 70) return t("cameras.modal.satisfactionSatisfied");
  if (score >= 50) return t("cameras.modal.satisfactionNeutral");
  if (score >= 30) return t("cameras.modal.satisfactionFrustrated");
  return t("cameras.modal.satisfactionVeryFrustrated");
}

export function satisfactionColor(score) {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#fbbf24";
  if (score >= 30) return "#fb923c";
  return "#ef4444";
}


export default function CameraGrid({ zones, alerts }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);

  const zonesByKey = {};
  (zones || []).forEach((z) => { zonesByKey[z.zone] = z; });

  return (
    <>
      <p style={{ color: "#475569", fontSize: 11, fontFamily: MONO,
        margin: "0 0 14px", letterSpacing: "0.05em", textAlign: "center" }}>
        {t("cameras.clickForDetails")}
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {CAMERAS.map((c) => {
          const zd = zonesByKey[c.zone];
          // Effective queue/wait — prefer real backend data, otherwise demo profile
          const queueCount = zd?.current_occupancy ?? c.profile.queueBase;
          const waitMinutes = zd?.avg_wait_minutes ?? c.profile.waitMinutes;
          return (
            <CameraFeed
              key={c.id}
              camera={c}
              name={t(c.nameKey)}
              queueCount={queueCount}
              waitMinutes={waitMinutes}
              zoneStatus={zd?.status}
              onClick={() => setSelected({ ...c, queueCount, waitMinutes, zoneStatus: zd?.status })}
            />
          );
        })}
      </div>
      {selected && (
        <CameraDetailModal
          camera={selected}
          alerts={alerts || []}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
