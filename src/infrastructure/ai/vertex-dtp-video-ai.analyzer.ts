import { createVertex } from "@ai-sdk/google-vertex";
import type { UserModelMessage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";

import type {
  DtpVideoAiAnalyzer,
  DtpVideoAiModelOutput,
} from "@/application/ports/dtp-video-ai-analyzer.port";
import { dtpAiLanguageInstruction, type DtpOutputLanguage } from "@/domain/dtp/dtp-output-language";
import { findNearestFrame } from "@/domain/dtp/map-timestamp-to-frame";
import { logger } from "@/lib/logger";

const stepsSchema = z.object({
  steps: z
    .array(
      z.object({
        order: z.number().int(),
        title: z.string(),
        description: z.string(),
        timestampSec: z.number(),
      }),
    )
    .min(1)
    .max(50),
});

function loadServiceAccountFromEnv(): { project_id: string } & Record<string, unknown> {
  const b64 = process.env.GENAI_KEY?.trim();
  if (!b64) {
    throw new Error("GENAI_KEY em falta para Vertex AI.");
  }
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as { project_id: string } & Record<string, unknown>;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export class VertexDtpVideoAiAnalyzer implements DtpVideoAiAnalyzer {
  private readonly model;

  constructor() {
    const credentials = loadServiceAccountFromEnv();
    const project = credentials.project_id;
    const modelId = process.env.GENAI_MODEL?.trim() || "gemini-2.5-flash";
    const vertex = createVertex({
      project,
      location: "global",
      googleAuthOptions: { credentials },
    });
    this.model = vertex(modelId);
  }

  async detectStepsFromFrames(input: {
    frames: { timestampSec: number; pngBytes: Uint8Array }[];
    videoFileName: string;
    outputLanguage: DtpOutputLanguage;
  }): Promise<DtpVideoAiModelOutput> {
    const sortedFrames = [...input.frames].sort((a, b) => a.timestampSec - b.timestampSec);
    const frameList = sortedFrames
      .map((f) => `- ${formatTimestamp(f.timestampSec)} (${f.timestampSec}s)`)
      .join("\n");

    const langLine = dtpAiLanguageInstruction(input.outputLanguage);

    const prompt = `Analise estas capturas de ecrã extraídas de uma gravação de vídeo de software ("${input.videoFileName}").
Cada imagem corresponde a um momento no vídeo (timestamps listados abaixo), ordenados do início ao fim.
A documentação é de uso interno da empresa.
${langLine}
Ignore diálogos do browser de partilha de ecrã, ecrãs pretos ou UI de sistema no início; foque no fluxo real da aplicação demonstrada depois da gravação começar.
Identifique vários passos sequenciais do procedimento demonstrado no vídeo (mínimo 2 se o conteúdo o permitir).
Para cada passo, indique:
- order: número sequencial (1, 2, 3…)
- title: título curto do passo
- description: instrução clara do que foi feito e/o o que o utilizador deve fazer
- timestampSec: segundo no vídeo que melhor representa esse passo (use os timestamps disponíveis)

TIMESTAMPS DAS CAPTURAS:
${frameList}

Respeite o schema. Seja concreto e operacional.`;

    const content: UserModelMessage["content"] = [{ type: "text", text: prompt }];
    for (const frame of sortedFrames) {
      content.push({
        type: "file",
        filename: `frame-${formatTimestamp(frame.timestampSec)}.png`,
        data: frame.pngBytes,
        mediaType: "image/png",
      });
    }

    const t0 = performance.now();
    let result;
    try {
      result = await generateObject({
        model: this.model,
        schema: stepsSchema,
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(
        {
          event: "vertex_dtp_analysis_failed",
          videoFileName: input.videoFileName,
          frameCount: sortedFrames.length,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Vertex Gemini falhou na deteção de passos DTP.",
      );
      throw e;
    }

    const durationMs = Math.round(performance.now() - t0);
    const rawSteps = result.object.steps.sort((a, b) => a.order - b.order);

    const steps = rawSteps.map((step) => {
      const nearest = findNearestFrame(sortedFrames, step.timestampSec);
      return {
        order: step.order,
        title: step.title,
        description: step.description,
        timestampSec: nearest?.timestampSec ?? step.timestampSec,
      };
    });

    return {
      steps,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
      durationMs,
    };
  }
}
