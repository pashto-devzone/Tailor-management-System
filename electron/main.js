const path = require('path');
const fs = require('fs');
const os = require('os');
const { fork } = require('child_process');

const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');

let autoUpdater = null;
let backendProcess = null;
let updateCheckInFlight = null;
let lastUpdateCheckAt = 0;
const UPDATE_CHECK_COOLDOWN_MS = 60 * 1000;
const UPDATER_GITHUB_CONFIG = {
  provider: 'github',
  owner: 'pashto-devzone',
  repo: 'Tailor-management-System',
  releaseType: 'release',
};
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

function fontPathToFileUrl(fontPath) {
  const normalized = path.resolve(fontPath).replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${withLeadingSlash}`;
}

function compareVersions(left, right) {
  const parse = (value) => String(value || '').replace(/^v/i, '').split(/[+-]/)[0].split('.').map((part) => {
    const number = Number(part);
    return Number.isInteger(number) && number >= 0 ? number : 0;
  });
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}

function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) > 0;
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

function getAuthSessionPath() {
  return path.join(app.getPath('userData'), 'auth-session.bin');
}

ipcMain.handle('auth:load', async () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, message: 'Secure session storage is unavailable.' };
    }
    if (!fs.existsSync(getAuthSessionPath())) return { ok: true, session: null };
    const encrypted = fs.readFileSync(getAuthSessionPath());
    const session = JSON.parse(safeStorage.decryptString(encrypted));
    if (!session || typeof session.token !== 'string' || !session.token) {
      return { ok: true, session: null };
    }
    return { ok: true, session };
  } catch (error) {
    console.error('[electron/main.js][auth:load]', error.message);
    return { ok: false, message: 'Unable to load the secure session.' };
  }
});

ipcMain.handle('auth:save', async (_event, session) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, message: 'Secure session storage is unavailable.' };
    }
    if (!session || typeof session.token !== 'string' || !session.token) {
      return { ok: false, message: 'Invalid authentication session.' };
    }
    const encrypted = safeStorage.encryptString(JSON.stringify({
      token: session.token,
      user: session.user || null,
    }));
    fs.writeFileSync(getAuthSessionPath(), encrypted);
    return { ok: true };
  } catch (error) {
    console.error('[electron/main.js][auth:save]', error.message);
    return { ok: false, message: 'Unable to save the secure session.' };
  }
});

ipcMain.handle('auth:clear', async () => {
  try {
    const sessionPath = getAuthSessionPath();
    if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    return { ok: true };
  } catch (error) {
    console.error('[electron/main.js][auth:clear]', error.message);
    return { ok: false, message: 'Unable to clear the secure session.' };
  }
});

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
        checkForUpdatesSafely().catch((error) => console.error('[updater] startup check failed', error));
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

// ---------------------------------------------------------------------------
// Measurement print configuration.
// The renderer resolves the saved Print Settings with
// Frontend/src/utils/printConfig.js and sends the result over IPC; main.js
// re-validates defensively (single source of truth for defaults stays in
// printConfig.js) and maps the millimeter values to the print document CSS
// (@page, print sheet) and to the Electron APIs:
//   - webContents.print    pageSize is in MICRONS,
//   - webContents.printToPDF pageSize is in INCHES,
//   - driver margins are avoided (marginType:'none' / zeroed PDF margins);
//     all page spacing comes from the sheet CSS so it stays deterministic.
// ---------------------------------------------------------------------------
const DEFAULT_PRINT_CONFIG = {
  widthMm: 107.95,   // 4.25 in — default measurement slip
  heightMm: 146.05,  // 5.75 in
  marginTop: 2.5,
  marginBottom: 2.5,
  marginLeft: 2.5,
  marginRight: 2.5,
  innerPadding: 0.5,
  borderWidth: 0.3,
  rowSpacing: 1.5,
  bodyColumnWidth: 42,
  labelColumnWidth: 44,
  metadataColumns: 3,
  lineHeightScale: 100,
  baseFontSize: 12.2,
  headerFontSize: 13.3,
  headerFontWeight: 700,
  labelFontSize: 12.2,
  valueFontSize: 12.2,
  farmaishFontSize: 12.2,
  footerFontSize: 8.5,
};

const clampNumber = (value, min, max, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const round2 = (n) => Math.round(n * 100) / 100;
const mmToMicrons = (mm) => Math.round(mm * 1000);

function normalizePrintConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const cfg = {
    widthMm: clampNumber(src.widthMm, 20, 600, DEFAULT_PRINT_CONFIG.widthMm),
    heightMm: clampNumber(src.heightMm, 20, 600, DEFAULT_PRINT_CONFIG.heightMm),
    marginTop: clampNumber(src.marginTop, 0, 30, DEFAULT_PRINT_CONFIG.marginTop),
    marginBottom: clampNumber(src.marginBottom, 0, 30, DEFAULT_PRINT_CONFIG.marginBottom),
    marginLeft: clampNumber(src.marginLeft, 0, 30, DEFAULT_PRINT_CONFIG.marginLeft),
    marginRight: clampNumber(src.marginRight, 0, 30, DEFAULT_PRINT_CONFIG.marginRight),
    innerPadding: clampNumber(src.innerPadding, 0, 10, DEFAULT_PRINT_CONFIG.innerPadding),
    borderWidth: clampNumber(src.borderWidth, 0, 2, DEFAULT_PRINT_CONFIG.borderWidth),
    rowSpacing: clampNumber(src.rowSpacing, 0, 10, DEFAULT_PRINT_CONFIG.rowSpacing),
    bodyColumnWidth: clampNumber(src.bodyColumnWidth, 30, 70, DEFAULT_PRINT_CONFIG.bodyColumnWidth),
    labelColumnWidth: clampNumber(src.labelColumnWidth, 25, 75, DEFAULT_PRINT_CONFIG.labelColumnWidth),
    metadataColumns: Math.round(clampNumber(src.metadataColumns, 1, 6, DEFAULT_PRINT_CONFIG.metadataColumns)),
    lineHeightScale: clampNumber(src.lineHeightScale, 70, 160, DEFAULT_PRINT_CONFIG.lineHeightScale),
    baseFontSize: clampNumber(src.baseFontSize ?? src.tableFontSize, 6, 22, DEFAULT_PRINT_CONFIG.baseFontSize),
    headerFontSize: clampNumber(src.headerFontSize, 6, 22, DEFAULT_PRINT_CONFIG.headerFontSize),
    headerFontWeight: clampNumber(src.headerFontWeight, 400, 900, DEFAULT_PRINT_CONFIG.headerFontWeight),
    labelFontSize: clampNumber(src.labelFontSize ?? src.tableFontSize, 6, 22, DEFAULT_PRINT_CONFIG.labelFontSize),
    valueFontSize: clampNumber(src.valueFontSize ?? src.tableFontSize, 6, 22, DEFAULT_PRINT_CONFIG.valueFontSize),
    farmaishFontSize: clampNumber(src.farmaishFontSize, 6, 22, DEFAULT_PRINT_CONFIG.farmaishFontSize),
    footerFontSize: clampNumber(src.footerFontSize, 6, 14, DEFAULT_PRINT_CONFIG.footerFontSize),
  };
  // Insets can never shrink the printable area below 15mm in either axis.
  const fitPair = (a, b, total) => {
    const insets = a + b + 2 * cfg.innerPadding;
    if (total - insets >= 15) return [a, b];
    const available = Math.max(0, total - 15 - 2 * cfg.innerPadding);
    const sum = a + b;
    if (sum <= 0) return [0, 0];
    return [round2(a * (available / sum)), round2(b * (available / sum))];
  };
  [cfg.marginTop, cfg.marginBottom] = fitPair(cfg.marginTop, cfg.marginBottom, cfg.heightMm);
  [cfg.marginLeft, cfg.marginRight] = fitPair(cfg.marginLeft, cfg.marginRight, cfg.widthMm);
  return cfg;
}

/**
 * Print-document overrides generated from the resolved configuration. The
 * preview's extracted <style> already carries the same --ps-* variables (the
 * renderer passed the identical config), so this block only pins the page
 * geometry: sheet size, printable padding and the @page rule. Overflow is
 * detected and reported rather than silently clipped.
 */
function buildMeasurementPrintCss(cfg) {
  const pad = (side) => round2(side + cfg.innerPadding);
  const scale = Math.min(cfg.widthMm / 107.95, cfg.heightMm / 146.05);
  const rowSpacing = cfg.rowSpacing * scale;
  const lineHeight = (value) => round2(value * cfg.lineHeightScale / 100);
  return `
      html,body{margin:0!important;padding:0!important;width:${round2(cfg.widthMm)}mm!important;height:auto!important;background:#fff!important;color:#000!important}
      :root{
        --ps-paper-w:${round2(cfg.widthMm)}mm;
        --ps-paper-h:${round2(cfg.heightMm)}mm;
        --ps-border-width:${round2(cfg.borderWidth * scale)}mm;
        --ps-pad-top:${pad(cfg.marginTop)}mm;
        --ps-pad-right:${pad(cfg.marginRight)}mm;
        --ps-pad-bottom:${pad(cfg.marginBottom)}mm;
        --ps-pad-left:${pad(cfg.marginLeft)}mm;
        --ps-scale:${round2(scale)};
        --ps-base-size:${round2(cfg.baseFontSize * scale)}pt;
        --ps-header-size:${round2(cfg.headerFontSize * scale)}pt;
        --ps-shop-size:${round2((cfg.headerFontSize + 1) * scale)}pt;
        --ps-header-weight:${cfg.headerFontWeight};
        --ps-label-size:${round2(cfg.labelFontSize * scale)}pt;
        --ps-value-size:${round2(cfg.valueFontSize * scale)}pt;
        --ps-table-size:${round2(cfg.baseFontSize * scale)}pt;
        --ps-farmaish-size:${round2(cfg.farmaishFontSize * scale)}pt;
        --ps-footer-size:${round2(cfg.footerFontSize * scale)}pt;
        --ps-line-height-scale:${round2(cfg.lineHeightScale / 100)};
        --ps-line-height-110:${lineHeight(1.1)};
        --ps-line-height-115:${lineHeight(1.15)};
        --ps-line-height-120:${lineHeight(1.2)};
        --ps-line-height-125:${lineHeight(1.25)};
        --ps-line-height-130:${lineHeight(1.3)};
        --ps-line-height-135:${lineHeight(1.35)};
        --ps-line-height-140:${lineHeight(1.4)};
        --ps-line-height-145:${lineHeight(1.45)};
        --ps-line-height-150:${lineHeight(1.5)};
        --ps-body-column-fr:${cfg.bodyColumnWidth}fr;
        --ps-other-column-fr:${round2(100 - cfg.bodyColumnWidth)}fr;
        --ps-label-column-fr:${cfg.labelColumnWidth}fr;
        --ps-value-column-fr:${round2(100 - cfg.labelColumnWidth)}fr;
        --ps-metadata-columns:${cfg.metadataColumns};
        --ps-space-xs:${round2(rowSpacing * 0.4)}mm;
        --ps-space-sm:${round2((rowSpacing * 2) / 3)}mm;
        --ps-space-md:${round2(rowSpacing)}mm;
        --ps-cell-pad-y:${round2(rowSpacing * 0.5)}mm;
        --ps-cell-pad-x:${round2((rowSpacing * 2) / 3)}mm;
        --ps-notes-pad-x:${round2(rowSpacing)}mm;
      }
      .measurement-preview-backdrop{display:block!important;position:static!important;padding:0!important;background:#fff!important}
      .measurement-preview-content{display:block!important;position:static!important;width:100%!important;height:auto!important;overflow:visible!important;padding:0!important}
      .measurement-print-sheet{box-sizing:border-box!important;display:flex!important;flex-direction:column!important;width:${round2(cfg.widthMm)}mm!important;height:${round2(cfg.heightMm)}mm!important;min-height:0!important;margin:0 auto!important;padding:${pad(cfg.marginTop)}mm ${pad(cfg.marginRight)}mm ${pad(cfg.marginBottom)}mm ${pad(cfg.marginLeft)}mm!important;background:#fff!important;border:var(--ps-border-width) solid #111!important;box-shadow:none!important;break-inside:avoid;page-break-after:avoid}
      .measurement-preview-backdrop .measurement-preview-page{display:flex!important;flex:1 1 auto!important;width:100%!important;min-height:0!important;border:none!important;box-shadow:none!important;margin:0!important}
      .measurement-preview-header{display:block!important}
      .measurement-preview-meta{grid-template-columns:repeat(var(--ps-metadata-columns),minmax(0,1fr))!important}
      .measurement-print-source{display:none!important}
      .measurement-print-fit-warning{display:none!important}
      @page{size:${round2(cfg.widthMm)}mm ${round2(cfg.heightMm)}mm;margin:0}
  `;
}

// Fallback print options for callers that send no print configuration.
const DEFAULT_PRINT_OPTIONS = {
  silent: false,
  printBackground: true,
  landscape: false,
  pageSize: { width: 107950, height: 146050 }, // microns: 4.25 x 5.75 inch slip
  scaleFactor: 1,
  margins: { marginType: 'none' },
};

const activePrintJobs = new Set();

async function createMeasurementPrintWindow(sourceWindow, printConfig) {
  const cfg = normalizePrintConfig(printConfig);
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
    const fontCandidates = [
      path.join(__dirname, '..', 'Frontend', 'public', 'fonts', 'NotoNastaliqUrdu.ttf'),
      path.join(__dirname, '..', 'Frontend', 'dist', 'fonts', 'NotoNastaliqUrdu.ttf'),
      path.join(app.getAppPath(), 'Frontend', 'dist', 'fonts', 'NotoNastaliqUrdu.ttf'),
      path.join(process.resourcesPath || '', 'Frontend', 'dist', 'fonts', 'NotoNastaliqUrdu.ttf'),
    ];
    const fontPath = fontCandidates.find((candidate) => candidate && fs.existsSync(candidate));
    const fontCss = fontPath
      ? `@font-face{font-family:"Noto Nastaliq Urdu";src:url("${fontPathToFileUrl(fontPath)}") format("truetype");font-display:swap}`
      : "";
    const html = `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fontCss}</style><style>${preview.styles}</style><style>${buildMeasurementPrintCss(cfg)}</style></head><body><div class="measurement-preview-backdrop"><div class="measurement-preview-dialog"><div><div class="measurement-preview-content"><div class="measurement-print-sheet">${preview.markup}</div></div></div></div></div></body></html>`;
    const tempHtmlPath = path.join(os.tmpdir(), `tms-measurement-${process.pid}-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, html, "utf8");
    printWindow.once('closed', () => {
      try { fs.unlinkSync(tempHtmlPath); } catch (_) {}
    });
    await printWindow.loadFile(tempHtmlPath);
    const ready = await printWindow.webContents.executeJavaScript(`(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (document.fonts?.load) {
        const fonts = ["Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Nirmala UI"];
        await Promise.all(fonts.flatMap((font) => [
          document.fonts.load('${cfg.headerFontSize}pt "' + font + '"'),
          document.fonts.load('${cfg.baseFontSize}pt "' + font + '"'),
          document.fonts.load('${cfg.labelFontSize}pt "' + font + '"'),
          document.fonts.load('${cfg.valueFontSize}pt "' + font + '"'),
          document.fonts.load('${cfg.farmaishFontSize}pt "' + font + '"'),
        ]));
      }
      await Promise.all(Array.from(document.images).map((image) => image.decode ? image.decode().catch(() => {}) : Promise.resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const page = document.querySelector('.measurement-preview-page');
      const customer = page?.querySelector('[data-preview-customer] .measurement-preview-meta-value')?.textContent.trim();
      const hasSavedDetails = Array.from(page?.querySelectorAll('.measurement-preview-table .measurement-preview-value') || [])
        .some((cell) => cell.textContent.trim());
      return Boolean(page && customer && hasSavedDetails && page.getBoundingClientRect().width > 0 && page.getClientRects().length);
    })()`);
    if (!ready) throw new Error('The selected customer measurement details did not finish rendering.');
    // Detect content taller than the fixed print sheet so the caller can
    // report the constraint (the sheet clips at its boundary to guarantee a
    // single page — this is never silent).
    try {
      const overflowPx = await printWindow.webContents.executeJavaScript(`(() => {
        const sheet = document.querySelector('.measurement-print-sheet');
        if (!sheet) return 0;
        sheet.style.setProperty('height', 'auto', 'important');
        const natural = sheet.scrollHeight;
        sheet.style.removeProperty('height');
        return Math.max(0, natural - sheet.clientHeight);
      })()`);
      if (overflowPx > 4) {
        printWindow.printOverflowMm = Math.round((overflowPx * 25.4) / 96);
      }
    } catch (_) {}
    return printWindow;
  } catch (error) {
    if (!printWindow.isDestroyed()) printWindow.destroy();
    throw error;
  }
}

