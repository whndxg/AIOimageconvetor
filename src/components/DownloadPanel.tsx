export default function DownloadPanel(props:{onConvertOne:()=>void;onConvertAll:()=>void;onDownloadOne:()=>void;onDownloadAll:()=>void;onReset:()=>void}) {
  return <div className='card actions'>
    <button onClick={props.onConvertOne}>Convert Selected Image</button>
    <button onClick={props.onConvertAll}>Convert All Images</button>
    <button onClick={props.onDownloadOne}>Download Selected</button>
    <button onClick={props.onDownloadAll}>Download All as ZIP</button>
    <button onClick={props.onReset}>Reset</button>
  </div>;
}
