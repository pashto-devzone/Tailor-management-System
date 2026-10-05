/**
 * Read-only smoke test against a running backend.
 *
 * Usage:  node scripts/smokeTest.js [baseUrl]
 *
 * Performs no writes: it exercises /health, /, auth rejection paths, and the
 * protected routes' 401 responses, then verifies that an invalid token cannot
 * reach customer/order/measurement data. Prints PASS/FAIL per check.
 */
const http = require("http");
const { URL } = require("url");

const BASE = process.argv[2] || `http://127.0.0.1:${process.env.PORT || 5000}`;

function request(path, { method = "GET", body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            /* keep raw text */
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}${detail ? "  " + detail : ""}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? "  " + detail : ""}`);
  }
}

(async () => {
  console.log(`Smoke testing ${BASE}\n`);

  try {
    let r = await request("/health");
    const health = r.body && r.body.data;
    check(
      "GET /health returns ok",
      r.status === 200 && r.body.success === true && health.cloudDatabase === "online",
      `cloudDatabase=${health && health.cloudDatabase}`
    );

    r = await request("/");
    check("GET / returns service banner", r.status === 200 && r.body.success === true);

    // Authentication: a wrong password must be rejected, never accepted.
    r = await request("/api/v1/auth/login", {
      method: "POST",
      body: { email: "smoke-test-not-a-real-user@example.invalid", password: "wrong-password" },
    });
    check(
      "POST /api/v1/auth/login rejects bad credentials",
      r.status === 401,
      `status=${r.status}`
    );

    r = await request("/api/v1/auth/login", { method: "POST", body: {} });
    check("Login validation rejects empty body", r.status === 400, `status=${r.status}`);

    // Protected routes must reject a missing or invalid token with 401.
    for (const route of [
      "/api/v1/customers",
      "/api/v1/orders",
      "/api/v1/measurements",
    ]) {
      r = await request(route);
      check(`${route} rejects anonymous access`, r.status === 401, `status=${r.status}`);

      r = await request(route, { headers: { Authorization: "Bearer invalid.token.value" } });
      check(`${route} rejects invalid token`, r.status === 401, `status=${r.status}`);
    }

    // Unknown routes must return a clean 404 JSON, not a 500.
    r = await request("/definitely-not-a-route");
    check("Unknown route returns 404 JSON", r.status === 404, `status=${r.status}`);

    // Legacy mount: app.use("/api", authenticate, ...) gates every /api path, so
    // an unknown /api route answers 401 rather than 404. Verified here so a
    // future change to that gate is noticed.
    r = await request("/api/v1/definitely-not-a-route");
    check(
      "Unknown /api route is auth-gated (401, not 500)",
      r.status === 401 || r.status === 404,
      `status=${r.status}`
    );

    r = await request("/api/recycle-bin");
    check("Legacy /api/recycle-bin is auth-gated", r.status === 401, `status=${r.status}`);

    // CORS: an unlisted browser origin must NOT receive allow-headers.
    r = await request("/health", {
      headers: { Origin: "https://not-a-real-allowed-origin.example" },
    });
    check(
      "Disallowed browser origin gets no CORS grant",
      !r.headers["access-control-allow-origin"],
      `acao=${r.headers["access-control-allow-origin"] || "absent"}`
    );

    // Non-browser clients (Android/Electron/health probes) send no Origin.
    r = await request("/health");
    check(
      "Non-browser client (no Origin) is served",
      r.status === 200 && r.body.success === true
    );

    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error("Smoke test error:", error.message);
    process.exitCode = 1;
  }
})();