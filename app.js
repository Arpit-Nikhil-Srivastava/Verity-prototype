// Verity v5 client. State lives on the server; this page is a live view (SSE) plus controls.
const { inr, clone, CATS, R } = Core;
Core.cur = Core.CURS[(() => { try { return localStorage.getItem("verity-cur"); } catch (e) { return null; } })()] || Core.cur;
let TOUR = {}; try { TOUR = JSON.parse(localStorage.getItem("verity-tour")) || {}; } catch (e) {}
const saveTour = () => { try { localStorage.setItem("verity-tour", JSON.stringify(TOUR)); } catch (e) {} };
const tick = k => { if (!TOUR[k]) { TOUR[k] = 1; saveTour(); } };
const fmt = { budget: inr, daily: n => n ? inr(n) : "Off", expiry: n => n ? n + " min" : "Off" };
const S = { tab: "feed", open: null, choose: false, f: "All", q: "", d: [], log: [], r: 0, picks: [], auto: false, agents: [], hook: "", sort: "new", sec: { pri: true }, shown: false, calls: { n: 0, agree: 0 }, sv: "me", tourHide: (() => { try { return !!localStorage.getItem("verity-tourx"); } catch (e) { return false; } })(), openAt: 0, reveal: false, undo: null, ok: false };
let P = clone(Core.DEF);
const $ = s => document.querySelector(s), v = $("#view");
const api = (m, u, b) => fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined })
  .catch(() => toast("Server not reachable"));
