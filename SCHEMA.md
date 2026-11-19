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
{ "id": "pricing", "label": "70,000원에 살 수 있는 곳, 채널별 조건까지", "visible": true, "order": 2, "tab": "home", "body": "추가 안내 문단(선택)" }
```

- `order` 는 1부터. 사이트는 **같은 탭(패널) 안에서** 오름차순으로 그리고, `visible: false` 인 항목은 숨깁니다.
- `tab`(섹션 전용, 선택)은 그 섹션이 들어 있는 탭 id 입니다. 어드민 ② 화면이 탭별로 묶어 보여 주고, 저장할 때 탭 순서대로 order 를 다시 매깁니다. 비어 있으면 사이트의 기본 탭을 씁니다.
- `body`(섹션 전용, 선택)는 섹션 맨 아래에 덧붙는 **본문 문단**입니다(`<b>`·`<br>` 등 일부 태그만 허용, 최대 600자). 어드민 ② 에서 섹션을 펼쳐 씁니다. 비우면 아무것도 그리지 않습니다.
- `id` 는 각 사이트 코드가 이미 쓰는 값이어야 합니다(사이트 HTML 의 `data-tab`/`data-nav`/`data-section` 값).
  - pokemoa 탭: `map`(동네에서 찾기) · `home`(정가 구매처) · `schedule`(일정·소식) · `guide`(시세·도감) · `trends`(팝수 조회)
  - pokemoa 섹션(15곳, v4.18 화면 기준) — 탭별
    - `map`: `map-status`(지도 상태 안내 5개) · `map-channels`(공식 채널 바로가기)
    - `home`: `hero`(첫 화면) · `pricing`(정가 구매처) · `boxes`(다른 박스) · `offline`(오프라인·자판기) · `trend`(인기 카드팩) · `tips`(오늘의 체크)
    - `schedule`: `issues`(카드 뉴스·소식) · `releases`(발매·재입고 일정)
    - `guide`: `rates`(환율 위젯) · `market`(PSA·eBay 거래가 조회) · `cards`(수록 카드 도감) · `faq`(자주 묻는 질문)
    - `trends`: `pop`(팝수 조회)
  - bokjimoa 탭: `home` · `ranking` · `calculator` · `compare`
  - bokjimoa 섹션(11곳, v0.13.2 화면 기준) — 탭별
    - `home`: `hero` · `search` · `recent` · `popular` · `upload-cta`
    - `ranking`: `ranking-head`(주제별 TOP 머리글) · `ranking-list`(테마별 순위 목록)
    - `calculator`: `calc-head`(계산기 머리글) · `calc-body`(계산기 입력·결과)
    - `compare`: `compare-head`(비교 회사 선택) · `compare-table`(비교표)
  - 옛 이름 `status`·`restock`(현황 카드·최근 입고 기록)은 포케모아 v76 에서 화면에서 빠졌으므로 목록에 두지 않습니다. 설정에 남아 있어도 화면에는 아무 영향이 없습니다.
- `label` 은 그 항목의 **화면 문구**입니다. 탭은 내비게이션 이름표, 섹션은 섹션 머리글(`[data-section-title]`)이 이 값으로 바뀝니다. 화면 제목을 `copy` 키로 그리는 섹션(`hero`→`heroTitle`, `pop`→`trendsTitle`, `issues`→`issuesTitle`, `releases`→`releasesTitle`, `rates`→`fxTitle`, `market`→`marketTitle`, `map-channels`→`mapChannelsTitle`, 복지모아 `ranking-head`→`rankingTitle`, `calc-head`→`calcTitle`, `compare-head`→`compareTitle`)은 어드민의 제목칸이 그 문구를 고칩니다.
- 섹션 순서는 **같은 탭 패널 안에서만** 바뀝니다(탭이 다른 섹션끼리 자리를 맞바꾸지는 않음). 서로 다른 `.wrap` 에 들어 있는 섹션도 앞 섹션 바로 뒤로 옮겨 순서를 맞추므로, 탭 안 블록 순서는 자유롭게 바꿀 수 있습니다. `visible:false` 는 `display:none` 으로 숨깁니다.
  - 주의: 섹션이 아닌 블록(광고 자리 `data-ad-slot`, 출처 안내 `src-note` 등)은 자기 자리에 그대로 남습니다. 그래서 섹션을 크게 옮기면 그 사이에 끼어 있던 광고가 섹션들 사이가 아니라 위·아래로 밀려 보일 수 있습니다. 기본 순서에서는 아무것도 옮기지 않으므로(문서 순서가 이미 맞으면 무변경) 저장만으로는 화면이 달라지지 않습니다.
- 사이트 HTML 에는 `data-section` 이 있는데 설정에 그 id 가 없으면, 그 섹션은 손대지 않고 그 패널의 **맨 뒤**에 놓입니다. 사이트에 섹션을 새로 넣을 때는 `assets/js/sites.js` 의 `sections` 목록(어드민 ② 화면 정의)과 사이트의 `site-config.json` 에도 같은 id 를 추가해야 합니다.
- 탭을 숨기면 모바일 하단 내비게이션 칸 수(`--moa-tab-count`)도 보이는 탭 수에 맞춰 줄어듭니다.

## 사이트에 연결하는 방법 (2026-11-18 연결 완료)

두 사이트 모두 설정 파일과 로더를 넣어 두었고, 어드민에서 저장하면 실제 화면에 반영됩니다.

| 사이트 | 설정 파일 | 로더 | 반영 |
| --- | --- | --- | --- |
| 포켓몬카드모아 | `assets/config/site-config.json` (v4.11 추가) | `assets/js/site-config-loader.js` (v3) | GitHub Pages, 30초~1분 |
| 회사복지모아 | `public/config/site-config.json` (v0.12.1 추가, 문구·섹션 v0.12.2 정리) | `public/js/site-config-loader.js` (v3) | Render 자동 배포, 1~2분 |

- 두 사이트의 설정 파일은 **지금 화면에 보이는 값 그대로** 넣어 두었습니다(공지 바·팝업 모두 `enabled:false`). 그래서 연결만으로 달라지는 화면은 없고, 어드민에서 바꾼 값만 반영됩니다.
- 붙인 방법은 두 사이트 모두 같습니다 — 사이트 스크립트 뒤(포케모아 `app.js` 뒤, 복지모아 `ads.js` 뒤)에 한 줄:

```html
<!-- 포켓몬카드모아 -->
<script src="assets/js/site-config-loader.js?v=85" defer
        data-config="assets/config/site-config.json"
        data-tab-container=".main-nav" data-banner-host=".site-header"></script>

