import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import templateRoutes from './routes/template';
import chatRoutes from './routes/chat';
import { config } from './config/environment';
import { requireAuth } from './middleware/require-auth';

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'Orin API', status: 'ok' });
});

app.get('/health', (_req, res) => {
  const aiConfigured = config.aiProvider === 'gemini'
    ? Boolean(config.geminiApiKey)
    : Boolean(config.localBaseUrl && config.localModel);

  res.json({
    status: 'ok',
    service: 'orin-backend',
    environment: config.nodeEnv,
    aiProvider: config.aiProvider,
    aiConfigured,
  });
});

app.use('/template', requireAuth, templateRoutes);
app.use('/chat', requireAuth, chatRoutes);

app.listen(config.port, () => {
  console.log(`Orin API running on http://localhost:${config.port}`);
});
