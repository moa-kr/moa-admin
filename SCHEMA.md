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
| `copy` | 객체 | 화면 문구 — 키 전체 목록은 아래 ‘문구 키 전체 목록’ 참고 |
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
- `id` 는 각 사이트 코드가 이미 쓰는 값이어야 합니다(사이트 HTML 의 `data-tab`/`data-nav`/`data-section` 값).
  - pokemoa 탭: `map`(동네에서 찾기) · `home`(정가 구매처) · `schedule`(일정·소식) · `guide`(도감·시세) · `trends`(팝수 조회)
  - pokemoa 섹션(9곳, v4.11 화면 기준): `hero`(첫 화면 소개) · `pricing`(30th 정가 구매처) · `boxes`(다른 박스 정가 구매처) · `offline`(마트·아트박스·자판기·카드샵) · `trend`(인기 카드팩) · `tips`(오늘의 체크) · `cards`(수록 카드 도감) · `faq`(자주 묻는 질문) · `pop`(팝수 조회)
  - bokjimoa 탭: `home` · `ranking` · `calculator` · `compare`
  - bokjimoa 섹션(5곳, v0.12.2 화면 기준): `hero`(첫 화면 소개) · `search`(회사 찾기) · `recent`(최근 업로드된 회사) · `popular`(인기 · 등록 많은 회사) · `upload-cta`(내 회사 복지를 알려주세요)
  - 옛 이름 `status`·`restock`(현황 카드·최근 입고 기록)은 포케모아 v76 에서 화면에서 빠졌으므로 목록에 두지 않습니다. 설정에 남아 있어도 화면에는 아무 영향이 없습니다.
- `label` 은 그 항목의 **화면 문구**입니다. 탭은 내비게이션 이름표, 섹션은 섹션 머리글(`[data-section-title]`)이 이 값으로 바뀝니다. 지금 값은 두 사이트의 실제 화면 문구와 같아서, 저장만으로 달라지는 곳은 없습니다.
- 섹션 순서는 **같은 패널 안에서만** 바뀝니다(탭이 다른 섹션끼리 자리를 맞바꾸지는 않음). `visible:false` 는 `display:none` 으로 숨깁니다.
- 사이트 HTML 에는 `data-section` 이 있는데 설정에 그 id 가 없으면, 그 섹션은 손대지 않고 그 패널의 **맨 뒤**에 놓입니다. 사이트에 섹션을 새로 넣을 때는 이 파일의 id 목록과 사이트의 `site-config.json` 에도 같은 id 를 추가해야 합니다.
- 탭을 숨기면 모바일 하단 내비게이션 칸 수(`--moa-tab-count`)도 보이는 탭 수에 맞춰 줄어듭니다.

## 사이트에 연결하는 방법 (2026-11-18 연결 완료)

두 사이트 모두 설정 파일과 로더를 넣어 두었고, 어드민에서 저장하면 실제 화면에 반영됩니다.

| 사이트 | 설정 파일 | 로더 | 반영 |
| --- | --- | --- | --- |
| 포켓몬카드모아 | `assets/config/site-config.json` (v4.11 추가) | `assets/js/site-config-loader.js` | GitHub Pages, 30초~1분 |
| 회사복지모아 | `public/config/site-config.json` (v0.12.1 추가, 문구·섹션 v0.12.2 정리) | `public/js/site-config-loader.js` | Render 자동 배포, 1~2분 |

- 두 사이트의 설정 파일은 **지금 화면에 보이는 값 그대로** 넣어 두었습니다(공지 바·팝업 모두 `enabled:false`). 그래서 연결만으로 달라지는 화면은 없고, 어드민에서 바꾼 값만 반영됩니다.
- 붙인 방법은 두 사이트 모두 같습니다 — 사이트 스크립트 뒤(포케모아 `app.js` 뒤, 복지모아 `ads.js` 뒤)에 한 줄:

