// Verity v10 UI: Data lab tabs. Needs datalab.js. Works with CSV, JSON, pasted text, review text and price series.
(function () {
  const D = window.DataLab, esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = k => { try { return JSON.parse(localStorage.getItem("vx4-" + k)); } catch (e) { return null; } };
  const SV = (k, x) => { try { localStorage.setItem("vx4-" + k, JSON.stringify(x)); } catch (e) {} };
  const sm = "flex:none;min-width:0;padding:4px 10px", EXTRA = "text/plain";
  const W = { name: LS("name") || "", parsed: null, map: null, recs: LS("recs") || [], issues: LS("issues") || [], quality: LS("quality"), batch: null, rev: { text: "", res: null }, pr: { text: "", cur: "", mrp: "", res: null }, pg: { ep: "/v1/check", text: "", out: "" } };
  const SAMPLE_CSV = `Order Date,Product Name,Sold By,Amount Paid,MRP,Rating,Status
05/10/2026,"Wireless earbuds, black",BoomStore,"₹2,999",7999,4.1,Delivered
06/10/2026,USB-C charger 65W,VoltCo,Rs. 1499/-,1999,4.4,Delivered
07/10/2026,Laptop sleeve,CarryAll,1.2k,1500,4.3,Delivered
08/10/2026,Phone cable,VoltCo,399,499,4.0,Delivered
09/10/2026,Power bank 10000mAh,VoltCo,"1,299",1799,4.2,Returned
10/10/2026,Premium laptop charger,GadgetHub,"₹48,000",52000,3.9,Delivered
10/10/2026,Premium laptop charger,GadgetHub,"₹48,000",52000,3.9,Delivered
11/10/2026,Weekly groceries basket,FreshKart,"1,850",,4.4,Delivered
12 Oct 2026,Festive kurta set,EthnicEdit,3299,6999,4.0,Delivered
13/10/2026,Dinner at Saffron Room,Saffron Room,2400,,4.2,Delivered
Oct 14 2026,Airport cab,QuickRide,720,,4.4,Delivered
15/10/2026,Electricity bill,PayFast,2410,,,Delivered
16/10/2026,Running shoes,StrideMax,(1,299),,4.2,Refunded
17/10/2026,Mystery item,Unknown,free,,,
18/10/2026,,SomeStore,500,,,
19/10/2026,Streaming plan renewal,StreamCo,649,,4,Delivered
`;
  const SAMPLE_PG = JSON.stringify({ intent: "Buy running shoes", category: "Fashion", chosen: "A", dry_run: true, listings: [{ id: "A", title: "StrideMax Pro", sellingPrice: 6499, mrp: 12999, rating: 4.2, ratingCount: 61, deliveryDays: 2, sponsored: true, commissionPct: 18, priceHistory30d: [6399, 6499, 6499, 6399, 6599], returnRatePct: 24 }, { id: "B", title: "Nimbus Run", sellingPrice: 4799, mrp: 5999, rating: 4.5, ratingCount: 8200, deliveryDays: 3, commissionPct: 9 }] }, null, 2);
  W.pg.text = SAMPLE_PG;
  const bars = (items, fmt) => { const mx = Math.max(...items.map(i => i[1]), 1); return items.map(i => `<div class="row" style="gap:8px;margin:4px 0"><small style="width:84px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i[0])}</small><div class="bar" style="flex:1"><i style="width:${Math.round(100 * i[1] / mx)}%"></i></div><small style="width:70px;text-align:right;flex:none">${fmt(i[1])}</small></div>`).join(""); };
  const spark = a => { const lo = Math.min(...a), hi = Math.max(...a), r = hi - lo || 1; return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="width:100%;height:60px" role="img" aria-label="Price history"><polyline points="${a.map((x, i) => (i / (a.length - 1) * 100).toFixed(1) + "," + (38 - 36 * (x - lo) / r).toFixed(1)).join(" ")}" fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`; };
  const empty = '<div class="empty"><p>No data yet. Load the sample or your own file in Import.</p></div>';

  function run() {
    if (!W.parsed) return; const m = W.map;
    if (m.title === undefined || m.price === undefined) { W.recs = []; W.issues = [{ line: 1, field: "columns", msg: "Could not find the item and price columns. Pick them below.", sev: "error" }]; W.quality = 0; }
    else { const r = D.normalize(W.parsed, m); W.recs = r.recs; W.issues = r.issues; W.quality = r.quality; }
    SV("recs", W.recs.length < 3000 ? W.recs : []); SV("issues", W.issues.slice(0, 200)); SV("quality", W.quality); SV("name", W.name);
  }
  const load = (parsed, name) => { W.parsed = parsed; W.map = D.mapColumns(parsed.headers); W.name = name; W.batch = null; run(); toast(W.recs.length + " of " + parsed.rows.length + " rows read"); render(); };
  async function batch(items, name) {
    const H = { "Content-Type": "application/json", "x-agent-key": "verity-demo-key" }, res = []; W.name = name; W.parsed = null;
    for (let i = 0; i < items.length; i += 20) {
      const part = items.slice(i, i + 20), r = await fetch("/v1/check/batch", { method: "POST", headers: H, body: JSON.stringify({ items: part, dry_run: true }) });
      if (r.ok) (await r.json()).results.forEach((x, k) => res.push({ i: i + k, ...x }));
      else for (let k = 0; k < part.length && res.length < 40; k++) { const one = await fetch("/v1/check", { method: "POST", headers: H, body: JSON.stringify({ ...part[k], dry_run: true }) }), j = await one.json(); res.push(one.ok ? { i: i + k, ...j } : { i: i + k, error: j.error }); } }
    W.batch = { items, res }; toast(res.length + " items checked by the gateway"); render();
  }
  function ingest(text, name) {
    const t = text.trim(); if (!t) return toast("Nothing to read");
    if (/\.json$/i.test(name) || /^[\[{]/.test(t)) { let j; try { j = JSON.parse(t); } catch (e) { return toast("Not valid JSON: " + e.message.slice(0, 60)); }
      if (!Array.isArray(j)) j = Object.values(j).find(Array.isArray) || [j];
      if (j.length && j.every(o => o && typeof o === "object" && (o.listings || o.opts))) return batch(j, name);
      if (j.length && j.every(o => o && typeof o === "object")) return load(D.fromObjects(j), name); return toast("JSON must be a list of objects"); }
    load(D.parseCSV(text), name);
  }

  const importV = () => { const p = W.parsed, iss = W.issues, err = iss.filter(i => i.sev === "error").length;
    const fields = ["title", "price", "cat", "seller", "mrp", "rating", "date", "returned"];
    return `<p class="hint">Bring real data: order exports as Excel (.xlsx), CSV (comma, semicolon, tab or pipe), JSON lists, or pasted text. Prices like "Rs. 1,499/-", "1.2k" and "2 lakh" are understood, and dates are read day first.</p>
    <div class="btns"><button class="btn pri" data-a="dl-sample">Load messy sample</button><button class="btn" data-a="dl-template">Download template</button><label class="btn" style="cursor:pointer;display:flex;align-items:center;justify-content:center">Choose file<input type="file" accept=".csv,.tsv,.txt,.json,.xlsx" data-dl="file" hidden></label></div>
    <textarea id="dlpaste" class="search" rows="4" placeholder="Or paste CSV or JSON here"></textarea><div class="btns" style="margin-top:8px"><button class="btn" data-a="dl-parse">Read pasted data</button>${W.recs.length || W.batch ? '<button class="btn" data-a="dl-clear">Clear data</button>' : ""}</div>` +
    (W.name ? `<div class="note"><b>${esc(W.name)}</b>${p ? ` · ${p.rows.length} rows · delimiter ${p.delimiter === "\t" ? "tab" : esc(p.delimiter)} · ${W.recs.length} usable · data quality ${W.quality}%` : W.batch ? ` · ${W.batch.res.length} items sent to the gateway` : ` · ${W.recs.length} records saved`}</div>` : "") +
    (p ? `<h3>Column mapping</h3><p class="hint">Verity guessed these from the header names. Change any that are wrong.</p>` + fields.map(f => `<label class="row alt"><span>${f}${f === "title" || f === "price" ? " *" : ""}</span><select data-dl="map" data-f="${f}"><option value="">Not in file</option>${p.headers.map((h, i) => `<option value="${i}"${W.map[f] === i ? " selected" : ""}>${esc(h)}</option>`).join("")}</select></label>`).join("") : "") +
    (iss.length ? `<h3>Data issues (${err} errors, ${iss.length - err} warnings)</h3>` + iss.slice(0, 8).map(i => `<div class="sig ${i.sev === "error" ? "bad" : "todo"}">Row ${i.line}, ${esc(i.field)}: ${esc(i.msg)}</div>`).join("") + (iss.length > 8 ? `<p class="hint">and ${iss.length - 8} more</p>` : "") : "") +
    (W.batch ? `<h3>Gateway results</h3>` + W.batch.res.map(r => { const it = W.batch.items[r.i] || {}; return `<div class="alt"><div class="row"><span>${esc(it.title || it.intent || "Item " + (r.i + 1))}</span>${r.error ? `<span class="chip warn">Error</span>` : `<span class="chip ${r.decision === "allow" ? "ok" : r.decision === "hold" ? "mid" : "warn"}">${r.decision} · ${r.risk}</span>`}</div><small>${esc(r.error || (r.signals || []).slice(0, 2).join(" · ") || "No influence signals")}</small></div>`; }).join("") : ""); };

  const analyzeV = () => { if (!W.recs.length) return empty; const A = D.analyse(W.recs);
    const flags = [...A.outliers.map(o => `Unusual price: ${o.title} at ${inr(o.price)} (typical for ${o.cat}: ${inr(o.med)})`), ...A.dups.map(d => `Possible duplicate: ${d.title} at ${inr(d.price)}, row ${d.line}`), ...A.markups.map(m => `Inflated list price: ${m.title} paid ${inr(m.price)} against ${inr(m.mrp)}`)].slice(0, 10).map(t => `<div class="sig bad">${esc(t)}</div>`).join("") || '<div class="sig ok">Nothing unusual found</div>';
    return `<div class="kpis"><div class="kpi"><b>${inr(A.total)}</b><span>${A.spendN} purchases</span></div><div class="kpi"><b>${inr(A.median)}</b><span>median purchase</span></div><div class="kpi"><b>${A.top3}%</b><span>spend with top 3 sellers</span></div><div class="kpi"><b>${A.returnRate}%</b><span>returned or refunded</span></div></div>
    ${A.byMonth.length ? `<h3>Spend by month</h3>${bars(A.byMonth, inr)}` : ""}<h3>Spend by category</h3>${bars(A.byCat, inr)}<h3>Top sellers</h3>${bars(A.topSellers, inr)}
    <h3>Price spread</h3>${bars(A.hist.map(b => [inr(b.from) + "+", b.n]), x => x + " items")}
    <h3>Things worth a look</h3>${flags}<div class="btns"><button class="btn" data-a="dl-csv">Export cleaned CSV</button><button class="btn" data-a="dl-json">Export analysis JSON</button><button class="btn" data-a="print">Print</button></div>`; };

  const backV = () => { if (!W.recs.length) return empty; const R = D.backtest(W.recs, P), n = R.allowed + R.held + R.blocked;
    return `<p class="hint">Replays your imported history against your current rules. History has no alternative options, so influence scoring is not possible here. Only rules that need a single item are checked.</p>
    <div class="kpis"><div class="kpi"><b>${R.allowed}</b><span>would pass</span></div><div class="kpi"><b>${R.held}</b><span>would be held (${inr(R.heldSpend)})</span></div><div class="kpi"><b>${R.blocked}</b><span>would be blocked (${inr(R.blockedSpend)})</span></div><div class="kpi"><b>${n ? Math.round(100 * (R.held + R.blocked) / n) : 0}%</b><span>of orders affected</span></div></div>
    <h3>Why</h3>${bars(Object.entries(R.reasons).sort((a, b) => b[1] - a[1]), x => x + "×") || '<p class="hint">No rule would have fired.</p>'}<h3>Affected orders</h3>` +
    (R.rows.slice(0, 12).map(r => `<div class="alt"><div class="row"><span>${esc(r.title)}</span><span class="chip ${r.st === "blocked" ? "warn" : "mid"}">${r.st} · ${inr(r.price)}</span></div><small>${esc(r.why.join(" · "))}</small></div>`).join("") || '<p class="hint">Nothing affected.</p>') + '<p class="hint">Change rules in Controls and Tools, then come back to see the effect.</p>'; };

  const revV = () => { const r = W.rev.res;
    return `<p class="hint">Paste reviews, one per line. Formats: <code>5|text</code>, <code>5|12/10/2026|text</code> or plain text. This uses simple heuristics (copies, shouting, mismatched words, bursts), not a trained model, so treat it as a prompt to look closer.</p>
    <textarea id="dlrv" class="search" rows="7" placeholder="5|Great product, loved it a lot&#10;5|Great product loved it a lot!!!&#10;1|Broke after two days, waste of money">${esc(W.rev.text)}</textarea><div class="btns" style="margin-top:8px"><button class="btn pri" data-a="dl-rev">Check reviews</button></div>` +
    (r ? `<div class="note"><div class="row"><b>Suspicion ${r.score} of 100</b><span class="chip ${r.score >= 50 ? "warn" : r.score >= 25 ? "mid" : "ok"}">${r.score >= 50 ? "High" : r.score >= 25 ? "Medium" : "Low"}</span></div>${r.reasons.map(x => `<div class="sig bad">${esc(x)}</div>`).join("") || '<div class="sig ok">No pattern found</div>'}</div>` + W.rev.list.map((x, i) => `<div class="alt"><small>${i + 1}. ${isNaN(x.rating) ? "" : x.rating + " stars · "}${esc(x.text.slice(0, 80))}</small>${r.flags[i].map(f => `<span class="tag">${esc(f)}</span>`).join("")}</div>`).join("") : ""); };

  const priV = () => { const r = W.pr.res;
    return `<p class="hint">Paste a price history: numbers separated by commas, or one <code>date,price</code> per line. Add today's price and the listed price to test a discount.</p>
    <textarea id="dlps" class="search" rows="5" placeholder="4799, 4899, 4799, 4999, 4799">${esc(W.pr.text)}</textarea><input id="dlpc" class="search" placeholder="Price today (optional)" value="${esc(W.pr.cur)}"><input id="dlpm" class="search" placeholder="Listed price, MRP (optional)" value="${esc(W.pr.mrp)}"><div class="btns" style="margin-top:8px"><button class="btn pri" data-a="dl-pri">Analyse prices</button></div>` +
    (r === null ? '<div class="note">Need at least 3 prices.</div>' : r ? `${spark(r.series)}<div class="kpis"><div class="kpi"><b>${r.verdict}</b><span>at ${inr(r.cur)}</span></div><div class="kpi"><b>${r.percentile}%</b><span>of past prices were this or lower</span></div><div class="kpi"><b>${inr(r.median)}</b><span>median (${inr(r.min)} to ${inr(r.max)})</span></div><div class="kpi"><b>${r.trendPct > 0 ? "+" : ""}${r.trendPct}%</b><span>trend per step · volatility ${r.volatility}%</span></div></div>${r.notes.map(x => `<div class="sig bad">${esc(x)}</div>`).join("")}<div class="btns"><button class="btn" data-a="dl-prc">Copy as priceHistory30d for the API</button></div>` : ""); };

  const pgV = () => `<p class="hint">Try the gateway with your own JSON. A single check can be a Verity item or a marketplace listing payload; a batch is <code>{"items": [...]}</code>.</p>
    <label class="sl mode"><span>Endpoint</span><select data-dl="ep"><option value="/v1/check"${W.pg.ep === "/v1/check" ? " selected" : ""}>POST /v1/check</option><option value="/v1/check/batch"${W.pg.ep !== "/v1/check" ? " selected" : ""}>POST /v1/check/batch</option></select></label>
    <textarea id="dlpg" class="search" rows="12" style="font:12px ui-monospace,Consolas,monospace">${esc(W.pg.text)}</textarea><div class="btns" style="margin-top:8px"><button class="btn pri" data-a="dl-run">Send</button><button class="btn" data-a="dl-fmt">Format JSON</button></div>${W.pg.out ? `<pre id="yout">${esc(W.pg.out)}</pre>` : ""}`;

  window.XTABS = [...(window.XTABS || []), ["import", "Import"], ["analyze", "Analyze"], ["backtest", "Backtest"], ["reviews", "Reviews"], ["prices", "Prices"], ["playground", "Playground"]];
  window.XSEC = Object.assign(window.XSEC || {}, { import: importV, analyze: analyzeV, backtest: backV, reviews: revV, prices: priV, playground: pgV });

  document.addEventListener("click", e => {
    const b = e.target.closest('[data-a^="dl-"]'); if (!b) return; const a = b.dataset.a, val = id => ($(id) ? $(id).value : "");
    if (a === "dl-sample") ingest(SAMPLE_CSV, "messy-sample.csv");
    if (a === "dl-template") download("verity-orders-template.csv", "Order Date,Product Name,Sold By,Amount Paid,MRP,Rating,Category,Status\n05/10/2026,Wireless earbuds,BoomStore,2999,7999,4.1,Electronics,Delivered\n", "text/csv");
    if (a === "dl-parse") ingest(val("#dlpaste"), "pasted-data");
    if (a === "dl-clear") { Object.assign(W, { name: "", parsed: null, map: null, recs: [], issues: [], quality: null, batch: null }); ["recs", "issues", "quality", "name"].forEach(k => SV(k, null)); }
    if (a === "dl-csv") download("verity-cleaned-orders.csv", D.toCSV(W.recs), "text/csv");
    if (a === "dl-json") download("verity-analysis.json", JSON.stringify({ source: W.name, quality: W.quality, issues: W.issues, analysis: D.analyse(W.recs), backtest: D.backtest(W.recs, P) }, null, 2), "application/json");
    if (a === "dl-rev") { W.rev.text = val("#dlrv"); W.rev.list = D.parseReviews(W.rev.text); W.rev.res = W.rev.list.length ? D.reviews(W.rev.list) : null; if (!W.rev.res) toast("Paste some reviews first"); }
    if (a === "dl-pri") { W.pr = { text: val("#dlps"), cur: val("#dlpc"), mrp: val("#dlpm"), res: null }; const s = D.series(W.pr.text), r = D.prices(s, D.money(W.pr.cur), D.money(W.pr.mrp)); W.pr.res = r ? { ...r, series: s } : null; if (!r) W.pr.res = null; }
    if (a === "dl-prc") { const s = D.series(W.pr.text).slice(-30); (navigator.clipboard ? navigator.clipboard.writeText(JSON.stringify(s)) : Promise.reject()).then(() => toast("Copied " + s.length + " prices"), () => toast("Copy is not available here")); }
    if (a === "dl-fmt") { try { W.pg.text = JSON.stringify(JSON.parse(val("#dlpg")), null, 2); } catch (er) { toast("Not valid JSON: " + er.message.slice(0, 60)); } }
    if (a === "dl-run") { W.pg.text = val("#dlpg"); let body; try { body = JSON.parse(W.pg.text); } catch (er) { W.pg.out = "Not valid JSON: " + er.message; render(); return; }
      fetch(W.pg.ep, { method: "POST", headers: { "Content-Type": "application/json", "x-agent-key": "verity-demo-key" }, body: JSON.stringify(W.pg.ep === "/v1/check/batch" && !body.items ? { items: Array.isArray(body) ? body : [body] } : body) }).then(r => r.json().then(j => (W.pg.out = r.status + " " + (r.ok ? "OK" : "Error") + "\n" + JSON.stringify(j, null, 2)))).catch(() => (W.pg.out = "Server not reachable")).then(render); return; }
    render();
  }, true);
  document.addEventListener("input", e => { const t = e.target; if (t.id === "dlpg") W.pg.text = t.value; if (t.id === "dlrv") W.rev.text = t.value; if (t.id === "dlps") W.pr.text = t.value; });
  document.addEventListener("change", e => { const t = e.target, k = t.dataset.dl; if (!k) return;
    if (k === "file" && t.files[0]) { const f = t.files[0]; if (/\.xlsx$/i.test(f.name)) f.arrayBuffer().then(D.xlsx).then(p => load(p, f.name)).catch(er => toast("Could not read Excel file: " + er.message.slice(0, 60))); else f.text().then(s => ingest(s, f.name)); return; }
    if (k === "map") { if (t.value === "") delete W.map[t.dataset.f]; else W.map[t.dataset.f] = +t.value; run(); render(); }
    if (k === "ep") { W.pg.ep = t.value; render(); } });
})();
