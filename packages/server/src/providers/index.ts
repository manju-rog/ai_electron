import { ChatProvider, ChatRequest } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider, GrokProvider, MockProvider } from './stubs';

const providers: ChatProvider[] = [
  new AnthropicProvider(),
  new OpenAIProvider(),
  new GeminiProvider(),
  new GrokProvider(),
  new MockProvider()
];

export function resolveProvider(req: ChatRequest): ChatProvider {
  if (req.provider && req.provider !== 'auto') {
    const p = providers.find(p => p.id === req.provider);
    return p ?? new MockProvider();
  }
  const preferred = ['anthropic','openai','gemini','grok'];
  for (const id of preferred) {
    const p = providers.find(p => p.id === id);
    if (p && p.available() && p.supports(req.model)) return p;
  }
  return providers.find(p => p.available()) ?? new MockProvider();
}