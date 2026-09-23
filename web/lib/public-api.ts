import { createHash, timingSafeEqual } from "node:crypto";

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (process.env.LUMA_API_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (configured.includes("*")) return "*";
  return configured.includes(origin) ? origin : null;
}

function withCors(request: Request, response: Response): Response {
  const origin = allowedOrigin(request.headers.get("origin"));
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Luma-Session, X-Luma-Owner");
    response.headers.set("Access-Control-Expose-Headers", "X-Luma-Session");
    response.headers.append("Vary", "Origin");
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.delete("Set-Cookie");
  return response;
}

export function isUuid(value: string | null): value is string {
  return value !== null && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

export function apiKeyIsValid(header: string | null, configured = process.env.LUMA_API_KEY): boolean {
  if (!configured || configured.length < 32 || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  const expectedHash = createHash("sha256").update(configured).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export function publicApiOptions(request: Request): Response {
  if (request.headers.has("origin") && !allowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  return withCors(request, new Response(null, { status: 204 }));
}

export async function withPublicApi(request: Request, handler: () => Promise<Response>): Promise<Response> {
  if (request.headers.has("origin") && !allowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  if (!process.env.LUMA_API_KEY || process.env.LUMA_API_KEY.length < 32) {
    return withCors(request, Response.json({ error: "Public API is not configured" }, { status: 503 }));
  }
  if (!apiKeyIsValid(request.headers.get("authorization"))) {
    return withCors(request, Response.json({ error: "Invalid API key" }, { status: 401 }));
  }
  try {
    return withCors(request, await handler());
  } catch (error) {
    console.error("Public API request failed", error);
    return withCors(request, Response.json({ error: "Internal server error" }, { status: 500 }));
  }
}
