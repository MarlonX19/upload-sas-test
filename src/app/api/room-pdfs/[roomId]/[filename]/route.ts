import { auth } from "@/auth";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { ROOM_PDF_UPLOAD_ROOT } from "@/infrastructure/storage/room-pdf-upload-path";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ roomId: string; filename: string }> };

export async function GET(_req: Request, context: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { roomId, filename } = await context.params;
  if (!/^[a-fA-F0-9]{24}$/.test(roomId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const safeName = path.basename(decodeURIComponent(filename));
  const baseDir = path.join(ROOM_PDF_UPLOAD_ROOT, roomId);
  const filePath = path.join(baseDir, safeName);
  const resolved = path.resolve(filePath);
  const baseResolved = path.resolve(baseDir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }
  if (!existsSync(resolved)) {
    return NextResponse.json({ error: "Ficheiro não encontrado." }, { status: 404 });
  }

  const stream = createReadStream(resolved);
  const web = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(web, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(safeName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
