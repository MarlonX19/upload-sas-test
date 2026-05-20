import type { DtpVideoAiAnalyzer } from "@/application/ports/dtp-video-ai-analyzer.port";

export class DisabledDtpVideoAiAnalyzer implements DtpVideoAiAnalyzer {
  async detectStepsFromFrames(input: {
    frames: { timestampSec: number; pngBytes: Uint8Array }[];
    videoFileName: string;
  }): Promise<never> {
    void input;
    throw new Error("Análise de vídeo por IA desactivada: defina GENAI_KEY.");
  }
}
