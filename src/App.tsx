import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import heic2any from 'heic2any';
import UploadArea from './components/UploadArea';
import ImageNavigator from './components/ImageNavigator';
import ImagePreview from './components/ImagePreview';
import ConversionSettings from './components/ConversionSettings';
import CropTool from './components/CropTool';
import DownloadPanel from './components/DownloadPanel';
import { ImageItem, OutputFormat, Settings } from './types';

const defaultSettings: Settings = { format: 'webp', quality: 80, resizeMode: 'none', percent: 100, width: 1080, height: 1080, lockAspect: true, preset: '1080x1080', reduceByPercent: 0 };
const formats = ['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/heic','image/heif'];

const App = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [settings, setSettings] = useState(defaultSettings);
  const [cropArea, setCropArea] = useState<{x:number;y:number;width:number;height:number}|null>(null);
  const current = images[selected];

  const onUpload = async (files: File[]) => {
    const out: ImageItem[] = [];
    for (const file of files) {
      if (!formats.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) continue;
      let blob: Blob = file;
      if (/\.(heic|heif)$/i.test(file.name) || file.type.includes('heic') || file.type.includes('heif')) {
        blob = await heic2any({ blob: file, toType: 'image/jpeg' }) as Blob;
      }
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      out.push({ id: crypto.randomUUID(), file, originalUrl: url, previewUrl: url, width: img.width, height: img.height, status: 'Pending' });
    }
    setImages((prev) => [...prev, ...out]);
  };

  const convertOne = async (item: ImageItem) => {
    try {
      const converted = await convertImage(item, settings, cropArea);
      const convertedUrl = URL.createObjectURL(converted.blob);
      return { ...item, status: 'Converted' as const, convertedBlob: converted.blob, convertedName: converted.name, convertedUrl };
    } catch (e) {
      return { ...item, status: 'Failed' as const, error: (e as Error).message };
    }
  };

  const convertSelected = async () => {
    if (!current) return;
    const item = await convertOne(current);
    setImages((prev) => prev.map((x, i) => i === selected ? item : x));
  };

  const convertAll = async () => {
    const next: ImageItem[] = [];
    for (const item of images) next.push(await convertOne(item));
    setImages(next);
  };

  const downloadSelected = () => {
    if (current?.convertedBlob && current.convertedName) saveAs(current.convertedBlob, current.convertedName);
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    images.forEach((i) => i.convertedBlob && i.convertedName && zip.file(i.convertedName, i.convertedBlob));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'converted-images.zip');
  };

  const estimate = useMemo(() => current ? Math.round((current.file.size * ((100 - settings.reduceByPercent) / 100) * (settings.quality / 100)) / 1024) : 0, [current, settings]);

  return <div className="container"><h1>Online Image Converter</h1><p>iPhone HEIC images will be converted into a browser-supported format before preview.</p>
    <UploadArea onUpload={onUpload} />
    {images.length>0 && <>
      <ImageNavigator images={images} selected={selected} onSelect={setSelected} />
      <div className='grid'>
        <ImagePreview item={current} />
        <ConversionSettings settings={settings} setSettings={setSettings} estimateKb={estimate} />
      </div>
      <CropTool imageUrl={current?.previewUrl} onCropChange={setCropArea} />
      <DownloadPanel onConvertOne={convertSelected} onConvertAll={convertAll} onDownloadOne={downloadSelected} onDownloadAll={downloadAllZip} onReset={()=>setImages([])} />
    </>}
  </div>;
};

async function convertImage(item: ImageItem, settings: Settings, crop: {x:number;y:number;width:number;height:number}|null) {
  if (settings.format === 'heic') throw new Error('HEIC export is not supported in most browsers.');
  const img = await loadImage(item.previewUrl);
  const canvas = document.createElement('canvas');
  const sx = crop?.x ?? 0, sy = crop?.y ?? 0, sw = crop?.width ?? img.width, sh = crop?.height ?? img.height;
  let tw = sw, th = sh;
  if (settings.resizeMode === 'percent') { tw = Math.round(sw * (settings.percent / 100)); th = Math.round(sh * (settings.percent / 100)); }
  if (settings.resizeMode === 'custom') { tw = settings.width; th = settings.height; }
  canvas.width = tw; canvas.height = th;
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
  const base = item.file.name.replace(/\.[^.]+$/, '');
  if (settings.format === 'pdf') {
    const data = canvas.toDataURL('image/jpeg', settings.quality / 100);
    const pdf = new jsPDF({ unit: 'px', format: [tw, th] }); pdf.addImage(data, 'JPEG', 0, 0, tw, th);
    const blob = pdf.output('blob'); return { blob, name: `${base}-converted.pdf` };
  }
  const mime: Record<Exclude<OutputFormat,'pdf'|'heic'>, string> = { jpg:'image/jpeg', png:'image/png', webp:'image/webp', avif:'image/avif', bmp:'image/bmp', tiff:'image/tiff' };
  const fmt = settings.format as Exclude<OutputFormat,'pdf'|'heic'>;
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b)=>b?res(b):rej(new Error('conversion failed')), mime[fmt], settings.quality / 100));
  return { blob, name: `${base}-converted.${fmt === 'jpg' ? 'jpg' : fmt}` };
}

function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((res, rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('invalid image')); i.src = src;}); }

export default App;
