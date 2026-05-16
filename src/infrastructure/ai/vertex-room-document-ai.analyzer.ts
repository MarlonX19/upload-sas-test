import { createVertex } from "@ai-sdk/google-vertex";
import type { UserModelMessage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";

import type {
  GeminiCallMetrics,
  RoomDocumentAiAnalyzer,
  RoomDocumentAiModelOutput,
} from "@/application/ports/room-document-ai-analyzer.port";
import type {
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";
import { logger } from "@/lib/logger";

const stepsSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        order: z.number().int(),
      }),
    )
    .min(1)
    .max(80),
});

const socosSchema = z.object({
  socos: z
    .array(
      z.object({
        severity: z.enum(["low", "medium", "high"]),
        topic: z.string(),
        detail: z.string(),
      }),
    )
    .max(50),
});

const ideasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        rationale: z.string(),
      }),
    )
    .max(40),
});

function loadServiceAccountFromEnv(): { project_id: string } & Record<string, unknown> {
  const b64 = process.env.GENAI_KEY?.trim();
  if (!b64) {
    throw new Error("GENAI_KEY em falta para Vertex AI.");
  }
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as { project_id: string } & Record<string, unknown>;
}

function usageToMetrics(durationMs: number, usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }): GeminiCallMetrics {
  return {
    durationMs,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    totalTokens: usage?.totalTokens,
  };
}

/** Regista uso do Vertex por fase para o Collector / Jaeger. */
function logGeminiPhase(phase: string, pdfBytesLen: number | undefined, metrics: GeminiCallMetrics): void {
  logger.info(
    {
      event: "vertex_document_analysis_phase",
      phase,
      pdfBytesLen: pdfBytesLen ?? null,
      durationMs: metrics.durationMs,
      inputTokens: metrics.inputTokens ?? null,
      outputTokens: metrics.outputTokens ?? null,
      totalTokens: metrics.totalTokens ?? null,
    },
    `Vertex Gemini: ${phase} concluída.`,
  );
}

export class VertexRoomDocumentAiAnalyzer implements RoomDocumentAiAnalyzer {
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

  async extractStepsFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentAiModelOutput<RoomDocumentStep[]>> {
    const prompt =
      "Analise o documento PDF anexado (procedimento ou instruções operacionais). Extraia passos sequenciais claros com título, descrição e ordem numérica. Use português. Respeite a estrutura do schema.";

    const messages: UserModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "file",
            filename: "documento.pdf",
            data: input.pdfBytes,
            mediaType: input.mimeType || "application/pdf",
          },
        ],
      },
    ];

    const t0 = performance.now();
    let result;
    try {
      result = await generateObject({
        model: this.model,
        schema: stepsSchema,
        messages,
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - t0);
      const message = e instanceof Error ? e.message : String(e);
      logger.error(
        {
          event: "vertex_document_analysis_phase_failed",
          phase: "extract_steps",
          pdfBytesLen: input.pdfBytes.byteLength,
          durationMs,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Vertex Gemini falhou em extract_steps.",
      );
      throw e;
    }
    const metrics = usageToMetrics(Math.round(performance.now() - t0), result.usage);
    logGeminiPhase("extract_steps", input.pdfBytes.byteLength, metrics);
    const output = result.object.steps.sort((a, b) => a.order - b.order);
    return { output, metrics };
  }

  async extractSocosFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentAiModelOutput<RoomDocumentSoco[]>> {
    const prompt =
      "Com base no PDF anexado, liste achados tipo SOCOS: riscos, lacunas de informação, possíveis pontos de não conformidade, ambiguidades, gargalos operacionais e perguntas em aberto que um auditor ou gestor de qualidade faria. Use português. Seja concreto. Respeite o schema (topic + detail + severity).";

    const messages: UserModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "file",
            filename: "documento.pdf",
            data: input.pdfBytes,
            mediaType: input.mimeType || "application/pdf",
          },
        ],
      },
    ];

    const t0 = performance.now();
    let result;
    try {
      result = await generateObject({
        model: this.model,
        schema: socosSchema,
        messages,
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - t0);
      const message = e instanceof Error ? e.message : String(e);
      logger.error(
        {
          event: "vertex_document_analysis_phase_failed",
          phase: "extract_socos",
          pdfBytesLen: input.pdfBytes.byteLength,
          durationMs,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Vertex Gemini falhou em extract_socos.",
      );
      throw e;
    }
    const metrics = usageToMetrics(Math.round(performance.now() - t0), result.usage);
    logGeminiPhase("extract_socos", input.pdfBytes.byteLength, metrics);
    return { output: result.object.socos, metrics };
  }

  async generateIdeasFromSteps(input: { steps: RoomDocumentStep[] }): Promise<RoomDocumentAiModelOutput<RoomDocumentIdea[]>> {
    const sorted = [...input.steps].sort((a, b) => a.order - b.order);
    const stepsBlock = sorted
      .map((s, i) => `${i + 1}. (${s.order}) ${s.title}: ${s.description}`)
      .join("\n");

    const prompt = `Com base nestes passos de um processo ou procedimento, sugira ideias práticas de melhoria: automação, redução de erros, eficiência, melhor experiência de serviço e priorização. Responda em português.\n\nPASSOS:\n${stepsBlock}`;

    const t0 = performance.now();
    let result;
    try {
      result = await generateObject({
        model: this.model,
        schema: ideasSchema,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - t0);
      const message = e instanceof Error ? e.message : String(e);
      logger.error(
        {
          event: "vertex_document_analysis_phase_failed",
          phase: "generate_ideas",
          durationMs,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Vertex Gemini falhou em generate_ideas.",
      );
      throw e;
    }
    const metrics = usageToMetrics(Math.round(performance.now() - t0), result.usage);
    logGeminiPhase("generate_ideas", undefined, metrics);
    return { output: result.object.ideas, metrics };
  }
}
