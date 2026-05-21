import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useViewportStore } from "@/state/viewportStore";

function PasswordChangeForm() {
  const token = useAuthStore((s) => s.token);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setMsg({ ok: false, text: "新パスワードは 8 文字以上にしてください。" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (res.status === 204) {
        setMsg({ ok: true, text: "パスワードを変更しました。" });
        setCurrent("");
        setNext("");
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: (body as { detail?: string }).detail ?? "変更に失敗しました。" });
      }
    } catch {
      setMsg({ ok: false, text: "ネットワークエラーが発生しました。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
      <input
        type="password"
        placeholder="現在のパスワード"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
        data-testid="pw-current"
        className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
      />
      <input
        type="password"
        placeholder="新しいパスワード (8 文字以上)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
        minLength={8}
        data-testid="pw-new"
        className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
      />
      <button
        type="submit"
        disabled={busy || !current || !next}
        data-testid="pw-submit"
        className="rounded bg-arc-accent/70 py-1 text-[10px] text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
      >
        {busy ? "変更中…" : "パスワードを変更"}
      </button>
      {msg && (
        <p
          className={msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}
          data-testid="pw-message"
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}

export default function SettingsPanel() {
  const {
    bgColor, setBgColor,
    gridSize, setGridSize,
    ambientIntensity, setAmbientIntensity,
    dirIntensity, setDirIntensity,
  } = useViewportStore();

  return (
    <div className="flex flex-col gap-4 text-xs">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        ビューポート設定
      </h3>

      {/* 背景色 */}
      <label className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">背景色</span>
        <input
          type="color"
          value={bgColor}
          onChange={(e) => setBgColor(e.target.value)}
          className="h-7 w-16 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[10px] text-slate-400">{bgColor}</span>
      </label>

      {/* グリッドサイズ */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          グリッドサイズ: {gridSize}
        </span>
        <input
          type="range"
          min={5} max={100} step={5}
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <hr className="border-slate-200 dark:border-slate-700" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        ライティング
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          環境光: {ambientIntensity.toFixed(2)}
        </span>
        <input
          type="range"
          min={0} max={3} step={0.05}
          value={ambientIntensity}
          onChange={(e) => setAmbientIntensity(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          指向光: {dirIntensity.toFixed(2)}
        </span>
        <input
          type="range"
          min={0} max={3} step={0.05}
          value={dirIntensity}
          onChange={(e) => setDirIntensity(Number(e.target.value))}
          className="accent-arc-accent"
        />
      </label>

      <hr className="border-slate-200 dark:border-slate-700" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        パフォーマンス
      </h3>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        DPR: {Math.min(window.devicePixelRatio, 2).toFixed(1)} (最大 2.0 に制限)
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        レンダラー: WebGL 2 (antialias 有効)
      </p>

      <hr className="border-slate-200 dark:border-slate-700" />

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        アカウント
      </h3>
      <PasswordChangeForm />
    </div>
  );
}
