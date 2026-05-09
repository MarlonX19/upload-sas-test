import { auth } from "@/auth";
import { UploadRoomPdfUseCase } from "@/application/rooms/use-cases/upload-room-pdf.use-case";
import { container } from "@/di/container";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteParams = { params: Promise<{ roomId: string }> };

function mapErrorCode(
  code: string,
): { status: number; message: string } {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return { status: 404, message: "Registo não encontrado." };
    case "TOO_MANY_FILES":
      return { status: 400, message: "Limite de 12 PDFs por destino atingido." };
    case "FILE_TOO_LARGE":
      return { status: 400, message: "Cada PDF pode ter no máximo 250 MB." };
    case "NOT_PDF":
      return { status: 400, message: "O ficheiro não é um PDF válido." };
    case "INVALID_FILE_NAME":
      return { status: 400, message: "O nome do ficheiro deve terminar em .pdf." };
    default:
      return { status: 500, message: "Não foi possível guardar o ficheiro." };
  }
}

export async function POST(req: Request, context: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { roomId } = await context.params;
  const form = await req.formData();
  const hotelId = form.get("hotelId");
  const file = form.get("file");

  if (typeof hotelId !== "string" || !/^[a-fA-F0-9]{24}$/.test(hotelId)) {
    return NextResponse.json({ error: "Identificador de organização inválido." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ficheiro em falta (campo file)." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const content = new Uint8Array(buffer);
  const originalFileName = file.name || "document.pdf";

  const uc = container.get(UploadRoomPdfUseCase);
  const out = await uc.execute({ hotelId, roomId, originalFileName, content });

  if (!out.ok) {
    if (out.code === "ERROR") {
      return NextResponse.json({ error: out.message }, { status: 500 });
    }
    const { status, message } = mapErrorCode(out.code);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ fileName: out.fileName, fileURL: out.fileURL });
}
