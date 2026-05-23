import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  parseJwtPayload,
  resetAdminUserPassword,
  updateUserRole,
  type UserCreateRequest,
  type UserOut,
} from "@/lib/api";
import { useNotificationStore } from "@/state/notificationStore";

const PAGE_SIZE = 20;

const ROLES = ["viewer", "editor", "admin"] as const;
type Role = (typeof ROLES)[number];

interface PwResetState {
  userId: string;
  password: string;
  submitting: boolean;
}

const INIT_CREATE: UserCreateRequest = { email: "", password: "", role: "viewer" };

export default function AdminUsersPanel() {
  const token = useAuthStore((s) => s.token);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwReset, setPwReset] = useState<PwResetState | null>(null);
  const pwInputRef = useRef<HTMLInputElement>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<UserCreateRequest>(INIT_CREATE);
  const [creating, setCreating] = useState(false);

  const role = token ? (parseJwtPayload(token)?.role ?? "") : "";
  const myEmail = token ? (parseJwtPayload(token)?.email ?? "") : "";
  const myId = token ? (parseJwtPayload(token)?.sub ?? "") : "";

  const fetchUsers = useCallback(() => {
    if (!token || role !== "admin") return;
    setLoading(true);
    setError(null);
    listAdminUsers(token, page * PAGE_SIZE, PAGE_SIZE)
      .then(setUsers)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token, role, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // focus password input when modal opens
  useEffect(() => {
    if (pwReset) {
      setTimeout(() => pwInputRef.current?.focus(), 50);
    }
  }, [pwReset]);

  if (!token || role !== "admin") {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        管理者のみアクセス可能です。
      </p>
    );
  }

  async function handleDelete(user: UserOut) {
    if (!token) return;
    if (!confirm(`ユーザー「${user.email}」を削除しますか？この操作は取り消せません。`))
      return;
    try {
      await deleteAdminUser(token, user.id);
      fetchUsers();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function handleRoleChange(user: UserOut, newRole: Role) {
    if (!token) return;
    try {
      const updated = await updateUserRole(token, user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      addNotification("success", "ロールを変更しました");
    } catch (e: unknown) {
      addNotification("error", String(e));
    }
  }

  async function handlePwResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !pwReset) return;
    setPwReset((prev) => prev && { ...prev, submitting: true });
    try {
      await resetAdminUserPassword(token, pwReset.userId, pwReset.password);
      addNotification("success", "パスワードをリセットしました");
      setPwReset(null);
    } catch (err: unknown) {
      addNotification("error", String(err));
      setPwReset((prev) => prev && { ...prev, submitting: false });
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      await createAdminUser(token, createForm);
      addNotification("success", `ユーザー「${createForm.email}」を作成しました`);
      setCreateForm(INIT_CREATE);
      setShowCreateForm(false);
      fetchUsers();
    } catch (err: unknown) {
      addNotification("error", String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="admin-users-panel">
      {error && <p className="text-rose-500">{error}</p>}

      {/* 新規ユーザー作成 */}
      <div>
        <button
          type="button"
          data-testid="create-user-toggle"
          onClick={() => setShowCreateForm((v) => !v)}
          className="w-full rounded border border-arc-accent/50 py-1 text-[10px] font-semibold text-arc-accent hover:bg-arc-accent/10"
        >
          {showCreateForm ? "▲ 閉じる" : "＋ 新規ユーザー作成"}
        </button>
        {showCreateForm && (
          <form
            data-testid="create-user-form"
            onSubmit={(e) => void handleCreateUser(e)}
            className="mt-1 flex flex-col gap-1.5 rounded border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/60"
          >
            <input
              type="email"
              required
              placeholder="メールアドレス"
              data-testid="create-user-email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="パスワード (8文字以上)"
              data-testid="create-user-password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
            <select
              data-testid="create-user-role"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, role: e.target.value as UserCreateRequest["role"] }))
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                type="submit"
                data-testid="create-user-submit"
                disabled={creating || !createForm.email || !createForm.password}
                className="rounded bg-arc-accent/80 px-3 py-1 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
              >
                {creating ? "作成中…" : "作成"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateForm(INIT_CREATE); }}
                className="rounded border border-slate-300 px-2 py-1 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
      ) : users.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">ユーザーなし</p>
      ) : (
        <ul className="space-y-1" data-testid="admin-users-list">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-1 rounded bg-slate-100/80 px-2 py-1.5 dark:bg-slate-800/60"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-1 flex-col gap-0.5 truncate">
                  <span className="truncate text-slate-700 dark:text-slate-200">{u.email}</span>
                </div>

                {/* Role dropdown */}
                <select
                  data-testid={`role-select-${u.id}`}
                  value={u.role}
                  disabled={u.id === myId}
                  onChange={(e) => void handleRoleChange(u, e.target.value as Role)}
                  className="ml-1 shrink-0 rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  aria-label={`${u.email} のロール`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {/* Password reset button */}
                {u.email !== myEmail && (
                  <button
                    type="button"
                    data-testid={`pw-reset-btn-${u.id}`}
                    onClick={() =>
                      setPwReset({ userId: u.id, password: "", submitting: false })
                    }
                    title="パスワードをリセット"
                    className="shrink-0 rounded px-1.5 py-0.5 text-amber-600 hover:bg-amber-400/20 dark:text-amber-400"
                  >
                    🔑
                  </button>
                )}

                {/* Delete button */}
                {u.email !== myEmail && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(u)}
                    title="ユーザーを削除"
                    className="shrink-0 rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-400/20 dark:text-rose-400"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Inline password reset modal */}
              {pwReset?.userId === u.id && (
                <form
                  data-testid="pw-reset-modal"
                  onSubmit={(e) => void handlePwResetSubmit(e)}
                  className="mt-0.5 flex flex-col gap-1 rounded border border-amber-300 bg-amber-50/80 p-2 dark:border-amber-700 dark:bg-amber-900/20"
                >
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    新しいパスワード
                  </span>
                  <input
                    ref={pwInputRef}
                    data-testid="pw-reset-input"
                    type="password"
                    minLength={8}
                    required
                    value={pwReset.password}
                    onChange={(e) =>
                      setPwReset((prev) => prev && { ...prev, password: e.target.value })
                    }
                    placeholder="8文字以上"
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      data-testid="pw-reset-submit"
                      disabled={pwReset.submitting}
                      className="rounded bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      実行
                    </button>
                    <button
                      type="button"
                      onClick={() => setPwReset(null)}
                      className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          data-testid="users-prev-page"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          ← 前へ
        </button>
        <span className="text-slate-400">p.{page + 1}</span>
        <button
          type="button"
          disabled={users.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          data-testid="users-next-page"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          次へ →
        </button>
      </div>
    </div>
  );
}
