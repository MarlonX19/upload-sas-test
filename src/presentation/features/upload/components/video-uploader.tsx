"use client";

import { useCallback, useRef, useState } from "react";

import { uploadVideoToAzure } from "@/lib/upload/azure-video-upload";
import {
  ALLOWED_VIDEO_EXTENSIONS,
  FFMPEG_COMPRESS_CONCURRENCY,
  isAllowedVideoFileName,
  MAX_UI_VIDEO_BYTES,
  MAX_UI_VIDEO_FILES,
} from "@/domain/upload/video-upload-policy";
import { Button } from "@/presentation/shared/ui/button";
import { cn } from "@/lib/cn";

type Phase = "idle" | "compressing" | "compressed" | "uploading" | "done" | "error";
type ErrorStep = "compress" | "upload";

type VideoItem = {
  id: string;
  file: File;
  phase: Phase;
  progress: number;
  error: string | null;
  errorStep: ErrorStep | null;
  processedFile: File | null;
  originalSize: number | null;
  outputSize: number | null;
  compressionSkipped: boolean;
  publicBlobUrl: string | null;
  blobName: string | null;
};

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function reductionPercent(original: number, output: number): number | null {
  if (original <= 0 || output >= original) return null;
  return Math.round((1 - output / original) * 100);
}

function createItem(file: File): VideoItem {
  return {
    id: crypto.randomUUID(),
    file,
    phase: "idle",
    progress: 0,
    error: null,
    errorStep: null,
    processedFile: null,
    originalSize: null,
    outputSize: null,
    compressionSkipped: false,
    publicBlobUrl: null,
    blobName: null,
  };
}

