import { NextResponse } from "next/server";

import { toDtpJobClientView } from "@/application/dtp/dtos/dtp-job-client.view";
import { createDtpJobBodySchema } from "@/application/dtp/dtos/create-dtp-job.schema";
import { CreateDtpJobUseCase } from "@/application/dtp/use-cases/create-dtp-job.use-case";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { getSessionUserId } from "@/lib/dtp/session-user-id";
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
        event: "dtp_create_job_bad_json",
        exceptionMessage: e instanceof Error ? e.message : String(e),
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "POST dtp/jobs: corpo JSON inválido.",
    );
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = createDtpJobBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(CreateDtpJobUseCase);
  const userId = getSessionUserId(session);
  const out = await uc.execute(userId, parsed.data);

  if (!out.ok) {
    return NextResponse.json({ error: out.message }, { status: 400 });
  }

  return NextResponse.json({ job: toDtpJobClientView(out.job) }, { status: 201 });
}
