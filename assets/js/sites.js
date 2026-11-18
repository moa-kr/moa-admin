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
      subtitle: "포켓몬 카드 정가·입고·재고 한눈에",
      heroTitle: "오늘 입고된 카드, 어디서 살 수 있을까?",
      heroDescription: "확장팩별 정가 구매처와 편의점 4사 재고를 한 번에 확인하세요.",
      ctaLabel: "내 주변 매장 지도 열기",
      footerText: "포켓몬카드모아 — 정가 구매처·입고 기록·재고 지도를 모아 안내합니다."
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
        { id: "status", label: "현황 카드", visible: true, order: 2 },
        { id: "restock", label: "최근 입고 기록", visible: true, order: 3 },
        { id: "pricing", label: "정가 구매처", visible: true, order: 4 },
        { id: "trend", label: "인기 카드 시세", visible: true, order: 5 },
        { id: "faq", label: "자주 묻는 질문", visible: true, order: 6 }
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
      heroTitle: "우리 회사 복지, 다른 회사와 비교해 보세요",
      heroDescription: "공식 자료와 재직자 제보를 구분해 표시합니다. 확인된 값만 적고, 확인되지 않은 값은 ‘확인 필요’로 둡니다.",
      ctaLabel: "복지 올리기",
      footerText: "회사복지모아 · BETA — 공식 자료와 이용자 제보를 구분해 표시합니다."
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
        { id: "search", label: "회사 찾기", visible: true, order: 1 },
        { id: "recent", label: "최근 업로드된 회사", visible: true, order: 2 },
        { id: "popular", label: "인기 · 등록 많은 회사", visible: true, order: 3 },
        { id: "upload-cta", label: "내 회사 복지를 알려주세요", visible: true, order: 4 }
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
