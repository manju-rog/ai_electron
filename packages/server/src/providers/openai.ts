import OpenAI from 'openai';
import { ChatProvider, ChatRequest, ChatResponse } from './types';

const MAP: Record<string, string> = {
  'gpt-5': 'gpt-4o', // alias until a real gpt-5 exists
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini'
};

export class OpenAIProvider implements ChatProvider {
  id = 'openai';
  private client?: OpenAI;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (key) this.client = new OpenAI({ apiKey: key });
  }

  available() { return !!this.client; }

  supports(model: string) {
    const m = MAP[model] ?? model;
    return /^gpt/i.test(m);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.client) {
      return { provider: this.id, model: req.model, content: '(no OPENAI_API_KEY set)', warn: 'provider_unavailable' };
    }
    const model = MAP[req.model] ?? req.model;
    const resp = await this.client.chat.completions.create({
      model,
      max_tokens: req.maxTokens ?? 2048,
      messages: req.messages.map(m => ({ role: m.role, content: m.content }))
    });
    const choice = resp.choices?.[0]?.message?.content ?? '';
    return { provider: this.id, model, content: choice, usage: resp.usage as any };
  }
}