function patchItem(items: VideoItem[], id: string, patch: Partial<VideoItem>): VideoItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || "video-compressed.mp4";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CompressionRateBadge({
  originalSize,
  outputSize,
  skipped,
}: {
  originalSize: number;
  outputSize: number;
  skipped: boolean;
}) {
  const pct = reductionPercent(originalSize, outputSize);

  if (skipped || pct == null) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-medium text-amber-900">Sem redução de tamanho</p>
        <p className="mt-0.5 text-xs text-amber-800">
          Original {formatBytes(originalSize)} · saída {formatBytes(outputSize)} — envia-se o
          original.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">
            Taxa de compressão
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-emerald-800">−{pct}%</p>
        </div>
        <div className="text-right text-xs text-emerald-900">
          <p>
            <span className="text-emerald-700/70">Antes</span>{" "}
            <span className="font-medium tabular-nums">{formatBytes(originalSize)}</span>
          </p>
          <p className="mt-0.5">
            <span className="text-emerald-700/70">Depois</span>{" "}
            <span className="font-medium tabular-nums">{formatBytes(outputSize)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function VideoUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<VideoItem[]>([]);
  const [items, setItemsState] = useState<VideoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const setItems = useCallback((updater: (prev: VideoItem[]) => VideoItem[]) => {
    setItemsState((prev) => {
      const next = updater(prev);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const anyBusy = items.some((i) => i.phase === "compressing" || i.phase === "uploading");
  const idleCount = items.filter((i) => i.phase === "idle").length;
  const compressedCount = items.filter((i) => i.phase === "compressed").length;

  const totalBeforeBytes = items.reduce((sum, i) => sum + i.file.size, 0);
  const compressedItems = items.filter((i) => i.outputSize != null);
  const totalAfterBytes = compressedItems.reduce((sum, i) => {
    // skipped → envia original; senão usa o tamanho comprimido
    if (i.compressionSkipped) return sum + i.file.size;
    return sum + (i.outputSize ?? 0);
  }, 0);
  const allHaveAfter = items.length > 0 && compressedItems.length === items.length;
  const totalReductionPct =
    allHaveAfter && totalBeforeBytes > 0 && totalAfterBytes < totalBeforeBytes
      ? Math.round((1 - totalAfterBytes / totalBeforeBytes) * 100)
      : null;

  const pickFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      setItems((prev) => {
        const next = [...prev];
        const errors: string[] = [];

        for (const f of list) {
          if (next.length >= MAX_UI_VIDEO_FILES) {
            errors.push(`Máximo de ${MAX_UI_VIDEO_FILES} vídeos.`);
            break;
          }
          if (!isAllowedVideoFileName(f.name)) {
            errors.push(`«${f.name}» — use ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`);
            continue;
          }
          if (f.size > MAX_UI_VIDEO_BYTES) {
            errors.push(`«${f.name}» excede ${MAX_UI_VIDEO_BYTES / (1024 * 1024)} MB.`);
            continue;
          }
          if (f.size === 0) {
            errors.push(`«${f.name}» está vazio.`);
            continue;
          }
          const dup = next.some(
            (r) =>
              r.file.name === f.name &&
              r.file.size === f.size &&
              r.file.lastModified === f.lastModified,
          );
          if (!dup) next.push(createItem(f));
        }

        setError(errors[0] ?? null);
        return next;
      });
    },
    [setItems],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) pickFiles(list);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (anyBusy) return;
    if (e.dataTransfer.files?.length) pickFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && (item.phase === "compressing" || item.phase === "uploading")) return prev;
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    if (anyBusy) return;
    setItems(() => []);
    setError(null);
  };

  const compressOne = async (id: string) => {
    const existing = itemsRef.current.find((i) => i.id === id);
    if (!existing || existing.phase === "compressing" || existing.phase === "uploading") return;
    const sourceFile = existing.file;

    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item || item.phase === "compressing" || item.phase === "uploading") return prev;
      return patchItem(prev, id, {
        phase: "compressing",
        progress: 0,
        error: null,
        errorStep: null,
        processedFile: null,
        originalSize: item.file.size,
        outputSize: null,
        compressionSkipped: false,
        publicBlobUrl: null,
        blobName: null,
      });
    });

    try {
      const { compressVideoForUpload } = await import("@/lib/video/ffmpeg-compress");
      const compressed = await compressVideoForUpload(sourceFile, (pct) => {
        setItems((prev) => patchItem(prev, id, { progress: pct }));
      });
      setItems((prev) =>
        patchItem(prev, id, {
          phase: "compressed",
          progress: 100,
          processedFile: compressed.file,
          originalSize: compressed.originalSize,
          outputSize: compressed.outputSize,
          compressionSkipped: compressed.skipped,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na compressão.";
      setItems((prev) =>
        patchItem(prev, id, {
          phase: "error",
          progress: 0,
          error: msg,
          errorStep: "compress",
        }),
      );
    }
  };

  const uploadOne = async (id: string) => {
    const existing = itemsRef.current.find((i) => i.id === id);
    if (
      !existing?.processedFile ||
      existing.phase === "compressing" ||
      existing.phase === "uploading"
    ) {
      return;
    }
    const processed = existing.processedFile;

    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item?.processedFile || item.phase === "compressing" || item.phase === "uploading") {
        return prev;
      }
      return patchItem(prev, id, {
        phase: "uploading",
        progress: 0,
        error: null,
        errorStep: null,
        publicBlobUrl: null,
        blobName: null,
      });
    });

    try {
      const result = await uploadVideoToAzure(processed, (pct) => {
        setItems((prev) => patchItem(prev, id, { progress: pct }));
      });
      setItems((prev) =>
        patchItem(prev, id, {
          phase: "done",
          progress: 100,
          publicBlobUrl: result.publicBlobUrl,
          blobName: result.blobName,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no envio.";
      setItems((prev) =>
        patchItem(prev, id, {
          phase: "error",
          progress: 0,
          error: msg,
          errorStep: "upload",
        }),
      );
    }
  };

  const compressAllIdle = async () => {
    const ids = itemsRef.current.filter((i) => i.phase === "idle").map((i) => i.id);
    await Promise.all(ids.map((id) => compressOne(id)));
  };

  const uploadAllCompressed = async () => {
    const ids = itemsRef.current.filter((i) => i.phase === "compressed").map((i) => i.id);
    await Promise.all(ids.map((id) => uploadOne(id)));
  };

  const retryItem = (item: VideoItem) => {
    if (item.errorStep === "upload") {
      void uploadOne(item.id);
      return;
    }
    void compressOne(item.id);
  };

  return (
    <div className="w-full max-w-lg space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!anyBusy) inputRef.current?.click();
          }
        }}
        onClick={() => !anyBusy && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-[border-color,background-color]",
          anyBusy && "pointer-events-none opacity-60",
          dragOver
            ? "border-primary-500 bg-primary-50"
            : "border-neutral-300 bg-white hover:border-primary-400 hover:bg-primary-50/50",
        )}
      >
        <p className="text-sm font-medium text-neutral-800">Arrasta vídeos para aqui</p>
        <p className="mt-1 text-xs text-neutral-500">ou clica para escolher um ou vários ficheiros</p>
        <p className="mt-3 text-xs text-neutral-400">
          MP4, WebM, MOV ou AVI · até {MAX_UI_VIDEO_FILES} ficheiros · máx.{" "}
          {MAX_UI_VIDEO_BYTES / (1024 * 1024)} MB cada · compressão paralela (até{" "}
          {FFMPEG_COMPRESS_CONCURRENCY} ao mesmo tempo)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
          disabled={anyBusy}
          className="sr-only"
          aria-label="Selecionar ficheiros de vídeo"
          onChange={onInputChange}
        />
      </div>

      {error && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Totais ({items.length} {items.length === 1 ? "vídeo" : "vídeos"})
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500">Antes da compressão</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
                  {formatBytes(totalBeforeBytes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Depois da compressão</p>
                {compressedItems.length === 0 ? (
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-400">—</p>
                ) : (
                  <>
                    <p
                      className={cn(
                        "mt-0.5 text-lg font-semibold tabular-nums",
                        totalReductionPct != null ? "text-emerald-800" : "text-neutral-900",
                      )}
                    >
                      {formatBytes(totalAfterBytes)}
                      {totalReductionPct != null ? (
                        <span className="ml-1.5 text-sm font-semibold text-emerald-700">
                          (−{totalReductionPct}%)
                        </span>
                      ) : null}
                    </p>
                    {!allHaveAfter && (
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {compressedItems.length}/{items.length} comprimidos
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {idleCount > 0 && (
              <Button
                type="button"
                className="h-9 px-3 text-xs"
                disabled={anyBusy}
                onClick={() => void compressAllIdle()}
              >
                Comprimir todos ({idleCount})
              </Button>
            )}
            {compressedCount > 0 && (
              <Button
                type="button"
                className="h-9 px-3 text-xs"
                disabled={anyBusy}
                onClick={() => void uploadAllCompressed()}
              >
                Enviar todos ({compressedCount})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3 text-xs"
              disabled={anyBusy}
              onClick={clearAll}
            >
              Limpar lista
            </Button>
          </div>
        </>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const busy = item.phase === "compressing" || item.phase === "uploading";
          const showRate =
            item.originalSize != null &&
            item.outputSize != null &&
            (item.phase === "compressed" ||
              item.phase === "uploading" ||
              item.phase === "done" ||
              (item.phase === "error" && item.errorStep === "upload"));

          return (
            <li
              key={item.id}
              className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all font-medium text-neutral-900" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">{formatBytes(item.file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50"
                >
                  Remover
                </button>
              </div>

              {showRate && item.originalSize != null && item.outputSize != null && (
                <CompressionRateBadge
                  originalSize={item.originalSize}
                  outputSize={item.outputSize}
                  skipped={item.compressionSkipped}
                />
              )}

              {item.error && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                  role="alert"
                >
                  {item.error}
                </p>
              )}

              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={cn(
                    "h-full transition-[width] duration-200",
                    item.phase === "error"
                      ? "bg-red-500"
                      : item.phase === "compressing"
                        ? "bg-amber-500"
                        : "bg-primary-500",
                  )}
                  style={{
                    width: `${item.phase === "done" || item.phase === "compressed" ? 100 : item.progress}%`,
                  }}
                />
              </div>

              <p className="text-xs text-neutral-500">
                {item.phase === "idle" && "Pronto para comprimir."}
                {item.phase === "compressing" && `A comprimir localmente… ${item.progress}%`}
                {item.phase === "compressed" &&
                  "Compressão concluída. Valida a qualidade e envia quando quiseres."}
                {item.phase === "uploading" && `A enviar para o Azure… ${item.progress}%`}
                {item.phase === "done" && "Concluído no storage."}
                {item.phase === "error" &&
                  (item.errorStep === "upload" ? "Erro no envio." : "Erro na compressão.")}
              </p>

              {item.phase === "done" && item.publicBlobUrl && (
                <div className="space-y-1">
                  {item.blobName && (
                    <p className="break-all text-xs text-neutral-500" title={item.blobName}>
                      Blob: {item.blobName}
                    </p>
                  )}
                  <p className="break-all text-xs text-primary-700" title={item.publicBlobUrl}>
                    {item.publicBlobUrl}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {item.phase === "idle" && (
                  <Button
                    type="button"
                    className="h-9 px-3 text-xs"
                    disabled={busy}
                    onClick={() => void compressOne(item.id)}
                  >
                    Comprimir
                  </Button>
                )}

                {item.phase === "compressing" && (
                  <Button type="button" className="h-9 px-3 text-xs" disabled>
                    A comprimir…
                  </Button>
                )}

                {item.phase === "compressed" && (
                  <>
                    <Button
                      type="button"
                      className="h-9 px-3 text-xs"
                      disabled={busy}
                      onClick={() => void uploadOne(item.id)}
                    >
                      Enviar para o Azure
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      disabled={busy || !item.processedFile}
                      onClick={() => item.processedFile && downloadFile(item.processedFile)}
                    >
                      Descarregar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      disabled={busy}
                      onClick={() => void compressOne(item.id)}
                    >
                      Comprimir de novo
                    </Button>
                  </>
                )}

                {item.phase === "uploading" && (
                  <Button type="button" className="h-9 px-3 text-xs" disabled>
                    A enviar…
                  </Button>
                )}

                {item.phase === "done" && (
                  <Button type="button" className="h-9 px-3 text-xs" disabled>
                    Enviado
                  </Button>
                )}

                {item.phase === "error" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    onClick={() => retryItem(item)}
                  >
                    Tentar de novo
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
