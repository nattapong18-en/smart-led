import { forwardToEsp32 } from "@/lib/esp32-server";
import { withAudit } from '@/lib/audit';

function integer(search: URLSearchParams, name: string, minimum: number, maximum: number) {
  const raw = search.get(name);
  const value = Number(raw);
  return raw !== null && raw.trim() !== "" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

export async function POST(request: Request) {
  const search = new URL(request.url).searchParams;
  const brightness = integer(search, "brightness", 1, 100);
  const onMs = integer(search, "onMs", 50, 5000);
  const offMs = integer(search, "offMs", 50, 5000);
  const count = integer(search, "count", 0, 100);
  if (brightness === null || onMs === null || offMs === null || count === null) {
    return Response.json({ error: "brightness=1..100, onMs/offMs=50..5000, count=0..100 are required" }, { status: 400 });
  }
  return withAudit(request,'manual',() => forwardToEsp32(`/blink?brightness=${brightness}&onMs=${onMs}&offMs=${offMs}&count=${count}`, "POST"));
}
