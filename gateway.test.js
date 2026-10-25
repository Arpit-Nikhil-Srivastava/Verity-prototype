// Integration tests: start the real server on a temporary database and exercise the gateway over HTTP.
const test = require("node:test"), assert = require("node:assert/strict"), { spawn } = require("child_process"), os = require("os"), path = require("path"), fs = require("fs");
const PORT = 3991, B = "http://localhost:" + PORT, DB = path.join(os.tmpdir(), "verity-test-" + process.pid + ".json"), KEY = { "x-agent-key": "verity-demo-key" };
let srv; const j = async (m, u, b, h) => { const r = await fetch(B + u, { method: m, headers: { "Content-Type": "application/json", ...(h || {}) }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, b: await r.json() }; };
const item = (cat, o = {}) => ({ title: "T" + Math.random(), cat, pick: 0, opts: [{ n: o.n || "Good", price: o.price || 500, rating: o.rating || 4.5, days: o.days || 1, margin: 8 }, { n: "Other", price: 900, rating: 3, days: o.days || 1, margin: 12 }] });
let base; const setP = f => { const P = JSON.parse(JSON.stringify(base)); f(P); return j("PUT", "/api/prefs", { P }); };
const verdict = async (t, extra) => (await j("POST", "/v1/check", { ...t, dry_run: true, ...extra }, KEY)).b.decision;

test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT, VERITY_DB: DB }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { base = (await j("GET", "/api/state")).b.P; return; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error("server did not start");
});
test.after(() => { srv.kill(); try { fs.unlinkSync(DB); } catch (e) {} });

test("auth: missing key is rejected", async () => assert.equal((await j("POST", "/v1/check", item("Dining"))).s, 401));
test("baseline allows a good pick", async () => { await setP(() => {}); assert.equal(await verdict(item("Dining")), "allow"); });
test("rules are enforced for any agent", async () => {
  await setP(P => P.away = true); assert.equal(await verdict(item("Dining")), "hold");
  await setP(P => P.strict = { Dining: true }); assert.equal(await verdict(item("Dining")), "hold");
  await setP(P => { P.strict = { Dining: true }; P.trusted = ["Good"]; }); assert.equal(await verdict(item("Dining")), "allow");
  await setP(P => P.catCap = { Dining: 400 }); assert.equal(await verdict(item("Dining")), "hold");
  await setP(P => P.maxDays = 3); assert.equal(await verdict(item("Dining", { days: 4 })), "hold");
  await setP(P => P.minRating = 4.8); assert.equal(await verdict(item("Dining")), "hold");
  await setP(P => { P.mode.Travel = "ask"; }); assert.equal(await verdict(item("Travel")), "hold");
  await setP(P => { P.mode.Travel = "ask"; P.auto = 1000; }); assert.equal(await verdict(item("Travel")), "allow");
  await setP(P => { P.mode.Travel = "ask"; P.auto = 1000; P.away = true; }); assert.equal(await verdict(item("Travel")), "hold");
});
test("marketplace listing payload goes through the adapter", async () => {
  await setP(() => {});
  const r = await j("POST", "/v1/check", { intent: "Buy shoes", category: "Fashion", chosen: "A", dry_run: true, listings: [{ id: "A", title: "StrideMax", sellingPrice: 6499, mrp: 12999, rating: 4.2, ratingCount: 61, deliveryDays: 2, sponsored: true, priceHistory30d: [6399, 6499, 6499, 6399, 6599], returnRatePct: 24 }, { id: "B", title: "Nimbus", sellingPrice: 4799, rating: 4.5, ratingCount: 8200, deliveryDays: 3 }] }, KEY);
  assert.equal(r.s, 200); assert.notEqual(r.b.decision, "allow"); assert.ok(r.b.signals.some(s => /inflated list price/.test(s))); assert.ok(r.b.signals.some(s => /return/.test(s)));
});
test("scoped keys block out-of-scope actions", async () => {
  await j("POST", "/api/keys", { name: "Grocery bot", cat: "Groceries", max: 500 });
  const k = (await j("GET", "/api/state")).b.agents.find(a => a.name === "Grocery bot").key;
  assert.equal((await j("POST", "/v1/check", { ...item("Dining"), dry_run: true }, { "x-agent-key": k })).b.decision, "block");
  await j("POST", "/api/keys/revoke", { key: k }); assert.equal((await j("POST", "/v1/check", { ...item("Groceries"), dry_run: true }, { "x-agent-key": k })).s, 401);
});
test("idempotency, duplicates and the receipt chain", async () => {
  await setP(() => {}); const t = item("Dining", { n: "RepeatCafe" }), H = { ...KEY, "Idempotency-Key": "k1" };
  const a = await j("POST", "/v1/check", t, H), again = await j("POST", "/v1/check", t, H);
  assert.ok(a.b.receipt.id); assert.equal(again.b.replay, true); assert.equal(again.b.receipt.id, a.b.receipt.id);
  assert.equal(await verdict(t), "hold");
  const v = await j("GET", "/v1/receipts/verify?id=" + a.b.receipt.id); assert.equal(v.b.valid, true); assert.equal((await j("GET", "/api/chain")).b.ok, true);
});
test("batch endpoint pre-checks a cart", async () => {
  const r = await j("POST", "/v1/check/batch", { items: [item("Dining"), item("Fashion")] }, KEY); assert.equal(r.b.results.length, 2); assert.ok(r.b.results.every(x => x.dry_run));
});

