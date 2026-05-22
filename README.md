# Online Image Converter

A responsive client-side React + TypeScript web app to upload multiple images (including iPhone HEIC/HEIF), preview one at a time, crop, resize, compress, convert, and download individually or as ZIP.

## Setup

```bash
npm install
npm run dev
```

## Notes and Browser Limitations

- HEIC/HEIF decoding is done in-browser with `heic2any`, then preview/conversion uses browser-supported bitmap formats.
- HEIC export is not widely supported by browsers; this app clearly reports that limitation.
- AVIF/BMP/TIFF encoding support via `canvas.toBlob` depends on browser implementation; unsupported formats may fail.
- PNG compression ignores lossy quality semantics in many browsers.
- For privacy, images are processed client-side and not uploaded to a server.
