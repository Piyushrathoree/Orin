import { NextResponse } from "next/server";
import { getOrinBackendUrl } from "@/lib/orin-api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const backendUrl = getOrinBackendUrl();
    const templateResponse = await fetch(`${backendUrl}/template`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      cache: "no-store",
    });

    const template = await templateResponse.json();
    if (!templateResponse.ok) {
      return NextResponse.json(template, { status: templateResponse.status });
    }

    const chatResponse = await fetch(`${backendUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          ...(Array.isArray(template.prompts) ? template.prompts : []),
          prompt,
        ].map((content) => ({ role: "user", content })),
      }),
      cache: "no-store",
    });

    const chat = await chatResponse.json();
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