<!-- 회사복지모아 (CSP script-src 'self' 안에서 동작) -->
<script src="/js/site-config-loader.js?v=3" defer
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

## 문구 키 전체 목록 (2026-11-19 전면 확장)

- `data-copy` — 글자만 넣습니다(자식 태그가 있으면 지워집니다). 아이콘 같은 자식이 있는 버튼은 글자만 `<span data-copy="…">` 로 감쌉니다.
- `data-copy-html` — `<b>`·`<strong>`·`<em>`·`<i>`·`<u>`·`<small>`·`<br>`·`<span>` 만 남기고 넣습니다(`class`·`aria-hidden` 유지).
- 같은 키를 여러 자리에 쓸 수 있습니다(예: `siteTitle` — 헤더 로고 + 푸터 로고, `inquiryBtn` — 탭마다 있는 ‘관리자 문의’ 버튼).
- 섹션의 **굵은 제목**(`[data-section-title]`)은 `navigation.sections[].label` 이 담당합니다(어드민 ② 탭). `copy` 키가 아닙니다.
- JS 가 값을 덮어쓰는 자리(실시간 시세·환율 값, 지도 조회 결과·상태, 카드 도감·비교표·이슈/발매 목록, 세트 요약, 팝수 안내)는 `data-copy` 를 붙이지 않았습니다.
- 회사복지모아의 ‘회사 찾기’ 설명은 가운데에 회사 수가 자동으로 들어가므로 `searchDescA`(앞) + 숫자 + `searchDescB`(뒤) 로 나눠 두었습니다.

**키 수**: 포켓몬카드모아 177개 · 회사복지모아 65개. 사이트 HTML(`data-copy`)·`site-config.json` 기본값·`sites.js` 필드 정의가 **같은 키 집합**입니다(정합성 테스트로 확인).

### 포켓몬카드모아 (탭 → 섹션 순서, ③ 문구 화면과 같은 묶음)

