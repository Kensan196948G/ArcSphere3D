import { useState } from "react";
import AuditLogPanel from "./AuditLogPanel";
import AdminUsersPanel from "./AdminUsersPanel";
import { useAuthStore } from "@/state/authStore";
import { parseJwtPayload } from "@/lib/api";

type Tab = "audit" | "users";

export default function AdminPanel() {
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<Tab>("audit");

  const role = token ? (parseJwtPayload(token)?.role ?? "") : "";

  if (!token || role !== "admin") {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        管理者のみアクセス可能です。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="admin-panel">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("audit")}
          data-testid="admin-tab-audit"
          className={
            "rounded px-2 py-0.5 text-[10px] transition " +
            (tab === "audit"
              ? "bg-arc-accent/20 text-arc-accent"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")
          }
        >
          監査ログ
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          data-testid="admin-tab-users"
          className={
            "rounded px-2 py-0.5 text-[10px] transition " +
            (tab === "users"
              ? "bg-arc-accent/20 text-arc-accent"
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")
          }
        >
          ユーザー管理
        </button>
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {tab === "audit" ? <AuditLogPanel /> : <AdminUsersPanel />}
    </div>
  );
}
