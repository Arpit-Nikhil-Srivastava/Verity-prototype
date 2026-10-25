// Verity server. No npm install needed: run "node server.js".
const http = require("http"), fs = require("fs"), path = require("path"), C = require("./core.js");
const PORT = process.env.PORT || 3000, KEY = "verity-demo-key", FILE = process.env.VERITY_DB || path.join(__dirname, "db.json");
const AGENTS = [{ name: "Personal agent", key: "verity-demo-key" }, { name: "Shopping agent", key: "verity-shop-key" }, { name: "Travel agent", key: "verity-travel-key" }];
const fresh = () => ({ P: C.clone(C.DEF), d: C.clone(C.SEED), log: [], r: 0, picks: [], auto: false, n: 0, agents: C.clone(AGENTS), hook: "", hooklog: [], calls: { n: 0, agree: 0 } });
let db; try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { db = fresh(); }
db.agents = db.agents || AGENTS; db.hook = db.hook || ""; db.calls = db.calls || { n: 0, agree: 0 }; db.hooklog = db.hooklog || []; db.P = Object.assign(C.clone(C.DEF), db.P); db.P.mode = Object.assign({}, C.DEF.mode, db.P.mode);
const clients = new Set();
const TOKEN = process.env.VERITY_ADMIN_TOKEN || "";
const crypto = require("crypto"), SECRET = process.env.VERITY_SECRET || "verity-demo-secret";
const sign = p => ({ "Content-Type": "application/json", "x-verity-signature": "sha256=" + crypto.createHmac("sha256", SECRET).update(JSON.stringify(p)).digest("hex") });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type,x-agent-key,authorization,idempotency-key", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
// Context for the gateway decision: today's spend (not all-time) and how many actions arrived in the last minute.
const usePass = r => { const p = (db.P.passes || []).find(x => x.id === r.passId); if (!p) return; if (p.uses !== undefined && --p.uses <= 0) db.P.passes = db.P.passes.filter(x => x !== p); log("Used pass: " + r.passName); };
const ctxOf = t => { const day0 = new Date().setHours(0, 0, 0, 0), spentCat = {}, month0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), monthCat = {}; db.d.forEach(x => { if (x.status === "done" && (!x.ts || x.ts >= month0)) monthCat[x.cat] = (monthCat[x.cat] || 0) + x.opts[x.pick].price; if (x.status === "done" && (!x.ts || x.ts >= day0)) spentCat[x.cat] = (spentCat[x.cat] || 0) + x.opts[x.pick].price; }); return { spentCat, monthCat, dupe: !!t && db.d.some(x => x.status !== "blocked" && x.ts && Date.now() - x.ts < 6048e5 && x.opts[x.pick].n === t.opts[t.pick].n), spent: db.d.filter(x => x.status === "done" && (!x.ts || x.ts >= day0)).reduce((s, x) => s + x.opts[x.pick].price, 0), recent: db.d.filter(x => x.ts && Date.now() - x.ts < 6e4).length, hour: new Date().getHours() }; };
// Retention: remove decisions older than P.retainDays (pending ones are kept so nothing awaiting approval vanishes).
const purge = () => { const days = db.P.retainDays; if (!days) return 0; const cut = Date.now() - days * 864e5, n = db.d.length; db.d = db.d.filter(x => !x.ts || x.ts >= cut || x.status === "pending"); const k = n - db.d.length; if (k) log(`Retention: removed ${k} old decision(s)`); return k; };
const commit = () => {
  fs.writeFileSync(FILE, JSON.stringify(db));
  clients.forEach(c => c.write("event: sync\ndata: " + JSON.stringify(db) + "\n\n"));
};
const log = t => { db.log.unshift([C.now(), t]); db.log = db.log.slice(0, 50); };
const fail = (code, msg) => { throw { code, msg }; };

