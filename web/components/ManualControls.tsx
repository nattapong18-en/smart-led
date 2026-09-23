'use client';

import { Power, SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { SegmentedControl } from './ui/segmented-control';

const levels = [25, 50, 70, 100];
export default function ManualControls({ brightness, busy, ready, onPreview, onApply }: { brightness: number; busy: boolean; ready: boolean; onPreview: (value: number) => void; onApply: (value: number) => void }) {
  return <section className="control-section" id="manual-heading" aria-labelledby="manual-title">
    <div className="section-topline"><div><p className="section-kicker">DIRECT CONTROL</p><h2 id="manual-title">ปรับความสว่าง</h2></div><SlidersHorizontal size={18} className="section-icon" /></div>
    <div className="slider-head"><label htmlFor="brightness">ความสว่างที่ต้องการ</label><output htmlFor="brightness">{brightness}%</output></div>
    <input id="brightness" className="brightness-slider" type="range" min="0" max="100" value={brightness} style={{ '--range-progress': `${brightness}%` } as React.CSSProperties} disabled={busy || !ready} onChange={event => onPreview(Number(event.target.value))} />
    <div className="range-labels"><span>ปิด</span><span>สว่างสุด</span></div>
    <div className="control-subheading">ระดับที่ใช้บ่อย</div>
    <SegmentedControl label="เลือกระดับความสว่าง" value={levels.includes(brightness) ? String(brightness) : ''} onValueChange={value => onApply(Number(value))} options={levels.map(value => ({ value: String(value), label: `${value}%` }))} disabled={busy || !ready} />
    <div className="action-row"><Button className="action-primary" disabled={busy || !ready} onClick={() => onApply(brightness)}>{busy ? 'กำลังส่ง…' : `ใช้ค่า ${brightness}%`}</Button><Button variant="outline" size="icon" disabled={busy || !ready} onClick={() => onApply(0)} aria-label="ปิดไฟ"><Power size={17} /></Button></div>
    <p className="control-hint">เลื่อนเพื่อดูตัวอย่าง แล้วกดใช้ค่าเพื่อยืนยัน</p>
  </section>;
}
