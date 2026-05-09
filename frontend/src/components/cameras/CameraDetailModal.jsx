import { useEffect, useRef, useState } from "react";
import { X, Webcam, Film, Bell, Clock, Users, ShieldAlert, Smile } from "lucide-react";
import { FONT, MONO, ARABIC, C } from "../../services/config";
import { useI18n } from "../../context/I18nContext";
import { satisfactionFromWait, satisfactionLabel, satisfactionColor } from "./CameraGrid";

export default function CameraDetailModal({ camera, alerts, onClose }) {
  const { t, lang, isRTL } = useI18n();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamFailed, setWebcamFailed] = useState(false);

  // Webcam stream lifecycle for CAM-01 (independent from grid card; modal owns its own)
  useEffect(() => {
    if (camera.source.kind !== "webcam") return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }, audio: false,
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

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const liveBadge = camera.source.kind === "webcam"
    ? (webcamFailed ? t("cameras.demoFootage") : t("cameras.webcamLive"))
    : t("cameras.demoFootage");

  const satisfactionScore = satisfactionFromWait(camera.waitMinutes);
  const satColor = satisfactionColor(satisfactionScore);
  const satText = satisfactionLabel(satisfactionScore, t);

  const sc = camera.zoneStatus === "critical" ? "#ef4444"
           : camera.zoneStatus === "warning"  ? "#f59e0b"
           : camera.zoneStatus === "high"     ? "#fb923c"
           : "#10b981";

  // Filter recent alerts to this camera (last 5, by camera_id or zone)
  const recentAlerts = (alerts || [])
    .filter((a) => a.camera_id === camera.id || a.zone === camera.zone)
    .slice(0, 5);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      padding: 20, overflowY: "auto",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      fontFamily: lang === "ar" ? ARABIC : FONT,
      direction: isRTL ? "rtl" : "ltr",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 760, marginTop: 30, marginBottom: 30,
        borderRadius: 16, background: "rgba(11,20,38,0.97)",
        border: `1px solid ${sc}40`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${sc}20`,
        position: "relative", overflow: "hidden",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, [isRTL ? "left" : "right"]: 14, zIndex: 5,
          background: "rgba(0,0,0,0.4)", border: "none", cursor: "pointer",
          padding: 6, borderRadius: 6, color: "#cbd5e1",
        }}><X size={18} /></button>

        {/* Video area */}
        <div style={{ height: 360, background: "#080c14", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {camera.source.kind === "webcam" && !webcamFailed ? (
            <video ref={videoRef} muted playsInline autoPlay
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : camera.source.kind === "video" ? (
            <video src={camera.source.src} muted playsInline autoPlay loop controls
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : null}

          {/* Fallback if webcam denied + retry */}
          {camera.source.kind === "webcam" && webcamFailed && (
            <div style={{ position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Webcam size={36} color="#475569" />
              <p style={{ color: "#94a3b8", fontSize: 12, margin: "10px 0", fontFamily: MONO }}>
                {t("cameras.webcamDenied")}
              </p>
              <button onClick={() => { setWebcamFailed(false); }} style={{
                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "rgba(56,189,248,0.15)", color: "#7dd3fc",
                fontSize: 11, fontFamily: MONO, fontWeight: 600,
              }}>{t("cameras.modal.tryWebcam")}</button>
            </div>
          )}

          {/* Live/Demo badge */}
          <div style={{ position: "absolute", top: 14, [isRTL ? "right" : "left"]: 14, zIndex: 2,
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(0,0,0,0.65)", fontFamily: MONO }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%",
              background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.5)" }} />
            <span style={{ fontSize: 9, color: "#34d399", fontWeight: 600,
              letterSpacing: "0.1em" }}>{liveBadge}</span>
          </div>
        </div>

        {/* Header strip */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(56,189,248,0.06)" }}>
          <h2 style={{ color: "#f0f9ff", fontSize: 22, fontWeight: 700, margin: 0 }}>
            {t(camera.nameKey)}
          </h2>
          <p style={{ color: "#475569", fontSize: 11, margin: "4px 0 0", fontFamily: MONO,
            letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {camera.id} · {camera.zone?.replace(/_/g, " ")}
          </p>
        </div>

        {/* Operational stats grid */}
        <div style={{ padding: "16px 22px" }}>
          <h3 style={{ fontSize: 10, fontWeight: 600, color: "#475569", margin: "0 0 12px",
            fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("cameras.modal.operationalData")}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Stat icon={Users} label={t("cameras.modal.queueCount")}
              value={camera.queueCount}
              color="#7dd3fc" />
            <Stat icon={Clock} label={t("cameras.modal.estimatedWait")}
              value={`${Math.round(camera.waitMinutes)} ${t("cameras.modal.minutes")}`}
              color="#a78bfa" />
            <Stat icon={Smile} label={t("cameras.modal.satisfaction")}
              value={`${satisfactionScore}%`}
              sub={satText}
              color={satColor} />
          </div>

          {/* Satisfaction bar */}
          <div style={{ marginTop: 14, height: 6, borderRadius: 3,
            background: "rgba(15,23,42,0.6)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${satisfactionScore}%`,
              background: satColor, transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* Recent alerts */}
        <div style={{ padding: "0 22px 22px" }}>
          <h3 style={{ fontSize: 10, fontWeight: 600, color: "#475569", margin: "8px 0 12px",
            fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={11} /> {t("cameras.modal.recentAlerts")}
          </h3>
          {recentAlerts.length === 0 ? (
            <p style={{ color: "#475569", fontSize: 12, margin: 0,
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(15,23,42,0.4)", border: `1px solid ${C.border}` }}>
              {t("cameras.modal.noRecentAlerts")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentAlerts.map((a) => {
                const alertColor =
                  a.severity === "critical" ? "#ef4444" :
                  a.severity === "high"     ? "#fb923c" :
                  a.severity === "medium"   ? "#fbbf24" : "#34d399";
                return (
                  <div key={a.id} style={{ padding: "8px 12px", borderRadius: 8,
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    background: "rgba(15,23,42,0.4)", border: `1px solid ${alertColor}20` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <ShieldAlert size={12} color={alertColor} />
                      <span style={{ color: "#e2e8f0", fontSize: 12,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.message || a.activity_type || a.severity}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, fontFamily: MONO, color: "#64748b",
                      flexShrink: 0 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8,
      background: "rgba(15,23,42,0.5)", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        fontSize: 9, fontFamily: MONO, color: "#64748b",
        letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
        <Icon size={10} /> {label}
      </div>
      <div style={{ color, fontSize: 18, fontWeight: 700, fontFamily: MONO }}>
        {value}
      </div>
      {sub && <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
