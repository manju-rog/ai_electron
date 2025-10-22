import Anthropic from '@anthropic-ai/sdk';
import { ChatProvider, ChatRequest, ChatResponse } from './types';

const MAP: Record<string, string> = {
  'claude-sonnet-4': 'claude-sonnet-4-20250514' // Actual Claude Sonnet 4 model
};

export class AnthropicProvider implements ChatProvider {
  id = 'anthropic';
  private client?: Anthropic;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
    if (key && key !== 'YOUR_API_KEY_HERE') {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  available() { return !!this.client; }

  supports(model: string) {
    return model === 'claude-sonnet-4';
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