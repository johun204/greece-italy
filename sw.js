/* 그리스·이탈리아 신혼여행 PWA 서비스워커
   - 앱 셸(HTML·Leaflet·아이콘·PDF)은 설치 시 프리캐시 → 완전 오프라인
   - OpenStreetMap 타일은 "본 적 있는 곳"만 런타임 캐시(상한 300, OSM 정책상 대량 선다운로드 안 함)
   - SVG 개략 지도는 페이지에 내장되어 네트워크가 전혀 필요 없음 */
const APP_CACHE = "gi-app-v3";
const TILE_CACHE = "gi-tiles-v1";
const TILE_MAX = 300;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./greece-italy-honeymoon.pdf",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== APP_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // OSM 타일: 캐시 우선 → 없으면 네트워크 후 캐시(상한)
  if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) { await c.put(req, res.clone()); trim(TILE_CACHE, TILE_MAX); }
        return res;
      } catch (err) {
        return hit || new Response("", { status: 504 });
      }
    })());
    return;
  }

  // 그 외: 캐시 우선 → 네트워크(성공 시 앱 캐시에 갱신) → 실패 시 index.html
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: url.origin === location.origin });
    if (cached) {
      // 백그라운드 갱신(있으면)
      fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin || url.hostname === "unpkg.com")) {
          caches.open(APP_CACHE).then((c) => c.put(req, res.clone()));
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && (url.origin === location.origin || url.hostname === "unpkg.com")) {
        const c = await caches.open(APP_CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      if (req.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 504 });
    }
  })());
});
