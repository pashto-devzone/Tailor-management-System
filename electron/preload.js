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
      const wrapped = (_event, ...args) => listener(...args);
      ipcRenderer.on(channel, wrapped);
      return () => {
        try { ipcRenderer.removeListener(channel, wrapped); } catch (_) {}
      };
    }
  } catch (_) {}
  return () => {};
};

contextBridge?.exposeInMainWorld('electronAPI', {
  auth: {
    load: () => safeInvoke('auth:load'),
    save: (session) => safeInvoke('auth:save', session),
    clear: () => safeInvoke('auth:clear'),
  },
  printCurrentPage: (printConfig) => safeInvoke('print:current-page', printConfig),
  printCurrentPagePdf: (printConfig) => safeInvoke('print:current-page-pdf', printConfig),
  update: {
    check: () => safeInvoke('update:check'),
    download: () => safeInvoke('update:download'),
    install: () => safeInvoke('update:install'),
    onChecking: (listener) => safeOn('update:checking', listener),
    onAvailable: (listener) => safeOn('update:available', listener),
    onNotAvailable: (listener) => safeOn('update:not-available', listener),
    onDownloadProgress: (listener) => safeOn('update:download-progress', listener),
    onDownloaded: (listener) => safeOn('update:downloaded', listener),
    onError: (listener) => safeOn('update:error', listener),
  },
});
