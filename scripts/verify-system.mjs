#!/usr/bin/env bun
/**
 * verify-system.mjs — CI + local API smoke harness (spec §22.3).
 * Boots nothing itself: expects the server (dev or standalone) on :3000 and
 * the realtime mini-service on :3003. Exercises one endpoint per domain,
 * checks RBAC negative cases, and exits non-zero on any failure.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RT = process.env.RT_URL ?? "http://localhost:3003";

let pass = 0, fail = 0;
const results = [];

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

function check(name, ok, extra = "") {
  if (ok) { pass++; results.push(`PASS ${name} ${extra}`); }
  else { fail++; results.push(`FAIL ${name} ${extra}`); }
}

const runs = [
  ["public catalog", async () => {
    const r = await call("GET", "/api/public/catalog");
    const d = r.json ?? {};
    check("public.catalog 200 + departments", r.status === 200 && Array.isArray(d.departments) && d.departments.length >= 10, `(${d.departments?.length ?? 0} depts)`);
    check("public.catalog services+faqs", Array.isArray(d.services) && d.services.length > 0 && Array.isArray(d.faqs));
  }],
  ["public slots", async () => {
    const r = await call("GET", "/api/public/slots?dept=GP&days=3");
    check("public.slots 200", r.status === 200);
  }],
  ["patient portal", async () => {
    const r = await call("GET", "/api/patient/login-options");
    check("patient.login-options", r.status === 200 && Array.isArray(r.json) && r.json.length > 0, `(${r.json?.length ?? 0} demos)`);
  }],
  ["staff console", async () => {
    const r = await call("GET", "/api/staff/login-options");
    check("staff.login-options", r.status === 200 && Array.isArray(r.json) && r.json.length > 0, `(${r.json?.length ?? 0} staff)`);
  }],
  ["kiosk negative (bad CPR)", async () => {
    const r = await call("POST", "/api/kiosk/check-in", { cpr: "12" });
    check("kiosk.check-in rejects bad CPR", r.status === 400 || (r.json?.code === "ID_INVALID_CPR"));
  }],
  ["kiosk reader-scan adapter", async () => {
    const r = await call("POST", "/api/kiosk/reader-scan", { cpr: "000000000", readerId: "ci" });
    check("kiosk.reader-scan responds", r.status === 200 && typeof r.json?.matched === "boolean" && typeof r.json?.needsRegistration === "boolean");
  }],
  ["queue display", async () => {
    const r = await call("GET", "/api/queue/display");
    check("queue.display 200 + points", r.status === 200 && Array.isArray(r.json?.display) && r.json.display.length > 0);
  }],
  ["verify code negative", async () => {
    const r = await call("POST", "/api/verify/check", { code: "BMC-DOESNOTEXIST" });
    check("verify.check invalid → valid:false", r.status === 200 && r.json?.valid === false);
  }],
  ["system health", async () => {
    const r = await call("GET", "/api/system/health");
    check("system.health ok+db", r.status === 200 && r.json?.ok === true && r.json?.db === true);
  }],
  ["RBAC negative (no actor)", async () => {
    const r = await call("GET", "/api/staff/settings/list");
    check("staff.settings requires actor (401/403)", r.status === 401 || r.status === 403);
  }],
  ["fhir conformance", async () => {
    const r = await call("GET", "/api/fhir/metadata");
    check("fhir.metadata 200", r.status === 200 && !!r.json?.resourceType);
  }],
  ["ai chat guard", async () => {
    const r = await call("POST", "/api/ai/chat", { message: "" });
    check("ai.chat rejects empty", r.status === 400 || r.status === 422);
  }],
];

// realtime service
try {
  const r = await fetch(RT + "/");
  check("realtime service :3003", r.ok && (await r.json())?.ok === true);
} catch {
  check("realtime service :3003", false, "(unreachable)");
}

for (const [name, fn] of runs) {
  try { await fn(); } catch (e) { fail++; results.push(`FAIL ${name} (exception: ${e.message})`); }
}

console.log("─".repeat(60));
for (const line of results) console.log(line);
console.log("─".repeat(60));
console.log(`verify-system: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
