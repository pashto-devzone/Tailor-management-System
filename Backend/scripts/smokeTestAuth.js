/**
 * Authenticated read-only smoke test against a running backend.
 *
 * Usage:  node scripts/smokeTestAuth.js <baseUrl> <email> <password>
 *
 * Logs in with real credentials, then performs READ-ONLY requests against the
 * customer, order and measurement APIs to prove the routes work end to end
 * against PostgreSQL. It never creates, updates or deletes records.
 */
const http = require("http");
const { URL } = require("url");

const BASE = process.argv[2] || `http://127.0.0.1:${process.env.PORT || 5000}`;
const EMAIL = process.argv[3];
const PASSWORD = process.argv[4];

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
            /* keep raw */
          }
          resolve({ status: res.statusCode, body: parsed });
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

function countOf(body) {
  if (Array.isArray(body)) return body.length;
  if (body && Array.isArray(body.data)) return body.data.length;
  if (body && Array.isArray(body.customers)) return body.customers.length;
  if (body && Array.isArray(body.orders)) return body.orders.length;
  if (body && Array.isArray(body.measurements)) return body.measurements.length;
  return null;
}

(async () => {
  if (!EMAIL || !PASSWORD) {
    console.log("usage: node scripts/smokeTestAuth.js <baseUrl> <email> <password>");
    process.exit(1);
  }
  console.log(`Authenticated smoke test against ${BASE}\n`);

  try {
    let r = await request("/health");
    check(
      "GET /health cloudDatabase online",
      r.body?.data?.cloudDatabase === "online",
      `cloudDatabase=${r.body?.data?.cloudDatabase}`
    );

    r = await request("/api/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    const token = r.body?.token || r.body?.data?.token;
    check("POST /api/v1/auth/login succeeds", r.status === 200 && !!token, `status=${r.status}`);
    if (!token) {
      console.log(`\n=== ${passed} passed, ${failed} failed ===`);
      process.exitCode = 1;
      return;
    }

    const auth = { Authorization: `Bearer ${token}` };

    r = await request("/api/v1/auth/me", { headers: auth });
    // The v1 wrapper nests the payload under `data`.
    const profile = r.body?.data?.user || r.body?.user;
    check(
      "GET /api/v1/auth/me returns profile",
      r.status === 200 && !!profile && profile.email === EMAIL,
      `status=${r.status}`
    );

    for (const [label, route] of [
      ["Customer API", "/api/v1/customers"],
      ["Order API", "/api/v1/orders"],
    ]) {
      r = await request(route, { headers: auth });
      const n = countOf(r.body);
      check(
        `${label} GET ${route}`,
        r.status === 200,
        `status=${r.status} rows=${n === null ? "n/a" : n}`
      );
    }

    // Measurements are per-customer (GET /measurements/:customer_id), so the
    // collection path is a 404 by design. Verify that, then fetch by id using
    // a customer from this store.
    r = await request("/api/v1/measurements", { headers: auth });
    check(
      "Measurement API has no collection route (404 by design)",
      r.status === 404,
      `status=${r.status}`
    );

    r = await request("/api/v1/customers", { headers: auth });
    const customers = Array.isArray(r.body?.data) ? r.body.data : [];
    if (customers.length > 0) {
      const id = customers[0].id;
      r = await request(`/api/v1/measurements/${id}`, { headers: auth });
      check(
        `Measurement API GET /api/v1/measurements/${id}`,
        r.status === 200,
        `status=${r.status}`
      );
    } else {
      check("Measurement API GET by customer id (skipped: no customers)", true, "n/a");
    }

    // Legacy desktop paths must still work (Electron uses these).
    r = await request("/api/customers", { headers: auth });
    check("Legacy /api/customers still works", r.status === 200, `status=${r.status}`);

    r = await request("/api/orders", { headers: auth });
    check("Legacy /api/orders still works", r.status === 200, `status=${r.status}`);

    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error("Authenticated smoke test error:", error.message);
    process.exitCode = 1;
  }
})();