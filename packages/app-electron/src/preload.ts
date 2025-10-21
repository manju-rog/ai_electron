import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('kirobridge', {
  pingServer: () => ipcRenderer.invoke('ping-server')
});
