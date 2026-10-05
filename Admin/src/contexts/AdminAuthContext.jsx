import { createContext, useContext, useState, useEffect } from "react";
import { login as apiLogin, logout as apiLogout, getMe } from "../services/api";

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const stored = localStorage.getItem("tms_admin_auth");
        if (!stored) {
          if (!cancelled) setLoading(false);
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(stored);
        } catch (_) {
          localStorage.removeItem("tms_admin_auth");
          if (!cancelled) setLoading(false);
          return;
        }

        const token = parsed?.token;
        if (!token) {
          localStorage.removeItem("tms_admin_auth");
          if (!cancelled) setLoading(false);
          return;
        }

        try {
          const res = await getMe();
          if (!cancelled) {
            setAdmin(res.data?.data || parsed?.user || null);
          }
        } catch (_) {
          if (!cancelled) {
            localStorage.removeItem("tms_admin_auth");
            setAdmin(null);
          }
        }
      } catch (_) {
        if (!cancelled) {
          localStorage.removeItem("tms_admin_auth");
          setAdmin(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (email, password) => {
    const res = await apiLogin(email, password);
    const { token, user } = res.data?.data || {};
    localStorage.setItem("tms_admin_auth", JSON.stringify({ token, user }));
    setAdmin(user);
    return { success: true, user };
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (_) {}
    localStorage.removeItem("tms_admin_auth");
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login: handleLogin, logout: handleLogout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);