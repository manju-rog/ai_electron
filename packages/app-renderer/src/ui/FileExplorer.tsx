import React from 'react';
import type { FileEntry } from '@kiroclone/shared/src/types';

type Props = {
  tree: FileEntry[];
  onOpen: (relPath: string) => void;
};

const Node: React.FC<{ n: FileEntry; onOpen: (p: string) => void; level: number }> = ({ n, onOpen, level }) => {
  const pad = { paddingLeft: 8 + level * 12 };
  if (n.type === 'dir') {
    return (
      <div>
        <div style={{ ...pad, color: 'var(--muted)', fontWeight: 700 }}>{n.name}</div>
        <div>
          {n.children?.map((c) => <Node key={c.path} n={c} onOpen={onOpen} level={level + 1} />)}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...pad, cursor: 'pointer' }} onClick={() => onOpen(n.path)} title={n.path}>
      {n.name}
    </div>
  );
};

export const FileExplorer: React.FC<Props> = ({ tree, onOpen }) => {
  return (
    <div style={{ fontSize: 13, userSelect: 'none' }}>
      {tree.map((n) => <Node key={n.path} n={n} onOpen={onOpen} level={0} />)}
    </div>
  );
};