import { database, persistentSessionFor, persistentSessionResponse, validatePreset } from '@/lib/database';
import { withAudit } from '@/lib/audit';
import { forwardToEsp32 } from '@/lib/esp32-server';
export const runtime = 'nodejs';

function withPresetAudit(request: Request, handler: (owner: string) => Promise<Response>) {
  if (!request.headers.has('x-luma-session')) return withAudit(request, 'preset', handler);
  const owner = persistentSessionFor(request);
  return withAudit(request, 'preset', async () => persistentSessionResponse(request, await handler(owner), owner));
}

export async function GET(request: Request) {
  return withPresetAudit(request,async owner => Response.json({ presets: database().prepare('SELECT id,name,mode,brightness,on_ms AS onMs,off_ms AS offMs,count FROM presets WHERE session_id=? ORDER BY id DESC').all(owner) }));
}
export async function POST(request: Request) {
  return withPresetAudit(request,async owner => {
    let body;
    try { body = await request.json(); } catch { return Response.json({ error:'Invalid JSON' },{ status:400 }); }
    const db = database();
    if (body?.action === 'apply') {
      if (!Number.isSafeInteger(body.id) || body.id < 1) return Response.json({ error:'Invalid id' },{ status:400 });
      const p = db.prepare('SELECT * FROM presets WHERE id=? AND session_id=?').get(body.id,owner);
      if (!p) return Response.json({ error:'ไม่พบโหมดไฟ' },{ status:404 });
      return forwardToEsp32(p.mode === 'steady' ? `/light?brightness=${p.brightness}` : `/blink?brightness=${p.brightness}&onMs=${p.on_ms}&offMs=${p.off_ms}&count=${p.count}`, 'POST');
    }
    const p = validatePreset(body);
    if (!p) return Response.json({ error:'กรุณาตรวจชื่อและค่าโหมดไฟ' },{ status:400 });
    if (db.prepare('SELECT id FROM presets WHERE session_id=? AND name=?').get(owner,p.name)) return Response.json({ error:'มีชื่อโหมดนี้แล้ว กรุณาใช้ชื่ออื่น' },{ status:409 });
    const result = db.prepare('INSERT INTO presets(session_id,name,mode,brightness,on_ms,off_ms,count) VALUES (?,?,?,?,?,?,?)').run(owner,p.name,p.mode,p.brightness,p.onMs,p.offMs,p.count);
    return Response.json({ id:Number(result.lastInsertRowid),...p },{ status:201 });
  });
}
export async function DELETE(request: Request) {
  return withPresetAudit(request,async owner => {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error:'Invalid id' },{ status:400 });
    const result = database().prepare('DELETE FROM presets WHERE id=? AND session_id=?').run(id,owner);
    return result.changes ? Response.json({ ok:true }) : Response.json({ error:'ไม่พบโหมดไฟ' },{ status:404 });
  });
}
