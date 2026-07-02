import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = await verifySessionToken(token);

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/login") {
      loginUrl.searchParams.set("from", request.nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except: /login itself, Next internals, and static files.
    "/((?!login|_next/static|_next/image|favicon.ico).*)",
  ],
};
