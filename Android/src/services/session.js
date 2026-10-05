import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Session persistence for the Android app.
 *
 * Stores only the authentication token + minimal user object returned by the
 * existing backend login/register contract. The plain-text password is NEVER
 * stored. AsyncStorage is the persistent store (not a second database).
 *
 * Key mirrors the desktop app ("tms_auth") so the contracts stay aligned.
 */
const AUTH_KEY = 'tms_auth';

export const saveSession = async (session) => {
  if (!session) {
    await AsyncStorage.removeItem(AUTH_KEY);
    return;
  }
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(session));
};

export const getSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
};

export default { saveSession, getSession, clearSession };