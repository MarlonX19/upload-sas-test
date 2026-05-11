import { DefaultAzureCredential } from "@azure/identity";
import { BlockBlobClient, RestError } from "@azure/storage-blob";

import type { RoomPdfBinaryFetcher } from "@/application/ports/room-pdf-binary-fetcher.port";

const DOWNLOAD_TIMEOUT_MS = 120_000;

function isAzureBlobHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".blob.core.windows.net") || h.endsWith(".blob.storage.azure.net");
}

/**
 * Descarga o PDF como no vsideation: para blobs Azure, SDK + DefaultAzureCredential (leitura RBAC),
 * URL canónica sem query — evita 403/409 por GET anónimo em contentor privado.
 */
export class AzureRoomPdfBinaryFetcher implements RoomPdfBinaryFetcher {
  async fetchFromUrl(url: string): Promise<Uint8Array> {
    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("URL do blob inválida.");
    }

    if (isAzureBlobHost(parsed.hostname)) {
      const blobClientUrl = `${parsed.origin}${parsed.pathname}`;
      const credential = new DefaultAzureCredential();
      const client = new BlockBlobClient(blobClientUrl, credential);

      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), DOWNLOAD_TIMEOUT_MS);
      try {
        const buf = await client.downloadToBuffer(0, undefined, {
          abortSignal: abort.signal,
        });
        if (buf.length >= 4) {
          const head = buf.subarray(0, 4);
          if (head[0] !== 0x25 || head[1] !== 0x50 || head[2] !== 0x44 || head[3] !== 0x46) {
            throw new Error("O conteúdo descarregado não parece ser um PDF válido (%PDF).");
          }
        }
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch (e) {
        if (e instanceof RestError) {
          const code = e.code ?? "unknown";
          const status = e.statusCode;
          throw new Error(
            `Azure Blob (${status ?? "?"} / ${code}): ${e.message}. Confirme «Storage Blob Data Reader» (ou equivalente) no container para a identidade do DefaultAzureCredential. 409 costuma indicar conflito de lease/imutabilidade/tier — ver detalhe no portal Azure.`,
          );
        }
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error("Timeout ao descarregar o PDF do Azure Storage.");
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    }

    const res = await fetch(trimmed, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(
        `Falha ao descarregar o PDF (${res.status}). Para blobs privados em Azure, a URL deve ser *.blob.core.windows.net e o servidor precisa de credencial de leitura.`,
      );
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
}
