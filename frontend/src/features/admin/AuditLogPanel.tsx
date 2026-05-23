import { useEffect, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import {
  getAdminStats,
  listAuditLogs,
  parseJwtPayload,
  type AdminStats,
  type AuditLogOut,
} from "@/lib/api";

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  "",
  "login_success",
  "login_failed",
  "password_changed",
  "token_refreshed",
  "project_created",
  "project_updated",
  "project_deleted",
  "file_uploaded",
  "file_deleted",
  "file_renamed",
  "user_created",
  "member_added",
  "member_removed",
];

export default function AuditLogPanel() {
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<AuditLogOut[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = token ? (parseJwtPayload(token)?.role ?? "") : "";

  useEffect(() => {
    if (!token || role !== "admin") return;
    getAdminStats(token)
      .then(setStats)
      .catch(() => setStats(null));
  }, [token, role]);

  useEffect(() => {
    if (!token || role !== "admin") return;
    setLoading(true);
    setError(null);
    listAuditLogs(token, page * PAGE_SIZE, PAGE_SIZE, actionFilter || undefined)
      .then(setLogs)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token, role, page, actionFilter]);

  if (!token || role !== "admin") {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        管理者のみアクセス可能です。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="audit-log-panel">
      {stats && (
        <div
          className="grid grid-cols-2 gap-1 rounded bg-slate-100 p-2 dark:bg-slate-800"
          data-testid="admin-stats"
        >
          <div className="text-center">
            <div className="text-lg font-bold text-arc-accent">{stats.total_users}</div>
            <div className="text-[9px] text-slate-500">ユーザー</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-arc-accent">{stats.total_projects}</div>
            <div className="text-[9px] text-slate-500">プロジェクト</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-arc-accent">{stats.total_files}</div>
            <div className="text-[9px] text-slate-500">ファイル</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-arc-accent">{stats.total_audit_events}</div>
            <div className="text-[9px] text-slate-500">監査イベント</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          アクション
        </label>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          data-testid="audit-action-filter"
          className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a || "— すべて —"}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-rose-500">{error}</p>}

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">
          記録なし
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-[10px]"
            data-testid="audit-log-table"
          >
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="pb-1 pr-2 font-semibold">日時</th>
                <th className="pb-1 pr-2 font-semibold">ユーザー</th>
                <th className="pb-1 pr-2 font-semibold">アクション</th>
                <th className="pb-1 pr-2 font-semibold">リソース</th>
                <th className="pb-1 pr-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-slate-200 dark:border-slate-700"
                >
                  <td className="py-0.5 pr-2 text-slate-500 dark:text-slate-400">
                    {new Date(log.created_at).toLocaleString("ja-JP", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-[8rem] truncate py-0.5 pr-2 text-slate-600 dark:text-slate-300">
                    {log.actor_email ?? "—"}
                  </td>
                  <td className="py-0.5 pr-2">
                    <span
                      className={
                        log.action.includes("fail") || log.action.includes("error")
                          ? "text-rose-500"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-0.5 pr-2 text-slate-600 dark:text-slate-300">
                    {log.resource_type
                      ? `${log.resource_type}/${log.resource_id ?? ""}`
                      : "—"}
                  </td>
                  <td className="py-0.5 text-slate-500 dark:text-slate-400">
                    {log.ip_address ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          data-testid="audit-prev-page"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          ← 前へ
        </button>
        <span className="text-slate-400">p.{page + 1}</span>
        <button
          type="button"
          disabled={logs.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          data-testid="audit-next-page"
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          次へ →
        </button>
      </div>
    </div>
  );
}
