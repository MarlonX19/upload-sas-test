"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildDefaultDtpRecordingFileName,
  buildDisplayMediaConstraints,
  formatRecordingElapsed,
  isScreenCaptureSupported,
  mapCaptureError,
  MAX_DTP_VIDEO_DURATION_SEC,
  pickMediaRecorderMimeType,
  recordingBlobToFile,
  type DtpCaptureTarget,
  type DtpRecorderPhase,
  validateRecordedFile,
} from "@/lib/dtp/dtp-screen-recorder-utils";

export type UseDtpScreenRecorderResult = {
  phase: DtpRecorderPhase;
  captureTarget: DtpCaptureTarget;
  setCaptureTarget: (target: DtpCaptureTarget) => void;
  fileName: string;
  setFileName: (name: string) => void;
  previewUrl: string | null;
  recordedFile: File | null;
  elapsedSec: number;
  error: string | null;
  clearError: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  discardRecording: () => void;
  confirmRecording: () => File | null;
  resetToSetup: () => void;
};

function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function useDtpScreenRecorder(): UseDtpScreenRecorderResult {
  const [phase, setPhase] = useState<DtpRecorderPhase>("setup");
  const [captureTarget, setCaptureTarget] = useState<DtpCaptureTarget>("browser");
  const [fileName, setFileName] = useState(buildDefaultDtpRecordingFileName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const cleanupCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recordingStartRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const finishWithBlob = useCallback(
    (blob: Blob) => {
      cleanupCapture();
      if (blob.size === 0) {
        setError("A gravação está vazia. Tente gravar novamente.");
        setPhase("setup");
        return;
      }
      const defaultName = buildDefaultDtpRecordingFileName();
      const file = recordingBlobToFile(blob, defaultName);
      const validationError = validateRecordedFile(file);
      if (validationError) {
        setError(validationError);
        setPhase("setup");
        return;
      }
      revokePreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setRecordedFile(file);
      setFileName(file.name);
      setPhase("preview");
    },
    [cleanupCapture, revokePreview],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupCapture();
      setPhase("setup");
      return;
    }
    if (recorder.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        /* alguns browsers não suportam */
      }
    }
    recorder.stop();
  }, [cleanupCapture]);

  const handleRecorderStop = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    finishWithBlob(blob);
  }, [finishWithBlob]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!isScreenCaptureSupported()) {
      setError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "A gravação de ecrã requer HTTPS (ou localhost)."
          : "O seu browser não suporta gravação de ecrã.",
      );
      return;
    }

    cleanupCapture();
    setRecordedFile(null);
    revokePreview();
    setElapsedSec(0);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(
        buildDisplayMediaConstraints(captureTarget),
      );
      streamRef.current = stream;

      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          if (recorderRef.current?.state === "recording") {
            stopRecording();
          }
        };
      }

      const mimeType = pickMediaRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = handleRecorderStop;
      recorder.onerror = () => {
        setError("Erro durante a gravação.");
        cleanupCapture();
        setPhase("setup");
      };

      recorder.start(1000);
      setPhase("recording");
      recordingStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const start = recordingStartRef.current;
        if (!start) return;
        const sec = Math.floor((Date.now() - start) / 1000);
        setElapsedSec(sec);
        if (sec >= MAX_DTP_VIDEO_DURATION_SEC) {
          stopRecording();
        }
      }, 500);
    } catch (e) {
      cleanupCapture();
      setError(mapCaptureError(e));
      setPhase("setup");
    }
  }, [
    captureTarget,
    cleanupCapture,
    handleRecorderStop,
    revokePreview,
    stopRecording,
  ]);

  const discardRecording = useCallback(() => {
    cleanupCapture();
    revokePreview();
    setRecordedFile(null);
    setFileName(buildDefaultDtpRecordingFileName());
    setElapsedSec(0);
    setError(null);
    setPhase("setup");
  }, [cleanupCapture, revokePreview]);

  const resetToSetup = useCallback(() => {
    discardRecording();
  }, [discardRecording]);

  const confirmRecording = useCallback((): File | null => {
    if (!recordedFile) return null;
    const file = recordingBlobToFile(recordedFile, fileName.trim() || recordedFile.name);
    const validationError = validateRecordedFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }
    setRecordedFile(file);
    return file;
  }, [fileName, recordedFile]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      cleanupCapture();
      revokePreview();
    };
  }, [cleanupCapture, revokePreview]);

  return {
    phase,
    captureTarget,
    setCaptureTarget,
    fileName,
    setFileName,
    previewUrl,
    recordedFile,
    elapsedSec,
    error,
    clearError,
    startRecording,
    stopRecording,
    discardRecording,
    confirmRecording,
    resetToSetup,
  };
}

export { formatRecordingElapsed };
