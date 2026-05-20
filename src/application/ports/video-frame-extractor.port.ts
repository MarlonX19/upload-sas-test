export type ExtractedVideoFrame = {
  timestampSec: number;
  pngBytes: Uint8Array;
};

export interface VideoFrameExtractorPort {
  extractFrames(input: {
    videoPath: string;
    maxFrames: number;
    sampleIntervalSec: number;
    maxDurationSec: number;
  }): Promise<{ durationSec: number; frames: ExtractedVideoFrame[] }>;
}
