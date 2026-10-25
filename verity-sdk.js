// Verity SDK. Works in the browser (<script src="verity-sdk.js">) and in Node 18+ (require).
// Usage: Verity.base = "https://verity.example.com"; Verity.key = "vk_..."; const r = await Verity.check({ ... });
(function (g) {
  const V = {
    base: "", key: "",
    async call(method, path, body, headers) {
      const r = await fetch(V.base + path, { method, headers: { "Content-Type": "application/json", "x-agent-key": V.key, ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json();
      if (!r.ok) throw Object.assign(new Error(j.error || "Verity error"), { status: r.status });
      return j;
    },
    // Ask before acting. Returns { decision: "allow" | "hold" | "block", why, fit, risk, signals, receipt }.
    check(payload, opts) { return V.call("POST", "/v1/check", payload, opts && opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : null); },
    // Pre-check a whole cart. Dry run by default, so nothing is recorded.
    batch(items, dry) { return V.call("POST", "/v1/check/batch", { items, dry_run: dry !== false }); },
    verify(id) { return V.call("GET", "/v1/receipts/verify?id=" + encodeURIComponent(id)); }
  };
  g.Verity = V; if (typeof module !== "undefined") module.exports = V;
})(typeof window !== "undefined" ? window : globalThis);