```html
<!-- 포켓몬카드모아 -->
<script src="assets/js/site-config-loader.js?v=77" defer
        data-config="assets/config/site-config.json"
        data-tab-container=".main-nav" data-banner-host=".site-header"></script>

<!-- 회사복지모아 (CSP script-src 'self' 안에서 동작) -->
<script src="/js/site-config-loader.js?v=1" defer
        data-config="/config/site-config.json"
        data-tab-container=".main-nav" data-banner-host=".site-header"></script>
```

- 로더는 `data-config` 만 있으면 스스로 붙습니다(외부 CDN·프레임워크 없음). 설정 파일이 없거나(404) `schemaVersion` 이 1이 아니면 아무것도 하지 않고 화면은 그대로 둡니다.
- 화면에서 다시 그리는 사이트(복지모아 SPA)는 `document.dispatchEvent(new CustomEvent("moa:route-rendered"))` 를 보내면 로더가 섹션·문구를 그 화면 기준으로 다시 맞춥니다(배너·팝업은 한 번만).
- 다른 사이트에 새로 붙일 때는 `site-config-loader.js` 를 복사하고 위 한 줄만 넣으면 됩니다.

## 문구가 붙는 자리

사이트 HTML·템플릿은 `data-copy="키"`(글자로 넣기) 또는 `data-copy-html="키"`(아래 태그만 허용) 로 표시해 둡니다. 로더는 `copy` 객체의 **같은 이름 키**를 찾아 그 자리에 넣고, 키가 없으면 그 자리는 사이트 문구를 그대로 둡니다.

| 사이트 | `siteTitle` | `subtitle` | `heroTitle` | `heroDescription` | `ctaLabel` | `footerText` |
| --- | --- | --- | --- | --- | --- | --- |
| 포켓몬카드모아 | 헤더·푸터 로고 이름 | 헤더 로고 영문 부제 | 홈 히어로 제목(마크업 허용) | 홈 히어로 설명 | 히어로 노란 버튼 | 푸터 소개 문단 |
| 회사복지모아 | 헤더 로고 이름 | (자리 없음) | 홈 히어로 제목(마크업 허용) | 홈 히어로 설명 | (자리 없음) | 푸터 브랜드 줄 |

## 문구 키 전체 목록 (2026-11-18 확장)

- `data-copy` — 글자만 넣습니다(자식 태그가 있으면 지워집니다).
- `data-copy-html` — `<b>`·`<strong>`·`<em>`·`<i>`·`<u>`·`<small>`·`<br>`·`<span>` 만 남기고 넣습니다(`class`·`aria-hidden` 유지).
- 같은 키를 여러 자리에 쓸 수 있습니다(예: `siteTitle` — 헤더 로고 + 푸터 로고).
- 섹션의 **굵은 제목**(`[data-section-title]`)은 `navigation.sections[].label` 이 담당합니다(어드민 ② 탭). `copy` 키가 아닙니다.
- 회사복지모아의 ‘회사 찾기’ 설명은 가운데에 회사 수가 자동으로 들어가므로 `searchDescA`(앞) + 숫자 + `searchDescB`(뒤) 로 나눠 두었습니다.

### 포켓몬카드모아

| 묶음 | 키 |
| --- | --- |
| 브랜드·헤더 | `siteTitle` `subtitle` `headerDate` |
| 홈 히어로 | `heroTag` `heroTitle` `heroDescription` `ctaLabel` `ctaLabel2` |
| 탭 머리글 | `mapEyebrow` `mapTitle` `mapLead` `scheduleEyebrow` `scheduleTitle` `scheduleLead` `guideEyebrow` `guideTitle` `guideLead` `trendsEyebrow` `trendsTitle` `trendsLead` |
| 섹션 머리글 | `pricingEyebrow` `pricingDesc` `pricingLink` `boxesEyebrow` `boxesDesc` `boxesLink` `offlineEyebrow` `offlineDesc` `offlineLink` `trendEyebrow` `trendDesc` `trendLink` `tipsEyebrow` `faqEyebrow` |
| 일정·소식 안쪽 | `issuesEyebrow` `issuesTitle` `issuesDesc` `issuesLink` `releasesEyebrow` `releasesTitle` `releasesDesc` `releasesLink` |
| 재고 상태 안내(5개) | `status1Title`~`status5Title`, `status1Desc`~`status5Desc` |
| 푸터 | `footerText` `footerNote1` `footerNote2` `footerNote3` `footerCopyright` `footerDataDate` |

