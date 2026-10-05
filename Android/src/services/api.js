/**
 * Centralized API service for the Tailor Management System Android app.
 *
 * Uses axios (same approach as the desktop Frontend/src/services/api.js).
 * - Legacy /api/* endpoints are used for all authenticated resources, matching
 *   the desktop app's contract exactly (data returned directly in res.data).
 * - v1 /api/v1/* is used only for the API-key endpoints (owner-scoped).
 *
 * The only credential stored on the device is the JWT bearer token returned by
 * /api/auth/login. No server secrets, database credentials, or Supabase keys
 * are exposed here.
 */
import axios from 'axios';
import {
  getServerUrl,
  getApiBaseUrl,
  getV1BaseUrl,
  notifyNetworkFailure,
} from './serverConfig';

/**
 * The base URL is read at REQUEST time, never frozen at module load.
 *
 * serverConfig.js probes the candidates (saved address -> .env -> Expo host ->
 * localhost) and keeps the live one, so a PC whose Wi-Fi address changed under
 * DHCP is recovered automatically instead of failing every call with
 * ERR_NETWORK until Metro is restarted with -c.
 */
export const getBaseURL = () => getServerUrl();

/**
 * @deprecated Static snapshot kept for existing imports. Prefer getBaseURL() /
 * useServerConnection() when the value is shown to the user.
 */
export const API_BASE_URL = getServerUrl();
export const V1_BASE_URL = getV1BaseUrl();

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

const apiV1 = axios.create({
  baseURL: getV1BaseUrl(),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Token plumbing ---
// The token is injected per-request via the interceptor instead of being read
// from storage on every call, so logout (which clears the in-memory token)
// immediately stops authenticated requests.
let authToken = null;
let authErrorHandler = null;

export const setAuthToken = (token) => {
  authToken = token || null;
};

/**
 * Register a handler invoked when the backend rejects a request with 401.
 * The AuthContext wires this to its logout flow so the UI returns to Login.
 */
export const setAuthErrorHandler = (handler) => {
  authErrorHandler = handler;
};

export const clearAuthToken = () => setAuthToken(null);

/**
 * Per-request preparation.
 *
 * `config.baseURL` is rewritten on every call so a server address that changed
 * (new DHCP lease, backend moved to another port, user typed a new address)
 * takes effect immediately, without a Metro restart or an app rebuild.
 */
const prepareRequest = (prefix) => (config) => {
  config.baseURL = `${getServerUrl()}${prefix}`;
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
};

api.interceptors.request.use(prepareRequest('/api'));
apiV1.interceptors.request.use(prepareRequest('/api/v1'));

// --- Response / error handling ---
// Normalizes errors into a user-friendly `friendlyMessage` property on the
// rejected error, mirroring the desktop handleApiError contract. Raw axios /
// network errors are never surfaced to the UI directly.
const safeMessage = (response) => {
  if (!response) return null;
  const data = response.data;
  if (data && typeof data === 'object' && data.message) return String(data.message);
  if (data && typeof data === 'string') return data;
  return null;
};

export const getFriendlyError = (error) =>
  error?.friendlyMessage || 'Something went wrong. Please try again.';

/**
 * The bare server origin behind a request baseURL.
 *
 * The request interceptor rewrites `baseURL` to `<server>/api` (or
 * `<server>/api/v1`) on every call, so both the user-facing messages and the
 * failover comparator in serverConfig need the server ROOT. Comparing the
 * suffixed value against serverConfig's candidates (which are bare origins)
 * would never match and the DHCP switch would silently never happen.
 */
const serverRootOf = (baseURL) =>
  String(baseURL || '').replace(/\/api(?:\/v1)?\/?$/i, '') || getServerUrl();

/**
 * Classify a transport-level failure (no HTTP response was received) so the UI
 * can tell apart the real causes instead of showing one generic message:
 *   timeout | dns | connection-refused | unreachable | network
 * HTTP errors (a response WAS received) never reach this function — they keep
 * their status-based messages below, so an auth/4xx/5xx error is never
 * disguised as a connectivity problem.
 */
const classifyNetworkError = (error) => {
  const code = String(error?.code || error?.cause?.code || '');
  const message = String(error?.message || '');
  const target = serverRootOf(error?.config?.baseURL);

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return {
      kind: 'timeout',
      target,
      friendly: `The server at ${target} took too long to respond. Please try again.`,
    };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      kind: 'dns',
      target,
      friendly: `Could not resolve the server address (${target}). Check the address under More ▸ Connection.`,
    };
  }
  if (code === 'ECONNREFUSED') {
    return {
      kind: 'connection-refused',
      target,
      friendly: `The server at ${target} refused the connection. Start the backend (npm start in the Backend folder), then open More ▸ Connection to check the address.`,
    };
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || code === 'ECONNRESET') {
    return {
      kind: 'unreachable',
      target,
      friendly: `The server at ${target} is unreachable from this device. Check that the phone and the PC are on the same Wi-Fi network.`,
    };
  }
  return {
    kind: 'network',
    target,
    friendly: `Unable to reach the server at ${target}. Check your Wi-Fi, or open More ▸ Connection to set the server address.`,
  };
};

