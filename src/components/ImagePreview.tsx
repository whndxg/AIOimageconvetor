import { ImageItem } from '../types';

export default function ImagePreview({ item }: { item?: ImageItem }) {
  if (!item) return null;
  return <div className='card'><h3>Preview</h3><img src={item.convertedUrl || item.previewUrl} className='preview'/>
    <p>{item.file.name} • {item.width}x{item.height} • {(item.file.size/1024).toFixed(1)} KB</p>
    <p>Status: {item.status} {item.error ? `(${item.error})`: ''}</p>
  </div>;
}
