const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  sources: call('sources'), select: call('select'), save: call('save'),
  library: call('library'), open: call('open'), reveal: call('reveal'),
  folder: call('folder'), link: call('link'),
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_e, action) => cb(action)),
});
