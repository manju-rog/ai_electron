const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

try { if (require('electron-squirrel-startup')) app.quit(); } catch {}

let win: any = null;
let workspaceRoot: string | null = null;

const isInside = (base: string, target: string) => {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

const createWindow = async () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    title: 'KiroClone',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  await win.loadURL(devServerUrl);
  win.webContents.setWindowOpenHandler(({ url }: any) => { shell.openExternal(url); return { action: 'deny' }; });
};

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// IPC handlers for server communication
ipcMain.handle('ping-server', async () => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://127.0.0.1:4455/health');
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Unknown error' };
  }
});

ipcMain.handle('chat-request', async (_event: any, requestBody: any) => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://127.0.0.1:4455/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Unknown error' };
  }
});

ipcMain.handle('spec-request', async (_event: any, requestBody: any) => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://127.0.0.1:4455/generate/spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Unknown error' };
  }
});

ipcMain.handle('file-open', async () => {
  console.log('file-open IPC handler called');
  try {
    const result = await dialog.showOpenDialog({
      title: 'Open file',
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });
    console.log('Dialog result:', result);
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    console.log('File read successfully:', filePath);
    return { path: filePath, content };
  } catch (error) {
    console.error('Error in file-open handler:', error);
    return null;
  }
});

ipcMain.handle('file-save-as', async (_e: any, content: string) => {
  console.log('file-save-as IPC handler called');
  try {
    const result = await dialog.showSaveDialog({
      title: 'Save As',
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });
    console.log('Save dialog result:', result);
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, content ?? '', 'utf-8');
    console.log('File saved successfully:', result.filePath);
    return { path: result.filePath };
  } catch (error) {
    console.error('Error in file-save-as handler:', error);
    return null;
  }
});

// --- Phase-3 workspace APIs ---
ipcMain.handle('workspace-open', async () => {
  const result = await dialog.showOpenDialog({ title: 'Open Folder', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  workspaceRoot = path.normalize(result.filePaths[0]);
  return { root: workspaceRoot };
});

const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache']);

async function readTree(dir: string): Promise<any[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = await Promise.all(entries
    .filter((e: any) => !IGNORE.has(e.name))
    .map(async (e: any) => {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        return { name: e.name, path: path.relative(workspaceRoot!, abs), type: 'dir', children: await readTree(abs) };
      } else {
        return { name: e.name, path: path.relative(workspaceRoot!, abs), type: 'file' };
      }
    }));
  out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return out;
}

ipcMain.handle('workspace-read-tree', async () => {
  if (!workspaceRoot) return [];
  return readTree(workspaceRoot);
});

ipcMain.handle('workspace-read', async (_e: any, relPath: string) => {
  if (!workspaceRoot) return null;
  const abs = path.normalize(path.join(workspaceRoot, relPath));
  if (!isInside(workspaceRoot, abs)) return null;
  const content = await fs.readFile(abs, 'utf-8');
  return { path: relPath, content };
});

ipcMain.handle('workspace-write', async (_e: any, relPath: string, content: string) => {
  if (!workspaceRoot) return null;
  const abs = path.normalize(path.join(workspaceRoot, relPath));
  if (!isInside(workspaceRoot, abs)) return null;
  await fs.writeFile(abs, content ?? '', 'utf-8');
  return { path: relPath };
});
