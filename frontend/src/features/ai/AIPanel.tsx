import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const CANNED: Record<string, string> = {
  default: "ご質問ありがとうございます。現在 AI アシスト機能は開発中です。3D モデルの読み込みや変形操作についてお気軽にご相談ください。",
  stl: "STL ファイルは右パネルの「モデル読み込み」から開くことができます。バイナリ・ASCII 両形式に対応しています。",
  ifc: "IFC ファイルは建築・BIM データ形式です。「モデル読み込み」から .ifc ファイルを選択してください。",
  material: "マテリアルエディタでは、カラー・粗さ・金属感・不透明度を調整できます。左メニューの「マテリアル」を選択してください。",
  layer: "レイヤー管理では、オブジェクトをグループ化して一括表示/非表示を切り替えられます。「レイヤー」パネルをご利用ください。",
  camera: "カメラをリセットするには、ビューポートツールバーの「カメラリセット」ボタンを押してください。",
  shortcut: "キーボードショートカット: W=移動, E=回転, R=拡縮, Esc=選択解除",
};

function pickResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, val] of Object.entries(CANNED)) {
    if (key !== "default" && lower.includes(key)) return val;
  }
  if (lower.includes("移動") || lower.includes("変形")) return CANNED.shortcut;
  if (lower.includes("読み込") || lower.includes("ファイル")) return CANNED.stl;
  return CANNED.default;
}

export default function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "こんにちは！ArcSphere3D AI アシスタントです（モック）。3D モデリング操作についてご質問ください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const reply = pickResponse(userText);
    setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    setLoading(false);
  }

  return (
    <div className="flex h-full flex-col gap-2 text-xs">
      <h3 className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        AI アシスト（モック）
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
                "max-w-[85%] rounded-lg px-2.5 py-1.5 leading-relaxed " +
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
      </div>

      {/* 入力 */}
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="質問を入力…"
          className="flex-1 rounded bg-slate-100 px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-arc-accent dark:bg-slate-700 dark:text-slate-200"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="rounded bg-arc-accent/80 px-2 py-1 text-white hover:bg-arc-accent disabled:opacity-40 dark:text-slate-900"
        >
          送信
        </button>
      </form>
    </div>
  );
}
