"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CropPins, CropRect, ImageItem, OutputFormat } from "@/types/image";

const formats: OutputFormat[] = ["jpg", "png", "webp", "avif", "bmp", "tiff", "pdf"];

const Spinner = () => <span className="spinner" aria-label="loading" />;

const ProgressRow = memo(function ProgressRow({ label, value }: { label: string; value: number }) {
  return <div className="progress-row"><span>{label}</span><progress max={100} value={value} /> <span>{value}%</span></div>;
});

export default function Home() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [reducePercent, setReducePercent] = useState(0);
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [dragPin, setDragPin] = useState<"A" | "B" | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const selected = items[idx];

  const anyBusy = items.some(i => ["Uploading", "Preparing", "Cropping", "Converting", "Downloading"].includes(i.status)) || downloadingAll;

  const patchItem = useCallback((id: string, updater: (item: ImageItem) => ImageItem) => {
    setItems(prev => prev.map(p => p.id === id ? updater(p) : p));
  }, []);

  useEffect(() => () => items.forEach(i => { if (i.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); if (i.convertedUrl?.startsWith("blob:")) URL.revokeObjectURL(i.convertedUrl); }), [items]);

  const computeCropFromPins = useCallback((item: ImageItem, pins: CropPins, imgEl: HTMLImageElement): CropRect => {
    const x = Math.min(pins.a.x, pins.b.x), y = Math.min(pins.a.y, pins.b.y);
    const w = Math.abs(pins.a.x - pins.b.x), h = Math.abs(pins.a.y - pins.b.y);
    const sx = (item.originalMeta?.width ?? 1) / imgEl.clientWidth;
    const sy = (item.originalMeta?.height ?? 1) / imgEl.clientHeight;
    return { x: x * sx, y: y * sy, width: Math.max(1, w * sx), height: Math.max(1, h * sy) };
  }, []);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const newItems: ImageItem[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(), file, name: file.name, status: "Uploading",
      progress: { upload: 5, loading: 0, crop: 0, convert: 0, download: 0 }
    }));
    setItems(prev => [...prev, ...newItems]);

    for (const image of newItems) {
      const fd = new FormData(); fd.append("file", image.file);
      patchItem(image.id, p => ({ ...p, progress: { ...p.progress, upload: 50 }, status: "Uploading", error: undefined }));
      try {
        const res = await fetch("/api/preview", { method: "POST", body: fd });
        patchItem(image.id, p => ({ ...p, status: "Preparing", progress: { ...p.progress, loading: 60 } }));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const fullCrop = { x: 0, y: 0, width: data.meta.width, height: data.meta.height };
        const pins = { a: { x: 0, y: 0 }, b: { x: 260, y: 260 } };
        patchItem(image.id, p => ({ ...p, status: "Preview Ready", previewUrl: data.previewBase64, originalMeta: data.meta, cropRect: fullCrop, cropPins: pins, progress: { ...p.progress, upload: 100, loading: 100, crop: 100 } }));
      } catch (e) {
        patchItem(image.id, p => ({ ...p, status: "Failed", error: (e as Error).message, progress: { ...p.progress, upload: 100 } }));
      }
    }
  };

  const movePin = (e: React.MouseEvent) => {
    if (!dragPin || !selected || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    patchItem(selected.id, (p) => {
      const cropPins: CropPins = p.cropPins ?? { a: { x: 0, y: 0 }, b: { x: rect.width, y: rect.height } };
      const nextPins = dragPin === "A" ? { ...cropPins, a: { x, y } } : { ...cropPins, b: { x, y } };
      return { ...p, status: "Cropping", cropPins: nextPins, cropRect: computeCropFromPins(p, nextPins, imgRef.current!), progress: { ...p.progress, crop: 70 } };
    });
  };

  const finishCrop = () => {
    if (!selected) return;
    patchItem(selected.id, p => ({ ...p, status: p.convertedUrl ? "Converted" : "Preview Ready", progress: { ...p.progress, crop: 100 } }));
    setDragPin(null);
  };

  const resetCrop = () => {
    if (!selected?.originalMeta) return;
    patchItem(selected.id, p => ({ ...p, cropRect: { x: 0, y: 0, width: p.originalMeta!.width, height: p.originalMeta!.height }, cropPins: { a: { x: 0, y: 0 }, b: { x: 260, y: 260 } }, status: p.convertedUrl ? "Converted" : "Preview Ready", progress: { ...p.progress, crop: 100 } }));
  };

  const convertOne = async (item: ImageItem) => {
    patchItem(item.id, p => ({ ...p, status: "Converting", progress: { ...p.progress, convert: 10 }, error: undefined }));
    const fd = new FormData(); fd.append("file", item.file); fd.append("format", format); fd.append("quality", String(quality));
    if (width) fd.append("width", String(width)); if (height) fd.append("height", String(height)); if (reducePercent) fd.append("reducePercent", String(reducePercent));
    if (item.cropRect) fd.append("crop", JSON.stringify(item.cropRect));
    try {
      patchItem(item.id, p => ({ ...p, progress: { ...p.progress, convert: 60 } }));
      const res = await fetch("/api/convert", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      patchItem(item.id, p => ({ ...p, status: "Converted", convertedUrl: data.resultBase64, convertedMeta: data.meta, progress: { ...p.progress, convert: 100 } }));
    } catch (e) {
      patchItem(item.id, p => ({ ...p, status: "Failed", error: (e as Error).message }));
    }
  };

  const convertAll = async () => { for (const it of items) await convertOne(it); };

  const downloadZip = async () => {
    setDownloadingAll(true);
    try {
      const files = items.filter(i => i.convertedUrl).map(i => ({ filename: `${i.name.split(".")[0]}-converted.${format}`, dataUrl: i.convertedUrl! }));
      const res = await fetch("/api/zip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "converted-images.zip"; a.click(); URL.revokeObjectURL(url);
      setItems(prev => prev.map(p => ({ ...p, progress: { ...p.progress, download: p.convertedUrl ? 100 : p.progress.download }, status: p.convertedUrl ? "Completed" : p.status })));
    } finally { setDownloadingAll(false); }
  };

  const cropOverlay = useMemo(() => selected?.cropPins ? { left: Math.min(selected.cropPins.a.x, selected.cropPins.b.x), top: Math.min(selected.cropPins.a.y, selected.cropPins.b.y), width: Math.abs(selected.cropPins.a.x - selected.cropPins.b.x), height: Math.abs(selected.cropPins.a.y - selected.cropPins.b.y) } : undefined, [selected?.cropPins]);

  return <main onMouseMove={movePin} onMouseUp={finishCrop}>
    <h1>Online Image Converter</h1>
    <section className="card"><h3>Upload</h3><div className="dropzone"><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.heif" onChange={e => onUpload(e.target.files)} disabled={anyBusy} /></div>{anyBusy && <p><Spinner /> Processing…</p>}</section>
    <section className="card actions"><button disabled={anyBusy || !selected} onClick={() => selected && convertOne(selected)}>Convert Selected Image</button><button disabled={anyBusy || !items.length} onClick={convertAll}>Convert All Images</button><button disabled={anyBusy || !items.some(i => i.convertedUrl)} onClick={downloadZip}>Download All as ZIP</button><button disabled={!selected} onClick={resetCrop}>Reset Crop</button></section>
    <section className="grid3">
      <div className="card"><h3>Original Image</h3>{selected ? <>
      <div className="actions"><button onClick={() => setIdx(Math.max(0, idx - 1))}>Previous</button><button onClick={() => setIdx(Math.min(items.length - 1, idx + 1))}>Next</button>
      <select value={selected.id} onChange={e => setIdx(items.findIndex(i => i.id === e.target.value))}>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      <p className="status">{selected.status} { ["Uploading","Preparing","Cropping","Converting","Downloading"].includes(selected.status) && <Spinner /> }</p>
      {selected.error && <p className="error">{selected.error}</p>}
      <div className="preview-wrap">{selected.previewUrl && <img ref={imgRef} src={selected.previewUrl} className="preview-img" alt="original" />}
      {selected.previewUrl && cropOverlay && <><div className="crop-box" style={cropOverlay} /><div className="crop-pin" style={{ left: selected.cropPins?.a.x, top: selected.cropPins?.a.y }} onMouseDown={() => setDragPin("A")} /><div className="crop-pin" style={{ left: selected.cropPins?.b.x, top: selected.cropPins?.b.y }} onMouseDown={() => setDragPin("B")} /></>}</div>
      <p className="small">{selected.originalMeta?.width}x{selected.originalMeta?.height} • {Math.round((selected.originalMeta?.size ?? 0)/1024)}KB</p>
      </> : <p>No image selected.</p>}</div>

      <div className="card"><h3>Cropped Preview</h3>{selected?.cropRect ? <>
        <p className="small">x: {Math.round(selected.cropRect.x)} y: {Math.round(selected.cropRect.y)} w: {Math.round(selected.cropRect.width)} h: {Math.round(selected.cropRect.height)}</p>
        <ProgressRow label="Cropping" value={selected.progress.crop} />
      </> : <p>No crop data yet.</p>}</div>

      <div className="card"><h3>Converted Result</h3>{selected?.convertedUrl ? <>
        <img src={selected.convertedUrl} className="preview-img" alt="converted" />
        <p className="small">{selected.convertedMeta?.width}x{selected.convertedMeta?.height} • {Math.round((selected.convertedMeta?.size ?? 0)/1024)}KB</p>
        <button disabled={anyBusy} onClick={() => { const a = document.createElement("a"); a.href = selected.convertedUrl!; a.download = `${selected.name.split(".")[0]}-converted.${format}`; a.click(); }}>Download Selected</button>
      </> : <p className="empty">No converted image yet. Run conversion to see results.</p>}</div>
    </section>

    {selected && <section className="card"><h3>Settings</h3>
      <label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as OutputFormat)} disabled={anyBusy}>{formats.map(f => <option key={f}>{f}</option>)}</select>
      <label>Width</label><input type="number" value={width ?? ""} onChange={e => setWidth(e.target.value ? Number(e.target.value) : undefined)} disabled={anyBusy} />
      <label>Height</label><input type="number" value={height ?? ""} onChange={e => setHeight(e.target.value ? Number(e.target.value) : undefined)} disabled={anyBusy} />
      <label>Quality {quality}%</label><input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} disabled={anyBusy} />
      <label>Reduce size (%)</label><select value={reducePercent} onChange={e => setReducePercent(Number(e.target.value))} disabled={anyBusy}><option value={0}>None</option><option value={25}>25</option><option value={50}>50</option><option value={75}>75</option></select>
      <ProgressRow label="Uploading" value={selected.progress.upload} /><ProgressRow label="Preparing image" value={selected.progress.loading} /><ProgressRow label="Converting" value={selected.progress.convert} /><ProgressRow label="Downloading" value={selected.progress.download} />
    </section>}
  </main>;
}
