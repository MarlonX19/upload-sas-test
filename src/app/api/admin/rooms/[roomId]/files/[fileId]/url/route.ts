import { auth } from "@/auth";
import { completeRoomFileUrlBodySchema } from "@/application/rooms/dtos/complete-room-file-url.schema";
import { CompleteRoomFileUrlUseCase } from "@/application/rooms/use-cases/complete-room-file-url.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; fileId: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { roomId, fileId: rawFileId } = await context.params;
  const fileId = decodeURIComponent(rawFileId);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = completeRoomFileUrlBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(CompleteRoomFileUrlUseCase);
  const out = await uc.execute(roomId, fileId, parsed.data);

  if (!out.ok) {
    if (out.code === "FILE_NOT_FOUND") {
      return NextResponse.json({ error: out.message }, { status: 404 });
    }
    if (out.code === "ROOM_NOT_FOUND") {
      return NextResponse.json({ error: out.message }, { status: 404 });
    }
    return NextResponse.json({ error: out.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, analysisEnqueued: out.analysisEnqueued });
}
