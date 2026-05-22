declare module "heic-convert" {
  interface ConvertOptions {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }
  export default function heicConvert(opts: ConvertOptions): Promise<Buffer | Uint8Array>;
}
