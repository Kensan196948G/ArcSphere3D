import { useEffect, useRef, useState } from "react";
import { createComment, deleteComment, listComments, type CommentOut } from "@/lib/api";
import { notifyError } from "@/state/notificationStore";

interface Props {
  token: string;
  projectId: string;
  currentUserId: string | null;
  projectOwnerId: string | null;
}

export default function CommentPanel({ token, projectId, currentUserId, projectOwnerId }: Props) {
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    listComments(token, projectId)
      .then(setComments)
      .catch((e: unknown) => notifyError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token, projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const c = await createComment(token, projectId, trimmed);
      setComments((prev) => [...prev, c]);
      setBody("");
      textareaRef.current?.focus();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(token, projectId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div data-testid="comment-panel" className="flex flex-col gap-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        コメント
      </span>

      {loading && (
        <p className="text-slate-400 dark:text-slate-500">読み込み中…</p>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-slate-400 dark:text-slate-500">コメントはありません。</p>
      )}

      <ul className="space-y-1.5" data-testid="comment-list">
        {comments.map((c) => {
          const canDelete = c.author_id === currentUserId || projectOwnerId === currentUserId;
          return (
            <li
              key={c.id}
              data-testid="comment-item"
              className="rounded bg-slate-100/80 px-2 py-1.5 dark:bg-slate-800/60"
            >
              <div className="mb-0.5 flex items-baseline justify-between gap-1">
                <span className="truncate text-[9px] text-slate-400 dark:text-slate-500">
                  {c.author_email}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    {new Date(c.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      data-testid={`comment-delete-${c.id}`}
                      className="rounded px-1 py-0.5 text-[9px] text-rose-400 hover:bg-rose-400/20"
                      title="削除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">
                {c.body}
              </p>
            </li>
          );
        })}
      </ul>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-1">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="コメントを入力…"
          rows={3}
          maxLength={4096}
          data-testid="comment-input"
          className="w-full resize-none rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          data-testid="comment-submit-btn"
          className="self-end rounded bg-arc-accent/70 px-3 py-0.5 text-[10px] text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
        >
          {submitting ? "送信中…" : "送信"}
        </button>
      </form>
    </div>
  );
}
