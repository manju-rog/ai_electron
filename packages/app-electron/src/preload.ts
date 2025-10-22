import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kirobridge', {
  // phase 2/3
  pingServer: () => ipcRenderer.invoke('ping-server'),
  chatRequest: (requestBody: any) => ipcRenderer.invoke('chat-request', requestBody),
  specRequest: (requestBody: any) => ipcRenderer.invoke('spec-request', requestBody),
  openFolder: () => ipcRenderer.invoke('workspace-open'),
  readDirTree: () => ipcRenderer.invoke('workspace-read-tree'),
  readFileByPath: (relPath: string) => ipcRenderer.invoke('workspace-read', relPath),
  writeFileByPath: (relPath: string, content: string) => ipcRenderer.invoke('workspace-write', relPath, content),
  fileOpen: () => ipcRenderer.invoke('file-open'),
  fileSaveAs: (content: string) => ipcRenderer.invoke('file-save-as', content),

  // phase 5: specs
  kiroEnsure: () => ipcRenderer.invoke('kiro-ensure-dirs'),                       // {root, specsDir}
  specsList: () => ipcRenderer.invoke('specs-list') as Promise<string[]>,         // names WITHOUT extension
  specRead: (name: string) => ipcRenderer.invoke('spec-read', name) as Promise<{name:string, ext:string, content:string}|null>,
  specWrite: (name: string, ext: 'md'|'yaml'|'yml', content: string) => ipcRenderer.invoke('spec-write', name, ext, content) as Promise<{ path:string }>,
  specExportMarkdown: (name: string, content: string) => ipcRenderer.invoke('spec-export-md', name, content) as Promise<{ path:string }>,
  specExportPDF: (name: string, html: string) => ipcRenderer.invoke('spec-export-pdf', name, html) as Promise<{ path:string }>,
  tasksWrite: (json: string) => ipcRenderer.invoke('tasks-write', json) as Promise<{ path:string, count:number }>,
  jestScaffoldForTasks: (tasks: {id:string,title:string,description?:string}[]) => ipcRenderer.invoke('jest-scaffold', tasks),

  // phase 6: agent hooks
  agentEnable: () => ipcRenderer.invoke('agent-enable'),
  agentDisable: () => ipcRenderer.invoke('agent-disable'),
  stagingList: () => ipcRenderer.invoke('staging-list') as Promise<{file:string, rel:string}[]>,
  stagingRead: (rel: string) => ipcRenderer.invoke('staging-read', rel) as Promise<{original:string, proposed:string, explanation?:string}>,
  stagingAccept: (rel: string) => ipcRenderer.invoke('staging-accept', rel),
  stagingReject: (rel: string) => ipcRenderer.invoke('staging-reject', rel),
  activityFeed: () => ipcRenderer.invoke('activity-feed') as Promise<{time:string, message:string}[]>,
  onAgentEvent: (cb: (ev:any, payload:any) => void) => ipcRenderer.on('agent-event', cb)
});
