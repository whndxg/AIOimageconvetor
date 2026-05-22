# Online Image Converter

Next.js + TypeScript image converter app with backend-only final processing.

## Features
- Multi-upload: JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, HEIC, HEIF
- HEIC/HEIF backend conversion to PNG preview
- Freeform two-point crop UI + crop presets
- Format conversion: JPG, PNG, WEBP, AVIF, BMP, TIFF (PDF placeholder in UI)
- Resize, quality compression, size reduction target
- Convert selected/all, per-image statuses, before/after preview
- Download selected or ZIP all converted images

## Setup
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes
- Backend validates file type and max file size (25MB).
- Files are kept in memory for this implementation (no permanent storage).
- Sharp performs final conversions; HEIC/HEIF are normalized before processing.
