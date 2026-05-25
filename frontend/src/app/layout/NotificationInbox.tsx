import { useEffect, useRef } from "react";
import { useAuthStore } from "@/state/authStore";
import { useNotificationStore } from "@/state/notificationStore";

export default function NotificationInbox() {
  const token = useAuthStore((s) => s.token);
  const { inboxItems, inboxOpen, setInboxOpen, fetchInbox, markRead, markAllRead } =
    useNotificationStore();

  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch inbox when opening
  useEffect(() => {
    if (inboxOpen && token) {
      fetchInbox(token).catch(() => {});
    }
  }, [inboxOpen, token, fetchInbox]);

  // Close on outside click
  useEffect(() => {
    if (!inboxOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [inboxOpen, setInboxOpen]);

  if (!inboxOpen) return null;

  return (
    <div
      ref={panelRef}
      data-testid="notification-inbox"
      className="absolute right-4 top-10 z-50 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">通知</span>
        {inboxItems.some((i) => !i.is_read) && (
          <button
            type="button"
            data-testid="mark-all-read"
            onClick={() => token && markAllRead(token).catch(() => {})}
            className="text-xs text-arc-accent hover:underline"
          >
            すべて既読
          </button>
        )}
      </div>

      <ul className="max-h-72 overflow-y-auto">
        {inboxItems.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-slate-400">通知はありません</li>
        ) : (
          inboxItems.map((item) => (
            <li
              key={item.id}
              className={`flex items-start gap-2 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-700 ${
                item.is_read ? "opacity-60" : "bg-slate-50 dark:bg-slate-700/30"
              }`}
            >
              <span className="mt-0.5 text-base">{typeIcon(item.type)}</span>
              <div className="flex-1 text-xs text-slate-600 dark:text-slate-300">
                <p>{item.message}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(item.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              {!item.is_read && (
                <button
                  type="button"
                  onClick={() => token && markRead(token, item.id).catch(() => {})}
                  className="shrink-0 text-[10px] text-arc-accent hover:underline"
                  title="既読にする"
                >
                  既読
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    default:
      return "ℹ️";
  }
}
