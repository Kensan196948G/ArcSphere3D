import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useSceneStore } from "@/state/sceneStore";
import { useThemeStore } from "@/state/themeStore";
import { useUiStore } from "@/state/uiStore";
import LoginModal from "@/features/auth/LoginModal";
import { parseJwtPayload } from "@/lib/api";
import { notifyInfo, useNotificationStore } from "@/state/notificationStore";

export default function Header() {
  const objectCount = useSceneStore((s) => s.objects.length);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useThemeStore();
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const [showLogin, setShowLogin] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const unreadCount = notifications.length;

  const userEmail = token ? (parseJwtPayload(token)?.email ?? null) : null;

  function handleLogout() {
    logout();
    notifyInfo("ログアウトしました");
    setActivePanel("model");
  }

  return (
    <>
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-wide text-arc-accent">
            ⌬ ArcSphere3D
          </span>
          <span className="rounded bg-slate-700/30 px-2 py-0.5 text-xs uppercase text-slate-400 dark:bg-slate-700/60 dark:text-slate-300">
            MVP
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>オブジェクト: {objectCount}</span>
          <span className="text-slate-400 dark:text-slate-500">v0.1.0</span>

          {/* 通知ベル */}
          {token && (
            <div className="relative">
              <button
                type="button"
                data-testid="notification-bell"
                onClick={() => setBellOpen((v) => !v)}
                className="relative rounded bg-slate-200/80 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
                title="通知"
              >
                🔔
                {unreadCount > 0 && (
                  <span
                    data-testid="notification-badge"
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-8 z-50 w-72 rounded border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      通知 {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBellOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      ✕
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-slate-400">
                      通知はありません
                    </p>
                  ) : (
                    <ul className="max-h-60 overflow-y-auto">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-700"
                        >
                          <span
                            className={`mt-0.5 text-xs font-bold ${
                              n.type === "success"
                                ? "text-green-500"
                                : n.type === "error"
                                  ? "text-red-500"
                                  : n.type === "warning"
                                    ? "text-yellow-500"
                                    : "text-blue-500"
                            }`}
                          >
                            {n.type === "success"
                              ? "✓"
                              : n.type === "error"
                                ? "✗"
                                : n.type === "warning"
                                  ? "⚠"
                                  : "ℹ"}
                          </span>
                          <span className="flex-1 text-xs text-slate-700 dark:text-slate-200">
                            {n.message}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeNotification(n.id)}
                            className="shrink-0 text-slate-300 hover:text-slate-500 dark:hover:text-slate-200"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ライト/ダーク切り替え */}
          <button
            type="button"
            onClick={toggle}
            title={
              theme === "dark"
                ? "ライトモードに切り替え"
                : "ダークモードに切り替え"
            }
            className="rounded bg-slate-200/80 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {token ? (
            <>
              {userEmail && (
                <span
                  data-testid="user-email"
                  className="max-w-[160px] truncate text-slate-400 dark:text-slate-500"
                  title={userEmail}
                >
                  {userEmail}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded bg-slate-200/80 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="rounded bg-arc-accent/80 px-2 py-0.5 text-white hover:bg-arc-accent dark:text-slate-900"
            >
              ログイン
            </button>
          )}
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
