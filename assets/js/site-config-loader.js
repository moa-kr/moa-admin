/* 모아 어드민 공통 사이트 설정 로더 v2
   ────────────────────────────────────────────────────────────────
   moa-kr/pokemoa · moa-kr/bokjinabi 에 실제로 들어가 있는 파일과 같은 내용입니다.
   모아 어드민이 커밋하는 site-config.json 을 읽어 공지 배너 · 팝업 · 탭 순서/노출 ·
   섹션 순서/노출 · 문구를 화면에 적용합니다.

   붙이는 방법 (HTML 의 </body> 앞, 사이트 스크립트 뒤)
     <script src="assets/js/site-config-loader.js?v=1" defer
             data-config="assets/config/site-config.json"
             data-tab-container=".main-nav"
             data-banner-host=".site-header"></script>

   - data-config       : 설정 JSON 경로(필수). 없으면 아무것도 하지 않습니다.
   - data-tab-container: 탭 요소를 담은 컨테이너(CSS 선택자). 기본 ".main-nav"
   - data-banner-host  : 공지 바를 넣을 요소(CSS 선택자). 기본 "header" → 없으면 body
   - data-section-root : 섹션을 찾을 범위(CSS 선택자). 기본 body

   화면에서 바꿀 수 있는 표시
   - 탭       : [data-tab] 또는 [data-nav] 요소 (id = data-tab/data-nav 값)
   - 섹션     : [data-section] 요소 (id = data-section 값)
   - 섹션 제목: 섹션 안의 [data-section-title] 요소 (없으면 그대로 둠)
   - 문구     : [data-copy="heroDescription"] (글자로) / [data-copy-html="heroTitle"] (일부 태그만 허용)

   SPA(회사복지모아)처럼 화면을 다시 그리는 사이트는 다시 그린 뒤
   document.dispatchEvent(new CustomEvent("moa:route-rendered")) 를 보내면
   섹션·문구를 그 화면 기준으로 다시 적용합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const VERSION = "2.0";
  const STYLE_ID = "moa-site-config-style";
  const DISMISS_PREFIX = "moa:popup:";
  const TAB_SELECTOR = "[data-tab],[data-nav]";
  const SECTION_SELECTOR = "[data-section]";
  const HIDDEN_CLASS = "moa-hidden-by-config";
  // 제목처럼 마크업이 필요한 자리에서만 허용하는 태그(나머지는 글자로 내린다).
  const SAFE_TAGS = { B: 1, STRONG: 1, EM: 1, I: 1, U: 1, SMALL: 1, BR: 1, SPAN: 1 };
  // 사이트의 강조 표시(예: 복지모아 .hl)를 살리기 위해 class 만 남긴다. 그 밖의 속성(style·on*)은 지운다.
  const SAFE_ATTRS = { class: 1, "aria-hidden": 1 };

  const STYLES = {
    info: { light: ["#eaf0ff", "#1b3a8f"], dark: ["#22345e", "#dbe7ff"] },
    warn: { light: ["#fff4e0", "#8a5300"], dark: ["#4a3a12", "#ffe6a8"] },
    urgent: { light: ["#fdecec", "#a01c22"], dark: ["#4a1620", "#ffd4d6"] }
  };

  const state = { path: "", config: null, options: null };

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
      .${HIDDEN_CLASS}{display:none !important}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.moaTheme = dark ? "dark" : "light";
  }

  function load(path) {
    const url = path + (path.indexOf("?") === -1 ? "?" : "&") + "_moa=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => (cfg && cfg.schemaVersion === 1 ? cfg : null))
      .catch(() => null);
  }

  /* ───────────── 공지 배너 ───────────── */
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

  /* ───────────── 첫 방문 팝업 ───────────── */
  function popupDismissed(id) {
    try {
      const raw = localStorage.getItem(DISMISS_PREFIX + id);
      if (!raw) return false;
      const until = Number(raw);
      if (!until) return true; // 0일 = 이번 방문에서만 닫기
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

  /* ───────────── 탭 · 섹션 순서/노출 ───────────── */
  function idOf(el, attr) {
    return el.getAttribute(attr) || "";
  }

  /* 설정의 order 순서대로, 같은 부모 안에서만 자리를 맞춘다(패널을 넘나들지 않는다).
     섹션 사이에 낀 광고·안내 요소는 건드리지 않도록 자리표시(주석)를 써서 맞바꾼다. */
  function placeInOrder(elements, list, idGetter) {
    if (!elements.length || !list.length) return;
    const conf = new Map(list.map((item) => [item.id, item]));
    const groups = new Map();
    elements.forEach((el) => {
      if (!el.parentNode) return;
      const key = el.parentNode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    groups.forEach((items) => {
      if (items.length < 2) return;
      const rank = (el) => {
        const item = conf.get(idGetter(el));
        const order = item ? Number(item.order) : NaN;
        return Number.isFinite(order) ? order : 999;
      };
      const sorted = items.slice().sort((a, b) => rank(a) - rank(b));
      const marks = items.map((el) => {
        const mark = document.createComment("moa-slot");
        el.parentNode.insertBefore(mark, el);
        el.remove();
        return mark;
      });
      sorted.forEach((el, index) => {
        const mark = marks[index];
        mark.parentNode.insertBefore(el, mark);
      });
      marks.forEach((mark) => mark.remove());
    });
  }

  function setLabel(el, label) {
    if (!label) return;
    const target = el.querySelector(".nav-label") || el.querySelector(".moa-label");
    if (target) { target.textContent = label; return; }
    // 아이콘 같은 자식 요소는 두고, 글자 노드만 바꾼다.
    let textNode = null;
    Array.prototype.forEach.call(el.childNodes, (node) => {
      if (node.nodeType === 3 && node.textContent.trim()) textNode = node;
    });
    if (textNode) { textNode.textContent = label; return; }
    if (!el.children.length) { el.textContent = label; return; }
    const span = document.createElement("span");
    span.className = "moa-label";
    span.textContent = label;
    el.appendChild(span);
  }

  function applyTabs(container, cfg) {
    if (!container || !cfg.navigation || !Array.isArray(cfg.navigation.tabs)) return;
    const items = Array.prototype.slice.call(container.querySelectorAll(TAB_SELECTOR));
    if (!items.length) return;
    const conf = new Map(cfg.navigation.tabs.map((tab) => [tab.id, tab]));
    const idOfTab = (el) => el.getAttribute("data-tab") || el.getAttribute("data-nav") || "";
    items.forEach((el) => {
      const tab = conf.get(idOfTab(el));
      if (!tab) return;
      el.classList.toggle(HIDDEN_CLASS, tab.visible === false);
      setLabel(el, tab.label);
      if (tab.visible === false) el.setAttribute("tabindex", "-1");
      else el.removeAttribute("tabindex");
    });
    placeInOrder(items, cfg.navigation.tabs, idOfTab);

    const visible = items.filter((el) => !el.classList.contains(HIDDEN_CLASS)).length;
    container.style.setProperty("--moa-tab-count", String(Math.max(1, visible)));

    // 지금 보고 있는 탭이 숨겨졌으면 첫 번째 보이는 탭으로 옮긴다.
    const active = items.find((el) => el.classList.contains("is-active") || el.classList.contains("active"));
    if (active && active.classList.contains(HIDDEN_CLASS)) {
      const first = items.find((el) => !el.classList.contains(HIDDEN_CLASS));
      if (first) first.click();
    }
  }

  function applySections(root, cfg) {
    const scope = root || document.body;
    if (!cfg.navigation || !Array.isArray(cfg.navigation.sections)) return;
    const items = Array.prototype.slice.call(scope.querySelectorAll(SECTION_SELECTOR));
    if (!items.length) return;
    const conf = new Map(cfg.navigation.sections.map((section) => [section.id, section]));
    items.forEach((el) => {
      const section = conf.get(idOf(el, "data-section"));
      if (!section) return;
      el.classList.toggle(HIDDEN_CLASS, section.visible === false);
      const title = el.querySelector("[data-section-title]");
      if (title && section.label) title.textContent = section.label;
    });
    placeInOrder(items, cfg.navigation.sections, (el) => el.getAttribute("data-section") || "");
  }

  /* ───────────── 문구 ───────────── */
  function copyValue(cfg, key) {
    if (!cfg.copy || !key) return null;
    const value = cfg.copy[key];
    return value == null ? null : String(value);
  }

  function sanitizeHtml(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value == null ? "" : value);
    (function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        if (!SAFE_TAGS[child.tagName]) {
          const text = document.createTextNode(child.textContent || "");
          child.parentNode.replaceChild(text, child);
          return;
        }
        Array.prototype.slice.call(child.attributes).forEach((attr) => {
          if (!SAFE_ATTRS[attr.name.toLowerCase()]) child.removeAttribute(attr.name);
        });
        clean(child);
      });
    })(holder);
    return holder.innerHTML;
  }

  function applyCopy(cfg, root) {
    const scope = root || document.body;
    Array.prototype.forEach.call(scope.querySelectorAll("[data-copy]"), (el) => {
      const value = copyValue(cfg, el.getAttribute("data-copy"));
      if (value == null) return;
      if (el.tagName === "META") el.setAttribute("content", value);
      else el.textContent = value;
    });
    Array.prototype.forEach.call(scope.querySelectorAll("[data-copy-html]"), (el) => {
      const value = copyValue(cfg, el.getAttribute("data-copy-html"));
      if (value == null) return;
      el.innerHTML = sanitizeHtml(value);
    });
  }

  function apply(cfg, options) {
    const opts = options || {};
    if (!cfg) return null;
    state.config = cfg;
    state.options = opts;
    mountBanner(cfg, opts);
    mountPopup(cfg);
    if (opts.tabContainer) applyTabs(opts.tabContainer, cfg);
    applySections(opts.sectionRoot || document.body, cfg);
    applyCopy(cfg, opts.copyRoot || document.body);
    return cfg;
  }

  /* 화면을 다시 그린 사이트가 부르면 배너·팝업은 그대로 두고 섹션·탭·문구만 다시 맞춘다. */
  function refresh() {
    const cfg = state.config;
    if (!cfg) return null;
    const opts = state.options || {};
    if (opts.tabContainer) applyTabs(opts.tabContainer, cfg);
    applySections(opts.sectionRoot || document.body, cfg);
    applyCopy(cfg, opts.copyRoot || document.body);
    return cfg;
  }

  /* ───────────── 자동 연결 ───────────── */
  function selfScript() {
    if (document.currentScript) return document.currentScript;
    const list = Array.prototype.slice.call(document.scripts).filter((s) => /site-config-loader\.js/.test(s.src || ""));
    return list.length ? list[list.length - 1] : null;
  }

  function autoInit() {
    const script = selfScript();
    if (!script) return;
    const path = script.getAttribute("data-config");
    if (!path) return;
    const options = {
      host: document.querySelector(script.getAttribute("data-banner-host") || ".site-header") ||
        document.querySelector("header") || document.body,
      place: "afterbegin",
      tabContainer: document.querySelector(script.getAttribute("data-tab-container") || ".main-nav")
    };
    state.path = path;
    state.options = options;
    load(path).then((cfg) => {
      if (!cfg) return;
      apply(cfg, options);
      document.dispatchEvent(new CustomEvent("moa:site-config-applied", { detail: cfg }));
    });
  }

  document.addEventListener("moa:route-rendered", () => { refresh(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();

  window.MoaSiteConfig = {
    version: VERSION,
    load,
    apply,
    refresh,
    mountBanner,
    mountPopup,
    applyTabs,
    applySections,
    applyCopy,
    orderTabs: applyTabs,
    state
  };
  Object.defineProperty(window.MoaSiteConfig, "config", { get: () => state.config });
})();
