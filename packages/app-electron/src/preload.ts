const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kirobridge', {
  pingServer: () => ipcRenderer.invoke('ping-server'),

  // Workspace
  openFolder: () => ipcRenderer.invoke('workspace-open'),                     // returns {root: string} | null
  readDirTree: () => ipcRenderer.invoke('workspace-read-tree'),               // returns FileEntry[]
  readFileByPath: (relPath: string) => ipcRenderer.invoke('workspace-read', relPath) as Promise<{ path: string; content: string } | null>,
  writeFileByPath: (relPath: string, content: string) => ipcRenderer.invoke('workspace-write', relPath, content) as Promise<{ path: string } | null>,

  // Single-file dialogs from Phase-2 (still useful)
  fileOpen: () => ipcRenderer.invoke('file-open'),
  fileSaveAs: (content: string) => ipcRenderer.invoke('file-save-as', content),
});
