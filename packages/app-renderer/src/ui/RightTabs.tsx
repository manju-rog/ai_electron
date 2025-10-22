import React, { useState } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { SpecsPanel } from './SpecsPanel';
import { DiffsPanel } from './DiffsPanel';
import { ContextPanel } from './ContextPanel';
import { AutopilotPanel } from './AutopilotPanel';

export const RightTabs: React.FC = () => {
  const [tab, setTab] = useState<'chat'|'specs'|'diffs'|'context'|'autopilot'>('chat');
  
  const tabBtn = (k:'chat'|'specs'|'diffs'|'context'|'autopilot', label:string) =>
    <button 
      onClick={() => setTab(k)} 
      style={{ 
        padding:'6px 12px', 
        fontWeight: tab===k ? 600 : 400,
        background: tab===k ? 'var(--panel)' : 'transparent',
        border: 'none',
        color: tab===k ? 'var(--text)' : 'var(--muted)',
        cursor: 'pointer',
        fontSize: '13px',
        borderRadius: '4px 4px 0 0'
      }}
    >
      {label}
    </button>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #333',
        background: 'var(--panel)',
        flexShrink: 0
      }}>
        {tabBtn('chat','Chat')}
        {tabBtn('specs','Specs')}
        {tabBtn('diffs','Diffs')}
        {tabBtn('context','Context')}
        {tabBtn('autopilot','Autopilot')}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'autopilot' ? <AutopilotPanel /> :
         tab === 'context' ? <ContextPanel /> : 
         tab === 'diffs' ? <DiffsPanel /> : 
         tab === 'specs' ? <SpecsPanel /> : 
         <ChatSidebar />}
      </div>
    </div>
  );
};