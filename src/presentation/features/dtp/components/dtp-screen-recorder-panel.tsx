"use client";

import {
  formatRecordingElapsed,
  isScreenCaptureSupported,
  MAX_DTP_VIDEO_DURATION_SEC,
  screenCaptureUnavailableMessage,
  type DtpCaptureTarget,
} from "@/lib/dtp/dtp-screen-recorder-utils";
import { useDtpScreenRecorder } from "@/lib/dtp/use-dtp-screen-recorder";
import { cn } from "@/lib/cn";
import { Button } from "@/presentation/shared/ui/button";

type Props = {
  disabled?: boolean;
  onBack: () => void;
  onReady: (file: File) => void;
};

function CaptureTargetCard({
  active,
  title,
  description,
  onClick,
  disabled,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col rounded-xl border-2 p-4 text-left transition",
        active
          ? "border-primary-500 bg-primary-50"
          : "border-neutral-200 bg-white hover:border-primary-300",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span className="text-sm font-semibold text-neutral-900">{title}</span>
      <span className="mt-1 text-xs leading-relaxed text-neutral-500">{description}</span>
    </button>
  );
}

export function DtpScreenRecorderPanel({ disabled, onBack, onReady }: Props) {
  const recorder = useDtpScreenRecorder();
  const supported = isScreenCaptureSupported();

  const handleConfirm = () => {
    const file = recorder.confirmRecording();
    if (file) onReady(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Gravar ecrã</h2>
        <button
          type="button"
          disabled={disabled || recorder.phase === "recording"}
          onClick={onBack}
          className="text-xs text-neutral-500 hover:text-primary-600 disabled:opacity-50"
        >
          Voltar ao upload
        </button>
      </div>

      {!supported && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {screenCaptureUnavailableMessage()}
        </p>
      )}

      {recorder.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {recorder.error}
        </p>
      )}

      {recorder.phase === "setup" && (
        <>
          <p className="text-xs text-neutral-500">
            Escolha o que pretende partilhar. O browser ainda pedirá confirmação no diálogo nativo de partilha de
            ecrã.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CaptureTargetCard
              active={recorder.captureTarget === "browser"}
              title="Janela do navegador"
              description="Grava o separador ou janela desta aplicação."
              disabled={disabled || !supported}
              onClick={() => recorder.setCaptureTarget("browser" satisfies DtpCaptureTarget)}
            />
            <CaptureTargetCard
              active={recorder.captureTarget === "monitor"}
              title="Ecrã inteiro"
              description="Grava o monitor completo (todo o desktop visível)."
              disabled={disabled || !supported}
              onClick={() => recorder.setCaptureTarget("monitor" satisfies DtpCaptureTarget)}
            />
          </div>
          <Button
            type="button"
            className="h-10 px-4 text-sm"
            disabled={disabled || !supported}
            onClick={() => void recorder.startRecording()}
          >
            Iniciar gravação
          </Button>
        </>
      )}

      {recorder.phase === "preview" && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Nome do vídeo</span>
            <input
              type="text"
              value={recorder.fileName}
              disabled={disabled}
              onChange={(e) => recorder.setFileName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </label>
          {recorder.previewUrl && (
            <video
              src={recorder.previewUrl}
              controls
              className="max-h-64 w-full rounded-lg border border-neutral-200 bg-black"
              aria-label="Pré-visualização da gravação"
            />
          )}
          {recorder.recordedFile && (
            <p className="text-xs text-neutral-500">
              {(recorder.recordedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-10 px-4 text-sm" disabled={disabled} onClick={handleConfirm}>
              Usar esta gravação
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 text-sm"
              disabled={disabled}
              onClick={recorder.discardRecording}
            >
              Gravar de novo
            </Button>
          </div>
        </div>
      )}

      {recorder.phase === "recording" && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="rounded-full bg-neutral-900/90 px-3 py-1 text-xs font-medium text-white shadow-lg">
            A gravar · {formatRecordingElapsed(recorder.elapsedSec)} /{" "}
            {formatRecordingElapsed(MAX_DTP_VIDEO_DURATION_SEC)}
          </span>
          <Button
            type="button"
            className="h-11 px-5 text-sm shadow-lg"
            onClick={recorder.stopRecording}
          >
            Encerrar gravação
          </Button>
        </div>
      )}
    </div>
  );
}
