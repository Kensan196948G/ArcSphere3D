import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { deleteAdminUser, listAdminUsers, parseJwtPayload, type UserOut } from "@/lib/api";

const PAGE_SIZE = 20;
const ROLE_BADGE: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  editor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  viewer: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export default function AdminUsersPanel() {
  const token = useAuthStore((s) => s.token);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = token ? (parseJwtPayload(token)?.role ?? "") : "";
  const myEmail = token ? (parseJwtPayload(token)?.email ?? "") : "";

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

  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="admin-users-panel">
      {error && <p className="text-rose-500">{error}</p>}

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
      ) : users.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">ユーザーなし</p>
      ) : (
        <ul className="space-y-1" data-testid="admin-users-list">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded bg-slate-100/80 px-2 py-1 dark:bg-slate-800/60"
            >
              <div className="flex flex-1 flex-col gap-0.5 truncate">
                <span className="truncate text-slate-700 dark:text-slate-200">{u.email}</span>
                <span
                  className={`inline-flex w-fit rounded px-1 py-0.5 text-[9px] font-semibold ${ROLE_BADGE[u.role] ?? ROLE_BADGE.viewer}`}
                >
                  {u.role}
                </span>
              </div>
              {u.email !== myEmail && (
                <button
                  type="button"
                  onClick={() => void handleDelete(u)}
                  title="ユーザーを削除"
                  className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-400/20 dark:text-rose-400"
                >
                  ✕
                </button>
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
