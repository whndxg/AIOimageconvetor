import Cropper from 'react-easy-crop';
import { useState } from 'react';

export default function CropTool({ imageUrl, onCropChange }: { imageUrl?: string; onCropChange: (crop: {x:number;y:number;width:number;height:number}) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  if (!imageUrl) return null;
  return <div className='card'><h3>Crop Tool</h3><div className='crop-wrap'><Cropper image={imageUrl} crop={crop} zoom={zoom} aspect={undefined} onCropChange={setCrop} onCropComplete={(_,px)=>onCropChange(px)} onZoomChange={setZoom} /></div></div>;
}
