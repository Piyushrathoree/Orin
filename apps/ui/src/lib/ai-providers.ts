export type ProviderKey = "OPENAI" | "ANTHROPIC" | "GEMINI" | "GROQ" | "OPENROUTER" | "LOCAL";

/** One row of `GET /api/orin/settings/providers`. */
export type ProviderState = {
  provider: ProviderKey;
  configured: boolean;
  keyHint: string | null;
  baseUrl: string | null;
  /** The user's own override, if any. */
  model: string | null;
  /** The model the backend falls back to when there is no override. */
  defaultModel: string | null;
  /** What requests actually use: `model ?? defaultModel`. Null until configured. */
  effectiveModel: string | null;
  isDefault: boolean;
};

export type ProviderMeta = {
  label: string;
  description: string;
  needsKey: boolean;
  keyRequired: boolean;
  modelRequired: boolean;
  modelPlaceholder: string;
  baseUrlPlaceholder?: string;
};

export const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  OPENAI: {
    label: "OpenAI",
    description: "GPT models via api.openai.com.",
    needsKey: true,
    keyRequired: true,
    modelRequired: false,
    modelPlaceholder: "gpt-4o-mini",
  },
  ANTHROPIC: {
    label: "Anthropic (Claude)",
    description: "Claude models via the Anthropic API.",
    needsKey: true,
    keyRequired: true,
    modelRequired: false,
    modelPlaceholder: "claude-opus-5",
  },
  GEMINI: {
    label: "Google Gemini",
    description: "Gemini models via Google's Generative Language API.",
    needsKey: true,
    keyRequired: true,
    modelRequired: false,
    modelPlaceholder: "gemini-2.5-flash",
  },
  GROQ: {
    label: "Groq",
    description: "Fast open-weight models hosted on Groq.",
    needsKey: true,
    keyRequired: true,
    modelRequired: false,
    modelPlaceholder: "openai/gpt-oss-120b",
  },
  OPENROUTER: {
    label: "OpenRouter",
    description: "Route to any model OpenRouter supports.",
    needsKey: true,
    keyRequired: true,
    modelRequired: true,
    modelPlaceholder: "openai/gpt-4o-mini",
  },
  LOCAL: {
    label: "Local LLM",
    description: "Point at your own OpenAI-compatible server (e.g. Ollama).",
    needsKey: false,
    keyRequired: false,
    modelRequired: false,
    modelPlaceholder: "qwen3:8b",
    baseUrlPlaceholder: "http://127.0.0.1:11434/v1",
  },
};

export const PROVIDER_ORDER: ProviderKey[] = ["OPENAI", "ANTHROPIC", "GEMINI", "GROQ", "OPENROUTER", "LOCAL"];

/** The provider + model the chat will actually call, or null when nothing is configured. */
export type ActiveModel = {
  provider: ProviderKey;
  providerLabel: string;
  model: string;
};

export function getActiveModel(providers: ProviderState[]): ActiveModel | null {
  const row = providers.find((entry) => entry.isDefault && entry.configured);
  if (!row) return null;
  const model = row.effectiveModel ?? row.model ?? row.defaultModel;
  if (!model) return null;
  return { provider: row.provider, providerLabel: PROVIDER_META[row.provider].label, model };
}

export async function fetchProviderSettings(): Promise<ProviderState[]> {
  const response = await fetch("/api/orin/settings/providers", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not load provider settings");
  return data.providers as ProviderState[];
}
