import { AUTH_COOKIE_NAME } from "@orin/auth";

export const getOrinBackendUrl = () =>
  process.env.ORIN_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:3030";

function cookieValue(header: string | null, name: string) {
  for (const item of header?.split(";") ?? []) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}

export function orinBackendHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.Authorization = authorization;
  } else {
    const token = cookieValue(request.headers.get("cookie"), AUTH_COOKIE_NAME);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
