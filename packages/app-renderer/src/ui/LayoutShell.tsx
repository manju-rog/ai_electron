import React from 'react';

export const LayoutShell: React.FC<{ left: React.ReactNode; center: React.ReactNode; right?: React.ReactNode }> = ({ left, center, right }) => (
  <div style={{ display:'grid', gridTemplateColumns:'260px 1fr 320px', gridTemplateRows:'40px 1fr', height:'100vh' }}>
    <div style={{ gridColumn:'1 / 4', height:40, background:'var(--panel)', borderBottom:'1px solid #222', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px' }}>
      <div>Project: <strong>Untitled</strong></div>
      <div style={{ color:'var(--muted)', fontSize:12 }}>Phase 3</div>
    </div>
    <div style={{ width:260, background:'var(--panel)', borderRight:'1px solid #222', overflow:'auto' }}>{left}</div>
    <div>{center}</div>
    <div style={{ width:320, background:'var(--panel)', borderLeft:'1px solid #222', padding:12 }}>{right}</div>
  </div>
);