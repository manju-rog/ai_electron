import React, { useEffect, useState, useRef } from 'react';
import { EditorMonaco } from './EditorMonaco';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

type SpecMeta = { name: string; ext: 'md'|'yaml'|'yml' };

function extractTasksJSON(text: string): any[] {
  // Find all ```json tasks blocks and merge them
  const re = /```json\s+tasks\s*([\s\S]*?)```/gi;
  const matches = [...text.matchAll(re)];
  
  if (matches.length === 0) return [];
  
  const allTasks: any[] = [];
  const seenIds = new Set<string>();
  
  for (const match of matches) {
    try {
      const arr = JSON.parse(match[1].trim());
      if (Array.isArray(arr)) {
        for (const task of arr) {
          const id = String(task.id || task.title || Math.random());
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allTasks.push({ ...task, id });
          }
        }
      }
    } catch {
      // Skip invalid JSON blocks
    }
  }
  
  return allTasks;
}

export const SpecsPanel: React.FC = () => {
  const [names, setNames] = useState<string[]>([]);
  const [meta, setMeta] = useState<SpecMeta>({ name: 'draft', ext: 'md' });
  const [buf, setBuf] = useState<string>('# Spec (draft)\n\nDescribe your system here.\n\n```mermaid\nflowchart TD\nA[Idea]-->B[Design]\nB-->C[Tasks]\n```\n\n```json tasks\n[]\n```');
  const [previewHTML, setPreviewHTML] = useState<string>('');
  const [splitPos, setSplitPos] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshList = async () => {
    const list = await window.kirobridge?.specsList?.();
    setNames(list ?? []);
  };

  useEffect(() => { 
    window.kirobridge?.kiroEnsure?.(); 
    refreshList(); 
  }, []);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    
    const renderMermaid = async () => {
      if (meta.ext !== 'md') {
        setPreviewHTML(''); // Skip rendering for non-markdown
        return;
      }
      
      let processedBuf = buf;
      const mermaidMatches = [...buf.matchAll(/```mermaid([\s\S]*?)```/g)];
      
      for (const match of mermaidMatches) {
        const id = 'mmd-' + Math.random().toString(36).slice(2);
        try {
          const result = await mermaid.render(id, match[1].trim());
          processedBuf = processedBuf.replace(match[0], result.svg);
        } catch (e: any) {
          const errorMsg = `<div style="background:#2d1b1b;border:1px solid #d73a49;padding:8px;border-radius:4px;color:#f85149;">
            <strong>Mermaid Syntax Error:</strong><br/>
            <code>${e?.message || 'Invalid diagram syntax'}</code>
          </div>`;
          processedBuf = processedBuf.replace(match[0], errorMsg);
        }
      }
      
      try {
        const html = md.render(processedBuf);
        setPreviewHTML(html);
      } catch (e: any) {
        setPreviewHTML(`<div style="color:#f85149;">Markdown Error: ${e?.message || 'Invalid markdown'}</div>`);
      }
    };
    
    renderMermaid();
  }, [buf, meta.ext]);

  // Handle mouse events for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const newPos = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(20, Math.min(80, newPos)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const openSpec = async (name: string) => {
    const file = await window.kirobridge?.specRead?.(name);
    if (file) {
      setMeta({ name: file.name, ext: file.ext as any });
      setBuf(file.content);
    }
  };

  const save = async () => {
    await window.kirobridge?.specWrite?.(meta.name, meta.ext, buf);
    await refreshList(); // Refresh dropdown immediately
  };

  const exportMD = async () => {
    await window.kirobridge?.specExportMarkdown?.(meta.name, buf);
  };

  const exportPDF = async () => {
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <style>
        body{ font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; color:#111; padding:24px; }
        pre, code { background:#f6f8fa; }
        .page-title{ font-size: 20px; margin-bottom: 12px; font-weight: 700; }
      </style></head><body>
      <div class="page-title">${meta.name}</div>${previewHTML}
      </body></html>`;
    await window.kirobridge?.specExportPDF?.(meta.name, html);
  };

  const approve = async () => {
    const tasks = extractTasksJSON(buf);
    
    if (tasks.length === 0) {
      alert('No tasks found. Add a ```json tasks block with task array to approve.');
      return;
    }
    
    const processedTasks = tasks.map((t: any, i: number) => ({
      id: String(t.id ?? `T${i+1}`), 
      title: String(t.title ?? `Task ${i+1}`), 
      description: String(t.description ?? ''),
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : []
    }));
    
    try {
      await window.kirobridge?.tasksWrite?.(JSON.stringify(processedTasks, null, 2));
      const scaffoldResult = await window.kirobridge?.jestScaffoldForTasks?.(processedTasks);
      
      alert(`✅ Approved Successfully!\n\n` +
            `📋 ${processedTasks.length} tasks → .kiro/tasks.json\n` +
            `🧪 ${scaffoldResult?.count || processedTasks.length} test stubs → tests/tasks/\n\n` +
            `Ready for development!`);
    } catch (e: any) {
      alert(`❌ Approval failed: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '8px 12px',
        borderBottom: '1px solid #333',
        flexShrink: 0,
        background: 'var(--panel)'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select 
            value={meta.name} 
            onChange={e => openSpec(e.target.value)}
            style={{ 
              padding: '4px 6px', 
              fontSize: '11px',
              background: '#0b0f14',
              border: '1px solid #444',
              color: 'var(--text)',
              borderRadius: '3px'
            }}
          >
            <option value="draft">draft (unsaved)</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          
          <input
            value={meta.name}
            onChange={e => setMeta(m => ({...m, name: e.target.value.replace(/[^\w\-]/g,'-') || 'draft'}))}
            style={{ 
              width: 100, 
              padding: '4px 6px', 
              fontSize: '11px',
              background: '#0b0f14',
              border: '1px solid #444',
              color: 'var(--text)',
              borderRadius: '3px'
            }}
          />
          
          <select 
            value={meta.ext} 
            onChange={e => setMeta(m => ({...m, ext: e.target.value as any}))}
            style={{ 
              padding: '4px 6px', 
              fontSize: '11px',
              background: '#0b0f14',
              border: '1px solid #444',
              color: 'var(--text)',
              borderRadius: '3px'
            }}
          >
            <option value="md">.md</option>
            <option value="yaml">.yaml</option>
            <option value="yml">.yml</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={save} style={{ padding: '4px 8px', fontSize: '11px', background: '#0969da', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Save</button>
          <button onClick={exportMD} style={{ padding: '4px 8px', fontSize: '11px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Export MD</button>
          <button onClick={exportPDF} style={{ padding: '4px 8px', fontSize: '11px', background: '#d1242f', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Export PDF</button>
          <button onClick={approve} style={{ padding: '4px 8px', fontSize: '11px', background: '#238636', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
        </div>
      </div>

      {/* Resizable Editor/Preview */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          display: 'flex',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Editor */}
        <div style={{ 
          width: `${splitPos}%`,
          height: '100%',
          overflow: 'hidden'
        }}>
          <EditorMonaco 
            value={buf} 
            onChange={setBuf} 
            language={meta.ext === 'md' ? 'markdown' : 'yaml'} 
          />
        </div>

        {/* Resizer */}
        <div
          style={{
            width: '4px',
            background: '#333',
            cursor: 'col-resize',
            position: 'relative',
            flexShrink: 0
          }}
          onMouseDown={() => setIsDragging(true)}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px',
            height: '20px',
            background: '#666',
            borderRadius: '1px'
          }} />
        </div>

        {/* Preview */}
        <div style={{ 
          width: `${100 - splitPos}%`,
          height: '100%',
          background: '#0b0f14',
          overflow: 'auto',
          padding: '12px'
        }}>
          {meta.ext !== 'md' && (
            <div style={{ 
              color: '#888', 
              fontSize: '11px', 
              marginBottom: '8px',
              fontStyle: 'italic'
            }}>
              YAML Preview: Raw text (switch to .md for rendered preview)
            </div>
          )}
          <div 
            dangerouslySetInnerHTML={{ __html: meta.ext === 'md' ? previewHTML : `<pre>${buf}</pre>` }}
            style={{ 
              color: '#e6edf3',
              fontSize: '13px',
              lineHeight: '1.5'
            }}
          />
        </div>
      </div>
    </div>
  );
};