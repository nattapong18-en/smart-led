let pageSessionId: string | undefined;

export function browserApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (typeof window === "undefined") throw new Error("Browser API is only available in the browser");
  pageSessionId ??= crypto.randomUUID();
  const headers = new Headers(init.headers);
  headers.set("X-Luma-Session", pageSessionId);
  return fetch(input, { ...init, headers });
}
