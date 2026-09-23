import { forwardToEsp32 } from "@/lib/esp32-server";

export async function GET() {
  return forwardToEsp32("/status", "GET");
}
