const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

const { app, BrowserWindow, ipcMain, dialog } = require('electron');

let autoUpdater = null;
let backendProcess = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.warn('[electron/main.js][updater] electron-updater not available:', e.message);
}

process.on('uncaughtException', (err) => {
  console.error('[electron/main.js][uncaughtException]', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[electron/main.js][unhandledRejection]', reason && reason.stack ? reason.stack : reason);
});


function isProduction() {
  return app.isPackaged || process.env.NODE_ENV === 'production';
}

function getBackendEntrypointPaths() {
  // Goal: start backend reliably in both dev and packaged builds.
  // Key: Electron-builder may place extraResources directly under:
  //   <resources>/Backend/**
  // while some unpacked asar content may be under:
  //   <resources>/app.asar.unpacked/**

  const resourcesPath = process.resourcesPath;
  const appPath = app.getAppPath();

  // DEV: main.js lives in electron/, backend is at ../Backend.
  const candidateDev = path.join(__dirname, '..', 'Backend', 'server.js');

  // Packaged: prefer extraResources/Backend first.
  const candidateResourcesBackend = path.join(resourcesPath, 'Backend', 'server.js');
  
  // Packaged: possible variants.
  const candidateAppPathBackend1 = path.join(appPath, 'Backend', 'server.js');
  const candidateAppPathBackend2 = path.join(appPath, 'backend', 'server.js');

  // Packaged: asar unpacked variants.
  const candidateAsarUnpackedBackend1 = path.join(resourcesPath, 'app.asar.unpacked', 'Backend', 'server.js');
  const candidateAsarUnpackedBackend2 = path.join(resourcesPath, 'app.asar.unpacked', 'backend', 'server.js');

  const candidates = [
    candidateResourcesBackend,
    candidateAsarUnpackedBackend1,
    candidateAsarUnpackedBackend2,
    candidateAppPathBackend1,
    candidateAppPathBackend2,
    candidateDev,
  ];

  const found = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  return { found, candidates };
}



function getFrontendIndexPath() {
  // app.asar layout (verified from app.asar):
  //   /Frontend/dist/index.html
  //   /Frontend/index.html
  // For packaged builds, filesystem existence checks may fail for asar paths,
  // so we treat the asar paths as the real candidates and only validate when possible.

  const candidates = [];

  // DEV candidates (real filesystem)
  candidates.push(path.join(__dirname, '..', 'Frontend', 'dist', 'index.html'));
  candidates.push(path.join(__dirname, '..', 'Frontend', 'index.html'));

  if (app.isPackaged) {
    // asar-backed candidates
    const asarBase = path.join(process.resourcesPath, 'app.asar');
    candidates.push(path.join(asarBase, 'Frontend', 'dist', 'index.html'));
    candidates.push(path.join(asarBase, 'Frontend', 'index.html'));

    // Some Electron setups allow resolving directly via app.getAppPath()
    candidates.push(path.join(app.getAppPath(), 'Frontend', 'dist', 'index.html'));
    candidates.push(path.join(app.getAppPath(), 'Frontend', 'index.html'));
    candidates.push(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  const found = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  // If existsSync cannot validate asar paths, fall back to the first packaged candidate.
  const fallbackFound = found || candidates.find((p) => p.includes('app.asar')) || candidates[0];
  return { found: fallbackFound, candidates };
}



const APP_NAME = 'Tailor Management System';

function setBrowserAndElectronTitle(shopName) {
  const title = shopName && String(shopName).trim() ? String(shopName).trim() : APP_NAME;

  // Electron window title + app title
  try {
    const allWins = BrowserWindow.getAllWindows();
    for (const w of allWins) w.setTitle(title);
  } catch (_) {}

  // Renderer (browser tab) title update will be done via executeJavaScript
  // because renderer can’t reliably call electron window methods.
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents
        .executeJavaScript(
          `document.title = ${JSON.stringify(title)};`,
        )
        .catch(() => {});
    }
  } catch (_) {}
}

const PUBLISHER = 'Nexora Digital Solutions';

function getAppDataRoot() {
  return app.getPath('appData'); // %APPDATA%
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getUserDataPaths() {
  const root = path.join(getAppDataRoot(), 'TailorManagementSystem');
  return {
    root,
    databaseDir: path.join(root, 'database'),
    backupsDir: path.join(root, 'backups'),
    dbFile: path.join(root, 'database', 'tailor.db'),
  };
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');

  const win = new BrowserWindow({

    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    maximizable: true,
    minimizable: true,
    show: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      // Keep defaults safe; no Node integration in renderer.
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove default Electron menu.
  win.setMenu(null);

  // Loading screen: a simple overlay shown immediately.
  // We do NOT show "Loading... Please wait..." (requirement).
  // Instead we show the shop name once backend is ready.
  win.once('ready-to-show', () => {
  // DevTools: never auto-open (packaged or dev).
    try {
      // no-op
    } catch (_) {}



    win.show();
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[electron/main.js][did-fail-load]', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  win.webContents.on('did-start-loading', () => {});
  win.webContents.on('did-finish-load', () => {});


  return win;
}

async function startBackendAndWait({ paths, env }) {
  const { found, candidates } = getBackendEntrypointPaths();

  if (!found) {
    throw new Error(`Backend entry not found. Candidates: ${candidates.join(' | ')}`);
  }

  const entryFile = found;
  const backendDir = path.dirname(entryFile);

  const backendPackageJsonPath = path.join(backendDir, 'package.json');
  if (!fs.existsSync(entryFile)) {
    throw new Error(`Backend entry not found at resolved path: ${entryFile}`);
  }
  if (!fs.existsSync(backendPackageJsonPath)) {
    throw new Error(`Backend package.json not found at resolved path: ${backendPackageJsonPath}`);
  }

  const child = fork(entryFile, [], {
    cwd: backendDir,
    env,
    silent: true
  });
  backendProcess = child;

  let output = '';
  const appendOutput = (chunk) => {
    output = `${output}${chunk}`.slice(-4000);
  };

  child.on('error', (err) => {
    console.error('[electron/main.js][backend-process][error]', err);
    appendOutput(err && err.message ? err.message : String(err));
  });

  if (child.stdout) {
    child.stdout.on('data', (d) => {
      const text = d.toString();
      appendOutput(text);
      console.log('[backend]', text);
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (d) => {
      const text = d.toString();
      appendOutput(text);
      console.error('[backend]', text);
    });
  }

  const port = Number(env.PORT || 5000);
  const healthUrl = `http://127.0.0.1:${port}/health`;
  const totalTimeoutMs = 60_000;

  const hasFetch = typeof fetch === 'function';
  const start = Date.now();
  let exitInfo = null;
  child.once('exit', (code, signal) => {
    exitInfo = { code, signal };
    if (backendProcess === child) backendProcess = null;
  });

  while (Date.now() - start <= totalTimeoutMs) {
    if (exitInfo) {
      const details = output.trim() || 'The backend exited without diagnostic output.';
      throw new Error(
        `Backend stopped before /health became ready (code=${exitInfo.code}, signal=${exitInfo.signal || 'none'}). ${details}`
      );
    }

    try {
      const r = hasFetch
        ? await fetch(healthUrl, { method: 'GET' }).catch(() => null)
        : null;

      if (r && r.ok) return { child };

      if (!hasFetch) {
        const http = require('http');
        await new Promise((resolve, reject) => {
            http.get(healthUrl, (res) => {
              res.resume();
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
              else reject(new Error(`Health not ok: ${res.statusCode}`));
            }).on('error', reject);
        });
        return { child };
      }
    } catch (error) {
      // The backend may still be initializing; continue polling until the deadline.
    }

    await new Promise((res) => setTimeout(res, 500));
  }

  if (!exitInfo) child.kill();
  throw new Error(
    `Backend did not become ready in time after ${totalTimeoutMs}ms at ${healthUrl}. ${output.trim()}`
  );
}


function resolveFrontendUrlOrFile() {
  // DEV: load Vite only when NOT packaged.
  if (!app.isPackaged) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) return devUrl;
  }

  // PROD: load from packaged files only.
  const { found, candidates } = getFrontendIndexPath();
  if (!found) {
    throw new Error(`Frontend index.html not found. Candidates: ${candidates.join(' | ')}`);
  }
  return `file://${found}`;
}



function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = null;
}

async function getShopNameFromBackend() {
  // Try to fetch shop data from backend once ready.
  // We will ask backend /api/shop (should exist based on routes).
  const port = Number(process.env.PORT || 5000);
  const url = `http://127.0.0.1:${port}/api/shop`;
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Failed to fetch shop info: HTTP ${r.status}. ${txt}`);
  }

  const data = await r.json();


  // Existing API likely returns { shop: {...} } or similar.
  // We'll be defensive.
  const shopName =
    data?.shop?.name || data?.name || data?.shopName || data?.shop_name || 'Shop';

  return String(shopName || 'Shop');
}

app.whenReady().then(async () => {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  // Production: disable devtools.

  // Electron doesn't have a single "disable devtools" switch; we hide menu + omit shortcuts.
  // Additionally, prevent opening DevTools from common keyboard combos.
  if (process.env.NODE_ENV === 'production' || app.isPackaged) {
    app.on('browser-window-created', (_event, win) => {
      win.webContents.on('before-input-event', (event, input) => {
        const key = input.key?.toLowerCase?.();
        const isCmdOrCtrl = input.control || input.meta;
        if (isCmdOrCtrl && key === 'i') event.preventDefault();
        if (isCmdOrCtrl && input.shift && key === 'i') event.preventDefault();
        if (key === 'f12') event.preventDefault();
      });
    });
  }

  const paths = getUserDataPaths();
  ensureDirSync(paths.databaseDir);
  ensureDirSync(paths.backupsDir);

  const env = {
    ...process.env,
    PORT: process.env.PORT || '5000',
    TAILOR_DB_PATH: paths.dbFile,
    ELECTRON_PRODUCTION: app.isPackaged ? '1' : process.env.ELECTRON_PRODUCTION || '',
    // If backend backup services support custom directories in future, we can extend here.
    // Keep as env scaffolding; do not change business logic.
    TAILOR_BACKUPS_DIR: paths.backupsDir,
  };

  const win = createWindow();

  // Create a minimal loading page without inline <style> or inline <script>
  // to avoid CSP violations in packaged builds.
  const loaderHtml = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Loading</title>
    </head>
    <body>
      <div id="shopName">Tailor Shop</div>
      <noscript>Loading...</noscript>
    </body>
  </html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loaderHtml)}`);


  try {
    // Start backend and wait
    await startBackendAndWait({ paths, env });

    // Fetch shop name for loading overlay (no inline loader script)
    try {
      const shopName = await getShopNameFromBackend();
      const js = `(() => { const el = document.getElementById('shopName'); if (el) el.textContent = ${JSON.stringify(shopName)}; })();`;
      win.webContents.executeJavaScript(js).catch(() => {});
    } catch (_) {
      // Keep default
    }


    // Load frontend
    const urlOrFile = resolveFrontendUrlOrFile();
    await win.loadURL(urlOrFile);

    if (autoUpdater && isProduction()) {
      try {
        autoUpdater.checkForUpdates();
      } catch (_) {}
    }
  } catch (err) {
    // Minimal error page
    const errHtml = `<!doctype html><html><body><pre>${String(err && err.stack ? err.stack : err)}</pre></body></html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errHtml)}`);
  }
});

function sendToRenderer(channel, ...args) {
  try {
    const allWindows = BrowserWindow.getAllWindows();
    for (const w of allWindows) {
      w.webContents.send(channel, ...args).catch(() => {});
    }
  } catch (_) {}
}

function getWindowForEvent(event) {
  try {
    if (event && event.sender && typeof event.sender === 'object') {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (senderWindow) return senderWindow;
    }
  } catch (_) {}

  const allWindows = BrowserWindow.getAllWindows();
  return allWindows[0] || null;
}

const DEFAULT_PRINT_OPTIONS = {
  silent: false,
  printBackground: true,
  landscape: false,
  pageSize: 'A5',
  scaleFactor: 1,
  margins: { marginType: 'none' },
};

const activePrintJobs = new Set();

async function createMeasurementPrintWindow(sourceWindow) {
  const preview = await sourceWindow.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('.measurement-preview-content');
    const page = root?.querySelector('.measurement-preview-page');
    const styles = root?.querySelector(':scope > style')?.textContent;
    const customerRow = page?.querySelector('[data-preview-customer]');
    const hasCustomer = Boolean(customerRow?.querySelector('.measurement-preview-meta-value')?.textContent.trim());
    const hasSavedDetails = Array.from(page?.querySelectorAll('.measurement-preview-table .measurement-preview-value') || [])
      .some((cell) => cell.textContent.trim());
    if (!page || !styles || !page.textContent.trim() || !hasCustomer || !hasSavedDetails) return null;
    return { markup: page.outerHTML, styles };
  })()`);
  if (!preview) throw new Error('The selected customer and measurement details are not available for printing.');

  // Print the same preview page markup and CSS shown to the user. The narrow
  // overrides only restore the preview's desktop layout and remove modal UI.
  const printWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${preview.styles}</style><style>
      html,body{margin:0!important;padding:0!important;width:100%!important;background:#fff!important;color:#000!important}
      .measurement-preview-backdrop{display:block!important;position:static!important;padding:0!important;background:#fff!important}
      .measurement-preview-content{display:block!important;position:static!important;width:100%!important;height:auto!important;overflow:visible!important;padding:0!important}
      .measurement-preview-backdrop .measurement-preview-page{display:flex!important;flex:0 0 auto!important;box-shadow:none!important}
      .measurement-print-source{display:none!important}
      @media print{
        .measurement-preview-header{grid-template-columns:minmax(0,1.25fr) minmax(0,0.75fr)!important}
        .measurement-preview-meta{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @page{size:A5 portrait;margin:4px}
    </style></head><body><div class="measurement-preview-backdrop"><div class="measurement-preview-dialog"><div><div class="measurement-preview-content">${preview.markup}</div></div></div></div></body></html>`;
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const ready = await printWindow.webContents.executeJavaScript(`(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (document.fonts?.load) await document.fonts.load('11pt "Noto Nastaliq Urdu"');
      await Promise.all(Array.from(document.images).map((image) => image.decode ? image.decode().catch(() => {}) : Promise.resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const page = document.querySelector('.measurement-preview-page');
      const customer = page?.querySelector('[data-preview-customer] .measurement-preview-meta-value')?.textContent.trim();
      const hasSavedDetails = Array.from(page?.querySelectorAll('.measurement-preview-table .measurement-preview-value') || [])
        .some((cell) => cell.textContent.trim());
      return Boolean(page && customer && hasSavedDetails && page.getBoundingClientRect().width > 0 && page.getClientRects().length);
    })()`);
    if (!ready) throw new Error('The selected customer measurement details did not finish rendering.');
    return printWindow;
  } catch (error) {
    if (!printWindow.isDestroyed()) printWindow.destroy();
    throw error;
  }
}

