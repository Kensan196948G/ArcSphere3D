import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "@/state/notificationStore";

const WS_BASE =
  import.meta.env.VITE_WS_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:8000");

const RECONNECT_DELAY_MS = 5000;

export function useNotificationWS() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(`${WS_BASE}/api/ws/notifications?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as {
            type: string;
            message: string;
          };
          switch (data.type) {
            case "success":
              notifySuccess(data.message);
              break;
            case "error":
              notifyError(data.message);
              break;
            case "warning":
              notifyWarning(data.message);
              break;
            default:
              notifyInfo(data.message);
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onclose = (ev) => {
        // 1008 = policy violation (auth failure) — do not reconnect
        if (ev.code === 1008 || cancelled) return;
        timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token]);
}
