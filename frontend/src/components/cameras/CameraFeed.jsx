import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Webcam, Film } from "lucide-react";
import { MONO, FONT } from "../../services/config";
import { useI18n } from "../../context/I18nContext";

export default function CameraFeed({ camera, name, queueCount, waitMinutes, zoneStatus, onClick }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamFailed, setWebcamFailed] = useState(false);

  // Webcam acquisition for CAM-01 only
  useEffect(() => {
    if (camera.source.kind !== "webcam") return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360 }, audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        // Fallback to demo video if webcam denied/unavailable
        if (!cancelled) setWebcamFailed(true);
      }
    };
    acquire();

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((tr) => tr.stop());
    };
  }, [camera.source.kind]);

  const live = camera.source.kind === "webcam" ? !webcamFailed : true;
  const sc = zoneStatus === "critical" ? "#ef4444"
           : zoneStatus === "warning"  ? "#f59e0b"
           : zoneStatus === "high"     ? "#fb923c"
           : "#10b981";

  const labelTag = camera.source.kind === "webcam"
    ? (webcamFailed ? t("cameras.demoFootage") : t("cameras.webcamLive"))
    : t("cameras.demoFootage");

  return (
    <button onClick={onClick} style={{
      borderRadius: 14, overflow: "hidden", padding: 0, textAlign: "left",
      cursor: "pointer", fontFamily: FONT,
      border: live ? "1px solid rgba(56,189,248,0.08)" : "1px solid rgba(30,41,59,0.3)",
      background: "rgba(15,23,42,0.4)", transition: "all 0.2s",
      display: "block", width: "100%",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "rgba(56,189,248,0.25)";
      e.currentTarget.style.transform = "translateY(-2px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = live ? "rgba(56,189,248,0.08)" : "rgba(30,41,59,0.3)";
      e.currentTarget.style.transform = "translateY(0)";
    }}>
      {/* Video preview */}
      <div style={{ height: 160, background: "#080c14", position: "relative",
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {camera.source.kind === "webcam" && !webcamFailed ? (
          <video ref={videoRef} muted playsInline autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : camera.source.kind === "video" ? (
          <video src={camera.source.src} muted playsInline autoPlay loop
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}

        {/* Fallback placeholder always behind the video — visible if video fails */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {live ? (
            <div style={{ textAlign: "center" }}>
              {camera.source.kind === "webcam"
                ? <Webcam size={22} color="#38bdf8" strokeWidth={1.5} style={{ marginBottom: 4 }} />
                : <Film size={22} color="#38bdf8" strokeWidth={1.5} style={{ marginBottom: 4 }} />}
              <p style={{ color: "#38bdf8", fontSize: 9, fontFamily: MONO,
                letterSpacing: "0.1em", margin: 0 }}>
                {labelTag}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <VideoOff size={22} color="#1e293b" style={{ marginBottom: 4 }} />
              <p style={{ color: "#475569", fontSize: 9, margin: 0, fontFamily: MONO }}>{t("cameras.offline")}</p>
            </div>
          )}
        </div>

        {/* Live/Demo badge */}
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2,
          display: "flex", alignItems: "center", gap: 4,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(0,0,0,0.7)", fontFamily: MONO }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%",
            background: live ? "#10b981" : "#334155",
            boxShadow: live ? "0 0 6px rgba(16,185,129,0.5)" : "none" }} />
          <span style={{ fontSize: 8, color: live ? "#34d399" : "#334155",
            fontWeight: 600, letterSpacing: "0.1em" }}>
            {live ? t("cameras.live") : t("cameras.off")}
          </span>
        </div>

        {queueCount != null && live && (
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2,
            padding: "2px 8px", borderRadius: 4,
            background: `${sc}15`, border: `1px solid ${sc}30`, fontFamily: MONO }}>
            <span style={{ fontSize: 9, color: sc, fontWeight: 600 }}>
              {queueCount} {t("cameras.people")}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex",
        justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: 0 }}>{name}</p>
          <p style={{ color: "#334155", fontSize: 9, margin: "2px 0 0", fontFamily: MONO }}>
            {camera.id} · {camera.zone?.replace(/_/g, " ")}
          </p>
        </div>
        {zoneStatus && (
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: sc, boxShadow: `0 0 8px ${sc}40` }} />
        )}
      </div>
    </button>
  );
}
