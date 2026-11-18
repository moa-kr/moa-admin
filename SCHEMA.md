# site-config.json — 두 사이트 공통 설정

포켓몬카드모아와 회사복지모아가 **같은 형식**의 설정 파일을 읽습니다. 모아 어드민이 이 형식으로 커밋합니다.

| 사이트 | 저장소 | 경로 | 배포 |
| --- | --- | --- | --- |
| 포켓몬카드모아 | `moa-kr/pokemoa` | `assets/config/site-config.json` | GitHub Pages (30초~1분) |
| 회사복지모아 | `moa-kr/bokjinabi` | `public/config/site-config.json` | Render (1~2분) |

- 스키마: [`config/site-config.schema.json`](config/site-config.schema.json) (JSON Schema draft-07)
- 예시: [`config/site-config.example.pokemoa.json`](config/site-config.example.pokemoa.json), [`config/site-config.example.bokjimoa.json`](config/site-config.example.bokjimoa.json)

## 최상위 필드

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `schemaVersion` | `1` | 형식 버전. 사이트는 `1` 이 아니면 무시합니다. |
| `site` | `"pokemoa"` \| `"bokjimoa"` | 설정 소유 사이트 |
| `siteName` | 문자열 | 표시 이름(보통 `copy.siteTitle`) |
| `theme` | `{ accent, accentSoft, mode }` | 사이트 강조색·밝기(`light`/`dark`) |
| `copy` | 객체 | 화면 문구 — `siteTitle`, `subtitle`, `heroTitle`, `heroDescription`, `ctaLabel`, `footerText` |
| `banner` | 객체 | 상단 공지 바 |
| `popup` | 객체 | 첫 방문 팝업 |
| `navigation` | `{ tabs[], sections[] }` | 탭·섹션의 순서와 노출 |
| `cards` | 배열 | 현황 카드(제목·설명) |
| `meta` | `{ updatedBy, updatedAt, note }` | 마지막 수정 정보(어드민이 자동 기록) |

### banner

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `enabled` | boolean | `false` 면 사이트는 공지 바를 그리지 않습니다. |
| `text` | 문자열(≤120) | 공지 문구 |
| `linkUrl` | 문자열 | 클릭 시 이동할 주소(선택) |
| `linkLabel` | 문자열(≤20) | 링크 문구(선택) |
| `style` | `"info"` \| `"warn"` \| `"urgent"` | 강조 색 |
| `updatedAt` | ISO 시각 | 어드민이 켜 둔 시점 기록 |

### popup

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `enabled` | boolean | 팝업 노출 여부 |
| `id` | 문자열 | ‘다시 보지 않기’ 저장 키. **내용을 새로 알릴 때는 id를 바꿔야** 이미 닫은 방문자에게 다시 보입니다. |
| `title` / `body` | 문자열 | 제목(≤60) / 본문(≤600, 줄바꿈 유지) |
| `buttonText` / `buttonUrl` | 문자열 | 버튼 문구 / 이동 주소 |
| `startDate` / `endDate` | `YYYY-MM-DD` 또는 `""` | 노출 기간. 비면 제한 없음 |
| `dismissDays` | 0~90 | ‘N일 동안 보지 않기’. `0` 이면 이번 방문에서만 닫기 |

### navigation.tabs / navigation.sections

```json
{ "id": "map", "label": "동네에서 찾기", "visible": true, "order": 1 }
```

- `order` 는 1부터. 사이트는 **오름차순**으로 그리고, `visible: false` 인 항목은 숨깁니다.
- `id` 는 각 사이트 코드가 이미 쓰는 값이어야 합니다.
  - pokemoa 탭: `map`(동네에서 찾기) · `home`(정가 구매처) · `schedule`(일정·소식) · `guide`(도감·시세) · `trends`(팝수 조회)
  - pokemoa 섹션: `hero` · `status` · `restock` · `pricing` · `trend` · `faq`
  - bokjimoa 탭: `home` · `ranking` · `calculator` · `compare`
  - bokjimoa 섹션: `search` · `recent` · `popular` · `upload-cta`
- `label` 을 바꾸면 사이트의 탭 이름표가 그 문구로 바뀝니다.

## 사이트에 연결하는 방법 (아직 적용 전)

두 사이트 모두 **아직 이 파일을 읽지 않습니다.** 어드민이 커밋한 값이 화면에 나타나게 하려면 각 저장소에 아래 두 줄만 넣으면 됩니다.

1. 저장소에 `assets/js/site-config-loader.js` 를 복사합니다(이 저장소의 같은 파일이 참고 부품입니다).
2. 사이트 HTML 의 `</body>` 앞에 붙입니다.

```html
<script src="assets/js/site-config-loader.js" defer></script>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    MoaSiteConfig.load("assets/config/site-config.json").then(function (cfg) {
      if (!cfg) return;                        // 파일이 없으면 기존 화면 그대로
      MoaSiteConfig.apply(cfg, {
        host: document.querySelector("header") || document.body,
        place: "afterbegin",
        tabContainer: document.querySelector(".main-nav"),
        texts: {
          "#hero-title": cfg.copy.heroTitle,
          "#hero-desc": cfg.copy.heroDescription,
          "#site-footer": cfg.copy.footerText
        }
      });
    });
  });
</script>
```

- 회사복지모아는 경로가 `public/config/site-config.json` 이라 `load("/config/site-config.json")` 로 부릅니다.
- 서버 CSP(`script-src 'self'`) 안에서 동작하도록 외부 CDN 없이 순수 스크립트로 만들었습니다.
- `orderTabs` 는 `[data-tab]` 속성이 붙은 요소만 재배치합니다. pokemoa 의 `data-tab="map"` 같은 기존 속성을 그대로 씁니다.

## 문의 API (복지모아)

어드민 ④번 탭이 브라우저에서 직접 호출합니다.

| 메서드 | 경로 | 헤더 | 설명 |
| --- | --- | --- | --- |
| GET | `https://bokjimoa.onrender.com/api/admin/inquiries?limit=100&status=` | `x-sync-key` | 문의 목록 + `byStatus` |
| DELETE | `https://bokjimoa.onrender.com/api/admin/inquiries/:id` | `x-sync-key` | 문의 삭제 |

브라우저에서 부르려면 서버가 `https://moa-kr.github.io` 출처를 허용해야 합니다. 서버는 `/api/admin/*` 에서만 아래를 허용합니다.

- `Access-Control-Allow-Origin: https://moa-kr.github.io` (환경변수 `ADMIN_CONSOLE_ORIGINS` 로 추가 가능)
- `Access-Control-Allow-Headers: Content-Type, x-sync-key, x-admin-key`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`, `Cross-Origin-Resource-Policy: cross-origin`
