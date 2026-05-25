import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "@/state/notificationStore";

type WsMessage = {
  type: "success" | "error" | "info" | "warning";
  message: string;
};

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "";

function resolveWsUrl(token: string): string {
  // In dev the Vite proxy forwards /api/* to the backend.
  // Build the WebSocket URL using the current page origin.
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = WS_BASE || window.location.host;
  return `${proto}://${host}/api/ws/notifications?token=${encodeURIComponent(token)}`;
}

export function useNotificationWS() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const url = resolveWsUrl(token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        switch (msg.type) {
          case "success":
            notifySuccess(msg.message);
            break;
          case "error":
            notifyError(msg.message);
            break;
          case "warning":
            notifyWarning(msg.message);
            break;
          default:
            notifyInfo(msg.message);
        }
      } catch {
        // malformed message — ignore
      }
    };

    ws.onerror = () => {
      // Network error; the `onclose` handler will fire next.
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token]);
}
