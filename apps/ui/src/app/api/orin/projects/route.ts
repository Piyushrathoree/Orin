import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

async function backendJson(response: Response) {
  return response.json().catch(() => ({ error: "Orin backend returned an invalid response" }));
}

export async function GET(request: Request) {
  const response = await fetch(`${getOrinBackendUrl()}/projects`, {
    headers: orinBackendHeaders(request),
    cache: "no-store",
  });
  return NextResponse.json(await backendJson(response), { status: response.status });
}

export async function POST(request: Request) {
  const response = await fetch(`${getOrinBackendUrl()}/projects`, {
    method: "POST",
    headers: orinBackendHeaders(request),
    body: JSON.stringify(await request.json()),
    cache: "no-store",
  });
  return NextResponse.json(await backendJson(response), { status: response.status });
}