// Outbound integration: tell Slack, Discord, n8n or any URL when an action is held or blocked.
async function hook(payload, label) {
  if (!db.hook) return;
  const rec = { t: Date.now(), label, status: 0, tries: 0 };
  for (const wait of [0, 1000, 3000]) {   // three attempts: now, +1 s, +3 s, retrying on 5xx or no answer
    if (wait) await new Promise(r => setTimeout(r, wait));
    rec.tries++;
    try { const r = await fetch(db.hook, { method: "POST", headers: sign(payload), body: JSON.stringify(payload), signal: AbortSignal.timeout(3000) }); rec.status = r.status; if (r.status < 500) break; }
    catch (e) { rec.status = 0; }
  }
  db.hooklog = [rec, ...(db.hooklog || [])].slice(0, 20);
  log(rec.status && rec.status < 500 ? `Webhook sent (${rec.status}): ${label}` : `Webhook failed after ${rec.tries} tries: ${label}`); commit();
}
const sim = () => add(C.clone(C.POOL[db.n % C.POOL.length]), db.agents[db.n++ % db.agents.length].name);
function add(t, agent) {
  t.id = Math.max(0, ...db.d.map(x => x.id)) + 1; t.t = C.now(); t.agent = agent;
  const r = C.decide(db.P, t, ctxOf(t)); if (r.passId) usePass(r);
  t.status = r.status; t.why = r.why; if (r.passName) t.pass = r.passName; t.ts = Date.now(); if (r.resp) t.resp = r.resp;
  db.d.unshift(t); I.seal(t);
  const w = t.status === "pending" ? "held" : t.status === "blocked" ? "blocked" : "allowed";
  log(`${agent}: ${t.title} (${w})`);
  const a = C.analyse(db.P, t.opts, t.pick);
  const out = { id: t.id, why: r.why, decision: t.status === "done" ? "allow" : t.status === "pending" ? "hold" : "block",
    fit: a.fit, risk: a.fit >= 85 ? "low" : a.fit >= 70 ? "medium" : "high", signals: a.sig.filter(x => x[0] === "bad").map(x => x[1]) };
  if (t.status !== "done") hook({ event: "action_" + out.decision, agent, title: t.title, category: t.cat, price: t.opts[t.pick].price, risk: out.risk, fit: out.fit, signals: out.signals, reasons: r.why }, t.title);
  return out;
}
function clean(b) {
  if (!b || typeof b.title !== "string" || !C.CATS.includes(b.cat) || !Array.isArray(b.opts) || b.opts.length < 2 || b.opts.length > 6) fail(400, "Need title, cat (Shopping/Travel/Subscriptions/Dining) and 2-6 opts");
  if (!Number.isInteger(b.pick) || b.pick < 0 || b.pick >= b.opts.length) fail(400, "pick must be an index into opts");
  const opts = b.opts.map(o => {
    if (!o || typeof o.n !== "string" || typeof o.price !== "number") fail(400, "Each option needs n (string) and price (number)");
    return { n: o.n.slice(0, 60), price: o.price, rating: +o.rating || 4, days: +o.days || 0, margin: +o.margin || 10, spons: !!o.spons, dflt: !!o.dflt, hidden: !!o.hidden, mrp: +o.mrp || undefined, urgent: o.urgent ? String(o.urgent).slice(0, 60) : undefined, reviews: Number.isFinite(o.reviews) ? o.reviews : undefined, surge: +o.surge || undefined, addon: +o.addon || undefined, hist: Array.isArray(o.hist) ? o.hist.slice(0, 60).map(Number).filter(Number.isFinite) : undefined, returnRate: +o.returnRate || undefined, lateRate: +o.lateRate || undefined };
  });
  return { title: b.title.slice(0, 80), cat: b.cat, unit: b.unit ? String(b.unit).slice(0, 6) : undefined, pick: b.pick, opts };
}

