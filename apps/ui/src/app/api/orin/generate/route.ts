import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

export const maxDuration = 180;

const PROXY_TIMEOUT_MS = 180_000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const backendUrl = getOrinBackendUrl();
    const headers = orinBackendHeaders(request);
    const templateResponse = await fetch(`${backendUrl}/template`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const template = await templateResponse.json().catch(() => ({
      error: "Orin backend returned an invalid template response",
    }));
    if (!templateResponse.ok) {
      return NextResponse.json(template, { status: templateResponse.status });
    }

    const templatePrompts = Array.isArray(template.prompts)
      ? template.prompts.filter(
          (item: unknown): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];

    const chatResponse = await fetch(`${backendUrl}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [...templatePrompts, prompt].map((content) => ({
          role: "user",
          content,
        })),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const chat = await chatResponse.json().catch(() => ({
      error: "Orin backend returned an invalid chat response",
    }));
    return NextResponse.json(
      { ...chat, template },
      { status: chatResponse.status },
    );
  } catch (error) {
    console.error("[Orin UI] Generation proxy failed:", error);
    return NextResponse.json(
      { error: "Orin backend is unavailable" },
      { status: 502 },
    );
  }
}