const requestLabel = (config) =>
  `${(config?.method || 'get').toUpperCase()} ${config?.baseURL || ''}${config?.url || ''}`;

const onResponseError = (error) => {
  const { response } = error;

  if (!response) {
    const { kind, friendly, target } = classifyNetworkError(error);
    error.friendlyMessage = friendly;
    error.isNetworkError = true;
    error.errorKind = kind;
    // Hand the failure to serverConfig. After two consecutive transport errors
    // it re-probes the other candidates and switches to a live one, which is
    // precisely the DHCP case: the PC kept the same backend but got a new IP.
    // `target` is the bare server root, so it can be compared against the
    // candidate list the way notifyNetworkFailure expects.
    notifyNetworkFailure(target);
    // Diagnostic line for Metro/Expo logs: distinguishes DNS vs refused vs
    // timeout vs generic transport failure without exposing request bodies.
    console.warn(
      `[api] NETWORK ERROR [${kind}] ${requestLabel(error.config)} ` +
        `code=${error?.code || error?.cause?.code || '-'} message=${error?.message || '-'}`
    );
    return Promise.reject(error);
  }

  const status = response.status;
  const custom = safeMessage(response);

  console.warn(
    `[api] HTTP ${status} ${requestLabel(error.config)} -> ${custom || '(no message in body)'}`
  );

  if (status === 401) {
    error.friendlyMessage = custom || 'Your session has expired. Please log in again.';
    error.isAuthError = true;
    if (authErrorHandler) authErrorHandler();
  } else if (status === 409) {
    error.friendlyMessage = custom || 'This record conflicts with existing data.';
  } else if (status === 404) {
    error.friendlyMessage = custom || 'No records found.';
  } else if (status === 400) {
    error.friendlyMessage = custom || 'Please check your input and try again.';
  } else if (status === 403) {
    error.friendlyMessage = custom || 'You are not authorized to perform this action.';
  } else if (status >= 500) {
    error.friendlyMessage = custom || 'Server error. Please try again.';
  } else {
    error.friendlyMessage = custom || 'An unexpected error occurred. Please try again.';
  }

  error.isApiError = true;
  return Promise.reject(error);
};

api.interceptors.response.use((res) => res, onResponseError);
apiV1.interceptors.response.use((res) => res, onResponseError);

// =====================
// Auth (legacy /api/auth — matches desktop contract)
// POST /auth/login   -> { token, user }
// POST /auth/register -> { token, user }
// GET  /auth/me      -> { user }
// POST /auth/logout
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (name, email, password, shopName) =>
  api.post('/auth/register', { name, email, password, shopName });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// Health (lives at the server root, not under /api).
// The base is resolved at call time, so an address that changed since the last
// request (new DHCP lease, address typed on the Connection screen) is honoured.
export const getHealth = () => axios.get(`${getServerUrl()}/health`, { timeout: 20000 });

