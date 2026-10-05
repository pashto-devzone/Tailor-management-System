#!/usr/bin/env node
/**
 * Backend connectivity self-check.
 *
 * Answers the only question that matters when the mobile app reports
 * ERR_NETWORK: is something reachable on this machine's LAN address, right now?
 *
 *   npm run lan            check the port from Backend/.env (or PORT / 5000)
 *   npm run lan -- 5001    check a specific port
 *
 * Dependency-free on purpose: it must run even when the app itself is broken.
 */
const net = require("net");
const os = require("os");
const fs = require("fs");
const path = require("path");
const http = require("http");

// Read PORT from Backend/.env without loading the whole app.
function envValue(key) {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && match[1] === key) return match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return undefined;
}

const PORT = Number(process.argv[2] || process.env.PORT || envValue("PORT") || 5000);

function lanAddresses() {
  return Object.entries(os.networkInterfaces())
    .flatMap(([name, list]) => (list || []).map((i) => ({ name, ...i })))
    .filter((i) => i.family === "IPv4" && !i.internal);
}

/** Raw TCP connect test: proves routing/firewall, independent of HTTP. */
function tcpProbe(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok, detail) => {
      socket.destroy();
      resolve({ ok, detail });
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true, "connected"));
    socket.once("timeout", () => done(false, `timed out after ${timeout}ms (firewall drop?)`));
    socket.once("error", (err) => done(false, err.code || err.message));
  });
}

/** HTTP GET /health: proves the TMS backend really owns the port. */
function healthProbe(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(
      { host, port, path: "/health", timeout },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            /* not JSON - reported as-is below */
          }
          resolve({
            ok: res.statusCode === 200 && parsed?.status === "ok",
            detail: `HTTP ${res.statusCode}${parsed?.data ? ` database=${parsed.data.database} cloud=${parsed.data.cloudDatabase}` : ` ${body.slice(0, 60)}`}`,
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, detail: `no response in ${timeout}ms` });
    });
    req.on("error", (err) => resolve({ ok: false, detail: err.code || err.message }));
  });
}

async function main() {
  const addresses = lanAddresses();
  console.log("");
  console.log("=== TMS backend connectivity check ===");
  console.log("");
  console.log("This machine's IPv4 addresses (a phone must use one of these):");
  if (addresses.length === 0) {
    console.log("  (none found - the PC is not on a network the phone can reach)");
  }
  addresses.forEach((a) => console.log(`  ${a.address.padEnd(16)} ${a.name}`));
  console.log("");

  const targets = [{ host: "127.0.0.1", label: "this computer" },
    ...addresses.map((a) => ({ host: a.address, label: a.name }))];

  let anyOk = false;
  for (const target of targets) {
    const tcp = await tcpProbe(target.host, PORT);
    console.log(`  ${target.host}:${String(PORT).padEnd(5)} ${tcp.ok ? "TCP open" : `TCP ${tcp.detail}`}   [${target.label}]`);
    if (!tcp.ok) continue;
    const health = await healthProbe(target.host, PORT);
    console.log(`  ${" ".repeat(target.host.length + String(PORT).length + 1)}${health.ok ? "TMS backend answered /health" : `/health -> ${health.detail}`}`);
    if (health.ok) {
      anyOk = true;
      if (target.host !== "127.0.0.1") {
        console.log(`  ${" ".repeat(target.host.length + String(PORT).length + 1)}EXPO_PUBLIC_API_URL=http://${target.host}:${PORT}`);
      }
    }
  }

  console.log("");
  if (!anyOk) {
    console.log("RESULT: nothing answering TMS on this port.");
    console.log("  1. Start the backend in a SEPARATE terminal:  cd Backend && npm start");
    console.log("     and read the URL block it prints on startup.");
    console.log("  2. Still unreachable from the phone? Open the port in Windows");
    console.log("     Firewall from an Administrator PowerShell:  npm run firewall");
    console.log("  3. USB fallback (no firewall/Wi-Fi needed):");
    console.log(`     adb reverse tcp:${PORT} tcp:${PORT}  ->  EXPO_PUBLIC_API_URL=http://localhost:${PORT}`);
    console.log("");
    process.exitCode = 1;
  } else {
    console.log("RESULT: the backend answers. Copy the EXPO_PUBLIC_API_URL above into");
    console.log("        Android/.env, then restart Expo with:  npx expo start -c");
    console.log("        (or just use the in-app server address editor on the login screen)");
    console.log("");
  }
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exitCode = 1;
});
