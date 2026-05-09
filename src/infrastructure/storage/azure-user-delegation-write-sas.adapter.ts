import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";

const DEFAULT_CONTAINER = "workspace";
const SAS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

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

/**
 * User delegation SAS (cw) para upload direto ao Blob a partir do browser.
 */
export class AzureUserDelegationWriteSasAdapter implements UserDelegationWriteSasPort {
  async buildUploadUrlForBlob(params: { blobName: string }): Promise<{
    uploadUrl: string;
    publicBlobUrl: string;
    expiresOn: Date;
  }> {
    const accountName = getAccountName();
    const containerName = getContainerName();
    const blobName = params.blobName;

    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );

    const now = new Date();
    const startsOn = new Date(now.getTime() - CLOCK_SKEW_MS);
    const expiresOn = new Date(now.getTime() + SAS_TTL_MS);

    const delegationKey = await blobServiceClient.getUserDelegationKey(now, expiresOn);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        startsOn,
        expiresOn,
      },
      delegationKey,
      accountName,
    ).toString();

    const base = `https://${accountName}.blob.core.windows.net`;
    const path = [containerName, ...blobName.split("/")].map(encodeURIComponent).join("/");
    const publicBlobUrl = `${base}/${path}`;
    const uploadUrl = `${publicBlobUrl}?${sas}`;

    return { uploadUrl, publicBlobUrl, expiresOn };
  }
}
