import { Router, type Request } from "express";
import { encryptSecret, loadEncryptionKey } from "@orin/auth/secrets";
import { AiProvider, prisma } from "@orin/db";
import { config } from "../config/environment";
import type { ErrorResponse } from "../types";

const router = Router();

const ALL_PROVIDERS: AiProvider[] = [
  AiProvider.OPENAI,
  AiProvider.ANTHROPIC,
  AiProvider.GEMINI,
  AiProvider.GROQ,
  AiProvider.OPENROUTER,
  AiProvider.LOCAL,
];

function userIdFromRequest(req: Request) {
  return req.user?.id ?? null;
}

function isValidProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (ALL_PROVIDERS as string[]).includes(value);
}

function keyHintFrom(rawKey: string): string {
  return rawKey.length > 4 ? `••••${rawKey.slice(-4)}` : "••••";
}

router.get("/providers", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  try {
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { defaultProvider: true } }),
      prisma.userProviderKey.findMany({ where: { userId } }),
    ]);

    const byProvider = new Map(rows.map((row) => [row.provider, row]));

    const providers = ALL_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        configured: Boolean(row),
        keyHint: row?.keyHint ?? null,
        baseUrl: row?.baseUrl ?? null,
        model: row?.model ?? null,
        isDefault: user?.defaultProvider === provider,
      };
    });

    res.json({ providers });
  } catch (error) {
    console.error("[Orin API] Provider settings list failed:", error);
    res.status(500).json({ error: "Could not load provider settings" } satisfies ErrorResponse);
  }
});

router.put("/providers/:provider", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  const { provider } = req.params;
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: "Unknown provider" } satisfies ErrorResponse);
    return;
  }

  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : undefined;
  const baseUrlInput = typeof req.body?.baseUrl === "string" ? req.body.baseUrl.trim() : undefined;
  const model = typeof req.body?.model === "string" ? req.body.model.trim() : undefined;
  const setAsDefault = req.body?.setAsDefault === true;

  if (baseUrlInput) {
    try {
      new URL(baseUrlInput);
    } catch {
      res.status(400).json({ error: "baseUrl must be a valid URL" } satisfies ErrorResponse);
      return;
    }
  }

  try {
    const existing = await prisma.userProviderKey.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!existing) {
      if (provider !== AiProvider.LOCAL && !apiKey) {
        res.status(400).json({ error: "apiKey is required" } satisfies ErrorResponse);
        return;
      }
      if (provider === AiProvider.OPENROUTER && !model) {
        res.status(400).json({ error: "model is required for OpenRouter" } satisfies ErrorResponse);
        return;
      }
    }

    let encryptedKey = existing?.encryptedKey ?? null;
    let keyHint = existing?.keyHint ?? null;
    if (apiKey) {
      encryptedKey = encryptSecret(apiKey, loadEncryptionKey(config.secretsEncryptionKey));
      keyHint = keyHintFrom(apiKey);
    }

    const row = await prisma.userProviderKey.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        encryptedKey,
        keyHint,
        baseUrl: baseUrlInput ?? null,
        model: model ?? null,
      },
      update: {
        encryptedKey,
        keyHint,
        ...(baseUrlInput !== undefined ? { baseUrl: baseUrlInput } : {}),
        ...(model !== undefined ? { model } : {}),
      },
    });

    if (setAsDefault) {
      await prisma.user.update({ where: { id: userId }, data: { defaultProvider: provider } });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { defaultProvider: true } });

    res.json({
      provider: row.provider,
      configured: true,
      keyHint: row.keyHint,
      baseUrl: row.baseUrl,
      model: row.model,
      isDefault: user?.defaultProvider === provider,
    });
  } catch (error) {
    console.error("[Orin API] Provider settings save failed:", error);
    res.status(500).json({ error: "Could not save provider settings" } satisfies ErrorResponse);
  }
});

router.delete("/providers/:provider", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  const { provider } = req.params;
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: "Unknown provider" } satisfies ErrorResponse);
    return;
  }

  try {
    // Sequential rather than an interactive $transaction: Neon's serverless HTTP
    // driver adapter can't hold a transaction open across round trips.
    await prisma.userProviderKey.deleteMany({ where: { userId, provider } });
    await prisma.user.updateMany({
      where: { id: userId, defaultProvider: provider },
      data: { defaultProvider: null },
    });
    res.status(204).end();
  } catch (error) {
    console.error("[Orin API] Provider settings deletion failed:", error);
    res.status(500).json({ error: "Could not delete provider settings" } satisfies ErrorResponse);
  }
});

router.put("/default", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  const { provider } = req.body ?? {};
  if (!isValidProvider(provider)) {
    res.status(400).json({ error: "Unknown provider" } satisfies ErrorResponse);
    return;
  }

  try {
    const existing = await prisma.userProviderKey.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!existing) {
      res.status(400).json({ error: "Configure this provider before setting it as default" } satisfies ErrorResponse);
      return;
    }

    await prisma.user.update({ where: { id: userId }, data: { defaultProvider: provider } });
    res.json({ provider });
  } catch (error) {
    console.error("[Orin API] Setting default provider failed:", error);
    res.status(500).json({ error: "Could not set default provider" } satisfies ErrorResponse);
  }
});

export default router;
