import { forwardToEsp32 } from "@/lib/esp32-server";
import { withAudit } from '@/lib/audit';

export async function POST(request: Request) {
  return withAudit(request,'manual',() => forwardToEsp32("/blink/stop", "POST"));
}
