import React, { useEffect, useState } from "react";

export const ContextPanel: React.FC = () => {
  const [root, setRoot] = useState<string>("");
  const [status, setStatus] = useState<{ok?:boolean; items?:number; model?:string; updatedAt?:string}>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ packed?:string }|null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await window.kirobridge?.workspaceRoot?.();
      if (r) { setRoot(r); refresh(r); }
    })();
  }, []);

  const refresh = async (r = root) => {
    if (!r) return;
    const u = new URL("http://127.0.0.1:4455/context/status");
    u.searchParams.set("root", r);
    const res = await fetch(u).then(r => r.json());
    setStatus(res);
  };

  const build = async () => {
    if (!root) return;
    setBusy(true);
    try {
      await fetch("http://127.0.0.1:4455/context/index", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ root })
      });
      await refresh();
    } catch (e) {
      console.error('Index build failed:', e);
    }
    setBusy(false);
  };

  const search = async () => {
    if (!root || !q) return;
    const u = new URL("http://127.0.0.1:4455/context/search");
    u.searchParams.set("root", root);
    u.searchParams.set("q", q);
    u.searchParams.set("k", "8");
    try {
      const res = await fetch(u).then(r => r.json());
      setResults(res);
    } catch (e) {
      console.error('Search failed:', e);
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
        background: 'var(--panel)', 
        borderBottom: '1px solid #333',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '12px', marginBottom: '6px' }}>
          <strong>Workspace:</strong> 
          <code style={{ fontSize: '11px', marginLeft: '6px' }}>
            {root || "(open a folder)"}
          </code>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
          Indexed: {status.items ?? 0} items • Model: {status.model ?? "-"} 
          {status.updatedAt && (
            <span> • {new Date(status.updatedAt).toLocaleString()}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            onClick={build} 
            disabled={!root || busy}
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px',
              background: busy ? '#666' : '#0969da',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: busy ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? "Indexing…" : "Build / Rebuild Index"}
          </button>
          <button 
            onClick={() => refresh()}
            style={{ 
              padding: '4px 8px', 
              fontSize: '11px',
              background: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        padding: '8px 12px', 
        background: 'var(--panel)', 
        borderBottom: '1px solid #333',
        flexShrink: 0
      }}>
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="Search codebase…" 
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ 
            flex: 1, 
            padding: '4px 6px', 
            fontSize: '12px',
            background: '#0b0f14',
            border: '1px solid #444',
            color: 'var(--text)',
            borderRadius: '3px'
          }} 
        />
        <button 
          onClick={search} 
          disabled={!q}
          style={{ 
            padding: '4px 8px', 
            fontSize: '11px',
            background: q ? '#238636' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: q ? 'pointer' : 'not-allowed'
          }}
        >
          Search
        </button>
      </div>

      {/* Results */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '12px',
        background: '#0b0f14'
      }}>
        {results?.packed ? (
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            fontSize: '12px',
            lineHeight: '1.4',
            color: '#e6edf3',
            margin: 0
          }}>
            {results.packed}
          </pre>
        ) : (
          <div style={{ 
            color: 'var(--muted)', 
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '40px'
          }}>
            {!root ? 'Open a workspace folder to get started' :
             !status.items ? 'Build the index first, then try a search query' :
             'No results yet. Try searching for functions, types, or concepts.'}
          </div>
        )}
      </div>
    </div>
  );
};