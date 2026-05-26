import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import { notifyError, notifyInfo, notifySuccess, notifyWarning, useNotificationStore } from "@/state/notificationStore";
import type { NotificationItem } from "@/lib/api";

type WsMessage = {
  type: "success" | "error" | "info" | "warning";
  message: string;
  /** Server may include the persisted notification id for inbox prepending */
  id?: string;
  user_id?: string;
  is_read?: boolean;
  created_at?: string;
};

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "";

function resolveWsUrl(token: string): string {
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

        // Show ephemeral toast
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

        // Prepend to persistent inbox if server provided an id
        if (msg.id) {
          const item: NotificationItem = {
            id: msg.id,
            user_id: msg.user_id ?? "",
            type: msg.type,
            message: msg.message,
            is_read: msg.is_read ?? false,
            created_at: msg.created_at ?? new Date().toISOString(),
          };
          useNotificationStore.getState().prependInboxItem(item);
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
