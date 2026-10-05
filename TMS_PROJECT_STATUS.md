# TMS Project Status

Snapshot: 2026-09-14

## Architecture

- Electron starts the local Express backend as a child process.
- The desktop backend connects directly to the online PostgreSQL/Supabase
  database. There is no local SQLite database in production: `initialize()`
  returns as soon as the PostgreSQL connection succeeds and never loads `sql.js`.
- The React renderer talks to the local backend only.
- `DATABASE_URL` is REQUIRED for production desktop builds. If it is missing,
  the backend fails fast instead of falling back to a local database.

## Online-only behavior (1.5.1)

All authentication, CRUD, printing, settings, and recycle-bin operations run
against the online PostgreSQL/Supabase database. There is no local database and
no offline mode. If PostgreSQL is unreachable the backend does not start, so
Electron reports that the backend stopped before `/health` became ready. There
is no background offline write queue and no synchronization layer.

## SECURITY NOTE - open issue

Because the Express backend runs on the end-user machine, the packaged
installer necessarily carries the server-side `DATABASE_URL` (which embeds the
PostgreSQL username and password) together with `JWT_SECRET` and
`API_KEY_SECRET`. Anyone who has the installer can read those values. The
credential in use is a shared, project-wide PostgreSQL role while tenant
isolation is enforced only in application code (`store_id` filters), so a
client can bypass isolation and reach every store's data.

This is NOT safe for wide distribution as shipped. Remediation options:

1. Host the Express backend remotely. Clients call it over HTTPS and hold no
   database credentials. `Frontend/src/services/api.js` already honours
   `VITE_API_URL`, so the renderer can be pointed at a remote origin.
2. Move the client to Supabase RLS with a distributable public (anon) key and a
   least-privilege role, removing direct `pg` access from the client.

## Authentication and isolation

The existing bcrypt/JWT/session flow remains in place. Protected routes derive
the store from the authenticated session. The desktop JWT remains locally
verifiable, but offline session persistence and account-switching need an
end-to-end regression test before release sign-off.

## Orders API

The versioned API includes:

- `GET /api/v1/orders/{orderId}` for authenticated order/customer JSON lookup.
- `POST /api/v1/orders/external` for authenticated external order creation.

Both use the store-scoped `X-API-Key` header. Lookup requires `orders:read`;
creation requires `orders:write`. API keys are hashed with `API_KEY_SECRET`;
the raw key is returned only when created. Settings displays a generated
store-scoped key and a copyable endpoint based on `VITE_PUBLIC_API_URL`
(falling back to the configured API origin). Raw keys are stored locally only
under a store-specific browser key and are shown only after generation.

## Version and Electron startup

The application version is `1.5.1` in the root package metadata, shared
version JSON, and footer fallback. Electron waits for the local `/health`
endpoint, which now becomes ready even when Supabase DNS or PostgreSQL is
unreachable. The installer was not built.

## Environment variables

Required for secure deployments: `JWT_SECRET`, `API_KEY_SECRET`, and
`DATABASE_URL` when cloud PostgreSQL is enabled. `PORT`, `TAILOR_DB_PATH`, and
`TAILOR_BACKUPS_DIR` are supplied by Electron as needed. `ADMIN_JWT_SECRET`
is only required by the frozen Admin subsystem and is not required for normal
TMS desktop routes.

## Android app and LAN connectivity

The Expo app (`Android/`) is a client of the same Express backend; it holds no
database credentials. The backend binds `0.0.0.0` and
`Backend/config/corsOptions.js` allows loopback/private-network origins (native
apps send no `Origin` at all) so a phone on the shop Wi-Fi can reach it.

Because the PC's address is handed out by DHCP, a single baked-in URL is not
reliable. `Android/src/services/serverConfig.js` therefore builds an ordered
candidate list (address saved on the device → `EXPO_PUBLIC_API_URL` → Expo dev
host → localhost), probes each with `GET /health`, and adopts the first that
returns the TMS health envelope. The result is applied per request, so a changed
address takes effect without rebuilding the bundle. After two consecutive
transport failures it re-probes and switches silently, which is the DHCP case.

`ConnectionScreen` (reachable from the login screen and More ▸ Connection) is
the manual escape hatch: it shows what was tried and why each attempt failed,
and stores a typed address in `AsyncStorage`. Only a base URL is ever stored —
no token, password, or server-side secret.

Backend helpers: `npm start`, `npm run lan` (prints the LAN address to use and
whether the port really answers), `npm run firewall` (opens the Windows Firewall
port from an Administrator PowerShell). `adb reverse tcp:5000 tcp:5000` covers
the no-Wi-Fi USB case.

## Tests performed

- `node -e ... db.initialize()` with an unreachable configured cloud host:
  local SQLite initialized successfully and cloud failure was non-fatal.
- Backend JavaScript syntax checks passed.
- Backend started on port 5123 and `GET /health` returned HTTP 200.
- Frontend `npm run build` completed successfully after the Orders, auth,
  offline-banner, and Settings API changes.
- Orders search now sends `q` to the backend and the initial Orders request is
  no longer duplicated by competing effects.
- Temporary network failures no longer erase the locally stored auth session.
- The versioned order lookup route was added and scoped to the API key's store.
- The Orders API Settings card is collapsible and includes copyable key and
  endpoint controls.
- No installer build, Android work, Admin feature work, or publishing was
  performed.
- Budget rendering was hardened against PostgreSQL/SQLite numeric values
  arriving as strings; employee, expense, and income amounts are normalized
  before formatting.
- Android: `getHealth()` and `getOrdersApiEndpoint()` referenced `BASE_URL`, an
  identifier left behind by the serverConfig refactor. Both threw
  `ReferenceError` on call. Both now resolve the base through `getServerUrl()`.
- Android: `notifyNetworkFailure` was imported but never invoked, so the DHCP
  failover never ran. It is now called on every transport failure with the bare
  server root (the interceptor's `/api` suffix is stripped first, otherwise the
  candidate comparison in serverConfig could never match).
- Android: nothing invoked `ensureServerConnection()`, so probing never ran and
  the app silently used the static `.env` address forever. It now runs before
  `/auth/me` on launch and before the login request.
- Android: added `ConnectionScreen` and registered it in both the authenticated
  and pre-login stacks, plus a More menu entry and a login-screen link — the app
  already told users to open "More ▸ Connection", but no such screen existed.
- `MoreScreen` no longer displays the frozen import-time `API_BASE_URL`
  snapshot; it shows the live address and connection status.
- `check-imports.cjs` reported `export async function` names as missing exports
  (false positive); its pattern now allows `async` and generator functions.
- Added `scripts/check-undefined.cjs`, a `no-undef` pass. Verified it catches the
  original `BASE_URL` bug that `check-all-syntax.cjs` and `check-imports.cjs`
  both reported as clean.
- Added `scripts/test-url-logic.cjs`, which exercises `serverRootOf` against
  `/api`, `/api/v1`, trailing-slash and origin-only inputs.
- Android static checks all pass: 35/35 parse, all named imports resolve, all
  `styles.*` references resolve, no undefined identifiers, URL logic 7/7.

## Remaining limitations

Two-account cloud isolation and a live Supabase CRUD/sync test still require
execution against a reachable deployment. Offline CRUD is intentionally not
advertised; offline startup is supported without pretending cloud data is
available.

The obsolete root `dist` installer-output directory was removed during
cleanup. `Frontend/dist` was retained because Electron can use it as the
packaged/static frontend entry point.
