import { NextResponse } from "next/server";

import { GetDtpJobUseCase } from "@/application/dtp/use-cases/get-dtp-job.use-case";
import { auth } from "@/auth";
import { container } from "@/di/container";
import { getSessionUserId } from "@/lib/dtp/session-user-id";
import { AzureBlobBinaryFetcher } from "@/infrastructure/storage/azure-blob-binary.fetcher";

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

  const job = out.job;
  if (job.status !== "completed" || !job.pdfBlobUrl) {
    return NextResponse.json({ error: "PDF ainda não disponível." }, { status: 409 });
  }

  const fetcher = new AzureBlobBinaryFetcher();
  const pdfBytes = await fetcher.fetchFromUrl(job.pdfBlobUrl);

  const safeName = job.videoFileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 80);
  const downloadName = safeName.replace(/\.[^.]+$/, "") + "-dtp.pdf";

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
