export type FrameCandidate = {
  timestampSec: number;
  pngBytes: Uint8Array;
};

/**
 * Encontra o frame cujo timestamp está mais próximo do alvo.
 */
export function findNearestFrame(
  frames: FrameCandidate[],
  timestampSec: number,
): FrameCandidate | undefined {
  if (frames.length === 0) return undefined;
  let best = frames[0]!;
  let bestDist = Math.abs(best.timestampSec - timestampSec);
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]!;
    const dist = Math.abs(f.timestampSec - timestampSec);
    if (dist < bestDist) {
      best = f;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Gera timestamps candidatos: cenas detectadas + amostragem uniforme até ao cap.
 */
export function buildCandidateTimestamps(
  durationSec: number,
  sceneTimestamps: number[],
  maxFrames: number,
  sampleIntervalSec: number,
): number[] {
  const unique = new Set<number>();
  for (const t of sceneTimestamps) {
    if (t >= 0 && t <= durationSec) unique.add(Math.round(t * 10) / 10);
  }
  if (unique.size < maxFrames && durationSec > 0) {
    const interval = Math.max(sampleIntervalSec, durationSec / maxFrames);
    for (let t = 0; t <= durationSec && unique.size < maxFrames; t += interval) {
      unique.add(Math.round(t * 10) / 10);
    }
  }
  if (unique.size === 0) unique.add(0);
  return [...unique].sort((a, b) => a - b).slice(0, maxFrames);
}
