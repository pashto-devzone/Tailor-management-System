import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE || "http://localhost:5000/api/admin";

const getAdminToken = () => {
  try {
    const stored = localStorage.getItem("tms_admin_auth");
    if (stored) {
      const { token } = JSON.parse(stored);
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch (_) {}
  return {};
};

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const authHeader = getAdminToken();
  Object.entries(authHeader).forEach(([key, value]) => {
    config.headers[key] = value;
  });
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.friendlyMessage = "Network connection failed. Please check your internet connection.";
    } else if (error.response.status === 401) {
      error.friendlyMessage = "Your session has expired. Please log in again.";
    } else if (error.response.status === 403) {
      error.friendlyMessage = "You do not have permission to access this area.";
    } else if (error.response.status === 404) {
      error.friendlyMessage = "Resource not found.";
    } else if (error.response.status === 429) {
      error.friendlyMessage = "Too many requests. Please try again later.";
    } else {
      error.friendlyMessage = error.response?.data?.message || "Something went wrong. Please try again.";
    }
    return Promise.reject(error);
  }
);

export const login = (email, password) => api.post("/auth/login", { email, password });
export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get("/me");

export const getDashboardStats = () => api.get("/dashboard/stats");

export const getStores = (params = {}) => api.get("/stores", { params });
export const getStoreById = (id) => api.get(`/stores/${id}`);
export const updateStoreStatus = (id, status) => api.put(`/stores/${id}/status`, { status });

export const getUsers = (params = {}) => api.get("/users", { params });
export const getUserById = (id) => api.get(`/users/${id}`);

export const getActivityLog = (params = {}) => api.get("/activity", { params });

export default api;
