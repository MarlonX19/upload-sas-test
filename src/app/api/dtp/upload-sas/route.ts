import { NextResponse } from "next/server";

import { issueVideoDtpUploadSasBodySchema } from "@/application/dtp/dtos/issue-video-dtp-upload-sas.schema";
import { IssueVideoDtpUploadSasUseCase } from "@/application/dtp/use-cases/issue-video-dtp-upload-sas.use-case";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch (e) {
    logger.error(
      {
        event: "dtp_upload_sas_bad_json",
        exceptionMessage: e instanceof Error ? e.message : String(e),
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "POST dtp/upload-sas: corpo JSON inválido.",
    );
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = issueVideoDtpUploadSasBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(IssueVideoDtpUploadSasUseCase);
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
