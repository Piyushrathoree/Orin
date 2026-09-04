import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@orin/auth/constants";

export function middleware(req: NextRequest) {
  const protectedPath =
    req.nextUrl.pathname === "/main" || req.nextUrl.pathname.startsWith("/room");
  if (protectedPath && !req.cookies.has(AUTH_COOKIE_NAME)) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
