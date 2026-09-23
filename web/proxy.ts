import { NextResponse, type NextRequest } from "next/server";

// In a public API-only deployment, the older first-party endpoints must not
// bypass the authenticated /api/v1 interface. Direct function calls from the
// v1 route are unaffected because they do not issue HTTP requests.
export function proxy(request: NextRequest) {
  if (process.env.LUMA_PUBLIC_API_ONLY !== "1" || request.nextUrl.pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}

export const config = { matcher: "/api/:path*" };
