import { config } from '../config/environment';
import { AIMessage } from '../types';

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

async function callGemini(messages: AIMessage[], maxTokens: number): Promise<string> {
  validateMessages(messages);

  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const systemMessage = messages.find((message) => message.role === 'system')?.content;
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
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

async function callOpenRouter(messages: AIMessage[], maxTokens: number): Promise<string> {
  validateMessages(messages);

  if (!config.openrouterApiKey || !config.openrouterModel) {
    throw new Error('OPENROUTER_API_KEY and OPENROUTER_MODEL are required.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.frontendUrl,
      'X-Title': 'Orin',
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await readJson<OpenAICompatibleResponse>(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `OpenRouter request failed with status ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  return content;
}

async function callLocal(messages: AIMessage[], maxTokens: number): Promise<string> {
  validateMessages(messages);

  const response = await fetch(
    `${config.localBaseUrl.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.localApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.localModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  const payload = await readJson<OpenAICompatibleResponse>(response);
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Local model request failed with status ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Local model returned an empty response.');
  }

  return content;
}

export function callAI(messages: AIMessage[], maxTokens: number): Promise<string> {
  if (config.aiProvider === 'gemini') return callGemini(messages, maxTokens);
  if (config.aiProvider === 'openrouter') return callOpenRouter(messages, maxTokens);
  return callLocal(messages, maxTokens);
}
