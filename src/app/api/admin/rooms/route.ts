import { auth } from "@/auth";
import { createRoomInputSchema } from "@/application/rooms/dtos/create-room.schema";
import { CreateRoomUseCase } from "@/application/rooms/use-cases/create-room.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = createRoomInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uc = container.get(CreateRoomUseCase);
  const out = await uc.execute(parsed.data);

  if (!out.ok) {
    if (out.code === "ROOM_TYPE_NOT_IN_HOTEL") {
      return NextResponse.json({ error: "A categoria não pertence a esta organização." }, { status: 400 });
    }
    if (out.code === "DUPLICATE_ROOM_NUMBER") {
      return NextResponse.json(
        { error: "Já existe um registo com este identificador nesta organização." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: out.code === "ERROR" ? out.message : "Não foi possível criar o registo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ roomId: out.roomId });
}
