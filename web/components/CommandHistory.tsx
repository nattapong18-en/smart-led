"use client";
import { useState } from 'react';
import { browserApiFetch } from '../lib/browser-api';
type Command = { id: number; source: string; path: string; outcome: string; created_at: string };
function description(path: string) {
  const url = new URL(path,'http://device.local');
  if (url.pathname === '/light') return `ตั้งความสว่าง ${url.searchParams.get('brightness')}%`;
  if (url.pathname === '/blink') return `กระพริบ ${url.searchParams.get('brightness')}% · ${url.searchParams.get('onMs')}/${url.searchParams.get('offMs')} ms`;
  if (url.pathname === '/blink/stop') return 'หยุดกระพริบ';
  return 'คำสั่งไฟ';
}
export default function CommandHistory() {
  const [items,setItems]=useState<Command[]>([]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  async function refresh() {
    try { const r=await browserApiFetch('/api/history');if(!r.ok)throw Error();setItems((await r.json()).commands);setLoaded(true);setError(''); }
    catch {setError('อ่านประวัติไม่สำเร็จ');}
  }
  return <div className="history-card"><div className="panel-intro card-heading"><p>เวลาที่ส่งคำสั่งและผลตอบรับจากบอร์ด ในการเปิดหน้านี้ครั้งนี้</p><button onClick={()=>void refresh()}>{loaded ? 'รีเฟรช' : 'แสดงประวัติ'}</button></div>{loaded && <div className="history-list">{items.length===0 ? <p className="muted">ยังไม่มีคำสั่ง</p> : items.map(item=><div key={item.id}><time>{new Date(item.created_at).toLocaleString('th-TH')}</time><span>{description(item.path)} · {item.source==='chat'?'แชต':item.source==='preset'?'โหมดไฟ':'ปรับเอง'}</span><small>{item.outcome==='confirmed'?'สำเร็จ':item.outcome==='failed'?'บอร์ดปฏิเสธ':item.outcome==='unknown'?'ต้องตรวจสถานะไฟ':'กำลังรอผล'}</small></div>)}</div>}{error && <p role="alert">{error}</p>}</div>;
}
