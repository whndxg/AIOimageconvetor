export type ImageStatus = "Uploaded" | "Uploading" | "Preview Ready" | "Preparing" | "Cropping" | "Converting" | "Converted" | "Downloading" | "Completed" | "Failed";
export type OutputFormat = "jpg" | "png" | "webp" | "avif" | "bmp" | "tiff" | "pdf";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropPins {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

export interface ProgressState {
  upload: number;
  loading: number;
  crop: number;
  convert: number;
  download: number;
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
  cropRect?: CropRect;
  cropPins?: CropPins;
  error?: string;
  progress: ProgressState;
}
