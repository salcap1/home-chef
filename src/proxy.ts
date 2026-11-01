import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import {
  PANEL_SESSION_COOKIE,
  verifyPanelSessionToken,
} from "@/lib/panel/session";

function isPublicApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/kroger") ||
    pathname === "/api/health"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isPublicApiPath(pathname)
  ) {
    return NextResponse.next();
  }

  let authenticated = false;
  const sessionKey = getEnv().WEB_PANEL_SESSION_KEY;
  if (sessionKey) {
    const token = request.cookies.get(PANEL_SESSION_COOKIE)?.value;
    authenticated = (await verifyPanelSessionToken(token, sessionKey)) != null;
  }

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/panel/meals", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/panel/meals", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
