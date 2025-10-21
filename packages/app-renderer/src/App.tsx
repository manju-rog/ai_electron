import React, { useEffect, useState } from 'react';
import { LayoutShell } from './ui/LayoutShell';
import { EditorMonaco } from './ui/EditorMonaco';

declare global {
  interface Window {
    kirobridge?: {
      pingServer: () => Promise<{ ok: boolean }>;
      fileOpen: () => Promise<{ path: string; content: string } | null>;
      fileSaveAs: (content: string) => Promise<{ path: string } | null>;
    };
  }
}

const App: React.FC = () => {
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<string>(
`// KiroClone Phase 2
// Monaco is live. Use "Open" to load a file, "Save As" to write a new copy.
`);

  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch('http://127.0.0.1:4455/health');
        setServerOk(r.ok);
      } catch { setServerOk(false); }
    };
    ping();
  }, []);

  const openFile = async () => {
    console.log('openFile clicked, kirobridge:', window.kirobridge);
    if (!window.kirobridge?.fileOpen) {
      console.error('kirobridge.fileOpen not available');
      return;
    }
    try {
      const res = await window.kirobridge.fileOpen();
      console.log('fileOpen result:', res);
      if (res) {
        setCurrentPath(res.path);
        setBuffer(res.content);
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const saveAs = async () => {
    console.log('saveAs clicked, kirobridge:', window.kirobridge);
    if (!window.kirobridge?.fileSaveAs) {
      console.error('kirobridge.fileSaveAs not available');
      return;
    }
    try {
      const res = await window.kirobridge.fileSaveAs(buffer);
      console.log('fileSaveAs result:', res);
      if (res) setCurrentPath(res.path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  return (
    <LayoutShell
      center={
        <div style={{ height: '100%', display:'grid', gridTemplateRows:'40px 1fr 28px' }}>
          <div style={{ padding:'6px 10px', background:'var(--panel)', borderBottom:'1px solid #222', display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={openFile}>Open</button>
            <button onClick={saveAs}>Save As</button>
            <div style={{ color:'var(--muted)', marginLeft:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {currentPath ?? 'Untitled'}
            </div>
          </div>
          <div>
            <EditorMonaco value={buffer} onChange={setBuffer} language="typescript" />
          </div>
          <div style={{ padding:'4px 8px', fontSize:12, color: serverOk ? '#3fb950' : '#f85149', background:'var(--panel)', borderTop:'1px solid #222' }}>
            {serverOk === null ? 'Checking server…' : serverOk ? 'Local server OK' : 'Local server not reachable'}
          </div>
        </div>
      }
    />
  );
};

export default App;
