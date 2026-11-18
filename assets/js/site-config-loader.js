/* 공통 사이트 설정 로더 (참고용 부품)
   ────────────────────────────────────────────────────────────────
   moa-kr/pokemoa 와 moa-kr/bokjinabi 에 붙여 쓰는 작은 스크립트입니다.
   모아 어드민이 커밋하는 site-config.json 을 읽어 공지 배너·팝업·탭 순서·문구를 적용합니다.
   두 사이트 중 어디에도 아직 연결하지 않았습니다(연결 절차는 SCHEMA.md 참고).

   사용 예)
     <script src="assets/js/site-config-loader.js" defer></script>
     <script>
       MoaSiteConfig.load("assets/config/site-config.json").then(cfg => {
         if (!cfg) return;
         MoaSiteConfig.apply(cfg, {
           bannerHost: document.querySelector("header"),
           bannerPlace: "afterbegin",
           tabContainer: document.querySelector(".main-nav"),
           texts: {
             "title": cfg.copy.siteTitle,
             "meta[name=description]": "content:" + cfg.copy.heroDescription
           }
         });
       });
     </script>
   ──────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const STYLE_ID = "moa-site-config-style";
  const DISMISS_PREFIX = "moa:popup:";

  const STYLES = {
    info: { light: ["#eaf0ff", "#1b3a8f"], dark: ["#22345e", "#dbe7ff"] },
    warn: { light: ["#fff4e0", "#8a5300"], dark: ["#4a3a12", "#ffe6a8"] },
    urgent: { light: ["#fdecec", "#a01c22"], dark: ["#4a1620", "#ffd4d6"] }
  };

  function ensureStyle(dark) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .moa-banner{display:flex;gap:8px;align-items:center;justify-content:center;padding:9px 14px;
        font-size:13px;font-weight:700;line-height:1.4;text-decoration:none;position:relative;z-index:60}
      .moa-banner a{color:inherit;text-decoration:underline}
      .moa-banner .moa-banner-link{margin-left:6px;white-space:nowrap}
      .moa-banner button{background:transparent;border:0;color:inherit;cursor:pointer;font-size:14px;
        margin-left:auto;opacity:.7;padding:2px 6px}
      .moa-popup-backdrop{position:fixed;inset:0;background:rgba(8,14,28,.55);display:flex;align-items:center;
        justify-content:center;padding:20px;z-index:9999}
      .moa-popup{width:100%;max-width:380px;background:#fff;color:#101f3c;border-radius:18px;padding:20px 18px 14px;
        box-shadow:0 20px 60px rgba(0,0,0,.3);font-size:14px}
      .moa-popup h3{margin:0 0 8px;font-size:17px;letter-spacing:-.02em}
      .moa-popup p{margin:0 0 14px;font-size:13px;line-height:1.6;white-space:pre-wrap;color:#46506b}
      .moa-popup .moa-popup-btn{display:block;width:100%;border:0;border-radius:11px;padding:11px;font:inherit;
        font-weight:800;font-size:14px;cursor:pointer;text-align:center;text-decoration:none}
      .moa-popup .moa-popup-dismiss{display:flex;gap:14px;justify-content:center;margin-top:12px;font-size:12px;color:#8b95ac}
      .moa-popup .moa-popup-dismiss button{background:none;border:0;color:inherit;cursor:pointer;font:inherit;text-decoration:underline}
      .moa-hidden-by-config{display:none !important}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.moaTheme = dark ? "dark" : "light";
  }

  function load(path) {
    return fetch(path, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => (cfg && cfg.schemaVersion === 1 ? cfg : null))
      .catch(() => null);
  }

  function mountBanner(cfg, opts) {
    const options = opts || {};
    const banner = cfg.banner;
    if (!banner || !banner.enabled || !String(banner.text || "").trim()) return null;
    ensureStyle(String(cfg.theme && cfg.theme.mode) === "dark");
    const palette = (STYLES[banner.style] || STYLES.info)[Number(cfg.theme && cfg.theme.mode === "dark") ? "dark" : "light"];
    const el = document.createElement("div");
    el.className = "moa-banner";
    el.setAttribute("role", "status");
    el.style.background = options.background || palette[0];
    el.style.color = options.color || palette[1];
    const text = document.createElement("span");
    text.textContent = banner.text;
    el.appendChild(text);
    if (banner.linkUrl) {
      const link = document.createElement("a");
      link.className = "moa-banner-link";
      link.href = banner.linkUrl;
      link.textContent = banner.linkLabel || "자세히 보기";
      if (banner.linkUrl.indexOf("http") === 0) { link.target = "_blank"; link.rel = "noreferrer"; }
      el.appendChild(link);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "공지 닫기");
    close.textContent = "✕";
    close.addEventListener("click", () => el.remove());
    el.appendChild(close);

    const host = options.host || document.body;
    if (options.place === "afterbegin") host.insertBefore(el, host.firstChild);
    else host.appendChild(el);
    return el;
  }

  function popupDismissed(id) {
    try {
      const raw = localStorage.getItem(DISMISS_PREFIX + id);
      if (!raw) return false;
      const until = Number(raw);
      if (!until) return true; // 0일 = 이 탭에서만 닫기
      return until > Date.now();
    } catch (err) { return false; }
  }

  function dismissPopup(id, days) {
    try {
      const until = days > 0 ? Date.now() + days * 86400000 : 0;
      localStorage.setItem(DISMISS_PREFIX + id, String(until));
    } catch (err) { /* 저장소를 못 쓰면 그냥 닫기만 한다 */ }
  }

  function inPeriod(popup) {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (popup.startDate && iso < popup.startDate) return false;
    if (popup.endDate && iso > popup.endDate) return false;
    return true;
  }

  function mountPopup(cfg) {
    const popup = cfg.popup;
    if (!popup || !popup.enabled || !inPeriod(popup)) return null;
    const id = popup.id || "popup-1";
    if (popupDismissed(id)) return null;
    ensureStyle(String(cfg.theme && cfg.theme.mode) === "dark");
    const accent = (cfg.theme && cfg.theme.accentSoft) || (cfg.theme && cfg.theme.accent) || "#2c5bf6";

    const backdrop = document.createElement("div");
    backdrop.className = "moa-popup-backdrop";
    const box = document.createElement("div");
    box.className = "moa-popup";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", popup.title || "안내");

    const title = document.createElement("h3");
    title.textContent = popup.title || "";
    const body = document.createElement("p");
    body.textContent = popup.body || "";
    box.appendChild(title);
    box.appendChild(body);

    const btn = document.createElement(popup.buttonUrl ? "a" : "button");
    btn.className = "moa-popup-btn";
    btn.style.background = "#101f3c";
    btn.style.color = "#fff";
    if (popup.buttonUrl) {
      btn.href = popup.buttonUrl;
      if (popup.buttonUrl.indexOf("http") === 0) { btn.target = "_blank"; btn.rel = "noreferrer"; }
    } else {
      btn.type = "button";
    }
    btn.textContent = popup.buttonText || "확인";
    btn.addEventListener("click", () => backdrop.remove());
    box.appendChild(btn);

    const dismiss = document.createElement("div");
    dismiss.className = "moa-popup-dismiss";
    if (Number(popup.dismissDays) > 0) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${popup.dismissDays}일 동안 보지 않기`;
      b.addEventListener("click", () => { dismissPopup(id, Number(popup.dismissDays)); backdrop.remove(); });
      dismiss.appendChild(b);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "닫기";
    close.addEventListener("click", () => backdrop.remove());
    dismiss.appendChild(close);
    box.appendChild(dismiss);

    backdrop.appendChild(box);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
    return backdrop;
  }

  /* 탭 순서·노출: 컨테이너 안의 [data-tab] 요소를 설정대로 다시 배치한다. */
  function orderTabs(container, cfg) {
    if (!container || !cfg.navigation || !Array.isArray(cfg.navigation.tabs)) return;
    const items = Array.from(container.querySelectorAll("[data-tab]"));
    const map = new Map(cfg.navigation.tabs.map((t) => [t.id, t]));
    items.forEach((el) => {
      const conf = map.get(el.dataset.tab);
      if (!conf) return;
      el.classList.toggle("moa-hidden-by-config", !conf.visible);
      if (conf.label) {
        const labelTarget = el.querySelector(".nav-label") || el;
        // 아이콘 등 다른 자식이 있으면 라벨 노드만 바꾼다.
        if (el.children.length && el.querySelector(".nav-label")) labelTarget.textContent = conf.label;
        else if (!el.children.length) el.textContent = conf.label;
      }
    });
    const ordered = cfg.navigation.tabs
      .map((t) => items.find((el) => el.dataset.tab === t.id))
      .filter(Boolean);
    ordered.forEach((el) => container.appendChild(el));
  }

  function applyTexts(cfg, texts) {
    if (!texts) return;
    Object.keys(texts).forEach((selector) => {
      const value = texts[selector];
      if (value == null) return;
      const [sel, attr] = selector.split("@");
      const nodes = document.querySelectorAll(sel);
      nodes.forEach((node) => {
        node.textContent = String(value);
        if (attr) node.setAttribute(attr, String(value));
      });
    });
  }

  function apply(cfg, options) {
    const opts = options || {};
    mountBanner(cfg, opts);
    mountPopup(cfg);
    if (opts.tabContainer) orderTabs(opts.tabContainer, cfg);
    if (opts.texts) applyTexts(cfg, opts.texts);
    return cfg;
  }

  window.MoaSiteConfig = { load, apply, mountBanner, mountPopup, orderTabs, applyTexts };
})();
