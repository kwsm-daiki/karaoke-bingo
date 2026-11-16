// 歌詞ビンゴ の Service Worker（オフラインで動かすため）
// 中身を変えたら、VERSION の数字を上げる
// 同じオリジン（github.io）に Nudge もあるので、消すのは "lyric-bingo-" で始まるキャッシュだけ
const VERSION = "v4";
const CACHE = "lyric-bingo-" + VERSION;
const FONT_CACHE = "lyric-bingo-fonts";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lyric-bingo-") && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ページを開く: まずネット（新しい版）。3秒で返事がない・失敗したら、保存してある版
  if (req.mode === "navigate") {
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const fromCache = () => caches.match("./index.html", { ignoreSearch: true });
      const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
      const net = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
        }
        return res;
      });
      const timer = setTimeout(() => { fromCache().then(finish); }, 3000);
      net.then((res) => { clearTimeout(timer); finish(res); })
        .catch(() => { clearTimeout(timer); fromCache().then((c) => finish(c || Response.error())); });
    }));
    return;
  }

  // Google Fonts: キャッシュを先に返し、裏で新しくする
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; })
            .catch(() => hit || Response.error());
          return hit || net;
        })
      )
    );
    return;
  }

  // 同じサイトのファイル: キャッシュを先に
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
    );
  }
});