| 묶음 | 수 | 키 |
| --- | --- | --- |
| 머리말 · 공통 | 5 | `siteTitle` `subtitle` `headerDate` `inquiryBtn` `headerReport` |
| 동네에서 찾기 · 탭 머리글 | 3 | `mapEyebrow` `mapTitle` `mapLead` |
| 동네에서 찾기 · 화면 공통 | 11 | `mapOfflineLabel` `mapOfflineToggle` `mapRegionLabel` `mapFindRegion` `mapFindMine` `mapRadiusLabel` `mapFilterReset` `mapSortLabel` `mapStockOnly` `mapSideTitle` `mapMore` |
| 동네에서 찾기 · 상태 안내 (5개) | 10 | `status1Title`~`status5Title` `status1Desc`~`status5Desc` |
| 동네에서 찾기 · 공식 채널 바로가기 | 1 | `mapChannelsTitle` |
| 정가 구매처 · 첫 화면 히어로 | 8 | `heroTag` `heroTitle` `heroDescription` `heroPrice1Label` `heroPrice2Label` `heroPrice3Label` `ctaLabel` `ctaLabel2` |
| 정가 구매처 · 정가 구매처 현황 | 4 | `pricingEyebrow` `pricingDesc` `pricingLink` `pricingSource` |
| 정가 구매처 · 다른 박스 | 4 | `boxesEyebrow` `boxesDesc` `boxesLink` `boxesSource` |
| 정가 구매처 · 오프라인 · 자판기 | 11 | `offlineEyebrow` `offlineDesc` `offlineLink` `offlineArtName` `offlineArtSub` `offlineShopName` `offlineShopSub` `offlineVendingName` `offlineVendingSub` `offlineMartName` `offlineMartSub` |
| 정가 구매처 · 인기 카드팩 트렌드 | 8 | `trendEyebrow` `trendDesc` `trendLink` `trendTag1`~`trendTag4` `trendGo` |
| 정가 구매처 · 오늘의 체크 | 8 | `tipsEyebrow` `tip1Title` `tip1Body` `tip2Title` `tip2Body` `tip3Title` `tip3Body` `tipsCta` |
| 일정·소식 · 탭 머리글 | 3 | `scheduleEyebrow` `scheduleTitle` `scheduleLead` |
| 일정·소식 · 화면 공통 | 18 | `scheduleSubNews` `scheduleSubCal` `scheduleTimelineTitle` `scheduleTimelineSub` `scheduleCalTitle` `scheduleCalSub` `schedulePastToggle` `scheduleNoticeTitle` `scheduleLink1Name` `scheduleLink1Sub` `scheduleLink2Name` `scheduleLink2Sub` `scheduleWeekTitle` `scheduleWeekSub` `scheduleWeekTh1`~`scheduleWeekTh4` |
| 일정·소식 · 카드 뉴스·소식 | 4 | `issuesEyebrow` `issuesTitle` `issuesDesc` `issuesLink` |
| 일정·소식 · 발매·재입고 일정 | 4 | `releasesEyebrow` `releasesTitle` `releasesDesc` `releasesLink` |
| 시세·도감 · 탭 머리글 | 3 | `guideEyebrow` `guideTitle` `guideLead` |
| 시세·도감 · 화면 공통 | 13 | `setSearchLabel` `setSearchBtn` `setSearchHint` `compareTitle` `calcTitle` `calcBtn` `calcDiffLabel` `calcRateLabel` `checklistTitle` `checklistSub` `fakeTitle` `fakeSub` `fakeNote` |
| 시세·도감 · 환율 위젯 | 6 | `fxTitle` `fxUsdLabel` `fxUsdCap` `fxJpyLabel` `fxJpyCap` `fxRefresh` |
| 시세·도감 · PSA 거래 내역 조회 | 12 | `marketEyebrow` `marketTitle` `marketLead` `marketGroupPsa` `marketPsaSearchName` `marketPsaSearchSub` `marketPsaShopName` `marketPsaShopSub` `marketPsaGuideName` `marketPsaGuideSub` `marketPsaBadge` `marketNote` |
| 시세·도감 · 리셀 · 해외 실거래 시세 | 18 | `resellEyebrow` `resellTitle` `resellLead` `marketGroupKr` `marketKreamName` `marketKreamSub` `marketSnkrdunkName` `marketSnkrdunkSub` `marketGroupFree` `market130Name` `market130Sub` `marketPcName` `marketPcSub` `marketEbaySoldName` `marketEbaySoldSub` `marketEbayBinName` `marketEbayBinSub` `resellNote` |
| 시세·도감 · 수록 카드와 레어도 | 3 | `cardsEyebrow` `cardsRarityNote` `cardsMore` |
| 시세·도감 · 자주 묻는 질문 | 2 | `faqEyebrow` `faqMore` |
| 팝수 조회 · 탭 머리글 | 3 | `trendsEyebrow` `trendsTitle` `trendsLead` |
| 팝수 조회 · 팝수 조회 | 6 | `popCrossTitle` `popCrossDesc` `popCrossCta` `popCompanyLabel` `popQueryLabel` `popSearchBtn` |
| 꼬리말 · 공통 | 6 | `footerText` `footerNote1` `footerNote2` `footerNote3` `footerCopyright` `footerDataDate` |

### 회사복지모아

