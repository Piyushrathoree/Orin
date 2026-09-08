import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

type RouteContext = { params: Promise<{ projectId: string }> };

async function backendJson(response: Response) {
  return response.json().catch(() => ({ error: "Orin backend returned an invalid response" }));
}

async function projectUrl(params: RouteContext["params"]) {
  const { projectId } = await params;
  return `${getOrinBackendUrl()}/projects/${encodeURIComponent(projectId)}`;
}

export async function GET(request: Request, { params }: RouteContext) {
  const response = await fetch(await projectUrl(params), {
    headers: orinBackendHeaders(request),
    cache: "no-store",
  });
  return NextResponse.json(await backendJson(response), { status: response.status });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const response = await fetch(await projectUrl(params), {
    method: "DELETE",
    headers: orinBackendHeaders(request),
    cache: "no-store",
  });
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await backendJson(response), { status: response.status });
}
