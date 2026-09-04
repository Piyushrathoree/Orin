import { randomBytes } from "node:crypto";
import { Router, type Response as ExpressResponse } from "express";
import { hashPassword, verifyPassword, createToken } from "@orin/auth";
import { prisma } from "@orin/db";
import { config } from "../config/environment";
import { requireAuth } from "../middleware/require-auth";

const router = Router();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_CODE_TTL_MS = 60 * 1000;

type OAuthProvider = "google" | "github";
type OAuthState = { provider: OAuthProvider; expiresAt: number };
type OAuthCode = { token: string; expiresAt: number };

const oauthStates = new Map<string, OAuthState>();
const oauthCodes = new Map<string, OAuthCode>();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email: string) {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readQuery(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sessionUser(user: { id: string; email: string }) {
  return { id: user.id, email: user.email };
}

async function respondWithSession(
  res: ExpressResponse,
  user: { id: string; email: string },
) {
  const currentUser = sessionUser(user);
  const token = await createToken(currentUser, config.jwtSecret);
  res.json({ token, user: currentUser });
}

function oauthConfig(provider: OAuthProvider) {
  return provider === "google"
    ? {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      }
    : {
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
      };
}

function callbackUrl(provider: OAuthProvider) {
  return `${config.backendUrl}/auth/${provider}/callback`;
}

function frontendCallback(res: ExpressResponse, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  res.redirect(`${config.frontendUrl}/api/auth/callback?${query}`);
}

function removeExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of oauthStates) {
    if (value.expiresAt <= now) oauthStates.delete(key);
  }
  for (const [key, value] of oauthCodes) {
    if (value.expiresAt <= now) oauthCodes.delete(key);
  }
}

function newState(provider: OAuthProvider) {
  removeExpiredEntries();
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
  return state;
}

function consumeState(value: string, provider: OAuthProvider) {
  const state = oauthStates.get(value);
  oauthStates.delete(value);
  return state?.provider === provider && state.expiresAt > Date.now();
}

function storeOAuthToken(token: string) {
  removeExpiredEntries();
  const code = randomBytes(24).toString("hex");
  oauthCodes.set(code, { token, expiresAt: Date.now() + OAUTH_CODE_TTL_MS });
  return code;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

async function createOAuthUrl(provider: OAuthProvider) {
  const providerConfig = oauthConfig(provider);
  if (!providerConfig.clientId || !providerConfig.clientSecret) {
    throw new Error(`${provider} OAuth is not configured`);
  }

  const state = newState(provider);
  const params = new URLSearchParams({
    client_id: providerConfig.clientId,
    redirect_uri: callbackUrl(provider),
    response_type: "code",
    state,
    scope: provider === "google" ? "openid email profile" : "read:user user:email",
  });

  return provider === "google"
    ? `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    : `https://github.com/login/oauth/authorize?${params}`;
}

async function exchangeGoogleCode(code: string) {
  const providerConfig = oauthConfig("google");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: providerConfig.clientId || "",
      client_secret: providerConfig.clientSecret || "",
      redirect_uri: callbackUrl("google"),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const token = await readJson<{ access_token?: string; error_description?: string }>(response);
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || "Google OAuth token exchange failed");
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const user = await readJson<{ sub?: string; email?: string; email_verified?: boolean }>(userResponse);
  if (!userResponse.ok || !user.sub || !user.email || user.email_verified === false) {
    throw new Error("Google did not return a verified email");
  }

  return { providerAccountId: user.sub, email: normalizeEmail(user.email) };
}

async function exchangeGithubCode(code: string) {
  const providerConfig = oauthConfig("github");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: callbackUrl("github"),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const token = await readJson<{ access_token?: string; error_description?: string }>(tokenResponse);
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token.error_description || "GitHub OAuth token exchange failed");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.access_token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const userResponse = await fetch("https://api.github.com/user", {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  const user = await readJson<{ id?: number; email?: string | null }>(userResponse);
  if (!userResponse.ok || typeof user.id !== "number") {
    throw new Error("GitHub user lookup failed");
  }

  let email = normalizeEmail(user.email);
  if (!email) {
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const emails = await readJson<Array<{ email?: string; primary?: boolean; verified?: boolean }>>(emailResponse);
    email = normalizeEmail(
      emails.find((item) => item.primary && item.verified)?.email
        || emails.find((item) => item.verified)?.email,
    );
  }
  if (!email) throw new Error("GitHub did not return an email address");

  return { providerAccountId: String(user.id), email };
}

async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  providerAccountId: string,
  email: string,
) {
  const account = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
  if (account) return account.user;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.oAuthAccount.create({
      data: { provider, providerAccountId, userId: existingUser.id },
    });
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email,
      oauthAccounts: { create: { provider, providerAccountId } },
    },
  });
}

router.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!validEmail(email) || password.length < 8 || password.length > 200) {
    res.status(400).json({ error: "Enter a valid email and a password of at least 8 characters" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists" });
      return;
    }
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password) },
    });
    await respondWithSession(res, user);
  } catch (error) {
    console.error("[Orin API] Registration failed:", error);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!validEmail(email) || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    await respondWithSession(res, user);
  } catch (error) {
    console.error("[Orin API] Login failed:", error);
    res.status(500).json({ error: "Could not sign in" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/exchange", (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const entry = oauthCodes.get(code);
  oauthCodes.delete(code);
  if (!entry || entry.expiresAt <= Date.now()) {
    res.status(400).json({ error: "OAuth callback has expired" });
    return;
  }
  res.json({ token: entry.token });
});

for (const provider of ["google", "github"] as const) {
  router.get(`/${provider}`, async (_req, res) => {
    try {
      res.redirect(await createOAuthUrl(provider));
    } catch (error) {
      frontendCallback(res, { error: error instanceof Error ? error.message : "OAuth is not configured" });
    }
  });

  router.get(`/${provider}/callback`, async (req, res) => {
    const state = readQuery(req.query.state);
    const code = readQuery(req.query.code);
    if (!state || !code || !consumeState(state, provider)) {
      frontendCallback(res, { error: "Invalid OAuth callback" });
      return;
    }

    try {
      const profile = provider === "google"
        ? await exchangeGoogleCode(code)
        : await exchangeGithubCode(code);
      const user = await findOrCreateOAuthUser(provider, profile.providerAccountId, profile.email);
      const token = await createToken(sessionUser(user), config.jwtSecret);
      frontendCallback(res, { code: storeOAuthToken(token) });
    } catch (error) {
      console.error(`[Orin API] ${provider} OAuth failed:`, error);
      frontendCallback(res, { error: "OAuth sign-in failed" });
    }
  });
}

export default router;
