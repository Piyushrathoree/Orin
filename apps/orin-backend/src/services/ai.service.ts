import { AiProvider } from '@orin/db';
import { config } from '../config/environment';
import { AIMessage } from '../types';

export type ResolvedProvider = {
  provider: AiProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: {
    message?: string;
  };
};

function validateMessages(messages: AIMessage[]) {
  if (messages.length === 0) {
    throw new Error('At least one message is required.');
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();

  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

async function callGemini(
  { apiKey, model }: { apiKey?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  validateMessages(messages);

  if (!apiKey) {
    throw new Error('A Gemini API key is required.');
  }

  const resolvedModel = model || 'gemini-2.5-flash';
  const systemMessage = messages.find((message) => message.role === 'system')?.content;
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        ...(systemMessage
          ? { systemInstruction: { parts: [{ text: systemMessage }] } }
          : {}),
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  const payload = await readJson<GeminiResponse>(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message
        || payload.promptFeedback?.blockReason
        || `Gemini request failed with status ${response.status}.`,
    );
  }

  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!content) {
    throw new Error(
      payload.promptFeedback?.blockReason
        || payload.candidates?.[0]?.finishReason
        || 'Gemini returned an empty response.',
    );
  }

  return content;
}

async function callAnthropic(
  { apiKey, model }: { apiKey?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  validateMessages(messages);

  if (!apiKey) {
    throw new Error('An Anthropic API key is required.');
  }

  const systemMessage = messages.find((message) => message.role === 'system')?.content;
  const anthropicMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-opus-5',
      max_tokens: maxTokens,
      ...(systemMessage ? { system: systemMessage } : {}),
      messages: anthropicMessages,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await readJson<AnthropicResponse>(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Anthropic request failed with status ${response.status}.`,
    );
  }

  const content = payload.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim();

  if (!content) {
    throw new Error('Anthropic returned an empty response.');
  }

  return content;
}

async function callOpenAICompatible(
  { baseUrl, apiKey, model, extraHeaders }: {
    baseUrl: string;
    apiKey?: string;
    model?: string;
    extraHeaders?: Record<string, string>;
  },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  validateMessages(messages);

  if (!model) {
    throw new Error('A model is required.');
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await readJson<OpenAICompatibleResponse>(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Request to ${baseUrl} failed with status ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`${baseUrl} returned an empty response.`);
  }

  return content;
}

function callOpenAI(
  { apiKey, model }: { apiKey?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  if (!apiKey) {
    throw new Error('An OpenAI API key is required.');
  }
  return callOpenAICompatible(
    { baseUrl: 'https://api.openai.com/v1', apiKey, model: model || 'gpt-4o-mini' },
    messages,
    maxTokens,
  );
}

function callGroq(
  { apiKey, model }: { apiKey?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  if (!apiKey) {
    throw new Error('A Groq API key is required.');
  }
  return callOpenAICompatible(
    { baseUrl: 'https://api.groq.com/openai/v1', apiKey, model: model || 'llama-3.3-70b-versatile' },
    messages,
    maxTokens,
  );
}

function callOpenRouter(
  { apiKey, model }: { apiKey?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  if (!apiKey || !model) {
    throw new Error('An OpenRouter API key and model are required.');
  }
  return callOpenAICompatible(
    {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey,
      model,
      extraHeaders: {
        'HTTP-Referer': config.frontendUrl,
        'X-Title': 'Orin',
      },
    },
    messages,
    maxTokens,
  );
}

function callLocal(
  { apiKey, baseUrl, model }: { apiKey?: string; baseUrl?: string; model?: string },
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  return callOpenAICompatible(
    {
      baseUrl: baseUrl || 'http://127.0.0.1:11434/v1',
      apiKey: apiKey || 'ollama',
      model: model || 'qwen3:8b',
    },
    messages,
    maxTokens,
  );
}

export function callAI(
  resolved: ResolvedProvider,
  messages: AIMessage[],
  maxTokens: number,
): Promise<string> {
  switch (resolved.provider) {
    case AiProvider.OPENAI:
      return callOpenAI(resolved, messages, maxTokens);
    case AiProvider.ANTHROPIC:
      return callAnthropic(resolved, messages, maxTokens);
    case AiProvider.GEMINI:
      return callGemini(resolved, messages, maxTokens);
    case AiProvider.GROQ:
      return callGroq(resolved, messages, maxTokens);
    case AiProvider.OPENROUTER:
      return callOpenRouter(resolved, messages, maxTokens);
    case AiProvider.LOCAL:
    default:
      return callLocal(resolved, messages, maxTokens);
  }
}
