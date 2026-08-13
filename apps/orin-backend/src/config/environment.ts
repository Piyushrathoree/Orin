const parsedPort = Number.parseInt(process.env.PORT ?? '3030', 10);

export const config = {
  port: Number.isFinite(parsedPort) ? parsedPort : 3030,
  groqApiKey: process.env.GROQ_API_KEY?.trim(),
  groqModel: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
  frontendUrl: process.env.FRONTEND_URL?.trim() || 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV || 'development',
};
