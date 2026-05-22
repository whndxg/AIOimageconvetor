"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CropPins, CropRect, ImageItem, OutputFormat } from "@/types/image";

const formats: OutputFormat[] = ["jpg", "png", "webp", "avif", "bmp", "tiff", "pdf"];

const Spinner = () => <span className="spinner" aria-label="loading" />;

const ProgressRow = memo(function ProgressRow({ label, value }: { label: string; value: number }) {
  return <div className="progress-row"><span>{label}</span><progress max={100} value={value} /> <span>{value}%</span></div>;
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  const previewRef = useRef<HTMLDivElement>(null);
  const [renderBox, setRenderBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const selected = items[idx];

  const anyBusy = items.some(i => ["Uploading", "Preparing", "Cropping", "Converting", "Downloading"].includes(i.status)) || downloadingAll;

  const patchItem = useCallback((id: string, updater: (item: ImageItem) => ImageItem) => {
    setItems(prev => prev.map(p => p.id === id ? updater(p) : p));
  }, []);

  useEffect(() => () => items.forEach(i => { if (i.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); if (i.convertedUrl?.startsWith("blob:")) URL.revokeObjectURL(i.convertedUrl); }), [items]);

  const refreshRenderBox = useCallback(() => {
    if (!imgRef.current || !previewRef.current) return;
    const imgRect = imgRef.current.getBoundingClientRect();
    const wrapRect = previewRef.current.getBoundingClientRect();
    setRenderBox({ left: imgRect.left - wrapRect.left, top: imgRect.top - wrapRect.top, width: imgRect.width, height: imgRect.height });
  }, []);

  useEffect(() => {
    refreshRenderBox();
    if (!previewRef.current) return;
    const observer = new ResizeObserver(refreshRenderBox);
    observer.observe(previewRef.current);
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [refreshRenderBox, selected?.id, selected?.previewUrl]);

  const computeCropFromPins = useCallback((item: ImageItem, pins: CropPins): CropRect => {
    const x = Math.min(pins.a.x, pins.b.x), y = Math.min(pins.a.y, pins.b.y);
    const w = Math.abs(pins.a.x - pins.b.x), h = Math.abs(pins.a.y - pins.b.y);
    const sx = (item.originalMeta?.width ?? 1) / Math.max(1, renderBox.width);
    const sy = (item.originalMeta?.height ?? 1) / Math.max(1, renderBox.height);
    return { x: x * sx, y: y * sy, width: Math.max(1, w * sx), height: Math.max(1, h * sy) };
  }, [renderBox.width, renderBox.height]);

  const computePinsFromCrop = useCallback((item: ImageItem, crop: CropRect): CropPins => {
    const sx = Math.max(1, renderBox.width) / (item.originalMeta?.width ?? 1);
    const sy = Math.max(1, renderBox.height) / (item.originalMeta?.height ?? 1);
    return {
      a: { x: crop.x * sx, y: crop.y * sy },
      b: { x: (crop.x + crop.width) * sx, y: (crop.y + crop.height) * sy }
    };
  }, [renderBox.width, renderBox.height]);

  const onUpload = async (files: FileList | null) => { /* unchanged body below */
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
        patchItem(image.id, p => ({ ...p, status: "Preview Ready", previewUrl: data.previewBase64, originalMeta: data.meta, cropRect: fullCrop, progress: { ...p.progress, upload: 100, loading: 100, crop: 100 } }));
      } catch (e) {
        patchItem(image.id, p => ({ ...p, status: "Failed", error: (e as Error).message, progress: { ...p.progress, upload: 100 } }));
      }
    }
  };

  useEffect(() => {
    if (!selected?.cropRect || !selected.originalMeta || renderBox.width === 0 || renderBox.height === 0) return;
    patchItem(selected.id, p => ({ ...p, cropPins: computePinsFromCrop(p, p.cropRect!) }));
  }, [selected?.id, selected?.cropRect?.x, selected?.cropRect?.y, selected?.cropRect?.width, selected?.cropRect?.height, renderBox.width, renderBox.height, patchItem, computePinsFromCrop]);

  const movePin = (e: React.MouseEvent) => {
    if (!dragPin || !selected || !previewRef.current) return;
    const x = clamp(e.clientX - previewRef.current.getBoundingClientRect().left - renderBox.left, 0, renderBox.width);
    const y = clamp(e.clientY - previewRef.current.getBoundingClientRect().top - renderBox.top, 0, renderBox.height);
    patchItem(selected.id, (p) => {
      const cropPins: CropPins = p.cropPins ?? { a: { x: 0, y: 0 }, b: { x: renderBox.width, y: renderBox.height } };
      const nextPins = dragPin === "A" ? { ...cropPins, a: { x, y } } : { ...cropPins, b: { x, y } };
      return { ...p, status: "Cropping", cropPins: nextPins, cropRect: computeCropFromPins(p, nextPins), progress: { ...p.progress, crop: 70 } };
    });
  };

  const finishCrop = () => {
    if (!selected) return;
    patchItem(selected.id, p => ({ ...p, status: p.convertedUrl ? "Converted" : "Preview Ready", progress: { ...p.progress, crop: 100 } }));
    setDragPin(null);
  };

  const updateCropField = (field: keyof CropRect, rawValue: string) => {
    if (!selected?.originalMeta) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    patchItem(selected.id, p => {
      if (!p.cropRect || !p.originalMeta) return p;
      const next = { ...p.cropRect, [field]: value };
      next.x = clamp(next.x, 0, p.originalMeta.width - 1);
      next.y = clamp(next.y, 0, p.originalMeta.height - 1);
      next.width = clamp(next.width, 1, p.originalMeta.width - next.x);
      next.height = clamp(next.height, 1, p.originalMeta.height - next.y);
      return { ...p, cropRect: next, cropPins: computePinsFromCrop(p, next), status: "Cropping" };
    });
  };

  const resetCrop = () => {
    if (!selected?.originalMeta) return;
    patchItem(selected.id, p => {
      const cropRect = { x: 0, y: 0, width: p.originalMeta!.width, height: p.originalMeta!.height };
      return { ...p, cropRect, cropPins: computePinsFromCrop(p, cropRect), status: p.convertedUrl ? "Converted" : "Preview Ready", progress: { ...p.progress, crop: 100 } };
    });
  };

  const convertOne = async (item: ImageItem) => { /* unchanged */
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
  const downloadZip = async () => { setDownloadingAll(true); try { const files = items.filter(i => i.convertedUrl).map(i => ({ filename: `${i.name.split(".")[0]}-converted.${format}`, dataUrl: i.convertedUrl! })); const res = await fetch("/api/zip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) }); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "converted-images.zip"; a.click(); URL.revokeObjectURL(url); setItems(prev => prev.map(p => ({ ...p, progress: { ...p.progress, download: p.convertedUrl ? 100 : p.progress.download }, status: p.convertedUrl ? "Completed" : p.status }))); } finally { setDownloadingAll(false); } };

  const cropOverlay = useMemo(() => selected?.cropPins ? { left: Math.min(selected.cropPins.a.x, selected.cropPins.b.x) + renderBox.left, top: Math.min(selected.cropPins.a.y, selected.cropPins.b.y) + renderBox.top, width: Math.abs(selected.cropPins.a.x - selected.cropPins.b.x), height: Math.abs(selected.cropPins.a.y - selected.cropPins.b.y) } : undefined, [selected?.cropPins, renderBox.left, renderBox.top]);

  return <main onMouseMove={movePin} onMouseUp={finishCrop}>
    <h1>Online Image Converter</h1>
    <section className="card"><h3>Upload</h3><div className="dropzone"><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.heif" onChange={e => onUpload(e.target.files)} disabled={anyBusy} /></div>{anyBusy && <p><Spinner /> Processing…</p>}</section>

    {selected && <section className="card"><h3>Settings</h3>
      <label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as OutputFormat)} disabled={anyBusy}>{formats.map(f => <option key={f}>{f}</option>)}</select>
      <label>Width</label><input type="number" value={width ?? ""} onChange={e => setWidth(e.target.value ? Number(e.target.value) : undefined)} disabled={anyBusy} />
      <label>Height</label><input type="number" value={height ?? ""} onChange={e => setHeight(e.target.value ? Number(e.target.value) : undefined)} disabled={anyBusy} />
      <label>Quality {quality}%</label><input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} disabled={anyBusy} />
      <label>Reduce size (%)</label><select value={reducePercent} onChange={e => setReducePercent(Number(e.target.value))} disabled={anyBusy}><option value={0}>None</option><option value={25}>25</option><option value={50}>50</option><option value={75}>75</option></select>
    </section>}

    <section className="card actions"><button disabled={anyBusy || !selected} onClick={() => selected && convertOne(selected)}>Convert Selected Image</button><button disabled={anyBusy || !items.length} onClick={convertAll}>Convert All Images</button><button disabled={anyBusy || !items.some(i => i.convertedUrl)} onClick={downloadZip}>Download All as ZIP</button><button disabled={!selected} onClick={resetCrop}>Reset Crop</button></section>
    <section className="grid3">
      <div className="card"><h3>Original Image</h3>{selected ? <>
      <div className="actions"><button onClick={() => setIdx(Math.max(0, idx - 1))}>Previous</button><button onClick={() => setIdx(Math.min(items.length - 1, idx + 1))}>Next</button>
      <select value={selected.id} onChange={e => setIdx(items.findIndex(i => i.id === e.target.value))}>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      <p className="status">{selected.status} { ["Uploading","Preparing","Cropping","Converting","Downloading"].includes(selected.status) && <Spinner /> }</p>
      {selected.error && <p className="error">{selected.error}</p>}
      <div className="preview-wrap" ref={previewRef}>{selected.previewUrl && <img ref={imgRef} src={selected.previewUrl} className="preview-img" alt="original" onLoad={refreshRenderBox} />}
      {selected.previewUrl && cropOverlay && <><div className="crop-box" style={cropOverlay} /><div className="crop-pin" style={{ left: (selected.cropPins?.a.x ?? 0) + renderBox.left, top: (selected.cropPins?.a.y ?? 0) + renderBox.top }} onMouseDown={() => setDragPin("A")} /><div className="crop-pin" style={{ left: (selected.cropPins?.b.x ?? 0) + renderBox.left, top: (selected.cropPins?.b.y ?? 0) + renderBox.top }} onMouseDown={() => setDragPin("B")} /></>}</div>
      <p className="small">{selected.originalMeta?.width}x{selected.originalMeta?.height} • {Math.round((selected.originalMeta?.size ?? 0)/1024)}KB</p>
      </> : <p>No image selected.</p>}</div>

      <div className="card"><h3>Crop Controls</h3>{selected?.cropRect ? <>
        <div className="crop-fields">
          <label>X position<input type="number" step="0.1" value={selected.cropRect.x.toFixed(1)} onChange={e => updateCropField("x", e.target.value)} /></label>
          <label>Y position<input type="number" step="0.1" value={selected.cropRect.y.toFixed(1)} onChange={e => updateCropField("y", e.target.value)} /></label>
          <label>Width<input type="number" step="0.1" min={1} value={selected.cropRect.width.toFixed(1)} onChange={e => updateCropField("width", e.target.value)} /></label>
          <label>Height<input type="number" step="0.1" min={1} value={selected.cropRect.height.toFixed(1)} onChange={e => updateCropField("height", e.target.value)} /></label>
        </div>
      </> : <p>No crop data yet.</p>}</div>

      <div className="card"><h3>Converted Result</h3>{selected?.convertedUrl ? <>
        <img src={selected.convertedUrl} className="preview-img" alt="converted" />
        <p className="small">{selected.convertedMeta?.width}x{selected.convertedMeta?.height} • {Math.round((selected.convertedMeta?.size ?? 0)/1024)}KB</p>
        <button disabled={anyBusy} onClick={() => { const a = document.createElement("a"); a.href = selected.convertedUrl!; a.download = `${selected.name.split(".")[0]}-converted.${format}`; a.click(); }}>Download Selected</button>
      </> : <p className="empty">No converted image yet. Run conversion to see results.</p>}</div>
    </section>
    {selected && <section className="card"><ProgressRow label="Uploading" value={selected.progress.upload} /><ProgressRow label="Preparing image" value={selected.progress.loading} /><ProgressRow label="Converting" value={selected.progress.convert} /><ProgressRow label="Downloading" value={selected.progress.download} /></section>}
  </main>;
}
