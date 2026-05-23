const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('image2Desktop', {
  list: () => ipcRenderer.invoke('library:list'),
  chooseImages: () => ipcRenderer.invoke('library:choose-images'),
  add: (entries) => ipcRenderer.invoke('library:add', entries),
  update: (item) => ipcRenderer.invoke('library:update', item),
  remove: (id) => ipcRenderer.invoke('library:delete', id),
  openFolder: () => ipcRenderer.invoke('library:open-folder'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text)
});
