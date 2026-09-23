import { NextResponse, type NextRequest } from "next/server";

// The API-only deployment serves no first-party UI or legacy endpoints.
// Direct function calls from the v1 route are unaffected because they do not
// issue HTTP requests through Proxy.
export function proxy(request: NextRequest) {
  if (process.env.LUMA_PUBLIC_API_ONLY !== "1"
    || request.nextUrl.pathname === "/health"
    || request.nextUrl.pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}

export const config = { matcher: "/:path*" };
