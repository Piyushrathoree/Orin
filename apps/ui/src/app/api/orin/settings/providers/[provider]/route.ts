import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

type RouteContext = { params: Promise<{ provider: string }> };

async function backendJson(response: Response) {
  return response.json().catch(() => ({ error: "Orin backend returned an invalid response" }));
}

async function providerUrl(params: RouteContext["params"]) {
  const { provider } = await params;
  return `${getOrinBackendUrl()}/settings/providers/${encodeURIComponent(provider)}`;
}

export async function PUT(request: Request, { params }: RouteContext) {
  const response = await fetch(await providerUrl(params), {
    method: "PUT",
    headers: orinBackendHeaders(request),
    body: JSON.stringify(await request.json()),
    cache: "no-store",
  });
  return NextResponse.json(await backendJson(response), { status: response.status });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const response = await fetch(await providerUrl(params), {
    method: "DELETE",
    headers: orinBackendHeaders(request),
    cache: "no-store",
  });
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await backendJson(response), { status: response.status });
}
