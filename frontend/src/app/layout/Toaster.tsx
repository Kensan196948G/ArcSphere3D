import { useEffect } from "react";
import { useNotificationStore, type Notification } from "@/state/notificationStore";

const TYPE_CLASSES: Record<Notification["type"], string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-sky-600 text-white",
  warning: "bg-amber-500 text-white",
};

function ToastItem({ n }: { n: Notification }) {
  const remove = useNotificationStore((s) => s.removeNotification);

  useEffect(() => {
    const timer = setTimeout(() => remove(n.id), 3000);
    return () => clearTimeout(timer);
  }, [n.id, remove]);

  return (
    <div
      data-testid="toast-item"
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs shadow-lg ${TYPE_CLASSES[n.type]}`}
    >
      <span>{n.message}</span>
      <button
        type="button"
        onClick={() => remove(n.id)}
        className="shrink-0 opacity-70 hover:opacity-100"
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>
  );
}

export default function Toaster() {
  const notifications = useNotificationStore((s) => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <ToastItem n={n} />
        </div>
      ))}
    </div>
  );
}
