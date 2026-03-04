// ──────────────────────────────────────────────────────────
// Next.js Middleware — device identity cookie
//
// Sets a persistent `device-id` cookie on first visit so the
// integration store can isolate OAuth configs per browser.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.has("device-id")) {
    response.cookies.set("device-id", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
