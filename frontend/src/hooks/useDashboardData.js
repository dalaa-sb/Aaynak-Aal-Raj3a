import { useState, useEffect, useCallback, useRef } from "react";
import { fetchDashboardSummary, fetchAlerts, acknowledgeAlert } from "../services/api";
import useWebSocket from "./useWebSocket";

export default function useDashboardData() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [queueHistory, setQueueHistory] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const tRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([fetchDashboardSummary(), fetchAlerts(50)]);
      setSummary(s);
      setAlerts(a);
      setLastUpdate(new Date());
      setQueueHistory(
        a.filter((x) => x.value != null && x.alert_type?.includes("queue"))
          .slice(0, 30).reverse()
          .map((x) => ({
            time: new Date(x.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            count: Math.round(x.value),
            zone: x.zone,
          }))
      );
    } catch (e) { console.error("Fetch error:", e); }
  }, []);

  const debouncedFetch = useCallback(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(fetchData, 2000);
  }, [fetchData]);

  const handleWs = useCallback((msg) => {
    if (msg.type === "alert") {
      setAlerts((p) => [msg.data, ...p].slice(0, 80));
      setLastUpdate(new Date());
      debouncedFetch();
    }
    if (msg.type === "alert_status") {
      setAlerts((p) => p.map((a) => a.id === msg.data.id ? { ...a, status: msg.data.status } : a));
      setLastUpdate(new Date());
    }
    if (msg.type === "queue_update") {
      setQueueHistory((p) => [...p.slice(-29), {
        time: new Date(msg.data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        count: msg.data.person_count,
        zone: msg.data.zone,
      }]);
      setSummary((prev) => {
        if (!prev) return prev;
        const uz = (prev.zone_statuses || []).map((z) =>
          z.zone === msg.data.zone
            ? { ...z, current_occupancy: msg.data.person_count, avg_wait_minutes: msg.data.estimated_wait_minutes }
            : z
        );
        return { ...prev, zone_statuses: uz, total_passengers: uz.reduce((s, z) => s + (z.current_occupancy || 0), 0) };
      });
      setLastUpdate(new Date());
    }
    if (msg.type === "tracking_event") setLastUpdate(new Date());
  }, [debouncedFetch]);

  const { connected: wsConnected } = useWebSocket(handleWs);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => { clearInterval(i); if (tRef.current) clearTimeout(tRef.current); };
  }, [fetchData]);

  const handleAck = useCallback(async (id) => {
    try {
      await acknowledgeAlert(id);
      setAlerts((p) => p.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch (e) { console.error(e); }
  }, []);

  const handleAlertUpdate = useCallback((updated) => {
    if (!updated || !updated.id) return;
    setAlerts((p) => p.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  }, []);

  return { summary, alerts, queueHistory, wsConnected, handleAck, handleAlertUpdate, lastUpdate, refresh: fetchData };
}
