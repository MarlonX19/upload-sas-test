import { NextResponse } from "next/server";

import { requestUploadSasBodySchema } from "@/application/upload/dtos/request-upload-sas.schema";
import { IssuePdfBlobUploadSasUseCase } from "@/application/upload/use-cases/issue-pdf-blob-upload-sas.use-case";
import { container } from "@/di/container";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = requestUploadSasBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(IssuePdfBlobUploadSasUseCase);
  const out = await uc.execute(parsed.data);

  if (!out.ok) {
    const status = out.code === "INVALID_FILE" ? 400 : 500;
    return NextResponse.json({ error: out.message }, { status });
  }

  return NextResponse.json({
    uploadUrl: out.uploadUrl,
    publicBlobUrl: out.publicBlobUrl,
    blobName: out.blobName,
    expiresOn: out.expiresOn,
  });
}
