import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { notifyError, notifySuccess } from "@/state/notificationStore";
import { patchUserMe } from "@/lib/api";

export default function ProfilePanel() {
  const token = useAuthStore((s) => s.token);

  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="p-4 text-sm text-slate-500">ログインが必要です。</div>
    );
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setLoading(true);
    try {
      await patchUserMe(token!, { email: newEmail.trim() });
      notifySuccess("メールアドレスを変更しました");
      setNewEmail("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "メール変更に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      notifyError("新しいパスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      await patchUserMe(token!, {
        current_password: currentPw,
        new_password: newPw,
      });
      notifySuccess("パスワードを変更しました");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "パスワード変更に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 text-sm">
      <h2 className="font-semibold text-slate-700 dark:text-slate-200">
        👤 プロフィール編集
      </h2>

      {/* Email change */}
      <form onSubmit={handleEmailChange} className="flex flex-col gap-2">
        <h3 className="font-medium text-slate-600 dark:text-slate-300">
          メールアドレス変更
        </h3>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="新しいメールアドレス"
          required
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          data-testid="profile-new-email"
        />
        <button
          type="submit"
          disabled={loading || !newEmail.trim()}
          className="rounded bg-arc-accent px-3 py-1.5 text-white disabled:opacity-50 hover:bg-arc-accent/90"
        >
          変更する
        </button>
      </form>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Password change */}
      <form onSubmit={handlePasswordChange} className="flex flex-col gap-2">
        <h3 className="font-medium text-slate-600 dark:text-slate-300">
          パスワード変更
        </h3>
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          placeholder="現在のパスワード"
          required
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          data-testid="profile-current-pw"
        />
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="新しいパスワード (8〜72文字)"
          required
          minLength={8}
          maxLength={72}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          data-testid="profile-new-pw"
        />
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          placeholder="新しいパスワード (確認)"
          required
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          data-testid="profile-confirm-pw"
        />
        <button
          type="submit"
          disabled={loading || !currentPw || !newPw || !confirmPw}
          className="rounded bg-arc-accent px-3 py-1.5 text-white disabled:opacity-50 hover:bg-arc-accent/90"
        >
          パスワード変更
        </button>
      </form>
    </div>
  );
}
