export type ImageStatus = "Uploaded" | "Preview Ready" | "Processing" | "Converted" | "Failed";
export type OutputFormat = "jpg" | "png" | "webp" | "avif" | "bmp" | "tiff" | "pdf";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  status: ImageStatus;
  previewUrl?: string;
  convertedUrl?: string;
  originalMeta?: { width: number; height: number; size: number; format: string };
  convertedMeta?: { width: number; height: number; size: number; format: string };
  error?: string;
}
