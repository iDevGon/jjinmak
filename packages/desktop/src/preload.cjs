const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jjinmak', {
  getState: () => ipcRenderer.invoke('get-state'),
  setArmed: (enabled) => ipcRenderer.invoke('set-armed', enabled),
  setOptions: (options) => ipcRenderer.invoke('set-options', options),
  setStartup: (enabled) => ipcRenderer.invoke('set-startup', enabled),
  cancelShutdown: () => ipcRenderer.invoke('cancel-shutdown'),
  demoEvent: (kind) => ipcRenderer.invoke('demo-event', kind),
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
});
