// Embeddable badge for a marketplace page: VerityBadge.render(element, checkResult)
(function (g) {
  g.VerityBadge = { render(el, r) {
    const c = { allow: ["#388e3c", "Checked by Verity"], hold: ["#e08600", "Held by Verity"], block: ["#d32f2f", "Stopped by Verity"] }[r.decision] || ["#6b7380", "Verity"];
    el.innerHTML = ""; const b = document.createElement("span");
    b.textContent = c[1] + " · " + r.risk + " risk"; b.title = (r.signals || []).join("\n") || "No influence signals found";
    b.style.cssText = "display:inline-block;padding:3px 10px;border:2px solid " + c[0] + ";color:" + c[0] + ";border-radius:4px;font:600 12px system-ui,sans-serif";
    el.appendChild(b); return b; } };
})(window);
