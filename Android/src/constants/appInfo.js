import Constants from 'expo-constants';

/**
 * Central application metadata.
 * Version is read from app.json (Expo manifest) so it stays in sync with the
 * configured Android / iOS versions.
 */
export const appInfo = {
  applicationName: 'Tailor Management System',
  version:
    Constants?.manifest?.version ||
    Constants?.expoConfig?.version ||
    '1.0.0',
  developer: 'Yaseen Arman',
  description: 'Tailor Management System',
};

export default appInfo;