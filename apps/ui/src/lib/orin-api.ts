export const getOrinBackendUrl = () =>
  process.env.ORIN_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:3030";

export function orinBackendHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.Authorization = authorization;
  }
  return headers;
}
