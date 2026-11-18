# 모아 어드민 (MOA Admin)

포켓몬카드모아(`moa-kr/pokemoa`)와 회사복지모아(`moa-kr/bokjinabi`)의 공지·팝업, 탭·섹션 순서, 세부 문구를 한 화면에서 고치고 GitHub에 바로 커밋하는 운영자 콘솔입니다.

- **주소**: <https://moa-kr.github.io/moa-admin/> (검색엔진 비노출: `noindex, nofollow`)
- **저장 형식**: [`config/site-config.schema.json`](config/site-config.schema.json) · 설명서 [`SCHEMA.md`](SCHEMA.md)

## 쓰는 방법

1. 주소를 엽니다. **아이디·비밀번호** 칸이 나옵니다(기본 경로).
2. 아이디·비밀번호를 넣고 `90일 동안 로그인 유지`를 확인한 뒤 **로그인**을 누릅니다.
   - 로그인은 복지모아 서버(`https://bokjimoa.onrender.com/api/admin/login`)가 확인하고, 브라우저에는 **HMAC 서명 토큰**만 남습니다.
   - 비밀번호는 서버의 Render 환경변수(`ADMIN_LOGIN_ID`·`ADMIN_LOGIN_PW`)에만 있고 저장소에는 없습니다.
3. **불러오기**·**저장 및 사이트 반영**·**회사복지모아 문의 조회/삭제**는 모두 같은 서버(`/api/admin/repo-config`, `/api/admin/inquiries`)를 Bearer 토큰으로 부릅니다. GitHub PAT 은 서버(`ADMIN_GITHUB_PAT`)에만 있습니다.
4. ①~③ 에서 고치고 **저장 및 사이트 반영**을 누르면 서버가 설정 JSON을 저장소에 커밋하고, 곧 사이트에 반영됩니다.

**예비 경로** — 아이디 로그인이 막히면 아래 접힌 **‘고급: GitHub 토큰으로 직접 로그인’** 에서 PAT(+관리자 키 `x-sync-key`)로 들어갈 수 있습니다. 이 경로는 브라우저가 GitHub API 를 직접 부릅니다.

로그인 없이도 **데모(미리보기) 모드**로 화면과 미리보기를 그대로 써 볼 수 있습니다(저장만 잠김).

## 관리 항목

| 탭 | 내용 | 커밋되는 값 |
| --- | --- | --- |
| ① 공지·팝업 | 상단 공지 바(문구·링크·info/warn/urgent), 첫 방문 팝업(제목·본문·버튼·기간·다시 보지 않기 일수) | `banner`, `popup` |
| ② 탭·섹션 순서 | 끌어서 정렬(HTML5 DnD) + ▲▼ 버튼 + 노출 스위치 | `navigation.tabs`, `navigation.sections` |
| ③ 문구 | 사이트 이름·부제·hero·현황 카드 설명·푸터 | `copy`, `cards` |
| ④ 문의 | 복지모아 `/api/admin/inquiries` 조회·삭제 (아이디 로그인 토큰 또는 `x-sync-key`) | (서버 데이터, 커밋 없음) |
| ⑤ 저장·배포 | 복지모아 서버 프록시(`/api/admin/repo-config`) 커밋, JSON 내보내기/불러오기, 연결 상태 | — |

오른쪽(모바일에서는 ‘미리보기’ 버튼)에 390px 폰 프레임 미리보기가 있어, 고치는 즉시 공지 바와 팝업이 어떻게 보일지 확인할 수 있습니다.

**실제 사이트에 반영되는 값**(2026-11-18 연결): 공지 바, 팝업, 탭 순서·노출·이름표, 섹션 순서·노출·머리글, 그리고 `copy` 의 사이트 이름·hero 제목/설명·버튼·푸터. `cards`(현황 카드)와 `theme`(강조색)는 미리보기 전용입니다. 자세한 자리표는 [`SCHEMA.md`](SCHEMA.md) 의 ‘문구가 붙는 자리’에 있습니다.

## 배포 위치

| 사이트 | 저장소 | 파일 | 반영 |
| --- | --- | --- | --- |
| 포켓몬카드모아 | `moa-kr/pokemoa` | `assets/config/site-config.json` | GitHub Pages, 약 30초~1분 |
| 회사복지모아 | `moa-kr/bokjinabi` | `public/config/site-config.json` | Render 자동 배포, 약 1~2분 |

## 파일

```
index.html                         관리 화면
assets/css/admin.css               스타일
assets/js/sites.js                 두 사이트의 저장소·경로·기본값
assets/js/app.js                   로그인·편집·미리보기·커밋·문의
assets/js/site-config-loader.js    각 사이트에 붙이는 설정 로더(참고용)
config/site-config.schema.json     설정 스키마
config/site-config.example.*.json  기본값 예시
```

## 보안

- 토큰은 브라우저 저장소에만 있습니다. 서버로 보내지 않고 GitHub API 호출에만 씁니다.
- 페이지는 `noindex, nofollow` 이고 외부 스크립트를 쓰지 않습니다.
- 커밋은 토큰 권한이 확인된 경우에만 시도하며, 두 저장소 중 하나라도 쓰기 권한이 없으면 화면에 그대로 표시합니다.
