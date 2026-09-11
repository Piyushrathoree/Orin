import { DEFAULT_JWT_SECRET } from "@orin/auth";

const parsedPort = Number.parseInt(process.env.PORT ?? '3030', 10);
const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
const smtpSecureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
const aiProvider = configuredProvider === 'gemini' || configuredProvider === 'openrouter'
  ? configuredProvider
  : configuredProvider === 'local' || nodeEnv !== 'production'
    ? 'local'
    : null;

if (nodeEnv === 'production' && aiProvider === 'local') {
  throw new Error(
    'AI_PROVIDER=local is not supported in production. Remove it and use user-supplied provider keys.',
  );
}

const smtpConfigured = Boolean(
  process.env.SMTP_HOST?.trim()
  && process.env.SMTP_USER?.trim()
  && process.env.SMTP_PASS?.trim()
  && process.env.SMTP_FROM?.trim(),
);

if (nodeEnv === 'production' && !smtpConfigured) {
  throw new Error(
    'SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM are required in production for auth emails.',
  );
}

export const config = {
  port: Number.isFinite(parsedPort) ? parsedPort : 3030,
  smtpHost: process.env.SMTP_HOST?.trim(),
  smtpPort: Number.isFinite(smtpPort) ? smtpPort : 587,
  smtpUser: process.env.SMTP_USER?.trim(),
  smtpPass: process.env.SMTP_PASS?.trim(),
  smtpFrom: process.env.SMTP_FROM?.trim(),
  smtpSecure: smtpSecureSetting ? smtpSecureSetting === 'true' : smtpPort === 465,
  smtpConfigured,
  aiProvider,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  openrouterApiKey: process.env.OPENROUTER_API_KEY?.trim(),
  openrouterModel: process.env.OPENROUTER_MODEL?.trim(),
  localBaseUrl: process.env.LOCAL_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1',
  localApiKey: process.env.LOCAL_API_KEY?.trim() || 'ollama',
  localModel: process.env.LOCAL_MODEL?.trim() || 'qwen3:8b',
  frontendUrl: process.env.FRONTEND_URL?.trim() || 'http://localhost:3001',
  backendUrl: process.env.BACKEND_URL?.trim() || `http://localhost:${Number.isFinite(parsedPort) ? parsedPort : 3030}`,
  jwtSecret:
    process.env.JWT_SECRET?.trim() ||
    DEFAULT_JWT_SECRET,
  secretsEncryptionKey: process.env.SECRETS_ENCRYPTION_KEY?.trim(),
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim(),
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  githubClientId: process.env.GITHUB_CLIENT_ID?.trim(),
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET?.trim(),
  nodeEnv,
  allowLocalModel: nodeEnv !== 'production',
};
