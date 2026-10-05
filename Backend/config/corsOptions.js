/**
 * CORS policy shared by the desktop (Electron/Vite) frontend, the mobile app and
 * the hosted production deployment.
 *
 * Two audiences need to reach this API:
 *
 *  - Non-browser clients, which send NO `Origin` header at all:
 *      Android/Expo (React Native), the packaged Electron app, curl and hosting
 *      provider health probes. These are matched by the `!origin` rule and are
 *      always allowed, because CORS does not apply to them.
 *  - Browser clients, which always send an `Origin` and therefore must be listed
 *      explicitly.
 *
 * Development (NODE_ENV != production):
 *   localhost, private/LAN and Expo origins are accepted automatically so a
 *   phone on the shop Wi-Fi, or the Vite dev server, can reach a locally running
 *   backend whose LAN address changes with DHCP.
 *
 * Production:
 *   Only origins in ALLOWED_ORIGINS are accepted. Private-network and localhost
 *   origins are NOT accepted unless ALLOW_PRIVATE_NETWORK_ORIGINS=1 is set
 *   explicitly, and an empty ALLOWED_ORIGINS never means "allow everything" —
 *   combined with `credentials: true` that would let any website issue
 *   authenticated requests as a logged-in user.
 *
 * Rejected origins are answered WITHOUT CORS headers rather than with a thrown
 * error: a throw turned every disallowed request into a 500, which browsers
 * then reported as an opaque `ERR_NETWORK` instead of a real CORS message.
 */
const PRIVATE_ORIGIN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?::\d{2,5})?$/i;

const EXPO_HOSTED_ORIGIN =
  /^https?:\/\/(?:[\w-]+\.)*(?:exp\.host|expo\.io|expo\.dev|snack\.expo\.io)(?::\d{2,5})?$/i;

// Origins that are not real remote sites: the packaged Electron app renders
// from the filesystem, and sandboxed webviews report "null".
const ALWAYS_ALLOWED = new Set(["file://", "null", "capacitor://localhost"]);

function parseConfiguredOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function getCorsOptions() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.ELECTRON_RUN_AS_NODE === "1";

  const configuredOrigins = parseConfiguredOrigins();

  // Private/loopback origins are convenient in development and meaningless on a
  // public server, so they stay off in production unless opted into.
  const allowPrivateNetwork =
    process.env.ALLOW_PRIVATE_NETWORK_ORIGINS === "1" ||
    (!isProduction && process.env.ALLOW_PRIVATE_NETWORK_ORIGINS !== "0");

  const isAllowed = (origin) => {
    if (!origin) return true; // native apps, curl, health probes
    if (ALWAYS_ALLOWED.has(origin)) return true;
    if (configuredOrigins.includes(origin)) return true;
    if (allowPrivateNetwork && (PRIVATE_ORIGIN.test(origin) || EXPO_HOSTED_ORIGIN.test(origin))) {
      return true;
    }
    return false;
  };

  if (isProduction && configuredOrigins.length === 0) {
    console.warn(
      "[cors] ALLOWED_ORIGINS is not set. Browser clients will be rejected until it is " +
        "configured; non-browser clients (Android, Electron, health probes) are unaffected."
    );
  }

  return {
    origin: (origin, callback) => {
      if (!isAllowed(origin)) {
        console.warn(
          `[cors] Origin not allowed: ${origin} ` +
            `(ALLOWED_ORIGINS=${configuredOrigins.join(",") || "-"}, ` +
            `ALLOW_PRIVATE_NETWORK_ORIGINS=${allowPrivateNetwork ? "1" : "0"})`
        );
        return callback(null, false);
      }
      return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

module.exports = { getCorsOptions };
