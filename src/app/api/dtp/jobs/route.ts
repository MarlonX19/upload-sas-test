import { NextResponse } from "next/server";

import { CreateDtpJobWithVideoUseCase } from "@/application/dtp/use-cases/create-dtp-job-with-video.use-case";
import { toDtpJobClientView } from "@/application/dtp/dtos/dtp-job-client.view";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { getSessionUserId } from "@/lib/dtp/session-user-id";
import { logger } from "@/lib/logger";
import {
  isAllowedDtpVideoFileName,
  isAllowedDtpVideoMime,
  MAX_DTP_VIDEO_BYTES,
  normalizeDtpVideoMime,
} from "@/domain/upload/video-dtp-upload-policy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    logger.error(
      {
        event: "dtp_create_job_bad_form",
        exceptionMessage: e instanceof Error ? e.message : String(e),
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "POST dtp/jobs: formData inválido.",
    );
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const file = form.get("video");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Campo «video» em falta." }, { status: 400 });
  }

  const fileName = file.name.trim() || "video.mp4";
  const mimeType = normalizeDtpVideoMime(file.type.trim() || "video/mp4");
  const fileSize = file.size;

  if (!isAllowedDtpVideoFileName(fileName)) {
    return NextResponse.json({ error: "Extensão de vídeo não suportada." }, { status: 400 });
  }
  if (!isAllowedDtpVideoMime(mimeType)) {
    return NextResponse.json({ error: "Tipo MIME de vídeo não suportado." }, { status: 400 });
  }
  if (fileSize > MAX_DTP_VIDEO_BYTES) {
    return NextResponse.json(
      { error: `O vídeo excede o limite de ${MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }
  if (fileSize === 0) {
    return NextResponse.json({ error: "Ficheiro de vídeo vazio." }, { status: 400 });
  }

  const uc = container.get(CreateDtpJobWithVideoUseCase);
  const out = await uc.execute({
    userId: getSessionUserId(session),
    fileName,
    mimeType,
    fileSize,
    body: file.stream(),
  });

  if (!out.ok) {
    const status = out.code === "FILE_TOO_LARGE" ? 413 : 400;
    return NextResponse.json({ error: out.message }, { status });
  }

  return NextResponse.json({ job: toDtpJobClientView(out.job) }, { status: 201 });
}
