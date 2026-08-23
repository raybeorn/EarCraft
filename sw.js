/* sw.js — offline cache for EarCraft.
 *
 * Two caches, both versioned. Bump CACHE_VERSION to force a refresh of the
 * precached shell and CDN scripts on the next visit.
 *   - shell cache: the app files and the two CDN scripts. Precached on install.
 *   - samples cache: the piano MP3 files. Filled on first use and precached
 *     best effort on install.
 *
 * Same-origin app files use network first, so an online visit always loads the
 * latest code and offline falls back to the cache. The pinned CDN scripts and
 * the samples use cache first. A background pass revalidates the samples by
 * comparing the Last-Modified header, so a changed sample is picked up later.
 * (Cross-origin script cannot read the ETag header here, because the server
 * does not send Access-Control-Expose-Headers: ETag. Last-Modified is a
 * CORS-safelisted response header and tracks the same file change.)
 */

const CACHE_VERSION = "v2";
const SHELL_CACHE = "earcraft-shell-" + CACHE_VERSION;
const SAMPLES_CACHE = "earcraft-samples-" + CACHE_VERSION;

const SAMPLE_BASE = "https://tonejs.github.io/audio/salamander/";
const SAMPLE_FILES = [
  "A0.mp3", "C1.mp3", "Ds1.mp3", "Fs1.mp3",
  "A1.mp3", "C2.mp3", "Ds2.mp3", "Fs2.mp3",
  "A2.mp3", "C3.mp3", "Ds3.mp3", "Fs3.mp3",
  "A3.mp3", "C4.mp3", "Ds4.mp3", "Fs4.mp3",
  "A4.mp3", "C5.mp3", "Ds5.mp3", "Fs5.mp3",
  "A5.mp3", "C6.mp3", "Ds6.mp3", "Fs6.mp3",
  "A6.mp3", "C7.mp3", "Ds7.mp3", "Fs7.mp3",
  "A7.mp3", "C8.mp3",
];
const SAMPLE_URLS = SAMPLE_FILES.map((f) => SAMPLE_BASE + f);

const SHELL_ASSETS = [
  "./", "./index.html", "./styles.css",
  "./theory.js", "./audio.js", "./app.js", "./staff.js",
  "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.js",
  "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow.js",
];

// Throttle background revalidation to at most once per day.
const META_URL = "./__samples_meta";
const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_ASSETS);
    // Precache samples best effort: a failure here must not fail the install.
    const samples = await caches.open(SAMPLES_CACHE);
    await Promise.allSettled(
      SAMPLE_URLS.map(async (url) => {
        const res = await fetch(url, { mode: "cors" });
        if (res && res.ok) await samples.put(url, res.clone());
      })
    );
    await markRevalidated();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, SAMPLES_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));           // app files
  } else if (url.hostname === "tonejs.github.io") {
    event.respondWith(cacheFirst(req, SAMPLES_CACHE)); // piano samples
  } else if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(cacheFirst(req, SHELL_CACHE));   // Tone.js / VexFlow
  }
  // anything else: let the browser handle it normally
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "revalidate-samples") {
    event.waitUntil(maybeRevalidateSamples());
  }
});

// Fresh when online, cached when offline. Navigations fall back to index.html.
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const index = await cache.match("./index.html");
      if (index) return index;
    }
    throw e;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function maybeRevalidateSamples() {
  if (!(await revalidationDue())) return;
  const cache = await caches.open(SAMPLES_CACHE);
  const reqs = await cache.keys();
  await Promise.all(reqs.map(async (req) => {
    if (req.url.endsWith("__samples_meta")) return;
    const cached = await cache.match(req);
    const prev = cached && cached.headers.get("Last-Modified");
    try {
      // cache: "no-cache" makes the browser revalidate with the server; an
      // unchanged file returns 304 internally and is not re-downloaded.
      const fresh = await fetch(req.url, { cache: "no-cache", mode: "cors" });
      if (!fresh || !fresh.ok) return;
      const next = fresh.headers.get("Last-Modified");
      if (!prev || !next || next !== prev) await cache.put(req, fresh.clone());
    } catch (e) {
      // offline or blocked: keep the cached copy
    }
  }));
  await markRevalidated();
}

async function revalidationDue() {
  const cache = await caches.open(SAMPLES_CACHE);
  const res = await cache.match(META_URL);
  if (!res) return true;
  try {
    const { at } = await res.json();
    return Date.now() - at > REVALIDATE_INTERVAL_MS;
  } catch (e) {
    return true;
  }
}

async function markRevalidated() {
  const cache = await caches.open(SAMPLES_CACHE);
  await cache.put(
    META_URL,
    new Response(JSON.stringify({ at: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    })
  );
}
