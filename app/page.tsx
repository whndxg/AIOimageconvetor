"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CropRect, ImageItem, OutputFormat } from "@/types/image";

const presets = [{ n: "Freeform", w: 0, h: 0 }, { n: "1:1", w: 1, h: 1 }, { n: "4:5", w: 4, h: 5 }, { n: "16:9", w: 16, h: 9 }, { n: "9:16", w: 9, h: 16 }];

export default function Home() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [reducePercent, setReducePercent] = useState(0);
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [cropPreset, setCropPreset] = useState("Freeform");
  const [cropA, setCropA] = useState({ x: 20, y: 20 });
  const [cropB, setCropB] = useState({ x: 200, y: 200 });
  const [dragPin, setDragPin] = useState<"A" | "B" | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const selected = items[idx];
  const crop: CropRect | undefined = useMemo(() => {
    if (!selected?.previewUrl || !imgRef.current) return undefined;
    const x = Math.min(cropA.x, cropB.x), y = Math.min(cropA.y, cropB.y);
    const w = Math.abs(cropA.x - cropB.x), h = Math.abs(cropA.y - cropB.y);
    if (!w || !h) return undefined;
    const sx = (selected.originalMeta?.width ?? 1) / imgRef.current.clientWidth;
    const sy = (selected.originalMeta?.height ?? 1) / imgRef.current.clientHeight;
    return { x: x * sx, y: y * sy, width: w * sx, height: h * sy };
  }, [cropA, cropB, selected]);

  useEffect(() => () => items.forEach(i => { if (i.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); if (i.convertedUrl?.startsWith("blob:")) URL.revokeObjectURL(i.convertedUrl); }), [items]);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const newItems: ImageItem[] = Array.from(files).map(file => ({ id: crypto.randomUUID(), file, name: file.name, status: "Uploaded" }));
    setItems(prev => [...prev, ...newItems]);

    for (const image of newItems) {
      const fd = new FormData(); fd.append("file", image.file);
      try {
        const res = await fetch("/api/preview", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(prev => prev.map(p => p.id === image.id ? { ...p, status: "Preview Ready", previewUrl: data.previewBase64, originalMeta: data.meta } : p));
      } catch (e) {
        setItems(prev => prev.map(p => p.id === image.id ? { ...p, status: "Failed", error: (e as Error).message } : p));
      }
    }
  };

  const movePin = (e: React.MouseEvent) => {
    if (!dragPin || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    if (dragPin === "A") setCropA({ x, y }); else setCropB({ x, y });
  };

  const convertOne = async (item: ImageItem) => {
    setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: "Processing" } : p));
    const fd = new FormData(); fd.append("file", item.file); fd.append("format", format); fd.append("quality", String(quality));
    if (width) fd.append("width", String(width)); if (height) fd.append("height", String(height)); if (reducePercent) fd.append("reducePercent", String(reducePercent));
    if (cropPreset !== "Freeform" || crop) fd.append("crop", JSON.stringify(crop));

    try {
      const res = await fetch("/api/convert", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: "Converted", convertedUrl: data.resultBase64, convertedMeta: data.meta } : p));
    } catch (e) {
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: "Failed", error: (e as Error).message } : p));
    }
  };

  const convertAll = async () => { for (const it of items) await convertOne(it); };

  const downloadZip = async () => {
    const files = items.filter(i => i.convertedUrl).map(i => ({ filename: `${i.name.split(".")[0]}-converted.${format}`, dataUrl: i.convertedUrl! }));
    const res = await fetch("/api/zip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "converted-images.zip"; a.click(); URL.revokeObjectURL(url);
  };

  return <main onMouseMove={movePin} onMouseUp={() => setDragPin(null)}>
    <h1>Online Image Converter</h1>
    <section className="card"><h3>Upload</h3><div className="dropzone"><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.heif" onChange={e => onUpload(e.target.files)} /></div></section>
    <section className="grid">
      <div className="card"><h3>Image Preview</h3>
        {selected ? <>
          <div className="actions"><button onClick={() => setIdx(Math.max(0, idx - 1))}>Previous</button><button onClick={() => setIdx(Math.min(items.length - 1, idx + 1))}>Next</button>
            <select value={selected.id} onChange={e => setIdx(items.findIndex(i => i.id === e.target.value))}>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
          <p className="status">{selected.status}</p>
          <div className="preview-wrap">{selected.previewUrl && <img ref={imgRef} src={selected.previewUrl} className="preview-img" alt="preview" />}
            {selected.previewUrl && <><div className="crop-box" style={{ left: Math.min(cropA.x, cropB.x), top: Math.min(cropA.y, cropB.y), width: Math.abs(cropA.x - cropB.x), height: Math.abs(cropA.y - cropB.y) }} />
              <div className="crop-pin" style={{ left: cropA.x, top: cropA.y }} onMouseDown={() => setDragPin("A")} /><div className="crop-pin" style={{ left: cropB.x, top: cropB.y }} onMouseDown={() => setDragPin("B")} /></>}
          </div>
          <p className="small">Original: {selected.originalMeta?.width}x{selected.originalMeta?.height}, {Math.round((selected.originalMeta?.size ?? 0)/1024)}KB</p>
          {selected.convertedUrl && <p className="small">Converted: {selected.convertedMeta?.width}x{selected.convertedMeta?.height}, {Math.round((selected.convertedMeta?.size ?? 0)/1024)}KB</p>}
        </> : <p>No image selected.</p>}
      </div>
      <div className="card"><h3>Settings</h3>
        <label>Crop Preset</label><select value={cropPreset} onChange={e => setCropPreset(e.target.value)}>{presets.map(p => <option key={p.n}>{p.n}</option>)}</select>
        <p className="small">Crop: x {Math.round(crop?.x ?? 0)}, y {Math.round(crop?.y ?? 0)}, w {Math.round(crop?.width ?? 0)}, h {Math.round(crop?.height ?? 0)}</p>
        <label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as OutputFormat)}>{["jpg","png","webp","avif","bmp","tiff","pdf"].map(f => <option key={f}>{f}</option>)}</select>
        <label>Width</label><input type="number" value={width ?? ""} onChange={e => setWidth(e.target.value ? Number(e.target.value) : undefined)} />
        <label>Height</label><input type="number" value={height ?? ""} onChange={e => setHeight(e.target.value ? Number(e.target.value) : undefined)} />
        <label>Quality {quality}%</label><input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} />
        <label>Reduce size (%)</label><select value={reducePercent} onChange={e => setReducePercent(Number(e.target.value))}><option value={0}>None</option><option value={25}>25</option><option value={50}>50</option><option value={75}>75</option></select>
        <p className="small">PNG compression can be less effective than JPG/WEBP/AVIF.</p>
      </div>
    </section>
    <section className="card"><h3>Actions</h3><div className="actions">
      <button disabled={!selected} onClick={() => selected && convertOne(selected)}>Convert Selected Image</button>
      <button disabled={!items.length} onClick={convertAll}>Convert All Images</button>
      <button disabled={!selected?.convertedUrl} onClick={() => { const a = document.createElement("a"); a.href = selected!.convertedUrl!; a.download = `${selected!.name.split(".")[0]}-converted.${format}`; a.click(); }}>Download Selected</button>
      <button disabled={!items.some(i => i.convertedUrl)} onClick={downloadZip}>Download All as ZIP</button>
      <button onClick={() => { setItems([]); setIdx(0); }}>Reset</button>
    </div></section>
  </main>;
}
