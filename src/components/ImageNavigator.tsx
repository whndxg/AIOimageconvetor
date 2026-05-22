import { ImageItem } from '../types';

export default function ImageNavigator({ images, selected, onSelect }: { images: ImageItem[]; selected:number; onSelect:(n:number)=>void }) {
  return <div className='card nav'><button onClick={()=>onSelect(Math.max(0, selected-1))}>Previous</button>
    <select value={selected} onChange={(e)=>onSelect(Number(e.target.value))}>{images.map((i,idx)=><option key={i.id} value={idx}>{i.file.name}</option>)}</select>
    <button onClick={()=>onSelect(Math.min(images.length-1, selected+1))}>Next</button>
  </div>;
}
