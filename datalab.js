// Verity data lab: reads messy real-world data (CSV, JSON, pasted text) and analyses it. Pure functions, shared by browser and Node.
(function (g) {
  const D = {}, sum = a => a.reduce((s, x) => s + x, 0);
  const q = D.q = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return 0; const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

  // CSV with quotes, embedded commas and newlines, BOM, and delimiter detection (comma, semicolon, tab, pipe).
  D.parseCSV = text => {
    text = String(text).replace(/^\uFEFF/, ""); const first = text.split(/\r?\n/)[0] || "";
    const dl = [",", ";", "\t", "|"].map(d => [d, first.split(d).length - 1]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], f = "", inq = false;
    const end = () => { row.push(f); f = ""; if (row.some(x => x.trim() !== "")) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (inq) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += c; }
      else if (c === '"') inq = true; else if (c === dl) { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; end(); } else f += c; }
    end(); return { delimiter: dl, headers: (rows[0] || []).map(h => h.trim()), rows: rows.slice(1) };
  };

  // Money: Rs 1,499/-  ₹2,99,999.50  1.2k  2 lakh  (1,299) for refunds.
  D.money = s => {
    if (typeof s === "number") return s; let t = String(s == null ? "" : s).trim().toLowerCase(); if (!t) return NaN;
    const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
    t = t.replace(/inr|rs\.?|rupees?|usd|eur|gbp|[₹$€£]|\/-/g, "").replace(/[()\s,\-]/g, "");
    const m = t.match(/^(\d+(?:\.\d+)?)(k|lakhs?|lacs?|l|cr|crores?|m)?$/); if (!m) return NaN;
    const mult = { k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5, cr: 1e7, crore: 1e7, crores: 1e7, m: 1e6 }[m[2]] || 1;
    return (neg ? -1 : 1) * parseFloat(m[1]) * mult;
  };

  // Dates: ISO, DD/MM/YYYY (India first), MM/DD when the second part is above 12, "12 Oct 2026", epoch seconds or milliseconds.
  D.date = s => {
    if (s == null || s === "") return null; if (typeof s === "number") return s > 1e11 ? s : s * 1e3; const t = String(s).trim(); let m;
    if (/^\d{5}(\.\d+)?$/.test(t) && +t > 20000 && +t < 80000) return Math.round((+t - 25569) * 864e5);
    if (/^\d{10,13}$/.test(t)) return +t > 1e11 ? +t : +t * 1e3;
    if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return Date.UTC(+m[1], m[2] - 1, +m[3]);
    if ((m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) { const a = +m[1], b = +m[2]; let y = +m[3]; if (y < 100) y += 2000; return Date.UTC(y, (b > 12 ? a : b) - 1, b > 12 ? b : a); }
    const p = Date.parse(t); return isNaN(p) ? null : p;
  };

  const SYN = { title: "title item product productname name itemname description particulars", cat: "category cat type department segment", seller: "seller merchant vendor store soldby shop", price: "price amount total sellingprice cost paid amountpaid value ordertotal netamount", mrp: "mrp listprice originalprice marketprice strikeprice", rating: "rating stars score", reviews: "reviews ratingcount numreviews reviewcount ratings", date: "date orderdate purchasedate ordered orderedon time timestamp", returned: "returned return refund isreturned status" };
  D.mapColumns = headers => { const map = {}, used = new Set();
    Object.entries(SYN).forEach(([f, w]) => { const ws = w.split(" "), i = headers.findIndex((h, k) => !used.has(k) && ws.includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))); if (i >= 0) { map[f] = i; used.add(i); } });
    return map; };

  const CATS = ["Shopping", "Travel", "Subscriptions", "Dining", "Electronics", "Groceries", "Fashion", "Bills"];
  const KW = [["Electronics", /phone|earbud|headphone|charger|laptop|cable|watch|camera|speaker|powerbank|mouse|keyboard|tablet|monitor/], ["Fashion", /shirt|shoe|kurta|jeans|saree|dress|jacket|sneaker|sandal/], ["Groceries", /milk|rice|atta|dal\b|oil|sugar|grocery|groceries|vegetable|fruit|snack|biscuit|pantry|masala|tea\b|coffee/], ["Travel", /flight|cab|taxi|hotel|train|airport|booking|resort/], ["Dining", /restaurant|dinner|lunch|cafe|pizza|burger|biryani|meal|dining/], ["Subscriptions", /subscription|renew|premium|membership|streaming/], ["Bills", /bill|electricity|recharge|insurance|broadband|postpaid|fastag/]];
  D.cat = (c, title) => { const s = String(c || "").trim().toLowerCase(), ex = CATS.find(x => x.toLowerCase() === s); if (ex) return ex;
    const txt = (s + " " + String(title || "").toLowerCase()), k = KW.find(x => x[1].test(txt)); return k ? k[0] : "Shopping"; };

  // Turns parsed rows into clean records and a list of issues with row numbers.
  D.normalize = (parsed, map) => { const recs = [], issues = [];
    parsed.rows.forEach((r, n) => { const line = n + 2, get = f => map[f] === undefined ? "" : String(r[map[f]] == null ? "" : r[map[f]]).trim(), bad = (field, msg, sev) => issues.push({ line, field, msg, sev: sev || "warn" });
      const title = get("title"), price = D.money(get("price"));
      if (!title) return bad("title", "Missing item name", "error"); if (isNaN(price)) return bad("price", "Price not readable: \"" + get("price") + "\"", "error");
      if (price < 0) bad("price", "Negative amount, treated as a refund");
      const mrp = D.money(get("mrp")), rt = parseFloat(get("rating")), ts = D.date(get("date")), okR = !isNaN(rt) && rt >= 0 && rt <= 5;
      if (get("date") && ts === null) bad("date", "Date not readable: \"" + get("date") + "\""); if (!isNaN(mrp) && mrp < price) bad("mrp", "List price is below the price paid");
      if (!isNaN(rt) && !okR) bad("rating", "Rating outside 0 to 5");
      recs.push({ line, title, cat: D.cat(get("cat"), title), seller: get("seller") || "Unknown", price, mrp: isNaN(mrp) ? undefined : mrp, rating: okR ? rt : undefined, ts, returned: /^(y|yes|true|1|return|returned|refund|refunded)/i.test(get("returned")) }); });
    return { recs, issues, quality: parsed.rows.length ? Math.round(100 * recs.length / parsed.rows.length) : 0 }; };

  D.hist = (a, bins) => { if (!a.length) return []; const lo = Math.min(...a), hi = Math.max(...a), w = (hi - lo) / bins || 1, out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, n: 0 }));
    a.forEach(x => out[Math.min(bins - 1, Math.floor((x - lo) / w))].n++); return out; };

  D.analyse = recs => { const sp = recs.filter(r => r.price > 0), pr = sp.map(r => r.price), byCat = {}, bySel = {}, byMon = {}, grp = {};
    sp.forEach(r => { byCat[r.cat] = (byCat[r.cat] || 0) + r.price; bySel[r.seller] = (bySel[r.seller] || 0) + r.price; (grp[r.cat] = grp[r.cat] || []).push(r);
      if (r.ts != null) { const k = new Date(r.ts).toISOString().slice(0, 7); byMon[k] = (byMon[k] || 0) + r.price; } });
    const total = sum(pr), sel = Object.entries(bySel).sort((a, b) => b[1] - a[1]), out = [], dup = [], seen = {};
    Object.values(grp).forEach(G => { if (G.length < 5) return; const med = q(G.map(r => r.price), .5), mad = q(G.map(r => Math.abs(r.price - med)), .5) || 1;
      G.forEach(r => { const z = .6745 * (r.price - med) / mad; if (Math.abs(z) > 3.5) out.push({ ...r, z: +z.toFixed(1), med }); }); });
    sp.forEach(r => { const k = r.title.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + r.price; (seen[k] = seen[k] || []).push(r); });
    Object.values(seen).forEach(G => { G.sort((a, b) => (a.ts || 0) - (b.ts || 0)); for (let i = 1; i < G.length; i++) if (!G[i].ts || !G[i - 1].ts || G[i].ts - G[i - 1].ts < 6048e5) dup.push(G[i]); });
    return { n: recs.length, spendN: sp.length, total, median: q(pr, .5), p90: q(pr, .9), max: pr.length ? Math.max(...pr) : 0, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]), byMonth: Object.entries(byMon).sort(), topSellers: sel.slice(0, 5),
      top3: total ? Math.round(100 * sum(sel.slice(0, 3).map(x => x[1])) / total) : 0, outliers: out, dups: dup, returnRate: recs.length ? Math.round(100 * recs.filter(r => r.returned).length / recs.length) : 0,
      markups: sp.filter(r => r.mrp && r.price / r.mrp < .5), hist: D.hist(pr.filter(x => x <= q(pr, .95)), 8) }; };

  // Replays history against the current rules. History has no alternatives, so influence scoring is not possible; only rules that need one item are checked.
  D.backtest = (recs, P) => { const R = { allowed: 0, held: 0, blocked: 0, heldSpend: 0, blockedSpend: 0, reasons: {}, rows: [] }, day = {}, seen = [];
    recs.filter(r => r.price > 0).sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(r => { const why = [], hard = [], m = (P.mode || {})[r.cat], dk = r.ts ? new Date(r.ts).toISOString().slice(0, 10) : "?", d = day[dk] = day[dk] || { all: 0, c: {} };
      if (P.away) why.push("Away mode is on"); if ((P.blocked || []).includes(r.seller)) hard.push("Seller is on your block list");
      if (m === "block") hard.push(r.cat + " is set to never allow"); else if (m === "ask") why.push(r.cat + " is set to ask first");
      if (P.budget && r.price > P.budget) why.push("Over your per-purchase limit"); if (P.strict && P.strict[r.cat] && !(P.trusted || []).includes(r.seller)) why.push("Seller not trusted for " + r.cat);
      if (P.minRating && r.rating !== undefined && r.rating < P.minRating) why.push("Rated below your floor");
      if (P.daily && d.all + r.price > P.daily) why.push("Passes your daily cap"); if (P.catCap && P.catCap[r.cat] && (d.c[r.cat] || 0) + r.price > P.catCap[r.cat]) why.push("Passes the daily " + r.cat + " cap");
      if (r.ts && seen.some(s => s.t === r.title.toLowerCase() && s.ts && r.ts >= s.ts && r.ts - s.ts < 6048e5)) why.push("Repeat of an order within 7 days");
      if (r.mrp && r.price / r.mrp < .5) why.push("Inflated list price"); seen.push({ t: r.title.toLowerCase(), ts: r.ts });
      const st = hard.length ? "blocked" : why.length ? "held" : "allowed"; R[st]++; if (st === "allowed") { d.all += r.price; d.c[r.cat] = (d.c[r.cat] || 0) + r.price; }
      if (st === "held") R.heldSpend += r.price; if (st === "blocked") R.blockedSpend += r.price; hard.concat(why).forEach(w => R.reasons[w] = (R.reasons[w] || 0) + 1);
      if (st !== "allowed") R.rows.push({ title: r.title, price: r.price, st, why: hard.concat(why) }); });
    return R; };

  const toks = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2));
  const jac = (a, b) => { let i = 0; a.forEach(x => b.has(x) && i++); return i / ((a.size + b.size - i) || 1); };
  // Lines like "5|text", "5|12/10/2026|text", "4, text" or plain text.
  D.parseReviews = text => String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split("|");
    if (p.length >= 3) return { rating: parseFloat(p[0]), ts: D.date(p[1]), text: p.slice(2).join("|").trim() };
    const m = l.match(/^([1-5](?:\.\d)?)\s*[|,:]\s*(.*)$/); return m ? { rating: parseFloat(m[1]), text: m[2], ts: null } : { rating: NaN, text: l, ts: null }; });
  // Heuristics only, not a trained model: copies, shouting, mismatched words, bursts and one-sided ratings.
  D.reviews = list => { const T = list.map(r => toks(r.text)), flags = list.map(() => []);
    list.forEach((r, i) => { const t = String(r.text || ""), L = t.replace(/[^A-Za-z]/g, "");
      if (t.trim().length < 15) flags[i].push("Very short"); if ((t.match(/!/g) || []).length >= 3) flags[i].push("Many exclamation marks");
      if (L.length > 10 && t.replace(/[^A-Z]/g, "").length / L.length > .6) flags[i].push("Mostly capitals");
      for (let j = 0; j < i; j++) if (T[i].size >= 3 && jac(T[i], T[j]) >= .7) { flags[i].push("Near copy of review " + (j + 1)); break; }
      if (r.rating >= 4 && /\b(bad|worst|broke|broken|waste|refund|poor|disappoint)/i.test(t)) flags[i].push("Rating does not match the words"); });
    const ts = list.map(r => r.ts).filter(x => x != null).sort((a, b) => a - b); let burst = false;
    if (ts.length >= 5) for (let i = 0; i < ts.length && !burst; i++) { let c = 0; for (let j = i; j < ts.length && ts[j] - ts[i] <= 1728e5; j++) c++; if (c / ts.length >= .4) burst = true; }
    const n = list.length || 1, fl = flags.filter(f => f.length).length, five = list.filter(r => r.rating >= 5).length / n, skew = five > .85 && list.length >= 8, reasons = [];
    if (fl / n >= .3) reasons.push(Math.round(100 * fl / n) + "% of reviews show a warning sign"); if (burst) reasons.push("Many reviews landed within two days"); if (skew) reasons.push("Over 85% are 5-star");
    return { score: Math.min(100, Math.round(60 * fl / n + (burst ? 25 : 0) + (skew ? 15 : 0))), flags, reasons, burst, n: list.length }; };

  D.series = text => { const L = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean), one = L.length === 1;
    return (one ? L[0].split(/[,;\t ]+/) : L.map(l => l.split(/[,;\t]/).pop())).map(D.money).filter(x => !isNaN(x) && x > 0); };
  D.prices = (a, cur, mrp) => { a = a.filter(x => x > 0); if (a.length < 3) return null; cur = cur > 0 ? cur : a[a.length - 1];
    const n = a.length, med = q(a, .5), mean = sum(a) / n, sd = Math.sqrt(sum(a.map(x => (x - mean) ** 2)) / n), mx = (n - 1) / 2, den = sum(a.map((_, i) => (i - mx) ** 2)) || 1, slope = sum(a.map((x, i) => (i - mx) * (x - mean))) / den, notes = [];
    if (cur > med * 1.1) notes.push("Above the usual price (median " + Math.round(med) + ")"); if (mrp && cur / mrp < .75 && cur >= med * .97) notes.push("The discount is not real: it already sold at about this price");
    return { n, min: Math.min(...a), max: Math.max(...a), median: med, volatility: +(sd / mean * 100).toFixed(1), trendPct: +(slope / mean * 100).toFixed(2), cur, percentile: Math.round(100 * a.filter(x => x <= cur).length / n), verdict: cur <= q(a, .25) ? "Good time to buy" : cur >= q(a, .75) ? "Pricey right now" : "Typical price", notes }; };

  // Flat JSON rows (array of objects) become the same shape as parsed CSV.
  D.fromObjects = arr => { const h = [...new Set(arr.flatMap(o => Object.keys(o)))]; return { delimiter: "json", headers: h, rows: arr.map(o => h.map(k => o[k] == null ? "" : typeof o[k] === "object" ? JSON.stringify(o[k]) : String(o[k]))) }; };
  D.toCSV = recs => { const e = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    return "title,category,seller,price,mrp,rating,date,returned\n" + recs.map(r => [e(r.title), r.cat, e(r.seller), r.price, r.mrp == null ? "" : r.mrp, r.rating == null ? "" : r.rating, r.ts == null ? "" : new Date(r.ts).toISOString().slice(0, 10), r.returned ? "yes" : "no"].join(",")).join("\n"); };
  // Reads the first sheet of an .xlsx file (a zip of XML) without any library. Dates arrive as serial numbers, which D.date understands.
  D.xlsx = async buf => {
    const u8 = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder(), ents = {};
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("Not an .xlsx file");
    for (let n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true); n--;) {
      const nl = dv.getUint16(p + 28, true), name = td.decode(u8.subarray(p + 46, p + 46 + nl));
      ents[name] = { m: dv.getUint16(p + 10, true), cs: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) }; p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true); }
    const read = async name => { const z = ents[name]; if (!z) return ""; const o = z.off + 30 + dv.getUint16(z.off + 26, true) + dv.getUint16(z.off + 28, true), raw = u8.subarray(o, o + z.cs);
      if (z.m === 0) return td.decode(raw); const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw")); return td.decode(await new Response(s).arrayBuffer()); };
    const un = s => s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (m, c) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[c] || String.fromCharCode(+c.slice(1))));
    const sst = [...(await read("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => un([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join("")));
    const sheet = ents["xl/worksheets/sheet1.xml"] ? "xl/worksheets/sheet1.xml" : Object.keys(ents).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)); if (!sheet) throw new Error("No worksheet found");
    const grid = []; let width = 0;
    for (const m of (await read(sheet)).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = [...m[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1, row = +m[2] - 1, t = (m[3].match(/t="(\w+)"/) || [])[1], v = (m[4] || "").match(/<v>([\s\S]*?)<\/v>/), is = (m[4] || "").match(/<is>([\s\S]*?)<\/is>/);
      let val = t === "s" && v ? sst[+v[1]] : t === "inlineStr" && is ? un([...is[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join("")) : v ? un(v[1]) : "";
      (grid[row] = grid[row] || [])[col] = val; width = Math.max(width, col + 1); }
    const rows = grid.filter(Boolean).map(r => Array.from({ length: width }, (_, i) => r[i] == null ? "" : String(r[i])));
    if (!rows.length) throw new Error("The sheet is empty"); return { delimiter: "xlsx", headers: rows[0].map(h => h.trim()), rows: rows.slice(1).filter(r => r.some(x => x.trim() !== "")) };
  };
  g.DataLab = D; if (typeof module !== "undefined") module.exports = D;
})(typeof window !== "undefined" ? window : globalThis);
