import {
  isAllowedDtpVideoFileName,
  MAX_DTP_VIDEO_BYTES,
  MAX_DTP_VIDEO_DURATION_SEC,
} from "@/domain/upload/video-dtp-upload-policy";

export type DtpCaptureTarget = "browser" | "monitor";

export type DtpRecorderPhase = "idle" | "setup" | "recording" | "preview";

const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function pickMediaRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const mime of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "video/webm";
}

export function buildDefaultDtpRecordingFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  return `Gravação DTP ${stamp}.webm`;
}

export function ensureWebmFileName(name: string): string {
  const trimmed = name.trim() || buildDefaultDtpRecordingFileName();
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(".webm")) return trimmed;
  return `${trimmed.replace(/\.[^.]+$/, "")}.webm`;
}

export function recordingBlobToFile(blob: Blob, fileName: string): File {
  const safeName = ensureWebmFileName(fileName);
  return new File([blob], safeName, { type: "video/webm" });
}

export function validateRecordedFile(file: File): string | null {
  if (!isAllowedDtpVideoFileName(file.name)) {
    return "O nome do ficheiro deve terminar em .webm.";
  }
  if (file.size === 0) return "A gravação está vazia. Tente gravar novamente.";
  if (file.size > MAX_DTP_VIDEO_BYTES) {
    return `A gravação excede o limite de ${MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export function formatRecordingElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export { MAX_DTP_VIDEO_DURATION_SEC };

export function isScreenCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function screenCaptureUnavailableMessage(): string {
  if (typeof window === "undefined") return "Gravação indisponível.";
  if (window.isSecureContext === false) {
    return "A gravação de ecrã requer HTTPS (ou localhost).";
  }
  return "O seu browser não suporta gravação de ecrã nesta página.";
}

export function mapCaptureError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Permissão de partilha de ecrã negada ou cancelada.";
    }
    if (err.name === "NotFoundError") {
      return "Nenhuma fonte de ecrã foi selecionada.";
    }
    if (err.name === "NotSupportedError") {
      return screenCaptureUnavailableMessage();
    }
  }
  return err instanceof Error ? err.message : "Falha ao iniciar a gravação.";
}

/** Constraints para getDisplayMedia conforme alvo escolhido. */
export function buildDisplayMediaConstraints(target: DtpCaptureTarget): DisplayMediaStreamOptions {
  const video: MediaTrackConstraints & { displaySurface?: string } =
    target === "browser"
      ? { displaySurface: "browser" }
      : { displaySurface: "monitor" };

  const base: DisplayMediaStreamOptions = {
    video,
    audio: false,
  };

  if (target === "browser") {
    return {
      ...base,
      // @ts-expect-error preferCurrentTab é extensão Chrome
      preferCurrentTab: true,
    };
  }

  return base;
}
