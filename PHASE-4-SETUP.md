# Phase-4: AI Integration Setup Guide

## Overview
Phase-4 adds complete AI integration to KiroClone with Claude Sonnet 4 as the primary provider, OpenAI as fallback, and a full chat interface with spec generation capabilities.

## What Was Implemented

### 🧠 AI Provider System
- **Anthropic Provider**: Claude Sonnet 4 integration (`claude-sonnet-4-20250514`)
- **OpenAI Provider**: GPT-4o and GPT-5 alias support
- **Mock Provider**: Fallback for testing without API keys
- **Gemini/Grok Stubs**: Ready for future integration

### 🔧 Server Architecture
- **Provider Registry**: Auto-selects best available provider
- **Chat Endpoint**: `/chat` for conversations
- **Spec Endpoint**: `/generate/spec` for requirements + Mermaid diagrams + tasks
- **Zod Validation**: Type-safe request/response handling
- **CORS Configuration**: Supports localhost:5173 and 5174

### 🖥️ Frontend Integration
- **Redux Store**: Settings and chat state management
- **ChatSidebar UI**: Provider/model picker, message history, Send/Gen Spec buttons
- **IPC Bridge**: Secure Electron ↔ Server communication
- **Real-time Status**: Server connection indicator

### 🔒 Security Implementation
- **IPC Communication**: Bypasses Electron sandbox restrictions
- **Server-side API Keys**: Never exposed to renderer process
- **Environment Variables**: Secure key management

## File Structure

```
packages/
├── server/src/
│   ├── providers/
│   │   ├── types.ts          # Provider interfaces
│   │   ├── anthropic.ts      # Claude integration
│   │   ├── openai.ts         # OpenAI integration
│   │   ├── stubs.ts          # Mock/future providers
│   │   └── index.ts          # Provider registry
│   ├── routes/
│   │   ├── chat.ts           # Chat endpoint
│   │   └── spec.ts           # Spec generation endpoint
│   └── app.ts                # Updated Express app
├── app-renderer/src/
│   ├── store/
│   │   ├── index.ts          # Redux store
│   │   ├── settingsSlice.ts  # Provider/model settings
│   │   └── chatSlice.ts      # Chat state
│   ├── ui/
│   │   └── ChatSidebar.tsx   # Main chat interface
│   ├── App.tsx               # Updated with IPC health check
│   └── main.tsx              # Redux Provider wrapper
└── app-electron/src/
    ├── main.ts               # IPC handlers for server communication
    └── preload.ts            # Exposed IPC methods
```

## Dependencies Added

### Server
```bash
pnpm add -F @kiroclone/server @anthropic-ai/sdk openai langchain zod sharp
pnpm add -D -F @kiroclone/server @types/sharp
```

### Renderer
```bash
pnpm add -F @kiroclone/app-renderer @reduxjs/toolkit react-redux
```

### Electron
```bash
pnpm add -F @kiroclone/app-electron node-fetch@2
```

## Setup Instructions

### 1. API Key Configuration

**For Local Development:**
1. Open `packages/server/src/providers/anthropic.ts`
2. Replace `'YOUR_API_KEY_HERE'` with your actual Claude API key:
   ```typescript
   const key = process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-your-actual-key-here';
   ```

**Alternative: Environment Variable (Recommended for production):**
1. Create `.env` file in project root:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
   OPENAI_API_KEY=sk-your-openai-key-here
   PORT=4455
   ```

### 2. Running the Application

**Terminal 1 - Server:**
```bash
cd "C:\Users\YourName\KiroClone"
pnpm --filter @kiroclone/server dev
```
Expected output: `[KiroClone] server listening at http://127.0.0.1:4455`

**Terminal 2 - Renderer:**
```bash
cd "C:\Users\YourName\KiroClone"
pnpm --filter @kiroclone/app-renderer dev
```
Expected output: `Local: http://localhost:5173/`

**Terminal 3 - Electron:**
```bash
cd "C:\Users\YourName\KiroClone\packages\app-electron"
../../node_modules/.bin/tsc ; ../../node_modules/.bin/electron .
```

### 3. Testing the Integration

1. **Server Health Check:**
   - Bottom status should show "Local server OK" in green
   - If red, restart the server terminal

2. **Chat Testing:**
   - Provider: "Claude" or "Auto"
   - Model: "claude-sonnet-4"
   - Type any message → Send
   - Should get real Claude response (not [MOCK])

3. **Spec Generation:**
   - Type: "Build a todo app spec"
   - Click "Gen Spec"
   - Should get requirements + Mermaid diagram + task list

## Model Configuration

### Available Models by Provider:
- **Auto**: `claude-sonnet-4`, `claude-3.5-sonnet`, `gpt-4o`, `gpt-5`
- **Claude**: `claude-sonnet-4`, `claude-3.5-sonnet`
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-5`
- **Mock**: `mock-echo`

### Model Aliases:
- `claude-sonnet-4` → `claude-sonnet-4-20250514` (actual Sonnet 4)
- `gpt-5` → `gpt-4o` (until real GPT-5 exists)

## Troubleshooting

### "Local server not reachable"
- Restart server terminal: `pnpm --filter @kiroclone/server dev`
- Check port 4455 is not blocked by firewall
- Verify server shows "listening at http://127.0.0.1:4455"

### "[MOCK]" responses instead of real AI
- Check API key is set correctly in `anthropic.ts`
- Restart server after changing API key
- Verify provider is set to "Claude" not "Mock"

### Electron compilation errors
- Run TypeScript compilation: `../../node_modules/.bin/tsc`
- Check for syntax errors in main.ts or preload.ts
- Restart Electron: `../../node_modules/.bin/electron .`

### Chat UI not responding
- Check browser console for errors
- Verify IPC bridge is working (server status green)
- Restart renderer terminal if needed

## Key Features

### 🎯 Chat Interface
- Real-time messaging with Claude Sonnet 4
- Provider/model selection dropdown
- Message history with user/assistant roles
- Error handling and loading states
- Clear chat functionality

### 📋 Spec Generation
- Generates structured requirements
- Creates Mermaid diagrams for system design
- Produces JSON task lists with dependencies
- One-click spec generation from prompts

### ⚙️ Settings Management
- Redux-powered state management
- Persistent provider/model preferences
- Autopilot toggle (ready for Phase-5)
- Real-time configuration updates

### 🔐 Security Features
- Server-side only API keys
- IPC-based communication (no direct HTTP from renderer)
- Sandbox-safe Electron configuration
- Environment variable support

## Next Steps (Phase-5 Preview)
- Specs panel with Markdown editor
- Mermaid diagram live preview
- Task management with .kiro/tasks.json
- Spec persistence to .kiro/specs/
- Jest test scaffolding from tasks

## Git Repository
All changes committed to: `https://github.com/manju-rog/ai_electron.git`

**Latest commit:** Phase-4 Complete: Working Claude Sonnet 4 integration with IPC bridge