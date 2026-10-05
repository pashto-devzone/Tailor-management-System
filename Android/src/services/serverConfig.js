/**
 * Server address resolution + connection health for the mobile app.
 *
 * WHY THIS EXISTS
 * The first version of the app read one URL from EXPO_PUBLIC_API_URL and used
 * it forever. In practice that breaks constantly, because:
 *   - the PC's Wi-Fi address is handed out by DHCP and changes;
 *   - the backend is often simply not started yet;
 *   - `EXPO_PUBLIC_*` values are baked into the bundle at build time, so fixing
 *     `.env` means restarting Metro with `-c`.
 * Every one of those produced the same opaque `ERR_NETWORK` with no explanation.
 *
 * WHAT IT DOES INSTEAD
 *   1. Builds an ordered candidate list (saved override -> .env -> Expo host
 *      -> localhost) and probes each one with GET /health.
 *   2. Uses the first candidate that really answers and remembers it.
 *   3. Lets the user type an address manually (persisted in AsyncStorage), so an
 *      IP change is fixed from the phone in seconds - no `.env`, no restart.
 *   4. Keeps a subscribable connection state so the UI can say exactly what it
 *      tried and why it failed, instead of showing a raw axios error code.
 *
 * SECURITY: only a base URL is stored. No tokens, credentials or secrets.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import axios from 'axios';

const STORAGE_KEY = 'tms_server_url';
export const DEFAULT_PORT = 5000;
const PROBE_TIMEOUT_MS = 4000;

const stripTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

/**
 * Accept what a human types ("192.168.1.20:5000", "http://my-pc/", ...) and
 * return a clean base URL, or null when it is not usable.
 */
export function normalizeServerUrl(input) {
  let value = String(input || '').trim();
  if (!value) return null;
  if (!/^[a-z]+:\/\//i.test(value)) value = `http://${value}`;
  if (!/^https?:\/\//i.test(value)) return null; // ftp://, file:// etc.
  value = stripTrailingSlash(value);
  const match = /^https?:\/\/([^/:]+)(?::(\d{1,5}))?$/.exec(value);
  if (!match || !match[1]) return null;
  return value;
}

/** The host serving the JS bundle - on a real phone this is the PC's LAN IP. */
function expoHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  return String(hostUri).split(':')[0] || '';
}

/** Where the shipped configuration points, and how we got there. */
function configuredCandidate() {
  const fromEnv = normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL);
  if (fromEnv) return { url: fromEnv, source: 'EXPO_PUBLIC_API_URL (.env)' };

  const host = expoHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return { url: `http://${host}:${DEFAULT_PORT}`, source: 'Expo dev-server host' };
  }
  return {
    url: `http://localhost:${DEFAULT_PORT}`,
    source: 'localhost fallback (not reachable from a physical device)',
  };
}

// ---------------------------------------------------------------- state ----
const state = {
  status: 'idle', // idle | checking | online | offline
  url: null,
  source: null,
  manualUrl: null,
  checkedAt: null,
  attempts: [],
  consecutiveNetworkFailures: 0,
};

const listeners = new Set();
let inflight = null;
let storageLoaded = false;

const snapshot = () => ({ ...state, attempts: state.attempts.slice() });

function emit(patch) {
  Object.assign(state, patch);
  const next = snapshot();
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch (err) {
      console.warn('[server] listener failed:', err?.message || err);
    }
  });
  return next;
}

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getConnection = () => snapshot();

/**
 * Base URL every request should use. Falls back to the configured candidate so
 * this is never empty (api.js may call it before resolution has finished).
 */
export const getServerUrl = () => state.url || configuredCandidate().url;

export const getApiBaseUrl = () => `${getServerUrl()}/api`;
export const getV1BaseUrl = () => `${getServerUrl()}/api/v1`;

/** Addresses to try, in order, de-duplicated. */
export function candidateServers() {
  const configured = configuredCandidate();
  const fromEnv = normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL);
  const host = expoHost();
  const list = [];

  const push = (url, source) => {
    const clean = normalizeServerUrl(url);
    if (!clean) return;
    if (!list.some((entry) => entry.url === clean)) list.push({ url: clean, source });
  };

  push(state.manualUrl, 'saved on this device');
  push(configured.url, configured.source);
  if (fromEnv && fromEnv !== configured.url) push(fromEnv, 'EXPO_PUBLIC_API_URL (.env)');
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    push(`http://${host}:${DEFAULT_PORT}`, 'Expo dev-server host');
  }
  push(`http://localhost:${DEFAULT_PORT}`, 'localhost (emulator/simulator only)');
  return list;
}

/**
 * One health probe. Requires our own envelope (status:"ok") so an unrelated
 * service that happens to own the port is never mistaken for the TMS backend.
 */
export async function probeServer(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const startedAt = Date.now();
  try {
    const res = await axios.get(`${url}/health`, {
      timeout: timeoutMs,
      headers: { Accept: 'application/json' },
      params: { _probe: Date.now() },
    });
    const ms = Date.now() - startedAt;
    const data = res?.data;
    const isTms = Boolean(data) && (data.status === 'ok' || data.success === true);
    return {
      url,
      ok: isTms,
      ms,
      detail: isTms
        ? `OK in ${ms}ms (database=${data?.data?.database || '?'}, cloud=${data?.data?.cloudDatabase || '?'})`
        : `something answered but it is not the TMS API (HTTP ${res?.status})`,
    };
  } catch (error) {
    return { url, ok: false, ms: Date.now() - startedAt, detail: describeProbeFailure(error) };
  }
}

