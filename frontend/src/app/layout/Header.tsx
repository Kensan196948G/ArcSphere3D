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

  const wsUnreadCount = useNotificationStore((s) => s.wsUnreadCount);
  const clearWsUnread = useNotificationStore((s) => s.clearWsUnread);
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
              {/* 通知ベル */}
              <button
                type="button"
                onClick={clearWsUnread}
                title="通知"
                className="relative rounded bg-slate-200/80 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="通知"
              >
                🔔
                {wsUnreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
                    {wsUnreadCount > 99 ? "99+" : wsUnreadCount}
                  </span>
                )}
              </button>

              {/* プロフィール */}
              <button
                type="button"
                onClick={() => setActivePanel("profile")}
                title="プロフィール"
                className="rounded bg-slate-200/80 px-2 py-0.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                👤
              </button>

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
