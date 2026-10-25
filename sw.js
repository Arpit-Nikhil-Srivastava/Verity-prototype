// Verity service worker: keeps the app shell available offline. Network first, so updates always win. Never touches /api or /v1.
const CACHE = "verity-v2", SHELL = ["/", "/index.html", "/style.css", "/flipkart.css", "/core.js", "/app.js", "/extras.js", "/extras2.js", "/extras3.js", "/datalab.js", "/extras4.js", "/extras5.js", "/extras6.js", "/manifest.json", "/icon.svg"];
// Cache files one by one so a missing file can never break installation.
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.pathname.startsWith("/v1/")) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match("/index.html"))));
});