// =====================
// Customers
export const getCustomers = () => api.get('/customers');
export const addCustomer = (customer) => api.post('/customers', customer);
export const getCustomerById = (id) => api.get(`/customers/${id}`);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// =====================
// Orders
export const getOrders = (q) => api.get('/orders', { params: q ? { q } : undefined });
export const getOrderById = (id) => api.get(`/orders/detail/${id}`);
export const getOrdersByCustomerId = (customerId) => api.get(`/orders/${customerId}`);
export const addOrder = (order) => api.post('/orders', order);
export const updateOrder = (id, order) => api.put(`/orders/${id}`, order);
export const updateOrderPayment = (id, payload) => api.post(`/orders/${id}/payment`, payload);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);

// =====================
// Measurements
export const getMeasurements = (customerId) => api.get(`/measurements/${customerId}`);
export const addMeasurement = (data) => api.post('/measurements', data);
export const updateMeasurement = (id, data) => api.put(`/measurements/${id}`, data);
export const deleteMeasurement = (id) => api.delete(`/measurements/${id}`);

// =====================
// Settings (owner)
export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.put('/settings', data);

// =====================
// Shop
export const getShopInfo = () => api.get('/shop');
export const saveShopInfo = (data) => api.post('/shop', data);

// =====================
// Budget / Employees / Income / Expenses / Salaries
export const getEmployees = () => api.get('/budget/employees');
export const addEmployee = (data) => api.post('/budget/employees', data);
export const updateEmployee = (id, data) => api.put(`/budget/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/budget/employees/${id}`);

export const getExpenses = () => api.get('/budget/expenses');
export const addExpense = (data) => api.post('/budget/expenses', data);
export const deleteExpense = (id) => api.delete(`/budget/expenses/${id}`);

export const getIncome = () => api.get('/budget/income');
export const addIncome = (data) => api.post('/budget/income', data);
export const deleteIncome = (id) => api.delete(`/budget/income/${id}`);

export const getSalaries = () => api.get('/budget/salaries');
export const addSalary = (data) => api.post('/budget/salaries', data);
export const updateSalary = (id, data) => api.put(`/budget/salaries/${id}`, data);

// =====================
// Recycle bin (soft-deleted customers / orders / measurements)
// Same contract as the desktop app:
//   GET    /recycle-bin?type=all&q=&filter=  -> array of { id, type, name, phone,
//          deleted_at, days_remaining, order_number? }
//   POST   /recycle-bin/:type/:id/restore
//   DELETE /recycle-bin/:type/:id
//   POST   /recycle-bin/cleanup
// `type` for restore/delete is the plural lowercase form
// (customers | orders | measurements).
export const getRecycleBin = (params = {}) => {
  const query = {};
  if (params.type) query.type = params.type;
  if (params.filter) query.filter = params.filter;
  if (params.q) query.q = params.q;
  return api.get('/recycle-bin', { params: query });
};
export const restoreRecycleBinItem = (type, id) =>
  api.post(`/recycle-bin/${type}/${id}/restore`);
export const deleteRecycleBinItemForever = (type, id) =>
  api.delete(`/recycle-bin/${type}/${id}`);
export const cleanupRecycleBin = () => api.post('/recycle-bin/cleanup');

// =====================
// API Keys (v1 — owner scoped, wrapped responses)
export const listApiKeys = () => apiV1.get('/api-keys');
export const createApiKey = (name, scopes) => apiV1.post('/api-keys', { name, scopes });
export const revokeApiKey = (id) => apiV1.put(`/api-keys/${id}/revoke`);
export const deleteApiKey = (id) => apiV1.delete(`/api-keys/${id}`);

// The store-scoped external order endpoint (API-key based)
export const getOrdersApiEndpoint = () => `${getServerUrl()}/api/v1/orders/{orderId}`;
export const getOrdersApiKeyHeader = () => 'X-API-Key';

export { apiV1 };
export default api;