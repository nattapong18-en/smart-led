let pageSessionId: string | undefined;
let externalApi: { baseUrl: string; key: string } | null = null;
let externalMode = false;

const OWNER_STORAGE_KEY = "luma-owner-id";

export function enableExternalApiMode() {
  externalMode = true;
}

export function configureExternalApi(url: string, key: string) {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error("API URL must use HTTPS (or localhost for development)");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Enter the API origin without credentials or query parameters");
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname && pathname !== "/api/v1") throw new Error("API URL must end at the host or /api/v1");
  if (!key.trim()) throw new Error("Enter the API key");
  externalApi = { baseUrl: `${parsed.origin}/api/v1`, key: key.trim() };
  window.localStorage.setItem("luma-api-url", parsed.origin);
}

export function clearExternalApi() {
  externalApi = null;
}

export function savedExternalApiUrl() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("luma-api-url") || "";
}

export function externalApiConfigured() {
  return externalApi !== null;
}

type ForwardedRequest = { path: string; init: RequestInit; presets: boolean };

export function mapLegacyApiRequest(path: string, init: RequestInit = {}): ForwardedRequest {
  const url = new URL(path, "http://luma.local");
  if (url.origin !== "http://luma.local") throw new Error("External API only accepts local API paths");
  const method = (init.method || "GET").toUpperCase();
  const pathname = url.pathname;
  const body = (value: object) => ({ ...init, method: "POST", headers: { ...Object.fromEntries(new Headers(init.headers)), "Content-Type": "application/json" }, body: JSON.stringify(value) });

  if (pathname === "/api/esp32/status" && method === "GET") return { path: "/status", init, presets: false };
  if (pathname === "/api/esp32/light" && method === "POST") return { path: "/light", init: body({ brightness: Number(url.searchParams.get("brightness")) }), presets: false };
  if (pathname === "/api/esp32/blink" && method === "POST") {
    return { path: "/blink", init: body(Object.fromEntries(["brightness", "onMs", "offMs", "count"].map(name => [name, Number(url.searchParams.get(name))]))), presets: false };
  }
  if (pathname === "/api/esp32/blink/stop" && method === "POST") return { path: "/blink/stop", init, presets: false };
  if (pathname === "/api/assistant" && method === "POST") return { path: "/chat", init, presets: false };
  if (pathname === "/api/speech" && method === "POST") return { path: "/speech", init, presets: false };
  if (pathname === "/api/history" && method === "GET") return { path: "/history", init, presets: false };
  if (pathname === "/api/presets" && ["GET", "POST", "DELETE"].includes(method)) {
    return { path: `/presets${url.search}`, init, presets: true };
  }
  throw new Error("Unsupported API request");
}

export function browserApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (typeof window === "undefined") throw new Error("Browser API is only available in the browser");
  pageSessionId ??= crypto.randomUUID();
  if (externalMode) {
    if (!externalApi) throw new Error("Configure the API URL and key first");
    if (typeof input !== "string") throw new Error("External API only accepts local API paths");
    const forwarded = mapLegacyApiRequest(input, init);
    const headers = new Headers(forwarded.init.headers);
    headers.set("Authorization", `Bearer ${externalApi.key}`);
    headers.set("X-Luma-Session", pageSessionId);
    if (forwarded.presets) {
      let owner = window.localStorage.getItem(OWNER_STORAGE_KEY);
      if (!owner || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(owner)) {
        owner = crypto.randomUUID();
        window.localStorage.setItem(OWNER_STORAGE_KEY, owner);
      }
      headers.set("X-Luma-Owner", owner);
    }
    return fetch(`${externalApi.baseUrl}${forwarded.path}`, { ...forwarded.init, headers, credentials: "omit" });
  }
  const headers = new Headers(init.headers);
  headers.set("X-Luma-Session", pageSessionId);
  return fetch(input, { ...init, headers });
}
