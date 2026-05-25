import { create } from "zustand";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
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
  clearAll: () => set({ notifications: [] }),
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
