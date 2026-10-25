// Verity v7 UI layer: receipt-style decision card, integration hub, extra guards, receipt verification.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sm = "flex:none;min-width:0;padding:4px 10px", Y = { out: "", chain: null, look: "" };
  const copy = (t, m) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(m || "Copied"), () => toast("Copy is not available here"));
  const SAMPLE = { intent: "Buy running shoes", category: "Fashion", chosen: "FSN-A", dry_run: true, listings: [
    { id: "FSN-A", title: "StrideMax Pro", sellingPrice: 6499, mrp: 12999, rating: 4.2, ratingCount: 61, deliveryDays: 2, sponsored: true, commissionPct: 18, priceHistory30d: [6399, 6499, 6499, 6399, 6599], returnRatePct: 24 },
    { id: "FSN-B", title: "Nimbus Run", sellingPrice: 4799, mrp: 5999, rating: 4.5, ratingCount: 8200, deliveryDays: 3, commissionPct: 9, priceHistory30d: [4799, 4899, 4799, 4999, 4799] }] };
  const CURL = () => `curl -X POST ${location.origin}/v1/check \\\n  -H "x-agent-key: verity-demo-key" -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: order-1042" \\\n  -d '${JSON.stringify(SAMPLE)}'`;
  const call = (m, u, b) => fetch(u, { method: m, headers: { "Content-Type": "application/json", "x-agent-key": "verity-demo-key" }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());

  // Receipt card on the decision screen: verdict stamp, who did what, signed ID, and how the risk number is built.
  const rcpt = d => {
    const rk = Core.risk(P, d.opts, d.pick), rc = d.rc, o = d.opts[d.pick], a = an(d), dn = !!d.resp || d.status === "done";
    const vd = d.status === "pending" ? ["hold", "Held"] : d.status === "blocked" ? ["no", "Stopped"] : ["ok", "Allowed"], col = ["var(--mid)", "var(--warn)"];
    const g = P.guardian || {}, ph = String(g.phone || "").replace(/\D/g, "");
    const wa = d.status === "pending" && ph && cost(d) >= (g.above || 0) ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${encodeURIComponent(`Verity needs your OK: ${d.title}, ${price(d)}. ${a.sig.filter(x => x[0] === "bad")[0] ? a.sig.filter(x => x[0] === "bad")[0][1] + "." : ""}`)}">Ask ${esc(g.name || "family")} on WhatsApp</a>` : "";
    return `<div class="rcpt"><span class="stamp ${vd[0]}">${vd[1]}</span>
      <div class="id">${rc ? "Receipt " + rc.id : "Sample record, not sealed"}</div>${rc ? `<div class="id">sig ${rc.hash.slice(0, 24)}…</div>` : ""}
      <div class="steps"><span>Agent proposed</span><span>Verity checked</span><span class="${dn ? "" : "todo"}">You decided</span></div>
      <b>Risk ${rk.risk} of 100</b><div class="stk"><i style="width:${rk.parts[0][1]}%;background:${col[0]}"></i><i style="width:${rk.parts[1][1]}%;background:${col[1]}"></i></div>
      <small>${rk.parts[0][0]}: ${rk.parts[0][1]} · ${rk.parts[1][0]}: ${rk.parts[1][1]}</small>
      ${rk.parts[1][1] ? `<div class="hint" style="margin:8px 0 0">Without the deceptive patterns, fit would be ${rk.lift}% instead of ${a.fit}%.</div>` : ""}
      <details><summary style="min-height:36px;font-weight:500;font-size:13px">How is this calculated?</summary><p class="hint" style="margin:0 0 8px">Paid placement, defaults and margin gaps are shown as flags. Only priority mismatch and deceptive patterns move the risk number.</p></details>
      <div class="btns" style="margin-top:10px">${wa}<button class="btn" data-a="print">Print receipt</button></div></div>`;
  };
  const d0 = window.detail;
  window.detail = function () { d0(); const d = S.d.find(x => x.id === S.open); if (!d) return; const h = v.querySelector("h2"); if (h) (h.nextElementSibling || h).insertAdjacentHTML("afterend", rcpt(d)); };
  const cost = d => d.opts[d.pick].price;

  const keyRow = g => { const sc = g.scopes || {}, cats = sc.cats && sc.cats.length ? sc.cats.join(", ") : "All categories";
    return `<div class="alt"><div class="row"><b>${esc(g.name)}</b>${g.revoked ? '<span class="chip warn">Revoked</span>' : `<span><button class="btn" style="${sm}" data-a="ykcopy" data-v="${esc(g.key)}">Copy key</button> <button class="btn" style="${sm}" data-a="yrev" data-v="${esc(g.key)}">Revoke</button></span>`}</div><small><code>${esc(g.key.slice(0, 7))}…</code> · ${cats} · ${sc.max ? "up to " + inr(sc.max) + " each" : "no per-action cap"}</small></div>`; };

  window.XTABS = [["connect", "Connect"], ["guard", "Guard"], ["verify", "Receipts"]];
  window.XSEC = {
    connect: () => `<p class="hint">Verity is a gateway. Any agent, including a marketplace's own, calls it before placing an order and gets allow, hold or block.</p>
      <div class="note"><b>Base URL</b> <code>${location.origin}</code><br>POST <code>/v1/check</code> · POST <code>/v1/check/batch</code> · GET <code>/v1/audit</code> · GET <code>/v1/receipts/verify</code><br><a href="/v1/openapi.json" target="_blank" rel="noopener">OpenAPI spec</a> · <a href="/checkout-demo.html" target="_blank" rel="noopener">Checkout demo</a> · <a href="/verity-sdk.js" target="_blank" rel="noopener">SDK</a></div>
      <div class="btns"><button class="btn pri" data-a="ytry">Run a sample check (dry run)</button><button class="btn" data-a="ycurl">Copy cURL</button></div>${Y.out ? `<pre id="yout">${esc(Y.out)}</pre>` : ""}
      <p class="hint">The listing field names in the sample are placeholders. A real integration maps the marketplace's own catalog fields in one adapter function (<code>fromListing</code> in <code>integration.js</code>).</p>
      <h3>API keys and permissions</h3>${S.agents.map(keyRow).join("")}
      <input id="kn" class="search" placeholder="New agent name"><label class="sl mode"><span>Allowed category</span><select id="kc"><option value="">All</option>${Core.CATS.map(c => `<option>${c}</option>`).join("")}</select></label><input id="km" class="search" type="number" min="0" placeholder="Max amount per action, in rupees (optional)">
      <div class="btns" style="margin-top:8px"><button class="btn pri" data-a="ykey">Create key</button></div>
      <h3>Verify webhooks</h3><div class="note">Held and blocked actions are POSTed to your webhook with <code>x-verity-signature: sha256=&lt;HMAC of the raw body&gt;</code>. Recompute the HMAC with your shared secret and compare in constant time before trusting the call. The demo secret is built in; production would use a managed secret.</div>`,
    guard: () => { const c = P.cool || {}, g = P.guardian || {};
      return `<p class="hint">Extra safeguards that run in the gateway before any order.</p>
      <label class="sl"><span>Cooling-off: wait for me above <b id="y-c">${c.above ? inr(c.above) : "Off"}</b></span><input type="range" data-y="cool" min="0" max="20000" step="1000" value="${c.above || 0}"></label>
      <div class="note"><b>Burst guard is always on.</b> Six or more agent actions within a minute are held, so a runaway agent cannot drain your wallet.</div>
      <h3>Ask a family member</h3><p class="hint">For held actions above an amount, you get a one-tap WhatsApp message to send them.</p>
      <input id="gn" class="search" placeholder="Name, for example Mom" value="${esc(g.name || "")}"><input id="gp" class="search" inputmode="tel" placeholder="Phone with country code, for example 919812345678" value="${esc(g.phone || "")}">
      <label class="sl"><span>For actions above <b id="y-g">${g.above ? inr(g.above) : "any amount"}</b></span><input type="range" data-y="gab" min="0" max="20000" step="500" value="${g.above || 0}"></label>
      <div class="btns"><button class="btn pri" data-a="ygsave">Save contact</button></div>`; },
    verify: () => { const L = S.d.filter(d => d.rc).slice(0, 8), c = Y.chain;
      return `<p class="hint">Every decision gets a signed receipt chained to the one before it. Changing any past record breaks the chain.</p>
      <div class="btns"><button class="btn pri" data-a="ychain">Verify audit chain</button></div>
      ${c ? `<div class="note">${c.ok ? `<b>Chain intact.</b> ${c.sealed} receipts verified.` : `<b>Chain broken</b> at ${c.broken.join(", ")}.`}</div>` : ""}
      <input id="vid" class="search" placeholder="Look up a receipt, for example VR-00012"><div class="btns" style="margin-top:8px"><button class="btn" data-a="ylook">Look up</button></div>${Y.look ? `<div class="note">${Y.look}</div>` : ""}
      <h3>Recent receipts</h3>` + (L.length ? L.map(d => `<div class="alt"><div class="row"><b>${d.rc.id}</b><span class="chip">${d.rc.v === "done" ? "Allowed" : d.rc.v === "pending" ? "Held" : "Stopped"}</span></div><small>${esc(d.title)} · ${d.rc.hash.slice(0, 16)}…</small></div>`).join("") : '<p class="hint">No sealed receipts yet. Send a scenario pack from Packs.</p>'); }
  };

  // Guided demo: a short coach that walks through the product, so a screen recording needs no script.
  const go = (tab, sel) => { S.tab = tab; S.open = null; render(); window.scrollTo(0, 0); if (sel) setTimeout(() => { const c = $(sel); if (c) c.click(); }, 60); };
  const tap = (sel, ms) => setTimeout(() => { const c = $(sel); if (c) c.click(); }, ms);
  const STEPS = [
    ["Agents act through Verity", "A burst of risky agent actions is arriving: a fake discount and surge pricing.", () => { go("x", "[data-a=xs][data-v=packs]"); tap("[data-a=xpack][data-v=scam]", 250); }],
    ["Open a held action", "Each decision has a signed receipt, a risk breakdown and the reason it was held.", () => { go("feed"); tap("[data-a=open]", 700); }],
    ["Decide first", "In Your Call you choose before seeing the agent's pick, then see how often you agree.", () => go("call")],
    ["Set your own rules", "Modes per category, spend caps, blocked sellers and your own hold or block rules.", () => go("prefs")],
    ["Add safeguards", "Cooling-off, the burst guard and a family approver on WhatsApp.", () => go("x", "[data-a=xs][data-v=guard]")],
    ["Prove nothing was altered", "Every decision is chained to the one before it.", () => { go("x", "[data-a=xs][data-v=verify]"); tap("[data-a=ychain]", 300); }],
    ["Plug into a marketplace", "The same checks are available as an API, with a dry-run preview.", () => { go("x", "[data-a=xs][data-v=connect]"); tap("[data-a=ytry]", 300); }]];
  let ds = -1;
  const coach = () => { let c = document.getElementById("coach");
    if (ds < 0) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement("div"); c.id = "coach"; c.setAttribute("role", "status"); $(".app").appendChild(c); }
    const s = STEPS[ds]; c.innerHTML = `<small>Step ${ds + 1} of ${STEPS.length}</small><b>${s[0]}</b>${s[1]}<div class="row"><button class="sk2" data-a="ystop">Stop</button><button class="nx" data-a="ynext">${ds === STEPS.length - 1 ? "Finish" : "Next"}</button></div>`; };
  const x0 = window.EXT.x;
  window.EXT.x = () => { x0(); if (!$("#ydemo")) v.insertAdjacentHTML("afterbegin", `<div class="btns" style="margin:0 0 12px"><button id="ydemo" class="btn pri" data-a="ydemo">Start guided demo</button></div>`); };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b || b.dataset.a[0] !== "y") return;
    if (b.dataset.a === "ydemo") { ds = 0; STEPS[0][2](); coach(); return; }
    if (b.dataset.a === "ynext") { ds++; if (ds >= STEPS.length) ds = -1; else STEPS[ds][2](); coach(); return; }
    if (b.dataset.a === "ystop") { ds = -1; coach(); return; } const a = b.dataset.a, x = b.dataset.v;
    const done = r => r && r.error ? toast(r.error) : 0;
    if (a === "ytry") call("POST", "/v1/check", SAMPLE).then(j => { Y.out = JSON.stringify(j, null, 2); render(); }).catch(() => toast("Server not reachable"));
    if (a === "ycurl") copy(CURL(), "cURL copied");
    if (a === "ykcopy") copy(x, "Key copied");
    if (a === "yrev") { if (confirm("Revoke this key? Agents using it will be rejected.")) api("POST", "/api/keys/revoke", { key: x }).then(r => r && !r.ok ? r.json().then(j => toast(j.error)) : toast("Key revoked")); }
    if (a === "ykey") api("POST", "/api/keys", { name: $("#kn").value, cat: $("#kc").value, max: $("#km").value }).then(r => r && !r.ok ? r.json().then(j => toast(j.error)) : toast("Key created"));
    if (a === "ygsave") { P.guardian = { ...(P.guardian || {}), name: $("#gn").value.trim(), phone: $("#gp").value.replace(/\D/g, "") }; sp("Family contact saved"); toast("Contact saved"); }
    if (a === "ychain") call("GET", "/api/chain").then(j => { Y.chain = j; render(); });
    if (a === "ylook") call("GET", "/v1/receipts/verify?id=" + encodeURIComponent($("#vid").value.trim().toUpperCase())).then(j => { Y.look = j.error ? esc(j.error) : `<b>${j.id}</b>: signature ${j.valid ? "valid" : "does not match"}, verdict ${j.verdict}, chain ${j.chain_ok ? "intact" : "broken"}.`; render(); });
    render();
  }, true);
  document.addEventListener("input", e => { const t = e.target, k = t.dataset.y; if (!k) return; const n = +t.value;
    if (k === "cool") { P.cool = { above: n }; $("#y-c").textContent = n ? inr(n) : "Off"; sp(); }
    if (k === "gab") { P.guardian = { ...(P.guardian || {}), above: n }; $("#y-g").textContent = n ? inr(n) : "any amount"; sp(); } });
})();
