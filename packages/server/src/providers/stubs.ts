import { ChatProvider, ChatRequest, ChatResponse } from './types';

export class MockProvider implements ChatProvider {
  id = 'mock';
  available() { return true; }
  supports(_m: string) { return true; }
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const sys = req.messages.find(m => m.role === 'system')?.content || '';
    const last = req.messages.filter(m => m.role !== 'system').at(-1)?.content ?? '';
    
    // Autopilot planning response
    if (/AUTOPILOT/i.test(sys) && /PLAN JSON/i.test(sys)) {
      const plan = {
        steps: [
          { 
            title: "Enhance example function", 
            rationale: "Improve clarity and types", 
            targetFiles: ["src/example.ts"] 
          },
          {
            title: "Add documentation",
            rationale: "Improve code maintainability",
            targetFiles: ["README.md"]
          }
        ]
      };
      return { provider: this.id, model: req.model, content: JSON.stringify(plan) };
    }
    
    // Autopilot patch response
    if (/patches/i.test(sys) && /Schema:\s*{\s*"patches"/i.test(sys)) {
      // Randomly choose between replaceWhole and hunks mode for testing
      const useHunks = Math.random() > 0.5;
      
      if (useHunks) {
        const patch = {
          patches: [{
            file: "src/example.ts",
            mode: "hunks",
            diff: `--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1 +1,7 @@\n-export function add(a,b){return a+b}\n+// Enhanced by Autopilot (Mock)\n+/**\n+ * Adds two numbers together\n+ * @param a First number\n+ * @param b Second number\n+ * @returns Sum of a and b\n+ */\n+export function add(a: number, b: number): number {\n+  return a + b;\n+}`,
            explanation: "Added JSDoc comments and explicit TypeScript types using unified diff."
          }]
        };
        return { provider: this.id, model: req.model, content: JSON.stringify(patch) };
      } else {
        const patch = {
          patches: [{
            file: "src/example.ts",
            mode: "replaceWhole",
            newContent: `// Enhanced by Autopilot (Mock)\n/**\n * Adds two numbers together\n * @param a First number\n * @param b Second number\n * @returns Sum of a and b\n */\nexport function add(a: number, b: number): number {\n  return a + b;\n}`,
            explanation: "Added JSDoc comments and explicit TypeScript types for better code clarity."
          }]
        };
        return { provider: this.id, model: req.model, content: JSON.stringify(patch) };
      }
    }
    
    // Default mock behavior
    return { provider: 'mock', model: req.model, content: `[MOCK] ${last}` };
  }
}

// Future SDK hookups — currently behave like Mock to keep UI working
export class GeminiProvider extends MockProvider { id = 'gemini'; }
export class GrokProvider extends MockProvider { id = 'grok'; }