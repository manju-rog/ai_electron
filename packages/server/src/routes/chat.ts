import { Router } from 'express';
import { z } from 'zod';
import { resolveProvider } from '../providers';
import type { ChatRequest } from '../providers/types';

const ChatSchema = z.object({
  provider: z.enum(['anthropic','openai','gemini','grok','auto','mock']).default('auto'),
  model: z.string().default('claude-3.5-sonnet'),
  messages: z.array(z.object({
    role: z.enum(['system','user','assistant']),
    content: z.string()
  })),
  maxTokens: z.number().int().positive().optional()
});

export const chatRouter = Router();

chatRouter.post('/', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const reqObj = parsed.data as ChatRequest;
  const provider = resolveProvider(reqObj);

  try {
    const out = await provider.chat(reqObj);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'chat_failed', provider: provider.id });
  }
});