import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useUiStore } from "@/state/uiStore";

interface Props {
  onClose: () => void;
}

export default function LoginModal({ onClose }: Props) {
  const login = useAuthStore((s) => s.login);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const [email, setEmail] = useState("demo@arcsphere3d.dev");
  const [password, setPassword] = useState("arcsphere-demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      setActivePanel("project");
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-arc-accent">
          ログイン
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-800 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              パスワード
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-800 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </div>
          {error && (
            <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-arc-accent/80 py-1.5 text-sm font-medium text-white hover:bg-arc-accent disabled:opacity-50 dark:text-slate-900"
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
