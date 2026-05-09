import { useState, useEffect, useRef } from "react";
import { WS_URL } from "../services/config";

/**
 * WebSocket connection hook with auth.
 *
 * Browsers cannot set custom headers on WebSocket connections, so we pass the
 * session JWT via the ?token=... query string. The backend validates it before
 * upgrading the connection. If the token is missing/invalid, the server closes
 * with code 1008 — we log the close reason but otherwise let the auto-reconnect
 * loop handle it.
 */
export default function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const cbRef = useRef(onMessage);
  useEffect(() => { cbRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    let timer;
    const connect = () => {
      const token = sessionStorage.getItem("token");
      // If user is not logged in, don't even try to connect. The reconnect
      // loop will retry on each tick and pick up the token once it appears.
      if (!token) {
        timer = setTimeout(connect, 3000);
        return;
      }
      const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      ws.onopen  = () => setConnected(true);
      ws.onclose = (e) => {
        setConnected(false);
        if (e.code === 1008) {
          // Auth rejection — token was rejected by the server. The user's
          // login state will be cleared by AuthContext on the next API call.
          console.warn("[ws] auth rejected:", e.reason);
        }
        timer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => { try { cbRef.current?.(JSON.parse(e.data)); } catch {} };
      wsRef.current = ws;
    };
    connect();
    return () => { clearTimeout(timer); wsRef.current?.close(); };
  }, []);

  return { connected };
}
