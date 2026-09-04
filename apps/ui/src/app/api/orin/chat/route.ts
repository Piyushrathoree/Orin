import { NextResponse } from "next/server";
import { getOrinBackendUrl, orinBackendHeaders } from "@/lib/orin-api";

export const maxDuration = 180;

const PROXY_TIMEOUT_MS = 180_000;

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return null;

  const messages = value.flatMap((item): { role: "user" | "assistant" | "system"; content: string }[] => {
    if (!item || typeof item !== "object") return [];

    const message = item as IncomingMessage;
    const role =
      message.role === "assistant" || message.role === "system"
        ? message.role
        : "user";
    const content =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.parts)
          ? message.parts
              .map((part) => {
                if (!part || typeof part !== "object") return "";
                const text = (part as { text?: unknown }).text;
                return typeof text === "string" ? text : "";
              })
              .join("")
          : "";

    return content.trim() ? [{ role, content: content.trim() }] : [];
  });

  return messages.length > 0 ? messages : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: unknown;
      context?: unknown;
    };
    const messages = normalizeMessages(body.messages);

    if (!messages) {
      return NextResponse.json(
        { error: "At least one message is required" },
        { status: 400 },
      );
    }

    const contextualMessages =
      typeof body.context === "string" && body.context.trim()
        ? [
            { role: "user" as const, content: body.context.trim() },
            ...messages,
          ]
        : messages;

    const response = await fetch(`${getOrinBackendUrl()}/chat`, {
      method: "POST",
      headers: orinBackendHeaders(request),
      body: JSON.stringify({ messages: contextualMessages }),
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const payload = await response.json().catch(() => ({
      error: "Orin backend returned an invalid response",
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[Orin UI] Chat proxy failed:", error);
    return NextResponse.json(
      { error: "Orin backend is unavailable" },
      { status: 502 },
    );
  }
}
