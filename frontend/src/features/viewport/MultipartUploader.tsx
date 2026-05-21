/**
 * MultipartUploader — handles large file uploads (>200 MB) via presigned part URLs.
 * Uploads chunks directly to MinIO without proxying through the backend server.
 */
import { useRef, useState } from "react";
import {
  FileMetadata,
  abortMultipartUpload,
  completeMultipartUpload,
  initMultipartUpload,
} from "../../lib/api";
import { useAuthStore } from "../../state/uiStore";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
const MULTIPART_THRESHOLD = 200 * 1024 * 1024; // 200 MB

interface Props {
  projectId: string;
  onComplete?: (file: FileMetadata) => void;
  onError?: (msg: string) => void;
}

export default function MultipartUploader({ projectId, onComplete, onError }: Props) {
  const token = useAuthStore((s) => s.token);
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const abortRef = useRef(false);

  const onPick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!token) return;
    abortRef.current = false;
    setStatus("uploading");
    setProgress(0);

    let initResp;
    try {
      initResp = await initMultipartUpload(token, projectId, file, CHUNK_SIZE);
    } catch (e) {
      setStatus("error");
      onError?.(`アップロード開始に失敗しました: ${e}`);
      return;
    }
    setUploadToken(initResp.upload_token);

    const completedParts: Array<{ part_number: number; etag: string }> = [];

    for (const part of initResp.parts) {
      if (abortRef.current) {
        await abortMultipartUpload(token, initResp.upload_token).catch(() => {});
        setStatus("idle");
        setProgress(null);
        return;
      }

      const start = (part.part_number - 1) * initResp.chunk_size;
      const end = Math.min(start + initResp.chunk_size, file.size);
      const chunk = file.slice(start, end);

      try {
        const putRes = await fetch(part.presigned_url, {
          method: "PUT",
          body: chunk,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error(`Part ${part.part_number} failed: ${putRes.status}`);
        const etag = putRes.headers.get("ETag") ?? `"part-${part.part_number}"`;
        completedParts.push({ part_number: part.part_number, etag });
      } catch (e) {
        await abortMultipartUpload(token, initResp.upload_token).catch(() => {});
        setStatus("error");
        onError?.(`パート ${part.part_number} のアップロードに失敗: ${e}`);
        return;
      }

      setProgress(Math.round((part.part_number / initResp.total_parts) * 100));
    }

    try {
      const fileMeta = await completeMultipartUpload(token, initResp.upload_token, completedParts);
      setStatus("done");
      setProgress(100);
      onComplete?.(fileMeta);
      setTimeout(() => { setStatus("idle"); setProgress(null); }, 2000);
    } catch (e) {
      setStatus("error");
      onError?.(`アップロード完了処理に失敗しました: ${e}`);
    }
  };

  const cancelUpload = () => {
    abortRef.current = true;
    if (uploadToken && token) {
      abortMultipartUpload(token, uploadToken).catch(() => {});
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPick}
        disabled={status === "uploading"}
        data-testid="multipart-upload-btn"
        className="w-full rounded bg-indigo-600/80 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
      >
        {status === "uploading" ? "アップロード中…" : "☁️ 大容量ファイルをアップロード (200 MB+)"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj,.gltf,.glb,.ifc,.step,.stp,.iges,.igs"
        className="hidden"
        data-testid="multipart-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { handleFile(file); e.target.value = ""; }
        }}
      />

      {status === "uploading" && progress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>アップロード中 {progress}%</span>
            <button
              type="button"
              onClick={cancelUpload}
              className="text-red-400 hover:text-red-300"
            >
              キャンセル
            </button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              data-testid="upload-progress-bar"
              className="h-full rounded-full bg-indigo-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "done" && (
        <p className="text-[11px] text-green-400">アップロード完了</p>
      )}

      {status === "error" && (
        <p className="text-[11px] text-red-400">アップロードに失敗しました</p>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        200 MB 超のファイルは直接 S3 へチャンク分割アップロードします。
      </p>
    </div>
  );
}

export { MULTIPART_THRESHOLD };
