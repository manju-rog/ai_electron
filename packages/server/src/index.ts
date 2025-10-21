import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('tiny'));

const PORT = parseInt(process.env.PORT || '4455', 10);

app.get('/health', (_req, res) => res.json({ ok: true, name: 'KiroClone Server', phase: 1 }));

app.post('/chat', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  return res.json({ reply: `Spec/agent pipeline not wired yet. You said: ${prompt}` });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[KiroClone] server listening at http://127.0.0.1:${PORT}`);
});
