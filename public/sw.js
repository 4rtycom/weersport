/*
 * Inventory before this worker: no manifest, no service worker, and no install
 * banner. Public files were SVG marks, weather icons, and public/home/hero.png.
 * Cache only the static offline shell. Never store personal results, payments,
 * account/auth pages, API payloads, or current warnings.
 */
const CACHE = "weersport-offline-v1";
const SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/symbol.svg",
];
const PRIVATE_PATH = /^\/(account|moment|checkout|api|auth)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PATH.test(url.pathname)) return;

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/offline")) || Response.error()),
    );
  }
});
