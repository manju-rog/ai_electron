import { Router } from 'express';
import { z } from 'zod';
import { resolveProvider } from '../providers';
import type { ChatRequest } from '../providers/types';

export const specRouter = Router();

const Body = z.object({
  prompt: z.string(),
  provider: z.enum(['anthropic','openai','auto','mock']).default('auto'),
  model: z.string().default('claude-3.5-sonnet'),
});

const SYS = `You are a senior architect.
Given an idea, output:
1) REQUIREMENTS (bullets)
2) SYSTEM DESIGN with a Mermaid diagram (fenced as \`\`\`mermaid ... \`\`\`)
3) TASKS as JSON: [{id,title,description,dependsOn[]}]. Keep it practical.`;

specRouter.post('/', async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { prompt, provider: pid, model } = parsed.data;
  const cr: ChatRequest = {
    provider: pid,
    model,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: prompt }
    ]
  };
  try {
    const out = await resolveProvider(cr).chat(cr);
    res.json({ ...out, kind: 'spec' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'spec_failed' });
  }
});