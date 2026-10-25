// Verity v11 UI: setup checklist, return and renewal dates (.ics), spend forecast, compliance report, operations, glossary, offline app.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rd = (p, k) => { try { return JSON.parse(localStorage.getItem(p + k)); } catch (e) { return null; } };
  const LS = k => rd("vx5-", k), SV = (k, x) => { try { localStorage.setItem("vx5-" + k, JSON.stringify(x)); } catch (e) {} };
  const cost = d => d.opts[d.pick].price, sm = "flex:none;min-width:0;padding:4px 10px", DAY = 864e5;
  const R = { period: "all", chain: null };
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

  // ---- Setup checklist ----
  const setup = () => { const steps = [
    ["Pick a starting profile", S.log.some(l => /^Profile:/.test(l[1])), "tools"], ["Set a monthly budget per category", !!rd("vx-", "wb"), "wallet"],
    ["Turn on autopilot or trusted-only", !!P.auto || Object.values(P.strict || {}).some(Boolean), "controls"], ["Add a family contact", !!(P.guardian && P.guardian.phone), "guard"],
    ["Set a PIN for approvals", !!rd("vx3-", "pin"), "account"], ["Connect an agent key or a webhook", !!S.hook || S.agents.length > 3, "connect"],
    ["Import your past orders", (rd("vx4-", "recs") || []).length > 0, "import"], ["Choose how long to keep your data", !!P.retainDays, "ops"]];
    const n = steps.filter(s => s[1]).length, p = Math.round(100 * n / steps.length);
    return `<p class="hint">A few minutes of setup makes Verity fit you. ${n} of ${steps.length} done.</p><div class="bar"><i style="width:${p}%"></i></div>` +
      steps.map(s => `<div class="alt row"><span>${s[1] ? "✓ " : ""}${s[0]}</span>${s[1] ? '<span class="chip ok">Done</span>' : `<button class="btn" style="${sm}" data-a="q5-jump" data-v="${s[2]}">Open</button>`}</div>`).join(""); };

  // ---- Dates: return windows and renewals, with calendar export ----
  const RW0 = { Electronics: 7, Fashion: 10, Shopping: 7, Groceries: 2 };
  const rw = () => ({ ...RW0, ...(LS("rw") || {}) });
  const dates = () => { const W = rw(), now = Date.now(), D = S.d.filter(d => d.status === "done" && d.ts);
    const rets = D.filter(d => W[d.cat] > 0).map(d => ({ d, due: d.ts + W[d.cat] * DAY })).sort((a, b) => a.due - b.due);
    const subs = D.filter(d => d.cat === "Subscriptions").map(d => ({ d, due: d.ts + (d.unit === "/yr" ? 365 : 30) * DAY }));
    const left = t => Math.ceil((t - now) / DAY), chip = t => left(t) <= 0 ? '<span class="chip">Closed</span>' : `<span class="chip ${left(t) <= 2 ? "warn" : "ok"}">${left(t)} day${left(t) === 1 ? "" : "s"} left</span>`;
    const fm = t => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `<p class="hint">Return windows differ by seller and product. Edit the defaults to match what you were promised.</p>
      <h3>Return windows (days)</h3>${Core.CATS.filter(c => c in W || c !== "Subscriptions").map(c => `<div class="alt row"><span>${c}</span><input class="search" style="width:70px;margin:0;padding:4px;min-height:32px" type="number" min="0" max="60" data-q5="rw" data-c="${c}" value="${W[c] || 0}" aria-label="${c} return window"></div>`).join("")}
      <h3>Return deadlines</h3>` + (rets.length ? rets.map(x => `<div class="alt row"><span>${esc(x.d.title)}<br><small>closes ${fm(x.due)}</small></span>${chip(x.due)}</div>`).join("") : '<p class="hint">No dated orders yet. Send a scenario pack from Packs.</p>') +
      `<h3>Renewals</h3>` + (subs.length ? subs.map(x => `<div class="alt row"><span>${esc(x.d.title)}<br><small>next ${fm(x.due)} · ${price(x.d)}</small></span>${chip(x.due)}</div>`).join("") : '<p class="hint">No renewals yet.</p>') +
      `<div class="btns"><button class="btn pri" data-a="q5-ics">Download calendar file (.ics)</button></div>`; };
  const icsText = ev => { const z = t => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), ymd = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, ""), e = s => String(s).replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Verity//EN", "CALSCALE:GREGORIAN", ...ev.flatMap(x => ["BEGIN:VEVENT", "UID:" + x.id + "@verity", "DTSTAMP:" + z(Date.now()), "DTSTART;VALUE=DATE:" + ymd(x.t), "SUMMARY:" + e(x.s), "DESCRIPTION:" + e(x.d), "END:VEVENT"]), "END:VCALENDAR"].join("\r\n") + "\r\n"; };
  const events = () => { const W = rw(), ev = []; S.d.filter(d => d.status === "done" && d.ts).forEach(d => {
    if (W[d.cat] > 0) ev.push({ id: "ret-" + d.id, t: d.ts + W[d.cat] * DAY, s: "Return window closes: " + d.title, d: d.opts[d.pick].n + ", " + inr(cost(d)) });
    if (d.cat === "Subscriptions") ev.push({ id: "sub-" + d.id, t: d.ts + (d.unit === "/yr" ? 365 : 30) * DAY, s: "Renewal: " + d.title, d: d.opts[d.pick].n + ", " + inr(cost(d)) }); }); return ev; };

  // ---- Forecast ----
  const forecast = () => { const n = new Date(), dm = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(), day = n.getDate(), m0 = new Date(n.getFullYear(), n.getMonth(), 1).getTime(), wb = rd("vx-", "wb") || {};
    const D = S.d.filter(d => d.status === "done" && d.ts && d.ts >= m0), tot = D.reduce((t, d) => t + cost(d), 0), proj = Math.round(tot / day * dm), budget = Core.CATS.reduce((t, c) => t + (wb[c] || 0), 0);
    return `<p class="hint">Projects this month's spend from the run rate so far (${day} of ${dm} days). A short history gives a rough guess.</p>
      <div class="kpis"><div class="kpi"><b>${inr(tot)}</b><span>spent so far</span></div><div class="kpi"><b>${inr(proj)}</b><span>projected for the month</span></div></div>
      ${budget ? `<div class="note">${proj > budget ? `On this pace you pass your total budget of ${inr(budget)} by ${inr(proj - budget)}.` : `On this pace you finish ${inr(budget - proj)} under your total budget of ${inr(budget)}.`}</div>` : '<div class="note">Set budgets in Wallet to compare.</div>'}<h3>By category</h3>` +
      Core.CATS.map(c => { const s = D.filter(d => d.cat === c).reduce((t, d) => t + cost(d), 0), p = Math.round(s / day * dm), b = wb[c] || 0; return s || b ? `<div class="alt"><div class="row"><span>${c}</span><span>${inr(p)}${b ? " of " + inr(b) : ""}</span></div><div class="bar${b && p > b ? " low" : ""}"><i style="width:${b ? Math.min(100, Math.round(100 * p / b)) : 0}%"></i></div>${b && p > b ? "<small>On pace to pass this budget</small>" : ""}</div>` : ""; }).join(""); };

  // ---- Compliance report (print friendly) ----
  const report = () => { const since = { all: 0, week: Date.now() - 7 * DAY, today: new Date().setHours(0, 0, 0, 0) }[R.period], D = S.d.filter(d => R.period === "all" || (d.ts && d.ts >= since));
    const A = D.map(d => ({ d, a: an(d) })), cnt = s => D.filter(d => d.status === s).length, sig = {}, sel = {};
    A.forEach(x => { x.a.sig.filter(s => s[0] === "bad").forEach(s => { const k = s[1].replace(/\d+/g, "N").replace(/"[^"]*"/g, '"…"'); sig[k] = (sig[k] || 0) + 1; }); if (x.a.warn) sel[x.d.opts[x.d.pick].n] = (sel[x.d.opts[x.d.pick].n] || 0) + 1; });
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5), rules = [P.budget ? "Per-purchase limit " + inr(P.budget) : "", P.daily ? "Daily cap " + inr(P.daily) : "", P.auto ? "Autopilot up to " + inr(P.auto) : "", P.away ? "Away mode on" : "", Object.keys(P.strict || {}).filter(c => P.strict[c]).length ? "Trusted-only: " + Object.keys(P.strict).filter(c => P.strict[c]).join(", ") : "", (P.rules || []).length ? (P.rules || []).length + " custom rule(s)" : "", P.cool && P.cool.above ? "Cooling-off from " + inr(P.cool.above) : ""].filter(Boolean);
    return `<div class="filt">${[["all", "All time"], ["week", "Last 7 days"], ["today", "Today"]].map(p => `<button data-a="q5-per" data-v="${p[0]}" class="${R.period === p[0] ? "on" : ""}">${p[1]}</button>`).join("")}</div>
      <h2 style="margin-top:6px">Verity report</h2><p class="hint">Generated ${new Date().toLocaleString("en-IN")}. Prototype data, simulated.</p>
      <div class="kpis"><div class="kpi"><b>${D.length}</b><span>decisions</span></div><div class="kpi"><b>${D.length ? Math.round(100 * A.filter(x => x.a.warn).length / D.length) : 0}%</b><span>looked influenced</span></div>
      <div class="kpi"><b>${cnt("done")} / ${cnt("pending")} / ${cnt("blocked")}</b><span>allowed / held / blocked</span></div><div class="kpi"><b>${inr(D.filter(d => d.status !== "done").reduce((t, d) => t + cost(d), 0))}</b><span>held or stopped</span></div></div>
      <h3>Most common signals</h3>${top(sig).map(s => `<div class="alt row"><span>${esc(s[0])}</span><b>${s[1]}</b></div>`).join("") || '<p class="hint">None.</p>'}
      <h3>Sellers flagged most</h3>${top(sel).map(s => `<div class="alt row"><span>${esc(s[0])}</span><b>${s[1]}</b></div>`).join("") || '<p class="hint">None.</p>'}
      <h3>Rules in force</h3><p>${rules.length ? esc(rules.join(" · ")) : "Default rules only"}</p><h3>Agents</h3><p>${S.agents.filter(a => !a.revoked).length} active key(s), ${S.agents.filter(a => a.revoked).length} revoked.</p>
      <h3>Audit chain</h3><p>${R.chain ? (R.chain.ok ? `Intact, ${R.chain.sealed} receipts verified.` : "Broken at " + R.chain.broken.join(", ")) : "Not checked yet."}</p>
      <div class="btns"><button class="btn" data-a="q5-chain">Verify chain</button><button class="btn pri" data-a="print">Print or save as PDF</button></div>`; };

  // ---- Operations: usage, webhook deliveries, alerts, retention ----
  const ops = () => {
    return `<h3>API usage by key</h3>` + S.agents.map(g => { const s = g.stats || {}; return `<div class="alt"><div class="row"><b>${esc(g.name)}</b>${g.revoked ? '<span class="chip warn">Revoked</span>' : ""}</div><small>${s.calls || 0} checks · ${s.held || 0} held · ${s.blocked || 0} blocked · last ${ago(s.last)}</small></div>`; }).join("") +
      `<h3>Webhook deliveries</h3><p class="hint">${S.hook ? "Sending to " + esc((() => { try { return new URL(S.hook).host; } catch (e) { return "your URL"; } })()) + ". Three attempts: now, after 1 second and after 3 seconds, retrying on server errors or no answer." : "No webhook set. Add one in Rules."}</p>` +
      ((S.hooklog || []).length ? S.hooklog.slice(0, 6).map(h => `<div class="alt row"><span>${esc(h.label)}<br><small>${ago(h.t)} · ${h.tries} attempt${h.tries === 1 ? "" : "s"}</small></span><span class="chip ${h.status && h.status < 400 ? "ok" : "warn"}">${h.status || "no answer"}</span></div>`).join("") : '<p class="hint">No deliveries yet.</p>') + (S.hook ? `<div class="btns"><button class="btn" data-a="q5-test">Send test</button></div>` : "") +
      `<h3>Data retention</h3><label class="sl mode"><span>Delete decisions older than</span><select data-q5="ret">${[[0, "Never"], [7, "7 days"], [30, "30 days"], [90, "90 days"]].map(o => `<option value="${o[0]}"${(P.retainDays || 0) === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label><p class="hint">Held items are always kept. The audit chain stays valid from the oldest receipt kept.</p>
      <h3>Install on your phone</h3><p class="hint">${"serviceWorker" in navigator ? "Use the browser menu: Install app or Add to Home screen. The app shell then opens offline; live data needs the server." : "This browser does not support installing."}</p>`; };

  // ---- Glossary ----
  const GL = [["Paid placement", "The seller paid to be shown first.", "Compare with the next best option before approving."], ["Provider default", "The option the provider pre-selects, often the priciest.", "Check the cheaper plans it did not pick."], ["Hidden option", "A cheaper or free choice the provider keeps out of sight.", "Ask for it by name."],
    ["Margin gap", "The platform earns noticeably more from this pick than from your best fit.", "Prefer the lower-margin option unless it is worse for you."], ["Inflated list price", "The crossed-out price is far above what the item really sells for, so the discount is a mirage.", "Judge the price paid, not the saving shown."],
    ["Pressure tactic", "Messages like only 2 left or sale ends in 10 minutes.", "Wait. Real deals survive a short pause."], ["Few reviews", "A high rating built on very few reviews can be luck or fake.", "Prefer items with thousands of ratings."], ["Surge price", "The price jumped recently.", "Check again later or use another seller."],
    ["Bundled add-on", "An extra charge added without your ask, such as a convenience fee.", "Remove it or pick a route without it."], ["Above 30-day median", "The price is above what it usually costs.", "Use Price watch and wait for a drop."], ["High returns or late delivery", "Many buyers return the item or the seller often ships late.", "Choose a seller with better history."],
    ["Repeat order", "The same item was bought in the last 7 days.", "Confirm it is intended."], ["Burst guard", "Six or more agent actions in a minute were held.", "Check what the agent is doing before approving."]];
  const learn = () => '<p class="hint">What each flag means and what to do about it.</p>' + GL.map(g => `<details><summary>${g[0]}</summary><div class="secb"><p>${g[1]}</p><p><b>What to do:</b> ${g[2]}</p></div></details>`).join("");

  window.XTABS = [...(window.XTABS || []), ["setup", "Setup"], ["dates", "Dates"], ["forecast", "Forecast"], ["report", "Report"], ["ops", "Ops"], ["learn", "Learn"]];
  window.XSEC = Object.assign(window.XSEC || {}, { setup, dates, forecast, report, ops, learn });

  document.addEventListener("click", e => { const b = e.target.closest('[data-a^="q5-"]'); if (!b) return; const a = b.dataset.a, x = b.dataset.v;
    if (a === "q5-jump") { const t = document.querySelector(`[data-a="xs"][data-v="${x}"]`); if (t) t.click(); return; }
    if (a === "q5-ics") { const ev = events(); if (!ev.length) { toast("No dated orders or renewals yet"); return; } download("verity-dates.ics", icsText(ev), "text/calendar"); toast(ev.length + " dates exported"); }
    if (a === "q5-per") R.period = x;
    if (a === "q5-chain") fetch("/api/chain").then(r => r.json()).then(j => { R.chain = j; render(); });
    if (a === "q5-test") api("POST", "/api/hook/test");
    render(); }, true);
  document.addEventListener("change", e => { const t = e.target, k = t.dataset.q5; if (!k) return;
    if (k === "rw") { const W = LS("rw") || {}; W[t.dataset.c] = +t.value || 0; SV("rw", W); }
    if (k === "ret") { P.retainDays = +t.value; sp("Retention " + (t.value > 0 ? t.value + " days" : "off")); }
    render(); });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
