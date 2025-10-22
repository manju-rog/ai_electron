import { ChatProvider, ChatRequest, ChatResponse } from './types';

export class MockProvider implements ChatProvider {
  id = 'mock';
  available() { return true; }
  supports(_m: string) { return true; }
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const last = req.messages.filter(m => m.role !== 'system').at(-1)?.content ?? '';
    return { provider: 'mock', model: req.model, content: `[MOCK] ${last}` };
  }
}

// Future SDK hookups — currently behave like Mock to keep UI working
export class GeminiProvider extends MockProvider { id = 'gemini'; }
export class GrokProvider extends MockProvider { id = 'grok'; }