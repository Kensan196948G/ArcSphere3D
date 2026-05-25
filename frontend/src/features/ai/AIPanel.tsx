import { useRef, useEffect, useState } from "react";
import { postAiChat, type AiChatMessage } from "@/lib/api";
import { useAuthStore } from "@/state/authStore";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AIPanel() {
  const token = useAuthStore((s) => s.token);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "こんにちは！ArcSphere3D AI アシスタントです。3D モデリング操作についてご質問ください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setError(null);

    const nextMessages: Message[] = [...messages, { role: "user", text: userText }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      if (!token) throw new Error("ログインが必要です");

      const apiMessages: AiChatMessage[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const reply = await postAiChat(token, apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `エラーが発生しました: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 text-xs">
      <h3 className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        AI アシスト
      </h3>

      {/* 会話履歴 */}
      <div className="flex-1 overflow-auto rounded bg-slate-50 p-2 dark:bg-slate-900/60">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              "mb-2 flex " + (msg.role === "user" ? "justify-end" : "justify-start")
            }
          >
            <div
              className={
                "max-w-[85%] rounded-lg px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap " +
                (msg.role === "user"
                  ? "bg-arc-accent/80 text-white dark:text-slate-900"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200")
              }
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-200 px-3 py-1.5 dark:bg-slate-700">
              <span className="animate-pulse text-slate-400">考え中…</span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力 */}
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={token ? "質問を入力…" : "ログインが必要です"}
          className="flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
          disabled={loading || !token}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || !token}
          className="rounded bg-arc-accent/80 px-2 py-1 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
        >
          送信
        </button>
      </form>
    </div>
  );
}
