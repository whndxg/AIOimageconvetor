import sharp from "sharp";
import heicConvert from "heic-convert";

export const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "heic", "heif"]);
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const sanitizeBaseName = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, "_");

export async function maybeConvertHeic(input: Buffer, ext: string): Promise<{ buffer: Buffer; converted: boolean }> {
  if (ext !== "heic" && ext !== "heif") return { buffer: input, converted: false };
  const output = await heicConvert({ buffer: input, format: "PNG" });
  return { buffer: Buffer.from(output), converted: true };
}

export async function extractMeta(buffer: Buffer) {
  const m = await sharp(buffer).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0, format: m.format ?? "unknown", size: buffer.length };
}

export async function processImageBuffer(
  baseBuffer: Buffer,
  opts: { format: string; quality: number; crop?: { x: number; y: number; width: number; height: number }; width?: number; height?: number; reducePercent?: number }
) {
  let pipeline = sharp(baseBuffer, { limitInputPixels: 10000 * 10000 });
  if (opts.crop && opts.crop.width > 0 && opts.crop.height > 0) {
    pipeline = pipeline.extract({
      left: Math.max(0, Math.round(opts.crop.x)),
      top: Math.max(0, Math.round(opts.crop.y)),
      width: Math.round(opts.crop.width),
      height: Math.round(opts.crop.height)
    });
  }

  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, { fit: "inside", withoutEnlargement: false });
  }

  const q = Math.max(10, Math.min(100, opts.quality));
  switch (opts.format) {
    case "jpg":
    case "jpeg": pipeline = pipeline.jpeg({ quality: q }); break;
    case "png": pipeline = pipeline.png({ compressionLevel: 9 }); break;
    case "webp": pipeline = pipeline.webp({ quality: q }); break;
    case "avif": pipeline = pipeline.avif({ quality: q }); break;
    case "bmp": pipeline = pipeline.png(); break;
    case "tiff": pipeline = pipeline.tiff({ quality: q }); break;
    default: pipeline = pipeline.png();
  }

  let out = await pipeline.toBuffer();
  if (opts.reducePercent && opts.reducePercent > 0) {
    const target = Math.floor(out.length * (1 - opts.reducePercent / 100));
    if (target > 0 && (opts.format === "jpg" || opts.format === "webp" || opts.format === "avif")) {
      let trialQ = q;
      while (out.length > target && trialQ > 15) {
        trialQ -= 5;
        out = await sharp(baseBuffer)[opts.format as "jpeg" | "webp" | "avif"]({ quality: trialQ }).toBuffer();
      }
    }
  }
  return out;
}
