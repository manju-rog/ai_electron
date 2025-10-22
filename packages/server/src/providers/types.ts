export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequest = {
  provider: 'anthropic' | 'openai' | 'gemini' | 'grok' | 'auto' | 'mock';
  model: string;         // e.g., 'claude-3.5-sonnet', 'gpt-4o', 'gpt-5'
  messages: ChatMessage[];
  maxTokens?: number;
};

export type ChatResponse = {
  provider: string;
  model: string;
  content: string;
  usage?: Record<string, unknown>;
  warn?: string;
};

export interface ChatProvider {
  id: string;
  supports(model: string): boolean;
  available(): boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
}