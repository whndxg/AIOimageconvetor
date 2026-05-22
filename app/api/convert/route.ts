import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { ALLOWED_EXT, extractMeta, MAX_FILE_SIZE, maybeConvertHeic, processImageBuffer, sanitizeBaseName } from "@/lib/image-processing";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (25MB max)" }, { status: 400 });

  const ext = path.extname(file.name).replace(".", "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const format = (form.get("format")?.toString() ?? "png").toLowerCase();
  const quality = Number(form.get("quality") ?? 80);
  const width = form.get("width") ? Number(form.get("width")) : undefined;
  const height = form.get("height") ? Number(form.get("height")) : undefined;
  const reducePercent = form.get("reducePercent") ? Number(form.get("reducePercent")) : 0;
  const crop = form.get("crop") ? JSON.parse(form.get("crop") as string) : undefined;

  const raw = Buffer.from(await file.arrayBuffer());
  const { buffer } = await maybeConvertHeic(raw, ext);
  const out = await processImageBuffer(buffer, { format, quality, width, height, reducePercent, crop });
  const meta = await extractMeta(out);

  const safe = sanitizeBaseName(path.parse(file.name).name);
  const filename = `${safe}-converted.${format === "jpg" ? "jpeg" : format}`;

  return NextResponse.json({ filename, meta, resultBase64: `data:image/${format};base64,${out.toString("base64")}` });
}
