import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
  setAuthToken,
  setAuthErrorHandler,
  clearAuthToken,
} from '../services/api';
import { saveSession, getSession, clearSession } from '../services/session';
import { ensureServerConnection } from '../services/serverConfig';

const AuthContext = createContext(null);

/**
 * Authentication + session state.
 *
 * - The JWT token (and minimal user object) is persisted in AsyncStorage so the
 *   session survives app restarts. The plain-text password is NEVER stored.
 * - On launch the stored token is validated against /api/auth/me. A network
 *   outage keeps the local session (cloud is authoritative but we don't erase
 *   local auth on a temporary connection failure). A 401 clears the session.
 * - 401 responses from ANY api call trigger the registered auth-error handler,
 *   which calls logout() and returns the user to the Login screen.
 *
 * The backend remains the authority for store/account authorization — the
 * client never trusts a user-supplied storeId.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // Guards against overlapping logout calls (e.g. several requests failing
  // with 401 at the same time).
  const loggingOutRef = useRef(false);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    // Call the server first while the bearer token is still attached so the
    // backend can delete the session, then clear the local state.
    try {
      await apiLogout();
    } catch {
      // proceed with clearing locally even if the server call fails
    }
    clearAuthToken();
    await clearSession();
    setUser(null);
    setToken(null);
    loggingOutRef.current = false;
  }, []);

  // Register the global 401 handler so any expired-session response logs out.
  useEffect(() => {
    setAuthErrorHandler(() => {
      logout();
    });
  }, [logout]);

  const restoreSession = useCallback(async () => {
    const session = await getSession();
    if (!session?.token) {
      // Nothing to validate yet, so don't hold the splash screen on a probe:
      // start resolving in the background so the Connection screen and the
      // first login attempt already know a live address.
      ensureServerConnection();
      setLoading(false);
      return;
    }
    setAuthToken(session.token);
    // Resolve the live server BEFORE the first request. Without this, /auth/me
    // would go to the static .env fallback and fail with a transport error even
    // when the backend is reachable under a different (DHCP) address, which
    // would wrongly look like "offline, keep the local session".
    await ensureServerConnection();
    try {
      const res = await getMe();
      // Legacy /auth/me returns { user: {...} }
      const meUser = res.data?.user || res.data;
      if (meUser && meUser.id) {
        const authData = { token: session.token, user: meUser };
        await saveSession(authData);
        setUser(meUser);
        setToken(session.token);
      } else {
        await clearSession();
        clearAuthToken();
      }
    } catch (error) {
      if (error.response) {
        // 401/invalid token -> clear the session
        await clearSession();
        clearAuthToken();
      } else {
        // Network error: keep the local session, server still validates later
        setUser(session.user || null);
        setToken(session.token);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email, password) => {
    // Pick up a server address that moved since the last resolution before
    // spending the user's credentials on a request that cannot arrive.
    await ensureServerConnection();
    const res = await apiLogin(email, password);
    // Legacy /auth/login returns { token, user } directly
    const authData = { token: res.data.token, user: res.data.user };
    setAuthToken(authData.token);
    await saveSession(authData);
    setUser(authData.user);
    setToken(authData.token);
    return authData;
  }, []);

  const register = useCallback(async (name, email, password, shopName) => {
    const res = await apiRegister(name, email, password, shopName);
    // Legacy /auth/register returns { token, user } directly
    const authData = { token: res.data.token, user: res.data.user };
    setAuthToken(authData.token);
    await saveSession(authData);
    setUser(authData.user);
    setToken(authData.token);
    return authData;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;