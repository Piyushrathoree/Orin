import { DEFAULT_JWT_SECRET } from "@orin/auth";

const parsedPort = Number.parseInt(process.env.PORT ?? '3030', 10);
const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
const aiProvider = configuredProvider === 'gemini' || configuredProvider === 'openrouter'
  ? configuredProvider
  : 'local';

export const config = {
  port: Number.isFinite(parsedPort) ? parsedPort : 3030,
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
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim(),
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  githubClientId: process.env.GITHUB_CLIENT_ID?.trim(),
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET?.trim(),
  nodeEnv: process.env.NODE_ENV || 'development',
};
