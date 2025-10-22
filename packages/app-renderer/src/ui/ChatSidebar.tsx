import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { push, setBusy, setError, clear, type Msg } from '../store/chatSlice';
import { setProvider, setModel, setAutopilot } from '../store/settingsSlice';

const modelsByProvider: Record<string, string[]> = {
  auto: ['claude-3.5-sonnet','gpt-4o','gpt-5','claude-sonnet-4'],
  anthropic: ['claude-3.5-sonnet','claude-sonnet-4'],
  openai: ['gpt-4o','gpt-4o-mini','gpt-5'],
  mock: ['mock-echo']
};

export const ChatSidebar: React.FC = () => {
  const dispatch = useDispatch();
  const chat = useSelector((s: RootState) => s.chat);
  const settings = useSelector((s: RootState) => s.settings);
  const { messages, busy, error } = chat;
  const { provider, model, autopilot } = settings;
  const [input, setInput] = useState('');

  const send = async () => {
    if (!input.trim() || busy) return;
    dispatch(push({ role: 'user', content: input }));
    dispatch(setBusy(true));
    dispatch(setError(undefined));
    setInput('');

    try {
      const res = await fetch('http://127.0.0.1:4455/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages: [{ role:'user', content: input }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'chat_failed');
      dispatch(push({ role: 'assistant', content: data.content || '' }));
    } catch (e: any) {
      dispatch(setError(e?.message ?? 'chat_failed'));
    } finally {
      dispatch(setBusy(false));
    }
  };

  const genSpec = async () => {
    if (!input.trim() || busy) return;
    dispatch(setBusy(true)); dispatch(setError(undefined));
    try {
      const res = await fetch('http://127.0.0.1:4455/generate/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, prompt: input })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'spec_failed');
      dispatch(push({ role: 'assistant', content: data.content || '' }));
    } catch (e: any) {
      dispatch(setError(e?.message ?? 'spec_failed'));
    } finally {
      dispatch(setBusy(false));
    }
  };

  const modelOptions = modelsByProvider[provider] ?? ['claude-3.5-sonnet'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>Chat</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
            <input 
              type="checkbox" 
              checked={autopilot} 
              onChange={e => dispatch(setAutopilot(e.target.checked))}
              style={{ marginRight: '4px' }}
            />
            Autopilot
          </label>
        </div>
      </div>

      {/* Provider and Model selectors */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom: '12px' }}>
        <select 
          value={provider} 
          onChange={e => dispatch(setProvider(e.target.value as any))}
          style={{ 
            padding: '6px 8px', 
            background: 'var(--panel)', 
            border: '1px solid #333', 
            color: 'var(--text)',
            fontSize: '12px'
          }}
        >
          <option value="auto">Auto</option>
          <option value="anthropic">Claude</option>
          <option value="openai">OpenAI</option>
          <option value="mock">Mock</option>
        </select>
        <select 
          value={model} 
          onChange={e => dispatch(setModel(e.target.value))}
          style={{ 
            padding: '6px 8px', 
            background: 'var(--panel)', 
            border: '1px solid #333', 
            color: 'var(--text)',
            fontSize: '12px'
          }}
        >
          {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Messages area */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: '#0b0f14', 
        border: '1px solid #333', 
        padding: '12px',
        marginBottom: '12px',
        borderRadius: '4px'
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Type a request and hit Send, or use "Gen Spec".
          </div>
        )}
        {messages.map((m: Msg, i: number) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#888', 
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 500
            }}>
              {m.role}
            </div>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              margin: 0, 
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              {m.content}
            </pre>
          </div>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div style={{ 
          color: '#f85149', 
          fontSize: '12px', 
          marginBottom: '8px',
          padding: '6px 8px',
          background: 'rgba(248, 81, 73, 0.1)',
          border: '1px solid rgba(248, 81, 73, 0.3)',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {/* Input and buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null)}
          placeholder="Ask anything…"
          disabled={busy}
          style={{ 
            flex: 1, 
            padding: '8px 10px', 
            background: 'var(--panel)', 
            border: '1px solid #333', 
            color: 'var(--text)',
            fontSize: '13px',
            borderRadius: '4px'
          }}
        />
        <button 
          onClick={send} 
          disabled={busy || !input.trim()}
          style={{
            padding: '8px 12px',
            background: busy ? '#333' : '#0969da',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          {busy ? '...' : 'Send'}
        </button>
        <button 
          onClick={genSpec} 
          disabled={busy || !input.trim()}
          style={{
            padding: '8px 12px',
            background: busy ? '#333' : '#238636',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          Gen Spec
        </button>
      </div>

      {/* Clear button */}
      {messages.length > 0 && (
        <button 
          onClick={() => dispatch(clear())}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid #333',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          Clear Chat
        </button>
      )}
    </div>
  );
};