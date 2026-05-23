const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const APP_TITLE = '董哥 AI 灵感库';

function ensureLibrary() {
  const root = path.join(app.getPath('userData'), 'my-library');
  const images = path.join(root, 'images');
  const db = path.join(root, 'library.json');
  fs.mkdirSync(images, { recursive: true });
  if (!fs.existsSync(db)) fs.writeFileSync(db, '[]', 'utf8');
  return { root, images, db };
}

function readLibrary() {
  const { db, images } = ensureLibrary();
  let records = [];
  try { records = JSON.parse(fs.readFileSync(db, 'utf8')); } catch { records = []; }
  return records
    .filter((item) => item && item.fileName && fs.existsSync(path.join(images, item.fileName)))
    .map((item) => ({ ...item, image: pathToFileURL(path.join(images, item.fileName)).href }));
}

function writeLibrary(records) {
  const { db } = ensureLibrary();
  const clean = records.map(({ image, ...item }) => item);
  fs.writeFileSync(db, JSON.stringify(clean, null, 2), 'utf8');
  return readLibrary();
}

function safeExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'].includes(ext) ? ext : '.png';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1020,
    minHeight: 700,
    title: APP_TITLE,
    backgroundColor: '#f7f7f5',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.once('did-finish-load', () => {
    const css = fs.readFileSync(path.join(__dirname, 'desktop.css'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, 'desktop.js'), 'utf8');
    win.webContents.insertCSS(css);
    win.webContents.executeJavaScript(js).catch((error) => console.error('Desktop enhancement failed:', error));
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'] },
    (_details, callback) => callback({ redirectURL: pathToFileURL(path.join(__dirname, '..', 'node_modules', 'gsap', 'dist', 'gsap.min.js')).href })
  );
  ensureLibrary();
  ipcMain.handle('library:list', () => readLibrary());
  ipcMain.handle('library:choose-images', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入图片素材',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }]
    });
    if (result.canceled) return [];
    return result.filePaths.map((filePath) => ({ path: filePath, name: path.basename(filePath) }));
  });
  ipcMain.handle('library:add', (_event, entries) => {
    if (!Array.isArray(entries) || !entries.length) return readLibrary();
    const { images } = ensureLibrary();
    const records = readLibrary().map(({ image, ...item }) => item);
    entries.forEach((entry) => {
      if (!entry || !entry.sourcePath || !fs.existsSync(entry.sourcePath)) return;
      const id = crypto.randomUUID();
      const fileName = `${id}${safeExtension(entry.sourcePath)}`;
      fs.copyFileSync(entry.sourcePath, path.join(images, fileName));
      records.unshift({
        id, fileName,
        title: String(entry.title || path.parse(entry.sourcePath).name),
        sub: String(entry.sub || '未分类'),
        prompt: String(entry.prompt || ''),
        ratio: String(entry.ratio || '3 / 4'),
        createdAt: new Date().toISOString()
      });
    });
    return writeLibrary(records);
  });
  ipcMain.handle('library:update', (_event, patch) => {
    const records = readLibrary().map(({ image, ...item }) => item);
    const target = records.find((item) => item.id === patch?.id);
    if (!target) return readLibrary();
    ['title', 'sub', 'prompt', 'ratio'].forEach((key) => { if (typeof patch[key] === 'string') target[key] = patch[key]; });
    return writeLibrary(records);
  });
  ipcMain.handle('library:delete', (_event, id) => {
    const { images } = ensureLibrary();
    const records = readLibrary().map(({ image, ...item }) => item);
    const target = records.find((item) => item.id === id);
    if (target) { try { fs.unlinkSync(path.join(images, target.fileName)); } catch {} }
    return writeLibrary(records.filter((item) => item.id !== id));
  });
  ipcMain.handle('library:open-folder', () => shell.openPath(ensureLibrary().root));
  ipcMain.handle('clipboard:write', (_event, text) => { clipboard.writeText(String(text || '')); return true; });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
