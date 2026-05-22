export type OutputFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'bmp' | 'tiff' | 'pdf' | 'heic';
export type Status = 'Pending' | 'Converted' | 'Failed';

export interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  status: Status;
  error?: string;
  convertedBlob?: Blob;
  convertedUrl?: string;
  convertedName?: string;
}

export interface Settings {
  format: OutputFormat;
  quality: number;
  resizeMode: 'none' | 'percent' | 'custom' | 'preset';
  percent: number;
  width: number;
  height: number;
  lockAspect: boolean;
  preset: string;
  reduceByPercent: number;
}
