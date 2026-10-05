import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, register as apiRegister, logout as apiLogout, getMe } from "../services/api";

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = "tms_auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validate = async () => {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const { token } = JSON.parse(stored);
        const res = await getMe();
        if (res.data?.user) {
          setUser({ token, user: res.data.user });
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setUser(null);
        }
      } catch (error) {
        // Keep the local session during a temporary network outage. The
        // server still validates the token whenever connectivity returns.
        if (error.response) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
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
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    setUser(authData);
    return authData;
  };

  const register = async (name, email, password, shopName) => {
    const res = await apiRegister(name, email, password, shopName);
    const authData = { token: res.data.token, user: res.data.user };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    setUser(authData);
    return authData;
  };

   const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // proceed with clearing even if server call fails
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
