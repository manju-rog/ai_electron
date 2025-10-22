export type Health = { ok: boolean; name: string; phase: number };

export type FileEntry = {
  name: string;           // display name
  path: string;           // relative to workspace root
  type: 'file' | 'dir';
  children?: FileEntry[]; // for directories
};
