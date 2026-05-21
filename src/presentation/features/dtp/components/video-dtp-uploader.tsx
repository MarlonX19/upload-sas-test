"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  DEFAULT_DTP_OUTPUT_LANGUAGE,
  DTP_OUTPUT_LANGUAGE_OPTIONS,
  type DtpOutputLanguage,
} from "@/domain/dtp/dtp-output-language";
import {
  ALLOWED_DTP_VIDEO_EXTENSIONS,
  MAX_DTP_VIDEO_BYTES,
} from "@/domain/upload/video-dtp-upload-policy";
import { fetchDtpJob, uploadDtpVideoWithProgress } from "@/lib/upload/dtp-video-upload";
import { DtpScreenRecorderPanel } from "@/presentation/features/dtp/components/dtp-screen-recorder-panel";
import { Button } from "@/presentation/shared/ui/button";
import { cn } from "@/lib/cn";

type Phase = "idle" | "uploading" | "processing" | "completed" | "error";
type EntryMode = "upload" | "record";

function isVideoFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ALLOWED_DTP_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function processingMessage(status: string): string {
  if (status === "queued") return "Na fila de processamento…";
  if (status === "processing") return "A extrair frames, analisar com IA e gerar PDF…";
  return "A processar…";
}

function RecordVideoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M4.5 3.75a3 3 0 0 0-3 3v8.25a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-8.25a3 3 0 0 0-3-3H4.5ZM15.75 8.25a.75.75 0 0 1 .53.22l3.75 3.75a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 0 1-1.28-.53V9.75a.75.75 0 0 1 .75-.75Z" />
      <path d="M12 1.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 12 1.5Z" />
    </svg>
  );
}

