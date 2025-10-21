import React from 'react';

export const EditorStub: React.FC = () => {
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"8px 12px", borderBottom:"1px solid #222", background:"var(--panel)" }}>
        <strong>Editor</strong> <span style={{ color:"var(--muted)" }}>(Monaco / VS Code OSS integration coming next)</span>
      </div>
      <textarea
        style={{
          flex:1, width:"100%", background:"#0b0f14", color:"var(--text)",
          border:"none", outline:"none", padding:12,
          fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        }}
        defaultValue={`// KiroClone Phase 1
// You're inside the renderer shell.
// Next: integrate VS Code OSS / Monaco, Chat, Specs, Tasks.`}
      />
    </div>
  );
};
