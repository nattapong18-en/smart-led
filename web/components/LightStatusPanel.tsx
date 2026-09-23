'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import type { LightStatus } from '@/lib/esp32';
import { Button } from './ui/button';

export default function LightStatusPanel({ status, connection, previewBrightness, onRefresh }: { status: LightStatus | null; connection: string; previewBrightness: number; onRefresh: () => void }) {
  const reducedMotion = useReducedMotion();
  const actual = status?.blinking ? status.blinkBrightness : status?.brightness ?? 0;
  const previewing = connection === 'connected' && previewBrightness !== status?.brightness && !status?.blinking;
  const visualBrightness = previewing ? previewBrightness : actual;
  const glow = connection === 'connected' ? visualBrightness / 100 : 0;
  const state = connection !== 'connected' ? 'ไม่ทราบสถานะ' : status?.blinking ? 'กำลังกระพริบ' : status?.on ? 'เปิดอยู่' : 'ปิดอยู่';

  return <section className="status-panel" aria-labelledby="light-heading">
    <div className="section-topline"><div><p className="section-kicker">LIVE DEVICE</p><h2 id="light-heading">สถานะไฟ</h2></div><span className={`device-state ${connection === 'connected' && (status?.on || status?.blinking) ? 'device-state-on' : ''}`}><span className="status-dot" />{state}</span></div>
    <div className="bulb-stage" aria-label={`ความสว่าง${previewing ? 'ตัวอย่าง' : 'ปัจจุบัน'} ${visualBrightness} เปอร์เซ็นต์`}>
      <motion.div className={`bulb-glow ${status?.blinking ? 'bulb-blinking' : ''}`} aria-hidden="true" animate={{ opacity: glow ? 0.16 + glow * 0.58 : 0, scale: 0.78 + glow * 0.42 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.35 }} />
      <motion.div className="bulb-icon" aria-hidden="true" animate={{ color: glow ? '#e9ddff' : '#52525b', filter: glow ? `drop-shadow(0 0 ${10 + glow * 30}px rgba(167,139,250,${0.25 + glow * 0.55}))` : 'none' }} transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}><Lightbulb size={98} strokeWidth={1.25} /></motion.div>
    </div>
    <div className="brightness-readout"><span>{connection === 'connected' ? visualBrightness : '—'}</span><span className="brightness-unit">%</span></div>
    <p className="status-caption">{previewing ? 'ตัวอย่างความสว่าง · กดใช้ค่าเพื่อส่งไปที่บอร์ด' : 'ความสว่างที่ยืนยันจาก ESP32'}</p>
    <Button variant="ghost" size="sm" className="refresh-button" onClick={onRefresh}><RefreshCw size={14} />อ่านสถานะอีกครั้ง</Button>
  </section>;
}
