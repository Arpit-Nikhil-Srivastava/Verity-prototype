// The optional admin lock: with VERITY_ADMIN_TOKEN set, the app and /api need a sign-in; agent routes and public pages do not.
const test = require("node:test"), assert = require("node:assert/strict"), { spawn } = require("child_process"), os = require("os"), path = require("path"), fs = require("fs");
const PORT = 3993, B = "http://localhost:" + PORT, DB = path.join(os.tmpdir(), "verity-auth-" + process.pid + ".json"), TOKEN = "s3cret-token";
let srv; const get = (u, h) => fetch(B + u, { headers: h || {}, redirect: "manual" });
test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT, VERITY_DB: DB, VERITY_ADMIN_TOKEN: TOKEN }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { await get("/verify.html"); return; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error("server did not start");
});
test.after(() => { srv.kill(); try { fs.unlinkSync(DB); } catch (e) {} });
test("app and management routes are locked without the token", async () => {
  assert.equal((await get("/")).status, 401); assert.equal((await get("/api/state")).status, 401);
  assert.equal((await get("/api/state", { cookie: "vt=wrong" })).status, 401); assert.equal((await get("/?token=wrong")).status, 401);
});
test("signing in with the token sets a cookie that unlocks the app", async () => {
  const r = await get("/?token=" + TOKEN); assert.equal(r.status, 302); const c = r.headers.get("set-cookie"); assert.match(c, /vt=s3cret-token; HttpOnly; SameSite=Strict/);
  assert.equal((await get("/", { cookie: "vt=" + TOKEN })).status, 200); assert.equal((await get("/api/state", { cookie: "vt=" + TOKEN })).status, 200);
});
test("agent routes and public pages stay open", async () => {
  assert.equal((await get("/verify.html")).status, 200); assert.equal((await get("/v1/openapi.json")).status, 200);
  const r = await fetch(B + "/v1/check", { method: "POST", headers: { "Content-Type": "application/json", "x-agent-key": "verity-demo-key" }, body: JSON.stringify({ title: "t", cat: "Dining", pick: 0, dry_run: true, opts: [{ n: "A", price: 100 }, { n: "B", price: 200 }] }) });
  assert.equal(r.status, 200);
});
