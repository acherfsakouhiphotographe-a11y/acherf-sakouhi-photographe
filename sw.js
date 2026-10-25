/* =====================================================================
   SERVICE WORKER — Achref Sakouhi Photographe
   • Page et config.js : réseau d'abord, copie de secours en cache (hors ligne).
   • Fichiers de l'app (icônes, polices, scripts) : cache d'abord.
   • SDK Firebase (gstatic, version figée) : cache d'abord.
   • Notifications push : affichage et clic.
   Augmentez CACHE_VERSION à chaque mise à jour du site.
   ===================================================================== */
const CACHE_VERSION = "achref-photo-v6";
const APP_SHELL = [
  "./", "./index.html", "./config.js", "./qrcode.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./icon-monochrome-512.png", "./logo-mark.png",
  "./fonts/jost-latin-400-normal.woff2", "./fonts/jost-latin-500-normal.woff2", "./fonts/jost-latin-600-normal.woff2",
  "./fonts/bodoni-moda-latin-400-normal.woff2", "./fonts/bodoni-moda-latin-400-italic.woff2", "./fonts/bodoni-moda-latin-500-italic.woff2",
  "./confidentialite.html", "./suppression-compte.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // SDK Firebase : fichiers versionnés, jamais modifiés → cache d'abord.
  if (url.hostname === "www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;     // Firestore, SwissTransfer, Cloudinary (reels), etc. : jamais en cache

  if (req.mode === "navigate" || url.pathname.endsWith("/config.js")) {
    const cle = req.mode === "navigate" ? "./index.html" : req;
    event.respondWith(fetch(req).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(cle, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(cle).then((r) => r || caches.match("./"))));
    return;
  }
  event.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});

/* ---------------- Notifications push (messages « data-only ») ---------------- */
self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { try { p = { data: { body: event.data.text() } }; } catch (_) {} }
  const d = p.data || {}, n = p.notification || {};
  const title = d.title || n.title || "Achref Sakouhi";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || n.body || "",
    icon: "./icon-192.png",
    badge: "./icon-monochrome-512.png",
    tag: d.tag || ("as-" + Date.now()),
    renotify: true,
    dir: "auto",
    lang: d.lang || "fr",
    vibrate: [80, 40, 80],
    data: { url: d.url || "./index.html" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data || {}).url || "./index.html", self.location.href);
  const route = (url.hash || "").replace(/^#/, "");
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.indexOf(self.registration.scope) === 0) {
        try { c.postMessage({ type: "notif-click", route }); } catch (e) {}
        return c.focus();
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
