import { browserApiFetch } from "./browser-api";

const ESP32_BASE_URL = "/api/esp32";

export type LightStatus = {
  brightness: number;
  on: boolean;
  blinking: boolean;
  blinkOutputOn: boolean;
  blinkBrightness: number;
  blinkOnMs: number;
  blinkOffMs: number;
  blinkCount: number;
  blinkRemaining: number;
};

export async function getLightStatus(): Promise<LightStatus> {
  const response = await browserApiFetch(`${ESP32_BASE_URL}/status`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to get light status");
  }

  return response.json();
}

export async function setBrightness(brightness: number): Promise<LightStatus> {
  const response = await browserApiFetch(
    `${ESP32_BASE_URL}/light?brightness=${brightness}`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to set brightness");
  }

  return response.json();
}

export async function startBlink(brightness: number, onMs: number, offMs: number, count: number): Promise<LightStatus> {
  const query = new URLSearchParams({
    brightness: String(brightness), onMs: String(onMs), offMs: String(offMs), count: String(count),
  });
  const response = await browserApiFetch(`${ESP32_BASE_URL}/blink?${query}`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to start blinking");
  return response.json();
}

export async function stopBlink(): Promise<LightStatus> {
  const response = await browserApiFetch(`${ESP32_BASE_URL}/blink/stop`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to stop blinking");
  return response.json();
}
