/* 모아 어드민 — 두 사이트의 배포 위치와 기본 설정값
   실제 값은 GitHub 의 site-config.json 을 불러와 덮어씁니다. 아래 defaults 는
   "설정 파일이 아직 없을 때" 쓰는 초기값(= 사이트 화면에 적힌 문구)입니다.

   fields 는 문구 키 하나하나의 라벨·형식·길이입니다.
   key 는 사이트 HTML 의 data-copy / data-copy-html 값과 같아야 하고,
   kind 는 text(한 줄) · html(한 줄, <b>·<br> 등 일부 태그 허용) ·
           area(여러 줄) · areaHtml(여러 줄, 일부 태그 허용) 입니다.

   sections 는 ② ‘탭 안 섹션’ 화면의 정보입니다.
   - tab     : 그 섹션이 들어 있는 탭 id (navigation.tabs 의 id)
   - titleKey: 화면 제목을 copy 의 어느 키로 그리는 섹션. 없으면 navigation 의 label 이
               [data-section-title] 에 들어갑니다.
   - copyKeys: 그 섹션 안에 있는 모든 data-copy 키 — ② 의 ✎ 를 펼치면 이 칸들이 함께 나오고,
               ③ 문구 화면에서도 같은 섹션 묶음으로 보입니다.
   이 목록이 곧 site-config.json 의 navigation.sections 기본값이 됩니다. */
