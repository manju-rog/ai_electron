import React, { useEffect, useState } from 'react';
import { EditorMonaco } from './EditorMonaco';

type StagedItem = { file: string; rel: string };

export const DiffsPanel: React.FC = () => {
  const [items, setItems] = useState<StagedItem[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [original, setOriginal] = useState('');
  const [proposed, setProposed] = useState('');
  const [explain, setExplain] = useState('');
  const [agentEnabled, setAgentEnabled] = useState(false);

  const refresh = async () => {
    const list = await window.kirobridge?.stagingList?.();
    setItems(list || []);
    if (list && list.length && !sel) setSel(list[0].rel);
  };

  useEffect(() => {
    refresh();
    window.kirobridge?.onAgentEvent?.((_e: any, payload: any) => {
      if (payload?.type === 'staged') refresh();
    });
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!sel) return;
      const data = await window.kirobridge?.stagingRead?.(sel);
      setOriginal(data?.original ?? '');
      setProposed(data?.proposed ?? '');
      setExplain(data?.explanation ?? '');
    };
    run();
  }, [sel]);

  const enableAgent = async () => {
    const result = await window.kirobridge?.agentEnable?.();
    if (result?.ok) {
      setAgentEnabled(true);
    }
  };

  const disableAgent = async () => {
    await window.kirobridge?.agentDisable?.();
    setAgentEnabled(false);
  };

  const accept = async () => {
    if (!sel) return;
    await window.kirobridge?.stagingAccept?.(sel);
    await refresh(); 
    setSel(null); 
    setOriginal(''); 
    setProposed(''); 
    setExplain('');
  };

  const reject = async () => {
    if (!sel) return;
    await window.kirobridge?.stagingReject?.(sel);
    await refresh(); 
    setSel(null); 
    setOriginal(''); 
    setProposed(''); 
    setExplain('');
  };

  const getLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'yaml': case 'yml': return 'yaml';
      default: return 'plaintext';
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '8px 12px',
        borderBottom: '1px solid #333',
        flexShrink: 0,
        background: 'var(--panel)'
      }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button 
            onClick={enableAgent}
            disabled={agentEnabled}
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px',
              background: agentEnabled ? '#238636' : '#0969da',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: agentEnabled ? 'not-allowed' : 'pointer'
            }}
          >
            {agentEnabled ? 'Agent Enabled' : 'Enable Agent'}
          </button>
          <button 
            onClick={disableAgent}
            disabled={!agentEnabled}
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px',
              background: '#d1242f',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: !agentEnabled ? 'not-allowed' : 'pointer'
            }}
          >
            Disable
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {items.length} staged change{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <div style={{ 
          width: '240px',
          borderRight: '1px solid #333', 
          overflow: 'auto',
          flexShrink: 0
        }}>
          <div style={{ padding: '8px', color: 'var(--muted)', fontSize: '11px', fontWeight: 600 }}>
            Staged Changes
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '12px' }}>
              No staged changes
              <br />
              <span style={{ fontSize: '11px' }}>
                Save a file to trigger agent
              </span>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map(it => (
                <li key={it.rel}>
                  <button
                    onClick={() => setSel(it.rel)}
                    style={{
                      width: '100%', 
                      textAlign: 'left', 
                      padding: '6px 12px',
                      background: sel === it.rel ? '#1f6feb44' : 'transparent',
                      color: 'var(--text)', 
                      border: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderLeft: sel === it.rel ? '2px solid #1f6feb' : '2px solid transparent'
                    }}
                  >
                    {it.rel}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff View */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {sel ? (
            <>
              {/* File Header */}
              <div style={{ 
                padding: '6px 12px', 
                background: 'var(--panel)', 
                borderBottom: '1px solid #333',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {sel}
              </div>

              {/* Diff Editor */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <EditorMonaco 
                  value={proposed} 
                  onChange={() => {}} 
                  language={getLanguage(sel)}
                  original={original} 
                  diff 
                />
              </div>

              {/* Footer */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '8px 12px',
                borderTop: '1px solid #333',
                background: 'var(--panel)',
                flexShrink: 0
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--muted)',
                  flex: 1,
                  marginRight: '12px'
                }}>
                  {explain || 'No explanation provided'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    onClick={reject} 
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px',
                      background: '#d1242f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                  <button 
                    onClick={accept} 
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px',
                      background: '#238636', 
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: '13px'
            }}>
              {items.length > 0 ? 'Select a change to review' : 'No changes to review'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};