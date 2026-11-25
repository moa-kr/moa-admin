/* 모아 어드민 서비스 워커(2026-11-26 v=54 · 📊 통계 카드 순서 ↑↓ · 이전 v=53 SNS 성장 트렌드 · 고정지출 모바일 한 화면)
 *
 * 하는 일은 하나다 — 폰 홈 화면에 설치한 어드민이 인터넷이 잠깐 끊겨도 '연결 없음' 안내로 열리게 하고,
 * 그 밖의 모든 요청은 브라우저 기본 동작(fetch pass-through)에 맡긴다. 저장(PUT)·로그인 요청은 건드리지 않는다.
 *  - 화면 이동(navigate): 네트워크 우선 → 성공한 첫 화면을 복사 → 실패하면 그 화면(없으면 안내).
 *  - 그 밖의 요청: 가로채지 않는다(스크립트·아이콘·복지모아 API 모두 항상 최신·실시간).
 * 캐시에는 어드민 화면 한 장만 들어간다(개인 재무 표·토큰·아이디는 서비스 워커가 저장하지 않는다).
 */
const CACHE = "moa-admin-shell-v7";
const SHELL = new URL("./", self.location.href).href;
const OFFLINE_HTML =
  "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">" +
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
  "<title>모아 어드민 · 연결 없음</title>" +
  "<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;" +
  "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;" +
  "background:#fbf7f7;color:#1b1d23;text-align:center;padding:24px}" +
  "h1{font-size:18px;margin:0 0 8px}p{font-size:13.5px;line-height:1.7;color:#5b6784;margin:0 0 16px}" +
  "a{display:inline-block;padding:10px 16px;border-radius:10px;background:#d6342c;color:#fff;" +
  "text-decoration:none;font-weight:700;font-size:13.5px}</style></head><body><div>" +
  "<h1>지금은 연결이 끊겨 있어요</h1>" +
  "<p>인터넷에 연결되면 모아 어드민을 그대로 쓸 수 있습니다.<br>저장하지 않은 편집 내용은 연결이 돌아온 뒤 다시 확인해 주세요.</p>" +
  "<a href=\"./\">다시 시도</a></div></body></html>";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;
  let url;
  try { url = new URL(request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SHELL)) return;
  if (request.mode !== "navigate") return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const copy = fresh.clone();
        caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cache = await caches.open(CACHE).catch(() => null);
      const cached = cache ? await cache.match(SHELL) : null;
      if (cached) return cached;
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
  })());
});