test("webhook: signed, retried after a 500, and logged", async () => {
  const http = require("http"), crypto = require("crypto"), got = []; let n = 0;
  const rx = http.createServer((q, s) => { let raw = ""; q.on("data", c => raw += c); q.on("end", () => { got.push({ raw, sig: q.headers["x-verity-signature"] }); s.writeHead(++n === 1 ? 500 : 200); s.end(); }); }).listen(3993);
  await j("POST", "/api/hook", { url: "http://localhost:3993/h" }); await setP(P => P.away = true);
  await j("POST", "/v1/check", item("Dining", { n: "HookCafe" }), KEY);
  await new Promise(r => setTimeout(r, 1800)); rx.close(); await j("POST", "/api/hook", { url: "" }); await setP(() => {});
  const st = (await j("GET", "/api/state")).b;
  assert.equal(got.length, 2); assert.equal(st.hooklog[0].tries, 2); assert.equal(st.hooklog[0].status, 200);
  assert.equal(got[1].sig, "sha256=" + crypto.createHmac("sha256", "verity-demo-secret").update(got[1].raw).digest("hex"));
});
test("retention removes old decisions and the chain stays valid", async () => {
  await setP(() => {}); const a = await j("POST", "/v1/check", item("Dining", { n: "OldCafe" }), KEY), id = a.b.id;
  const d = (await j("GET", "/api/state")).b.d.find(x => x.id === id); assert.equal(d.status, "done");
  await j("POST", "/api/restore", { d: { ...d, ts: Date.now() - 3 * 864e5 } }); await setP(P => P.retainDays = 1);
  assert.ok(!(await j("GET", "/api/state")).b.d.find(x => x.id === id)); assert.equal((await j("GET", "/api/chain")).b.ok, true); await setP(() => {});
});
test("per-key usage is counted", async () => {
  const g = (await j("GET", "/api/state")).b.agents.find(a => a.key === "verity-demo-key"); assert.ok(g.stats.calls >= 3 && g.stats.held >= 1, JSON.stringify(g.stats));
});

test("monthly cap holds a purchase that would pass it", async () => {
  await setP(P => P.monthCap = { Dining: 400 });
  const r = await j("POST", "/v1/check", { ...item("Dining"), dry_run: true }, KEY);
  assert.equal(r.b.decision, "hold"); assert.ok(r.b.why.some(w => /monthly Dining cap/.test(w)));
});
test("pre-approval pass: lifts the user's holds, is used up, never beats an influence warning", async () => {
  const pass = { id: "p1", name: "Trip", cat: "Travel", max: 1000, until: Date.now() + 36e5, uses: 1 };
  await setP(P => { P.mode.Travel = "ask"; P.passes = [pass]; });
  assert.equal(await verdict(item("Travel")), "allow");
  assert.equal(await verdict({ ...item("Travel"), pick: 1 }), "hold");           // influence warning still holds
  const live = await j("POST", "/v1/check", item("Travel", { n: "PassCab" }), KEY); assert.equal(live.b.decision, "allow");
  assert.deepEqual((await j("GET", "/api/state")).b.P.passes, []);                // single use consumed
  assert.equal(await verdict(item("Travel", { n: "PassCab2" })), "hold");
  await setP(P => { P.mode.Travel = "ask"; P.passes = [{ ...pass, id: "p2", until: Date.now() - 1 }]; });
  assert.equal(await verdict(item("Travel")), "hold");                           // expired pass does nothing
});
