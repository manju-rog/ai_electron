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

// ---------- Phase 5: .kiro dirs + spec ops ----------
async function ensureKiroDirs() {
  if (!workspaceRoot) throw new Error('No workspace open');
  const kiro = path.join(workspaceRoot, '.kiro');
  const specs = path.join(kiro, 'specs');
  await fs.mkdir(kiro, { recursive: true });
  await fs.mkdir(specs, { recursive: true });
  return { kiro, specs };
}

ipcMain.handle('kiro-ensure-dirs', async () => {
  if (!workspaceRoot) return null;
  return ensureKiroDirs();
});

ipcMain.handle('specs-list', async () => {
  if (!workspaceRoot) return [];
  const { specs } = await ensureKiroDirs();
  const files = await fs.readdir(specs);
  // return names without extension
  return files
    .filter((f: string) => /\.md$|\.ya?ml$/i.test(f))
    .map((f: string) => f.replace(/\.(md|ya?ml)$/i, ''))
    .sort();
});

ipcMain.handle('spec-read', async (_e: any, name: string) => {
  if (!workspaceRoot) return null;
  const { specs } = await ensureKiroDirs();
  for (const ext of ['md','yaml','yml']) {
    const abs = path.join(specs, `${name}.${ext}`);
    try {
      const content = await fs.readFile(abs, 'utf-8');
      return { name, ext, content };
    } catch {}
  }
  return null;
});

ipcMain.handle('spec-write', async (_e: any, name: string, ext: 'md'|'yaml'|'yml', content: string) => {
  if (!workspaceRoot) throw new Error('No workspace open');
  const { specs } = await ensureKiroDirs();
  const abs = path.join(specs, `${name}.${ext}`);
  await fs.writeFile(abs, content ?? '', 'utf-8');
  return { path: path.relative(workspaceRoot!, abs) };
});

ipcMain.handle('spec-export-md', async (_e: any, name: string, content: string) => {
  const result = await dialog.showSaveDialog({ title:'Export Markdown', defaultPath:`${name}.md`, filters:[{name:'Markdown',extensions:['md']}] });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, content ?? '', 'utf-8');
  return { path: result.filePath };
});

ipcMain.handle('spec-export-pdf', async (_e: any, name: string, html: string) => {
  if (!win) throw new Error('No window');
  // Create an offscreen window to render HTML and print to PDF
  const pdfWin = new BrowserWindow({ show:false, webPreferences:{ sandbox:true } });
  await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pdf = await pdfWin.webContents.printToPDF({ printBackground:true, landscape:false, marginsType:1 });
  const result = await dialog.showSaveDialog({ title:'Export PDF', defaultPath:`${name}.pdf`, filters:[{name:'PDF',extensions:['pdf']}] });
  if (!result.canceled && result.filePath) {
    await fs.writeFile(result.filePath, pdf);
    pdfWin.destroy();
    return { path: result.filePath };
  }
  pdfWin.destroy();
  return null;
});

// tasks + jest scaffold
ipcMain.handle('tasks-write', async (_e: any, json: string) => {
  if (!workspaceRoot) throw new Error('No workspace open');
  const { kiro } = await ensureKiroDirs();
  const abs = path.join(kiro, 'tasks.json');
  await fs.writeFile(abs, json ?? '[]', 'utf-8');
  const arr = JSON.parse(json || '[]');
  return { path: path.relative(workspaceRoot!, abs), count: Array.isArray(arr) ? arr.length : 0 };
});

ipcMain.handle('jest-scaffold', async (_e: any, tasks: {id:string,title:string,description?:string}[]) => {
  if (!workspaceRoot) throw new Error('No workspace open');
  const testsRoot = path.join(workspaceRoot, 'tests', 'tasks');
  await fs.mkdir(testsRoot, { recursive: true });
  await Promise.all(tasks.map(async (t: any) => {
    const safe = (t.id || t.title).replace(/[^\w\-]+/g, '_').slice(0,60);
    const testPath = path.join(testsRoot, `${safe}.test.ts`);
    const body = `// Auto-generated by KiroClone (Phase 5)
describe(${JSON.stringify(t.title)}, () => {
  it('should be implemented', () => {
    // TODO: implement for task: ${t.id}
    expect(true).toBe(true);
  });
});
`;
    await fs.writeFile(testPath, body, 'utf-8');
  }));
  return { count: tasks.length, dir: path.relative(workspaceRoot!, testsRoot) };
});
