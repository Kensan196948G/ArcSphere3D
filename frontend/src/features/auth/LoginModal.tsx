import { useState } from "react";
import { useAuthStore } from "@/state/authStore";

interface Props {
  onClose: () => void;
}

export default function LoginModal({ onClose }: Props) {
  const login = useAuthStore((s) => s.login);
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
        className="w-80 rounded-lg bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-arc-accent">
          Sign In
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs text-slate-400">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-arc-accent"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs text-slate-400">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-arc-accent"
              required
            />
          </div>
          {error && (
            <p className="text-xs text-rose-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-arc-accent/80 py-1.5 text-sm font-medium text-slate-900 hover:bg-arc-accent disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
