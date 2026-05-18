import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optional HTTP Basic Auth when RTD_SITE_USER + RTD_SITE_PASSWORD are set (server env only).
 * Prefer Vercel Deployment Protection on Pro; this works on any plan.
 */
export function middleware(request: NextRequest) {
  const user = process.env.RTD_SITE_USER?.trim();
  const pass = process.env.RTD_SITE_PASSWORD?.trim();

  if (!user || !pass) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(":");
      const u = colon >= 0 ? decoded.slice(0, colon) : decoded;
      const p = colon >= 0 ? decoded.slice(colon + 1) : "";
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    } catch {
      /* invalid encoding */
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="RT Davies Estimates", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
