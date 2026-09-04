import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS } from "@orin/auth/constants";
import { getOrinBackendUrl } from "@/lib/orin-api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function backendUrl(path: string) {
  return `${getOrinBackendUrl()}/auth/${path}`;
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_TOKEN_TTL_SECONDS,
  });
}

async function readBackendResponse(response: Response) {
  return response.json().catch(() => ({ error: "Authentication service returned an invalid response" }));
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const path = (await params).path.join("/");

  if (path === "google" || path === "github") {
    return NextResponse.redirect(backendUrl(path));
  }

  if (path === "callback") {
    const callbackUrl = new URL(request.url);
    const error = callbackUrl.searchParams.get("error");
    if (error) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("error", error);
      return NextResponse.redirect(signInUrl);
    }

    const code = callbackUrl.searchParams.get("code") || "";
    if (!code) return NextResponse.redirect(new URL("/sign-in?error=OAuth%20sign-in%20failed", request.url));

    const response = await fetch(backendUrl("exchange"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    const payload = await readBackendResponse(response);
    if (!response.ok || typeof payload.token !== "string") {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("error", payload.error || "OAuth sign-in failed");
      return NextResponse.redirect(signInUrl);
    }

    const redirect = NextResponse.redirect(new URL("/main", request.url));
    setSessionCookie(redirect, payload.token);
    return redirect;
  }

  if (path === "me") {
    const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const token = request.headers.get("authorization")
      || (cookieToken ? `Bearer ${cookieToken}` : "");
    const response = await fetch(backendUrl("me"), {
      headers: token ? { authorization: token } : undefined,
      cache: "no-store",
    });
    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const path = (await params).path.join("/");

  if (path === "logout") {
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (path !== "register" && path !== "login" && path !== "exchange") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = await fetch(backendUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await request.json()),
    cache: "no-store",
  });
  const payload = await readBackendResponse(response);
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const result = NextResponse.json(
    payload.user ? { user: payload.user } : { ok: true },
    { status: response.status },
  );
  if (typeof payload.token === "string") setSessionCookie(result, payload.token);
  return result;
}
