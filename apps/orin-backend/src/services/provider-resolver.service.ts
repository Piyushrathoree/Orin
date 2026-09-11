import { decryptSecret, loadEncryptionKey } from '@orin/auth/secrets';
import { prisma, AiProvider } from '@orin/db';
import { config } from '../config/environment';
import { ResolvedProvider } from './ai.service';

export class NoProviderConfiguredError extends Error {}

export const DEFAULT_MODELS: Partial<Record<AiProvider, string>> = {
    [AiProvider.OPENAI]: 'gpt-4o-mini',
    [AiProvider.ANTHROPIC]: 'claude-opus-5',
    [AiProvider.GEMINI]: 'gemini-2.5-flash',
    [AiProvider.GROQ]: 'openai/gpt-oss-120b',
    [AiProvider.LOCAL]: 'qwen3:8b',
};

/**
 * The provider a user's requests go to: their explicit choice, or the only
 * configured provider when they have exactly one. Shared by chat and settings
 * so the "Default" badge always matches what the chat actually uses.
 */
export function pickDefaultProvider(
  explicitDefault: AiProvider | null | undefined,
  configured: AiProvider[],
): AiProvider | null {
  if (explicitDefault && configured.includes(explicitDefault)) return explicitDefault;
  return configured.length === 1 ? configured[0] : null;
}

export function effectiveModel(provider: AiProvider, model: string | null | undefined): string | null {
  return model || DEFAULT_MODELS[provider] || null;
}

export async function resolveUserProvider(userId: string): Promise<ResolvedProvider> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { providerKeys: true },
  });

  const configuredProviders = user?.providerKeys
    .map((key) => key.provider)
    .filter((provider) => config.allowLocalModel || provider !== AiProvider.LOCAL) ?? [];
  const defaultProvider = pickDefaultProvider(
    user?.defaultProvider,
    configuredProviders,
  );
  const row = defaultProvider
    ? user?.providerKeys.find((key) => key.provider === defaultProvider)
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
    model: effectiveModel(row.provider, row.model) ?? undefined,
  };
}
