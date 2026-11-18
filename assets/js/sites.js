/* 모아 어드민 — 두 사이트의 배포 위치와 기본 설정값
   실제 값은 GitHub 의 site-config.json 을 불러와 덮어씁니다. 아래 defaults 는
   "설정 파일이 아직 없을 때" 쓰는 초기값(= 사이트 HTML 에 적힌 문구)입니다.

   copyGroups 는 ③ 문구 화면에 그릴 입력칸 목록입니다.
   key 는 사이트 HTML 의 data-copy / data-copy-html 값과 같아야 합니다.
   kind: text(한 줄) · html(한 줄, <b>·<br> 등 일부 태그 허용) ·
         area(여러 줄) · areaHtml(여러 줄, 일부 태그 허용) */
(function () {
  "use strict";

  /* ───────────── 포켓몬카드모아 ───────────── */
  const POKEMOA_COPY = {
      "siteTitle": "포켓몬카드모아",
      "subtitle": "POKEMON CARD MOA",
      "heroTitle": "30th CELEBRATION,<br><em>정가</em>로 만나는 방법",
      "heroDescription": "포켓몬 카드 정가 구매처와 추첨 일정, 입고 기록, 편의점 4사 재고와 취급 카드까지 한 화면에 모았습니다. 리셀가에 흔들리지 않도록 기준 가격부터 확인하세요.",
      "ctaLabel": "정가 구매처 보기",
      "footerText": "포켓몬 카드의 정가 구매처, 추첨·입고 일정, 주변 매장 재고, 수록 카드 정보를 한 곳에 모은 비공식 정보 사이트입니다. 데이터 기준일 2026-11-17.",
      "headerDate": "데이터 기준 11-17",
      "heroTag": "<b>30th</b> 2026 MEGA 확장팩 · 30주년 기념",
      "ctaLabel2": "지도에서 재고 찾기",
      "mapEyebrow": "동네에서 찾기 · 첫 화면",
      "mapTitle": "내 주변 편의점과 오프라인 판매처, 어떤 카드가 있는지 한눈에",
      "mapLead": "카카오맵 실제 지도 위에 주변 <b>편의점 4사(GS25·CU·세븐일레븐·이마트24)</b>와 <b>오프라인 판매처(대형마트·아트박스·공식 자판기·공인 카드샵)</b>를 함께 표시합니다. 마트·아트박스는 카카오 장소 검색으로 실시간 조회하고, 공식 자판기(전국 176곳)와 공인 카드샵(전국 16곳)은 포켓몬코리아 공식 목록에서 가져와 반경 안에 들어오면 지도에 올립니다. 지도 말풍선과 매장 카드는 집 태블릿 중계 서버가 편의점 앱에서 <b>실제로 확인한 재고 상품·수량</b>만 표시하고, 확인되지 않은 매장은 <b>「매장 확인 필요」</b>로 둡니다. <b>전국 17개 시·도</b>에서 시·군·구를 고르거나 동네 이름으로 검색하고, <b>'내 위치로 찾기'</b>를 누르면 그 반경의 매장을 새로 조회합니다.",
      "scheduleEyebrow": "일정 · 소식",
      "scheduleTitle": "카드 소식과 발매·재입고 일정",
      "scheduleLead": "먼저 <b>카드 뉴스·소식</b>에서 공식 공지와 신규팩 발매 소식을 확인하고, <b>발매·재입고 일정</b>에서 추첨 회차별 예정·종료 일정을 보세요. 포켓몬스토어 추첨은 회차마다 응모·발표·결제·배송 날짜가 따로 있습니다.",
      "guideEyebrow": "도감 · 시세",
      "guideTitle": "세트별 정가와 리셀 시세 검색",
      "guideLead": "세트·박스 이름으로 검색하면 그 세트의 <b>공식 정가(팩·박스)</b>와 <b>리셀 시세 검색 바로가기(KREAM · 번개장터 · PriceCharting)</b>가 함께 나옵니다. 아래 세트 칩으로 골라 수록 카드 도감과 정가·리셀 비교표를 볼 수도 있습니다.",
      "trendsEyebrow": "팝수 조회",
      "trendsTitle": "등급 회사를 고르고 인증서·카드 번호로 조회",
      "trendsLead": "<b>PSA · CGC · BRG · BGS</b> 가운데 회사를 먼저 고른 뒤 등급카드 넘버(인증서 번호 또는 카드 번호)를 넣으면, 번호를 복사해 그 회사의 팝 리포트·인증서 조회 페이지로 바로 넘겨 줍니다. 팝수는 회사별로 따로 집계되므로 보고 싶은 회사를 먼저 골라야 합니다.",
      "pricingEyebrow": "정가 구매처 현황",
      "pricingDesc": "정가는 모든 채널이 같지만 배송비·판매 단위·추첨 여부가 다릅니다. 결제 전에 총액과 팩당 단가를 확인하세요. 가격은 2026-11-17 확인 기준입니다.",
      "pricingLink": "다른 박스 정가 구매처 →",
      "boxesEyebrow": "다른 확장팩 · 박스 정가 구매처",
      "boxesDesc": "30th CELEBRATION을 뺀 8개 박스의 <b>공식 정가·구성</b>과 <b>KREAM 참고 시세</b>를 박스별로 모았습니다. 위 칩에서 박스를 고르면 아래 구매처 목록이 그 박스 기준으로 바뀝니다. 금액은 공식 정가와 2026-11-17 KREAM 시세이고, 실제 재고·결제 금액은 판매처 페이지에서 확인하세요.",
      "boxesLink": "30th CELEBRATION 구매처 →",
      "offlineEyebrow": "오프라인 · 자판기",
      "offlineDesc": "온라인 재고가 없어도 오프라인에서 정가로 살 수 있는 채널입니다. 매장·자판기의 <b>재고는 어떤 채널도 공개하지 않아</b> 표시하지 않으니, 방문 전 매장 문의로 확인하세요.",
      "offlineLink": "지도에서 오프라인 위치 보기 →",
      "trendEyebrow": "인기 카드팩 트렌드",
      "trendDesc": "정가와 구성, 주목 카드만 짧게 정리했습니다. 세트마다 팩 수와 카드 매수가 달라 팩당 단가로 비교해야 합니다.",
      "trendLink": "수록 카드 도감 →",
      "tipsEyebrow": "오늘의 체크 포인트",
      "faqEyebrow": "자주 묻는 질문",
      "issuesEyebrow": "최근 이슈되는 카드 이슈",
      "issuesTitle": "2026년 11월 카드 게임 소식",
      "issuesDesc": "공식 공지와 보도로 확인한 6건입니다. 날짜는 공지·보도 기준이고, 링크는 원문으로 바로 갑니다.",
      "issuesLink": "포켓몬코리아 소식 ↗",
      "releasesEyebrow": "신규 팩 발매 소식",
      "releasesTitle": "공식 사이트에서 확인한 발매·발매 예정",
      "releasesDesc": "포켓몬 카드 게임 공식 제품 정보(pokemoncard.co.kr)의 발매일·정가·구성입니다. 한국판 일정이 없는 상품은 '해외'로 표시했습니다.",
      "releasesLink": "공식 제품 목록 ↗",
      "status1Title": "재고 있음",
      "status1Desc": "집 태블릿 중계가 편의점 앱에서 수량 1개 이상을 확인한 매장입니다. 조회 시점 기준이니 방문 전 매장에 확인하세요.",
      "status2Title": "매장 확인 필요",
      "status2Desc": "중계에서 수량을 받지 못한 매장입니다. 수량을 지어내지 않고 위치만 표시합니다.",
      "status3Title": "재고 없음",
      "status3Desc": "중계 조회 결과 0으로 확인된 매장입니다. 아직 입고 전일 수도 있습니다.",
      "status4Title": "보유 카드 표시",
      "status4Desc": "태그는 중계가 실제로 확인한 상품명과 수량(예: 닌자스피너 · 3개)만 붙습니다. 확인되지 않은 매장에는 상품 태그가 없습니다.",
      "status5Title": "오프라인 판매처",
      "status5Desc": "대형마트·아트박스는 카카오 장소 검색으로 위치만 표시하고, 공식 자판기(포켓몬코리아 자판기 안내, 176곳)·공인 카드샵(16곳)은 공식 목록의 설치 장소를 옮겨 온 것입니다.",
      "footerNote1": "포켓몬카드모아는 포켓몬·포켓몬코리아와 무관한 비공식 정보 사이트입니다. ‘포켓몬’, ‘포켓몬 카드 게임’ 및 관련 명칭·이미지의 권리는 각 권리자에게 있습니다. 본 사이트는 공식 로고와 카드 이미지를 사용하지 않으며, 카드 정보는 공개된 상품 정보를 정리한 것입니다.",
      "footerNote2": "지도에 표시된 매장 위치·이름은 카카오맵 실제 장소 데이터이며, 매장별 재고는 집 태블릿 중계가 편의점 앱에서 조회한 실제 수량만 표시하고 확인되지 않은 매장은 「매장 확인 필요」로 둡니다. 구매 판단과 그 결과는 이용자 본인에게 있습니다.",
      "footerNote3": "광고·제휴 고지: 본 사이트는 Google AdSense 광고와 쿠팡 파트너스 활동을 통해 수수료를 받을 수 있습니다. 제휴 링크를 통한 구매 시 사이트에 일정액의 수수료가 지급될 수 있으며, 이용자 가격에는 영향이 없습니다.",
      "footerCopyright": "© 2026 포켓몬카드모아. 비공식 팬 정보 사이트.",
      "footerDataDate": "데이터 기준 2026-11-17"
    };

  const POKEMOA_COPY_GROUPS = [
    {
      name: "브랜드 · 헤더",
      note: "헤더 로고와 오른쪽 기준일에 쓰입니다(푸터 로고 이름도 함께 바뀝니다).",
      fields: [
        { key: "siteTitle", label: "사이트 이름", kind: "text", max: 30 },
        { key: "subtitle", label: "로고 아래 영문 부제", kind: "text", max: 60 },
        { key: "headerDate", label: "헤더 오른쪽 기준일", kind: "text", max: 20 }
      ]
    },
    {
      name: "홈 탭 · 첫 화면",
      note: "홈 탭 맨 위 히어로입니다. 제목은 <br>·<em> 같은 표시를 쓸 수 있어요.",
      fields: [
        { key: "heroTag", label: "히어로 위 표제", kind: "html", max: 60 },
        { key: "heroTitle", label: "히어로 제목", kind: "html", max: 80 },
        { key: "heroDescription", label: "히어로 설명", kind: "area", max: 300 },
        { key: "ctaLabel", label: "히어로 노란 버튼", kind: "text", max: 24 },
        { key: "ctaLabel2", label: "히어로 보조 버튼", kind: "text", max: 24 }
      ]
    },
    {
      name: "탭 머리글",
      note: "탭을 열었을 때 맨 위에 나오는 표제·제목·설명입니다. 탭 이름표는 ② 탭·섹션 순서에서 고칩니다.",
      fields: [
        { key: "mapEyebrow", label: "동네에서 찾기 · 표제", kind: "text", max: 40 },
        { key: "mapTitle", label: "동네에서 찾기 · 제목", kind: "text", max: 60 },
        { key: "mapLead", label: "동네에서 찾기 · 설명", kind: "areaHtml", max: 900 },
        { key: "scheduleEyebrow", label: "일정·소식 · 표제", kind: "text", max: 40 },
        { key: "scheduleTitle", label: "일정·소식 · 제목", kind: "text", max: 60 },
        { key: "scheduleLead", label: "일정·소식 · 설명", kind: "areaHtml", max: 600 },
        { key: "guideEyebrow", label: "도감·시세 · 표제", kind: "text", max: 40 },
        { key: "guideTitle", label: "도감·시세 · 제목", kind: "text", max: 60 },
        { key: "guideLead", label: "도감·시세 · 설명", kind: "areaHtml", max: 600 },
        { key: "trendsEyebrow", label: "팝수 조회 · 표제", kind: "text", max: 40 },
        { key: "trendsTitle", label: "팝수 조회 · 제목", kind: "text", max: 60 },
        { key: "trendsLead", label: "팝수 조회 · 설명", kind: "areaHtml", max: 600 }
      ]
    },
    {
      name: "섹션 머리글 · 설명",
      note: "굵은 섹션 제목은 ② 탭·섹션 순서의 이름표에서 고칩니다. 여기서는 그 위 표제, 설명, 오른쪽 링크 문구를 고칩니다.",
      fields: [
        { key: "pricingEyebrow", label: "정가 구매처 · 표제", kind: "text", max: 40 },
        { key: "pricingDesc", label: "정가 구매처 · 설명", kind: "areaHtml", max: 300 },
        { key: "pricingLink", label: "정가 구매처 · 링크", kind: "text", max: 40 },
        { key: "boxesEyebrow", label: "다른 박스 · 표제", kind: "text", max: 40 },
        { key: "boxesDesc", label: "다른 박스 · 설명", kind: "areaHtml", max: 400 },
        { key: "boxesLink", label: "다른 박스 · 링크", kind: "text", max: 40 },
        { key: "offlineEyebrow", label: "오프라인 · 표제", kind: "text", max: 40 },
        { key: "offlineDesc", label: "오프라인 · 설명", kind: "areaHtml", max: 300 },
        { key: "offlineLink", label: "오프라인 · 링크", kind: "text", max: 40 },
        { key: "trendEyebrow", label: "인기 카드팩 · 표제", kind: "text", max: 40 },
        { key: "trendDesc", label: "인기 카드팩 · 설명", kind: "areaHtml", max: 300 },
        { key: "trendLink", label: "인기 카드팩 · 링크", kind: "text", max: 40 },
        { key: "tipsEyebrow", label: "오늘의 체크 · 표제", kind: "text", max: 40 },
        { key: "faqEyebrow", label: "자주 묻는 질문 · 표제", kind: "text", max: 40 },
        { key: "issuesEyebrow", label: "카드 소식 · 표제", kind: "text", max: 40 },
        { key: "issuesTitle", label: "카드 소식 · 제목(2026년 11월 …)", kind: "text", max: 60 },
        { key: "issuesDesc", label: "카드 소식 · 설명", kind: "areaHtml", max: 300 },
        { key: "issuesLink", label: "카드 소식 · 링크", kind: "text", max: 40 },
        { key: "releasesEyebrow", label: "발매 일정 · 표제", kind: "text", max: 40 },
        { key: "releasesTitle", label: "발매 일정 · 제목", kind: "text", max: 60 },
        { key: "releasesDesc", label: "발매 일정 · 설명", kind: "areaHtml", max: 300 },
        { key: "releasesLink", label: "발매 일정 · 링크", kind: "text", max: 40 }
      ]
    },
    {
      name: "재고 상태 안내 (5개)",
      note: "동네에서 찾기 지도 아래 상태 안내 5개입니다.",
      fields: [
        { key: "status1Title", label: "1 · 제목", kind: "text", max: 20 },
        { key: "status1Desc", label: "1 · 설명", kind: "area", max: 200 },
        { key: "status2Title", label: "2 · 제목", kind: "text", max: 20 },
        { key: "status2Desc", label: "2 · 설명", kind: "area", max: 200 },
        { key: "status3Title", label: "3 · 제목", kind: "text", max: 20 },
        { key: "status3Desc", label: "3 · 설명", kind: "area", max: 200 },
        { key: "status4Title", label: "4 · 제목", kind: "text", max: 20 },
        { key: "status4Desc", label: "4 · 설명", kind: "area", max: 200 },
        { key: "status5Title", label: "5 · 제목", kind: "text", max: 20 },
        { key: "status5Desc", label: "5 · 설명", kind: "area", max: 300 }
      ]
    },
    {
      name: "푸터",
      note: "",
      fields: [
        { key: "footerText", label: "푸터 소개 문단", kind: "area", max: 200 },
        { key: "footerNote1", label: "고지 1 (비공식 안내)", kind: "area", max: 400 },
        { key: "footerNote2", label: "고지 2 (데이터 안내)", kind: "area", max: 400 },
        { key: "footerNote3", label: "고지 3 (광고·제휴 고지)", kind: "area", max: 400 },
        { key: "footerCopyright", label: "저작권 줄", kind: "text", max: 60 },
        { key: "footerDataDate", label: "데이터 기준일", kind: "text", max: 40 }
      ]
    }
  ];

  /* ───────────── 회사복지모아 ───────────── */
  const BOKJIMOA_COPY = {
      "siteTitle": "회사복지모아",
      "subtitle": "500대 기업 복지·임단협 현황을 한눈에",
      "heroTitle": "회사별 사내 복지,<br>찾아보고 <span class=\"hl\">골라서</span> 비교",
      "heroDescription": "기업별 복지를 한눈에 보고, 원하는 회사만 골라 비교하세요.",
      "ctaLabel": "복지 올리기",
      "footerText": "회사복지모아 · BETA",
      "heroEyebrow": "복지 비교 플랫폼 · 회사 이메일 인증",
      "heroCta1": "회사 둘러보기",
      "heroCta2": "복지 올리기",
      "guideTitle": "이렇게 씁니다",
      "guide1Title": "회사 고르기",
      "guide1Desc": "회사를 누르면 복지가 펼쳐집니다",
      "guide2Title": "+ 로 펼치기",
      "guide2Desc": "조건·금액·출처까지 확인",
      "guide3Title": "골라서 비교",
      "guide3Desc": "2~4개사만 나란히",
      "guide4Title": "회사 이메일 인증",
      "guide4Desc": "우리 회사 복지 올리기",
      "shortcutLabel": "바로가기 메뉴",
      "shortcutHint": "누르면 바로 이동해요",
      "shortcut1Title": "주제별 TOP",
      "shortcut1Desc": "주거·출산·복지포인트를 한눈에",
      "shortcut2Title": "복지 계산기",
      "shortcut2Desc": "내 조건으로 1년 복지 금액 계산",
      "shortcut3Title": "회사 비교",
      "shortcut3Desc": "같은 기준으로 나란히",
      "searchDescA": "상장사·공기업까지",
      "searchDescB": "개사를 모았습니다. 회사명·업종·지역·초성으로 바로 찾아보세요.",
      "recentDesc": "새로 정리한 기업부터. 카드를 누르면 회사 복지 페이지로 이동합니다.",
      "popularDesc": "수록 항목이 많은 회사 순서입니다.",
      "popularLink": "회사 비교하기 →",
      "uploadDesc": "회사 이메일 인증 후 올릴 수 있어요. 올린 항목은 ‘내 제보’에서 수정·삭제됩니다.",
      "uploadCta1": "복지 올리기",
      "uploadCta2": "회사 비교하기",
      "footerNote": "공식 자료와 이용자 제보를 구분해 표시합니다. 확인된 값만 적고, 확인되지 않은 값은 '확인 필요'로 둡니다.",
      "rankingTitle": "직장인이 가장 궁금한 복지 TOP",
      "rankingDesc": "같은 테마끼리 회사 복지를 모아 순위를 매깁니다. 금액은 항목에 적힌 값만 쓰고, 금액이 없는 제도는 따로 표시합니다.",
      "calcTitle": "내 조건으로 보는 연간 복지 금액",
      "calcDesc": "회사와 상황을 고르면 공개된 복지 항목을 1년 기준으로 환산해 드립니다. 추정 기준과 근거도 함께 보여드려요.",
      "compareTitle": "비교할 회사 선택"
    };

  const BOKJIMOA_COPY_GROUPS = [
    {
      name: "브랜드 · 헤더",
      note: "헤더 로고 이름입니다.",
      fields: [
        { key: "siteTitle", label: "사이트 이름", kind: "text", max: 30 }
      ]
    },
    {
      name: "홈 히어로",
      note: "홈 탭 첫 화면입니다. 제목은 <br>·<span class=\"hl\"> 강조를 쓸 수 있어요.",
      fields: [
        { key: "heroEyebrow", label: "히어로 위 표제", kind: "text", max: 40 },
        { key: "heroTitle", label: "히어로 제목", kind: "html", max: 80 },
        { key: "heroDescription", label: "히어로 설명", kind: "area", max: 300 },
        { key: "heroCta1", label: "히어로 버튼 1", kind: "text", max: 24 },
        { key: "heroCta2", label: "히어로 버튼 2", kind: "text", max: 24 }
      ]
    },
    {
      name: "이용 안내 (히어로 옆)",
      note: "",
      fields: [
        { key: "guideTitle", label: "안내 제목", kind: "text", max: 30 },
        { key: "guide1Title", label: "1 · 제목", kind: "text", max: 24 },
        { key: "guide1Desc", label: "1 · 설명", kind: "text", max: 60 },
        { key: "guide2Title", label: "2 · 제목", kind: "text", max: 24 },
        { key: "guide2Desc", label: "2 · 설명", kind: "text", max: 60 },
        { key: "guide3Title", label: "3 · 제목", kind: "text", max: 24 },
        { key: "guide3Desc", label: "3 · 설명", kind: "text", max: 60 },
        { key: "guide4Title", label: "4 · 제목", kind: "text", max: 24 },
        { key: "guide4Desc", label: "4 · 설명", kind: "text", max: 60 }
      ]
    },
    {
      name: "바로가기 메뉴",
      note: "",
      fields: [
        { key: "shortcutLabel", label: "메뉴 제목", kind: "text", max: 24 },
        { key: "shortcutHint", label: "메뉴 설명", kind: "text", max: 40 },
        { key: "shortcut1Title", label: "1 · 제목", kind: "text", max: 24 },
        { key: "shortcut1Desc", label: "1 · 설명", kind: "text", max: 60 },
        { key: "shortcut2Title", label: "2 · 제목", kind: "text", max: 24 },
        { key: "shortcut2Desc", label: "2 · 설명", kind: "text", max: 60 },
        { key: "shortcut3Title", label: "3 · 제목", kind: "text", max: 24 },
        { key: "shortcut3Desc", label: "3 · 설명", kind: "text", max: 60 }
      ]
    },
    {
      name: "탭 화면 머리글",
      note: "주제별 TOP·복지 계산기 화면 맨 위의 제목과 설명, 비교 화면의 머리글입니다. (회사 비교의 ‘담긴 회사 N/4’ 줄은 숫자가 자동이라 코드에 둡니다.)",
      fields: [
        { key: "rankingTitle", label: "주제별 TOP · 제목", kind: "text", max: 60 },
        { key: "rankingDesc", label: "주제별 TOP · 설명", kind: "area", max: 200 },
        { key: "calcTitle", label: "복지 계산기 · 제목", kind: "text", max: 60 },
        { key: "calcDesc", label: "복지 계산기 · 설명", kind: "area", max: 200 },
        { key: "compareTitle", label: "회사 비교 · 머리글", kind: "text", max: 40 }
      ]
    },
    {
      name: "섹션 설명",
      note: "섹션 제목은 ② 탭·섹션 순서에서 고칩니다. ‘회사 찾기’ 설명은 가운데 회사 수가 자동으로 들어가므로 앞·뒤로 나눠 적습니다.",
      fields: [
        { key: "searchDescA", label: "회사 찾기 · 앞부분", kind: "text", max: 40 },
        { key: "searchDescB", label: "회사 찾기 · 뒷부분(‘개사를 …’)", kind: "text", max: 120 },
        { key: "recentDesc", label: "최근 업로드된 회사 · 설명", kind: "text", max: 80 },
        { key: "popularDesc", label: "인기 회사 · 설명", kind: "text", max: 80 },
        { key: "popularLink", label: "인기 회사 · 링크", kind: "text", max: 30 },
        { key: "uploadDesc", label: "복지 올리기 안내 · 설명", kind: "text", max: 120 },
        { key: "uploadCta1", label: "복지 올리기 · 버튼 1", kind: "text", max: 24 },
        { key: "uploadCta2", label: "복지 올리기 · 버튼 2", kind: "text", max: 24 }
      ]
    },
    {
      name: "푸터",
      note: "",
      fields: [
        { key: "footerText", label: "푸터 브랜드 줄", kind: "text", max: 40 },
        { key: "footerNote", label: "푸터 안내문", kind: "area", max: 300 }
      ]
    }
  ];

  const POKEMOA = {
    schemaVersion: 1,
    site: "pokemoa",
    siteName: "포켓몬카드모아",
    theme: { accent: "#101f3c", accentSoft: "#ffcb05", mode: "dark" },
    copy: POKEMOA_COPY,
    banner: {
      enabled: false,
      text: "30th CELEBRATION 정가 구매처를 새로 정리했어요.",
      linkUrl: "https://moa-kr.github.io/pokemoa/#home",
      linkLabel: "구매처 보기",
      style: "info",
      updatedAt: null
    },
    popup: {
      enabled: false,
      id: "popup-1",
      title: "포켓몬카드모아에 오신 걸 환영해요",
      body: "지도에서 내 주변 편의점 재고를 확인하고,\n확장팩별 정가 구매처도 함께 살펴보세요.",
      buttonText: "확인",
      buttonUrl: "",
      startDate: "",
      endDate: "",
      dismissDays: 1,
      updatedAt: null
    },
    navigation: {
      tabs: [
        { id: "map", label: "동네에서 찾기", visible: true, order: 1 },
        { id: "home", label: "정가 구매처", visible: true, order: 2 },
        { id: "schedule", label: "일정·소식", visible: true, order: 3 },
        { id: "guide", label: "도감·시세", visible: true, order: 4 },
        { id: "trends", label: "팝수 조회", visible: true, order: 5 }
      ],
      sections: [
        { id: "hero", label: "첫 화면 소개", visible: true, order: 1 },
        { id: "pricing", label: "70,000원에 살 수 있는 곳, 채널별 조건까지", visible: true, order: 2 },
        { id: "boxes", label: "30th 말고 다른 박스, 정가로 사는 곳", visible: true, order: 3 },
        { id: "offline", label: "마트·아트박스·자판기·카드샵에서 정가로 사는 곳", visible: true, order: 4 },
        { id: "trend", label: "지금 가장 많이 찾는 4개 세트", visible: true, order: 5 },
        { id: "tips", label: "헛걸음을 줄이는 세 가지 순서", visible: true, order: 6 },
        { id: "cards", label: "수록 카드와 레어도", visible: true, order: 7 },
        { id: "faq", label: "구매 전에 가장 많이 묻는 것들", visible: true, order: 8 },
        { id: "pop", label: "팝수 조회", visible: true, order: 9 }
      ]
    },
    cards: [
      { id: "stock", title: "실시간 재고", description: "내 주변 편의점 재고를 지도에서 확인", visible: true, order: 1 },
      { id: "retail", title: "정가 구매처", description: "포켓몬스토어·SSG·G마켓 등 정가 판매처 정리", visible: true, order: 2 },
      { id: "pop", title: "팝수 조회", description: "카드 번호로 PSA·BRG 팝수 확인", visible: true, order: 3 }
    ],
    meta: { updatedBy: "moa-admin", updatedAt: null, note: "" }
  };

  const BOKJIMOA = {
    schemaVersion: 1,
    site: "bokjimoa",
    siteName: "회사복지모아",
    theme: { accent: "#2c5bf6", accentSoft: "#eaf0ff", mode: "light" },
    copy: BOKJIMOA_COPY,
    banner: {
      enabled: false,
      text: "2026년 임단협 현황을 회사별로 업데이트했어요.",
      linkUrl: "https://bokjimoa.onrender.com/#/home",
      linkLabel: "확인하기",
      style: "info",
      updatedAt: null
    },
    popup: {
      enabled: false,
      id: "popup-1",
      title: "회사복지모아 안내",
      body: "회사 이메일로 인증한 재직자라면 우리 회사 복지를 직접 올릴 수 있어요.",
      buttonText: "알겠어요",
      buttonUrl: "",
      startDate: "",
      endDate: "",
      dismissDays: 1,
      updatedAt: null
    },
    navigation: {
      tabs: [
        { id: "home", label: "홈", visible: true, order: 1 },
        { id: "ranking", label: "주제별 TOP", visible: true, order: 2 },
        { id: "calculator", label: "복지 계산기", visible: true, order: 3 },
        { id: "compare", label: "비교하기", visible: true, order: 4 }
      ],
      sections: [
        { id: "hero", label: "첫 화면 소개", visible: true, order: 1 },
        { id: "search", label: "회사 찾기", visible: true, order: 2 },
        { id: "recent", label: "최근 업로드된 회사", visible: true, order: 3 },
        { id: "popular", label: "인기 · 등록 많은 회사", visible: true, order: 4 },
        { id: "upload-cta", label: "내 회사 복지를 알려주세요", visible: true, order: 5 }
      ]
    },
    cards: [
      { id: "companies", title: "등록 기업", description: "복지 정보가 올라온 기업 수", visible: true, order: 1 },
      { id: "items", title: "복지 항목", description: "검증된 복지 항목 수", visible: true, order: 2 },
      { id: "bargaining", title: "임단협 현황", description: "회사별 2026년 임금협상 상태", visible: true, order: 3 }
    ],
    meta: { updatedBy: "moa-admin", updatedAt: null, note: "" }
  };

  window.MOA_SITES = {
    pokemoa: {
      id: "pokemoa",
      name: "포켓몬카드모아",
      slug: "pokemoa",
      repo: "moa-kr/pokemoa",
      branch: "main",
      path: "assets/config/site-config.json",
      liveUrl: "https://moa-kr.github.io/pokemoa/",
      deployKind: "GitHub Pages",
      deployEta: "30초 ~ 1분",
      defaults: POKEMOA,
      copyGroups: POKEMOA_COPY_GROUPS
    },
    bokjimoa: {
      id: "bokjimoa",
      name: "회사복지모아",
      slug: "bokjimoa",
      repo: "moa-kr/bokjinabi",
      branch: "main",
      path: "public/config/site-config.json",
      liveUrl: "https://bokjimoa.onrender.com/",
      deployKind: "Render (자동 배포)",
      deployEta: "1 ~ 2분",
      defaults: BOKJIMOA,
      copyGroups: BOKJIMOA_COPY_GROUPS
    }
  };

  window.MOA_ADMIN_API = "https://bokjimoa.onrender.com";
})();
