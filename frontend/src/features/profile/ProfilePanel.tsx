import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { patchUserMe, parseJwtPayload } from "@/lib/api";
import { notifyError, notifySuccess } from "@/state/notificationStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(v: string): string | null {
  if (!v.trim()) return "メールアドレスを入力してください";
  if (!EMAIL_RE.test(v.trim())) return "有効なメールアドレスを入力してください";
  return null;
}

function validateNewPassword(v: string): string | null {
  if (v.length < 8) return "8文字以上で入力してください";
  if (v.length > 72) return "72文字以内で入力してください";
  if (!/^[\x20-\x7E]+$/.test(v)) return "半角英数字・記号のみ使用できます";
  return null;
}

export default function ProfilePanel() {
  const token = useAuthStore((s) => s.token);
  const payload = token ? parseJwtPayload(token) : null;
  const currentEmail = payload?.email ?? "";

  // Email form
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const err = validateEmail(newEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError(null);
    setEmailLoading(true);
    try {
      await patchUserMe(token, { email: newEmail.trim() });
      notifySuccess("メールアドレスを更新しました");
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : String(ex);
      if (msg.includes("409")) {
        setEmailError("このメールアドレスは既に使用されています");
      } else {
        notifyError("メールアドレスの更新に失敗しました");
      }
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!currentPw) {
      setPwError("現在のパスワードを入力してください");
      return;
    }
    const err = validateNewPassword(newPw);
    if (err) {
      setPwError(err);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("新しいパスワードが一致しません");
      return;
    }
    setPwError(null);
    setPwLoading(true);
    try {
      await patchUserMe(token, {
        current_password: currentPw,
        new_password: newPw,
      });
      notifySuccess("パスワードを更新しました");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : String(ex);
      if (msg.includes("401")) {
        setPwError("現在のパスワードが正しくありません");
      } else {
        notifyError("パスワードの更新に失敗しました");
      }
    } finally {
      setPwLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="p-4 text-sm text-slate-500">
        ログインしてください
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        プロフィール編集
      </h2>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          メールアドレス変更
        </h3>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor="profile-email">
            新しいメールアドレス
          </label>
          <input
            id="profile-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-arc-accent focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {emailError && (
            <span className="text-xs text-red-500">{emailError}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={emailLoading}
          className="self-start rounded bg-arc-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-arc-accent/80 disabled:opacity-50"
        >
          {emailLoading ? "更新中..." : "メールを更新"}
        </button>
      </form>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Password form */}
      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          パスワード変更
        </h3>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor="profile-current-pw">
            現在のパスワード
          </label>
          <input
            id="profile-current-pw"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-arc-accent focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor="profile-new-pw">
            新しいパスワード
          </label>
          <input
            id="profile-new-pw"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-arc-accent focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor="profile-confirm-pw">
            新しいパスワード（確認）
          </label>
          <input
            id="profile-confirm-pw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-arc-accent focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {pwError && (
            <span className="text-xs text-red-500">{pwError}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={pwLoading}
          className="self-start rounded bg-arc-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-arc-accent/80 disabled:opacity-50"
        >
          {pwLoading ? "更新中..." : "パスワードを更新"}
        </button>
      </form>
    </div>
  );
}
