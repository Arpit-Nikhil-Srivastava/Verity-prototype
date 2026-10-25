// Verity v12 UI: pre-approval passes, approval notifications, receipt verify link and download, audit export.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = k => { try { return JSON.parse(localStorage.getItem("vx6-" + k)); } catch (e) { return null; } };
  const SV = (k, x) => { try { localStorage.setItem("vx6-" + k, JSON.stringify(x)); } catch (e) {} };
  const sm = "flex:none;min-width:0;padding:4px 10px", XS = () => window.XSEC;
  const copy = (t, m) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(m || "Copied"), () => toast("Copy is not available here"));
  const left = ms => ms > 36e5 ? Math.round(ms / 36e5) + " h" : Math.max(1, Math.round(ms / 6e4)) + " min";

  // ---- Pre-approval passes (shown under Controls) ----
  const passUI = () => { const L = (P.passes || []).filter(p => !p.until || p.until > Date.now());
    return `<h3>Pre-approval passes</h3><p class="hint">Tell your agent "go ahead" for a limited time: pick a category, a maximum amount, a time window and a number of uses. A pass lifts your own "ask first", cap and away rules. It never lifts a block or an influence warning.</p>` +
      (L.length ? L.map(p => `<div class="alt row"><span><b>${esc(p.name)}</b><br><small>${p.cat || "Any category"} · up to ${inr(p.max)} · ${p.until ? left(p.until - Date.now()) + " left" : "no expiry"} · ${p.uses === undefined ? "unlimited uses" : p.uses + (p.uses === 1 ? " use" : " uses") + " left"}</small></span><button class="btn" style="${sm}" data-a="e6-pdel" data-v="${p.id}">Revoke</button></div>`).join("") : '<p class="hint">No active passes.</p>') +
      `<input id="e6n" class="search" placeholder="Name, for example Phone purchase"><label class="sl mode"><span>Category</span><select id="e6c"><option value="">Any</option>${Core.CATS.map(c => `<option>${c}</option>`).join("")}</select></label>
      <input id="e6m" class="search" type="number" min="1" placeholder="Maximum amount, in rupees"><label class="sl mode"><span>Valid for</span><select id="e6h"><option value="1">1 hour</option><option value="4">4 hours</option><option value="24">24 hours</option><option value="168">7 days</option></select></label>
      <label class="sl mode"><span>Uses</span><select id="e6u"><option value="1">One</option><option value="3">Three</option><option value="">Unlimited</option></select></label><div class="btns"><button class="btn pri" data-a="e6-padd">Create pass</button></div>`; };
  const ctl0 = XS().controls; XS().controls = () => ctl0() + passUI();

  // ---- Notifications and audit export ----
  const acc0 = XS().account;
  XS().account = () => acc0() + `<h3>Notifications</h3><label class="mode" style="margin:12px 0"><span>Notify me when an agent needs approval</span><input type="checkbox" data-e6="notify" ${LS("notify") ? "checked" : ""}></label><p class="hint">Uses your browser's notifications while Verity is open in a tab or installed as an app. Alerts when the app is fully closed would need a push server, which this prototype does not have.</p>`;
  const ver0 = XS().verify;
  XS().verify = () => ver0() + `<h3>For auditors</h3><p class="hint">Download every signed receipt, or share the public check page.</p><div class="btns"><button class="btn" data-a="e6-audit">Download audit log (JSON)</button><button class="btn" data-a="e6-vpage">Copy public check link</button></div>`;

  // ---- Receipt buttons on the decision screen ----
  const det0 = window.detail;
  window.detail = function () { det0(); const d = S.d.find(x => x.id === S.open), bx = v.querySelector(".rcpt .btns");
    if (d && d.rc && bx) bx.insertAdjacentHTML("beforeend", `<button class="btn" data-a="e6-vlink" data-v="${d.id}">Copy verify link</button><button class="btn" data-a="e6-rdl" data-v="${d.id}">Download receipt</button>`); };
  const rhtml = d => { const o = d.opts[d.pick], a = an(d), url = location.origin + "/verify.html?id=" + d.rc.id;
    return `<!DOCTYPE html><meta charset="utf-8"><title>Receipt ${d.rc.id}</title><body style="font:15px system-ui;max-width:520px;margin:24px auto;padding:0 16px"><h2>Verity receipt ${d.rc.id}</h2><p><b>${esc(d.title)}</b><br>${esc(o.n)} · ${price(d)} · ${esc(d.cat)}<br>Agent: ${esc(d.agent || "Personal agent")}</p><p>Verdict at check time: <b>${{ done: "Allowed", pending: "Held", blocked: "Stopped" }[d.rc.v]}</b><br>Fit with the user's priorities: ${a.fit}%</p><ul>${a.sig.map(x => "<li>" + esc(x[1]) + "</li>").join("")}</ul><p style="word-break:break-all"><small>Signature: ${d.rc.hash}<br>Previous receipt: ${d.rc.prev}</small></p><p>Verify: <a href="${url}">${url}</a></p></body>`; };

  // ---- Notify when a new action is held (only while the page is in the background) ----
  let seen = null; const r1 = window.render;
  window.render = function () { r1(); if (!S.ok) return; const ids = S.d.filter(d => d.status === "pending").map(d => d.id);
    if (seen === null) { seen = new Set(ids); return; }
    ids.forEach(id => { if (seen.has(id)) return; seen.add(id); const d = S.d.find(x => x.id === id);
      if (LS("notify") && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification("Verity: approval needed", { body: d.title + " · " + price(d), tag: "verity-" + id }); }); };

  document.addEventListener("click", e => {
    const b = e.target.closest('[data-a^="e6-"]'); if (!b) return; const a = b.dataset.a, x = b.dataset.v, val = id => ($(id) ? $(id).value : "");
    if (a === "e6-padd") { const max = +val("#e6m"); if (!(max > 0)) { toast("Enter a maximum amount"); return; }
      const u = val("#e6u"), p = { id: "p" + Date.now().toString(36), name: val("#e6n").trim() || "Pass", cat: val("#e6c"), max, until: Date.now() + (+val("#e6h")) * 36e5 }; if (u) p.uses = +u;
      P.passes = [...(P.passes || []), p]; sp("Pass created: " + p.name); toast("Pass created"); }
    if (a === "e6-pdel") { P.passes = (P.passes || []).filter(p => p.id !== x); sp("Pass revoked"); }
    if (a === "e6-vlink") { const d = S.d.find(q => q.id === +x); if (d) copy(location.origin + "/verify.html?id=" + d.rc.id, "Verify link copied"); }
    if (a === "e6-vpage") copy(location.origin + "/verify.html", "Public check link copied");
    if (a === "e6-rdl") { const d = S.d.find(q => q.id === +x); if (d) { download("verity-receipt-" + d.rc.id + ".html", rhtml(d), "text/html"); toast("Receipt downloaded"); } }
    if (a === "e6-audit") { const k = (S.agents.find(g => !g.revoked) || {}).key;
      fetch("/v1/audit", { headers: { "x-agent-key": k || "" } }).then(r => r.json().then(j => r.ok ? (download("verity-audit-log.json", JSON.stringify(j, null, 2), "application/json"), toast("Audit log downloaded")) : toast(j.error || "Could not export"))).catch(() => toast("Server not reachable")); return; }
    render();
  }, true);
  document.addEventListener("change", e => { const t = e.target; if (t.dataset.e6 !== "notify") return;
    if (!t.checked) { SV("notify", 0); return; }
    if (typeof Notification === "undefined") { t.checked = false; toast("This browser does not support notifications"); return; }
    Notification.requestPermission().then(p => { if (p === "granted") { SV("notify", 1); toast("Notifications on"); } else { t.checked = false; SV("notify", 0); toast("Notifications are blocked in this browser"); } }); });
})();
