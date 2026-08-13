import { config } from '../config/environment';
import { AIMessage } from '../types';

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function callGroq(messages: AIMessage[], maxTokens: number): Promise<string> {
  if (messages.length === 0) {
    throw new Error('At least one message is required.');
  }

  if (!config.groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages,
      max_completion_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as GroqResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Groq request failed with status ${response.status}.`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq returned an empty response.');
  }

  return content;
}
