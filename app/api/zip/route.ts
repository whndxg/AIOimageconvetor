import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: { filename: string; dataUrl: string }[] };
  if (!files?.length) return NextResponse.json({ error: "No files to zip" }, { status: 400 });

  const stream = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(stream);

  for (const f of files) {
    const base64 = f.dataUrl.split(",")[1] ?? "";
    archive.append(Buffer.from(base64, "base64"), { name: f.filename });
  }
  await archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const zip = Buffer.concat(chunks);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="converted-images.zip"'
    }
  });
}
