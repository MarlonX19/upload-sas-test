import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

import type { BlobBinaryUploaderPort } from "@/application/ports/blob-binary-uploader.port";

const DEFAULT_CONTAINER = "workspace";

function getAccountName(): string {
  const n = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  if (!n) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME não definido.");
  }
  return n;
}

function getContainerName(): string {
  return process.env.AZURE_STORAGE_UPLOADS_CONTAINER?.trim() || DEFAULT_CONTAINER;
}

export class AzureBlobBinaryUploader implements BlobBinaryUploaderPort {
  async uploadBytes(params: {
    blobName: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ publicBlobUrl: string }> {
    const accountName = getAccountName();
    const containerName = getContainerName();
    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(params.blobName);

    await blockBlobClient.uploadData(params.bytes, {
      blobHTTPHeaders: { blobContentType: params.contentType },
    });

    const base = `https://${accountName}.blob.core.windows.net`;
    const path = [containerName, ...params.blobName.split("/")].map(encodeURIComponent).join("/");
    return { publicBlobUrl: `${base}/${path}` };
  }
}