function describeProbeFailure(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || 'unknown error');
  if (code === 'ECONNABORTED' || /timeout/i.test(message)) return `no answer within ${PROBE_TIMEOUT_MS}ms`;
  if (code === 'ECONNREFUSED') return 'connection refused - start the backend (npm start in Backend)';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'address could not be resolved';
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') return 'network unreachable from this device';
  if (error?.response) return `HTTP ${error.response.status} - not the TMS health endpoint`;
  return message;
}

async function loadStoredOverride() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const clean = normalizeServerUrl(stored);
    if (clean) emit({ manualUrl: clean });
  } catch (err) {
    console.warn('[server] could not read the saved address:', err?.message || err);
  }
}

/**
 * Probe candidates in order and adopt the first live one.
 * Concurrent calls share one run, so the burst of startup requests costs one
 * probe round instead of eight.
 */
export function resolveServer({ force = false, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (inflight && !force) return inflight;

  const run = (async () => {
    await loadStoredOverride();
    emit({ status: 'checking', attempts: [] });

    const candidates = candidateServers();
    console.log(
      `[server] probing ${candidates.length} address(es): ${candidates.map((c) => c.url).join(', ')}`
    );

    const attempts = [];
    for (const candidate of candidates) {
      const result = await probeServer(candidate.url, timeoutMs);
      attempts.push({ ...result, source: candidate.source });
      console.log(`[server] ${result.ok ? 'ONLINE ' : 'offline'} ${candidate.url} -> ${result.detail}`);
      if (result.ok) {
        emit({
          status: 'online',
          url: candidate.url,
          source: candidate.source,
          checkedAt: Date.now(),
          attempts,
          consecutiveNetworkFailures: 0,
        });
        return getConnection();
      }
    }

    emit({ status: 'offline', url: getServerUrl(), checkedAt: Date.now(), attempts });
    return getConnection();
  })();

  inflight = run;
  run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

export const ensureServerConnection = () => resolveServer();
export const retryServer = () => resolveServer({ force: true });

/**
 * Save an address typed by the user. Probes it first; with `force` it is saved
 * even while unreachable (useful when the backend is still starting up).
 */
export async function setManualServerUrl(rawUrl, { force = false } = {}) {
  const url = normalizeServerUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: 'That does not look like an address. Try something like 192.168.100.66:5000',
    };
  }
  emit({ manualUrl: url });
  const result = await probeServer(url);
  if (!result.ok && !force) {
    return {
      ok: false,
      error: `No TMS server answered at ${url} (${result.detail}). Start the backend with "npm start" in the Backend folder, then try again.`,
    };
  }
  await AsyncStorage.setItem(STORAGE_KEY, url).catch(() => {});
  storageLoaded = true;
  emit({
    status: result.ok ? 'online' : state.status,
    url,
    source: 'typed on this device',
    checkedAt: Date.now(),
    attempts: [{ ...result, source: 'typed on this device' }],
    consecutiveNetworkFailures: 0,
  });
  console.log(`[server] using saved address ${url} -> ${result.detail}`);
  return { ok: true, url, detail: result.detail, connected: result.ok };
}

/** Forget the typed address and fall back to .env / Expo host. */
export async function clearManualServerUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  emit({ manualUrl: null });
  return resolveServer({ force: true });
}

/**
 * Called by api.js whenever a request dies without an HTTP response.
 *
 * It deliberately does NOT switch the app to the offline screen while the user
 * is mid-task — one dropped request should not hide the UI. What it does is
 * re-probe after two consecutive transport failures, which is precisely the
 * situation created by the PC getting a new DHCP address: the saved URL keeps
 * failing while another address on the same machine answers, so we switch over
 * and the next request succeeds without the user touching anything.
 */
export function notifyNetworkFailure(failedUrl = state.url) {
  const failures = state.consecutiveNetworkFailures + 1;
  emit({ consecutiveNetworkFailures: failures });
  if (failures < 2 || inflight) return;

  (async () => {
    const others = candidateServers().filter((candidate) => candidate.url !== failedUrl);
    for (const candidate of others) {
      const result = await probeServer(candidate.url, 2500);
      if (result.ok) {
        console.warn(
          `[server] ${failedUrl} stopped responding; switched to ${candidate.url} (${candidate.source})`
        );
        emit({
          status: 'online',
          url: candidate.url,
          source: candidate.source,
          checkedAt: Date.now(),
          consecutiveNetworkFailures: 0,
        });
        return;
      }
    }
  })();
}

/** True when no HTTP response came back — i.e. the request never arrived. */
export const isTransportError = (error) => Boolean(error) && !error.response;

/** React binding so screens re-render when the connection state changes. */
export function useServerConnection() {
  const [value, setValue] = useState(() => snapshot());
  useEffect(() => subscribe(setValue), []);
  return value;
}

export default {
  normalizeServerUrl,
  getServerUrl,
  getApiBaseUrl,
  getV1BaseUrl,
  candidateServers,
  probeServer,
  resolveServer,
  ensureServerConnection,
  retryServer,
  setManualServerUrl,
  clearManualServerUrl,
  notifyNetworkFailure,
  isTransportError,
  getConnection,
  subscribe,
  useServerConnection,
};
