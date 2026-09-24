'use client';

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Lightbulb, Power, RefreshCw } from 'lucide-react';
import type { LightStatus } from '@/lib/esp32';
import { Button } from './ui/button';

// The dial sweeps 270° clockwise, starting at the lower-left (135°).
const START = 135;
const SWEEP = 270;
const C = 150;
const R = 128;
const levels = [10, 25, 50, 75, 100];

function point(value: number) {
  const angle = (START + (SWEEP * value) / 100) * Math.PI / 180;
  return { x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
}
const arcStart = point(0);
const arcEnd = point(100);
const arcPath = `M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 1 1 ${arcEnd.x} ${arcEnd.y}`;

type Props = { status: LightStatus | null; connection: string; brightness: number; busy: boolean; ready: boolean; onPreview: (value: number) => void; onApply: (value: number) => void; onRefresh: () => void };

export default function LampDial({ status, connection, brightness, busy, ready, onPreview, onApply, onRefresh }: Props) {
  const reducedMotion = useReducedMotion();
  const dial = useRef<HTMLDivElement>(null);
  const lastOn = useRef(100);
  if (status?.on && status.brightness > 0) lastOn.current = status.brightness;

  const connected = connection === 'connected';
  const disabled = busy || !ready;
  const lit = connected && (status?.on || status?.blinking) === true;
  const previewing = connected && brightness !== status?.brightness && !status?.blinking;
  const shown = status?.blinking ? status.blinkBrightness : previewing ? brightness : status?.brightness ?? 0;
  const glow = connected ? shown / 100 : 0;
  const knob = point(shown);

  function valueFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = dial.current!.getBoundingClientRect();
    const degrees = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
    const along = (degrees - START + 720) % 360;
    // The gap at the bottom snaps to whichever end is closer.
    if (along > SWEEP) return along > SWEEP + (360 - SWEEP) / 2 ? 0 : 100;
    return Math.round((along / SWEEP) * 100);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || status?.blinking) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPreview(valueFromPointer(event));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) onPreview(valueFromPointer(event));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    const next = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? brightness + step
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? brightness - step
      : event.key === 'Home' ? 0 : event.key === 'End' ? 100 : null;
    if (event.key === 'Enter' && previewing) { event.preventDefault(); onApply(brightness); return; }
    if (next === null) return;
    event.preventDefault();
    onPreview(Math.max(0, Math.min(100, next)));
  }

  const state = !connected ? 'ไม่ทราบสถานะ' : status?.blinking ? 'กำลังกระพริบ' : status?.on ? 'เปิดอยู่' : 'ปิดอยู่';

  return <div className="lamp" id="lamp-dial">
    <div ref={dial} className={`dial ${disabled ? 'dial-disabled' : ''}`} role="slider" tabIndex={disabled ? -1 : 0} aria-label="ความสว่าง" aria-valuemin={0} aria-valuemax={100} aria-valuenow={brightness} aria-valuetext={`${brightness}%${previewing ? ' (ตัวอย่าง ยังไม่ส่ง)' : ''}`} aria-disabled={disabled} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onKeyDown={onKeyDown}>
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <defs><linearGradient id="dial-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#8a4d10" /><stop offset="1" stopColor="#ffc864" /></linearGradient></defs>
        <path d={arcPath} className="dial-track" pathLength={100} />
        {connected && <path d={arcPath} className="dial-fill" pathLength={100} strokeDasharray={`${shown} 100`} />}
        {connected && <circle cx={knob.x} cy={knob.y} r={11} className="dial-knob" />}
      </svg>
      <div className="dial-core">
        <motion.div className={`bulb-glow ${status?.blinking ? 'bulb-blinking' : ''}`} aria-hidden="true" animate={{ opacity: glow ? 0.18 + glow * 0.6 : 0, scale: 0.75 + glow * 0.45 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.35 }} />
        <motion.div className="bulb-icon" aria-hidden="true" animate={{ color: glow ? '#fff1d6' : '#4a4036', filter: glow ? `drop-shadow(0 0 ${10 + glow * 28}px rgba(255,183,77,${0.3 + glow * 0.6}))` : 'none' }} transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}><Lightbulb size={64} strokeWidth={1.2} /></motion.div>
        <div className="dial-readout"><span>{connected ? shown : '—'}</span><small>%</small></div>
        <span className={`dial-state ${lit ? 'dial-state-on' : ''}`}>{previewing ? 'ตัวอย่าง' : state}</span>
      </div>
    </div>

    <div className="lamp-actions">
      <button type="button" className={`power-button ${lit ? 'power-on' : ''}`} disabled={disabled} aria-label={lit ? 'ปิดไฟ' : 'เปิดไฟ'} aria-pressed={lit} onClick={() => onApply(lit ? 0 : lastOn.current)}><Power size={22} /></button>
      <Button className="apply-button" disabled={disabled || !previewing} onClick={() => onApply(brightness)}>{busy ? 'กำลังส่ง…' : previewing ? `ใช้ค่า ${brightness}%` : 'หมุนวงแหวนเพื่อปรับ'}</Button>
      <Button variant="ghost" size="icon" className="refresh-button" onClick={onRefresh} aria-label="อ่านสถานะอีกครั้ง"><RefreshCw size={16} /></Button>
    </div>

    <div className="level-chips" role="group" aria-label="ระดับที่ใช้บ่อย">
      {levels.map(value => <button key={value} type="button" disabled={disabled} aria-pressed={connected && !status?.blinking && status?.brightness === value} onClick={() => onApply(value)}>{value}%</button>)}
    </div>
    <p className="lamp-caption">{previewing ? 'กำลังดูตัวอย่าง · กด “ใช้ค่า” เพื่อส่งไปที่บอร์ด' : connected ? 'ลากวงแหวนหรือกดปุ่มลูกศรเพื่อปรับ · แสดงค่าที่ยืนยันจาก ESP32' : 'รอการเชื่อมต่อกับ ESP32'}</p>
  </div>;
}
