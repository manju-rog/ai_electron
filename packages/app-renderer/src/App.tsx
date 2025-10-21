import React, { useEffect, useState } from 'react';
import { LayoutShell } from './ui/LayoutShell';
import { EditorStub } from './ui/EditorStub';

const App: React.FC = () => {
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch('http://127.0.0.1:4455/health');
        setServerOk(r.ok);
      } catch { setServerOk(false); }
    };
    ping();
  }, []);

  return (
    <LayoutShell
      center={
        <div style={{ height:'100%' }}>
          <EditorStub />
          <div style={{ padding:8, fontSize:12, color: serverOk ? '#3fb950' : '#f85149', background:'var(--panel)', borderTop:'1px solid #222' }}>
            {serverOk === null ? 'Checking server…' : serverOk ? 'Local server OK' : 'Local server not reachable'}
          </div>
        </div>
      }
    />
  );
};

export default App;