const sp = note => api("PUT", "/api/prefs", { P, note });
const mp = () => api("POST", "/api/misc", { r: S.r, picks: S.picks });
const theme = () => { try { return localStorage.getItem("verity-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) { return "light"; } };
function toast(t, u) {
  const e = $("#toast"); S.undo = u || null;
  e.innerHTML = t + (u ? ' <button data-a="tundo">Undo</button>' : ""); e.classList.add("on");
  clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove("on"), u ? 6000 : 2400);
}
const an = d => Core.analyse(P, d.opts, d.pick);
const chip = a => { const l = a.fit >= 85 ? ["ok", "Low risk"] : a.fit >= 70 ? ["mid", "Medium risk"] : ["warn", "High risk"]; return `<span class="chip ${l[0]}">${l[1]}</span>`; };
const st = d => d.status === "pending" ? '<span class="chip warn">Needs approval</span>'
  : d.status === "blocked" ? '<span class="chip">Stopped</span>' : d.resp ? `<span class="chip">${d.resp}</span>` : chip(an(d));
const price = d => inr(d.opts[d.pick].price) + (d.unit || "");
const saving = d => d.status === "blocked" ? 0 : Math.max(0, d.opts[d.pick].price - d.opts[an(d).best].price);
const trust = () => Math.round(S.d.reduce((t, d) => t + an(d).fit, 0) / (S.d.length || 1));
const word = d => d.status === "pending" ? "held for your approval" : d.status === "blocked" ? "blocked" : "allowed";
const tags = (o, i, a) => [i === a.pick ? "Agent's pick" : "", i === a.best ? "Best for you" : "", o.spons ? "Sponsored" : "", o.hidden ? "Hidden by provider" : ""].filter(Boolean);
const ring = t => { const c = t >= 85 ? "ok" : t >= 70 ? "mid" : "warn";
  return `<svg class="ring" viewBox="0 0 36 36" role="img" aria-label="Trust score ${t}"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--line)" stroke-width="3"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--${c})" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="${t} 100" transform="rotate(-90 18 18)"/><text x="18" y="21" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink)">${t}</text></svg>`; };

function resolve(d, status, resp, msg) {
  const snap = clone(d);
  tick("decide");
  api("POST", "/api/decision", { id: d.id, status, resp, ms: S.openAt && S.open === d.id ? Date.now() - S.openAt : undefined });
  toast(msg || resp, () => api("POST", "/api/restore", { d: snap }));
}

function feed() {
  const fl = S.d.filter(d => an(d).warn).length;
  v.innerHTML = (P.paused ? '<div class="note"><b>Agent paused.</b> New actions are blocked until you resume it.</div>' : "") +
    `<div class="hero">${ring(trust())}<div><b>Agent trust score</b><div class="hint" style="margin:2px 0 0">${fl} of ${S.d.length} decisions need a look. The score shows how closely your agent's picks match your priorities.</div></div></div>
    ${tourHtml()}
    <div class="btns" style="margin-top:14px"><button class="btn pri" data-a="sim">Simulate agent action</button>
    <button class="btn" data-a="auto">Live agent: ${S.auto ? "on" : "off"}</button></div>
    <input id="q" class="search" placeholder="Search decisions" aria-label="Search decisions">
    <div class="filt">${["All", "Needs a look", ...CATS].map(c => `<button data-a="f" data-v="${c}" class="${S.f === c ? "on" : ""}">${c}</button>`).join("")}</div><select id="sort" class="search" style="margin-top:8px" aria-label="Sort decisions"><option value="new">Newest first</option><option value="risk">Highest risk first</option><option value="price">Highest price first</option></select><div id="list"></div>`;
  $("#q").value = S.q; $("#sort").value = S.sort; list();
}
function list() {
  const e = $("#list"); if (!e) return;
  const L = S.d.filter(d => (S.f === "All" || (S.f === "Needs a look" ? an(d).warn : d.cat === S.f)) && d.title.toLowerCase().includes(S.q.toLowerCase()));
  if (S.sort === "risk") L.sort((a, b) => an(a).fit - an(b).fit); else if (S.sort === "price") L.sort((a, b) => b.opts[b.pick].price - a.opts[a.pick].price); else L.sort((a, b) => b.id - a.id);
  e.innerHTML = L.length ? L.map(d => `<button class="card" data-risk="${rk(d)}" data-a="open" data-v="${d.id}">
    <span class="av" aria-hidden="true">${(d.agent || "P")[0]}</span>
    <span class="cb"><span class="row"><b>${d.title}</b><span>${price(d)}</span></span>
    <span class="row"><small>${d.cat} · ${d.agent || "Personal agent"} · ${d.t}</small>${st(d)}</span></span></button>`).join("")
    : '<div class="empty"><b>∅</b><p>No decisions match.</p></div>';
}
const ch = d => `<h3>Choose yourself</h3>` + d.opts.filter((o, i) => i !== d.pick).map(o =>
  `<button class="opt" data-a="alt" data-v="${o.n}"><b>${o.n}</b><br><small>${inr(o.price)}${d.unit || ""} · ${o.rating}★</small></button>`).join("");
function detail() {
  const d = S.d.find(x => x.id === S.open); if (!d) { S.open = null; return feed(); }
  const a = an(d), sv = saving(d);
  const acts = d.resp ? `<div class="note">${d.status === "blocked" ? "Stopped" : "Your response"}: <b>${d.resp}</b></div>`
    : S.choose ? ch(d)
    : d.status === "pending" ? `<div class="btns"><button class="btn pri" data-a="ap" data-v="${d.id}">Approve</button>
        <button class="btn" data-a="rj" data-v="${d.id}">Reject</button><button class="btn" data-a="choose">Choose myself</button></div>`
    : `<div class="btns"><button class="btn pri" data-a="keep">Keep decision</button>
       <button class="btn" data-a="choose">Choose myself</button><button class="btn" data-a="flag">Flag as biased</button></div>`;
  v.innerHTML = `<button class="back" data-a="back">‹ All decisions</button>
    <h2>${d.title}</h2><div class="row"><span>${d.cat} · ${d.agent || "Personal agent"} · ${d.t}</span>${st(d)}</div>
    <h3>What your agent considered</h3>` +
    d.opts.map((o, i) => `<div class="alt${i === d.pick ? " win" : ""}"><div class="row"><b>${o.n}</b><span>${inr(o.price)}${d.unit || ""}</span></div>
      <small>${o.rating}★${o.days ? ` · ${o.days} day delivery` : ""} · fit score ${Math.round(100 * a.s[i] / a.s[a.best])}%</small>
      <div>${tags(o, i, a).map(t => `<span class="tag">${t}</span>`).join("")}</div></div>`).join("") +
    `<h3>Who benefits from this choice</h3>` + a.sig.map(x => `<div class="sig ${x[0]}">${x[1]}</div>`).join("") +
    `<h3>Fit with your stated priorities: ${a.fit}%</h3><div class="bar${a.warn ? " low" : ""}"><i style="width:${a.fit}%"></i></div>` +
    (sv ? `<div class="note">Your best-fit option costs <b>${inr(sv)}</b> less.</div>` : "") + whyNote(d) + fbHtml(d) + `<div class="sticky">${acts}</div>` + ruleBtns(d);
}
function appr() {
  const L = S.d.filter(d => d.status === "pending");
  v.innerHTML = '<p class="hint">Verity holds an action here when your rule says "ask me first", it goes over your limit, or it looks influenced.</p>' +
    (L.length > 1 ? `<div class="btns" style="margin-top:0"><button class="btn pri" data-a="bulk-ok">Approve low-risk</button><button class="btn" data-a="bulk-no">Reject high-risk</button></div>` : "") +
    (L.length ? L.map(d => { const bad = an(d).sig.filter(x => x[0] === "bad").map(x => x[1]);
      return `<div class="alt"><div class="row"><b>${d.title}</b><span>${price(d)}</span></div>
        <small>${bad.join(" · ") || "Your rule asks for approval"}</small>
        <div class="btns" style="margin-top:10px"><button class="btn pri" data-a="ap" data-v="${d.id}">Approve</button>
        <button class="btn" data-a="rj" data-v="${d.id}">Reject</button><button class="btn" data-a="open" data-v="${d.id}">Details</button></div></div>`; }).join("")
      : '<div class="empty"><b>✓</b><p>All clear. No actions are waiting for you.</p><small>Press S to simulate an agent action.</small></div>');
}
function call() {
  if (S.r >= R.length) {
    const m = R.filter((r, i) => S.picks[i] === r.ag).length;
    v.innerHTML = `<h2>Round complete</h2><p>You and your agent chose the same item in <b>${m} of ${R.length}</b> decisions.</p>
      <p class="hint">Verity asks you to decide first every few days. Disagreement shows where your agent's choices drift from yours.</p>
      <div class="btns"><button class="btn pri" data-a="restart">Play again</button></div>`;
    return;
  }
  const r = R[S.r], p = S.picks[S.r], a = Core.analyse(P, r.o, r.ag);
  v.innerHTML = `<p class="hint">Your Call, ${S.r + 1} of ${R.length}. Decide before you see your agent's pick.</p><h2>${r.q}</h2>` +
    r.o.map((o, i) => `<button class="opt" data-a="pick" data-v="${i}" ${S.reveal ? "disabled" : ""}><b>${o.n}</b><br><small>${inr(o.price)} · ${o.rating}★ · ${o.days} day delivery</small></button>`).join("") +
    (S.reveal && p !== undefined ? `<div class="note">You chose <b>${r.o[p].n}</b>. Your agent chose <b>${r.o[r.ag].n}</b>. Best fit for your priorities: <b>${r.o[a.best].n}</b>.<br>
      ${r.o[r.ag].spons ? "The seller's promotion boosted your agent's pick." : p === r.ag ? "Same choice." : ""}</div>
      <div class="btns"><button class="btn pri" data-a="next">${S.r === R.length - 1 ? "See result" : "Next decision"}</button></div>` : "");
}
const PRESETS = { balanced: { price: 5, rating: 3, speed: 2 }, value: { price: 9, rating: 3, speed: 1 }, quality: { price: 3, rating: 9, speed: 2 }, fast: { price: 3, rating: 3, speed: 9 } };
const curNow = () => { try { return localStorage.getItem("verity-cur") || "INR"; } catch (e) { return "INR"; } };
const setCur = c => { try { localStorage.setItem("verity-cur", c); } catch (e) {} Core.cur = Core.CURS[c] || Core.CURS.INR; };
const zs = () => { try { return +localStorage.getItem("verity-zs") || 0; } catch (e) { return 0; } };
const zoom = d => { try { localStorage.setItem("verity-zs", String(Math.max(-1, Math.min(3, zs() + d)))); } catch (e) {} };
const download = (name, text, type) => { const u = URL.createObjectURL(new Blob([text], { type })), l = document.createElement("a"); l.href = u; l.download = name; l.click(); URL.revokeObjectURL(u); };
const presetHtml = () => `<div class="filt">${Object.keys(PRESETS).map(k => `<button data-a="preset" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>`;
const dispHtml = () => `<label class="sl mode"><span>Currency (demo rates)</span><select data-cur="1">${Object.keys(Core.CURS).map(c => `<option${curNow() === c ? " selected" : ""}>${c}</option>`).join("")}</select></label>
  <div class="btns" style="margin-top:8px"><button class="btn" data-a="tsz" data-v="-1">Smaller text</button><button class="btn" data-a="tsz" data-v="1">Larger text</button></div>`;
const privHtml = () => `<p class="hint">Verity keeps your decisions, rules and log in one place. You can take a copy or erase everything, so you stay in control of your data.</p>
  <div class="btns" style="margin-top:8px"><button class="btn" data-a="xdata">Export my data (JSON)</button><button class="btn" data-a="wipe">Delete my data</button></div>`;
const fbHtml = d => {
  const bad = an(d).sig.some(x => x[0] === "bad");
  return (bad ? `<h3>Was Verity's flag right?</h3><div class="btns" style="margin-top:8px"><button class="btn${d.fb === "right" ? " pri" : ""}" data-a="fb" data-v="right">Yes, good catch</button><button class="btn${d.fb === "wrong" ? " pri" : ""}" data-a="fb" data-v="wrong">No, false alarm</button></div>` : "") +
    (d.status === "done" ? `<div class="btns" style="margin-top:8px"><button class="btn${d.regret ? " pri" : ""}" data-a="regret">${d.regret ? "Marked as regretted" : "I regret this one"}</button></div>` : "");
};
const tourHtml = () => {
  if (S.tourHide) return "";
  const steps = [["sim", "Simulate an agent action"], ["open", "Open a decision and read the why"], ["decide", "Approve, reject or make a rule"], ["call", "Play Your Call"], ["score", "Check the scorecard in Insights"]];
  const n = steps.filter(s => TOUR[s[0]]).length;
  return `<div class="note"><div class="row"><b>Try it: ${n} of 5</b><button class="back" style="padding:0;min-height:0" data-a="tourx">Hide</button></div>${steps.map(s => `<div class="sig ${TOUR[s[0]] ? "ok" : "todo"}">${s[1]}</div>`).join("")}</div>`;
};
const seg = () => `<div class="filt"><button data-a="sv" data-v="me" class="${S.sv === "me" ? "on" : ""}">My view</button><button data-a="sv" data-v="plat" class="${S.sv === "plat" ? "on" : ""}">Platform view</button></div>`;
function scorecard() {
  const dn = S.d.filter(d => d.status === "done"), ms = S.d.map(d => d.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const appr = S.d.filter(d => d.resp === "Approved" && Number.isFinite(d.ms)), fast = appr.filter(d => d.ms < 3000).length;
  const fbs = S.d.filter(d => d.fb), right = fbs.filter(d => d.fb === "right").length;
  const ag = S.calls.n ? Math.round(100 * S.calls.agree / S.calls.n) : null, pr = fbs.length ? Math.round(100 * right / fbs.length) : null;
  const rg = dn.length ? Math.round(100 * dn.filter(d => d.regret).length / dn.length) : null, md = ms.length ? ms[Math.floor(ms.length / 2)] / 1000 : null;
  const fr = appr.length ? Math.round(100 * fast / appr.length) : null;
  const row = (n, val, tgt, pass) => `<div class="alt"><div class="row"><span>${n}</span><b>${val}</b></div><div class="row"><small>Target: ${tgt}</small><span class="chip ${pass === null ? "" : pass ? "ok" : "warn"}">${pass === null ? "Needs data" : pass ? "On track" : "Off track"}</span></div></div>`;
  return "<h3>Success scorecard</h3>" + row("Agreement rate (north star)", ag === null ? "-" : ag + "%", "80% or more", ag === null ? null : ag >= 80) +
    row("Flag precision (users agree with flags)", pr === null ? "-" : pr + "%", "75% or more", pr === null ? null : pr >= 75) +
    row("Regretted purchases", rg === null ? "-" : rg + "%", "5% or less", rg === null ? null : rg <= 5) +
    row("Median time to decide", md === null ? "-" : md.toFixed(1) + " s", "10 s or less", md === null ? null : md <= 10) +
    row("Approved in under 3 s (fatigue alarm)", fr === null ? "-" : fr + "%", "under 90%", fr === null ? null : fr < 90) +
    row("Agents connected", String(S.agents.length), "2 or more", S.agents.length >= 2);
}
function platform() {
  const tot = S.d.length || 1, cnt = {};
  S.d.forEach(d => an(d).sig.filter(x => x[0] === "bad").forEach(x => cnt[x[1]] = (cnt[x[1]] || 0) + 1));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top.length ? top[0][1] : 1;
  const spons = S.d.filter(d => d.opts[d.pick].spons).length, fl = S.d.filter(d => an(d).warn).length;
  return seg() + `<p class="hint">Preview for marketplaces. Built only from this demo's decisions, not real users.</p>
    <div class="kpis"><div class="kpi"><b>${Math.round(100 * spons / tot)}%</b><span>of agent picks were sponsored</span></div><div class="kpi"><b>${Math.round(100 * fl / tot)}%</b><span>of actions flagged</span></div></div>
    <h3>Held or blocked, by category</h3>` + CATS.map(c => { const L = S.d.filter(d => d.cat === c), h = L.filter(d => d.status !== "done").length;
      return `<div class="alt"><div class="row"><span>${c}</span><span>${h} of ${L.length}</span></div><div class="bar${L.length && h / L.length > .5 ? " low" : ""}"><i style="width:${L.length ? Math.round(100 * h / L.length) : 0}%"></i></div></div>`; }).join("") +
    "<h3>Most common influence signals</h3>" + (top.length ? top.map(x => `<div class="alt"><div class="row"><span>${x[0]}</span><b>${x[1]}</b></div><div class="bar low"><i style="width:${Math.round(100 * x[1] / mx)}%"></i></div></div>`).join("") : '<p class="hint">No signals yet.</p>') +
    `<h3>How a marketplace would use Verity</h3><div class="note"><b>Trust API.</b> Agents call the gateway before buying, so sellers can show a "checked by Verity" badge.<br><b>Ranking audit.</b> The signal counts show which placements agents lean on.<br><b>Compliance logs.</b> Every decision is exportable for users and regulators.</div><h3>Scaling plan</h3>` +
    [["Phase 1", "India: shopping and travel agents, English and Hindi, UPI-style spend rules"], ["Phase 2", "APAC and EU: local currencies and consent logs for local privacy law"], ["Phase 3", "Global: an open standard so any agent or marketplace can plug in"]].map(p => `<div class="alt"><b>${p[0]}</b><br><small>${p[1]}</small></div>`).join("");
}
const rk = d => d.status === "pending" ? "warn" : d.status === "blocked" ? "off" : (an(d).fit >= 85 ? "ok" : an(d).fit >= 70 ? "mid" : "warn");
function welcome(force) {
  let seen = false; try { seen = localStorage.getItem("verity-seen"); } catch (e) {}
  if (seen && !force) return;
  const m = $("#welcome");
  m.innerHTML = `<div class="sheetm" role="dialog" aria-modal="true" aria-labelledby="wt"><h2 id="wt">Meet Verity</h2><p>Your AI agent acts for you. Verity sits in between and checks every action against what you care about.</p>
    <ol><li>Your agent proposes an action.</li><li>Verity scores it and flags influence, such as paid placement.</li><li>You approve, reject, or turn the choice into a rule.</li></ol>
    <div class="btns"><button class="btn pri" data-a="welcome">Show me</button></div></div>`;
  m.hidden = false; m.querySelector("button").focus();
}
const whyNote = d => d.why && d.why.length && d.status !== "done" ? `<div class="note">Why: ${d.why.join(" · ")}</div>` : "";
const ruleBtns = d => { const n = d.opts[d.pick].n;
  return `<details${S.sec.more ? " open" : ""}><summary data-a="sec" data-v="more">Rules and notes</summary><div class="secb"><h3>Make it a rule</h3><div class="btns" style="margin-top:8px"><button class="btn" data-a="r-ask">Always ask for ${d.cat}</button><button class="btn" data-a="r-auto">Allow ${d.cat} automatically</button><button class="btn" data-a="blk" data-v="${n}">Block ${n}</button></div>
  <h3>Your note</h3><textarea id="note" class="search" rows="2" placeholder="Add a note for your records">${d.note || ""}</textarea><div class="btns" style="margin-top:8px"><button class="btn" data-a="note">Save note</button></div></div></details>`; };
function bulk(ok) {
  const L = S.d.filter(d => d.status === "pending" && (ok ? an(d).fit >= 85 : an(d).fit < 70));
  L.forEach(d => api("POST", "/api/decision", ok ? { id: d.id, status: "done", resp: "Approved" } : { id: d.id, status: "blocked", resp: "Rejected by you" }));
  toast(L.length ? `${ok ? "Approved" : "Rejected"} ${L.length}` : "Nothing to " + (ok ? "approve" : "reject"));
}
function extraRules() {
  const chk = (k, l) => `<label class="mode" style="margin:14px 0"><span>${l}</span><input type="checkbox" data-t="${k}" ${P[k] ? "checked" : ""}></label>`;
  const sl2 = (k, l, max, step) => `<label class="sl"><span>${l}: <b id="v-${k}">${fmt[k](P[k] || 0)}</b></span><input type="range" data-k="${k}" min="0" max="${max}" step="${step}" value="${P[k] || 0}"></label>`;
  return chk("holdSpons", "Always hold sponsored picks") + chk("quiet", "Quiet hours: hold everything 10 PM to 7 AM") +
    sl2("daily", "Daily spend cap", 20000, 1000) + sl2("expiry", "Auto-reject approvals after", 30, 5) + "<h4 class=\"sub2\">Blocked sellers</h4>" +
    ((P.blocked || []).length ? P.blocked.map(n => `<div class="row alt"><span>${n}</span><button class="btn" style="flex:none;min-width:0;padding:4px 10px" data-a="unblk" data-v="${n}">Unblock</button></div>`).join("") : '<p class="hint">None yet. Block a seller from any decision.</p>');
}
function spendBars() {
  const cs = CATS.map(c => [c, S.d.filter(d => d.status === "done" && d.cat === c).reduce((t, d) => t + d.opts[d.pick].price, 0)]), mx = Math.max(1, ...cs.map(x => x[1]));
  return "<h3>Spend by category</h3>" + cs.map(x => `<div class="alt"><div class="row"><span>${x[0]}</span><span>${inr(x[1])}</span></div><div class="bar"><i style="width:${Math.round(100 * x[1] / mx)}%"></i></div></div>`).join("");
}
function agentsHtml() {
  return S.agents.map(g => {
    const L = S.d.filter(d => (d.agent || "Personal agent") === g.name);
    const t = L.length ? Math.round(L.reduce((s, d) => s + an(d).fit, 0) / L.length) : "-";
    return `<div class="alt"><div class="row"><b>${g.name}</b><span>trust ${t}</span></div><small>${L.length} decisions · key <code>${g.key}</code></small><label class="mode" style="margin-top:6px"><small>Pause this agent</small><input type="checkbox" data-o="${g.name}" ${(P.off || {})[g.name] ? "checked" : ""}></label></div>`;
  }).join("") + `<div class="note">Agents POST each action to <code>${location.origin}/api/agent/action</code> with their <code>x-agent-key</code>. Verity replies <b>allow</b>, <b>hold</b> or <b>block</b>.</div>`;
}
const sec = (id, title, body) => `<details${S.sec[id] ? " open" : ""}><summary data-a="sec" data-v="${id}">${title}</summary><div class="secb">${body}</div></details>`;
function prefs() {
  const sl = (k, l, min, max, step, val, f) => `<label class="sl"><span>${l}: <b id="v-${k}">${f(val)}</b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const md = CATS.map(c => `<label class="sl mode"><span>${c}</span><select data-m="${c}">` +
    [["auto", "Act automatically"], ["ask", "Ask me first"], ["block", "Never allow"]].map(o =>
      `<option value="${o[0]}"${P.mode[c] === o[0] ? " selected" : ""}>${o[1]}</option>`).join("") + "</select></label>").join("");
  v.innerHTML = '<p class="hint">Tell Verity what matters. Every decision is re-scored against this, live.</p><div class="note" id="live"></div>' +
    sec("pri", "Your priorities", presetHtml() + sl("price", "Price importance", 0, 10, 1, P.w.price, x => x) + sl("rating", "Rating importance", 0, 10, 1, P.w.rating, x => x) +
      sl("speed", "Delivery speed importance", 0, 10, 1, P.w.speed, x => x) + sl("budget", "Per-purchase limit", 1000, 10000, 500, P.budget, inr)) +
    sec("auto", "What agents may do on their own", md) + sec("safe", "Safety rules", extraRules()) + sec("ag", "Connected agents", agentsHtml()) +
    sec("alert", "Alerts and webhook", `<label class="sl"><span>Send held and blocked actions to a webhook URL (Slack, Discord, n8n)</span><input id="hook" class="search" style="margin-top:6px" placeholder="https://..." value="${S.hook.replace(/"/g, "&quot;")}"></label>
      <div class="btns" style="margin-top:8px"><button class="btn" data-a="hooksave">Save webhook</button><button class="btn" data-a="hooktest">Send test</button><button class="btn" data-a="notif">Desktop alerts</button></div>`) +
    sec("disp", "Display and region", dispHtml()) + sec("priv", "Privacy and your data", privHtml()) +
    '<div class="btns"><button class="btn" data-a="reset">Reset demo</button><button class="btn" data-a="intro">Replay intro</button></div>';
  live();
}
function live() {
  const e = $("#live"); if (!e) return;
  e.innerHTML = `With these settings, <b>${S.d.filter(d => an(d).warn).length} of ${S.d.length}</b> decisions need a look. Agent trust score: <b>${trust()}</b>.`;
}
function stats() {
  if (S.sv === "plat") return v.innerHTML = platform();
  const fl = S.d.filter(d => an(d).warn).length, done = S.r >= R.length;
  const m = R.filter((r, i) => S.picks[i] === r.ag).length;
  const stop = S.d.filter(d => d.status === "blocked"), held = stop.reduce((t, d) => t + d.opts[d.pick].price, 0);
  const ov = S.d.filter(d => d.resp && (d.resp.startsWith("You chose") || d.resp === "Flagged")).length;
  const cells = [[trust(), "agent trust score"], [S.d.length, "decisions audited"], [fl, "flagged as possibly influenced"],
    [stop.length, "agent actions stopped"], [inr(held), "spend held back"], [inr(S.d.reduce((t, d) => t + saving(d), 0)), "you could have saved"],
    [ov, "decisions you overrode or flagged"], [done ? Math.round(m / R.length * 100) + "%" : "-", "agreement when you decide first"]];
  const trend = [2, 1, 3, 2, 2, 3, fl];
  v.innerHTML = seg() + scorecard() +
    `<div class="kpis">${cells.map(c => `<div class="kpi"><b>${c[0]}</b><span>${c[1]}</span></div>`).join("")}</div>` +
    `<h3>Decisions needing a look, last 7 days</h3><div class="trend">${trend.map((n, i) =>
      `<div><i style="height:${Math.min(n, 4) * 28}px"></i><small>${i === 6 ? "Today" : "D-" + (6 - i)}</small></div>`).join("")}</div>${spendBars()}
    <h3>Audit log (saved on the server)</h3>` +
    (S.log.length ? S.log.slice(0, 8).map(l => `<div class="alt"><small>${l[0]}</small> ${l[1]}</div>`).join("")
      : '<p class="hint">Actions will appear here.</p>') +
    '<div class="btns"><button class="btn" data-a="export">Export log (CSV)</button><button class="btn" data-a="print">Print report</button></div>';
}
function chrome() {
  document.documentElement.dataset.theme = theme(); $(".app").style.zoom = 1 + 0.1 * zs();
  const pend = S.d.filter(d => d.status === "pending").length;
  document.querySelectorAll("nav button").forEach(b => {
    const on = b.dataset.v === S.tab; b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    if (b.dataset.v === "appr") b.dataset.badge = pend || "";
  });
  const p = $("#pause"); p.textContent = P.paused ? "Agent paused" : "Agent active"; p.classList.toggle("off", P.paused);
  const c = $("#conn"); c.textContent = S.ok ? "Live" : "Offline"; c.classList.toggle("on", S.ok);
}
function render() {
  chrome();
  if (!S.ok) { v.innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="note">Connecting to the Verity server. If this stays, run <b>node server.js</b> and open <b>http://localhost:3000</b>.</div>'; return; }
  ({ feed: () => (S.open ? detail() : feed()), appr, call, prefs, stats, ...(window.EXT || {}) })[S.tab]();
}
function sync(x) {
  const prev = S.d.length ? Math.max(...S.d.map(z => z.id)) : 0;
  P = x.P; S.d = x.d; S.log = x.log; S.r = x.r; S.picks = x.picks; S.auto = x.auto; S.agents = x.agents || []; S.calls = x.calls || { n: 0, agree: 0 }; S.hook = x.hook || ""; S.ok = true;
  if (!S.shown) { S.shown = true; welcome(); }
  const fresh = S.d.filter(z => z.id > prev);
  if (prev && fresh.length) toast(`${fresh[0].title}: ${word(fresh[0])}`);
  if (prev) fresh.filter(z => z.status === "pending").forEach(z => { try { if (Notification.permission === "granted") new Notification("Verity: approval needed", { body: `${z.title} (${price(z)})` }); } catch (er) {} });
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { if (S.tab === "feed" && !S.open) list(); live(); chrome(); }
  else render();
}
const es = new EventSource("/api/events");
es.addEventListener("sync", e => sync(JSON.parse(e.data)));
es.onerror = () => { S.ok = false; chrome(); };

document.addEventListener("input", e => {
  if (e.target.id === "q") { S.q = e.target.value; list(); return; }
  const k = e.target.dataset.k, m = e.target.dataset.m;
  if (e.target.id === "sort") { S.sort = e.target.value; list(); return; }
  const tg = e.target.dataset.t, of = e.target.dataset.o;
  if (e.target.dataset.cur) { setCur(e.target.value); render(); return; }
  if (tg) { P[tg] = e.target.checked; live(); sp(); return; }
  if (of) { P.off = P.off || {}; P.off[of] = e.target.checked; sp(`${e.target.checked ? "Paused" : "Resumed"} ${of}`); return; }
  if (m) { P.mode[m] = e.target.value; live(); sp(); return; }
  if (!k) return;
  const n = +e.target.value;
  if (k === "budget" || k === "daily" || k === "expiry") P[k] = n; else P.w[k] = n;
  $("#v-" + k).textContent = (fmt[k] || (x => x))(n);
  live(); sp();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, x = b.dataset.v;
  const d = S.d.find(q => q.id === (a === "ap" || a === "rj" ? +x : S.open));
  if (a === "tundo") { if (S.undo) { S.undo(); S.undo = null; toast("Undone"); } return; }
  if (a === "tab") { S.tab = x; S.open = null; S.choose = false; S.openAt = 0; if (x === "stats") tick("score"); }
  if (a === "open") { S.open = +x; S.tab = "feed"; S.choose = false; S.openAt = Date.now(); tick("open"); }
  if (a === "back") { S.open = null; S.openAt = 0; }
  if (a === "f") S.f = x;
  if (a === "theme") { try { localStorage.setItem("verity-theme", theme() === "dark" ? "light" : "dark"); } catch (er) {} }
  if (a === "sim") { api("POST", "/api/simulate"); tick("sim"); }
  if (a === "auto") { api("POST", "/api/auto", { on: !S.auto }); toast(S.auto ? "Live agent stopped" : "Live agent started: a new action every 15 seconds"); }
  if (a === "pause") { P.paused = !P.paused; sp(P.paused ? "You paused the agent" : "You resumed the agent"); toast(P.paused ? "Agent paused" : "Agent resumed"); }
  if (a === "hooksave") { api("POST", "/api/hook", { url: $("#hook").value }).then(r => r && !r.ok ? r.json().then(j => toast(j.error)) : toast("Webhook saved")); }
  if (a === "hooktest") { api("POST", "/api/hook/test").then(r => r && !r.ok ? r.json().then(j => toast(j.error)) : toast("Test sent. See the audit log on Insights")); }
  if (a === "notif") { try { Notification.requestPermission().then(p => toast(p === "granted" ? "Desktop alerts on" : "Alerts blocked in the browser")); } catch (er) { toast("Alerts not supported here"); } }
  if (a === "r-ask" && d) { P.mode[d.cat] = "ask"; sp("Rule: always ask for " + d.cat); toast("Rule saved: ask first for " + d.cat); }
  if (a === "r-auto" && d) { P.mode[d.cat] = "auto"; sp("Rule: allow " + d.cat + " automatically"); toast("Rule saved: " + d.cat + " runs automatically"); }
  if (a === "blk") { P.blocked = P.blocked || []; if (!P.blocked.includes(x)) P.blocked.push(x); sp("Blocked seller: " + x); toast(x + " is blocked from now on"); }
  if (a === "unblk") { P.blocked = (P.blocked || []).filter(n => n !== x); sp("Unblocked seller: " + x); }
  if (a === "note" && d) { api("POST", "/api/note", { id: d.id, note: $("#note").value }); toast("Note saved"); }
  if (a === "bulk-ok") bulk(true);
  if (a === "bulk-no") bulk(false);
  if (a === "print") window.print();
  if (a === "fb" && d) { api("POST", "/api/feedback", { id: d.id, fb: x }); toast("Feedback saved"); }
  if (a === "regret" && d) { api("POST", "/api/feedback", { id: d.id, regret: !d.regret }); toast(d.regret ? "Regret removed" : "Marked as regretted"); }
  if (a === "sv") S.sv = x;
  if (a === "preset") { P.w = clone(PRESETS[x]); sp("Preset: " + x); toast("Priorities set to " + x); }
  if (a === "tsz") zoom(+x);
  if (a === "xdata") { download("verity-my-data.json", JSON.stringify({ rules: P, decisions: S.d, auditLog: S.log, agreement: S.calls }, null, 2), "application/json"); toast("Data exported"); }
  if (a === "wipe") { if (confirm("Delete all your decisions, logs and rules from Verity?")) { api("POST", "/api/reset"); api("POST", "/api/hook", { url: "" }); TOUR = {}; saveTour(); toast("Your data was deleted"); } }
  if (a === "tourx") { S.tourHide = true; try { localStorage.setItem("verity-tourx", "1"); } catch (er) {} }
  if (a === "sec") { e.preventDefault(); S.sec[x] = !S.sec[x]; }
  if (a === "welcome") { $("#welcome").hidden = true; try { localStorage.setItem("verity-seen", "1"); } catch (er) {} }
  if (a === "intro") welcome(true);
  if (a === "choose") S.choose = true;
  if (d) {
    if (a === "ap") resolve(d, "done", "Approved");
    if (a === "rj") resolve(d, "blocked", "Rejected by you", "Rejected");
    if (a === "keep") resolve(d, "done", "Kept");
    if (a === "flag") resolve(d, "done", "Flagged");
    if (a === "alt") { resolve(d, "done", "You chose " + x); S.choose = false; }
  }
  if (a === "pick") { S.picks[S.r] = +x; S.reveal = true; mp(); tick("call"); api("POST", "/api/call", { agree: +x === R[S.r].ag }); }
  if (a === "next") { S.r++; S.reveal = false; mp(); }
  if (a === "restart") { S.r = 0; S.picks = []; S.reveal = false; mp(); }
  if (a === "reset") { TOUR = {}; saveTour(); api("POST", "/api/reset"); S.f = "All"; S.q = ""; S.reveal = false; toast("Demo reset"); }
  if (a === "export") {
    const csv = "\ufefftime,event\n" + S.log.map(l => `${l[0]},"${l[1].replace(/"/g, '""')}"`).join("\n");
    const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" })), l = document.createElement("a");
    l.href = u; l.download = "verity-audit-log.csv"; l.click(); URL.revokeObjectURL(u); toast("Log exported");
    return;
  }
  render();
  if (a === "tab" || a === "open" || a === "back") window.scrollTo(0, 0);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { $("#welcome").hidden = true; return; }
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
  const t = ["feed", "appr", "call", "prefs", "stats"][+e.key - 1];
  if (t) { S.tab = t; S.open = null; render(); window.scrollTo(0, 0); } else if (e.key === "s") api("POST", "/api/simulate");
});
render();
