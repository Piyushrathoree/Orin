import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = await fetch(`${getOrinBackendUrl()}/auth/ws-ticket`, {
    method: "POST",
    headers: orinBackendHeaders(request),
    cache: "no-store",
  });
  const payload = await response
    .json()
    .catch(() => ({ error: "Orin backend returned an invalid response" }));
  return NextResponse.json(payload, { status: response.status });
}
