import type { DtpStep } from "@/domain/dtp/dtp-step";

export type DtpVideoFrameInput = {
  timestampSec: number;
  pngBytes: Uint8Array;
};

export type DtpVideoAiModelOutput = {
  steps: DtpStep[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs: number;
};

export interface DtpVideoAiAnalyzer {
  detectStepsFromFrames(input: {
    frames: DtpVideoFrameInput[];
    videoFileName: string;
  }): Promise<DtpVideoAiModelOutput>;
}
