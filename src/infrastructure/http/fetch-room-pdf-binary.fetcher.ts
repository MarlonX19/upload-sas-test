import type { RoomPdfBinaryFetcher } from "@/application/ports/room-pdf-binary-fetcher.port";

const DOWNLOAD_TIMEOUT_MS = 120_000;

export class FetchRoomPdfBinaryFetcher implements RoomPdfBinaryFetcher {
  async fetchFromUrl(url: string): Promise<Uint8Array> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Falha ao descarregar o PDF (${res.status}).`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
}
