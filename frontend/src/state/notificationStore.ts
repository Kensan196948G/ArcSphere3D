import { create } from "zustand";
import type { NotificationItem } from "@/lib/api";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

// ---- Toast (ephemeral) types -----------------------------------------------

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

// ---- Store -----------------------------------------------------------------

interface NotificationState {
  // Ephemeral toasts
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  removeNotification: (id: string) => void;

  // Persistent inbox
  inboxItems: NotificationItem[];
  unreadCount: number;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
  fetchInbox: (token: string) => Promise<void>;
  fetchUnreadCount: (token: string) => Promise<void>;
  markRead: (token: string, id: string) => Promise<void>;
  markAllRead: (token: string) => Promise<void>;
  /** Called by WS hook to prepend a new item without a full fetch */
  prependInboxItem: (item: NotificationItem) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  addNotification: (type, message) =>
    set((s) => ({
      notifications: [
        ...s.notifications,
        { id: `${Date.now()}-${Math.random()}`, type, message },
      ],
    })),
  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  inboxItems: [],
  unreadCount: 0,
  inboxOpen: false,

  setInboxOpen: (open) => set({ inboxOpen: open }),

  fetchInbox: async (token) => {
    const [items, unreadCount] = await Promise.all([
      listNotifications(token, { limit: 50 }),
      getUnreadCount(token),
    ]);
    set({ inboxItems: items, unreadCount });
  },

  fetchUnreadCount: async (token) => {
    const count = await getUnreadCount(token);
    set({ unreadCount: count });
  },

  markRead: async (token, id) => {
    const updated = await markNotificationRead(token, id);
    set((s) => ({
      inboxItems: s.inboxItems.map((i) => (i.id === id ? updated : i)),
      unreadCount: Math.max(0, s.unreadCount - (updated.is_read ? 1 : 0)),
    }));
    // Re-sync count from server to avoid drift
    await get().fetchUnreadCount(token);
  },

  markAllRead: async (token) => {
    await markAllNotificationsRead(token);
    set((s) => ({
      inboxItems: s.inboxItems.map((i) => ({ ...i, is_read: true })),
      unreadCount: 0,
    }));
  },

  prependInboxItem: (item) =>
    set((s) => {
      if (s.inboxItems.some((i) => i.id === item.id)) return {};
      return {
        inboxItems: [item, ...s.inboxItems],
        unreadCount: s.unreadCount + (item.is_read ? 0 : 1),
      };
    }),
}));

// ---- Convenience helpers ---------------------------------------------------

export function notifySuccess(message: string) {
  useNotificationStore.getState().addNotification("success", message);
}

export function notifyError(message: string) {
  useNotificationStore.getState().addNotification("error", message);
}

export function notifyInfo(message: string) {
  useNotificationStore.getState().addNotification("info", message);
}

export function notifyWarning(message: string) {
  useNotificationStore.getState().addNotification("warning", message);
}
