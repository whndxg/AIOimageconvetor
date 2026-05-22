import { Settings } from '../types';

export default function ConversionSettings({ settings, setSettings, estimateKb }: { settings:Settings; setSettings:(v:Settings)=>void; estimateKb:number }) {
  return <div className='card'><h3>Settings</h3>
    <label>Format<select value={settings.format} onChange={(e)=>setSettings({ ...settings, format: e.target.value as Settings['format'] })}><option>jpg</option><option>png</option><option>webp</option><option>avif</option><option>bmp</option><option>tiff</option><option>pdf</option><option>heic</option></select></label>
    <label>Quality {settings.quality}%<input type='range' min={10} max={100} value={settings.quality} onChange={(e)=>setSettings({...settings, quality:Number(e.target.value)})}/></label>
    <label>Reduce size by %<input type='number' min={0} max={90} value={settings.reduceByPercent} onChange={(e)=>setSettings({...settings, reduceByPercent:Number(e.target.value)})}/></label>
    <label>Resize mode<select value={settings.resizeMode} onChange={(e)=>setSettings({...settings, resizeMode:e.target.value as Settings['resizeMode']})}><option value='none'>none</option><option value='percent'>percentage</option><option value='custom'>custom</option></select></label>
    {settings.resizeMode==='percent' && <input type='number' value={settings.percent} onChange={(e)=>setSettings({...settings, percent:Number(e.target.value)})}/>}
    {settings.resizeMode==='custom' && <div><input type='number' value={settings.width} onChange={(e)=>setSettings({...settings, width:Number(e.target.value)})}/><input type='number' value={settings.height} onChange={(e)=>setSettings({...settings, height:Number(e.target.value)})}/></div>}
    <p>Estimated output ~{estimateKb} KB</p>
  </div>;
}
