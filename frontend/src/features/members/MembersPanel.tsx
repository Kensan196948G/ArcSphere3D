import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import {
  addMember,
  getMe,
  listMembers,
  lookupUserByEmail,
  removeMember,
  type MemberOut,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export default function MembersPanel() {
  const token = useAuthStore((s) => s.token);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  const [members, setMembers] = useState<MemberOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("viewer");
  const [adding, setAdding] = useState(false);

  const emailInvalid = emailTouched && email.trim() !== "" && !isValidEmail(email);

  const myRole = useMemo(
    () => members.find((m) => m.user_id === myUserId)?.role ?? null,
    [members, myUserId],
  );
  const isOwner = myRole === "owner";

  const fetchMembers = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMembers(token, selectedProjectId);
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token, selectedProjectId]);

  useEffect(() => {
    if (!token) {
      setMyUserId(null);
      return;
    }
    getMe(token)
      .then((me) => setMyUserId(me.id))
      .catch(() => setMyUserId(null));
  }, [token]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  async function handleAdd() {
    if (!token || !selectedProjectId || !isValidEmail(email)) return;
    setAdding(true);
    setError(null);
    try {
      const found = await lookupUserByEmail(token, email.trim());
      await addMember(token, selectedProjectId, found.id, role);
      setEmail("");
      setEmailTouched(false);
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!token || !selectedProjectId) return;
    setError(null);
    try {
      await removeMember(token, selectedProjectId, memberId);
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!token) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        ログインしてください。
      </p>
    );
  }
  if (!selectedProjectId) {
    return (
      <p
        className="text-xs text-slate-400 dark:text-slate-500"
        data-testid="members-no-project"
      >
        プロジェクトを選択してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-xs" data-testid="members-panel">
      {/* メンバー一覧 */}
      <section>
        <h3 className="mb-1 font-semibold text-slate-500 dark:text-slate-400">
          メンバー一覧
        </h3>
        {loading ? (
          <p className="text-slate-400">読み込み中…</p>
        ) : members.length === 0 ? (
          <p
            className="text-slate-400 dark:text-slate-500"
            data-testid="members-empty"
          >
            メンバーがいません。
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="members-list">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded bg-slate-100/60 px-2 py-1 dark:bg-slate-800/40"
              >
                <span
                  className="flex-1 truncate text-[10px] text-slate-600 dark:text-slate-300"
                  title={m.email ?? m.user_id}
                  data-testid="member-email"
                >
                  {m.email ?? `${m.user_id.slice(0, 8)}…`}
                </span>
                <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] dark:bg-slate-700">
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(m.user_id)}
                    data-testid="member-remove-btn"
                    className="ml-2 rounded px-1 py-0.5 text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* メンバー追加フォーム (owner のみ) */}
      {isOwner && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-500 dark:text-slate-400">
            メンバーを追加
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">
                メールアドレス
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="user@example.com"
                data-testid="member-user-id-input"
                className={[
                  "rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200",
                  emailInvalid
                    ? "ring-1 ring-red-400 focus:ring-red-400"
                    : "focus:ring-arc-accent",
                ].join(" ")}
              />
              {emailInvalid && (
                <span
                  className="text-[10px] text-red-400"
                  data-testid="email-validation-error"
                >
                  正しいメールアドレスを入力してください
                </span>
              )}
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">ロール</span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "owner" | "editor" | "viewer")
                }
                data-testid="member-role-select"
                className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="viewer">閲覧者</option>
                <option value="editor">編集者</option>
                <option value="owner">オーナー</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={adding || !isValidEmail(email)}
              data-testid="member-add-btn"
              className="rounded bg-arc-accent/80 py-1 text-[11px] font-medium text-white hover:bg-arc-accent disabled:opacity-50 dark:text-slate-900"
            >
              {adding ? "追加中…" : "メンバーを追加"}
            </button>
          </div>
        </section>
      )}

      {!isOwner && myRole !== null && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500" data-testid="members-readonly-note">
          メンバー管理はオーナーのみ操作できます。
        </p>
      )}

      {error && (
        <p className="text-[10px] text-red-400" data-testid="members-error">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