| 묶음 | 수 | 키 |
| --- | --- | --- |
| 머리말 · 공통 | 2 | `siteTitle` `subtitle` |
| 홈 · 화면 공통(바로가기 메뉴) | 8 | `shortcutLabel` `shortcutHint` `shortcut1Title`~`shortcut3Title` `shortcut1Desc`~`shortcut3Desc` |
| 홈 · 첫 화면 소개 | 18 | `heroEyebrow` `heroTitle` `heroDescription` `heroCta1` `heroCta2` `stat1Label`~`stat4Label` `guideTitle` `guide1Title`~`guide4Title` `guide1Desc`~`guide4Desc` |
| 홈 · 회사 찾기 | 4 | `searchDescA` `searchDescB` `findOnlyData` `findMoreBtn` |
| 홈 · 최근 업로드된 회사 | 1 | `recentDesc` |
| 홈 · 인기 · 등록 많은 회사 | 2 | `popularDesc` `popularLink` |
| 홈 · 내 회사 복지를 알려주세요 | 4 | `uploadDesc` `uploadCta1` `uploadCta2` `companyViewBtn` |
| 주제별 TOP · 머리글 | 2 | `rankingTitle` `rankingDesc` |
| 주제별 TOP · 순위 목록 | 3 | `rankingMetricCount` `rankingMetricValue` `rankingFootnote` |
| 복지 계산기 · 머리글 | 2 | `calcTitle` `calcDesc` |
| 복지 계산기 · 입력·결과 | 13 | `calcCompanyLabel` `calcMarriedLabel` `calcSingle` `calcMarried` `calcChildrenLabel` `calcHousingLabel` `calcHousingNone` `calcHousingJeonse` `calcHousingPurchase` `calcInterestLabel` `calcMedical` `calcLeisure` `calcLiveHint` |
| 비교하기 · 회사 선택 | 2 | `compareTitle` `compareRange` |
| 비교하기 · 비교표 | 2 | `compareEmptyTitle` `compareEmptyDesc` |
| 꼬리말 · 공통 | 2 | `footerText` `footerNote` |

- `data-copy-html` 은 `<b>`·`<strong>`·`<em>`·`<i>`·`<u>`·`<small>`·`<br>`·`<span>` 만 남기고 나머지 태그는 글자로 바꿉니다(스크립트 실행 없음). 속성은 `class`·`aria-hidden` 만 남기므로 사이트의 강조 표시(복지모아 `<span class="hl">골라서</span>`)가 그대로 유지됩니다.
- 문구 자리를 새로 넣을 때는 **HTML 의 `data-copy` 키 + `sites.js` 의 `fields`(라벨·형식·길이) 와 그 키를 담은 섹션의 `copyKeys` + 그 사이트 `site-config.json` 기본값** 네 곳을 같은 이름으로 맞춥니다. 키가 `copyKeys` 에 들어가면 ②의 ✎ 편집기와 ③ 문구 화면에 함께 나옵니다.
- `cards`(현황 카드)와 `theme`(강조색)는 **미리보기 전용**입니다. 두 사이트 화면의 카드 숫자·색은 코드/데이터에서 정해집니다.

## ② ✎ 편집기와 ③ 문구의 관계 (2026-11-19)

- ② 의 섹션 카드에서 **✎** 를 누르면 그 섹션의 `copyKeys` 가 **대표 문구**(표제·제목·설명·링크)와 **세부 문구**(버튼·라벨·안내, 접이식 묶음)로 나뉘어 한 아코디언 안에 펼쳐집니다. 제목 칸에는 `화면 제목` 배지가 붙습니다.
- ③ 문구 화면은 **머리말 → 탭(탭 머리글 · 화면 공통 · 섹션들) → 꼬리말** 순서의 **접이식 묶음**입니다. 묶음은 **기본으로 접혀 있고**(`+`), 헤더나 `+` 를 누르면 그 아래에 문구 입력칸이 펼쳐집니다(`−`). 화면 위 `모두 펼치기/모두 접기` 로 한 번에 열고 닫을 수 있으며, 펼쳐 둔 묶음은 다시 그려도(사이트 전환·저장) 그대로 유지됩니다. 섹션 묶음에는 `② 에서 이 섹션 편집 →` 이동 버튼이 있습니다.
- 두 화면의 입력칸은 **같은 `copy.<key>` 값**을 쓰므로 한쪽을 고치면 다른 쪽 칸이 즉시 같이 바뀝니다(양방향 동기화).
- 오른쪽 모바일 미리보기는 지금 고른 탭의 섹션을 그리면서 표제·제목·설명·링크와 세부 문구 일부를 실제 값으로 보여 줍니다.

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