const I = require("./integration.js")({ db: () => db, add, clean, fail, ctxOf, log, C, SECRET, crypto });
const api = {
  "GET /api/state": () => db,
  "PUT /api/prefs": b => { if (!b.P || !b.P.w || !b.P.mode) fail(400, "Bad prefs"); db.P = Object.assign(C.clone(C.DEF), b.P); db.P.mode = Object.assign({}, C.DEF.mode, db.P.mode); if (b.note) log(String(b.note).slice(0, 80)); },
  "POST /api/decision": b => {
    const d = db.d.find(x => x.id === b.id); if (!d) fail(404, "No such decision");
    d.status = b.status; d.resp = b.resp; d.ms = Number.isFinite(b.ms) ? Math.max(0, Math.min(b.ms, 36e5)) : (d.ts ? Date.now() - d.ts : d.ms); log(`${b.resp}: ${d.title}`);
  },
  "POST /api/restore": b => {
    const i = db.d.findIndex(x => x.id === (b.d && b.d.id)); if (i < 0) fail(404, "No such decision");
    db.d[i] = b.d; log("Undid: " + b.d.title);
  },
  "POST /api/simulate": () => { sim(); },
  "POST /api/auto": b => { db.auto = !!b.on; log(db.auto ? "Live agent started" : "Live agent stopped"); },
  "POST /api/misc": b => { db.r = +b.r || 0; db.picks = Array.isArray(b.picks) ? b.picks : []; },
  "POST /api/reset": () => { const h = db.hook; db = fresh(); db.hook = h; },
  "POST /api/note": b => { const d = db.d.find(x => x.id === b.id); if (!d) fail(404, "No such decision"); d.note = String(b.note || "").slice(0, 200); },
  "POST /api/feedback": b => {
    const d = db.d.find(x => x.id === b.id); if (!d) fail(404, "No such decision");
    if (b.fb === "right" || b.fb === "wrong") d.fb = b.fb; if (typeof b.regret === "boolean") d.regret = b.regret;
  },
  "POST /api/call": b => { db.calls.n++; if (b.agree) db.calls.agree++; },
  "POST /api/hook": b => {
    const u = String(b.url || "").trim(); if (u && !/^https?:\/\//.test(u)) fail(400, "Webhook must start with http:// or https://");
    db.hook = u; log(u ? "Webhook set" : "Webhook cleared");
  },
  "POST /api/hook/test": () => { if (!db.hook) fail(400, "Set a webhook URL first"); hook({ event: "test", message: "Hello from Verity" }, "test"); },
  // Integration point: any real agent calls this BEFORE acting.
  "POST /api/agent/action": (b, q) => {
    const ag = db.agents.find(a => a.key === q.headers["x-agent-key"] && !a.revoked); if (!ag) fail(401, "Missing or wrong x-agent-key header");
    return add(clean(b), ag.name);
  }
};
Object.assign(api, I.routes);
const putPrefs = api["PUT /api/prefs"]; api["PUT /api/prefs"] = b => { putPrefs(b); purge(); };
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
const STATIC = ["index.html", "style.css", "app.js", "core.js", "extras.js", "extras2.js", "extras3.js", "datalab.js", "extras4.js", "flipkart.css", "verity-sdk.js", "checkout-demo.html", "extras5.js", "extras6.js", "verify.html", "verity-badge.js", "manifest.json", "sw.js", "icon.svg"];

http.createServer((q, s) => {
  const u = q.url.split("?")[0];
  if (q.method === "OPTIONS") { s.writeHead(204, CORS); return s.end(); }
  // Optional admin lock: set VERITY_ADMIN_TOKEN, then open /?token=... once. Agent routes (/v1, /api/agent/action) keep using API keys.
  if (TOKEN) {
    const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    const ck = ((q.headers.cookie || "").split(/;\s*/).find(c => c.startsWith("vt=")) || "").slice(3), tk = new URL(q.url, "http://x").searchParams.get("token") || "";
    if (u === "/" && tk && same(tk, TOKEN)) { s.writeHead(302, { "Set-Cookie": "vt=" + TOKEN + "; HttpOnly; SameSite=Strict; Path=/", Location: "/" }); return s.end(); }
    const open = u.startsWith("/v1/") || u === "/api/agent/action";
    if ((u === "/" || u === "/index.html" || (u.startsWith("/api/") && !open)) && !same(ck, TOKEN)) {
      s.writeHead(401, { "Content-Type": u.startsWith("/api/") ? "application/json" : "text/plain" }); return s.end(u.startsWith("/api/") ? '{"error":"Locked: admin token required"}' : "Locked. Open /?token=<your admin token> once to sign in.");
    }
  }
  if (u === "/api/events") {
    s.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    s.write("event: sync\ndata: " + JSON.stringify(db) + "\n\n"); clients.add(s);
    q.on("close", () => clients.delete(s)); return;
  }
  const h = api[q.method + " " + u];
  if (h) {
    let raw = ""; q.on("data", c => { raw += c; if (raw.length > 1e6) q.destroy(); });
    q.on("end", () => {
      try {
        const out = h(raw ? JSON.parse(raw) : {}, q);
        if (q.method !== "GET") commit();
        s.writeHead(200, { "Content-Type": "application/json", ...CORS }); s.end(JSON.stringify(out || { ok: true }));
      } catch (e) {
        s.writeHead(e.code || 400, { "Content-Type": "application/json", ...CORS }); s.end(JSON.stringify({ error: e.msg || "Bad request" }));
      }
    });
    return;
  }
  const f = u === "/" ? "index.html" : u.slice(1);
  if (!STATIC.includes(f)) { s.writeHead(404); return s.end("Not found"); }
  if (!fs.existsSync(path.join(__dirname, f))) { s.writeHead(404); return s.end("Not found"); }  // listed but not on disk: answer 404, never crash
  s.writeHead(200, { "Content-Type": types[path.extname(f)] });
  const rs = fs.createReadStream(path.join(__dirname, f));
  rs.on("error", () => s.destroy());
  rs.pipe(s);
}).listen(PORT, () => console.log(`Verity running at http://localhost:${PORT}`));

// Live agent: when switched on, a new action arrives every 15 seconds.
setInterval(() => { if (db.auto) { sim(); commit(); } }, 15000);
setInterval(() => { if (purge()) commit(); }, 36e5);
setInterval(() => clients.forEach(c => c.write(": ping\n\n")), 25000);
// Pending approvals expire, so a stale request can never be approved by accident.
setInterval(() => {
  const m = db.P.expiry; if (!m) return; let ch = false;
  db.d.forEach(d => { if (d.status === "pending" && d.ts && Date.now() - d.ts > m * 60000) { d.status = "blocked"; d.resp = "Expired without approval"; log("Expired: " + d.title); ch = true; } });
  if (ch) commit();
}, 5000);