async function createMeasurementPdfBuffer(sourceWindow, printConfig) {
  const cfg = normalizePrintConfig(printConfig);
  const printWindow = await createMeasurementPrintWindow(sourceWindow, cfg);
  try {
    return await printWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      // printToPDF pageSize takes inches; preferCSSPageSize keeps the @page
      // rule (same millimeter values) authoritative when both are present.
      pageSize: {
        width: cfg.widthMm / 25.4,
        height: cfg.heightMm / 25.4,
      },
      // PrintToPDFMargins are flat inch values (there is no marginType);
      // zero them so the sheet CSS padding alone defines the printable area.
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true,
      scale: 1,
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
}

ipcMain.handle('print:current-page', async (event, printConfig) => {
  const win = getWindowForEvent(event);
  if (!win) return { ok: false, message: 'No active Electron window found for printing.' };
  const jobKey = win.webContents.id;
  if (activePrintJobs.has(jobKey)) return { ok: false, message: 'A print job is already in progress.' };
  activePrintJobs.add(jobKey);

  const cfg = normalizePrintConfig(printConfig);
  // pageSize is in microns; orientation is already encoded in width/height so
  // landscape is never double-applied. Driver margins stay 'none' — all page
  // spacing comes from the print-sheet CSS (margins + inner padding).
  const printOptions = {
    ...DEFAULT_PRINT_OPTIONS,
    pageSize: { width: mmToMicrons(cfg.widthMm), height: mmToMicrons(cfg.heightMm) },
    landscape: false,
    margins: { marginType: 'none' },
  };

  try {
    const printWindow = await createMeasurementPrintWindow(win, cfg);
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
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            const requestedPaperMm = { widthMm: round2(cfg.widthMm), heightMm: round2(cfg.heightMm) };
            const overflowMm = printWindow.printOverflowMm || 0;
            if (overflowMm > 0) {
              const warning =
                `The content is about ${overflowMm}mm taller than the ${requestedPaperMm.widthMm} x ${requestedPaperMm.heightMm} mm ` +
                'paper, so the bottom of the slip was clipped to keep the print on one page. Increase the paper size, reduce ' +
                'margins, or lower the font sizes in Settings -> Print Settings. Also confirm the paper size selected in the ' +
                'printer driver; the driver can substitute its own stock, which this app cannot verify.';
              dialog.showMessageBox(win, {
                type: 'warning',
                title: 'Print completed with a size warning',
                message: 'The measurement slip does not fully fit the selected paper.',
                detail: warning,
                buttons: ['OK'],
              }).catch(() => {});
              resolve({ ok: true, warning, requestedPaperMm });
            } else {
              resolve({ ok: true, requestedPaperMm });
            }
          } else if (String(failureReason || '').toLowerCase().includes('cancel')) {
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

ipcMain.handle('print:current-page-pdf', async (event, printConfig) => {
  const win = getWindowForEvent(event);
  if (!win) return { ok: false, message: 'No active Electron window found for PDF export.' };
  const jobKey = win.webContents.id;
  if (activePrintJobs.has(jobKey)) return { ok: false, message: 'A print job is already in progress.' };
  activePrintJobs.add(jobKey);

  try {
    const pdfBuffer = await createMeasurementPdfBuffer(win, printConfig);

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
  // Keep the runtime provider explicit so installed builds do not depend on
  // stale or missing build-time app-update.yml settings.
  autoUpdater.setFeedURL(UPDATER_GITHUB_CONFIG);
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('update-available', (info) => {
    if (!isNewerVersion(info?.version, app.getVersion())) {
      sendToRenderer('update:not-available', {
        currentVersion: app.getVersion(),
        latestVersion: info?.version || app.getVersion(),
      });
      return;
    }
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
  });
}

function checkForUpdatesSafely() {
  if (!autoUpdater) return Promise.resolve({ ok: false, message: 'Updater not available' });
  const now = Date.now();
  if (updateCheckInFlight) return updateCheckInFlight;
  if (now - lastUpdateCheckAt < UPDATE_CHECK_COOLDOWN_MS) {
    return Promise.resolve({ ok: false, message: 'Update check recently completed. Please try again shortly.' });
  }
  lastUpdateCheckAt = now;
  updateCheckInFlight = Promise.resolve()
    .then(() => autoUpdater.checkForUpdates())
    .then(() => ({ ok: true }))
    .catch((error) => {
      console.error('[updater] check failed', error);
      return { ok: false, message: 'Unable to check for updates. Please try again later.' };
    })
    .finally(() => {
      updateCheckInFlight = null;
    });
  return updateCheckInFlight;
}

ipcMain.handle('update:check', async () => {
  return checkForUpdatesSafely();
});

ipcMain.handle('update:download', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater not available' };
  try {
    autoUpdater.downloadUpdate().catch((error) => {
      console.error('[updater] download failed', error);
    });
    return { ok: true };
  } catch (e) {
    console.error('[updater] download failed', e);
    return { ok: false, message: 'Unable to download the update. Please try again later.' };
  }
});

ipcMain.handle('update:install', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater not available' };
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e) {
    console.error('[updater] install failed', e);
    return { ok: false, message: 'Unable to install the update. Please restart the app and try again.' };
  }
});

app.on('window-all-closed', () => {
  // On Windows we quit when all windows are closed.
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
