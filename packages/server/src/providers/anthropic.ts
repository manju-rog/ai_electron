import Anthropic from '@anthropic-ai/sdk';
import { ChatProvider, ChatRequest, ChatResponse } from './types';

const MAP: Record<string, string> = {
  'claude-sonnet-4': 'claude-3-5-sonnet-20241022', // future alias
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3.5-sonnet-latest': 'claude-3-5-sonnet-20241022'
};

export class AnthropicProvider implements ChatProvider {
  id = 'anthropic';
  private client?: Anthropic;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) this.client = new Anthropic({ apiKey: key });
  }

  available() { return !!this.client; }

  supports(model: string) {
    const m = MAP[model] ?? model;
    return /^claude/i.test(m);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.client) {
      return { provider: this.id, model: req.model, content: '(no ANTHROPIC_API_KEY set)', warn: 'provider_unavailable' };
    }
    const model = MAP[req.model] ?? req.model;
    const sys = req.messages.find(m => m.role === 'system')?.content;
    const userTurns = req.messages.filter(m => m.role !== 'system');

    const msg = await this.client!.messages.create({
      model,
      max_tokens: req.maxTokens ?? 2048,
      system: sys,
      messages: userTurns.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    });

    const content = msg.content?.map(c => ('text' in c ? c.text : '')).join('\n') ?? '';
    return { provider: this.id, model, content, usage: { input: msg.usage?.input_tokens, output: msg.usage?.output_tokens } };
  }
}