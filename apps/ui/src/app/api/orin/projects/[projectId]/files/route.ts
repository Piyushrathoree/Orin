import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

type RouteContext = { params: Promise<{ projectId: string }> };

async function backendJson(response: Response) {
  return response.json().catch(() => ({ error: "Orin backend returned an invalid response" }));
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const response = await fetch(
    `${getOrinBackendUrl()}/projects/${encodeURIComponent(projectId)}/files`,
    {
      method: "PUT",
      headers: orinBackendHeaders(request),
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    },
  );
  return NextResponse.json(await backendJson(response), { status: response.status });
}
