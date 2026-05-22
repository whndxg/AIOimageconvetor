import { useRef } from 'react';

const UploadArea = ({ onUpload }: { onUpload: (files: File[]) => void }) => {
  const ref = useRef<HTMLInputElement>(null);
  return <div className='card upload' onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault(); onUpload(Array.from(e.dataTransfer.files));}}>
    <input ref={ref} hidden multiple type='file' onChange={(e)=>onUpload(Array.from(e.target.files || []))} />
    <button onClick={()=>ref.current?.click()}>Upload Images</button>
    <p>Drag and drop files here.</p>
  </div>;
};

export default UploadArea;
