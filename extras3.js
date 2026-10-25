// Verity v9 UI layer: gateway controls, orders, price watch, savings goal, profiles, PIN, backup, privacy.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = k => { try { return JSON.parse(localStorage.getItem("vx3-" + k)); } catch (e) { return null; } };
  const SV = (k, x) => { try { localStorage.setItem("vx3-" + k, JSON.stringify(x)); } catch (e) {} };
  const sm = "flex:none;min-width:0;padding:4px 10px", cost = d => d.opts[d.pick].price;
  const copy = (t, m) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(m || "Copied"), () => toast("Copy is not available here"));
  // Demo-grade PIN hash (browser only). A real deployment would use the account's own sign-in.
  const hash = s => { let h = 2166136261; for (const c of "verity" + s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const selz = (k, o, cur) => `<select data-z="${k}">${o.map(x => `<option value="${x[0]}"${+x[0] === +cur ? " selected" : ""}>${x[1]}</option>`).join("")}</select>`;
  const upd = k => { P[k] = P[k] || {}; return P[k]; };

  const sugg = () => { const out = [];
    Core.CATS.forEach(c => { const L = S.d.filter(d => d.cat === c && d.resp), rj = L.filter(d => /^reject/i.test(d.resp)).length, ap = L.filter(d => /^approv/i.test(d.resp) && an(d).fit >= 85);
      if (rj >= 2 && !(P.strict || {})[c]) out.push([`You rejected ${rj} ${c} orders. Only allow trusted sellers there?`, "strict:" + c]);
      if (ap.length >= 3 && !P.auto) out.push([`You approved ${ap.length} low-risk ${c} orders. Turn on autopilot?`, "auto:" + Math.ceil(Math.max(...ap.map(cost)) / 500) * 500]); });
    return "<h3>Suggested for you</h3>" + (out.length ? out.map(s => `<div class="note row"><span>${s[0]}</span><button class="btn" style="${sm}" data-a="zsug" data-v="${s[1]}">Apply</button></div>`).join("") : '<p class="hint">Suggestions appear after you approve or reject a few held actions.</p>'); };

  const controls = () => { const cc = P.catCap || {}, st = P.strict || {}, tr = P.trusted || [], seen = [...new Set(S.d.map(d => d.opts[d.pick].n))].filter(n => !tr.includes(n));
    return `<p class="hint">Gateway rules. Verity enforces them on every agent, including ones that are not yours.</p>
    <label class="sl"><span>Autopilot: approve low-risk "ask first" actions up to <b id="z-a">${P.auto ? inr(P.auto) : "Off"}</b></span><input type="range" data-z="auto" min="0" max="5000" step="250" value="${P.auto || 0}"></label>
    <label class="mode" style="margin:12px 0"><span>Away mode: hold every purchase</span><input type="checkbox" data-z="away" ${P.away ? "checked" : ""}></label>
    <label class="sl mode"><span>Slowest delivery I accept</span>${selz("maxDays", [[0, "Any"], [2, "2 days"], [3, "3 days"], [5, "5 days"], [7, "7 days"]], P.maxDays || 0)}</label>
    <label class="sl mode"><span>Lowest rating I accept</span>${selz("minRating", [[0, "Any"], [3.5, "3.5 stars"], [4, "4 stars"], [4.3, "4.3 stars"]], P.minRating || 0)}</label>
    <h3>Daily and monthly caps per category</h3>${Core.CATS.map(c => `<div class="row alt" style="flex-wrap:wrap"><span>${c}</span><span><input class="search" style="width:92px;margin:0;padding:4px;min-height:32px" type="number" min="0" data-z="cap" data-c="${c}" value="${cc[c] || ""}" placeholder="Daily cap" aria-label="${c} daily cap"> <input class="search" style="width:92px;margin:0;padding:4px;min-height:32px" type="number" min="0" data-z="mcap" data-c="${c}" value="${(P.monthCap || {})[c] || ""}" placeholder="Month cap" aria-label="${c} monthly cap"> <label><input type="checkbox" data-z="strict" data-c="${c}" ${st[c] ? "checked" : ""}> trusted only</label></span></div>`).join("")}
    <h3>Trusted sellers</h3>` + (tr.length ? tr.map(n => `<div class="alt row"><span>${esc(n)}</span><button class="btn" style="${sm}" data-a="zuntrust" data-v="${esc(n)}">Remove</button></div>`).join("") : '<p class="hint">None yet.</p>') +
    `<input id="ztn" class="search" list="zsl" placeholder="Seller name"><datalist id="zsl">${seen.map(n => `<option value="${esc(n)}">`).join("")}</datalist><div class="btns" style="margin-top:8px"><button class="btn" data-a="ztrust">Add trusted seller</button></div>` + sugg(); };

  const ST = ["Placed", "Shipped", "Out for delivery", "Delivered"];
  const stage = d => { const dy = d.opts[d.pick].days; return !d.ts || !dy ? 3 : Math.min(3, Math.floor(4 * ((Date.now() - d.ts) / 2e4) / dy)); };
  const orders = () => { const R = LS("ret") || {}, L = S.d.filter(d => d.status === "done" && d.cat !== "Subscriptions" && d.cat !== "Bills");
    return '<p class="hint">Tracking is simulated here: one delivery day passes every 20 seconds.</p>' + (L.length ? L.map(d => { const s = stage(d);
      return `<div class="alt"><div class="row"><b>${esc(d.title)}</b><span>${price(d)}</span></div><small>${esc(d.opts[d.pick].n)} · ${d.t}${R[d.id] ? " · return requested" : ""}</small><div class="steps">${ST.map((n, i) => `<span class="${i <= s ? "" : "todo"}">${n}</span>`).join("")}</div><div class="btns" style="margin-top:4px"><button class="btn" style="${sm}" data-a="zret" data-v="${d.id}" ${R[d.id] ? "disabled" : ""}>Return or refund</button><button class="btn" style="${sm}" data-a="zprob" data-v="${d.id}">Report a problem</button></div></div>`; }).join("") : '<div class="empty"><p>No orders yet. Send a pack from Packs.</p></div>'); };

  const pocket = () => { const W = LS("watch") || [], g = LS("goal") || 0, sv = S.d.reduce((t, d) => t + saving(d), 0), p = g ? Math.min(100, Math.round(100 * sv / g)) : 0;
    return `<h3>Price watch</h3><p class="hint">Prices are simulated here. A real version would read the marketplace price feed.</p><input id="zwn" class="search" placeholder="Item, for example Running shoes"><input id="zwp" class="search" type="number" min="1" placeholder="Alert me at or below, in rupees"><div class="btns" style="margin-top:8px"><button class="btn" data-a="zwadd">Add to watch</button><button class="btn pri" data-a="zwcheck">Check prices now</button></div>` +
      W.map((w, i) => `<div class="alt row"><span>${esc(w.n)}<br><small>Target ${inr(w.p)}${w.now ? " · now " + inr(w.now) + (w.now <= w.p ? " · below target" : "") : ""}</small></span><button class="btn" style="${sm}" data-a="zwdel" data-v="${i}">Remove</button></div>`).join("") +
      `<h3>Savings goal</h3><p class="hint">Money you could keep by following your best-fit picks.</p><input id="zg" class="search" type="number" min="0" placeholder="Goal in rupees" value="${g || ""}"><div class="btns" style="margin-top:8px"><button class="btn" data-a="zgsave">Set goal</button></div><div class="kpis"><div class="kpi"><b>${inr(sv)}</b><span>could be saved so far</span></div><div class="kpi"><b>${g ? p + "%" : "-"}</b><span>of goal</span></div></div>${g ? `<div class="bar"><i style="width:${p}%"></i></div>` : ""}`; };

  const account = () => { const PR = LS("profiles") || {}, hp = !!LS("pin");
    return `<h3>Profiles</h3><p class="hint">Save your rules under a name and switch later, for example Me, Parent or Student.</p>` +
      Object.keys(PR).map(n => `<div class="alt row"><b>${esc(n)}</b><span><button class="btn" style="${sm}" data-a="zpapply" data-v="${esc(n)}">Use</button> <button class="btn" style="${sm}" data-a="zpdel" data-v="${esc(n)}">Delete</button></span></div>`).join("") +
      `<input id="zpn" class="search" placeholder="Profile name"><div class="btns" style="margin-top:8px"><button class="btn" data-a="zpsave">Save current rules</button></div>
      <h3>Security</h3><p class="hint">Demo-grade: the PIN is stored hashed in this browser only. A real deployment would use the account's own sign-in.</p>
      <input id="zpin" class="search" type="password" inputmode="numeric" maxlength="8" placeholder="${hp ? "PIN is set. Enter a new one to change it" : "Choose a 4 to 8 digit PIN"}"><input id="zpa" class="search" type="number" min="0" placeholder="Ask for PIN on approvals from, in rupees" value="${LS("pina") || ""}">
      <label class="sl mode"><span>Auto-lock after</span>${selz("lock", [[0, "Never"], [1, "1 minute"], [5, "5 minutes"], [15, "15 minutes"]], LS("lock") || 0)}</label><div class="btns"><button class="btn pri" data-a="zpinsave">Save</button>${hp ? '<button class="btn" data-a="zpinclr">Remove PIN</button>' : ""}</div>
      <h3>Your data</h3><p class="hint">${S.d.length} decisions, ${(P.rules || []).length} rules and ${S.agents.length} agent keys are stored by this prototype${S.hook ? ", plus 1 webhook" : ""}.</p>
      <div class="btns"><button class="btn" data-a="zbackup">Download backup</button><label class="btn" style="cursor:pointer;display:flex;align-items:center;justify-content:center">Restore backup<input type="file" accept="application/json" data-z="restore" hidden></label><button class="btn" data-a="zdata">Download my data</button><button class="btn" data-a="zwipe">Delete my data</button></div>`; };

  window.XTABS = [...(window.XTABS || []), ["controls", "Controls"], ["orders", "Orders"], ["pocket", "Pocket"], ["account", "Account"]];
  window.XSEC = Object.assign(window.XSEC || {}, { controls, orders, pocket, account });
  setInterval(() => { if (S.tab === "x" && document.querySelector('[data-a="zret"]') && !/INPUT|SELECT/.test(document.activeElement.tagName)) render(); }, 5000);

  // PIN gate: runs before the app's own handler and swallows the click when the PIN is wrong.
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-a="ap"],[data-a="bulk-ok"]'), pn = LS("pin"); if (!b || !pn) return;
    const d = S.d.find(x => x.id === +b.dataset.v); if (d && cost(d) < (LS("pina") || 0)) return;
    const t = window.prompt("Enter your Verity PIN to approve"); if (t !== null && hash(t) === pn) return;
    e.stopImmediatePropagation(); e.preventDefault(); toast("Wrong PIN. Nothing was approved");
  }, true);

  const lock = () => { let l = document.getElementById("zlock"); if (l && !l.hidden) return;
    if (!l) { l = document.createElement("div"); l.id = "zlock"; l.className = "modal"; l.style.zIndex = 50; $(".app").appendChild(l); }
    l.hidden = false; l.innerHTML = '<div class="sheetm"><h2>Locked</h2><p class="hint">Enter your PIN to continue.</p><input id="zlp" class="search" type="password" inputmode="numeric"><div class="btns"><button class="btn pri" data-a="zunlock">Unlock</button></div></div>'; };
  let idle = Date.now();
  ["click", "keydown", "pointermove", "touchstart"].forEach(ev => document.addEventListener(ev, () => { const l = document.getElementById("zlock"); if (!l || l.hidden) idle = Date.now(); }, true));
  setInterval(() => { const m = LS("lock"); if (LS("pin") && m && Date.now() - idle > m * 6e4) lock(); }, 5000);

  const snap = () => ({ P, watch: LS("watch") || [], goal: LS("goal") || 0, profiles: LS("profiles") || {}, savedAt: new Date().toISOString() });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b || b.dataset.a[0] !== "z") return; const a = b.dataset.a, x = b.dataset.v, v2 = id => ($(id) ? $(id).value.trim() : "");
    if (a === "zuntrust") { P.trusted = (P.trusted || []).filter(n => n !== x); sp("Trusted seller removed"); }
    if (a === "ztrust") { const n = v2("#ztn"); if (n && !(P.trusted || []).includes(n)) { P.trusted = [...(P.trusted || []), n]; sp("Trusted seller added: " + n); } }
    if (a === "zsug") { const [k, val] = x.split(":"); if (k === "strict") upd("strict")[val] = true; else P.auto = +val; sp("Applied suggestion"); toast("Suggestion applied"); }
    if (a === "zret" || a === "zprob") { const d = S.d.find(q => q.id === +x); if (d) { const o = d.opts[d.pick];
      if (a === "zret") { const R = LS("ret") || {}; R[d.id] = Date.now(); SV("ret", R); }
      copy(a === "zret" ? `Subject: Return request for "${o.n}"\n\nHello,\n\nI would like to return "${o.n}" (${inr(o.price)}), ordered through an automated agent. Please share the return steps and refund timeline.\n\nThank you.` : `Subject: Problem with my order "${o.n}"\n\nHello,\n\nThere is a problem with my order of "${o.n}" (${inr(o.price)}). Please contact me to resolve it.\n\nThank you.`, a === "zret" ? "Return request copied" : "Message copied"); } }
    if (a === "zwadd") { const n = v2("#zwn"), p = +v2("#zwp"); if (n && p > 0) { SV("watch", [...(LS("watch") || []), { n, p }]); } else toast("Add an item and a target price"); }
    if (a === "zwdel") SV("watch", (LS("watch") || []).filter((q, i) => i !== +x));
    if (a === "zwcheck") { const W = (LS("watch") || []).map(w => ({ ...w, now: Math.round(w.p * (.85 + Math.random() * .5)) })); SV("watch", W); const n = W.filter(w => w.now <= w.p).length; toast(n ? n + " item(s) dropped to your target" : "No price drops yet"); }
    if (a === "zgsave") { SV("goal", +v2("#zg") || 0); toast("Goal saved"); }
    if (a === "zpsave") { const n = v2("#zpn"); if (n) { const PR = LS("profiles") || {}; PR[n] = JSON.parse(JSON.stringify(P)); SV("profiles", PR); toast("Profile saved"); } else toast("Name the profile first"); }
    if (a === "zpapply") { const PR = LS("profiles") || {}; if (PR[x]) { Object.assign(P, PR[x]); sp("Profile: " + x); toast(x + " profile applied"); } }
    if (a === "zpdel") { const PR = LS("profiles") || {}; delete PR[x]; SV("profiles", PR); }
    if (a === "zpinsave") { const p = v2("#zpin"); if (p) { if (!/^\d{4,8}$/.test(p)) { toast("PIN must be 4 to 8 digits"); return; } SV("pin", hash(p)); } SV("pina", +v2("#zpa") || 0); toast("Security saved"); }
    if (a === "zpinclr") { SV("pin", null); SV("lock", 0); toast("PIN removed"); }
    if (a === "zunlock") { if (hash($("#zlp").value) === LS("pin")) { document.getElementById("zlock").hidden = true; idle = Date.now(); } else toast("Wrong PIN"); return; }
    if (a === "zbackup") { download("verity-backup.json", JSON.stringify(snap(), null, 2), "application/json"); toast("Backup downloaded"); }
    if (a === "zdata") { download("verity-my-data.json", JSON.stringify({ decisions: S.d, rules: P.rules || [], agents: S.agents.map(g => ({ name: g.name, scopes: g.scopes, revoked: !!g.revoked })), log: S.log }, null, 2), "application/json"); toast("Data downloaded"); }
    if (a === "zwipe") { if (confirm("Delete all your data and start again?")) document.querySelector('[data-a="xreset"]').click(); return; }
    render();
  }, true);
  document.addEventListener("input", e => { const t = e.target; if (t.dataset.z === "auto") { P.auto = +t.value; $("#z-a").textContent = P.auto ? inr(P.auto) : "Off"; sp(); } });
  document.addEventListener("change", e => { const t = e.target, k = t.dataset.z; if (!k) return; const c = t.dataset.c, n = +t.value;
    if (k === "away") { P.away = t.checked; sp("Away mode " + (t.checked ? "on" : "off")); }
    if (k === "maxDays" || k === "minRating") { P[k] = n; sp("Updated " + k); }
    if (k === "strict") { upd("strict")[c] = t.checked; sp("Trusted-only " + c); }
    if (k === "mcap") { upd("monthCap")[c] = n || 0; sp("Monthly cap " + c); }
    if (k === "cap") { upd("catCap")[c] = n || 0; sp("Cap " + c); }
    if (k === "lock") SV("lock", n);
    if (k === "restore" && t.files[0]) t.files[0].text().then(s => { try { const b = JSON.parse(s); if (!b.P || !b.P.w) throw 0; Object.assign(P, b.P); SV("watch", b.watch || []); SV("goal", b.goal || 0); SV("profiles", b.profiles || {}); sp("Backup restored"); toast("Backup restored"); render(); } catch (er) { toast("That file is not a Verity backup"); } });
    if (k !== "restore") render(); });
})();
