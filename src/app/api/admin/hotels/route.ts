import { auth } from "@/auth";
import { ListAdminHotelsUseCase } from "@/application/rooms/use-cases/list-admin-hotels.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const uc = container.get(ListAdminHotelsUseCase);
  const hotels = await uc.execute();
  return NextResponse.json({ hotels });
}
