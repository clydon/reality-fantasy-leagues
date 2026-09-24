// Service worker, registered by src/components/service-worker-registrar.tsx.
//
// Deliberately minimal. It does NOT cache pages, JS or API responses: league state, scores and chat
// have to be live, and a cache-first service worker serving yesterday's standings is the classic PWA
// failure. Its only jobs are
//   1. to exist with a fetch handler, which some Android browsers still require before they'll
//      offer "Install app", and
//   2. to show a friendly offline screen when a page navigation fails for lack of network, instead
//      of the browser's own error page -- which inside an installed app looks like the app is broken.
//
// It also receives Web Push messages (sent by src/lib/server/push-core.js) and opens the right page
// when one is tapped -- see the push/notificationclick handlers at the bottom.
//
// Bump VERSION when this file's behaviour, offline.html or the precached icons change.
const VERSION = "v2";
const CACHE = `rfl-offline-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rfl-offline-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only top-level page loads get the offline fallback. Everything else -- API calls, JS chunks,
  // images -- goes straight to the network untouched, so the app behaves exactly as it does without
  // a service worker whenever there IS a connection.
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});

// Payload shape: { title, body, url, tag } -- see push-core.js's sendPush.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Reality Fantasy Leagues";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces the previous notification instead of stacking: five chat messages become
      // one up-to-date alert, not five.
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    })
  );
});

// Tapping a notification: reuse an already-open app window (navigating it to the target page)
// rather than opening a second copy of the app; open a fresh one only if none is running.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (new URL(win.url).origin === self.location.origin) {
          return win.focus().then(() => ("navigate" in win ? win.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
