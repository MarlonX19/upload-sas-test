import { NextResponse } from "next/server";

import { toDtpJobClientView } from "@/application/dtp/dtos/dtp-job-client.view";
import { GetDtpJobUseCase } from "@/application/dtp/use-cases/get-dtp-job.use-case";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { getSessionUserId } from "@/lib/dtp/session-user-id";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const uc = container.get(GetDtpJobUseCase);
  const out = await uc.execute(getSessionUserId(session), jobId);

  if (!out.ok) {
    return NextResponse.json({ error: out.message }, { status: 404 });
  }

  return NextResponse.json({ job: toDtpJobClientView(out.job) });
}
