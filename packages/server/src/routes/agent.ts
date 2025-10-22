import { Router } from 'express';
import { z } from 'zod';
import { resolveProvider } from '../providers';
import type { ChatRequest } from '../providers/types';
import { nanoid } from 'nanoid';

export const agentRouter = Router();

const Body = z.object({
  event: z.enum(['onSave','onCommit','onBuild']),
  provider: z.enum(['auto','anthropic','openai','mock']).default('auto'),
  model: z.string().default('claude-sonnet-4'),
  filePath: z.string(),
  fileContent: z.string(),
  hooksPrompt: z.string().optional(),
  steering: z.string().optional()
});

const SYS = `You are an expert software editor agent.
Given 1 file's content and a goal, propose concrete multi-line edits.

OUTPUT STRICTLY AS JSON:
{
  "patches": [
    {
      "file": "<relative path>",
      "mode": "replaceWhole",
      "newContent": "<full replacement of the file after your edits>",
      "explanation": "<what you changed and why>"
    }
  ]
}

Rules:
- If no changes needed, return {"patches": []}.
- Keep code formatting.
- Do not invent new files in Phase-6.
- Prefer adding JSDoc, small refactors, and unit-test stubs if requested.`;

agentRouter.post('/generate', async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { event, provider: pid, model, filePath, fileContent, hooksPrompt, steering } = parsed.data;

  const user = [
    `EVENT: ${event}`,
    steering ? `STEERING:\n${steering}` : null,
    hooksPrompt ? `GOAL:\n${hooksPrompt.replace('{file}', filePath)}` : 'GOAL:\nImprove quality (JSDoc/tests/refactor) where helpful.',
    `FILE PATH: ${filePath}`,
    `FILE CONTENT:\n\n\`\`\`\n${fileContent}\n\`\`\``,
    `Respond only with the JSON object described in the system message.`
  ].filter(Boolean).join('\n\n');

  const cr: ChatRequest = {
    provider: pid,
    model,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: user }
    ],
    maxTokens: 4096
  };

  try {
    const out = await resolveProvider(cr).chat(cr);
    const raw = (out.content || '').trim();

    // Safe parse with fallback
    let patches: any[] = [];
    try {
      const obj = JSON.parse(raw);
      if (obj && Array.isArray(obj.patches)) patches = obj.patches;
    } catch {
      // Fallback: if provider returned plain text, produce no-op to avoid unsafe writes
      patches = [];
    }

    // Sanitize shape
    const normalized = patches
      .filter(p => p && typeof p.file === 'string' && typeof p.newContent === 'string')
      .map(p => ({
        id: nanoid(8),
        file: String(p.file),
        mode: 'replaceWhole' as const,
        newContent: String(p.newContent),
        explanation: typeof p.explanation === 'string' ? p.explanation : undefined
      }));

    res.json({ patches: normalized, provider: out.provider, model: out.model });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'agent_failed' });
  }
});