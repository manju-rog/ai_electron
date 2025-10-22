import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat';
import { specRouter } from './routes/spec';
import { agentRouter } from './routes/agent';

export function createApp() {
  dotenv.config();
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: ['http://localhost:5173','http://localhost:5174'] }));
  app.use(express.json({ limit: '15mb' }));
  app.use(morgan('tiny'));

  app.get('/health', (_req, res) => res.json({ ok: true, name: 'KiroClone Server', phase: 4 }));

  app.use('/chat', chatRouter);
  app.use('/generate/spec', specRouter);
  app.use('/agent', agentRouter);

  return app;
}