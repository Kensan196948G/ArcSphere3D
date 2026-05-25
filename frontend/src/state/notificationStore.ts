import { create } from "zustand";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  wsUnreadCount: number;
  addNotification: (type: NotificationType, message: string) => void;
  removeNotification: (id: string) => void;
  incrementWsUnread: () => void;
  clearWsUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  wsUnreadCount: 0,
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
  incrementWsUnread: () => set((s) => ({ wsUnreadCount: s.wsUnreadCount + 1 })),
  clearWsUnread: () => set({ wsUnreadCount: 0 }),
}));

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
