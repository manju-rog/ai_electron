import React, { useEffect, useState } from 'react';
import { LayoutShell } from './ui/LayoutShell';
import { EditorMonaco } from './ui/EditorMonaco';
import { FileExplorer } from './ui/FileExplorer';
import { RightTabs } from './ui/RightTabs';
type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileEntry[];
};
import { detectEOL, normalizeTo } from './eol';

declare global {
  interface Window {
    kirobridge?: {
      pingServer: () => Promise<{ ok: boolean }>;
      chatRequest: (requestBody: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
      specRequest: (requestBody: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
      openFolder: () => Promise<{ root: string } | null>;
      readDirTree: () => Promise<FileEntry[]>;
      readFileByPath: (relPath: string) => Promise<{ path: string; content: string } | null>;
      writeFileByPath: (relPath: string, content: string) => Promise<{ path: string } | null>;
      fileSaveAs: (content: string) => Promise<{ path: string } | null>;
      // Phase 5: specs
      kiroEnsure: () => Promise<{ kiro: string; specs: string } | null>;
      specsList: () => Promise<string[]>;
      specRead: (name: string) => Promise<{name:string, ext:string, content:string}|null>;
      specWrite: (name: string, ext: 'md'|'yaml'|'yml', content: string) => Promise<{ path:string }>;
      specExportMarkdown: (name: string, content: string) => Promise<{ path:string }>;
      specExportPDF: (name: string, html: string) => Promise<{ path:string }>;
      tasksWrite: (json: string) => Promise<{ path:string, count:number }>;
      jestScaffoldForTasks: (tasks: {id:string,title:string,description?:string}[]) => Promise<any>;
      // Phase 6: agent hooks
      agentEnable: () => Promise<{ ok: boolean; error?: string }>;
      agentDisable: () => Promise<{ ok: boolean }>;
      stagingList: () => Promise<{file:string, rel:string}[]>;
      stagingRead: (rel: string) => Promise<{original:string, proposed:string, explanation?:string}>;
      stagingAccept: (rel: string) => Promise<{ ok: boolean; rel: string }>;
      stagingReject: (rel: string) => Promise<{ ok: boolean; rel: string }>;
      activityFeed: () => Promise<{time:string, message:string}[]>;
      onAgentEvent: (cb: (ev:any, payload:any) => void) => void;
      // Phase 7: context
      workspaceRoot: () => Promise<string | null>;
    };
  }
}

const App: React.FC = () => {
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<string>(`// KiroClone Phase 3\n// Open a folder to see files on the left.`);
  const [currentEOL, setCurrentEOL] = useState<'\n' | '\r\n'>('\n');

  useEffect(() => {
    (async () => {
      try {
        const result = await window.kirobridge?.pingServer?.();
        setServerOk(result?.ok || false);
      } catch { setServerOk(false); }
    })();
  }, []);

  const refreshTree = async () => {
    const t = await window.kirobridge?.readDirTree?.();
    setTree(t ?? []);
  };

  const openFolder = async () => {
    const res = await window.kirobridge?.openFolder?.();
    if (res) { await refreshTree(); }
  };

  const openRel = async (relPath: string) => {
    const res = await window.kirobridge?.readFileByPath?.(relPath);
    if (!res) return;
    setCurrentPath(res.path);
    setCurrentEOL(detectEOL(res.content));
    setBuffer(res.content);
  };

  const save = async () => {
    if (!currentPath) return;
    const content = normalizeTo(buffer, currentEOL);
    await window.kirobridge?.writeFileByPath?.(currentPath, content);
  };

  const saveAs = async () => {
    const res = await window.kirobridge?.fileSaveAs?.(buffer);
    if (res) setCurrentPath(res.path);
  };

  const left = (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:12, fontWeight:700 }}>KiroClone</div>
      <div style={{ padding:'0 12px 8px' }}>
        <button onClick={openFolder}>Open Folder</button>
      </div>
      <div style={{ padding:'0 8px', color:'var(--muted)' }}>Explorer</div>
      <div style={{ flex:1, overflow:'auto', padding:'8px' }}>
        <FileExplorer tree={tree} onOpen={openRel} />
      </div>
    </div>
  );

  const right = <RightTabs />;

  const center = (
    <div style={{ height:'100%', display:'grid', gridTemplateRows:'40px 1fr 28px' }}>
      <div style={{ padding:'6px 10px', background:'var(--panel)', borderBottom:'1px solid #222', display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={save} disabled={!currentPath}>Save</button>
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
  );

  return <LayoutShell left={left} center={center} right={right} />;
};

export default App;