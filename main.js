const electron = require('electron');
if (typeof electron === 'string') {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [__dirname, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env,
  });
  child.on('close', (code) => process.exit(code ?? 0));
  return;
}

const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, nativeImage, session, shell } = electron;
const fs = require('fs');
const path = require('path');

const LINKS = {
  support: 'https://discord.gg/eBszxvAuhN',
  github: 'https://github.com/AstroSoftwareMoon',
};
let win, selectedId = null, sysAudio = false;
const dirs = () => ({
  png: path.join(app.getPath('pictures'), 'AstroScreen'),
  webm: path.join(app.getPath('videos'), 'AstroScreen'),
});

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 860, minHeight: 620,
    backgroundColor: '#0a0a1f', autoHideMenuBar: true, title: 'AstroScreen',
    icon: path.join(__dirname, 'astroscreen.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    const source = sources.find((s) => s.id === selectedId) || sources[0];
    // El audio del sistema (loopback) solo está soportado de forma fiable en Windows
    callback(source ? { video: source, ...(sysAudio && process.platform === 'win32' ? { audio: 'loopback' } : {}) } : {});
  });

  ipcMain.handle('sources', async () => {
    const list = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 210 } });
    return list.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
  });
  ipcMain.handle('select', (_e, id, sys) => { selectedId = id; sysAudio = !!sys; });

  ipcMain.handle('save', (_e, buffer, ext) => {
    const d = dirs()[ext];
    fs.mkdirSync(d, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(d, `AstroScreen-${stamp}.${ext}`);
    fs.writeFileSync(file, Buffer.from(buffer));
    return file;
  });

  ipcMain.handle('library', () => {
    const out = [];
    for (const [ext, d] of Object.entries(dirs())) {
      if (!fs.existsSync(d)) continue;
      for (const name of fs.readdirSync(d)) {
        if (!name.endsWith('.' + ext)) continue;
        const p = path.join(d, name);
        out.push({ name, path: p, ext, time: fs.statSync(p).mtimeMs });
      }
    }
    out.sort((a, b) => b.time - a.time);
    return out.slice(0, 60).map((i) => ({
      ...i,
      thumb: i.ext === 'png' ? nativeImage.createFromPath(i.path).resize({ width: 260 }).toDataURL() : null,
    }));
  });

  ipcMain.handle('open', (_e, p) => shell.openPath(p));
  ipcMain.handle('reveal', (_e, p) => shell.showItemInFolder(p));
  ipcMain.handle('folder', () => { fs.mkdirSync(dirs().webm, { recursive: true }); return shell.openPath(dirs().webm); });
  ipcMain.handle('link', (_e, key) => LINKS[key] && shell.openExternal(LINKS[key]));

  createWindow();
  const send = (a) => win && win.webContents.send('hotkey', a);
  globalShortcut.register('CommandOrControl+Shift+R', () => send('rec'));
  globalShortcut.register('CommandOrControl+Shift+S', () => send('shot'));
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
