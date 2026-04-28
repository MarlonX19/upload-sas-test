import { auth } from "@/auth";
import { ListAdminRoomTypesForHotelUseCase } from "@/application/rooms/use-cases/list-admin-room-types-for-hotel.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ hotelId: string }> };

export async function GET(_req: Request, context: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { hotelId } = await context.params;
  const uc = container.get(ListAdminRoomTypesForHotelUseCase);
  const roomTypes = await uc.execute(hotelId);
  return NextResponse.json({ roomTypes });
}
