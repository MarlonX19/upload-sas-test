import { DefaultAzureCredential } from "@azure/identity";
import { BlockBlobClient, RestError } from "@azure/storage-blob";

import type { BlobBinaryFetcherPort } from "@/application/ports/blob-binary-fetcher.port";

const DOWNLOAD_TIMEOUT_MS = 300_000;

function isAzureBlobHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".blob.core.windows.net") || h.endsWith(".blob.storage.azure.net");
}

export class AzureBlobBinaryFetcher implements BlobBinaryFetcherPort {
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
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch (e) {
        if (e instanceof RestError) {
          throw new Error(`Azure Blob: ${e.message}`);
        }
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error("Timeout ao descarregar o blob do Azure Storage.");
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
      throw new Error(`Falha ao descarregar o blob (${res.status}).`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
}
