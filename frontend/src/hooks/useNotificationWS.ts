import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import { useNotificationStore, type NotificationType } from "@/state/notificationStore";

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

function buildWsUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/api/ws/notifications?token=${encodeURIComponent(token)}`;
}

export function useNotificationWS(): void {
  const token = useAuthStore((s) => s.token);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      attemptsRef.current = 0;
      return;
    }

    let cancelled = false;

    function connect() {
      if (cancelled || attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      const ws = new WebSocket(buildWsUrl(token!));
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as {
            type: NotificationType | "ping";
            message?: string;
          };
          if (data.type === "ping" || !data.message) return;
          addNotification(data.type, data.message);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        attemptsRef.current += 1;
        timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, addNotification]);
}
