// Verity core: scoring and rules. Shared by the Node server and the browser.
(function (g) {
  const C = {};
  C.CURS = { INR: { sym: "₹", rate: 1, loc: "en-IN" }, USD: { sym: "$", rate: 0.012, loc: "en-US" }, EUR: { sym: "€", rate: 0.011, loc: "de-DE" }, GBP: { sym: "£", rate: 0.0095, loc: "en-GB" } };
  C.cur = C.CURS.INR;
  C.inr = n => C.cur.sym + (n * C.cur.rate).toLocaleString(C.cur.loc, { maximumFractionDigits: C.cur.rate === 1 ? 0 : 2 });
  C.now = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  C.clone = o => JSON.parse(JSON.stringify(o));
  C.CATS = ["Shopping", "Travel", "Subscriptions", "Dining"];
  C.DEF = { budget: 6000, paused: false, w: { price: 5, rating: 3, speed: 2 },
    mode: { Shopping: "auto", Travel: "ask", Subscriptions: "ask", Dining: "auto" },
    holdSpons: false, quiet: false, daily: 0, expiry: 0, blocked: [], off: {} };
  C.SEED = [
    { id: 1, t: "9:12 AM", title: "Bought running shoes", cat: "Shopping", pick: 0, status: "done", opts: [
      { n: "StrideMax Pro", price: 6499, rating: 4.2, days: 2, margin: 18, spons: true },
      { n: "Nimbus Run", price: 4799, rating: 4.5, days: 3, margin: 9 },
      { n: "TrailKing", price: 5299, rating: 4.3, days: 5, margin: 10 }] },
    { id: 2, t: "8:05 AM", title: "Booked airport cab", cat: "Travel", pick: 0, status: "done", opts: [
      { n: "Standard sedan", price: 620, rating: 4.6, days: 0, margin: 12 },
      { n: "Auto", price: 480, rating: 4.1, days: 0, margin: 11 },
      { n: "Premium SUV", price: 1150, rating: 4.7, days: 0, margin: 14 }] },
    { id: 3, t: "7:30 AM", title: "Renewed streaming plan", cat: "Subscriptions", unit: "/mo", pick: 0, status: "done", opts: [
      { n: "Renew Premium", price: 649, rating: 4, days: 0, margin: 30, dflt: true },
      { n: "Switch to Basic", price: 199, rating: 4, days: 0, margin: 15 },
      { n: "Pause for a month", price: 0, rating: 4, days: 0, margin: 0, hidden: true }] }];
  C.POOL = [
    { title: "Ordered weekly groceries", cat: "Shopping", pick: 0, opts: [
      { n: "FreshKart basket", price: 1850, rating: 4.4, days: 1, margin: 14, spons: true },
      { n: "NearbyMart basket", price: 1540, rating: 4.5, days: 1, margin: 8 },
      { n: "BulkBox basket", price: 1390, rating: 4, days: 3, margin: 6 }] },
    { title: "Booked hotel for Goa trip", cat: "Travel", pick: 0, opts: [
      { n: "Grand Plaza", price: 7800, rating: 4.3, days: 0, margin: 22, spons: true },
      { n: "Lotus Inn", price: 5200, rating: 4.4, days: 0, margin: 12 },
      { n: "Stay Easy", price: 4600, rating: 4.1, days: 0, margin: 10 }] },
    { title: "Upgraded cloud storage", cat: "Subscriptions", unit: "/mo", pick: 0, opts: [
      { n: "Pro 1 TB", price: 299, rating: 4, days: 0, margin: 35, dflt: true },
      { n: "Plus 200 GB", price: 130, rating: 4, days: 0, margin: 18 },
      { n: "Stay on free plan", price: 0, rating: 4, days: 0, margin: 0, hidden: true }] },
    { title: "Reserved dinner table", cat: "Dining", pick: 1, opts: [
      { n: "Saffron Room", price: 2400, rating: 4.2, days: 0, margin: 15 },
      { n: "Spice Lane", price: 1500, rating: 4.6, days: 0, margin: 9 },
      { n: "Tandoor House", price: 1800, rating: 4.4, days: 0, margin: 12 }] }];
  C.R = [
    { q: "Pick a backpack for a 3-day trip", ag: 1, o: [
      { n: "TrailLite 28L", price: 2299, rating: 4.4, days: 2, margin: 9 },
      { n: "UrbanPack 35L", price: 3499, rating: 4.1, days: 3, margin: 20, spons: true }] },
    { q: "Pick headphones for your daily commute", ag: 0, o: [
      { n: "SoundBase", price: 1999, rating: 4.3, days: 2, margin: 10 },
      { n: "BassPro", price: 4999, rating: 4.2, days: 3, margin: 15 }] },
    { q: "Choose a hotel for a weekend in Jaipur", ag: 1, o: [
      { n: "Heritage Haveli", price: 5400, rating: 4.5, days: 0, margin: 10 },
      { n: "GrandStay Plus", price: 6900, rating: 4.2, days: 0, margin: 22, spons: true }] },
    { q: "Pick a cab for a 5 AM airport run", ag: 1, o: [
      { n: "QuickRide", price: 720, rating: 4.4, days: 0, margin: 12 },
      { n: "SafeGo", price: 690, rating: 4.6, days: 0, margin: 11 }] },
    { q: "Choose a streaming plan", ag: 0, o: [
      { n: "Premium", price: 649, rating: 4, days: 0, margin: 30, dflt: true },
      { n: "Basic", price: 199, rating: 4, days: 0, margin: 15 }] },
    { q: "Pick a laptop sleeve", ag: 1, o: [
      { n: "CarryAll", price: 1299, rating: 4.3, days: 2, margin: 9 },
      { n: "ShieldPro", price: 1899, rating: 4.2, days: 2, margin: 21, spons: true }] }];

  C.score = (P, opts) => {
    const rng = k => { const a = opts.map(o => o[k]); return [Math.min(...a), Math.max(...a)]; };
    const [pl, ph] = rng("price"), [rl, rh] = rng("rating"), [dl, dh] = rng("days");
    const w = P.w, tot = (w.price + w.rating + w.speed) || 1;
    return opts.map(o => {
      const s = (w.price * (ph - o.price) / ((ph - pl) || 1) + w.rating * (o.rating - rl) / ((rh - rl) || 1) + w.speed * (dh - o.days) / ((dh - dl) || 1)) / tot;
      return Math.max(0.05, 0.2 + s - (o.price > P.budget ? 0.2 : 0));
    });
  };
  C.analyse = (P, opts, pick) => {
    const s = C.score(P, opts), best = s.indexOf(Math.max(...s)), fit = Math.round(100 * s[pick] / s[best]);
    const o = opts[pick], b = opts[best], sig = [];
    if (o.spons) sig.push(["bad", "Seller paid for top placement"]);
    if (o.dflt) sig.push(["bad", "This is the provider's default option"]);
    opts.forEach(x => { if (x.hidden) sig.push(["bad", `Provider hides "${x.n}"`]); });
    if (pick !== best && o.margin - b.margin >= 5) sig.push(["bad", `Platform margin ${o.margin}% vs ${b.margin}% on your best fit`]);
    if (o.price > P.budget) sig.push(["bad", `Above your ${C.inr(P.budget)} limit`]);
    if ((P.blocked || []).includes(o.n)) sig.push(["bad", "You blocked this seller"]);
    if (!sig.length) sig.push(["ok", "No influence signals found"]);
    if (pick === best) sig.push(["ok", "Best match for your priorities"]);
    return { s, best, fit, sig, pick, warn: fit < 70 };
  };
  // The gateway decision: allow, hold for approval, or block. Returns the reasons too.
  C.decide = (P, t, ctx) => {
    ctx = ctx || {};
    const a = C.analyse(P, t.opts, t.pick), o = t.opts[t.pick], m = P.mode[t.cat], why = [];
    if (P.paused) return { status: "blocked", resp: "Blocked: agent is paused", why: ["All agents are paused"] };
    if ((P.off || {})[t.agent]) return { status: "blocked", resp: "Blocked: this agent is paused", why: [t.agent + " is paused"] };
    if ((P.blocked || []).includes(o.n)) return { status: "blocked", resp: "Blocked: seller on your block list", why: ["You blocked " + o.n] };
    if (m === "block") return { status: "blocked", resp: "Blocked by your rule", why: [t.cat + " is set to never allow"] };
    if (m === "ask") why.push(t.cat + " is set to ask first");
    if (o.price > P.budget) why.push("Over your per-purchase limit");
    if (P.holdSpons && o.spons) why.push("Sponsored pick (your rule)");
    if (P.daily && (ctx.spent || 0) + o.price > P.daily) why.push("Would pass your daily cap of " + C.inr(P.daily));
    if (P.quiet && ctx.hour !== undefined && (ctx.hour >= 22 || ctx.hour < 7)) why.push("Quiet hours (10 PM to 7 AM)");
    if (a.warn) why.push("Looks influenced (fit " + a.fit + "%)");
    return { status: why.length ? "pending" : "done", why };
  };
  // ---- v6 additions: more categories, richer feeds, dark-pattern signals, custom rules ----
  ["Electronics", "Groceries", "Fashion", "Bills"].forEach(c => { C.CATS.push(c); C.DEF.mode[c] = c === "Bills" ? "ask" : "auto"; });
  C.POOL.push(
    { title: "Bought wireless earbuds", cat: "Electronics", pick: 0, opts: [
      { n: "BoomBuds X", price: 2999, mrp: 7999, rating: 4.1, days: 2, margin: 24, spons: true, urgent: "Only 2 left", reviews: 38 },
      { n: "SoundCore Lite", price: 2499, mrp: 3299, rating: 4.4, days: 3, margin: 10, reviews: 5200 },
      { n: "Tune Pods", price: 2199, rating: 4.2, days: 4, margin: 9, reviews: 1800 }] },
    { title: "Ordered 65W laptop charger", cat: "Electronics", pick: 1, opts: [
      { n: "VoltMax 65W", price: 1899, rating: 4.1, days: 2, margin: 16, reviews: 640 },
      { n: "PowerGate 65W", price: 1499, rating: 4.5, days: 2, margin: 9, reviews: 9100 },
      { n: "ChargeBox 65W", price: 1350, rating: 4.2, days: 4, margin: 8, reviews: 2300 }] },
    { title: "Bought festive kurta set", cat: "Fashion", pick: 0, opts: [
      { n: "Ethnic Edit Kurta", price: 3299, mrp: 6999, rating: 4.0, days: 3, margin: 26, spons: true, surge: 40, urgent: "Sale ends in 10 minutes", reviews: 85 },
      { n: "Craft Loom Kurta", price: 2399, rating: 4.4, days: 4, margin: 12, reviews: 3100 },
      { n: "Daily Wear Kurta", price: 1799, rating: 4.1, days: 5, margin: 10, reviews: 1500 }] },
    { title: "Restocked pantry staples", cat: "Groceries", pick: 0, opts: [
      { n: "MegaMart monthly kit", price: 3250, rating: 4.2, days: 1, margin: 15, spons: true, addon: 149 },
      { n: "Neighbourhood Kirana kit", price: 2980, rating: 4.5, days: 1, margin: 7 },
      { n: "BulkBasket kit", price: 2790, rating: 4.0, days: 3, margin: 6 }] },
    { title: "Paid electricity bill", cat: "Bills", pick: 0, opts: [
      { n: "PayFast wallet", price: 2410, rating: 4.1, days: 0, margin: 20, addon: 35, dflt: true },
      { n: "UPI direct to board", price: 2385, rating: 4.3, days: 0, margin: 0 },
      { n: "Autopay via bank", price: 2385, rating: 4.4, days: 0, margin: 0, hidden: true }] },
    { title: "Renewed car insurance", cat: "Bills", unit: "/yr", pick: 0, opts: [
      { n: "Comprehensive Plus (bundled add-ons)", price: 14800, rating: 4.0, days: 0, margin: 28, dflt: true, addon: 2100 },
      { n: "Comprehensive", price: 11900, rating: 4.3, days: 0, margin: 14 },
      { n: "Third-party only", price: 7100, rating: 4.1, days: 0, margin: 8, hidden: true }] });
  const an0 = C.analyse, dc0 = C.decide;
  C.analyse = (P, opts, pick) => {
    const r = an0(P, opts, pick), o = opts[pick], add = [];
    if (o.mrp && o.price / o.mrp < .5) add.push("Discount is measured against an inflated list price");
    if (o.urgent) add.push("Pressure tactic: " + o.urgent);
    if (o.reviews !== undefined && o.reviews < 100) add.push("Rating rests on only " + o.reviews + " reviews");
    if (o.surge) add.push("Price jumped " + o.surge + "% in the last hour");
    if (o.addon) add.push("Bundled add-on costs " + C.inr(o.addon) + " you did not ask for");
    if (add.length) {
      r.sig = r.sig.filter(x => x[1] !== "No influence signals found"); r.sig.unshift(...add.map(x => ["bad", x]));
      r.fit = Math.max(0, r.fit - 8 * add.length); r.warn = r.fit < 70;
    }
    r.dark = add.length; return r;
  };
  // Custom rules from the user (P.rules): hold or block by category, price and seller.
  C.decide = (P, t, ctx) => {
    const r = dc0(P, t, ctx), o = t.opts[t.pick];
    if (r.status === "blocked") return r;
    for (const k of P.rules || []) {
      if ((k.cat && k.cat !== t.cat) || o.price < (k.min || 0) || (k.seller && !o.n.toLowerCase().includes(k.seller.toLowerCase()))) continue;
      if (k.act === "block") return { status: "blocked", resp: "Blocked by your custom rule", why: ["Custom rule: " + k.name] };
      r.status = "pending"; r.why = r.why || []; r.why.push("Custom rule: " + k.name);
    }
    return r;
  };
  // ---- v7: price-history and seller-reliability signals, guards, risk breakdown ----
  C.POOL.push(
    { title: "Bought air fryer in a big sale", cat: "Shopping", pick: 0, opts: [
      { n: "CrispWave 5L", price: 5499, mrp: 9999, rating: 4.3, days: 2, margin: 21, spons: true, reviews: 2400, hist: Array(30).fill(5399) },
      { n: "AeroCook 4L", price: 4799, mrp: 5999, rating: 4.4, days: 3, margin: 11, reviews: 6100, hist: Array(30).fill(4999) },
      { n: "HomeChef 4L", price: 4299, rating: 4.1, days: 4, margin: 9, reviews: 1900, hist: Array(30).fill(4399) }] },
    { title: "Ordered sports shoes", cat: "Fashion", pick: 0, opts: [
      { n: "SprintX Elite", price: 3599, rating: 4.2, days: 2, margin: 17, reviews: 950, returnRate: 31, lateRate: 22 },
      { n: "RunRight Neo", price: 3299, rating: 4.4, days: 3, margin: 10, reviews: 7400, returnRate: 9, lateRate: 5 },
      { n: "TrackPro Flex", price: 2899, rating: 4.1, days: 4, margin: 9, reviews: 2100, returnRate: 12, lateRate: 8 }] });
  const an1 = C.analyse, dc1 = C.decide;
  C.analyse = (P, opts, pick) => {
    const r = an1(P, opts, pick), o = opts[pick], add = [];
    if (o.hist && o.hist.length >= 5) {
      const h = o.hist.slice().sort((a, b) => a - b), med = h[h.length >> 1];
      if (o.price > med * 1.1) add.push("Priced " + Math.round(100 * (o.price / med - 1)) + "% above its 30-day median");
      else if (o.mrp && o.price / o.mrp >= .5 && o.price / o.mrp < .75 && o.price >= med * .97) add.push("The advertised discount is not real: it sold at about this price all month");
    }
    if (o.returnRate > 20) add.push(o.returnRate + "% of buyers return this item");
    if (o.lateRate > 15) add.push(o.lateRate + "% of orders arrive late");
    if (add.length) {
      r.sig = r.sig.filter(x => x[1] !== "No influence signals found"); r.sig.unshift(...add.map(x => ["bad", x]));
      r.fit = Math.max(0, r.fit - 8 * add.length); r.warn = r.fit < 70; r.dark = (r.dark || 0) + add.length;
    }
    return r;
  };
  C.decide = (P, t, ctx) => {
    if (t.forceBlock) return { status: "blocked", resp: "Blocked: " + t.forceBlock, why: [t.forceBlock] };
    const r = dc1(P, t, ctx), o = t.opts[t.pick]; if (r.status === "blocked") return r;
    r.why = r.why || [];
    if (ctx && ctx.recent >= 6) r.why.push("Unusual burst: " + ctx.recent + " agent actions in the last minute");
    if (P.cool && P.cool.above && o.price >= P.cool.above) r.why.push("Cooling-off: purchases from " + C.inr(P.cool.above) + " wait for your approval");
    if (r.why.length && r.status === "done") r.status = "pending";
    return r;
  };
  // Explains the risk number: how much comes from priority mismatch and how much from deceptive patterns.
  C.risk = (P, opts, pick) => {
    const a = C.analyse(P, opts, pick), pen = Math.min(100 - a.fit, 8 * (a.dark || 0));
    return { risk: 100 - a.fit, parts: [["Mismatch with your priorities", 100 - a.fit - pen], ["Deceptive patterns", pen]], best: opts[a.best].n, lift: Math.min(100, a.fit + pen) };
  };
  // ---- v9: personal gateway rules (autopilot, away mode, trusted sellers, caps, floors, duplicate guard) ----
  const dc2 = C.decide;
  C.decide = (P, t, ctx) => {
    const r = dc2(P, t, ctx); if (r.status === "blocked") return r;
    ctx = ctx || {}; r.why = r.why || [];
    const o = t.opts[t.pick], was = r.why.length, add = w => r.why.push(w);
    const onlyAsk = r.status === "pending" && was > 0 && r.why.every(w => /ask first$/.test(w));
    if (P.away) add("Away mode is on");
    if (P.strict && P.strict[t.cat] && !(P.trusted || []).includes(o.n)) add("Seller is not on your trusted list for " + t.cat);
    if (P.catCap && P.catCap[t.cat] && ((ctx.spentCat || {})[t.cat] || 0) + o.price > P.catCap[t.cat]) add("Would pass your daily " + t.cat + " cap of " + C.inr(P.catCap[t.cat]));
    if (P.monthCap && P.monthCap[t.cat] && ((ctx.monthCat || {})[t.cat] || 0) + o.price > P.monthCap[t.cat]) add("Would pass your monthly " + t.cat + " cap of " + C.inr(P.monthCap[t.cat]));
    if (P.maxDays && o.days > P.maxDays) add("Delivery takes " + o.days + " days, over your " + P.maxDays + "-day limit");
    if (P.minRating && o.rating < P.minRating) add("Rated " + o.rating + ", below your " + P.minRating + " floor");
    if (ctx.dupe) add("Looks like a repeat of an order from the last 7 days");
    if (onlyAsk && r.why.length === was && P.auto && o.price <= P.auto && !C.analyse(P, t.opts, t.pick).warn) { r.status = "done"; r.why = []; }
    else if (r.why.length && r.status === "done") r.status = "pending";
    return r;
  };
  // Pre-approval passes: "go ahead" for a category, up to an amount, for a limited time and number of uses.
  // A pass lifts the user's own holds. It never lifts a block or an influence warning.
  const dc3 = C.decide;
  C.decide = (P, t, ctx) => {
    const r = dc3(P, t, ctx); if (r.status !== "pending") return r;
    const o = t.opts[t.pick], now = (ctx && ctx.now) || Date.now();
    const k = (P.passes || []).find(p => (!p.cat || p.cat === t.cat) && o.price <= (p.max || 0) && (!p.until || now < p.until) && (p.uses === undefined || p.uses > 0));
    if (k && !C.analyse(P, t.opts, t.pick).warn) { r.status = "done"; r.why = []; r.passId = k.id; r.passName = k.name; }
    return r;
  };
  if (typeof module !== "undefined") module.exports = C; else g.Core = C;
})(this);
