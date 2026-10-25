// Verity integration layer: versioned API, marketplace adapter, scoped keys, idempotency, rate limit, signed receipt chain.
module.exports = X => {
  const { C, fail, add, clean, ctxOf, SECRET, crypto } = X, D = X.db;
  const RL = new Map(), IDEM = new Map();
  const hm = s => crypto.createHmac("sha256", SECRET).update(s).digest("hex");
  const url = q => new URL(q.url, "http://x").searchParams;

  // Signed receipts: each decision is sealed with an HMAC that includes the previous receipt's hash.
  const body = t => JSON.stringify([t.id, t.title, t.cat, t.agent, t.opts[t.pick].n, t.opts[t.pick].price, t.rc.v, t.rc.prev]);
  const seal = t => {
    const prev = (D().d.find(x => x !== t && x.rc) || { rc: { hash: "GENESIS" } }).rc.hash;
    t.rc = { id: "VR-" + String(t.id).padStart(5, "0"), v: t.status, prev }; t.rc.hash = hm(body(t));
  };
  const chain = () => {
    const L = D().d.filter(x => x.rc).reverse(), bad = [];
    L.forEach((t, i) => { if (hm(body(t)) !== t.rc.hash || t.rc.prev !== (i ? L[i - 1].rc.hash : "GENESIS")) bad.push(t.rc.id); });
    return { ok: !bad.length, sealed: L.length, broken: bad, head: L.length ? L[L.length - 1].rc.hash : null };
  };

  const auth = q => {
    const k = q.headers["x-agent-key"] || String(q.headers.authorization || "").replace(/^Bearer /i, "");
    const g = D().agents.find(a => a.key === k && !a.revoked); if (!g) fail(401, "Missing, wrong or revoked API key"); return g;
  };
  const rate = k => {
    const now = Date.now(), a = (RL.get(k) || []).filter(t => now - t < 6e4);
    if (a.length >= 60) fail(429, "Rate limit: 60 checks per minute per key"); a.push(now); RL.set(k, a);
  };

  // Adapter: turns a marketplace-style listing payload into Verity's option model.
  // Field names here are placeholders. A real integration maps the marketplace's own catalog fields in this one function.
  const CATMAP = { fashion: "Fashion", electronics: "Electronics", mobiles: "Electronics", grocery: "Groceries", groceries: "Groceries", travel: "Travel", dining: "Dining", bills: "Bills", subscriptions: "Subscriptions" };
  function fromListing(b) {
    const L = b.listings; if (!Array.isArray(L) || L.length < 2 || L.length > 6) fail(400, "listings must contain 2 to 6 items");
    const pick = L.findIndex(x => x.id === b.chosen); if (pick < 0) fail(400, "chosen must match a listing id");
    return clean({ title: b.intent || "Agent purchase", cat: CATMAP[String(b.category || "").toLowerCase()] || "Shopping", pick,
      opts: L.map(x => ({ n: x.title, price: x.sellingPrice, mrp: x.mrp, rating: x.rating, reviews: x.ratingCount, days: x.deliveryDays, spons: x.sponsored, margin: x.commissionPct, hist: x.priceHistory30d, returnRate: x.returnRatePct, lateRate: x.lateDeliveryPct })) });
  }

  function check(b, q, noIdem) {
    const g = auth(q); rate(g.key);
    const ik = !noIdem && q.headers["idempotency-key"], ck = ik && g.key + ":" + ik;
    if (ck && IDEM.has(ck)) return Object.assign({ replay: true }, IDEM.get(ck));
    const t = b.listings ? fromListing(b) : clean(b), o = t.opts[t.pick], sc = g.scopes || {};
    if (sc.cats && sc.cats.length && !sc.cats.includes(t.cat)) t.forceBlock = "outside this key's allowed categories";
    else if (sc.max && o.price > sc.max) t.forceBlock = "above this key's per-action limit of " + C.inr(sc.max);
    let out;
    if (b.dry_run) {
      const P = D().P, r = C.decide(P, { ...t, agent: g.name }, ctxOf(t)), a = C.analyse(P, t.opts, t.pick);
      out = { dry_run: true, decision: r.status === "done" ? "allow" : r.status === "pending" ? "hold" : "block", why: r.why, fit: a.fit,
        risk: a.fit >= 85 ? "low" : a.fit >= 70 ? "medium" : "high", signals: a.sig.filter(x => x[0] === "bad").map(x => x[1]) };
    } else {
      out = add(t, g.name); const rc = D().d[0].rc; out.receipt = { id: rc.id, hash: rc.hash };
    }
    out.api_version = "v1"; if (ck) { IDEM.set(ck, out); setTimeout(() => IDEM.delete(ck), 6e5); }
    return out;
  }

  const routes = {
    "POST /v1/check": (b, q) => check(b || {}, q),
    "POST /v1/check/batch": (b, q) => {
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 20) fail(400, "items must be an array of 1 to 20");
      return { results: b.items.map(i => check({ ...i, dry_run: b.dry_run !== false }, q, true)) };
    },
    "GET /v1/audit": (b, q) => {
      auth(q); const since = +url(q).get("since") || 0;
      return { receipts: D().d.filter(x => x.rc && (x.ts || 0) >= since).slice(0, 100).map(x => ({ receipt: x.rc.id, hash: x.rc.hash, prev: x.rc.prev, at: x.ts, agent: x.agent, category: x.cat, item: x.opts[x.pick].n, price: x.opts[x.pick].price, verdict: x.rc.v, outcome: x.resp || x.status })) };
    },
    "GET /v1/receipts/verify": (b, q) => {
      const id = url(q).get("id"), t = D().d.find(x => x.rc && x.rc.id === id); if (!t) fail(404, "No such receipt");
      return { id, valid: hm(body(t)) === t.rc.hash, chain_ok: chain().ok, hash: t.rc.hash, verdict: t.rc.v, at: t.ts };
    },
    "GET /api/chain": () => chain(),
    "POST /api/keys": b => {
      const name = String(b.name || "").trim().slice(0, 40); if (!name) fail(400, "Give the agent a name");
      D().agents.push({ name, key: "vk_" + crypto.randomBytes(9).toString("hex"), scopes: { cats: C.CATS.includes(b.cat) ? [b.cat] : [], max: +b.max || 0 } });
      X.log("New agent key: " + name);
    },
    "POST /api/keys/revoke": b => {
      const g = D().agents.find(a => a.key === b.key); if (!g) fail(404, "No such key"); g.revoked = true; X.log("Revoked key: " + g.name);
    },
    "GET /v1/openapi.json": () => ({
      openapi: "3.0.3", info: { title: "Verity Gateway", version: "1.0.0", description: "Pre-action decision check for AI shopping agents. Returns allow, hold or block with reasons." },
      components: { securitySchemes: { ApiKey: { type: "apiKey", in: "header", name: "x-agent-key" } } }, security: [{ ApiKey: [] }],
      paths: {
        "/v1/check": { post: { summary: "Check one agent action. Send either {title, cat, pick, opts[]} or {intent, category, chosen, listings[]}. Add dry_run:true to preview without recording. Optional Idempotency-Key header." } },
        "/v1/check/batch": { post: { summary: "Pre-check up to 20 items (for example a cart). Dry run by default." } },
        "/v1/audit": { get: { summary: "Signed receipts, newest first. Optional ?since=<epoch ms>." } },
        "/v1/receipts/verify": { get: { summary: "Verify a receipt by ?id=VR-00012." } }
      }
    })
  };
  return { routes, seal };
};
