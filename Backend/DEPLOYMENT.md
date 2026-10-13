# Backend Deployment Guide

The Backend is the single HTTP API for the Tailor Management System. The
desktop (Electron) app, the Android app and any external integration all talk to
this one service, which stores all business data in **Supabase PostgreSQL**.

---

## 1. What this service is

* **Runtime:** Node.js + Express 5 (CommonJS).
* **Entry point:** `server.js`.
* **Database:** PostgreSQL via `pg`. Production uses a Supabase connection
  pooler. Business schema changes are applied through the documented SQL
  migrations; the password-recovery token table is created lazily by the
  recovery endpoint.
* **Authentication:** JWT bearer tokens (`JWT_SECRET`) for store users, plus
  HMAC-signed API keys (`API_KEY_SECRET`) for external integrations. The
  `/api/admin` routes use a separate `ADMIN_JWT_SECRET`.
* **Local-only database:** a SQLite file used *only* when running locally with
  no `DATABASE_URL`. Production never falls back to it.

## 2. Required Node.js version

```
Node.js >= 18
```

`engines.node` in `package.json` declares this. Developed and verified on
Node 22 LTS.

## 3. Install

```bash
cd Backend
npm install
```

Use `npm ci` on a hosting platform so the lockfile is honoured exactly.

## 4. Environment variables

Set these in your hosting provider's environment-variable settings. Copy
`.env.example` for the full documented list — it contains placeholders only.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. Enables error masking and strict CORS. |
| `PORT` | yes | The port the platform assigns. Defaults to `5000` locally. |
| `HOST` | no | Defaults to `0.0.0.0`, which is what hosting platforms need. |
| `DATABASE_URL` | **yes** | Supabase **pooler** connection string. Do not use the direct DB host. |
| `JWT_SECRET` | **yes** | >= 32 characters in production; enforced at startup. |
| `API_KEY_SECRET` | **yes** | >= 32 characters in production; enforced at startup. |
| `ADMIN_JWT_SECRET` | no | Without it `/api/admin/*` returns `503`. |
| `JWT_EXPIRES` | no | Defaults to `7d`. |
| `ALLOWED_ORIGINS` | production | Comma-separated browser origins. See section 8. |
| `PGPOOL_MAX` | no | Pool size, default `5`. |
| `PGCONNECT_TIMEOUT_MS` | no | Connect timeout, default `3000`. |
| `BACKUP_DIR` | no | Where backup ZIPs are written. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | recovery only | SMTP transport used to email single-use password recovery links. |
| `PASSWORD_RESET_URL` | recovery only | HTTPS URL of the deployed frontend `/reset-password` route. Recovery stays unavailable until SMTP and this URL are configured. |

### Supabase pooler

Use the pooler hostname, not the direct database host:

```
postgresql://USER:PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
```

`sslmode=no-verify` is required because the Supabase pooler presents a
self-signed certificate chain that fails Node's default verification. Keep the
existing working value; do not switch back to the direct database hostname.

### Secrets

No secret is hard-coded in this service. Values already present in the process
environment always win over any `.env` file, so a hosting platform does not need
a `.env` file at all. Never commit `.env` and never paste credentials into
issues, logs or documentation.

## 5. Start command

```bash
npm start        # node server.js  -> use this on the host
npm run dev      # nodemon, local only
npm run db:check # read-only Supabase connectivity diagnostic
```

`npm start` is the production entry point. The process must stay in the
foreground for the platform to supervise it; do not add a process manager inside
the container.

## 6. Health check

```
GET /health
```

Expected response when the cloud database is reachable:

```json
{
  "success": true,
  "status": "ok",
  "data": {
    "timestamp": "2026-01-01T00:00:00.000Z",
    "database": "ready",
    "localDatabase": "ready",
    "cloudDatabase": "online"
  }
}
```

* `cloudDatabase: "online"` is the value to assert on — it means the Supabase
  pool answered a live query.
* The HTTP port opens *before* the database is contacted, so the endpoint always
  responds. In production, a database failure closes the server and exits
  non-zero so the platform restarts it.
* `GET /` returns the service banner and version.

## 7. Database requirement

PostgreSQL (Supabase) is the only production database. The schema in
`migrations/001_initial.sql` is applied to Supabase out of band; the service
never creates or alters tables itself. Do not run migrations against production
as part of a deploy.

## 8. CORS

Two kinds of clients reach this API:

* **Non-browser clients** — Android/Expo, the packaged Electron app, `curl` and
  platform health probes send **no `Origin` header**. CORS does not apply to
  them and they are always allowed.
* **Browser clients** — a hosted web dashboard or the Admin panel always send
  `Origin` and must be listed explicitly in `ALLOWED_ORIGINS`
  (comma-separated, no trailing slash).

```
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

In production an empty `ALLOWED_ORIGINS` does **not** mean "allow everything":
because the API sets `credentials: true`, reflecting arbitrary origins would let
any website issue authenticated requests as a logged-in user. A startup warning
is logged when it is unset.

Set `ALLOW_PRIVATE_NETWORK_ORIGINS=1` only if a private/LAN origin genuinely
needs access in production. In development these origins are allowed
automatically.

Authentication itself is unaffected by CORS: clients send a bearer token, and
the server verifies it and the session row on every request.

## 9. Verifying a deployment

1. `GET /health` -> `"cloudDatabase": "online"`.
2. `GET /` -> `success: true`.
3. Authentication: `POST /api/v1/auth/login` with valid credentials returns a
   token; invalid credentials return `401`.
4. Authenticated read: `GET /api/v1/customers` with
   `Authorization: Bearer <token>` returns the store's customers.
5. `POST /api/v1/auth/logout` invalidates the session; the same token then
   returns `401`.
6. Unauthenticated access to a protected route returns `401`, not `500`.

Example:

```bash
curl -s https://YOUR-DOMAIN/health
```

## 10. Security notes

* **Secrets** live only in environment variables. `.env` is git-ignored.
* **Production error handling** — any 5xx returns a generic
  `"Internal server error"`. Stack traces, filesystem paths and driver messages
  are never sent to clients, and credentials are redacted from server logs.
* **TLS termination** — terminate HTTPS at the platform's proxy and keep the
  app talking HTTP internally, or configure TLS end-to-end.
* **Rate limiting** — enforced on `/api/v1/auth/*`, `/api/v1/tracking/*` and
  `/api/admin/*`. Behind a platform proxy these limits key off the proxy IP
  unless Express is configured to trust the proxy.
* **Connection pooling** — `PGPOOL_MAX` (default 5) is sized for a single small
  instance. Raise it only within the Supabase project's connection limit, and
  prefer the pooler or Supavisor when scaling out.
* **Ephemeral filesystem** — backup ZIPs are written to local disk
  (`BACKUP_DIR`, else the Desktop on Windows / temp dir elsewhere). That storage
  is ephemeral on most hosts, so a generated ZIP will not survive a restart and
  will not appear on a client's machine. All business data lives in PostgreSQL.
* **Graceful shutdown** — `SIGTERM`/`SIGINT` close the pool before exiting so
  deployments recycle without leaking connections.

## 11. Local development

```bash
cd Backend
cp .env.example .env      # then fill in a real DATABASE_URL
npm install
npm start
```

Helpers: `npm run lan` prints the LAN addresses a phone can use,
`npm run firewall` opens the Windows Firewall port. If `DATABASE_URL` is unset
the service falls back to a local SQLite file in `database/tailor.db` for
convenience — development only.
