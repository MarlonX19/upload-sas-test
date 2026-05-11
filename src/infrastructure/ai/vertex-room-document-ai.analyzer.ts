import { createVertex } from "@ai-sdk/google-vertex";
import type { UserModelMessage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";

import type { RoomDocumentAiAnalyzer } from "@/application/ports/room-document-ai-analyzer.port";
import type {
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";

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

  async extractStepsFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentStep[]> {
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

    const { object } = await generateObject({
      model: this.model,
      schema: stepsSchema,
      messages,
    });

    return object.steps.sort((a, b) => a.order - b.order);
  }

  async extractSocosFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentSoco[]> {
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

    const { object } = await generateObject({
      model: this.model,
      schema: socosSchema,
      messages,
    });

    return object.socos;
  }

  async generateIdeasFromSteps(input: { steps: RoomDocumentStep[] }): Promise<RoomDocumentIdea[]> {
    const sorted = [...input.steps].sort((a, b) => a.order - b.order);
    const stepsBlock = sorted
      .map((s, i) => `${i + 1}. (${s.order}) ${s.title}: ${s.description}`)
      .join("\n");

    const prompt = `Com base nestes passos de um processo ou procedimento, sugira ideias práticas de melhoria: automação, redução de erros, eficiência, melhor experiência de serviço e priorização. Responda em português.\n\nPASSOS:\n${stepsBlock}`;

    const { object } = await generateObject({
      model: this.model,
      schema: ideasSchema,
      messages: [{ role: "user", content: prompt }],
    });

    return object.ideas;
  }
}
