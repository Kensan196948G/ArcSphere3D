/**
 * MultipartUploader — large file upload with 10 MiB chunks and progress bar.
 *
 * Strategy:
 * 1. POST /api/files/multipart/init  → upload_id + presigned PUT URLs
 * 2. PUT each chunk to its presigned URL (XHR for per-chunk progress)
 * 3. POST /api/files/multipart/complete  → register file metadata in DB
 * On failure/cancel → POST /api/files/multipart/abort to clean MinIO parts
 */

import { useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import {
  multipartInit,
  multipartComplete,
  multipartAbort,
  type MultipartPart,
} from "@/lib/api";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB

interface Props {
  projectId: string;
  onComplete: () => void;
}

type UploadState = "idle" | "uploading" | "completing" | "done" | "error";

export default function MultipartUploader({ projectId, onComplete }: Props) {
  const token = useAuthStore((s) => s.token) ?? "";
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortInfoRef = useRef<{ uploadId: string; s3Key: string } | null>(null);

  function handleCancel() {
    xhrRef.current?.abort();
    if (abortInfoRef.current) {
      void multipartAbort(token, abortInfoRef.current.uploadId, abortInfoRef.current.s3Key).catch(
        () => {},
      );
      abortInfoRef.current = null;
    }
    setState("idle");
    setProgress(0);
  }

  async function handleFile(file: File) {
    if (!token || !projectId) return;

    const partCount = Math.ceil(file.size / CHUNK_SIZE);
    const contentType = file.type || "application/octet-stream";

    setState("uploading");
    setProgress(0);
    setErrorMsg(null);

    try {
      // Step 1: init
      const init = await multipartInit(token, projectId, file.name, contentType, file.size, partCount);
      abortInfoRef.current = { uploadId: init.upload_id, s3Key: init.s3_key };

      // Step 2: upload parts
      const parts: MultipartPart[] = [];
      let uploadedBytes = 0;

      for (let i = 0; i < partCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const partUrl = init.part_urls[i];

        const etag = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.open("PUT", partUrl);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const partProgress = uploadedBytes + e.loaded;
              setProgress(Math.round((partProgress / file.size) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const rawEtag = xhr.getResponseHeader("ETag") ?? `"part-${i + 1}"`;
              uploadedBytes += end - start;
              resolve(rawEtag);
            } else {
              reject(new Error(`Part ${i + 1} upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error(`Part ${i + 1} network error`));
          xhr.onabort = () => reject(new Error("Upload cancelled"));
          xhr.send(chunk);
        });

        parts.push({ part_number: i + 1, etag });
      }

      // Step 3: complete
      setState("completing");
      await multipartComplete(
        token,
        projectId,
        init.upload_id,
        init.s3_key,
        file.name,
        file.size,
        contentType,
        parts,
      );
      abortInfoRef.current = null;
      setState("done");
      setProgress(100);
      setTimeout(() => {
        setState("idle");
        setProgress(0);
        onComplete();
      }, 1500);
    } catch (err) {
      if (err instanceof Error && err.message === "Upload cancelled") {
        setState("idle");
        setProgress(0);
      } else {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
        if (abortInfoRef.current) {
          void multipartAbort(
            token,
            abortInfoRef.current.uploadId,
            abortInfoRef.current.s3Key,
          ).catch(() => {});
          abortInfoRef.current = null;
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "idle" && (
        <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-arc-accent/40 p-3 text-[11px] text-arc-accent hover:border-arc-accent hover:bg-arc-accent/5">
          <input
            type="file"
            data-testid="multipart-file-input"
            className="sr-only"
            accept=".stl,.obj,.gltf,.glb,.ifc,.step"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          大容量ファイル (≥10 MB) をアップロード
        </label>
      )}

      {(state === "uploading" || state === "completing") && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              {state === "uploading" ? "アップロード中..." : "完了処理中..."}
            </span>
            <span className="text-arc-accent font-mono">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              data-testid="multipart-progress"
              className="h-2 rounded-full bg-arc-accent transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="self-start rounded bg-rose-100 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400"
          >
            キャンセル
          </button>
        </div>
      )}

      {state === "done" && (
        <p
          data-testid="multipart-done"
          className="text-[11px] text-emerald-500"
        >
          ✓ アップロード完了
        </p>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] text-rose-500">エラー: {errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setErrorMsg(null);
            }}
            className="self-start rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
