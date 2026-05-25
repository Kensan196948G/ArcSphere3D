import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
  useNotificationStore,
} from "@/state/notificationStore";
import type { NotificationType } from "@/state/notificationStore";

const WS_PROTO = window.location.protocol === "https:" ? "wss:" : "ws:";

interface WsMessage {
  type?: NotificationType;
  message?: string;
}

export function useNotificationWS(): void {
  const token = useAuthStore((s) => s.token);
  const incrementWsUnread = useNotificationStore((s) => s.incrementWsUnread);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const url = `${WS_PROTO}//${window.location.host}/api/ws/notifications?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        const type = msg.type ?? "info";
        const message = msg.message ?? "";
        incrementWsUnread();
        if (type === "success") notifySuccess(message);
        else if (type === "error") notifyError(message);
        else if (type === "warning") notifyWarning(message);
        else notifyInfo(message);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, incrementWsUnread]);
}
