import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useSceneStore } from "@/state/sceneStore";
import LoginModal from "@/features/auth/LoginModal";

export default function Header() {
  const objectCount = useSceneStore((s) => s.objects.length);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-wide text-arc-accent">
            ⌬ ArcSphere3D
          </span>
          <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs uppercase text-slate-300">
            MVP
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Objects: {objectCount}</span>
          <span className="text-slate-500">v0.1.0</span>
          {token ? (
            <button
              type="button"
              onClick={logout}
              className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-300 hover:bg-slate-700"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="rounded bg-arc-accent/80 px-2 py-0.5 text-slate-900 hover:bg-arc-accent"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
