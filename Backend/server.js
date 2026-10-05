const os = require("os");
const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const { getCorsOptions } = require("./config/corsOptions");

const customerRoutes = require("./routes/customerRoutes");
const measurementRoutes = require("./routes/measurementRoutes");
const orderRoutes = require("./routes/orderRoutes");
const shopRoutes = require("./routes/shopRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const backupRoutes = require("./routes/backupRoutes");
const recycleBinRoutes = require("./routes/recycleBinRoutes");
const authRoutes = require("./routes/authRoutes");
const updateRoutes = require("./routes/updateRoutes");
const v1Routes = require("./routes/v1/index");
const adminRoutes = require("./routes/admin/index");
const adminAuthRoutes = require("./routes/admin/auth");
const { authenticate, requireStore, requireRole } = require("./middlewares/auth");
const { authenticateAdmin } = require("./middlewares/adminAuth");

const app = express();

const isProduction = process.env.NODE_ENV === "production";

// Do not advertise the framework and its version to every client.
app.disable("x-powered-by");

app.use(cors(getCorsOptions()));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/**
 * Body-parser failures (malformed JSON, oversized payload, wrong content type)
 * are client errors, but their default messages describe the parser internals
 * and the request byte offsets. Replace them with a stable, safe message in
 * production while keeping the full detail in the development console.
 */
app.use((err, req, res, next) => {
  if (!err || !err.type || !err.type.startsWith("entity.")) return next(err);

  const statusCode = err.status || err.statusCode || 400;
  const clientMessage =
    err.type === "entity.too.large"
      ? "Request body is too large"
      : "Malformed request body";

  console.warn(`[body] ${req.method} ${req.originalUrl} -> ${statusCode} ${err.type}: ${redact(err.message)}`);

  res.status(statusCode).json({
    success: false,
    message: isProduction ? clientMessage : err.message,
  });
});

/**
 * Inbound request log (development only).
 *
 * This is the single most useful tool when a mobile device reports
 * ERR_NETWORK: if a request shows up in the app's log but NOT here, the
 * request never left the phone or was blocked by the Windows firewall —
 * it is not an application bug. Nothing sensitive is logged: no bodies,
 * no Authorization headers, no tokens.
 */
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(
        `[http] ${req.method} ${req.originalUrl} <- ${req.socket.remoteAddress} ` +
          `${res.statusCode} in ${Date.now() - startedAt}ms`
      );
    });
    next();
  });
}

/** Every non-internal IPv4 address a phone on the same Wi-Fi could use. */
function lanAddresses() {
  return Object.entries(os.networkInterfaces()).flatMap(([, list]) =>
    (list || []).filter((iface) => iface.family === "IPv4" && !iface.internal)
  );
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Tailor Shop Management API is running",
    data: { version: "1.0.0" },
  });
});

/**
 * Database readiness. The HTTP port opens immediately (see startServer) so a
 * slow or unreachable Supabase never stops the phone from connecting; /health
 * simply reports the real state instead of the app guessing from a failure.
 */
let databaseState = "initializing";

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    data: {
      timestamp: new Date().toISOString(),
      database: databaseState,
      localDatabase: databaseState === "ready" ? "ready" : databaseState,
      cloudDatabase: db.cloudOnline ? "online" : "offline",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/update", updateRoutes);

app.use("/api/v1", v1Routes);

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", authenticateAdmin, adminRoutes);

// Legacy routes (backward compatibility with Electron desktop app)
app.use("/api/customers", authenticate, requireStore, customerRoutes);
app.use("/api/measurements", authenticate, requireStore, measurementRoutes);
app.use("/api/orders", authenticate, requireStore, orderRoutes);
app.use("/api/shop", authenticate, requireStore, shopRoutes);
app.use("/api/settings", authenticate, requireStore, settingsRoutes);
app.use("/api/backup", authenticate, requireStore, backupRoutes);
app.use("/api/budget", authenticate, requireStore, budgetRoutes);
app.use("/api", authenticate, requireStore, recycleBinRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route nahin mili" });
});

/**
 * Strips anything that looks like a credential out of an error message before
 * it is written to the server log. node-postgres embeds the connection string
 * in some driver errors, so an unfiltered log line can leak the DB password
 * into a hosting provider's log dashboard.
 */
function redact(message) {
  return String(message)
    .replace(/\/\/[^:@/\s]+:[^@/\s]+@/g, "//***:***@")
    .replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1***MASKED***")
    .replace(/((?:secret|password|token|api[_-]?key)\s*[=:]\s*)\S+/gi, "$1***MASKED***");
}

