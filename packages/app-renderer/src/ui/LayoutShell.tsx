import React from 'react';

const Sidebar: React.FC = () => (
  <div style={{ width: 260, background: "var(--panel)", borderRight: "1px solid #222", display:"flex", flexDirection:"column" }}>
    <div style={{ padding: 12, fontWeight: 700 }}>KiroClone</div>
    <div style={{ padding: "8px 12px", color: "var(--muted)" }}>Specs (coming soon)</div>
    <div style={{ padding: "8px 12px", color: "var(--muted)" }}>Tasks (coming soon)</div>
    <div style={{ padding: "8px 12px", color: "var(--muted)" }}>Chat (coming soon)</div>
  </div>
);

const Topbar: React.FC = () => (
  <div style={{ height: 40, background: "var(--panel)", borderBottom: "1px solid #222", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px" }}>
    <div>Project: <strong>Untitled</strong></div>
    <div style={{ color: "var(--muted)", fontSize: 12 }}>Phase 1 Shell</div>
  </div>
);

const Rightbar: React.FC = () => (
  <div style={{ width: 320, background: "var(--panel)", borderLeft: "1px solid #222", padding: 12 }}>
    <div style={{ fontWeight: 700, marginBottom: 8 }}>Console</div>
    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, color: "var(--muted)" }}>
      • Local server: http://127.0.0.1:4455<br/>• Claude/OpenAI: not configured yet<br/>• Hooks/Agents: coming next
    </div>
  </div>
);

export const LayoutShell: React.FC<{ center: React.ReactNode }> = ({ center }) => (
  <div style={{ display:"grid", gridTemplateColumns:"260px 1fr 320px", gridTemplateRows:"40px 1fr", height:"100vh" }}>
    <div style={{ gridColumn:"1 / 4" }}><Topbar /></div>
    <div><Sidebar /></div>
    <div>{center}</div>
    <div><Rightbar /></div>
  </div>
);
