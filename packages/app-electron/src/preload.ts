const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

contextBridge.exposeInMainWorld('kirobridge', {
  pingServer: () => ipcRenderer.invoke('ping-server'),
  fileOpen: async () => {
    console.log('fileOpen called from renderer');
    return ipcRenderer.invoke('file-open');
  },
  fileSaveAs: async (content: string) => {
    console.log('fileSaveAs called from renderer');
    return ipcRenderer.invoke('file-save-as', content);
  }
});

console.log('Preload script loaded, kirobridge exposed');
