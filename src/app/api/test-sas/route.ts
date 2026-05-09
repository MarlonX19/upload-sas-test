import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const containerName = process.env.AZURE_STORAGE_UPLOADS_CONTAINER || "workspace";
const blobName = "test.txt";

export async function GET() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (!accountName?.trim()) {
    return NextResponse.json(
      { error: "Defina AZURE_STORAGE_ACCOUNT_NAME no ambiente (ex.: .env.local)." },
      { status: 500 },
    );
  }

  try {
    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );

    const now = new Date();
    const expiresOn = new Date(now.valueOf() + 10 * 60 * 1000);

    const delegationKey = await blobServiceClient.getUserDelegationKey(now, expiresOn);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        startsOn: now,
        expiresOn,
      },
      delegationKey,
      accountName,
    ).toString();

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sas}`;

    return NextResponse.json({
      url,
      hint: "SAS de user delegation (criar + escrever blob de teste). Expira em ~10 min.",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao gerar SAS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
