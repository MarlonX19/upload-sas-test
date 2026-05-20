import { initializeOpenTelemetry } from "@/lib/open-telemetry";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  await initializeOpenTelemetry();

  const redisUrl = process.env.REDIS_CONNECTION_STRING?.trim();
  const genaiKey = process.env.GENAI_KEY?.trim();
  if (!redisUrl || !genaiKey) {
    return;
  }
  try {
    const { startRoomFileDocumentAnalysisWorker } = await import(
      "@/infrastructure/queue/room-file-document-analysis.worker"
    );
    startRoomFileDocumentAnalysisWorker();
    const { startDtpVideoAnalysisWorker } = await import(
      "@/infrastructure/queue/dtp-video-analysis.worker"
    );
    startDtpVideoAnalysisWorker();
  } catch (e) {
    console.error("[instrumentation] Não foi possível iniciar workers de análise.", e);
  }
}
