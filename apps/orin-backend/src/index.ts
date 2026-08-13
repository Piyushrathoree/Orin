import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import templateRoutes from './routes/template';
import chatRoutes from './routes/chat';
import { config } from './config/environment';

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'Orin API', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'orin-backend',
    environment: config.nodeEnv,
    aiProvider: 'groq',
    aiConfigured: Boolean(config.groqApiKey),
  });
});

app.use('/template', templateRoutes);
app.use('/chat', chatRoutes);

app.listen(config.port, () => {
  console.log(`Orin API running on http://localhost:${config.port}`);
});
