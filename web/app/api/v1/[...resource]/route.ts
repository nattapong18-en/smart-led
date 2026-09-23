import { randomUUID } from "node:crypto";
import { GET as getStatus } from "@/app/api/esp32/status/route";
import { POST as chat } from "@/app/api/assistant/route";
import { POST as setLight } from "@/app/api/esp32/light/route";
import { POST as startBlink } from "@/app/api/esp32/blink/route";
import { POST as stopBlink } from "@/app/api/esp32/blink/stop/route";
import { POST as speech } from "@/app/api/speech/route";
import { GET as history } from "@/app/api/history/route";
import { GET as listPresets, POST as savePreset, DELETE as deletePreset } from "@/app/api/presets/route";
import { sessionFor } from "@/lib/database";
import { isUuid, publicApiOptions, withPublicApi } from "@/lib/public-api";

export const runtime = "nodejs";

type Context = { params: Promise<{ resource: string[] }> };

function pageSession(request: Request) {
  const id = request.headers.get("x-luma-session");
  return isUuid(id) ? id.toLowerCase() : randomUUID();
}

function requestFor(request: Request, path: string, method: "GET" | "POST" | "DELETE", session: string, body?: unknown, owner?: string) {
  const headers = new Headers({ "X-Luma-Session": session });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (owner) {
    // Existing preset API stores saved presets under a persistent cookie owner.
    // The public API uses an explicit owner UUID instead of browser cookies.
    sessionFor(new Request(request.url, { headers: { "X-Luma-Session": owner } }));
    headers.set("Cookie", `luma_session=${owner}`);
  }
  return new Request(new URL(path, request.url), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (Number(request.headers.get("content-length")) > 4096) {
    return Response.json({ error: "Body is too large" }, { status: 413 });
  }
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({ error: "Body is too large" }, { status: 413 });
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected object");
    return body as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected a JSON object" }, { status: 400 });
  }
}

function ownerFor(request: Request): string | Response {
  const owner = request.headers.get("x-luma-owner");
  return isUuid(owner) ? owner.toLowerCase() : Response.json({ error: "X-Luma-Owner must be a UUID" }, { status: 400 });
}

async function dispatch(request: Request, context: Context, method: "GET" | "POST" | "DELETE") {
  return withPublicApi(request, async () => {
    const { resource } = await context.params;
    const path = resource.join("/");
    const session = pageSession(request);
    let response: Response;

    if (method === "GET" && path === "status") response = await getStatus();
    else if (method === "GET" && path === "history") response = await history(requestFor(request, "/api/history", "GET", session));
    else if (path === "presets") {
      const owner = ownerFor(request);
      if (owner instanceof Response) response = owner;
      else if (method === "GET") response = await listPresets(requestFor(request, "/api/presets", "GET", session, undefined, owner));
      else if (method === "DELETE") {
        const id = new URL(request.url).searchParams.get("id");
        response = await deletePreset(requestFor(request, `/api/presets?id=${encodeURIComponent(id ?? "")}`, "DELETE", session, undefined, owner));
      } else {
        const body = await jsonBody(request);
        response = body instanceof Response ? body : await savePreset(requestFor(request, "/api/presets", "POST", session, body, owner));
      }
    }
    else if (method === "POST" && path === "blink/stop") response = await stopBlink(requestFor(request, "/api/esp32/blink/stop", "POST", session));
    else if (method === "POST" && ["chat", "light", "blink", "speech"].includes(path)) {
      const body = await jsonBody(request);
      if (body instanceof Response) response = body;
      else if (path === "chat") response = await chat(requestFor(request, "/api/assistant", "POST", session, body));
      else if (path === "speech") response = await speech(requestFor(request, "/api/speech", "POST", session, body));
      else if (path === "light") {
        const brightness = body.brightness;
        response = Number.isInteger(brightness) && Number(brightness) >= 0 && Number(brightness) <= 100
          ? await setLight(requestFor(request, `/api/esp32/light?brightness=${brightness}`, "POST", session))
          : Response.json({ error: "brightness must be an integer from 0 to 100" }, { status: 400 });
      } else {
        const { brightness, onMs, offMs, count } = body;
        const valid = Number.isInteger(brightness) && Number(brightness) >= 1 && Number(brightness) <= 100
          && Number.isInteger(onMs) && Number(onMs) >= 50 && Number(onMs) <= 5000
          && Number.isInteger(offMs) && Number(offMs) >= 50 && Number(offMs) <= 5000
          && Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 100;
        response = valid
          ? await startBlink(requestFor(request, `/api/esp32/blink?brightness=${brightness}&onMs=${onMs}&offMs=${offMs}&count=${count}`, "POST", session))
          : Response.json({ error: "blink needs brightness 1–100, onMs/offMs 50–5000, count 0–100" }, { status: 400 });
      }
    } else response = Response.json({ error: "Unknown API route or method" }, { status: 404 });

    response.headers.set("X-Luma-Session", session);
    return response;
  });
}

export async function GET(request: Request, context: Context) { return dispatch(request, context, "GET"); }
export async function POST(request: Request, context: Context) { return dispatch(request, context, "POST"); }
export async function DELETE(request: Request, context: Context) { return dispatch(request, context, "DELETE"); }
export async function OPTIONS(request: Request) { return publicApiOptions(request); }
