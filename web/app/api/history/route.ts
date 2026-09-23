import { database, recentTurns } from '@/lib/database';
import { withAudit } from '@/lib/audit';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return withAudit(request,'chat',async session => Response.json({
    turns: recentTurns(session),
    commands: database().prepare('SELECT id,turn_id,source,path,outcome,status_code,created_at FROM commands WHERE session_id=? ORDER BY id DESC LIMIT 50').all(session),
  }));
}
