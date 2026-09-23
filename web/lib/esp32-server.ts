import { database } from './database';
import { auditContext } from './audit';

export async function forwardToEsp32(path: string, method: "GET" | "POST") {
  const baseUrl = process.env.ESP32_BASE_URL || "http://192.168.1.108";
  const context = auditContext.getStore();
  const commandId = method === 'POST' && context ? database().prepare(
    'INSERT INTO commands(session_id,turn_id,source,path) VALUES (?,?,?,?)'
  ).run(context.session,context.turnId ?? null,context.source,path).lastInsertRowid : null;
  const finish = (outcome: string, status: number, data: unknown) => {
    if (commandId !== null) database().prepare('UPDATE commands SET outcome=?,status_code=?,response_json=? WHERE id=?')
      .run(outcome,status,JSON.stringify(data),commandId);
  };

  // A lost POST response does not prove the board did not execute it.
  // Retrying a blink would restart it, so retry only read-only requests.
  const attempts = method === 'GET' ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        method,
        headers: { Connection: 'close' },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      finish(response.ok ? 'confirmed' : 'failed', response.status, data);
      return Response.json(data, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`ESP32 ${method} ${path} failed (${attempt}/${attempts}): ${reason}`);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  finish('unknown',502,{ error: 'No acknowledgement from ESP32' });
  return Response.json(
    { error: "เชื่อมต่อ ESP32 ไม่ได้ กรุณาตรวจสอบ IP และ Wi-Fi" },
    { status: 502 },
  );
}
