import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { useProjectStore } from "@/state/projectStore";
import {
  addMember,
  listMembers,
  lookupUserByEmail,
  parseJwtPayload,
  removeMember,
  type MemberOut,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(v: string): string | null {
  if (!v.trim()) return "メールアドレスを入力してください";
  if (!EMAIL_RE.test(v.trim())) return "有効なメールアドレスを入力してください";
  return null;
}

export default function MembersPanel() {
  const token = useAuthStore((s) => s.token);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  const [members, setMembers] = useState<MemberOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("viewer");
  const [adding, setAdding] = useState(false);

  // Decode JWT to get current user's ID for role-based UI control
  const currentUserId = useMemo(() => {
    if (!token) return null;
    return parseJwtPayload(token)?.sub ?? null;
  }, [token]);

  const currentUserRole = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((m) => m.user_id === currentUserId)?.role ?? null;
  }, [currentUserId, members]);

  const isOwner = currentUserRole === "owner";

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
    void fetchMembers();
  }, [fetchMembers]);

  function handleEmailChange(v: string) {
    setEmail(v);
    if (emailTouched) setEmailError(validateEmail(v));
  }

  function handleEmailBlur() {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  }

  async function handleAdd() {
    setEmailTouched(true);
    const validationErr = validateEmail(email);
    setEmailError(validationErr);
    if (validationErr || !token || !selectedProjectId) return;
    setAdding(true);
    setError(null);
    try {
      const found = await lookupUserByEmail(token, email.trim());
      await addMember(token, selectedProjectId, found.id, role);
      setEmail("");
      setEmailTouched(false);
      setEmailError(null);
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
                <span className="flex-1 truncate text-[10px] text-slate-600 dark:text-slate-300">
                  {m.email}
                </span>
                <span className="rounded bg-slate-200 px-1 text-[10px] dark:bg-slate-700">
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

      {/* メンバー追加フォーム — owner のみ表示 */}
      {isOwner && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-500 dark:text-slate-400">
            メンバーを追加
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">メールアドレス</span>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="user@example.com"
                data-testid="member-user-id-input"
                className={`rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200 ${
                  emailError
                    ? "ring-1 ring-red-400 focus:ring-red-400"
                    : "focus:ring-arc-accent"
                }`}
              />
              {emailError && (
                <span
                  className="text-[9px] text-red-400"
                  data-testid="email-validation-error"
                >
                  {emailError}
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
              disabled={adding || !email.trim() || (emailTouched && !!emailError)}
              data-testid="member-add-btn"
              className="rounded bg-arc-accent/80 py-1 text-[11px] font-medium text-white hover:bg-arc-accent disabled:opacity-50 dark:text-slate-900"
            >
              {adding ? "追加中…" : "メンバーを追加"}
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="text-[10px] text-red-400" data-testid="members-error">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
