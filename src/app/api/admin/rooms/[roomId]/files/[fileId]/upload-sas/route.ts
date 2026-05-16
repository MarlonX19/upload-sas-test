import { NextResponse } from "next/server";

import { issueRoomFileUploadSasBodySchema } from "@/application/rooms/dtos/issue-room-file-upload-sas.schema";
import { IssueRoomFileUploadSasUseCase } from "@/application/rooms/use-cases/issue-room-file-upload-sas.use-case";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; fileId: string }> };

export async function POST(req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { roomId, fileId: rawFileId } = await context.params;
  const fileId = decodeURIComponent(rawFileId);

  let json: unknown;
  try {
    json = await req.json();
  } catch (e) {
    logger.error(
      {
        event: "room_upload_sas_bad_json",
        roomId,
        fileId,
        exceptionMessage: e instanceof Error ? e.message : String(e),
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "POST upload-sas: corpo JSON inválido.",
    );
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = issueRoomFileUploadSasBodySchema.safeParse(json);
  if (!parsed.success) {
    logger.error(
      {
        event: "room_upload_sas_validation_failed",
        roomId,
        fileId,
        validationDetails: parsed.error.flatten(),
      },
      "POST upload-sas: validação falhou.",
    );
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(IssueRoomFileUploadSasUseCase);
  const out = await uc.execute(roomId, fileId, parsed.data);

  if (!out.ok) {
    if (out.code === "FILE_NOT_FOUND" || out.code === "ROOM_NOT_FOUND") {
      return NextResponse.json({ error: out.message }, { status: 404 });
    }
    if (out.code === "INVALID_BLOB") {
      return NextResponse.json({ error: out.message }, { status: 400 });
    }
    return NextResponse.json({ error: out.message }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl: out.uploadUrl,
    publicBlobUrl: out.publicBlobUrl,
    blobName: out.blobName,
    expiresOn: out.expiresOn,
  });
}