export function VideoDtpUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<DtpOutputLanguage>(DEFAULT_DTP_OUTPUT_LANGUAGE);

  const jobQuery = useQuery({
    queryKey: ["dtp-job", jobId],
    queryFn: () => fetchDtpJob(jobId!),
    enabled: !!jobId && phase !== "idle" && phase !== "uploading",
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      if (status === "queued" || status === "processing") return 2500;
      return false;
    },
  });

  const job = jobQuery.data?.job;
  const jobStatus = job?.status;

  const displayPhase: Phase =
    phase === "uploading"
      ? "uploading"
      : jobStatus === "completed"
        ? "completed"
        : jobStatus === "failed"
          ? "error"
          : jobId
            ? "processing"
            : phase;

  const displayError =
    displayPhase === "error"
      ? (job?.errorMessage ?? error ?? "A análise falhou.")
      : error;

  const reset = useCallback(() => {
    setFile(null);
    setEntryMode("upload");
    setPhase("idle");
    setUploadProgress(0);
    setJobId(null);
    setError(null);
    setOutputLanguage(DEFAULT_DTP_OUTPUT_LANGUAGE);
  }, []);

  const pickFile = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    const f = list[0]!;
    if (!isVideoFile(f)) {
      setError("Selecione um vídeo MP4, WebM ou MOV.");
      return;
    }
    if (f.size > MAX_DTP_VIDEO_BYTES) {
      setError(`O vídeo excede o limite de ${MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setError(null);
    setFile(f);
    setEntryMode("upload");
    setPhase("idle");
    setJobId(null);
    setUploadProgress(0);
  }, []);

  const handleRecordedFile = useCallback((recorded: File) => {
    if (!isVideoFile(recorded)) {
      setError("A gravação deve ser um ficheiro .webm.");
      return;
    }
    if (recorded.size > MAX_DTP_VIDEO_BYTES) {
      setError(`A gravação excede o limite de ${MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setError(null);
    setFile(recorded);
    setEntryMode("upload");
    setPhase("idle");
    setJobId(null);
    setUploadProgress(0);
  }, []);

  const startFlow = async () => {
    if (!file || phase === "uploading" || phase === "processing") return;
    setError(null);
    setPhase("uploading");
    setUploadProgress(0);

    try {
      const { job } = await uploadDtpVideoWithProgress(file, outputLanguage, setUploadProgress);
      setPhase("processing");
      setJobId(job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no envio do vídeo.";
      setError(msg);
      setPhase("error");
    }
  };

  const busy = displayPhase === "uploading" || displayPhase === "processing";

  return (
    <div className="w-full space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <label htmlFor="dtp-output-language" className="text-sm font-medium text-neutral-800">
          Idioma do texto (IA)
        </label>
        <p className="mt-0.5 text-xs text-neutral-500">
          Títulos e descrições dos passos no PDF serão gerados neste idioma.
        </p>
        <select
          id="dtp-output-language"
          value={outputLanguage}
          disabled={busy}
          onChange={(e) => setOutputLanguage(e.target.value as DtpOutputLanguage)}
          className="mt-2 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:opacity-60"
        >
          {DTP_OUTPUT_LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {entryMode === "upload" && (
        <>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!busy) inputRef.current?.click();
              }
            }}
            onClick={() => !busy && inputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy && e.dataTransfer.files?.length) pickFile(e.dataTransfer.files);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDragEnter={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-[border-color,background-color]",
              busy && "pointer-events-none opacity-70",
              dragOver
                ? "border-primary-500 bg-primary-50"
                : "border-neutral-300 bg-white hover:border-primary-400 hover:bg-primary-50/50",
            )}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6"
                aria-hidden
              >
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 8.94l-2.69 2.69a.75.75 0 1 1-1.06-1.06l2.69-2.69a.75.75 0 1 1 1.06 1.06ZM17.25 12a.75.75 0 0 1 .75.75v3.19l1.72 1.72a.75.75 0 1 1-1.06 1.06l-2-2a.75.75 0 0 1-.22-.53V12.75a.75.75 0 0 1 .75-.75Z" />
                <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-800">Arrasta a gravação de ecrã para aqui</p>
            <p className="mt-1 text-xs text-neutral-500">ou clica para escolher um vídeo</p>
            <p className="mt-3 text-xs text-neutral-400">
              MP4, WebM ou MOV · máx. {MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB · envio temporário ao servidor
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              disabled={busy}
              className="sr-only"
              aria-label="Selecionar vídeo"
              onChange={(e) => {
                if (e.target.files?.length) pickFile(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {!file && !busy && displayPhase !== "completed" && (
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-neutral-200" aria-hidden />
              <span className="text-xs font-medium text-neutral-400">ou</span>
              <div className="h-px flex-1 bg-neutral-200" aria-hidden />
            </div>
          )}

          {!file && !busy && displayPhase !== "completed" && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 px-4 text-sm"
                onClick={() => {
                  setError(null);
                  setEntryMode("record");
                }}
              >
                <RecordVideoIcon className="h-5 w-5 text-primary-600" />
                Gravar vídeo
              </Button>
            </div>
          )}
        </>
      )}

      {entryMode === "record" && !file && (
        <DtpScreenRecorderPanel
          disabled={busy}
          onBack={() => {
            setError(null);
            setEntryMode("upload");
          }}
          onReady={handleRecordedFile}
        />
      )}

      {displayError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {displayError}
        </p>
      )}

      {file && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{formatBytes(file.size)}</p>
            </div>
            {!busy && displayPhase !== "completed" && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-neutral-500 hover:text-red-600"
              >
                Remover
              </button>
            )}
          </div>

          {(displayPhase === "uploading" || displayPhase === "processing") && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-primary-500 transition-[width] duration-200"
                  style={{ width: `${displayPhase === "uploading" ? uploadProgress : 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                {displayPhase === "uploading" && `A enviar vídeo… ${uploadProgress}%`}
                {displayPhase === "processing" && processingMessage(job?.status ?? "queued")}
              </p>
            </div>
          )}

          {displayPhase === "idle" && (
            <div className="mt-4">
              <Button type="button" className="h-10 px-4 text-sm" onClick={() => void startFlow()}>
                Iniciar análise
              </Button>
            </div>
          )}

          {displayPhase === "error" && (
            <div className="mt-4">
              <Button type="button" variant="outline" className="h-10 px-4 text-sm" onClick={reset}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {displayPhase === "completed" && job && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-medium text-green-900">Documentação DTP pronta para download.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-9 px-3 text-sm" onClick={reset}>
                Novo vídeo
              </Button>
              <a
                href={`/api/dtp/jobs/${encodeURIComponent(job.id)}/download`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                Descarregar PDF
              </a>
            </div>
          </div>

          {job.steps && job.steps.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-surface-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Passos identificados</h2>
              <ol className="mt-4 space-y-4">
                {job.steps
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <li
                      key={step.order}
                      className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-100 px-2 text-xs font-bold text-primary-700">
                          {step.order}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">{step.title}</span>
                        <span className="text-xs font-medium text-neutral-400">
                          {formatTimestamp(step.timestampSec)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.description}</p>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
