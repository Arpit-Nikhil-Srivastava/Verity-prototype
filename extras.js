// Verity v6 add-on layer. Loads after app.js and uses its globals (S, P, v, api, sp, toast, inr, an, trust, Core, render).
(function () {
  const LS = k => { try { return JSON.parse(localStorage.getItem("vx-" + k)); } catch (e) { return null; } };
  const SV = (k, x) => { try { localStorage.setItem("vx-" + k, JSON.stringify(x)); } catch (e) {} };
  const WB = { Shopping: 8000, Travel: 12000, Subscriptions: 1500, Dining: 4000, Electronics: 10000, Groceries: 5000, Fashion: 4000, Bills: 15000 };
  const X = { sec: "packs", lang: LS("lang") || "en", hc: LS("hc") || 0, wb: LS("wb") || { ...WB }, hist: LS("hist") || [], seen: LS("seen"), wi: { id: 0, w: null } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const done = () => S.d.filter(d => d.status === "done"), cost = d => d.opts[d.pick].price, sm = "flex:none;min-width:0;padding:4px 10px";
  const copy = (t, m) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(m || "Copied"), () => toast("Copy is not available here"));
  const kind = s => /paid|sponsor/i.test(s) ? 0 : /default/i.test(s) ? 1 : /hides/i.test(s) ? 2 : /margin/i.test(s) ? 3 : /discount|Pressure|reviews|jumped|add-on/i.test(s) ? 4 : -1;

  // 1. Scenario packs: real bursts of agent actions sent through the gateway.
  const PK = { fest: ["Festive sale", ["Electronics", "Fashion", "Shopping"]], trip: ["Travel rush", ["Travel", "Dining"]], bill: ["Bill day", ["Bills", "Subscriptions"]], pan: ["Pantry run", ["Groceries", "Dining"]], scam: ["Scam wave"] };
  const SCAM = [{ title: "Bought flash-deal smartwatch", cat: "Electronics", pick: 0, opts: [{ n: "ZapWatch Z9", price: 3499, mrp: 12999, rating: 4.9, days: 6, margin: 28, spons: true, urgent: "Only 1 left, 14 people viewing", reviews: 12 }, { n: "FitBand Plus", price: 2799, mrp: 3499, rating: 4.3, days: 3, margin: 9, reviews: 8400 }] },
    { title: "Booked surge-priced cab", cat: "Travel", pick: 0, opts: [{ n: "RideNow Prime", price: 1480, rating: 4.1, days: 0, margin: 25, surge: 80 }, { n: "CityCab", price: 760, rating: 4.4, days: 0, margin: 11 }] }];
  async function pack(id) {
    const L = id === "scam" ? SCAM : Core.POOL.filter(p => PK[id][1].includes(p.cat));
    toast("Sending " + L.length + " agent actions to the gateway");
    for (let i = 0; i < L.length; i++) {
      const A = S.agents.filter(a => !a.revoked), g = A[i % A.length]; if (!g) return;
      await fetch("/api/agent/action", { method: "POST", headers: { "Content-Type": "application/json", "x-agent-key": g.key }, body: JSON.stringify(L[i]) }).catch(() => 0);
      await new Promise(r => setTimeout(r, 350));
    }
  }
  const hist = () => { const h = X.hist; if (h.length < 2) return ""; return `<h3>Trust score over time</h3><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:80px" role="img" aria-label="Trust score history"><polyline points="${h.map((t, i) => (i / (h.length - 1) * 100).toFixed(1) + "," + (100 - t)).join(" ")}" fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`; };

  // 2. Digest, CSV and refund helper.
  const digest = () => { const fl = S.d.filter(d => an(d).warn), sv = S.d.reduce((t, d) => t + saving(d), 0);
    return `Verity digest\nYour agents made ${S.d.length} decisions. Trust score: ${trust()} out of 100.\n${fl.length} looked influenced and ${S.d.filter(d => d.status === "blocked").length} were stopped.\n${S.d.filter(d => d.opts[d.pick].spons).length} picks were paid placements.\nYou could have saved ${inr(sv)} by choosing the best fit.` + (fl[0] ? `\nBiggest concern: ${fl[0].title}.` : ""); };
  const regrets = () => { const L = S.d.filter(d => d.regret); return "<h3>Refund helper</h3>" + (L.length ? L.map(d => `<div class="alt"><div class="row"><span>${esc(d.title)}</span><button class="btn" style="${sm}" data-a="xrefund" data-v="${d.id}">Copy refund request</button></div></div>`).join("") : '<p class="hint">Mark a decision as regretted and a ready-to-send refund request appears here.</p>'); };

  // 3. Tools: personas, custom rules, what-if.
  const PER = { stu: ["Student on a budget", { w: { price: 9, rating: 3, speed: 1 }, budget: 2500, daily: 3000, holdSpons: true }], fam: ["Family planner", { w: { price: 6, rating: 6, speed: 3 }, budget: 6000, daily: 10000, holdSpons: true, quiet: true }], trv: ["Frequent traveller", { w: { price: 3, rating: 6, speed: 8 }, budget: 10000, daily: 0, holdSpons: false }], gad: ["Gadget buyer", { w: { price: 4, rating: 9, speed: 3 }, budget: 10000, daily: 15000, holdSpons: true }] };
  const wiOut = () => { const d = S.d.find(x => x.id === X.wi.id) || S.d[0]; if (!d) return "No decisions yet."; const a = Core.analyse({ ...P, w: X.wi.w || P.w }, d.opts, d.pick);
    return a.best === d.pick ? `With these priorities, <b>${esc(d.opts[d.pick].n)}</b> is still the best pick (fit ${a.fit}%).` : `With these priorities the best pick becomes <b>${esc(d.opts[a.best].n)}</b>. Your agent's pick, ${esc(d.opts[d.pick].n)}, fits ${a.fit}%.`; };
  const sel = (id, o, cur) => `<select id="${id}" class="search" style="margin:4px 0">${o.map(x => `<option value="${esc(x[0])}"${x[0] === cur ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select>`;
  const tools = () => { const w = X.wi.w || P.w, wd = S.d.find(x => x.id === X.wi.id) || S.d[0];
    return `<h3>Quick-start profiles</h3><div class="filt">${Object.entries(PER).map(([k, p]) => `<button data-a="xpersona" data-v="${k}">${p[0]}</button>`).join("")}</div>
    <h3>Your own rules</h3><p class="hint">Hold or block actions that match. The gateway enforces these on every agent.</p>
    ${sel("rc", [["", "Any category"], ...Core.CATS.map(c => [c, c])], "")}<input id="rm" class="search" type="number" min="0" placeholder="Price at or above (optional)"><input id="rs" class="search" placeholder="Seller name contains (optional)">${sel("ra", [["hold", "Hold for my approval"], ["block", "Block it"]], "hold")}
    <div class="btns" style="margin-top:8px"><button class="btn pri" data-a="xaddrule">Add rule</button></div>` +
    (P.rules || []).map((k, i) => `<div class="alt row"><span>${esc(k.name)}</span><button class="btn" style="${sm}" data-a="xdelrule" data-v="${i}">Remove</button></div>`).join("") +
    `<h3>What-if priorities</h3><p class="hint">Change priorities and see if the best pick changes.</p>${S.d.length ? sel("wid", S.d.map(d => [d.id, d.title]), wd.id) : ""}` +
    ["price", "rating", "speed"].map(k => `<label class="sl"><span>${k[0].toUpperCase() + k.slice(1)} importance</span><input type="range" min="0" max="10" data-xw="${k}" value="${w[k]}"></label>`).join("") + `<div class="note" id="wo">${wiOut()}</div>
    <h3>Safety and display</h3><label class="sl mode"><span>Language</span>${sel("xl", [["en", "English"], ["hi", "हिन्दी"]], X.lang)}</label>
    <label class="mode" style="margin:12px 0"><span>High contrast</span><input type="checkbox" data-xhc="1" ${X.hc ? "checked" : ""}></label>
    <div class="btns"><button class="btn" data-a="xpanic">Panic stop: pause and reject all pending</button><button class="btn" data-a="xhelp">Keyboard shortcuts</button></div>`; };

  const SEC = {
    packs: () => `<p class="hint">Send a realistic burst of agent actions through the gateway and watch Verity decide.</p>` + Object.entries(PK).map(([k, p]) => `<div class="alt"><div class="row"><b>${p[0]}</b><button class="btn" style="${sm}" data-a="xpack" data-v="${k}">Send</button></div><small>${k === "scam" ? "Fake discounts, pressure and surge pricing" : p[1].join(", ")}</small></div>`).join("") + hist(),
    wallet: () => { const tot = Core.CATS.reduce((t, c) => t + (X.wb[c] || 0), 0), sp2 = done().reduce((t, d) => t + cost(d), 0);
      return `<p class="hint">Monthly budget per category, in rupees. Verity warns when agents push past it.</p><div class="kpis"><div class="kpi"><b>${inr(sp2)}</b><span>spent by agents</span></div><div class="kpi"><b>${inr(Math.max(0, tot - sp2))}</b><span>left this month</span></div></div>` +
        Core.CATS.map(c => { const s = done().filter(d => d.cat === c).reduce((t, d) => t + cost(d), 0), b = X.wb[c] || 0, p = b ? Math.round(100 * s / b) : 0;
          return `<div class="alt"><div class="row"><span>${c}</span><span>${inr(s)} of <input class="search" style="width:92px;margin:0;padding:4px;min-height:32px" type="number" min="0" data-xwb="${c}" value="${b}" aria-label="${c} budget"></span></div><div class="bar${p > 100 ? " low" : ""}"><i style="width:${Math.min(100, p)}%"></i></div>${p > 100 ? "<small>Over budget</small>" : p > 80 ? "<small>Close to your limit</small>" : ""}</div>`; }).join(""); },
    subs: () => { const L = S.d.filter(d => d.cat === "Subscriptions"), save = L.reduce((t, d) => t + Math.max(0, cost(d) - Math.min(...d.opts.map(o => o.price))) * 12, 0);
      return `<p class="hint">Every renewal your agents proposed or made.</p><div class="kpis"><div class="kpi"><b>${inr(L.reduce((t, d) => t + cost(d), 0))}</b><span>per month in renewals</span></div><div class="kpi"><b>${inr(save)}</b><span>possible yearly saving</span></div></div>` +
        (L.length ? L.map(d => `<div class="alt"><div class="row"><b>${esc(d.title)}</b><span>${price(d)}</span></div><small>${esc(d.opts[d.pick].n)}${d.opts[d.pick].dflt ? " · provider default" : ""} · ${d.t}</small></div>`).join("") : '<div class="empty"><p>No renewals yet. Send the Bill day pack.</p></div>'); },
    agents: () => `<p class="hint">Report card for each connected agent.</p>` + S.agents.map(g => { const L = S.d.filter(d => (d.agent || "Personal agent") === g.name), n = L.length || 1, t = L.length ? Math.round(L.reduce((s, d) => s + an(d).fit, 0) / n) : 100,
      f = L.filter(d => an(d).warn).length, h = L.filter(d => d.status !== "done").length, gr = t >= 85 ? "A" : t >= 75 ? "B" : t >= 65 ? "C" : "D";
      return `<div class="alt"><div class="row"><b>${g.name}</b><span class="chip ${gr < "C" ? "ok" : gr === "C" ? "mid" : "warn"}">Grade ${gr}</span></div><small>${L.length} actions · trust ${t} · ${Math.round(100 * f / n)}% flagged · ${Math.round(100 * h / n)}% held or stopped</small><div class="bar${t < 70 ? " low" : ""}"><i style="width:${t}%"></i></div></div>`; }).join(""),
    sellers: () => { const m = {}; S.d.forEach(d => { const o = d.opts[d.pick], r = m[o.n] = m[o.n] || { n: o.n, c: 0, f: 0, s: 0, mg: 0 }; r.c++; r.mg += o.margin; if (an(d).warn) r.f++; if (o.spons) r.s++; });
      return `<p class="hint">Sellers your agents picked, ranked by how often the pick looked influenced.</p>` + Object.values(m).sort((a, b) => b.f - a.f || b.s - a.s).map(r => { const bl = (P.blocked || []).includes(r.n);
        return `<div class="alt"><div class="row"><b>${esc(r.n)}</b><button class="btn" style="${sm}" data-a="${bl ? "unblk" : "blk"}" data-v="${esc(r.n)}">${bl ? "Unblock" : "Block"}</button></div><small>${r.c} picks · ${r.f} flagged · ${r.s} sponsored · avg margin ${Math.round(r.mg / r.c)}%</small></div>`; }).join(""); },
    heat: () => { const K = ["Paid", "Default", "Hidden", "Margin", "Dark pattern"], g = {}; Core.CATS.forEach(c => g[c] = [0, 0, 0, 0, 0]);
      S.d.forEach(d => an(d).sig.forEach(x => { const k = x[0] === "bad" ? kind(x[1]) : -1; if (k >= 0 && g[d.cat]) g[d.cat][k]++; }));
      return `<p class="hint">Where influence shows up, by category.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th></th>${K.map(k => `<th>${k}</th>`).join("")}</tr>` +
        Core.CATS.map(c => `<tr><td>${c}</td>${g[c].map(n => `<td style="text-align:center;padding:6px;background:color-mix(in srgb,var(--warn) ${Math.min(80, n * 25)}%,transparent)">${n || "·"}</td>`).join("")}</tr>`).join("") + "</table></div>"; },
    digest: () => `<p class="hint">A plain-language summary you can read, copy or share.</p><div class="note">${esc(digest()).replace(/\n/g, "<br>")}</div><div class="btns"><button class="btn pri" data-a="xcopy">Copy</button><button class="btn" data-a="xspeak">Read aloud</button><button class="btn" data-a="xcsv">Export decisions (CSV)</button></div>` + regrets(),
    tools
  };
  const TABS = [["packs", "Packs"], ["wallet", "Wallet"], ["subs", "Renewals"], ["agents", "Agents"], ["sellers", "Sellers"], ["heat", "Heatmap"], ["digest", "Digest"], ["tools", "Tools"]];
  window.EXT = { x: () => { v.innerHTML = `<div class="filt xt">${[...TABS, ...(window.XTABS || [])].map(t => `<button data-a="xs" data-v="${t[0]}" class="${X.sec === t[0] ? "on" : ""}">${t[1]}</button>`).join("")}</div>` + (SEC[X.sec] || (window.XSEC || {})[X.sec] || (() => ""))(); } };

  const modal = h => { let m = document.getElementById("xm");
    if (!m) { m = document.createElement("div"); m.id = "xm"; m.className = "modal"; m.hidden = true; $(".app").appendChild(m); m.addEventListener("click", e => { if (e.target === m || e.target.dataset.a === "xclose") m.hidden = true; }); }
    m.innerHTML = `<div class="sheetm" role="dialog" aria-modal="true">${h}<div class="btns"><button class="btn pri" data-a="xclose">Close</button></div></div>`; m.hidden = false; };
  const HI = { feed: "फ़ैसले", appr: "मंज़ूरी", call: "आपकी राय", prefs: "नियम", stats: "इनसाइट", x: "एक्सप्लोर" }, EN = { feed: "Decisions", appr: "Approvals", call: "Your Call", prefs: "Rules", stats: "Insights", x: "Explore" };

  // Wrap render so every redraw also refreshes the bell, language, contrast, history and feed pack row.
  const r0 = window.render;
  window.render = function () {
    r0(); if (!S.ok) return;
    document.documentElement.dataset.hc = X.hc;
    document.querySelectorAll("nav button").forEach(b => { const s = b.querySelector("span"); if (s) s.textContent = (X.lang === "hi" ? HI : EN)[b.dataset.v]; });
    $(".sub").textContent = X.lang === "hi" ? "आपका एजेंट फ़ैसला करता है। Verity बताता है क्यों।" : "Your agent decides. Verity shows why.";
    const i = S.log.findIndex(l => JSON.stringify(l) === X.seen), n = i < 0 ? S.log.length : i; $("#bell").dataset.badge = n > 9 ? "9+" : n || "";
    const t = trust(); if (S.d.length && X.hist[X.hist.length - 1] !== t) { X.hist.push(t); X.hist = X.hist.slice(-30); SV("hist", X.hist); }
    if (S.tab === "feed" && !S.open && !$("#xp")) { const b = v.querySelector(".btns"); if (b) b.insertAdjacentHTML("afterend", `<div class="filt" id="xp" aria-label="Scenario packs">${Object.entries(PK).map(([k, p]) => `<button data-a="xpack" data-v="${k}">${p[0]}</button>`).join("")}</div>`); }
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b || b.dataset.a[0] !== "x") return; const a = b.dataset.a, x = b.dataset.v;
    if (a === "xs") X.sec = x;
    if (a === "xpack") { pack(x); return; }
    if (a === "xcopy") copy(digest(), "Digest copied");
    if (a === "xspeak") { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(digest())); } catch (er) { toast("Speech is not supported here"); } }
    if (a === "xcsv") { const q = s => '"' + String(s).replace(/"/g, '""') + '"';
      download("verity-decisions.csv", "\ufeffid,time,title,category,agent,pick,price,status,response,fit,signals\n" + S.d.map(d => [d.id, d.t, q(d.title), d.cat, q(d.agent || "Personal agent"), q(d.opts[d.pick].n), cost(d), d.status, q(d.resp || ""), an(d).fit, q(an(d).sig.filter(s => s[0] === "bad").map(s => s[1]).join("; "))].join(",")).join("\n"), "text/csv"); toast("Decisions exported"); }
    if (a === "xrefund") { const d = S.d.find(q => q.id === +x); if (d) copy(`Subject: Refund request for "${d.title}"\n\nHello,\n\nI would like to return "${d.opts[d.pick].n}" (${inr(cost(d))}). It was bought on my behalf by an automated agent, and my review of the choice found it did not match my priorities.\nPlease share the return steps.\n\nThank you.`, "Refund request copied"); }
    if (a === "xpersona") { const p = PER[x]; Object.assign(P, clone(p[1])); sp("Profile: " + p[0]); toast(p[0] + " profile applied"); }
    if (a === "xaddrule") { const k = { cat: $("#rc").value, min: +$("#rm").value || 0, seller: $("#rs").value.trim(), act: $("#ra").value };
      k.name = `${k.act === "block" ? "Block" : "Hold"} ${k.cat || "any"}${k.min ? " at or above " + inr(k.min) : ""}${k.seller ? " from seller " + k.seller : ""}`; P.rules = [...(P.rules || []), k]; sp("Rule added: " + k.name); toast("Rule added"); }
    if (a === "xdelrule") { P.rules = (P.rules || []).filter((q, i) => i !== +x); sp("Rule removed"); }
    if (a === "xbell") { X.seen = JSON.stringify(S.log[0] || null); SV("seen", X.seen); modal("<h2>Notifications</h2>" + (S.log.length ? S.log.slice(0, 15).map(l => `<div class="alt"><small>${esc(l[0])}</small> ${esc(l[1])}</div>`).join("") : '<p class="hint">Nothing yet. Send a scenario pack.</p>')); }
    if (a === "xhelp") modal("<h2>Shortcuts</h2><p><kbd>1</kbd> to <kbd>6</kbd> switch tabs</p><p><kbd>S</kbd> simulate an agent action</p><p><kbd>?</kbd> this list</p><p><kbd>Esc</kbd> close</p>");
    if (a === "xpanic") { if (!confirm("Pause all agents and reject every pending action?")) return; P.paused = true; S.d.filter(d => d.status === "pending").forEach(d => api("POST", "/api/decision", { id: d.id, status: "blocked", resp: "Stopped by panic button" })); sp("Panic stop used"); toast("All agents paused"); }
    if (a === "xreset") { if (!confirm("Reset everything and start again from the beginning?")) return;
      try { Object.keys(localStorage).filter(k => /^(verity|vx)-/.test(k) && k !== "verity-theme").forEach(k => localStorage.removeItem(k)); } catch (er) {}
      api("POST", "/api/reset"); TOUR = {}; Object.assign(X, { sec: "packs", lang: "en", hc: 0, wb: { ...WB }, hist: [], seen: null, wi: { id: 0, w: null } });
      Object.assign(S, { tab: "feed", open: null, f: "All", q: "", r: 0, picks: [], reveal: false, choose: false, tourHide: false, sec: { pri: true } }); Core.cur = Core.CURS.INR;
      toast("Everything was reset"); window.scrollTo(0, 0); setTimeout(() => welcome(true), 400); }
    render();
  }, true);
  document.addEventListener("change", e => { const t = e.target;
    if (t.dataset.xwb) { X.wb[t.dataset.xwb] = +t.value || 0; SV("wb", X.wb); render(); }
    if (t.id === "xl") { X.lang = t.value; SV("lang", X.lang); render(); }
    if (t.id === "wid") { X.wi = { id: +t.value, w: null }; render(); } });
  document.addEventListener("input", e => { const t = e.target;
    if (t.dataset.xw) { X.wi.w = { ...(X.wi.w || P.w), [t.dataset.xw]: +t.value }; $("#wo").innerHTML = wiOut(); }
    if (t.dataset.xhc) { X.hc = t.checked ? 1 : 0; SV("hc", X.hc); document.documentElement.dataset.hc = X.hc; } });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { const m = document.getElementById("xm"); if (m) m.hidden = true; return; }
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
    if (e.key === "6") { S.tab = "x"; S.open = null; render(); window.scrollTo(0, 0); } else if (e.key === "?") modal("<h2>Shortcuts</h2><p><kbd>1</kbd> to <kbd>6</kbd> switch tabs</p><p><kbd>S</kbd> simulate an agent action</p><p><kbd>Esc</kbd> close</p>"); });
  render();
})();