async function createMeasurementPdfBuffer(sourceWindow) {
  const printWindow = await createMeasurementPrintWindow(sourceWindow);
  try {
    return await printWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A5',
      margins: { marginType: 'none' },
      preferCSSPageSize: true,
      scaleFactor: 1,
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
}

ipcMain.handle('print:current-page', async (event) => {
  const win = getWindowForEvent(event);
  if (!win) return { ok: false, message: 'No active Electron window found for printing.' };
  const jobKey = win.webContents.id;
  if (activePrintJobs.has(jobKey)) return { ok: false, message: 'A print job is already in progress.' };
  activePrintJobs.add(jobKey);

  try {
    const printWindow = await createMeasurementPrintWindow(win);
    try {
      const hasRenderedSlip = await printWindow.webContents.executeJavaScript(`(() => {
        const page = document.querySelector('.measurement-preview-page');
        const customer = page?.querySelector('[data-preview-customer] .measurement-preview-meta-value')?.textContent.trim();
        const hasSavedDetails = Array.from(page?.querySelectorAll('.measurement-preview-table .measurement-preview-value') || [])
          .some((cell) => cell.textContent.trim());
        return Boolean(page && customer && hasSavedDetails && page.getBoundingClientRect().width > 0 && page.getClientRects().length);
      })()`);
      if (!hasRenderedSlip) throw new Error('The print target does not contain the selected customer and saved measurement details.');
      return await new Promise((resolve) => {
        if (win.isDestroyed() || printWindow.isDestroyed() || printWindow.webContents.isDestroyed()) {
          resolve({ ok: false, message: 'The print window closed before printing started.' });
          return;
        }
        printWindow.webContents.print(DEFAULT_PRINT_OPTIONS, (success, failureReason) => {
          if (success) resolve({ ok: true });
          else if (String(failureReason || '').toLowerCase().includes('cancel')) {
            resolve({ ok: false, canceled: true, message: 'Printing was canceled.' });
          } else {
            resolve({ ok: false, message: failureReason || 'The printer could not complete the print job.' });
          }
        });
      });
    } finally {
      if (!printWindow.isDestroyed()) printWindow.destroy();
    }
  } catch (error) {
    return { ok: false, message: error?.message || 'The print request failed.' };
  } finally {
    activePrintJobs.delete(jobKey);
  }
});

ipcMain.handle('print:current-page-pdf', async (event) => {
  const win = getWindowForEvent(event);
  if (!win) return { ok: false, message: 'No active Electron window found for PDF export.' };
  const jobKey = win.webContents.id;
  if (activePrintJobs.has(jobKey)) return { ok: false, message: 'A print job is already in progress.' };
  activePrintJobs.add(jobKey);

  try {
    const pdfBuffer = await createMeasurementPdfBuffer(win);

    const outputPath = path.join(app.getPath('documents'), 'tailor-measurement-print.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    return { ok: true, path: outputPath, filePath: outputPath };
  } catch (error) {
    return {
      ok: false,
      message: error && error.message ? error.message : String(error),
    };
  } finally {
    activePrintJobs.delete(jobKey);
  }
});

if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update:available', {
      currentVersion: app.getVersion(),
      latestVersion: info.version,
      releaseNotes: info.releaseNotes || '',
      releaseDate: info.releaseDate || '',
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer('update:not-available', {
      currentVersion: app.getVersion(),
      latestVersion: info.version || app.getVersion(),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:download-progress', {
      percent: Math.floor(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:downloaded', {
      currentVersion: app.getVersion(),
      latestVersion: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error', err);
    sendToRenderer('update:error', { message: err && err.message ? err.message : String(err) });
  });
}

ipcMain.handle('update:check', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater not available' };
  try {
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('update:download', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater not available' };
  try {
    autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('update:install', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater not available' };
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
});

app.on('window-all-closed', () => {
  // On Windows we quit when all windows are closed.
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
