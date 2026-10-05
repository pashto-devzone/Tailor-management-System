/**
 * Clipboard helper.
 *
 * React Native still ships `Clipboard` in core (deprecated but present in
 * RN 0.86 / Expo Go). It is required lazily so the deprecation notice is only
 * emitted when the user actually copies something, and every call is guarded so
 * a failure can never crash a screen.
 *
 * NO server-side secret is ever copied from this app — only the user-facing
 * Orders API key / API endpoint that the owner generated themselves.
 */
export const copyToClipboard = async (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  if (!text.trim()) return false;
  try {
    // eslint-disable-next-line global-require
    const { Clipboard } = require('react-native');
    if (Clipboard && typeof Clipboard.setString === 'function') {
      Clipboard.setString(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
};

export default { copyToClipboard };