(function () {
  "use strict";

  /* ───────────── 문구 키 정의 (라벨 · 형식 · 최대 길이) ───────────── */
  const POKEMOA_FIELDS = {
    "siteTitle": ["사이트 이름", "text", 30],
    "subtitle": ["로고 아래 영문 부제", "text", 60],
    "headerDate": ["헤더 오른쪽 기준일", "text", 20],
    "inquiryBtn": ["헤더 ‘관리자 문의’ 버튼", "text", 20],
    "headerReport": ["헤더 ‘재고 제보’ 버튼", "text", 20],
    "heroTag": ["히어로 위 표제", "html", 80],
    "heroTitle": ["히어로 제목", "html", 100],
    "heroDescription": ["히어로 설명", "area", 300],
    "heroPrice1Label": ["가격 박스 1 · 라벨", "text", 30],
    "heroPrice2Label": ["가격 박스 2 · 라벨", "text", 30],
    "heroPrice3Label": ["가격 박스 3 · 라벨", "text", 30],
    "ctaLabel": ["히어로 노란 버튼", "text", 24],
    "ctaLabel2": ["히어로 보조 버튼", "text", 24],
    "pricingEyebrow": ["표제(작은 윗줄)", "text", 40],
    "pricingDesc": ["설명", "areaHtml", 400],
    "pricingLink": ["오른쪽 링크 문구", "text", 40],
    "pricingSource": ["하단 출처 안내", "area", 500],
    "boxesEyebrow": ["표제(작은 윗줄)", "text", 40],
    "boxesDesc": ["설명", "areaHtml", 500],
    "boxesLink": ["오른쪽 링크 문구", "text", 40],
    "boxesSource": ["하단 출처 안내", "area", 600],
    "offlineEyebrow": ["표제(작은 윗줄)", "text", 40],
    "offlineDesc": ["설명", "areaHtml", 400],
    "offlineLink": ["오른쪽 링크 문구", "text", 40],
    "offlineArtName": ["바로가기 1 · 이름(아트박스)", "text", 30],
    "offlineArtSub": ["바로가기 1 · 설명", "text", 50],
    "offlineShopName": ["바로가기 2 · 이름(카드샵)", "text", 30],
    "offlineShopSub": ["바로가기 2 · 설명", "text", 50],
    "offlineVendingName": ["바로가기 3 · 이름(자판기)", "text", 30],
    "offlineVendingSub": ["바로가기 3 · 설명", "text", 50],
    "offlineMartName": ["바로가기 4 · 이름(대형마트)", "text", 30],
    "offlineMartSub": ["바로가기 4 · 설명", "text", 50],
    "trendEyebrow": ["표제(작은 윗줄)", "text", 40],
    "trendDesc": ["설명", "areaHtml", 300],
    "trendLink": ["오른쪽 링크 문구", "text", 40],
    "trendTag1": ["카드 1 · 꼬리표(30th)", "text", 20],
    "trendTag2": ["카드 2 · 꼬리표(배틀파트너즈)", "text", 20],
    "trendTag3": ["카드 3 · 꼬리표(어비스아이)", "text", 20],
    "trendTag4": ["카드 4 · 꼬리표(블랙볼트)", "text", 20],
    "trendGo": ["카드 하단 안내 문구", "text", 40],
    "tipsEyebrow": ["표제(작은 윗줄)", "text", 40],
    "tip1Title": ["1 · 제목", "text", 30],
    "tip1Body": ["1 · 설명", "area", 200],
    "tip2Title": ["2 · 제목", "text", 30],
    "tip2Body": ["2 · 설명", "area", 200],
    "tip3Title": ["3 · 제목", "text", 30],
    "tip3Body": ["3 · 설명", "area", 200],
    "tipsCta": ["아래 버튼", "text", 30],
    "issuesEyebrow": ["표제(작은 윗줄)", "text", 40],
    "issuesTitle": ["섹션 제목", "text", 60],
    "issuesDesc": ["설명", "areaHtml", 300],
    "issuesLink": ["오른쪽 링크 문구", "text", 40],
    "releasesEyebrow": ["표제(작은 윗줄)", "text", 40],
    "releasesTitle": ["섹션 제목", "text", 60],
    "releasesDesc": ["설명", "areaHtml", 300],
    "releasesLink": ["오른쪽 링크 문구", "text", 40],
    "marketEyebrow": ["표제(작은 윗줄)", "text", 40],
    "marketTitle": ["섹션 제목", "text", 60],
    "marketLead": ["설명", "areaHtml", 600],
    "marketGroupPsa": ["PSA 그룹 · 제목", "text", 40],
    "marketPsaSearchName": ["PSA 공식 경매가 · 이름", "text", 40],
    "marketPsaSearchSub": ["PSA 공식 경매가 · 설명", "text", 50],
    "marketPsaShopName": ["PSA 샵·등급카드 · 이름", "text", 40],
    "marketPsaShopSub": ["PSA 샵·즉구가 · 설명", "text", 50],
    "marketPsaGuideName": ["PSA 가격 가이드 · 이름", "text", 40],
    "marketPsaGuideSub": ["PSA 가격 가이드 · 설명", "text", 50],
    "marketPsaBadge": ["PSA 로그인 안내 배지", "text", 60],
    "marketNote": ["PSA 그룹 · 하단 안내 문구", "area", 400],
    "resellEyebrow": ["리셀 · 표제(작은 윗줄)", "text", 40],
    "resellTitle": ["리셀 · 섹션 제목", "text", 60],
    "resellLead": ["리셀 · 설명", "areaHtml", 500],
    "resellNote": ["리셀 · 하단 안내 문구", "area", 400],
    "marketGroupKr": ["리셀 그룹 1 · 제목(한국·일본)", "text", 40],
    "marketKreamName": ["크림 · 이름", "text", 40],
    "marketKreamSub": ["크림 · 설명", "text", 50],
    "marketSnkrdunkName": ["스니커덩크 · 이름", "text", 40],
    "marketSnkrdunkSub": ["스니커덩크 · 설명", "text", 50],
    "marketGroupFree": ["리셀 그룹 2 · 제목(해외 실거래)", "text", 40],
    "market130Name": ["130point · 이름", "text", 40],
    "market130Sub": ["130point · 설명", "text", 50],
    "marketPcName": ["PriceCharting · 이름", "text", 40],
    "marketPcSub": ["PriceCharting · 설명", "text", 50],
    "marketEbaySoldName": ["eBay 낙찰 · 이름", "text", 40],
    "marketEbaySoldSub": ["eBay 낙찰 · 설명", "text", 50],
    "marketEbayBinName": ["eBay 즉구 · 이름", "text", 40],
    "marketEbayBinSub": ["eBay 즉구 · 설명", "text", 50],
    "status1Title": ["1 · 제목(재고 있음)", "text", 20],
    "status1Desc": ["1 · 설명", "area", 200],
    "status2Title": ["2 · 제목(미조회)", "text", 20],
    "status2Desc": ["2 · 설명", "area", 200],
    "status3Title": ["3 · 제목(없음)", "text", 20],
    "status3Desc": ["3 · 설명", "area", 200],
    "status4Title": ["4 · 제목(보유 카드 표시)", "text", 20],
    "status4Desc": ["4 · 설명", "area", 200],
    "status5Title": ["5 · 제목(오프라인 판매처)", "text", 20],
    "status5Desc": ["5 · 설명", "area", 300],
    "mapChannelsTitle": ["공식 채널 · 제목", "text", 40],
    "fxTitle": ["위젯 제목", "text", 30],
    "fxUsdLabel": ["USD 이름", "text", 12],
    "fxUsdCap": ["USD 기준 문구", "text", 20],
    "fxJpyLabel": ["JPY 이름", "text", 12],
    "fxJpyCap": ["JPY 기준 문구", "text", 20],
    "fxRefresh": ["‘새로고침’ 버튼", "text", 12],
    "setSearchLabel": ["검색칸 라벨", "text", 30],
    "setSearchBtn": ["검색 버튼", "text", 12],
    "setSearchHint": ["검색 아래 안내", "text", 120],
    "compareTitle": ["비교표 제목", "text", 50],
    "calcTitle": ["계산기 제목", "text", 40],
    "calcBtn": ["계산 버튼", "text", 12],
    "calcDiffLabel": ["결과 1 · 라벨", "text", 20],
    "calcRateLabel": ["결과 2 · 라벨", "text", 20],
    "cardsEyebrow": ["표제(작은 윗줄)", "text", 40],
    "cardsRarityNote": ["레어도 안내", "text", 60],
    "cardsMore": ["‘더보기’ 버튼", "text", 12],
    "checklistTitle": ["왼쪽 카드 · 제목", "text", 40],
    "checklistSub": ["왼쪽 카드 · 설명", "text", 80],
    "fakeTitle": ["오른쪽 카드 · 제목", "text", 40],
    "fakeSub": ["오른쪽 카드 · 설명", "text", 80],
    "fakeNote": ["오른쪽 카드 · 강조 문구", "area", 200],
    "faqEyebrow": ["표제(작은 윗줄)", "text", 40],
    "faqMore": ["‘더보기’ 버튼", "text", 12],
    "popCrossTitle": ["팝수 탭 · 안내 제목", "text", 60],
    "popCrossDesc": ["팝수 탭 · 안내 문구", "areaHtml", 200],
    "popCrossCta": ["팝수 탭 · 버튼", "text", 40],
    "popCompanyLabel": ["등급 회사 선택 라벨", "text", 30],
    "popQueryLabel": ["번호 입력 라벨", "text", 50],
    "popSearchBtn": ["‘조회’ 버튼", "text", 12],
    "footerText": ["푸터 소개 문단", "area", 250],
    "footerNote1": ["고지 1 (비공식 안내)", "area", 400],
    "footerNote2": ["고지 2 (데이터 안내)", "area", 400],
    "footerNote3": ["고지 3 (광고·제휴 고지)", "area", 400],
    "footerCopyright": ["저작권 줄", "text", 60],
    "footerDataDate": ["데이터 기준일", "text", 40],
    "mapOfflineLabel": ["‘오프라인’ 줄 라벨", "text", 12],
    "mapOfflineToggle": ["‘지도에 함께 보기’", "text", 20],
    "mapRegionLabel": ["‘지역’ 줄 라벨", "text", 12],
    "mapFindRegion": ["‘선택 지역 찾기’ 버튼", "text", 20],
    "mapFindMine": ["‘내 위치로 찾기’ 버튼", "text", 20],
    "mapRadiusLabel": ["‘반경’ 줄 라벨", "text", 12],
    "mapFilterReset": ["‘필터 초기화’ 버튼", "text", 20],
    "mapSortLabel": ["‘정렬’ 줄 라벨", "text", 12],
    "mapStockOnly": ["‘재고 있는 매장만’", "text", 20],
    "mapSideTitle": ["매장 목록 제목", "text", 24],
    "mapMore": ["매장 목록 ‘더보기’", "text", 12],
    "mapEyebrow": ["표제(작은 윗줄)", "text", 40],
    "mapTitle": ["탭 제목", "text", 80],
    "mapLead": ["탭 설명", "areaHtml", 1000],
    "scheduleEyebrow": ["표제(작은 윗줄)", "text", 40],
    "scheduleTitle": ["탭 제목", "text", 60],
    "scheduleLead": ["탭 설명", "areaHtml", 600],
    "guideEyebrow": ["표제(작은 윗줄)", "text", 40],
    "guideTitle": ["탭 제목", "text", 60],
    "guideLead": ["탭 설명", "areaHtml", 700],
    "trendsEyebrow": ["표제(작은 윗줄)", "text", 40],
    "trendsTitle": ["탭 제목", "text", 60],
    "trendsLead": ["탭 설명", "areaHtml", 600],
    "scheduleSubNews": ["서브탭 1 (카드 뉴스·소식)", "text", 20],
    "scheduleSubCal": ["서브탭 2 (발매·재입고 일정)", "text", 20],
    "scheduleTimelineTitle": ["타임라인 카드 · 제목", "text", 50],
    "scheduleTimelineSub": ["타임라인 카드 · 설명", "areaHtml", 200],
    "scheduleCalTitle": ["캘린더 카드 · 제목", "text", 40],
    "scheduleCalSub": ["캘린더 카드 · 설명", "areaHtml", 120],
    "schedulePastToggle": ["‘지난 입고일 보기’", "text", 20],
    "scheduleNoticeTitle": ["‘공지 확인처’ 제목", "text", 24],
    "scheduleLink1Name": ["공지 확인처 1 · 이름", "text", 40],
    "scheduleLink1Sub": ["공지 확인처 1 · 설명", "text", 50],
    "scheduleLink2Name": ["공지 확인처 2 · 이름", "text", 40],
    "scheduleLink2Sub": ["공지 확인처 2 · 설명", "text", 50],
    "scheduleWeekTitle": ["요일별 가이드 · 제목", "text", 40],
    "scheduleWeekSub": ["요일별 가이드 · 설명", "areaHtml", 200],
    "scheduleWeekTh1": ["표 머리 1", "text", 12],
    "scheduleWeekTh2": ["표 머리 2", "text", 12],
    "scheduleWeekTh3": ["표 머리 3", "text", 12],
    "scheduleWeekTh4": ["표 머리 4", "text", 12]
  };

  const BOKJIMOA_FIELDS = {
    "siteTitle": ["사이트 이름", "text", 30],
    "subtitle": ["헤더 부제", "text", 60],
    "heroEyebrow": ["히어로 표제", "text", 40],
    "heroTitle": ["히어로 제목", "html", 100],
    "heroDescription": ["히어로 설명", "area", 300],
    "heroCta1": ["히어로 버튼 1", "text", 24],
    "heroCta2": ["히어로 버튼 2", "text", 24],
    "stat1Label": ["통계 1 · 라벨(개사)", "text", 12],
    "stat2Label": ["통계 2 · 라벨(건)", "text", 12],
    "stat3Label": ["통계 3 · 라벨(공식 자료)", "text", 20],
    "stat4Label": ["통계 4 · 라벨(제보)", "text", 12],
    "guideTitle": ["이용 안내 제목", "text", 30],
    "guide1Title": ["안내 1 · 제목", "text", 24],
    "guide1Desc": ["안내 1 · 설명", "text", 60],
    "guide2Title": ["안내 2 · 제목", "text", 24],
    "guide2Desc": ["안내 2 · 설명", "text", 60],
    "guide3Title": ["안내 3 · 제목", "text", 24],
    "guide3Desc": ["안내 3 · 설명", "text", 60],
    "guide4Title": ["안내 4 · 제목", "text", 24],
    "guide4Desc": ["안내 4 · 설명", "text", 60],
    "shortcutLabel": ["바로가기 메뉴 제목", "text", 24],
    "shortcutHint": ["바로가기 메뉴 설명", "text", 40],
    "shortcut1Title": ["바로가기 1 · 제목", "text", 24],
    "shortcut1Desc": ["바로가기 1 · 설명", "text", 60],
    "shortcut2Title": ["바로가기 2 · 제목", "text", 24],
    "shortcut2Desc": ["바로가기 2 · 설명", "text", 60],
    "shortcut3Title": ["바로가기 3 · 제목", "text", 24],
    "shortcut3Desc": ["바로가기 3 · 설명", "text", 60],
    "searchDescA": ["회사 찾기 · 앞부분", "text", 40],
    "searchDescB": ["회사 찾기 · 뒷부분", "text", 120],
    "findOnlyData": ["‘복지 등록된 기업만 보기’", "text", 30],
    "findMoreBtn": ["‘더 보기’ 버튼", "text", 12],
    "recentDesc": ["최근 업로드 · 설명", "text", 80],
    "popularDesc": ["인기 회사 · 설명", "text", 80],
    "popularLink": ["인기 회사 · 링크", "text", 30],
    "uploadDesc": ["복지 올리기 · 설명", "text", 120],
    "uploadCta1": ["복지 올리기 · 버튼 1", "text", 24],
    "uploadCta2": ["복지 올리기 · 버튼 2", "text", 24],
    "companyViewBtn": ["회사 카드 · ‘복지 보기’", "text", 16],
    "rankingTitle": ["주제별 TOP · 제목", "text", 60],
    "rankingDesc": ["주제별 TOP · 설명", "area", 200],
    "rankingMetricCount": ["랭킹 기준 · 항목 수", "text", 20],
    "rankingMetricValue": ["랭킹 기준 · 금액", "text", 20],
    "rankingFootnote": ["랭킹 하단 안내", "area", 200],
    "calcTitle": ["계산기 · 제목", "text", 60],
    "calcDesc": ["계산기 · 설명", "area", 200],
    "calcCompanyLabel": ["계산기 · 회사 라벨", "text", 20],
    "calcMarriedLabel": ["계산기 · 혼인 여부", "text", 20],
    "calcSingle": ["혼인 · 미혼", "text", 12],
    "calcMarried": ["혼인 · 기혼", "text", 12],
    "calcChildrenLabel": ["계산기 · 자녀 수", "text", 20],
    "calcHousingLabel": ["계산기 · 주거", "text", 20],
    "calcHousingNone": ["주거 · 해당 없음", "text", 16],
    "calcHousingJeonse": ["주거 · 전세·임차", "text", 16],
    "calcHousingPurchase": ["주거 · 주택 구입", "text", 16],
    "calcInterestLabel": ["계산기 · 관심 항목", "text", 20],
    "calcMedical": ["관심 · 의료·건강", "text", 30],
    "calcLeisure": ["관심 · 여가·휴가", "text", 30],
    "calcLiveHint": ["계산기 하단 안내", "text", 60],
    "compareTitle": ["비교 · 머리글", "text", 40],
    "compareRange": ["비교 · 인원 표기", "text", 20],
    "compareEmptyTitle": ["비교 전 안내 제목", "text", 50],
    "compareEmptyDesc": ["비교 전 안내 설명", "text", 80],
    "footerText": ["푸터 브랜드 줄", "text", 40],
    "footerNote": ["푸터 안내문", "area", 300]
  };

  /* ───────────── 탭 · 섹션 정의 (② 화면) ───────────── */
  const POKEMOA_TABS = [
    ["map", "동네에서 찾기"],
    ["home", "정가 구매처"],
    ["schedule", "일정·소식"],
    ["guide", "시세·도감"],
    ["trends", "팝수 조회"]
  ];
  const BOKJIMOA_TABS = [
    ["home", "홈"],
    ["ranking", "주제별 TOP"],
    ["calculator", "복지 계산기"],
    ["compare", "비교하기"]
  ];
  const POKEMOA_TAB_HEADS = {
    "map": ["mapEyebrow", "mapTitle", "mapLead"],
    "home": [],
    "schedule": ["scheduleEyebrow", "scheduleTitle", "scheduleLead"],
    "guide": ["guideEyebrow", "guideTitle", "guideLead"],
    "trends": ["trendsEyebrow", "trendsTitle", "trendsLead"]
  };
  const POKEMOA_TAB_EXTRAS = {
    "map": ["mapOfflineLabel", "mapOfflineToggle", "mapRegionLabel", "mapFindRegion", "mapFindMine", "mapRadiusLabel", "mapFilterReset", "mapSortLabel", "mapStockOnly", "mapSideTitle", "mapMore"],
    "home": [],
    "schedule": ["scheduleSubNews", "scheduleSubCal", "scheduleTimelineTitle", "scheduleTimelineSub", "scheduleCalTitle", "scheduleCalSub", "schedulePastToggle", "scheduleNoticeTitle", "scheduleLink1Name", "scheduleLink1Sub", "scheduleLink2Name", "scheduleLink2Sub", "scheduleWeekTitle", "scheduleWeekSub", "scheduleWeekTh1", "scheduleWeekTh2", "scheduleWeekTh3", "scheduleWeekTh4"],
    "guide": ["setSearchLabel", "setSearchBtn", "setSearchHint", "compareTitle", "calcTitle", "calcBtn", "calcDiffLabel", "calcRateLabel", "checklistTitle", "checklistSub", "fakeTitle", "fakeSub", "fakeNote"],
    "trends": []
  };
  const BOKJIMOA_TAB_HEADS = {
    "home": [],
    "ranking": [],
    "calculator": [],
    "compare": []
  };
  const BOKJIMOA_TAB_EXTRAS = {
    "home": ["shortcutLabel", "shortcutHint", "shortcut1Title", "shortcut1Desc", "shortcut2Title", "shortcut2Desc", "shortcut3Title", "shortcut3Desc"],
    "ranking": [],
    "calculator": [],
    "compare": []
  };
  const POKEMOA_HEAD_KEYS = ["siteTitle", "subtitle", "headerDate", "inquiryBtn", "headerReport"];
  const POKEMOA_FOOT_KEYS = ["footerText", "footerNote1", "footerNote2", "footerNote3", "footerCopyright", "footerDataDate"];
  const BOKJIMOA_HEAD_KEYS = ["siteTitle", "subtitle"];
  const BOKJIMOA_FOOT_KEYS = ["footerText", "footerNote"];

  const POKEMOA_SECTION_META = [
    { id: "map-status", tab: "map", label: "상태 안내 (5개)", copyKeys: ["status1Title", "status1Desc", "status2Title", "status2Desc", "status3Title", "status3Desc", "status4Title", "status4Desc", "status5Title", "status5Desc"], note: "지도 아래 재고 상태 안내 5개입니다. 제목과 설명을 여기서 고칩니다." },
    { id: "map-channels", tab: "map", label: "공식 채널 바로가기", titleKey: "mapChannelsTitle", copyKeys: ["mapChannelsTitle"] },
    { id: "hero", tab: "home", label: "첫 화면 히어로", titleKey: "heroTitle", copyKeys: ["heroTag", "heroTitle", "heroDescription", "heroPrice1Label", "heroPrice2Label", "heroPrice3Label", "ctaLabel", "ctaLabel2"], note: "히어로 제목·설명·가격 박스·버튼 문구를 여기서 고칩니다." },
    { id: "pricing", tab: "home", label: "70,000원에 살 수 있는 곳, 채널별 조건까지", copyKeys: ["pricingEyebrow", "pricingDesc", "pricingLink", "pricingSource"] },
    { id: "boxes", tab: "home", label: "30th 말고 다른 박스, 정가로 사는 곳", copyKeys: ["boxesEyebrow", "boxesDesc", "boxesLink", "boxesSource"] },
    { id: "offline", tab: "home", label: "마트·아트박스·자판기·카드샵에서 정가로 사는 곳", copyKeys: ["offlineEyebrow", "offlineDesc", "offlineLink", "offlineArtName", "offlineArtSub", "offlineShopName", "offlineShopSub", "offlineVendingName", "offlineVendingSub", "offlineMartName", "offlineMartSub"] },
    { id: "trend", tab: "home", label: "지금 가장 많이 찾는 4개 세트", copyKeys: ["trendEyebrow", "trendDesc", "trendLink", "trendTag1", "trendTag2", "trendTag3", "trendTag4", "trendGo"] },
    { id: "tips", tab: "home", label: "헛걸음을 줄이는 세 가지 순서", copyKeys: ["tipsEyebrow", "tip1Title", "tip1Body", "tip2Title", "tip2Body", "tip3Title", "tip3Body", "tipsCta"] },
    { id: "issues", tab: "schedule", label: "카드 뉴스·소식", titleKey: "issuesTitle", copyKeys: ["issuesEyebrow", "issuesTitle", "issuesDesc", "issuesLink"] },
    { id: "releases", tab: "schedule", label: "발매·재입고 일정", titleKey: "releasesTitle", copyKeys: ["releasesEyebrow", "releasesTitle", "releasesDesc", "releasesLink"] },
    { id: "market", tab: "guide", label: "PSA 거래 내역 조회", titleKey: "marketTitle", copyKeys: ["marketEyebrow", "marketTitle", "marketLead", "marketGroupPsa", "marketPsaSearchName", "marketPsaSearchSub", "marketPsaShopName", "marketPsaShopSub", "marketPsaGuideName", "marketPsaGuideSub", "marketPsaBadge", "marketNote"], note: "PSA 공식 경매가·샵·가격 가이드 버튼의 이름과 설명을 고칩니다. 검색창 없이 버튼을 누르면 각 PSA 페이지로 바로 갑니다." },
    { id: "resellLinks", tab: "guide", label: "리셀 · 해외 실거래 시세", titleKey: "resellTitle", copyKeys: ["resellEyebrow", "resellTitle", "resellLead", "marketGroupKr", "marketKreamName", "marketKreamSub", "marketSnkrdunkName", "marketSnkrdunkSub", "marketGroupFree", "market130Name", "market130Sub", "marketPcName", "marketPcSub", "marketEbaySoldName", "marketEbaySoldSub", "marketEbayBinName", "marketEbayBinSub", "resellNote"], note: "PSA 그룹 아래에 따로 놓인 크림·스니커덩크·130point·PriceCharting·eBay 버튼입니다. 누르면 각 사이트의 포켓몬 카드 화면으로 바로 갑니다." },
    { id: "rates", tab: "guide", label: "환율 위젯", titleKey: "fxTitle", copyKeys: ["fxTitle", "fxUsdLabel", "fxUsdCap", "fxJpyLabel", "fxJpyCap", "fxRefresh"] },
    { id: "cards", tab: "guide", label: "수록 카드와 레어도", copyKeys: ["cardsEyebrow", "cardsRarityNote", "cardsMore"] },
    { id: "faq", tab: "guide", label: "구매 전에 가장 많이 묻는 것들", copyKeys: ["faqEyebrow", "faqMore"] },
    { id: "pop", tab: "trends", label: "팝수 조회", titleKey: "trendsTitle", copyKeys: ["popCrossTitle", "popCrossDesc", "popCrossCta", "popCompanyLabel", "popQueryLabel", "popSearchBtn"] }
  ];
  const BOKJIMOA_SECTION_META = [
    { id: "hero", tab: "home", label: "첫 화면 소개", titleKey: "heroTitle", copyKeys: ["heroEyebrow", "heroTitle", "heroDescription", "heroCta1", "heroCta2", "stat1Label", "stat2Label", "stat3Label", "stat4Label", "guideTitle", "guide1Title", "guide1Desc", "guide2Title", "guide2Desc", "guide3Title", "guide3Desc", "guide4Title", "guide4Desc"], note: "히어로 제목·설명·통계 라벨·이용 안내를 고칩니다." },
    { id: "search", tab: "home", label: "회사 찾기", copyKeys: ["searchDescA", "searchDescB", "findOnlyData", "findMoreBtn"] },
    { id: "recent", tab: "home", label: "최근 업로드된 회사", copyKeys: ["recentDesc"] },
    { id: "popular", tab: "home", label: "인기 · 등록 많은 회사", copyKeys: ["popularDesc", "popularLink"] },
    { id: "upload-cta", tab: "home", label: "내 회사 복지를 알려주세요", copyKeys: ["uploadDesc", "uploadCta1", "uploadCta2", "companyViewBtn"] },
    { id: "ranking-head", tab: "ranking", label: "주제별 TOP 머리글", titleKey: "rankingTitle", copyKeys: ["rankingTitle", "rankingDesc"] },
    { id: "ranking-list", tab: "ranking", label: "테마별 순위 목록", copyKeys: ["rankingMetricCount", "rankingMetricValue", "rankingFootnote"] },
    { id: "calc-head", tab: "calculator", label: "계산기 머리글", titleKey: "calcTitle", copyKeys: ["calcTitle", "calcDesc"] },
    { id: "calc-body", tab: "calculator", label: "계산기 입력·결과", copyKeys: ["calcCompanyLabel", "calcMarriedLabel", "calcSingle", "calcMarried", "calcChildrenLabel", "calcHousingLabel", "calcHousingNone", "calcHousingJeonse", "calcHousingPurchase", "calcInterestLabel", "calcMedical", "calcLeisure", "calcLiveHint"] },
    { id: "compare-head", tab: "compare", label: "비교 회사 선택", titleKey: "compareTitle", copyKeys: ["compareTitle", "compareRange"] },
    { id: "compare-table", tab: "compare", label: "비교표", copyKeys: ["compareEmptyTitle", "compareEmptyDesc"] }
  ];

  /* ───────────── 기본값 (= 사이트 화면의 현재 문구) ───────────── */
  const POKEMOA_COPY = {
    "siteTitle": "포켓몬카드모아",
    "subtitle": "POKEMON CARD MOA",
    "headerDate": "데이터 기준 11-17",
    "inquiryBtn": "관리자 문의",
    "headerReport": "재고 제보",
    "heroTag": "<b>30th</b> 2026 MEGA 확장팩 · 30주년 기념",
    "heroTitle": "30th CELEBRATION,<br><em>정가</em>로 만나는 방법",
    "heroDescription": "포켓몬 카드 구매처와 입고 기록, 편의점 재고와 취급 카드까지 한 화면에 모았습니다. 리셀가에 흔들리지 않도록 기준 가격부터 확인하세요.",
    "heroPrice1Label": "1팩 (카드 6장)",
    "heroPrice2Label": "1박스 · 20팩",
    "heroPrice3Label": "1박스 카드 수",
    "ctaLabel": "정가 구매처 보기",
    "ctaLabel2": "지도에서 재고 찾기",
    "pricingEyebrow": "정가 구매처 현황",
    "pricingDesc": "정가는 모든 채널이 같지만 배송비·판매 단위·추첨 여부가 다릅니다. 결제 전에 총액과 팩당 단가를 확인하세요. 가격은 2026-11-17 확인 기준입니다.",
    "pricingLink": "다른 박스 정가 구매처 →",
    "pricingSource": "출처: 포켓몬 카드 게임 공식 제품 정보(정가·구성), SSG 공식인증샵 상품 페이지(배송비), 편의점 4사 판매 일정 보도(2026-10-09 세계일보 · 10-20 TCG뉴스 정리). 가격·재고는 판매처와 시점에 따라 달라질 수 있습니다.",
    "boxesEyebrow": "다른 확장팩 · 박스 정가 구매처",
    "boxesDesc": "30th CELEBRATION을 뺀 8개 박스의 <b>공식 정가·구성</b>과 <b>KREAM 참고 시세</b>를 박스별로 모았습니다. 위 칩에서 박스를 고르면 아래 구매처 목록이 그 박스 기준으로 바뀝니다. 금액은 공식 정가와 2026-11-17 KREAM 시세이고, 실제 재고·결제 금액은 판매처 페이지에서 확인하세요.",
    "boxesLink": "30th CELEBRATION 구매처 →",
    "boxesSource": "출처: 포켓몬 카드 게임 공식 제품 정보(정가·구성), KREAM 한글판 1박스 즉시구매 최저가(2026-11-17), 포켓몬 스토어 · G마켓 포켓몬카드공식인증샵 · 네이버 브랜드스토어 · SSG · 티씨지박스 · 롯데ON 판매처 페이지(2026-11-18 접속 확인). 재고와 가격은 시점·판매처에 따라 달라지므로 구매 전 판매처 페이지에서 확인하세요.",
    "offlineEyebrow": "오프라인 · 자판기",
    "offlineDesc": "온라인 재고가 없어도 오프라인에서 정가로 살 수 있는 채널입니다. 매장·자판기의 <b>재고는 어떤 채널도 공개하지 않아</b> 표시하지 않으니, 방문 전 매장 문의로 확인하세요.",
    "offlineLink": "지도에서 오프라인 위치 보기 →",
    "offlineArtName": "아트박스",
    "offlineArtSub": "POOM 매장 재고 조회",
    "offlineShopName": "포켓몬 공인 카드샵",
    "offlineShopSub": "전국 16곳 · 공식 목록",
    "offlineVendingName": "공식 카드 자판기",
    "offlineVendingSub": "전국 176곳 위치 안내",
    "offlineMartName": "대형마트 3사",
    "offlineMartSub": "지도에서 지점 찾기",
    "trendEyebrow": "인기 카드팩 트렌드",
    "trendDesc": "정가와 구성, 주목 카드만 짧게 정리했습니다. 세트마다 팩 수와 카드 매수가 달라 팩당 단가로 비교해야 합니다.",
    "trendLink": "수록 카드 도감 →",
    "trendTag1": "현재 최고 수요",
    "trendTag2": "가성비",
    "trendTag3": "최신 MEGA",
    "trendTag4": "고가 카드",
    "trendGo": "정가·시세·수록 카드 보기 →",
    "tipsEyebrow": "오늘의 체크 포인트",
    "tip1Title": "공지부터 확인",
    "tip1Body": "추첨·재입고는 포켓몬 카드 게임 공지와 포켓몬스토어 30주년 페이지가 가장 빠릅니다. 응모 기간과 결제 기한은 다른 날짜입니다.",
    "tip2Title": "앱 재고 → 전화",
    "tip2Body": "편의점 4사 앱 재고는 전산값입니다. 방문 직전 앱으로 보고, 박스 단위 판매 여부는 매장에 전화로 확인하세요.",
    "tip3Title": "팩당 단가로 판단",
    "tip3Body": "리셀 박스는 팩당 단가로 환산해 정가 3,500원과 비교하세요. KREAM 슈링크 박스(2026-11-17) 76,000원은 팩당 3,800원입니다.",
    "tipsCta": "내 주변 매장 지도 열기",
    "issuesEyebrow": "최근 이슈되는 카드 이슈",
    "issuesTitle": "2026년 11월 카드 게임 소식",
    "issuesDesc": "공식 공지와 보도로 확인한 6건입니다. 날짜는 공지·보도 기준이고, 링크는 원문으로 바로 갑니다.",
    "issuesLink": "포켓몬코리아 소식 ↗",
    "releasesEyebrow": "신규 팩 발매 소식",
    "releasesTitle": "공식 사이트에서 확인한 발매·발매 예정",
    "releasesDesc": "포켓몬 카드 게임 공식 제품 정보(pokemoncard.co.kr)의 발매일·정가·구성입니다. 한국판 일정이 없는 상품은 '해외'로 표시했습니다.",
    "releasesLink": "공식 제품 목록 ↗",
    "marketEyebrow": "시세 · 거래가 조회",
    "marketTitle": "PSA 거래 내역 조회 (경매가·즉구가)",
    "marketLead": "버튼을 누르면 PSA 공식 페이지로 바로 이동합니다. <b>PSA 공식 경매가(APR)</b>로 등급별 낙찰 기록을, <b>PSA 샵</b>으로 등급 카드 즉구 매물을, <b>PSA 가격 가이드</b>로 세트별 가이드 가격을 봅니다.",
    "marketGroupPsa": "PSA 공식 거래 내역 (경매가·즉구가)",
    "marketPsaSearchName": "PSA 공식 경매가 (APR)",
    "marketPsaSearchSub": "등급별 경매 낙찰 기록 · 로그인 없이 조회",
    "marketPsaShopName": "PSA 샵 · 등급카드",
    "marketPsaShopSub": "등급 카드 즉구 매물 · PSA 계정 로그인 필요",
    "marketPsaGuideName": "PSA 공식 가격 가이드",
    "marketPsaGuideSub": "로그인 없이 보는 세트·카테고리별 가이드 가격",
    "marketPsaBadge": "샵·등급카드는 무료 PSA 계정 로그인 후 매물이 보입니다",
    "marketNote": "PSA 공식 경매가(APR)와 가격 가이드는 로그인 없이 열립니다. 샵·등급카드는 무료 PSA 계정 로그인 후 매물이 보입니다. 이 사이트는 어떤 결제 화면도 열지 않습니다.",
    "resellEyebrow": "리셀 · 실거래 시세",
    "resellTitle": "리셀 · 해외 실거래 시세 바로가기",
    "resellLead": "버튼을 누르면 각 사이트의 포켓몬 카드 시세 화면으로 바로 이동합니다. <b>크림(KREAM)·스니커덩크</b>로 국내·일본 리셀가를, <b>130point·PriceCharting·eBay 낙찰 완료</b>로 실제 체결가를, <b>eBay 즉구(Buy It Now)</b>로 지금 사는 가격을 봅니다.",
    "resellNote": "크림·스니커덩크·130point·PriceCharting·eBay의 포켓몬 카드 화면으로 바로 이동합니다. 해외 사이트는 영문·일본어 표기와 배송비·관세가 붙을 수 있습니다. 이 사이트는 어떤 결제 화면도 열지 않습니다.",
    "marketGroupKr": "한국·일본 리셀 플랫폼",
    "marketKreamName": "KREAM (크림)",
    "marketKreamSub": "한국 리셀 시세 · 사이트에서 카드 검색",
    "marketSnkrdunkName": "스니커덩크 (SNKRDUNK)",
    "marketSnkrdunkSub": "일본 리셀 시세 · 포켓몬 카드 카테고리",
    "marketGroupFree": "해외 실거래 · 즉구가",
    "market130Name": "130point (실제 체결가)",
    "market130Sub": "eBay 낙찰·베스트오퍼 실제 금액",
    "marketPcName": "PriceCharting",
    "marketPcSub": "PSA 등급별 평균 시세 · 거래 내역",
    "marketEbaySoldName": "eBay 낙찰 완료 (Sold)",
    "marketEbaySoldSub": "경매로 끝난 실제 낙찰가",
    "marketEbayBinName": "eBay 즉구가 (BIN)",
    "marketEbayBinSub": "지금 바로 살 수 있는 가격",
    "status1Title": "재고 있음",
    "status1Desc": "수량 1개 이상을 확인한 매장입니다.",
    "status2Title": "미조회",
    "status2Desc": "아직 실시간 조회 대상이 아니거나 수량을 받지 못한 매장입니다.",
    "status3Title": "없음",
    "status3Desc": "재고 0으로 확인된 매장입니다.",
    "status4Title": "보유 카드 표시",
    "status4Desc": "실시간 조회에서 확인한 상품명과 수량만 붙습니다.",
    "status5Title": "오프라인 판매처",
    "status5Desc": "대형마트, 아트박스, 포켓몬코리아 자판기, 공인 카드샵 장소를 표시합니다. ",
    "mapChannelsTitle": "실제 재고를 확인하는 공식 채널",
    "fxTitle": "오늘의 환율",
    "fxUsdLabel": "USD",
    "fxUsdCap": "1 USD =",
    "fxJpyLabel": "JPY",
    "fxJpyCap": "100 JPY =",
    "fxRefresh": "새로고침",
    "setSearchLabel": "세트·박스 이름 검색",
    "setSearchBtn": "검색",
    "setSearchHint": "세트 이름의 일부만 넣어도 됩니다. 결과에서 정가와 리셀 시세를 바로 확인하세요.",
    "compareTitle": "정가 vs 리셀 — 팩당 단가로 비교하기",
    "calcTitle": "리셀 프리미엄 계산기",
    "calcBtn": "계산",
    "calcDiffLabel": "정가 대비 차액",
    "calcRateLabel": "정가 대비 비율",
    "cardsEyebrow": "30th CELEBRATION 도감",
    "cardsRarityNote": "레어도 표기는 카드 공식 표기를 따릅니다.",
    "cardsMore": "더보기",
    "checklistTitle": "미개봉(슈링크) 확인 체크리스트",
    "checklistSub": "온라인·중고 구매 전에 이 순서로 확인하세요.",
    "fakeTitle": "가품·재포장 주의 신호",
    "fakeSub": "아래 신호가 겹치면 거래를 멈추고 확인하세요.",
    "fakeNote": "정가 이상을 주고 사는 순간 기대값은 좋아지지 않습니다. 확률은 가격과 무관합니다.",
    "faqEyebrow": "자주 묻는 질문",
    "faqMore": "더보기",
    "popCrossTitle": "PSA 거래 내역(경매 낙찰가·즉구가)도 바로 볼 수 있습니다.",
    "popCrossDesc": "도감·시세 탭의 <b>PSA 거래 내역 조회</b>에서 카드명을 넣고 PSA 경매 낙찰가·eBay·스니덩을 한 번에 엽니다.",
    "popCrossCta": "PSA 거래 내역 조회 →",
    "popCompanyLabel": "등급 회사 선택",
    "popQueryLabel": "등급카드 넘버 (인증서 번호 / 카드 번호)",
    "popSearchBtn": "조회",
    "footerText": "포켓몬 카드의 정가 구매처, 추첨·입고 일정, 주변 매장 재고, 수록 카드 정보를 한 곳에 모은 비공식 정보 사이트입니다. 데이터 기준일 2026-11-17.",
    "footerNote1": "포켓몬카드모아는 포켓몬·포켓몬코리아와 무관한 비공식 정보 사이트입니다. ‘포켓몬’, ‘포켓몬 카드 게임’ 및 관련 명칭·이미지의 권리는 각 권리자에게 있습니다. 본 사이트는 공식 로고와 카드 이미지를 사용하지 않으며, 카드 정보는 공개된 상품 정보를 정리한 것입니다.",
    "footerNote2": "지도에 표시된 매장 위치·이름은 카카오맵 실제 장소 데이터이며, 매장별 재고는 편의점 앱에서 실시간으로 조회한 실제 수량만 표시하고, 확인되지 않은 매장은 「미조회」로 둡니다. 구매 판단과 그 결과는 이용자 본인에게 있습니다.",
    "footerNote3": "광고·제휴 고지: 본 사이트는 Google AdSense 광고와 쿠팡 파트너스 활동을 통해 수수료를 받을 수 있습니다. 제휴 링크를 통한 구매 시 사이트에 일정액의 수수료가 지급될 수 있으며, 이용자 가격에는 영향이 없습니다.",
    "footerCopyright": "© 2026 포켓몬카드모아. 비공식 팬 정보 사이트.",
    "footerDataDate": "데이터 기준 2026-11-17",
    "mapOfflineLabel": "오프라인",
    "mapOfflineToggle": "지도에 함께 보기",
    "mapRegionLabel": "지역",
    "mapFindRegion": "선택 지역 찾기",
    "mapFindMine": "내 위치로 찾기",
    "mapRadiusLabel": "반경",
    "mapFilterReset": "필터 초기화",
    "mapSortLabel": "정렬",
    "mapStockOnly": "재고 있는 매장만",
    "mapSideTitle": "매장별 보유 카드",
    "mapMore": "더보기",
    "mapEyebrow": "동네에서 찾기 · 첫 화면",
    "mapTitle": "주변 편의점과 오프라인 판매처",
    "mapLead": "실제 지도 위에 주변 편의점과 <b>오프라인 판매처</b>를 함께 표시합니다. 지도 말풍선과 매장 카드는 편의점 앱에서 실시간으로 <b>확인한 재고 상품·수량</b>만 표시하고, 재고가 0으로 확인되면 <b>「없음」</b>, 확인되지 않은 매장은 <b>「미조회」</b>로 둡니다. <b>'내 위치로 찾기'</b>를 누르면 그 반경의 매장을 새로 조회합니다.",
    "scheduleEyebrow": "일정 · 소식",
    "scheduleTitle": "카드 소식과 발매·재입고 일정",
    "scheduleLead": "먼저 <b>카드 뉴스·소식</b>에서 공식 공지와 신규팩 발매 소식을 확인하고, <b>발매·재입고 일정</b>에서 추첨 회차별 예정·종료 일정을 보세요. 포켓몬스토어 추첨은 회차마다 응모·발표·결제·배송 날짜가 따로 있습니다.",
    "guideEyebrow": "도감 · 시세",
    "guideTitle": "세트별 정가와 리셀 시세 검색",
    "guideLead": "세트·박스 이름으로 검색하면 그 세트의 <b>공식 정가(팩·박스)</b>와 <b>리셀 시세 검색 바로가기(KREAM · 번개장터 · PriceCharting)</b>가 함께 나옵니다. 위의 <b>PSA 거래 내역 조회</b>에서는 PSA 경매 낙찰가와 샵·즉구가를, 그 아래 <b>리셀 · 해외 실거래 시세</b>에서는 크림·스니커덩크·eBay까지 이어서 열 수 있습니다. 아래 세트 칩으로 골라 수록 카드 도감과 정가·리셀 비교표를 볼 수도 있습니다.",
    "trendsEyebrow": "팝수 조회",
    "trendsTitle": "등급 회사를 고르고 인증서·카드 번호로 조회",
    "trendsLead": "<b>PSA · CGC · BRG · BGS</b> 가운데 회사를 먼저 고른 뒤 등급카드 넘버(인증서 번호 또는 카드 번호)를 넣으면, 번호를 복사해 그 회사의 팝 리포트·인증서 조회 페이지로 바로 넘겨 줍니다. 팝수는 회사별로 따로 집계되므로 보고 싶은 회사를 먼저 골라야 합니다.",
    "scheduleSubNews": "카드 뉴스·소식",
    "scheduleSubCal": "발매·재입고 일정",
    "scheduleTimelineTitle": "30th CELEBRATION 추첨·발매 타임라인",
    "scheduleTimelineSub": "2026-09 ~ 2026-11 · 공식 공지 기준 · <b>오늘 이후 일정만 표시</b> (지난 기록은 접어 둡니다)",
    "scheduleCalTitle": "11월 입고 캘린더",
    "scheduleCalSub": "표시된 입고일은 <b>예상 샘플</b>입니다. 공식 일정이 아닙니다.",
    "schedulePastToggle": "지난 입고일 보기",
    "scheduleNoticeTitle": "공지 확인처",
    "scheduleLink1Name": "포켓몬 카드 게임 공식 사이트",
    "scheduleLink1Sub": "추첨·재입고·이벤트 공지 1차 확인처",
    "scheduleLink2Name": "포켓몬스토어 30주년 특설",
    "scheduleLink2Sub": "상품 정보·추첨 응모 페이지",
    "scheduleWeekTitle": "요일별 입고 체크 가이드",
    "scheduleWeekSub": "매장 후기와 판매 일정을 정리한 <b>일반적인 패턴</b>입니다. 공식 입고일이 아니며 매장마다 다릅니다.",
    "scheduleWeekTh1": "요일",
    "scheduleWeekTh2": "볼 곳",
    "scheduleWeekTh3": "할 일",
    "scheduleWeekTh4": "구분"
  };

  const BOKJIMOA_COPY = {
    "siteTitle": "회사복지모아",
    "subtitle": "500대 기업 복지·임단협 현황을 한눈에",
    "heroEyebrow": "복지 비교 플랫폼 · 회사 이메일 인증",
    "heroTitle": "회사별 사내 복지,<br>찾아보고 <span class=\"hl\">골라서</span> 비교",
    "heroDescription": "기업별 복지를 한눈에 보고, 원하는 회사만 골라 비교하세요.",
    "heroCta1": "회사 둘러보기",
    "heroCta2": "복지 올리기",
    "stat1Label": "개사",
    "stat2Label": "건",
    "stat3Label": "공식 자료",
    "stat4Label": "제보",
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
    "findOnlyData": "복지 등록된 기업만 보기",
    "findMoreBtn": "더 보기",
    "recentDesc": "새로 정리한 기업부터. 카드를 누르면 회사 복지 페이지로 이동합니다.",
    "popularDesc": "수록 항목이 많은 회사 순서입니다.",
    "popularLink": "회사 비교하기 →",
    "uploadDesc": "회사 이메일 인증 후 올릴 수 있어요. 올린 항목은 ‘내 제보’에서 수정·삭제됩니다.",
    "uploadCta1": "복지 올리기",
    "uploadCta2": "회사 비교하기",
    "companyViewBtn": "복지 보기",
    "rankingTitle": "직장인이 가장 궁금한 복지 TOP",
    "rankingDesc": "같은 테마끼리 회사 복지를 모아 순위를 매깁니다. 금액은 항목에 적힌 값만 쓰고, 금액이 없는 제도는 따로 표시합니다.",
    "rankingMetricCount": "항목 수 기준",
    "rankingMetricValue": "금액 기준",
    "rankingFootnote": "랭킹은 공개된 금액을 비교한 참고 지표입니다. 실제 수령액은 직급·근속·지급 조건에 따라 달라집니다.",
    "calcTitle": "내 조건으로 보는 연간 복지 금액",
    "calcDesc": "회사와 상황을 고르면 공개된 복지 항목을 1년 기준으로 환산해 드립니다. 추정 기준과 근거도 함께 보여드려요.",
    "calcCompanyLabel": "회사",
    "calcMarriedLabel": "혼인 여부",
    "calcSingle": "미혼",
    "calcMarried": "기혼",
    "calcChildrenLabel": "자녀 수",
    "calcHousingLabel": "주거",
    "calcHousingNone": "해당 없음",
    "calcHousingJeonse": "전세·임차",
    "calcHousingPurchase": "주택 구입",
    "calcInterestLabel": "관심 항목",
    "calcMedical": "의료·건강 지원 포함",
    "calcLeisure": "여가·휴가 지원 포함",
    "calcLiveHint": "조건을 바꾸면 바로 다시 계산됩니다.",
    "compareTitle": "비교할 회사 선택",
    "compareRange": "(2~4개사)",
    "compareEmptyTitle": "비교할 회사를 2~4개 골라주세요",
    "compareEmptyDesc": "위에서 회사를 고르면 표준 항목 기준으로 나란히 비교표가 만들어집니다.",
    "footerText": "회사복지모아 · BETA",
    "footerNote": "공식 자료와 이용자 제보를 구분해 표시합니다. 확인된 값만 적고, 확인되지 않은 값은 '확인 필요'로 둡니다."
  };

  /* ───────────── 섹션 정의 도우미 ───────────── */
  function sectionDefaults(meta) {
    const counter = {};
    return meta.map((section) => {
      counter[section.tab] = (counter[section.tab] || 0) + 1;
      return { id: section.id, label: section.label, visible: true, order: counter[section.tab], tab: section.tab };
    });
  }

  /* ② 화면의 ✎ 편집기·③ 문구 화면이 함께 쓰는 섹션 목록 — 문구 정의(fields)를 붙여서 돌려준다. */
  function decorateSections(meta, fields, tabHeads, tabExtras) {
    return meta.map((section) => {
      const keys = section.copyKeys || [];
      return Object.assign({}, section, {
        fields: keys.map((key) => {
          const def = fields[key] || [key, "text", 120];
          return { key, label: def[0], kind: def[1], max: def[2] };
        }),
        headKeys: (tabHeads && tabHeads[section.tab]) || [],
        extraKeys: (tabExtras && tabExtras[section.tab]) || []
      });
    });
  }

  const POKEMOA_SECTION_DEFAULTS = sectionDefaults(POKEMOA_SECTION_META);
  const BOKJIMOA_SECTION_DEFAULTS = sectionDefaults(BOKJIMOA_SECTION_META);

  /* ③ 문구 화면 그룹 — 머리말 → (탭별) 탭 머리글 · 화면 공통 · 섹션들 → 꼬리말 */
  function buildCopyGroups(options) {
    const { tabs, sections, fields, tabHeads, tabExtras, headKeys, footKeys } = options;
    const fieldOf = (key) => {
      const def = fields[key] || [key, "text", 120];
      return { key, label: def[0], kind: def[1], max: def[2] };
    };
    const groups = [];
    if (headKeys.length) {
      groups.push({ name: "머리말 · 공통", kind: "group", note: "사이트 이름·부제·헤더 문구입니다. 어느 탭에서나 보입니다.", fields: headKeys.map(fieldOf) });
    }
    tabs.forEach(([tabId, tabLabel]) => {
      groups.push({ name: tabLabel, kind: "tab", tab: tabId, fields: [] });
      const heads = (tabHeads && tabHeads[tabId]) || [];
      if (heads.length) {
        groups.push({ name: `${tabLabel} · 탭 머리글`, kind: "group", tab: tabId, note: "탭을 열면 맨 위에 나오는 표제·제목·설명입니다.", fields: heads.map(fieldOf) });
      }
      const extras = (tabExtras && tabExtras[tabId]) || [];
      if (extras.length) {
        groups.push({ name: `${tabLabel} · 화면 공통`, kind: "group", tab: tabId, note: "이 탭 안에서 여러 섹션이 함께 쓰는 문구입니다.", fields: extras.map(fieldOf) });
      }
      sections.filter((section) => section.tab === tabId).forEach((section) => {
        const keys = section.copyKeys || [];
        if (!keys.length) return;
        groups.push({
          name: `${tabLabel} · ${section.label}`,
          kind: "section",
          tab: tabId,
          section: section.id,
          note: section.note || "",
          fields: keys.map(fieldOf)
        });
      });
      const tabCount = groups.filter((g) => g.tab === tabId).reduce((sum, g) => sum + g.fields.length, 0);
      groups.push({ name: `${tabLabel} 합계`, kind: "sum", tab: tabId, tabCount, fields: [] });
    });
    if (footKeys.length) {
      groups.push({ name: "꼬리말 · 공통", kind: "group", note: "푸터 소개·고지·저작권 문구입니다.", fields: footKeys.map(fieldOf) });
    }
    return groups;
  }

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
      tabs: POKEMOA_TABS.map(([id, label], i) => ({ id, label, visible: true, order: i + 1 })),
      sections: POKEMOA_SECTION_DEFAULTS
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
      tabs: BOKJIMOA_TABS.map(([id, label], i) => ({ id, label, visible: true, order: i + 1 })),
      sections: BOKJIMOA_SECTION_DEFAULTS
    },
    cards: [
      { id: "companies", title: "등록 기업", description: "복지 정보가 올라온 기업 수", visible: true, order: 1 },
      { id: "items", title: "복지 항목", description: "검증된 복지 항목 수", visible: true, order: 2 },
      { id: "bargaining", title: "임단협 현황", description: "회사별 2026년 임금협상 상태", visible: true, order: 3 }
    ],
    meta: { updatedBy: "moa-admin", updatedAt: null, note: "" }
  };

  const POKEMOA_SITE = {
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
      fields: POKEMOA_FIELDS,
      sections: decorateSections(POKEMOA_SECTION_META, POKEMOA_FIELDS, POKEMOA_TAB_HEADS, POKEMOA_TAB_EXTRAS),
      tabs: POKEMOA_TABS
  };
  POKEMOA_SITE.copyGroups = buildCopyGroups({
      tabs: POKEMOA_TABS,
      sections: POKEMOA_SECTION_META,
      fields: POKEMOA_FIELDS,
      tabHeads: POKEMOA_TAB_HEADS,
      tabExtras: POKEMOA_TAB_EXTRAS,
      headKeys: POKEMOA_HEAD_KEYS,
      footKeys: POKEMOA_FOOT_KEYS
  });

  const BOKJIMOA_SITE = {
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
      fields: BOKJIMOA_FIELDS,
      sections: decorateSections(BOKJIMOA_SECTION_META, BOKJIMOA_FIELDS, BOKJIMOA_TAB_HEADS, BOKJIMOA_TAB_EXTRAS),
      tabs: BOKJIMOA_TABS
  };
  BOKJIMOA_SITE.copyGroups = buildCopyGroups({
      tabs: BOKJIMOA_TABS,
      sections: BOKJIMOA_SECTION_META,
      fields: BOKJIMOA_FIELDS,
      tabHeads: BOKJIMOA_TAB_HEADS,
      tabExtras: BOKJIMOA_TAB_EXTRAS,
      headKeys: BOKJIMOA_HEAD_KEYS,
      footKeys: BOKJIMOA_FOOT_KEYS
  });

  window.MOA_SITES = { pokemoa: POKEMOA_SITE, bokjimoa: BOKJIMOA_SITE };
  window.MOA_ADMIN_API = "https://bokjimoa.onrender.com";
})();
