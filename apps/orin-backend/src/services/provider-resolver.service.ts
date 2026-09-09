import { decryptSecret, loadEncryptionKey } from '@orin/auth/secrets';
import { prisma, AiProvider } from '@orin/db';
import { config } from '../config/environment';
import { ResolvedProvider } from './ai.service';

export class NoProviderConfiguredError extends Error {}

const DEFAULT_MODELS: Partial<Record<AiProvider, string>> = {
  [AiProvider.OPENAI]: 'gpt-4o-mini',
  [AiProvider.ANTHROPIC]: 'claude-opus-5',
  [AiProvider.GEMINI]: 'gemini-2.5-flash',
  [AiProvider.GROQ]: 'llama-3.3-70b-versatile',
  [AiProvider.LOCAL]: 'qwen3:8b',
};

export async function resolveUserProvider(userId: string): Promise<ResolvedProvider> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { providerKeys: true },
  });

  const row = user?.defaultProvider
    ? user.providerKeys.find((key) => key.provider === user.defaultProvider)
    : undefined;

  if (!row) {
    throw new NoProviderConfiguredError();
  }

  const apiKey = row.encryptedKey
    ? decryptSecret(row.encryptedKey, loadEncryptionKey(config.secretsEncryptionKey))
    : undefined;

  return {
    provider: row.provider,
    apiKey,
    baseUrl: row.baseUrl ?? undefined,
    model: row.model ?? DEFAULT_MODELS[row.provider],
  };
}
