import { AsyncLocalStorage } from 'node:async_hooks';
import { database, sessionFor, sessionResponse } from './database';

export const auditContext = new AsyncLocalStorage<{ session: string; source: 'chat' | 'manual' | 'preset'; turnId?: number }>();

export async function withAudit(request: Request, source: 'chat' | 'manual' | 'preset', handler: (session: string) => Promise<Response>) {
  // Database must be writable before dispatching any device command.
  try {
    const session = sessionFor(request);
    return await auditContext.run({ session, source }, async () => sessionResponse(request, await handler(session), session));
  } catch (error) {
    console.error('Persistence request failed', error);
    return Response.json({ error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสถานะไฟก่อนส่งคำสั่งซ้ำ' }, { status: 503 });
  }
}

export function recordIntent(intent: unknown) {
  const context = auditContext.getStore();
  if (context?.turnId) database().prepare('UPDATE chat_turns SET intent=? WHERE id=?').run(JSON.stringify(intent),context.turnId);
}
