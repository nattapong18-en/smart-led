"use client";
import { useEffect, useState } from 'react';
import type { LightStatus } from '../lib/esp32';
import { browserApiFetch } from '../lib/browser-api';

type Preset = { id: number; name: string; mode: 'steady' | 'blink'; brightness: number; onMs: number; offMs: number; count: number };
type Props = { status: LightStatus | null; blinkBrightness: number; blinkOnMs: number; blinkOffMs: number; blinkCount: number; onApplied: (state: LightStatus) => void };
export default function SavedPresets({ status, blinkBrightness, blinkOnMs, blinkOffMs, blinkCount, onApplied }: Props) {
  const [items,setItems] = useState<Preset[]>([]);
  const [name,setName] = useState('');
  const [mode,setMode] = useState<'steady'|'blink'>('steady');
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState('');
  async function read() { const r=await browserApiFetch('/api/presets'); if(!r.ok) throw Error('อ่านโหมดไฟไม่สำเร็จ'); setItems((await r.json()).presets); }
  useEffect(() => { void read().catch(() => setFeedback('อ่านโหมดไฟไม่สำเร็จ')); }, []);
  async function request(method: 'POST'|'DELETE', body?: object, id?: number) {
    setBusy(true);setFeedback('');
    try {
      const response=await browserApiFetch(`/api/presets${id ? `?id=${id}` : ''}`,{method,headers:{'Content-Type':'application/json'},body:body ? JSON.stringify(body) : undefined});
      const result=await response.json();
      if(!response.ok) throw Error(result.error ?? 'ทำรายการไม่สำเร็จ');
      if(body && 'action' in body) onApplied(result as LightStatus);
      await read();
      if(body && !('action' in body)) setName('');
      setFeedback(body && 'action' in body ? 'ใช้โหมดไฟแล้ว' : method === 'DELETE' ? 'ลบโหมดแล้ว' : 'บันทึกโหมดแล้ว');
    } catch(error) {setFeedback(error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ');}
    finally {setBusy(false);}
  }
  return <div className="preset-card">
    <div className="panel-intro"><p>ตั้งชื่อค่าที่ชอบ แล้วเรียกใช้ได้แม้รีสตาร์ตเว็บ</p></div>
    <div className="preset-fields">
      <label>ชื่อโหมด<input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="เช่น อ่านหนังสือ" /></label>
      <label>รูปแบบ<select value={mode} onChange={e=>setMode(e.target.value as 'steady'|'blink')}><option value="steady">ไฟติดค้าง</option><option value="blink">ไฟกระพริบ</option></select></label>
    </div>
    <button disabled={busy || !name.trim() || !status} onClick={()=>void request('POST',{ name:name.trim(),mode,brightness:mode==='steady' ? (status!.blinking ? status!.blinkBrightness : status!.brightness) : blinkBrightness,onMs:blinkOnMs,offMs:blinkOffMs,count:blinkCount })}>บันทึกค่าปัจจุบัน</button>
    <div className="saved-list">{items.length === 0 && <p className="muted empty-note">ยังไม่มีโหมดที่บันทึก</p>}{items.map(p=><div key={p.id} className="saved-row"><span><strong>{p.name}</strong><small>{p.mode==='blink' ? `กระพริบ ${p.brightness}% · ${p.onMs}/${p.offMs} ms · ${p.count || 'ต่อเนื่อง'}` : `ติดค้าง ${p.brightness}%`}</small></span><button disabled={busy} onClick={()=>void request('POST',{action:'apply',id:p.id})}>ใช้</button><button disabled={busy} onClick={()=>void request('DELETE',undefined,p.id)} aria-label={`ลบโหมด ${p.name}`}>ลบ</button></div>)}</div>
    {feedback && <p className="muted" role="status">{feedback}</p>}
  </div>;
}
