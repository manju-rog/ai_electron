const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// __dirname is available in CommonJS

try { if (require('electron-squirrel-startup')) app.quit(); } catch {}

let win: any = null;

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
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', '..', 'app-renderer', 'dist', 'index.html'));
  }

  // Disable CSP for development
  win.webContents.session.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * \'unsafe-inline\' \'unsafe-eval\'; script-src * \'unsafe-inline\' \'unsafe-eval\'; connect-src * \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src *; style-src * \'unsafe-inline\';']
      }
    });
  });

  win.webContents.setWindowOpenHandler(({ url }: any) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Reserved for future: IPC to local server (health check)
ipcMain.handle('ping-server', async () => ({ ok: true }));

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
