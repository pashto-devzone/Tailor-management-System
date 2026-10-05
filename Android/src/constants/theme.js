/**
 * Centralized theme for the Tailor Management System Android app.
 *
 * Design system: ONE blue brand family (sky blue, matching the login/register
 * buttons) with white surfaces, dark-navy headings, neutral gray secondary
 * text, and very light gray borders. Never invent colors per screen — add new
 * values here instead.
 */
export const theme = {
  colors: {
    // Branding — one blue family for headers, primary actions and highlights
    primary: '#0369a1', // sky-700 — app bar / brand blue (white text passes AA)
    primaryDark: '#075985', // sky-800 — pressed states / strong blue text
    primaryLight: '#e0f2fe', // sky-100 — subtle blue backgrounds / highlights
    primaryLighter: '#f0f9ff', // sky-50 — very light blue surface tint
    accent: '#0ea5e9', // sky-500 — primary buttons (login/register)
    accentDark: '#0284c7', // sky-600 — accent pressed state

    // Surfaces
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    cardAlt: '#f8fafc',

    // Borders / dividers
    border: '#e8eef5',
    borderDark: '#cbd5e1',

    // Text
    text: '#1e293b', // body / dark navy-slate
    textHeading: '#0f172a', // navy — important headings/numbers
    textSecondary: '#64748b', // neutral gray — labels / descriptions
    textTertiary: '#94a3b8', // muted gray — helper text
    textInverse: '#ffffff',

    // Status / feedback (used sparingly — small indicators only)
    success: '#16a34a',
    successBg: '#dcfce7',
    warning: '#d97706',
    warningBg: '#fef3c7',
    error: '#dc2626',
    errorBg: '#fee2e2',
    info: '#0ea5e9',
    infoBg: '#e0f2fe',

    // Order statuses
    pending: '#f59e0b',
    pendingBg: '#fef3c7',
    ready: '#0ea5e9',
    readyBg: '#e0f2fe',
    delivered: '#16a34a',
    deliveredBg: '#dcfce7',

    // Payment statuses
    unpaid: '#dc2626',
    unpaidBg: '#fee2e2',
    partial: '#d97706',
    partialBg: '#fef3c7',
    paid: '#16a34a',
    paidBg: '#dcfce7',

    // Shadows
    shadow: 'rgba(15, 23, 42, 0.06)',
    shadowHover: 'rgba(15, 23, 42, 0.12)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
    xl: 50,
    full: 999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    title: 28,
    h1: 32,
  },
  elevation: {
    sm: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
  },
};

export const STATUS_BAR_HEIGHT = 0; // handled by SafeArea
export default theme;