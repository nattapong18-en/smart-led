'use client';

import { Radio } from 'lucide-react';
import { Button } from './ui/button';
import { SegmentedControl } from './ui/segmented-control';

type Props = { brightness: number; onMs: number; offMs: number; count: number; busy: boolean; ready: boolean; blinking: boolean; onBrightness: (value: number) => void; onOnMs: (value: number) => void; onOffMs: (value: number) => void; onCount: (value: number) => void; onStart: () => void; onStop: () => void };
const speeds = [{ value: '150', label: 'เร็ว' }, { value: '500', label: 'ปกติ' }, { value: '1000', label: 'ช้า' }];
export default function BlinkControls({ brightness, onMs, offMs, count, busy, ready, blinking, onBrightness, onOnMs, onOffMs, onCount, onStart, onStop }: Props) {
  const disabled = busy || !ready;
  const invalid = brightness < 1 || brightness > 100 || onMs < 50 || onMs > 5000 || offMs < 50 || offMs > 5000 || count < 0 || count > 100;
  return <section className="control-section blink-section" aria-labelledby="blink-heading">
    <div className="section-topline"><div><p className="section-kicker">LIGHT PATTERNS</p><h2 id="blink-heading">ไฟกระพริบ</h2></div><span className={`blink-state ${blinking ? 'blink-state-active' : ''}`}><Radio size={13} />{blinking ? 'กำลังทำงาน' : 'พร้อมใช้งาน'}</span></div>
    <p className="section-description">กำหนดจังหวะเอง หรือเลือกรูปแบบที่ต้องการ</p>
    <SegmentedControl label="เลือกความเร็วไฟกระพริบ" value={onMs === offMs && speeds.some(item => Number(item.value) === onMs) ? String(onMs) : ''} onValueChange={value => { onOnMs(Number(value)); onOffMs(Number(value)); }} options={speeds} disabled={disabled} />
    <div className="blink-fields">
      <label>ความสว่าง <span>%</span><input type="number" min="1" max="100" value={brightness} disabled={disabled} onChange={event => onBrightness(Number(event.target.value))} /></label>
      <label>เวลาติด <span>ms</span><input type="number" min="50" max="5000" step="50" value={onMs} disabled={disabled} onChange={event => onOnMs(Number(event.target.value))} /></label>
      <label>เวลาดับ <span>ms</span><input type="number" min="50" max="5000" step="50" value={offMs} disabled={disabled} onChange={event => onOffMs(Number(event.target.value))} /></label>
      <label>จำนวนครั้ง <span>0 = ต่อเนื่อง</span><input type="number" min="0" max="100" value={count} disabled={disabled} onChange={event => onCount(Number(event.target.value))} /></label>
    </div>
    <div className="action-row"><Button className="action-primary" disabled={disabled || invalid} onClick={onStart}>{busy ? 'กำลังส่ง…' : 'เริ่มกระพริบ'}</Button><Button variant="outline" disabled={disabled || !blinking} onClick={onStop}>หยุด</Button></div>
  </section>;
}
