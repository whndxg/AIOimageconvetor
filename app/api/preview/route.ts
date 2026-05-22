import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { ALLOWED_EXT, extractMeta, MAX_FILE_SIZE, maybeConvertHeic } from "@/lib/image-processing";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (25MB max)" }, { status: 400 });

  const ext = path.extname(file.name).replace(".", "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { buffer, converted } = await maybeConvertHeic(buf, ext);
  const meta = await extractMeta(buffer);

  return NextResponse.json({
    previewBase64: `data:image/png;base64,${buffer.toString("base64")}`,
    meta,
    note: converted ? "HEIC/HEIF converted to PNG preview on backend." : undefined
  });
}
