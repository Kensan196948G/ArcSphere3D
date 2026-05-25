import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { patchUserMe } from "@/lib/api";
import { notifyError, notifySuccess } from "@/state/notificationStore";

type Tab = "email" | "password";

export default function ProfilePanel() {
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<Tab>("email");

  // email form
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  if (!token) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        ログインしてプロフィールを編集します。
      </p>
    );
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    setEmailLoading(true);
    try {
      await patchUserMe(token!, { email: newEmail });
      notifySuccess("メールアドレスを更新しました");
      setNewEmail("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "メール更新に失敗しました");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      notifyError("新しいパスワードと確認パスワードが一致しません");
      return;
    }
    setPwLoading(true);
    try {
      await patchUserMe(token!, { current_password: currentPw, new_password: newPw });
      notifySuccess("パスワードを更新しました");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "パスワード更新に失敗しました");
    } finally {
      setPwLoading(false);
    }
  }

  const tabBtn = (id: Tab, label: string) =>
    `px-3 py-1 text-xs font-medium rounded-t border-b-2 transition ${
      tab === id
        ? "border-arc-accent text-arc-accent"
        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
    }`;

  const inputClass =
    "w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 " +
    "focus:outline-none focus:ring-1 focus:ring-arc-accent dark:border-slate-600 " +
    "dark:bg-slate-800 dark:text-slate-100";

  const btnClass =
    "mt-2 w-full rounded bg-arc-accent px-3 py-1.5 text-xs font-semibold text-white " +
    "hover:bg-arc-accent/90 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button type="button" className={tabBtn("email", "メール")} onClick={() => setTab("email")}>
          メール変更
        </button>
        <button
          type="button"
          className={tabBtn("password", "パスワード")}
          onClick={() => setTab("password")}
        >
          パスワード変更
        </button>
      </div>

      {tab === "email" && (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">新しいメールアドレス</label>
          <input
            type="email"
            className={inputClass}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
            required
          />
          <button type="submit" className={btnClass} disabled={emailLoading}>
            {emailLoading ? "更新中…" : "メールを更新"}
          </button>
        </form>
      )}

      {tab === "password" && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">現在のパスワード</label>
          <input
            type="password"
            className={inputClass}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            autoComplete="current-password"
          />
          <label className="text-xs text-slate-500 dark:text-slate-400">新しいパスワード</label>
          <input
            type="password"
            className={inputClass}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <label className="text-xs text-slate-500 dark:text-slate-400">新しいパスワード（確認）</label>
          <input
            type="password"
            className={inputClass}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            autoComplete="new-password"
          />
          <button type="submit" className={btnClass} disabled={pwLoading}>
            {pwLoading ? "更新中…" : "パスワードを更新"}
          </button>
        </form>
      )}
    </div>
  );
}
