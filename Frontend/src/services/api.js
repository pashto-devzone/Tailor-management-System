import axios from "axios";

const baseOrigin = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseURL = baseOrigin + "/api";
const v1BaseURL = baseOrigin + "/api/v1";
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token || null;
};

const getAuthHeader = () => {
  try {
    const token = authToken || (!window.electronAPI && JSON.parse(localStorage.getItem("tms_auth") || "null")?.token);
    if (token) return { Authorization: `Bearer ${token}` };
  } catch (_) {}
  return {};
};

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

const apiV1 = axios.create({
  baseURL: v1BaseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const authHeader = getAuthHeader();
  Object.entries(authHeader).forEach(([key, value]) => {
    config.headers[key] = value;
  });
  return config;
});

apiV1.interceptors.request.use((config) => {
  const authHeader = getAuthHeader();
  Object.entries(authHeader).forEach(([key, value]) => {
    config.headers[key] = value;
  });
  return config;
});

export const handleApiError = (error) => {
  if (!error || !error.response) {
    return "Network connection failed. Please check your internet connection.";
  }

  const status = error.response.status;
  const message = error.response.data?.message;

  if (message) {
    return message;
  }

  switch (status) {
    case 400:
      return "Please check your input and try again.";
    case 401:
      return "You are not authorized. Please log in again.";
    case 403:
      return "You are not authorized to perform this action.";
    case 404:
      return "No records found.";
    case 409:
      return "This record conflicts with existing data.";
    case 500:
      return "Server error. Please try again.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
};

const hasBearerAuthorization = (config) => {
  const headers = config?.headers;
  const authorization =
    headers?.get?.("Authorization") ??
    headers?.Authorization ??
    headers?.authorization;
  return typeof authorization === "string" && /^\s*Bearer\s+\S+\s*$/i.test(authorization);
};

export const isConfirmedAuthFailure = (error) =>
  error?.response?.status === 401 &&
  error.response.data?.code === "AUTH_INVALID" &&
  hasBearerAuthorization(error.config);

const handleResponseError = (error) => {
  const friendlyMessage = handleApiError(error);
  error.friendlyMessage = friendlyMessage;
  if (isConfirmedAuthFailure(error)) {
    const requestUrl = String(error.config?.url || "").split("?")[0];
    window.dispatchEvent(new CustomEvent("tms-auth-invalid", {
      detail: {
        method: String(error.config?.method || "GET").toUpperCase(),
        url: requestUrl,
      },
    }));
  }
  return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handleResponseError);
apiV1.interceptors.response.use((response) => response, handleResponseError);

export const getCustomers = () => api.get("/customers");
export const addCustomer = (customer) => api.post("/customers", customer);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

export const getOrders = (q = "") => api.get("/orders", { params: q ? { q } : undefined });
export const getOrdersByCustomerId = (customer_id) => api.get(`/orders/${customer_id}`);
export const getOrderById = (id) => api.get(`/orders/detail/${id}`);
export const addOrder = (order) => api.post("/orders", order);
export const updateOrder = (id, order) => api.put(`/orders/${id}`, order);
export const updateOrderPayment = (id, payload) => api.post(`/orders/${id}/payment`, payload);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);

export const getMeasurements = (customer_id, dress_type) => api.get(`/measurements/${customer_id}`, { params: dress_type ? { dress_type } : undefined });
export const addMeasurements = (data) => api.post("/measurements", data);
export const updateMeasurement = (id, data) => api.put(`/measurements/${id}`, data);
export const deleteMeasurement = (id) => api.delete(`/measurements/${id}`);

export const getShopInfo = () => api.get("/shop");
export const saveShopInfo = (data) => api.post("/shop", data);

export const getSettings = () => api.get("/settings");
export const saveSettings = (data) => api.put("/settings", data);

export const getEmployees = () => api.get("/budget/employees");
export const addEmployee = (data) => api.post("/budget/employees", data);
export const updateEmployee = (id, data) => api.put(`/budget/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/budget/employees/${id}`);

export const getExpenses = () => api.get("/budget/expenses");
export const addExpense = (data) => api.post("/budget/expenses", data);
export const deleteExpense = (id) => api.delete(`/budget/expenses/${id}`);

export const getIncome = () => api.get("/budget/income");
export const addIncome = (data) => api.post("/budget/income", data);
export const deleteIncome = (id) => api.delete(`/budget/income/${id}`);

export const getSalaries = () => api.get("/budget/salaries");
export const addSalary = (data) => api.post("/budget/salaries", data);
export const updateSalary = (id, data) => api.put(`/budget/salaries/${id}`, data);

// Recycle bin
export const getRecycleBin = (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.type) searchParams.set("type", params.type);
  if (params.filter) searchParams.set("filter", params.filter);
  if (params.q) searchParams.set("q", params.q);
  const qs = searchParams.toString();
  const url = qs ? `/recycle-bin?${qs}` : "/recycle-bin";
  return api.get(url);
};

export const restoreRecycleBinItem = (type, id) => api.post(`/recycle-bin/${type}/${id}/restore`);
export const deleteRecycleBinItemForever = (type, id) => api.delete(`/recycle-bin/${type}/${id}`);
export const cleanupRecycleBin = () => api.post("/recycle-bin/cleanup");

// Auth
export const login = (email, password) => api.post("/auth/login", { email, password });
export const register = (name, email, password, shopName, supabaseConfig) =>
  api.post("/auth/register", {
    name,
    email,
    password,
    shopName,
    projectUrl: supabaseConfig?.projectUrl,
    projectName: supabaseConfig?.projectName,
    anonKey: supabaseConfig?.anonKey,
    connectionString: supabaseConfig?.connectionString,
    connectionHost: supabaseConfig?.connectionHost,
    connectionPort: supabaseConfig?.connectionPort,
    connectionDatabase: supabaseConfig?.connectionDatabase,
    connectionUsername: supabaseConfig?.connectionUsername,
    connectionPassword: supabaseConfig?.connectionPassword,
    sslMode: supabaseConfig?.sslMode,
  });
export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me");
export const changePassword = (currentPassword, newPassword) => api.post("/auth/change-password", { currentPassword, newPassword });
export const requestPasswordReset = (email) => api.post("/auth/forgot-password", { email });
export const resetPassword = (token, newPassword) => api.post("/auth/reset-password", { token, newPassword });
export const listApiKeys = () => apiV1.get("/api-keys");
export const createApiKey = (name, scopes) => apiV1.post("/api-keys", { name, scopes });
export const getExternalOrder = (orderId, apiKey) =>
  apiV1.get(`/orders/${orderId}`, { headers: { "X-API-Key": apiKey } });

// Backup
export const createBackup = () => api.post("/backup/create");
export const restoreBackup = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/backup/restore", formData, {
    headers: { "Content-Type": undefined },
  });
};

export const v1 = apiV1;

export { apiV1 };

// User Supabase configuration (personal project connection)
export const getUserSupabaseConfig = () => api.get("/user/supabase-config");
export const saveUserSupabaseConfig = (data) => api.post("/user/supabase-config", data);
export const testSupabaseConnection = (data) => api.post("/user/supabase-config/test", data);
export const disconnectUserSupabase = () => api.delete("/user/supabase-config");

export default api;
