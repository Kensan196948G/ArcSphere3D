import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/state/authStore";
import { patchUserMe } from "@/lib/api";
import { notifySuccess, notifyError } from "@/state/notificationStore";
import { parseJwtPayload } from "@/lib/api";

export default function ProfilePanel() {
  const token = useAuthStore((s) => s.token);

  const currentEmail = token ? (parseJwtPayload(token)?.email ?? "") : "";

  const [emailForm, setEmailForm] = useState({ email: currentEmail, current_password: "" });
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [emailBusy, setEmailBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  if (!token) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        ログインしてプロフィールを編集します。
      </p>
    );
  }

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault();
    if (!emailForm.email || !emailForm.current_password) return;
    setEmailBusy(true);
    try {
      await patchUserMe(token!, {
        email: emailForm.email,
        current_password: emailForm.current_password,
      });
      notifySuccess("メールアドレスを変更しました");
      setEmailForm((f) => ({ ...f, current_password: "" }));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "メール変更に失敗しました");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      notifyError("新しいパスワードが一致しません");
      return;
    }
    if (!pwForm.current_password || !pwForm.new_password) return;
    setPwBusy(true);
    try {
      await patchUserMe(token!, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      notifySuccess("パスワードを変更しました");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "パスワード変更に失敗しました");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Email change */}
      <section className="rounded border border-slate-200 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          メールアドレス変更
        </h3>
        <form onSubmit={handleEmailChange} className="flex flex-col gap-2">
          <label className="flex flex-col gap-0.5 text-xs">
            新しいメールアドレス
            <input
              type="email"
              value={emailForm.email}
              onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            現在のパスワード
            <input
              type="password"
              value={emailForm.current_password}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, current_password: e.target.value }))
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </label>
          <button
            type="submit"
            disabled={emailBusy}
            className="rounded bg-arc-accent/80 px-3 py-1 text-xs text-white hover:bg-arc-accent disabled:opacity-50"
          >
            {emailBusy ? "変更中…" : "変更する"}
          </button>
        </form>
      </section>

      {/* Password change */}
      <section className="rounded border border-slate-200 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          パスワード変更
        </h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-2">
          <label className="flex flex-col gap-0.5 text-xs">
            現在のパスワード
            <input
              type="password"
              value={pwForm.current_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, current_password: e.target.value }))
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            新しいパスワード (8〜72文字)
            <input
              type="password"
              value={pwForm.new_password}
              onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
              minLength={8}
              maxLength={72}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            新しいパスワード (確認)
            <input
              type="password"
              value={pwForm.confirm_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, confirm_password: e.target.value }))
              }
              minLength={8}
              maxLength={72}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pwBusy}
            className="rounded bg-arc-accent/80 px-3 py-1 text-xs text-white hover:bg-arc-accent disabled:opacity-50"
          >
            {pwBusy ? "変更中…" : "変更する"}
          </button>
        </form>
      </section>
    </div>
  );
}
