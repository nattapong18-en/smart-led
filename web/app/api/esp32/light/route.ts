import { forwardToEsp32 } from "@/lib/esp32-server";
import { withAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const value = new URL(request.url).searchParams.get("brightness");
  const brightness = Number(value);
  if (value === null || value.trim() === "" || !Number.isInteger(brightness) || brightness < 0 || brightness > 100) {
    return Response.json({ error: "brightness must be an integer from 0 to 100" }, { status: 400 });
  }
  return withAudit(request,'manual',() => forwardToEsp32(`/light?brightness=${brightness}`, "POST"));
}
