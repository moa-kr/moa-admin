/* 모아 어드민 — 두 사이트의 배포 위치와 기본 설정값
   실제 값은 GitHub 의 site-config.json 을 불러와 덮어씁니다. 아래 defaults 는
   "설정 파일이 아직 없을 때" 쓰는 초기값(= 현재 사이트에 보이는 문구)입니다. */
(function () {
  "use strict";

  const POKEMOA = {
    schemaVersion: 1,
    site: "pokemoa",
    siteName: "포켓몬카드모아",
    theme: { accent: "#101f3c", accentSoft: "#ffcb05", mode: "dark" },
    copy: {
      siteTitle: "포켓몬카드모아",
      subtitle: "POKEMON CARD MOA",
      heroTitle: "30th CELEBRATION,<br><em>정가</em>로 만나는 방법",
      heroDescription: "포켓몬 카드 정가 구매처와 추첨 일정, 입고 기록, 편의점 4사 재고와 취급 카드까지 한 화면에 모았습니다. 리셀가에 흔들리지 않도록 기준 가격부터 확인하세요.",
      ctaLabel: "정가 구매처 보기",
      footerText: "포켓몬 카드의 정가 구매처, 추첨·입고 일정, 주변 매장 재고, 수록 카드 정보를 한 곳에 모은 비공식 정보 사이트입니다. 데이터 기준일 2026-11-17."
    },
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
      { id: "stock", title: "실시간 재고", description: "내 주변 편의점 4사 재고를 지도에서 확인", visible: true, order: 1 },
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
    copy: {
      siteTitle: "회사복지모아",
      subtitle: "500대 기업 복지·임단협 현황을 한눈에",
      heroTitle: "회사별 사내 복지,<br>찾아보고 <span class=\"hl\">골라서</span> 비교",
      heroDescription: "기업별 복지를 한눈에 보고, 원하는 회사만 골라 비교하세요.",
      ctaLabel: "복지 올리기",
      footerText: "회사복지모아 · BETA"
    },
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
      defaults: POKEMOA
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
      defaults: BOKJIMOA
    }
  };

  window.MOA_ADMIN_API = "https://bokjimoa.onrender.com";
})();
