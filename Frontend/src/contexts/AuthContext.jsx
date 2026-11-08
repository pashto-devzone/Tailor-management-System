import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, register as apiRegister, logout as apiLogout, getMe, setAuthToken } from "../services/api";

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = "tms_auth";
const electronAuth = () => window.electronAPI?.auth;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleInvalidSession = async () => {
      setAuthToken(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      const secureAuth = electronAuth();
      if (secureAuth) await secureAuth.clear();
      setUser(null);
    };
    window.addEventListener("tms-auth-invalid", handleInvalidSession);
    return () => window.removeEventListener("tms-auth-invalid", handleInvalidSession);
  }, []);

  useEffect(() => {
    const validate = async () => {
      const secureAuth = electronAuth();
      let storedSession = null;
      if (secureAuth) {
        const result = await secureAuth.load();
        storedSession = result?.ok ? result.session : null;
        if (!storedSession) {
          try {
            const legacy = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
            if (legacy?.token) {
              const saved = await secureAuth.save(legacy);
              if (saved?.ok) {
                storedSession = legacy;
                localStorage.removeItem(AUTH_STORAGE_KEY);
              }
            }
          } catch {
            // Ignore malformed legacy data and show the login screen.
          }
        }
      } else {
        try {
          storedSession = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
        } catch {
          storedSession = null;
        }
      }

      if (!storedSession?.token) {
        setLoading(false);
        return;
      }

      try {
        const { token } = storedSession;
        setAuthToken(token);
        if (storedSession.user) setUser(storedSession);
        const res = await getMe();
        if (res.data?.user) {
          const authData = { token, user: res.data.user };
          setUser(authData);
          if (secureAuth) await secureAuth.save(authData);
          else localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        } else {
          if (secureAuth) await secureAuth.clear();
          else localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthToken(null);
          setUser(null);
        }
      } catch (error) {
        if (error.response) {
          if (secureAuth) await secureAuth.clear();
          else localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    const authData = { token: res.data.token, user: res.data.user };
    setAuthToken(authData.token);
    const secureAuth = electronAuth();
    const saved = secureAuth
      ? await secureAuth.save(authData)
      : (localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData)), { ok: true });
    if (!saved?.ok) {
      setAuthToken(null);
      throw new Error(saved?.message || "Unable to securely save the login session.");
    }
    setUser(authData);
    return authData;
  };

  const register = async (name, email, password, shopName, supabaseConfig) => {
    const res = await apiRegister(name, email, password, shopName, supabaseConfig);
    const authData = { token: res.data.token, user: res.data.user };
    setAuthToken(authData.token);
    const secureAuth = electronAuth();
    const saved = secureAuth
      ? await secureAuth.save(authData)
      : (localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData)), { ok: true });
    if (!saved?.ok) {
      setAuthToken(null);
      throw new Error(saved?.message || "Unable to securely save the login session.");
    }
    setUser(authData);
    return authData;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // proceed with clearing even if server call fails
    }
    const secureAuth = electronAuth();
    if (secureAuth) await secureAuth.clear();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
