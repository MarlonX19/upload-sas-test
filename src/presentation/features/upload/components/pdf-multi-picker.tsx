"use client";

import { useCallback, useRef, useState } from "react";

import { uploadPdfsInParallelBatches } from "@/lib/upload/azure-parallel-pdf-upload";
import { Button } from "@/presentation/shared/ui/button";
import { cn } from "@/lib/cn";
import { MAX_UI_PDF_BYTES, MAX_UI_PDF_FILES } from "@/domain/upload/general-pdf-upload-policy";

function isPdfFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") && (file.type === "application/pdf" || file.type === "");
}

function validateFiles(incoming: File[]): { ok: File[]; error: string | null } {
  for (const f of incoming) {
    if (!isPdfFile(f)) {
      return { ok: [], error: `«${f.name}» não é um PDF válido.` };
    }
    if (f.size > MAX_UI_PDF_BYTES) {
      return {
        ok: [],
        error: `«${f.name}» excede o limite de ${MAX_UI_PDF_BYTES / (1024 * 1024)} MB.`,
      };
    }
  }
  return { ok: [...incoming], error: null };
}

type RowStatus = "idle" | "uploading" | "done" | "error";

type FileRow = {
  id: string;
  file: File;
  progress: number;
  status: RowStatus;
  errorMessage?: string;
  publicBlobUrl?: string;
  blobName?: string;
};

export function PdfMultiPicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const { ok, error: vErr } = validateFiles(list);
      if (vErr) {
        setError(vErr);
        return;
      }

      setError(null);
      setRows((prev) => {
        const next: FileRow[] = [...prev];
        let hitCap = false;
        for (const f of ok) {
          if (next.length >= MAX_UI_PDF_FILES) {
            hitCap = true;
            break;
          }
          const dup = next.some(
            (r) =>
              r.file.name === f.name && r.file.size === f.size && r.file.lastModified === f.lastModified,
          );
          if (!dup) {
            next.push({
              id: `${crypto.randomUUID()}`,
              file: f,
              progress: 0,
              status: "idle",
            });
          }
        }
        if (hitCap) {
          queueMicrotask(() => {
            setError(`Podes selecionar no máximo ${MAX_UI_PDF_FILES} ficheiros.`);
          });
        }
        return next;
      });
    },
    [],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) addFiles(list);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const removeAt = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setError(null);
  };

  const clearAll = () => {
    setRows([]);
    setError(null);
  };

  const startUpload = async () => {
    if (rows.length === 0 || uploading) return;
    setError(null);
    setUploading(true);
    setRows((prev) =>
      prev.map((r) => (r.status === "idle" ? { ...r, status: "uploading" as const, progress: 0 } : r)),
    );

    const files = rows.map((r) => r.file);
    const idByIndex = rows.map((r) => r.id);

    try {
      const results = await uploadPdfsInParallelBatches(files, (index, progress) => {
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== idByIndex[index]) return r;
            return { ...r, progress, status: "uploading" as const };
          }),
        );
      });

      setRows((prev) =>
        prev.map((r, i) => {
          const res = results[i];
          if (!res) return { ...r, status: "error" as const, errorMessage: "Resposta em falta." };
          return {
            ...r,
            status: "done" as const,
            progress: 100,
            publicBlobUrl: res.publicBlobUrl,
            blobName: res.blobName,
          };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no envio.";
      setError(msg);
      setRows((prev) =>
        prev.map((r) =>
          r.status === "uploading" || r.status === "idle"
            ? { ...r, status: "error" as const, errorMessage: msg, progress: 0 }
            : r,
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-lg space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-[border-color,background-color]",
          uploading && "pointer-events-none opacity-60",
          dragOver
            ? "border-primary-500 bg-primary-50"
            : "border-neutral-300 bg-white hover:border-primary-400 hover:bg-primary-50/50",
        )}
      >
        <p className="text-sm font-medium text-neutral-800">Arrasta PDFs para aqui</p>
        <p className="mt-1 text-xs text-neutral-500">ou clica para escolher ficheiros</p>
        <p className="mt-3 text-xs text-neutral-400">
          Máx. {MAX_UI_PDF_FILES} ficheiros · {MAX_UI_PDF_BYTES / (1024 * 1024)} MB por ficheiro · envio
          direto para Azure Blob (SAS)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={uploading}
          className="sr-only"
          aria-label="Selecionar ficheiros PDF"
          onChange={onInputChange}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-800">Ficheiros</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                disabled={uploading}
                onClick={clearAll}
              >
                Limpar tudo
              </Button>
              <Button
                type="button"
                className="h-9 px-3 text-xs"
                disabled={uploading}
                onClick={() => void startUpload()}
              >
                {uploading ? "A enviar…" : "Enviar para o Azure"}
              </Button>
            </div>
          </div>
          <ul className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-all font-medium text-neutral-900" title={r.file.name}>
                    {r.file.name}
                  </span>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => removeAt(r.id)}
                    className="shrink-0 text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-200",
                      r.status === "error" ? "bg-red-500" : "bg-primary-500",
                    )}
                    style={{ width: `${r.status === "done" ? 100 : r.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {r.status === "idle" && "Pronto para enviar."}
                  {r.status === "uploading" && `${r.progress}%`}
                  {r.status === "done" && "Concluído no storage."}
                  {r.status === "error" && (r.errorMessage ?? "Erro.")}
                </p>
                {r.status === "done" && r.publicBlobUrl && (
                  <p className="mt-1 break-all text-xs text-primary-700" title={r.publicBlobUrl}>
                    {r.publicBlobUrl}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