### 회사복지모아

| 묶음 | 키 |
| --- | --- |
| 브랜드 | `siteTitle` (그 밖에 `subtitle`·`ctaLabel` 은 자리 없음) |
| 홈 히어로 | `heroEyebrow` `heroTitle` `heroDescription` `heroCta1` `heroCta2` |
| 이용 안내 | `guideTitle` `guide1Title`~`guide4Title` `guide1Desc`~`guide4Desc` |
| 바로가기 메뉴 | `shortcutLabel` `shortcutHint` `shortcut1Title`~`shortcut3Title` `shortcut1Desc`~`shortcut3Desc` |
| 섹션 설명 | `searchDescA` `searchDescB` `recentDesc` `popularDesc` `popularLink` `uploadDesc` `uploadCta1` `uploadCta2` |
| 탭 화면 머리글 | `rankingTitle` `rankingDesc` `calcTitle` `calcDesc` `compareTitle` |
| 푸터 | `footerText` `footerNote` |

- `data-copy-html` 은 `<b>`·`<strong>`·`<em>`·`<i>`·`<u>`·`<small>`·`<br>`·`<span>` 만 남기고 나머지 태그는 글자로 바꿉니다(스크립트 실행 없음). 속성은 `class`·`aria-hidden` 만 남기므로 사이트의 강조 표시(복지모아 `<span class="hl">골라서</span>`)가 그대로 유지됩니다. 그래서 `heroTitle` 에는 `<br>`·`<em>` 같은 표시를 그대로 쓸 수 있습니다.
- `subtitle`·`ctaLabel` 처럼 그 사이트에 자리가 없는 값은 저장해도 화면에 나타나지 않습니다(미리보기에만 보입니다).
- 어드민 ③ 문구 화면의 입력칸은 `assets/js/sites.js` 의 `copyGroups` 목록으로 그립니다. 사이트에 문구 자리를 새로 넣을 때는 **HTML 의 `data-copy` 키 + `sites.js` 의 `copyGroups` 항목 + 그 사이트 `site-config.json` 기본값** 세 곳을 같은 이름으로 맞춥니다.
- `cards`(현황 카드)와 `theme`(강조색)는 **미리보기 전용**입니다. 두 사이트 화면의 카드 숫자·색은 코드/데이터에서 정해집니다.

## 문의 API (복지모아)

어드민 ④번 탭이 브라우저에서 직접 호출합니다.

| 메서드 | 경로 | 헤더 | 설명 |
| --- | --- | --- | --- |
| GET | `https://bokjimoa.onrender.com/api/admin/inquiries?limit=100&status=` | `x-sync-key` | 문의 목록 + `byStatus` |
| DELETE | `https://bokjimoa.onrender.com/api/admin/inquiries/:id` | `x-sync-key` | 문의 삭제 |

브라우저에서 부르려면 서버가 `https://moa-kr.github.io` 출처를 허용해야 합니다. 2026-11-18 배포(v0.12.1)부터 서버가 `/api/admin/*` 에서만 아래를 허용합니다(그 밖의 경로는 그대로 막힘).

- `Access-Control-Allow-Origin: https://moa-kr.github.io` (환경변수 `ADMIN_CONSOLE_ORIGINS` 로 추가 가능)
- `Access-Control-Allow-Headers: Content-Type, x-sync-key, x-admin-key`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`, `Cross-Origin-Resource-Policy: cross-origin`