/**
 * Terminal error handler. The full error object is logged server-side for
 * diagnostics, but the HTTP response only ever carries a safe message: in
 * production a 500 collapses to a generic string so stack traces, filesystem
 * paths and driver messages never reach a client.
 */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Server mein masla hai";

  console.error(
    `[error] ${req.method} ${req.originalUrl} -> ${statusCode} ` +
      `${err.code || "NO_CODE"}: ${redact(message)}`
  );
  if (!isProduction && err.stack) console.error(err.stack);

  const safeMessage = isProduction && statusCode >= 500
    ? "Internal server error"
    : message;

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    ...(!isProduction && err.code ? { errorCode: err.code } : {}),
  });
});

const PORT = Number(process.env.PORT || 5000);
// Bind to every interface by default. Local development needs this so a phone
// on the same Wi-Fi can reach the PC, and hosting platforms route traffic to
// the container through a non-loopback address. Override with HOST if a
// deployment must be restricted to loopback.
const HOST = process.env.HOST || "0.0.0.0";

function printProductionInfo() {
  console.log(`[server] Tailor Management System API listening on ${HOST}:${PORT} (production)`);
  console.log(`[server] Health check: GET /health`);
}

/**
 * Development-only banner: prints the LAN addresses a phone can use plus the
 * Windows firewall / adb hints. None of this applies to a hosted deployment, so
 * production gets the short banner instead.
 */
function printDevConnectivityInfo() {
  const addresses = lanAddresses();
  console.log("".padEnd(60, "="));
  console.log(`  Tailor Management System API — listening on port ${PORT}`);
  console.log("".padEnd(60, "="));
  console.log(`  This computer : http://localhost:${PORT}  (health: /health)`);
  if (addresses.length === 0) {
    console.log("  Network       : no LAN IPv4 adapter found.");
    console.log("                  The phone cannot reach this PC without one.");
    console.log("                  Connect to Wi-Fi/Ethernet and restart the backend.");
  } else {
    addresses.forEach((iface) => {
      console.log(`  Phone / LAN   : http://${iface.address}:${PORT}   (${iface.name})`);
    });
    console.log("");
    console.log("  Put this in Android/.env if the phone reports ERR_NETWORK:");
    console.log(`    EXPO_PUBLIC_API_URL=http://${(addresses[0] || {}).address || "127.0.0.1"}:${PORT}`);
  }
  console.log("");
  console.log("  If the phone still cannot connect, open the port in Windows");
  console.log("  Firewall (run once from an Administrator PowerShell):");
  console.log(`    npm run firewall`);
  console.log("  or plug the phone in over USB and run:");
  console.log(`    adb reverse tcp:${PORT} tcp:${PORT}   # then use http://localhost:${PORT}`);
  console.log("".padEnd(60, "="));
}

/**
 * Open the HTTP port FIRST, before touching the database.
 *
 * A slow or unreachable database must not stop the process from listening:
 * hosting platforms mark a boot as failed when the port never opens, and the
 * mobile app needs a reachable /health to report the real database state.
 * The database result is reported through /health and startServer().
 */
function startHttpServer() {
  const server = app.listen(PORT, HOST, isProduction ? printProductionInfo : printDevConnectivityInfo);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[ fatal ] Port ${PORT} is already in use, so the backend could not start.`);
      console.error(`           Another backend instance (or another app) owns it.`);
      if (!isProduction) {
        console.error(`           Find it with:  netstat -ano | findstr :${PORT}`);
        console.error(`           Then close that process, or set PORT=5001 in Backend/.env `);
        console.error(`           and point EXPO_PUBLIC_API_URL at the new port.\n`);
      } else {
        console.error(`           Set a free PORT for this deployment.\n`);
      }
    } else if (err.code === "EACCES") {
      console.error(`\n[ fatal ] Not permitted to bind port ${PORT} (${HOST}). Try another port.`);
    } else {
      console.error("Failed to bind server:", err);
    }
    process.exitCode = 1;
  });
  return server;
}

async function startServer() {
  const server = startHttpServer();

  try {
    await db.initialize();
    databaseState = "ready";
    console.log("Database initialized successfully");
  } catch (err) {
    databaseState = "failed";
    console.error("\n[ fatal ] The database failed to initialize, so API requests that");
    console.error("           need data will return errors. The HTTP server is still");
    console.error("           reachable so clients and monitoring can report this clearly.");
    console.error(`           Reason: ${redact(err.message)}\n`);

    if (isProduction) {
      // A production deployment must never serve traffic against a database it
      // cannot reach; the platform should restart it once the DB is available.
      server.close(() => process.exit(1));
    }
  }

  /**
   * Graceful shutdown. Hosting platforms send SIGTERM before recycling a
   * container: closing the pool releases PostgreSQL connections cleanly instead
   * of leaving them to time out and eventually exhaust the server's slots.
   */
  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down gracefully`);
    server.close(async () => {
      await db.close().catch(() => {});
      process.exit(0);
    });
    // Do not hang forever if a client keeps a socket open.
    setTimeout(() => process.exit(0), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
