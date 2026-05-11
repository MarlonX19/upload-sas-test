import { auth } from "@/auth";
import { GetAdminRoomDetailUseCase } from "@/application/rooms/use-cases/get-admin-room-detail.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string }> };

export async function GET(_req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { roomId } = await context.params;
  const uc = container.get(GetAdminRoomDetailUseCase);
  const detail = await uc.execute(roomId);

  if (!detail) {
    return NextResponse.json({ error: "Registo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
