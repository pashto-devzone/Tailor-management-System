const { contextBridge, ipcRenderer } = (() => {
  try {
    return { contextBridge: require('electron').contextBridge, ipcRenderer: require('electron').ipcRenderer };
  } catch {
    return {};
  }
})();

const safeInvoke = (channel, ...args) => {
  try {
    if (ipcRenderer && ipcRenderer.invoke) return ipcRenderer.invoke(channel, ...args);
  } catch (_) {}
  return Promise.resolve({ ok: false, message: 'IPC not available' });
};

const safeOn = (channel, listener) => {
  try {
    if (ipcRenderer && ipcRenderer.on) {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
      return () => {
        try { ipcRenderer.removeListener(channel, listener); } catch (_) {}
      };
    }
  } catch (_) {}
  return () => {};
};

contextBridge?.exposeInMainWorld('electronAPI', {
  printCurrentPage: (printConfig) => safeInvoke('print:current-page', printConfig),
  printCurrentPagePdf: (printConfig) => safeInvoke('print:current-page-pdf', printConfig),
  update: {
    check: () => safeInvoke('update:check'),
    download: () => safeInvoke('update:download'),
    install: () => safeInvoke('update:install'),
    onAvailable: (listener) => safeOn('update:available', listener),
    onNotAvailable: (listener) => safeOn('update:not-available', listener),
    onDownloadProgress: (listener) => safeOn('update:download-progress', listener),
    onDownloaded: (listener) => safeOn('update:downloaded', listener),
    onError: (listener) => safeOn('update:error', listener),
  },
});
