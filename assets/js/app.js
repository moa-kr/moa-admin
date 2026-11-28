/* 모아 어드민 — 로그인·설정 편집·미리보기·GitHub 커밋·문의 관리
   의존성 없이 도는 단일 스크립트입니다. */
(function () {
  "use strict";

  const SITES = window.MOA_SITES;
  const API_BASE = window.MOA_ADMIN_API;
  const GH = "https://api.github.com";
  const LS = {
    session: "moa-admin.session",
    draft: "moa-admin.draft.",
    log: "moa-admin.log",
    ui: "moa-admin.ui",
    // 📊 통계 카드 순서(2026-11-26 v=54) — 이 브라우저에만 남는 보기 설정
    statsOrder: "moa-admin.stats.order",
    // 📊 통계에서 숨긴 카드(2026-11-28 v=65) — 예: ["social"]
    statsHidden: "moa-admin.stats.hidden"
  };
  const REMEMBER_DAYS = 90;
  /* 「페이지·탭별 체류시간」은 한 번에 5개씩 — 더보기·접기의 단위(2026-11-26 v=56). */
  const STATS_PAGES_STEP = 5;
  /* 화면·자산 버전 — index.html 의 ?v= 와 같게 맞춘다. 빌드 배지에 보여 캐시 여부를 바로 알 수 있게 한다. */
  const BUILD = "v=71";
  /* 개인 재무(여조원 님 전용) — 로그인한 운영자에게만 헤더 오른쪽 ‘💰 개인 재무’ 버튼으로 연다(v=52: 사이트별 탭 정리로 탭 줄에서는 빠짐).
     자료는 공개 정적 파일이 아니라 복지모아 서버(/api/admin/personal-finance)에만 있고,
     로그인 토큰이 있어야 읽고 쓸 수 있다. finance.js 가 표·저장을 맡는다. */
  const FINANCE_TAB = "finance";
  /* 실제 미리보기(iframe)를 띄울 사이트별 출처 — postMessage 대상·허용 검사에 쓴다. */
  const PREVIEW_ORIGIN = {
    pokemoa: "https://moa-kr.github.io",
    bokjimoa: "https://bokjimoa.onrender.com"
  };
  const PREVIEW_READY_MS = 12000;   // 이만큼 응답이 없으면 ‘느림 + 재시도’ 안내
  const PREVIEW_FAIL_MS = 28000;    // 이만큼이면 임베드 거부로 보고 오류 안내

  /* 화면이 멈췄을 때 원인을 볼 수 있도록 스크립트 오류를 모아 둔다(운영 점검용). */
  window.__moaAdminErrors = window.__moaAdminErrors || [];
  window.addEventListener("error", (event) => {
    window.__moaAdminErrors.push(String(event.message || "script error"));
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    window.__moaAdminErrors.push(`unhandledrejection: ${String((reason && reason.message) || reason)}`);
  });


  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ───────────── 공통 유틸 ───────────── */
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* 사이트와 같은 규칙으로 제목 마크업(<br>·<em>·<span class="hl"> 등)만 남긴다. */
  const PREVIEW_TAGS = { B: 1, STRONG: 1, EM: 1, I: 1, U: 1, SMALL: 1, BR: 1, SPAN: 1 };
  const PREVIEW_ATTRS = { class: 1, "aria-hidden": 1 };

  /* 탭·섹션 이름은 사이트의 내비게이션 글자/섹션 머리글이 된다. 스키마와 같은 길이 제한을 쓴다. */
  const LABEL_LIMIT = { tabs: 20, sections: 30 };
  /* 탭 안 섹션 정의(sites.js)를 id 로 찾아 쓴다. */
  function sectionMetas(siteId) {
    const site = SITES[siteId || state.site] || SITES[state.site];
    return (site && site.sections) || [];
  }
  function metaOf(id, siteId) {
    return sectionMetas(siteId).find((section) => section.id === id) || null;
  }
  /* 이 섹션이 들어 있는 탭 id — 설정값 → 사이트 기본값 → 첫 탭 순으로 정한다. */
  function sectionTabOf(section, siteId) {
    if (section && section.tab) return section.tab;
    const meta = section && metaOf(section.id, siteId);
    if (meta && meta.tab) return meta.tab;
    const tabs = sortedByOrder(config().navigation.tabs);
    return tabs.length ? tabs[0].id : "";
  }
  /* 섹션 제목이 어디서 오는지 — copy 키(titleKey) 또는 navigation 의 label. */
  function sectionTitleInfo(section) {
    const meta = metaOf(section.id);
    if (meta && meta.titleKey) {
      return { kind: "copy", key: meta.titleKey, value: String(getPath(config(), `copy.${meta.titleKey}`) == null ? "" : getPath(config(), `copy.${meta.titleKey}`)) };
    }
    return { kind: "label", key: "", value: section.label || "" };
  }
  /* 문구 정의(라벨·형식·길이) — ② 섹션 편집과 미리보기가 함께 쓴다. */
  function copyFieldOf(key) {
    const fieldMap = current().fields;
    if (fieldMap && fieldMap[key]) {
      const def = fieldMap[key];
      return { key, label: def[0], kind: def[1], max: def[2] };
    }
    let found = null;
    (current().copyGroups || []).forEach((group) => {
      (group.fields || []).forEach((field) => { if (field.key === key) found = field; });
    });
    return found || { key, label: key, kind: "text", max: 120 };
  }
  /* 섹션 편집기에서 ‘대표 문구’(제목·표제·설명·링크)로 묶을 키인지. */
  function isPrimaryKey(key, titleKey) {
    if (key === titleKey) return true;
    return /(Eyebrow|Title|Desc|Description|Lead|Link|Cta|Tag)$/.test(key);
  }
  function safeHtml(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value == null ? "" : value);
    (function clean(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        if (!PREVIEW_TAGS[child.tagName]) {
          child.parentNode.replaceChild(document.createTextNode(child.textContent || ""), child);
          return;
        }
        Array.from(child.attributes).forEach((attr) => {
          if (!PREVIEW_ATTRS[attr.name.toLowerCase()]) child.removeAttribute(attr.name);
        });
        clean(child);
      });
    })(holder);
    return holder.innerHTML;
  }
  function getPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }
  function debounce(fn, ms) {
    let t = 0;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function nowTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function sortedByOrder(list) {
    return list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function renumber(list) {
    list.forEach((item, i) => { item.order = i + 1; });
    return list;
  }

  let toastTimer = 0;
  function toast(message, isError) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 5200 : 2600);
  }

  /* ───────────── 상태 ───────────── */
  const state = {
    session: null,                 // {token, key, mode, login, avatar, repos, remember}
    site: "pokemoa",
    tab: "notice",
    configs: { pokemoa: clone(SITES.pokemoa.defaults), bokjimoa: clone(SITES.bokjimoa.defaults) },
    dirty: { pokemoa: false, bokjimoa: false },
    source: { pokemoa: "기본값", bokjimoa: "기본값" },
    // ② ‘탭 안 섹션’에서 지금 고치고 있는 탭과, 펼쳐 둔 섹션 편집기
    sectionTab: { pokemoa: "home", bokjimoa: "home" },
    openSections: {},
    // ③ 문구 화면에서 펼쳐 둔 묶음(기본은 모두 접힘)
    copyOpen: {},
    previewPopup: true,
    // 오른쪽 실제 미리보기(iframe) 상태
    preview: { site: "", ready: false, appliedAt: 0, slowTimer: 0, failTimer: 0 },
    inquiries: { loading: false, error: "", list: [], byStatus: null, total: 0, operatorEmail: "", loadedAt: "" },
    // 👥 가입자·글 — 복지모아 서버의 가입자 목록과 사용자 작성 글·팁
    people: { loading: false, error: "", users: null, subs: null, filter: "", selected: [], loadedAt: "" },
    // 🧾 회원가입 시도 로그 — 회사명·@도메인·결과·사유·시각(이메일 원문 없음)
    attempts: { loading: false, error: "", data: null, filter: "", loadedAt: "" },
    // 🔌 태블릿 중계 서버 상태 — 마지막으로 본 /health 결과
    relay: { online: false, version: "", at: 0 },
    // 📊 방문 통계 — 사이트 필터·기간별로 서버에서 집계해 온다. dailyDays 는 ‘일별 트렌드’의 기간(14/30/90).
    stats: { site: "all", days: 7, dailyDays: 30, loading: false, error: "", data: null, loadedAt: "", trend: "monthly", pagesVisible: STATS_PAGES_STEP },
    // 📱 인스타 · 네이버 블로그 성장 트렌드 — 두 사이트 공통 채널이라 사이트 필터가 없다.
    social: { days: 30, mode: "daily", loading: false, error: "", data: null, loadedAt: "", saving: false, autoTried: false,
      live: { loading: false, data: null, error: "", fetchedAt: "", savingToken: false, queuedRefresh: false } },
    log: []
  };

  const current = () => SITES[state.site];
  const config = () => state.configs[state.site];

  /* ───────────── 세션 저장 ───────────── */
  function loadSession() {
    let raw = null;
    let storage = null;
    try {
      raw = localStorage.getItem(LS.session);
      if (raw) storage = localStorage;
      if (!raw) { raw = sessionStorage.getItem(LS.session); if (raw) storage = sessionStorage; }
    } catch (err) { return null; }
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (err) { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) {
      try { storage.removeItem(LS.session); } catch (err) { /* 무시 */ }
      return null;
    }
    return parsed;
  }

  function saveSession(session) {
    const payload = clone(session);
    if (session.remember) {
      payload.expiresAt = new Date(Date.now() + REMEMBER_DAYS * 24 * 3600 * 1000).toISOString();
    } else {
      delete payload.expiresAt;
    }
    const text = JSON.stringify(payload);
    try {
      if (session.remember) {
        localStorage.setItem(LS.session, text);
        sessionStorage.removeItem(LS.session);
      } else {
        sessionStorage.setItem(LS.session, text);
        localStorage.removeItem(LS.session);
      }
    } catch (err) { /* 저장 실패는 치명적이지 않음 */ }
    return payload;
  }

  function clearSession() {
    try {
      localStorage.removeItem(LS.session);
      sessionStorage.removeItem(LS.session);
    } catch (err) { /* 무시 */ }
  }

  /* 마지막으로 보던 사이트·탭을 기억한다(새로고침해도 그 자리로). */
  function saveUi() {
    try {
      sessionStorage.setItem(LS.ui, JSON.stringify({ site: state.site, tab: state.tab, sectionTab: state.sectionTab }));
    } catch (err) { /* 저장소를 못 쓰면 무시 */ }
  }
  function restoreUi() {
    try {
      const raw = sessionStorage.getItem(LS.ui);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && SITES[parsed.site]) state.site = parsed.site;
      if (parsed && parsed.tab) state.tab = parsed.tab;
      if (parsed && parsed.sectionTab && typeof parsed.sectionTab === "object") {
        Object.keys(state.sectionTab).forEach((id) => {
          if (typeof parsed.sectionTab[id] === "string") state.sectionTab[id] = parsed.sectionTab[id];
        });
      }
    } catch (err) { /* 무시 */ }
  }

  /* ───────────── 초안(draft) ───────────── */
  const persistDraft = debounce(() => {
    try {
      localStorage.setItem(LS.draft + state.site, JSON.stringify({
        savedAt: new Date().toISOString(),
        config: state.configs[state.site]
      }));
    } catch (err) { /* 용량 초과 등은 무시 */ }
  }, 500);

  function loadDraft(siteId) {
    try {
      const raw = localStorage.getItem(LS.draft + siteId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.config) return null;
      return parsed;
    } catch (err) { return null; }
  }
  function clearDraft(siteId) {
    try { localStorage.removeItem(LS.draft + siteId); } catch (err) { /* 무시 */ }
  }

  /* ───────────── GitHub API ───────────── */
  async function ghRequest(path, options) {
    const opts = Object.assign({ method: "GET" }, options || {});
    const headers = Object.assign({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }, opts.headers || {});
    if (state.session && state.session.token) headers.Authorization = `Bearer ${state.session.token}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(`${GH}${path}`, { method: opts.method, headers, body: opts.body, cache: "no-store" });
    } catch (err) {
      return { ok: false, status: 0, error: "네트워크 오류로 GitHub에 연결하지 못했습니다.", data: null };
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (err) { data = text; } }
    if (!res.ok) {
      const message = (data && data.message) || `GitHub 오류 (HTTP ${res.status})`;
      return { ok: false, status: res.status, error: message, data };
    }
    return { ok: true, status: res.status, data };
  }

  async function verifyToken(token) {
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    let res;
    try {
      res = await fetch(`${GH}/user`, { headers, cache: "no-store" });
    } catch (err) {
      return { ok: false, error: "네트워크 오류로 GitHub에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요." };
    }
    if (res.status === 401) return { ok: false, error: "토큰이 올바르지 않습니다. 값을 다시 확인해 주세요." };
    if (res.status === 403) return { ok: false, error: "GitHub가 이 요청을 막았습니다(403). 토큰 권한을 확인해 주세요." };
    if (!res.ok) return { ok: false, error: `GitHub가 ${res.status} 응답을 보냈습니다.` };
    const user = await res.json();

    const repos = {};
    for (const id of Object.keys(SITES)) {
      const site = SITES[id];
      let repoRes;
      try {
        repoRes = await fetch(`${GH}/repos/${site.repo}`, { headers, cache: "no-store" });
      } catch (err) {
        repos[id] = false;
        continue;
      }
      if (!repoRes.ok) { repos[id] = false; continue; }
      const repo = await repoRes.json();
      repos[id] = Boolean(repo.permissions && repo.permissions.push);
    }

    return {
      ok: true,
      user: { login: user.login, name: user.name || "", avatar: user.avatar_url || "" },
      repos
    };
  }

  /* ───────────── 모아 어드민 서버(아이디·비번 로그인) ─────────────
     로그인은 bokjimoa.onrender.com 이 대조하고 HMAC 서명 토큰만 돌려준다. 토큰·브라우저
     관리자 키로 /api/admin/* 를 부르므로, GitHub 토큰(PAT)은 예비 경로로만 남긴다. */
  function apiHeaders(extra) {
    const session = state.session || {};
    const headers = Object.assign({}, extra || {});
    if (session.mode === "idpw" && session.token) headers.Authorization = `Bearer ${session.token}`;
    else if (session.key) headers["x-sync-key"] = session.key;
    return headers;
  }

  async function apiRequest(path, options) {
    const opts = options || {};
    const headers = apiHeaders(opts.json ? { "Content-Type": "application/json" } : null);
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: opts.method || "GET",
        headers,
        body: opts.body,
        cache: "no-store",
        keepalive: Boolean(opts.keepalive)
      });
    } catch (err) {
      return { ok: false, status: 0, error: "복지모아 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", data: null };
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (err) { data = null; } }
    if (!res.ok || (data && data.ok === false)) {
      const error = (data && data.error) || `서버 오류 (HTTP ${res.status})`;
      if (res.status === 401 || res.status === 403) sessionExpired(error);
      return { ok: false, status: res.status, error, data };
    }
    return { ok: true, status: res.status, data };
  }

  /* 토큰이 만료·위조됐을 때: 조용히 게이트로 돌려보내고 이유를 알려준다. */
  function sessionExpired(message) {
    const session = state.session || {};
    if (session.mode !== "idpw") return;
    if (window.MOA_FINANCE) window.MOA_FINANCE.clear();
    clearSession();
    state.session = null;
    showGate();
    gateError(message || "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }

  async function loginWithIdPw(username, password, remember) {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
        cache: "no-store"
      });
    } catch (err) {
      return { ok: false, error: "복지모아 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요." };
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (err) { data = null; } }
    if (res.status === 503) {
      return { ok: false, error: "서버에 아이디·비번 로그인 설정(ADMIN_LOGIN_ID·ADMIN_LOGIN_PW)이 아직 없습니다. 아래 ‘고급: GitHub 토큰으로 직접 로그인’을 써 주세요." };
    }
    if (!res.ok || !data || data.ok === false) {
      return { ok: false, error: (data && data.error) || `로그인하지 못했습니다 (HTTP ${res.status}).` };
    }
    return { ok: true, data };
  }

  /* ───────────── 로그인 게이트 ───────────── */
  function showGate() {
    $("#gate").hidden = false;
    $("#app").hidden = true;
    setTimeout(() => { const el = $("#gate-id"); if (el) el.focus(); }, 30);
  }

  function gateError(message) {
    const el = $("#gate-error");
    if (!message) { el.hidden = true; el.textContent = ""; return; }
    el.textContent = message;
    el.hidden = false;
  }

  /* 1순위: 아이디·비밀번호 로그인(서버 토큰). */
  async function handleGateSubmit(event) {
    event.preventDefault();
    gateError("");
    const username = $("#gate-id").value.trim();
    const password = $("#gate-pw").value;
    const remember = $("#gate-remember").checked;
    if (!username || !password) {
      gateError("아이디와 비밀번호를 모두 넣어 주세요. 화면만 둘러보려면 ‘데모 모드’를 누르세요.");
      return;
    }

    const submit = $("#gate-submit");
    submit.disabled = true;
    submit.textContent = "로그인하는 중…";
    try {
      const result = await loginWithIdPw(username, password, remember);
      if (!result.ok) { gateError(result.error); return; }
      const data = result.data || {};
      const session = {
        mode: "idpw",
        token: data.token || "",
        key: "",
        remember,
        login: (data.user && data.user.login) || username,
        avatar: "",
        repos: { pokemoa: true, bokjimoa: true },
        serverExpiresAt: data.expiresAt || ""
      };
      state.session = saveSession(session);
      $("#gate-pw").value = "";
      addLog(`${session.login} 아이디 로그인`);
      await startApp(true);
    } finally {
      submit.disabled = false;
      submit.textContent = "로그인";
    }
  }

  /* 예비 경로: GitHub PAT(또는 관리자 키만)로 로그인. */
  async function handleTokenGateSubmit(event) {
    event.preventDefault();
    gateError("");
    const token = $("#gate-token").value.trim();
    const key = $("#gate-key").value.trim();
    const remember = $("#gate-remember").checked;
    if (!token && !key) {
      gateError("GitHub 토큰이나 관리자 키 중 하나는 넣어 주세요.");
      return;
    }

    const submit = $("#gate-token-submit");
    submit.disabled = true;
    submit.textContent = "확인하는 중…";
    try {
      let user = null;
      let repos = { pokemoa: false, bokjimoa: false };
      if (token) {
        const check = await verifyToken(token);
        if (!check.ok) { gateError(check.error); return; }
        user = check.user;
        repos = check.repos;
      }
      const session = {
        mode: token ? "live" : "key",
        token: token || "",
        key: key || "",
        remember,
        login: user ? user.login : "",
        avatar: user ? user.avatar : "",
        repos
      };
      state.session = saveSession(session);
      addLog(token ? `GitHub @${user.login} 로그인` : "관리자 키만으로 로그인");
      await startApp(!token || (repos.pokemoa || repos.bokjimoa));
    } finally {
      submit.disabled = false;
      submit.textContent = "토큰으로 로그인";
    }
  }

  function handleDemo(event) {
    if (event) event.preventDefault();
    state.session = saveSession({ mode: "demo", token: "", key: "", remember: true, login: "", avatar: "", repos: { pokemoa: false, bokjimoa: false } });
    addLog("데모 모드 시작");
    startApp(true);
  }

  async function logout() {
    if (isDirty()) {
      const ok = window.confirm("저장하지 않은 변경이 있습니다. 그래도 로그아웃할까요?");
      if (!ok) return;
    }
    if (window.MOA_FINANCE) window.MOA_FINANCE.clear();
    clearSession();
    state.session = null;
    // 다시 불러오기 전에 잠금 화면 상태로 되돌려 둔다(개인 재무 탭·버튼이 남지 않도록).
    updateSessionUi();
    location.reload();
  }

  /* ───────────── 앱 시작 ───────────── */
  async function startApp(allowPrefetch) {
    $("#gate").hidden = true;
    $("#app").hidden = false;

    // 초안이 있으면 복원한다.
    Object.keys(SITES).forEach((id) => {
      const draft = loadDraft(id);
      if (draft) {
        state.configs[id] = draft.config;
        state.dirty[id] = true;
        state.source[id] = `초안 (${fmtDateTime(draft.savedAt)})`;
      }
    });

    updateSessionUi();
    bindUi();
    renderAll();
    // 개인 재무 표는 로그인한 뒤에만 의미가 있다. 모듈을 한 번 붙이고, 그 탭으로 열렸거나
    // 로그인 직후라면 서버 자료를 바로 불러온다(finance.js 가 인증 헤더를 붙여 부른다).
    if (window.MOA_FINANCE) {
      window.MOA_FINANCE.init({ request: (path, opts) => apiRequest(path, opts) });
      if (signedIn() && state.tab === FINANCE_TAB) window.MOA_FINANCE.enter();
      if (!signedIn()) window.MOA_FINANCE.clear();
    }
    // ‘⑤ 저장·배포’로 열렸으면 태블릿 중계 서버 버전을 먼저 조용히 확인한다
    // (복지모아 설정 불러오기를 기다리지 않도록 pullConfig 앞에서 부른다).
    if (state.tab === "deploy" && state.site === "pokemoa") checkRelay(true);

    if ((state.session.mode === "live" || state.session.mode === "idpw") && allowPrefetch) {
      await pullConfig(state.site, true);
    }
    if (Object.keys(SITES).some((id) => state.dirty[id])) {
      toast("저장하지 않은 편집 내용을 불러왔습니다.");
    }
    // 마지막으로 보던 탭이 ‘📊 통계’·‘👥 가입자·글’이면 바로 자료를 불러온다(빈 화면으로 열리지 않도록).
    if (state.tab === "stats") { loadStats(); loadSocialStats(); loadSocialLive(); }
    if (state.tab === "people" && state.site === "bokjimoa") loadPeople();
  }

  function updateSessionUi() {
    const session = state.session || {};
    const chip = $("#mode-chip");
    chip.textContent = session.mode === "idpw" ? "아이디 로그인" : session.mode === "live" ? "실서버 연결" : session.mode === "key" ? "관리자 키 모드" : "데모 모드";
    chip.classList.toggle("live", session.mode === "live" || session.mode === "idpw");

    const userChip = $("#user-chip");
    if (session.login) {
      userChip.innerHTML = `${session.avatar ? `<img src="${esc(session.avatar)}" alt="">` : ""}<span>${session.mode === "idpw" ? esc(session.login) : `@${esc(session.login)}`}</span>`;
      userChip.hidden = false;
    } else {
      userChip.hidden = true;
    }

    // 개인 재무 탭·바로가기는 실제 로그인(아이디·GitHub 토큰·관리자 키)에서만 보인다. 데모 모드에서는 숨김.
    const authed = signedIn();
    $$('[data-auth-only]').forEach((el) => { el.hidden = !authed; });
    if (!authed && state.tab === FINANCE_TAB) {
      state.tab = "notice";
      applyTab();
    }
    if (!authed && window.MOA_FINANCE) window.MOA_FINANCE.clear();
    renderChecks();
  }

  function signedIn() {
    const mode = (state.session || {}).mode;
    return mode === "idpw" || mode === "live" || mode === "key";
  }

  function isDirty() { return Object.keys(SITES).some((id) => state.dirty[id]); }

  function markDirty(silent) {
    state.dirty[state.site] = true;
    const chip = $("#dirty-chip");
    if (chip) chip.hidden = false;
    persistDraft();
    if (!silent) schedulePreview();
  }

  function clearDirty(siteId) {
    state.dirty[siteId] = false;
    clearDraft(siteId);
    if (!isDirty()) { const chip = $("#dirty-chip"); if (chip) chip.hidden = true; }
  }

  /* ───────────── 탭/사이트 전환 ───────────── */
  function setSite(siteId) {
    if (!SITES[siteId]) return;
    const previous = state.site;
    state.site = siteId;
    $$(".site-btn").forEach((btn) => {
      const on = btn.dataset.site === siteId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const inquiryTab = $('.tab[data-tab="inquiry"]');
    if (inquiryTab) inquiryTab.hidden = siteId !== "bokjimoa";
    // 사이트를 바꿨을 때 그 사이트에 없는 탭에 남아 있으면 ① 공지·팝업으로 돌린다(v=52).
    //  · 포케모아: 👥 가입자·글 · 💰 개인 재무 → ① 공지·팝업
    //  · 복지모아: 💰 개인 재무 → ① 공지·팝업 (④ 문의 · 👥 가입자·글은 그대로)
    if (state.tab === FINANCE_TAB || !tabAllowedForSite(state.tab, siteId)) state.tab = "notice";
    saveUi();
    applyTab();
    renderAll();
    // 사이트를 바큘 때도 그 사이트의 저장된 설정을 먼저 읽는다(기본값으로 덮어쓰지 않도록).
    if (siteId !== previous && !state.dirty[siteId] && state.session &&
        (state.session.mode === "idpw" || state.session.mode === "live")) {
      pullConfig(siteId, true).then(() => {
        // 복지모아 서버(Render)가 잠들어 첫 요청이 실패할 수 있다 — 한 번만 다시 시도한다.
        if (state.site !== siteId || state.dirty[siteId]) return;
        if (String(state.source[siteId]).indexOf("불러오기 실패") !== 0) return;
        setTimeout(() => {
          if (state.site === siteId && !state.dirty[siteId]) pullConfig(siteId, true);
        }, 2500);
      });
    }
  }

  /* 탭 줄 노출 규칙(v=52) — 사이트마다 뜻이 있는 탭만 남긴다.
     · 👥 가입자·글 : 복지모아 서버의 가입자·글 자료라 회사복지모아에서만 보인다.
     · 💰 개인 재무 : 사이트 설정이 아니라 운영자 개인 자료라 탭 줄에서는 늘 감추고,
                     헤더 오른쪽 「💰 개인 재무」 버튼(#btn-finance)으로만 연다.
     다른 곳(updateSessionUi 의 data-auth-only · renderAll 의 data-only-site)이 hidden 을 풀어도
     마지막에 이 함수가 다시 정리한다. */
  function syncTabs() {
    const peopleTab = $('.tab[data-tab="people"]');
    if (peopleTab) peopleTab.hidden = state.site !== "bokjimoa";
    const financeTab = $('.tab[data-tab="finance"]');
    if (financeTab) financeTab.hidden = true;
  }

  /* 그 사이트에서 뜻이 있는 탭인가 — 사이트를 바꿨을 때 남아 있으면 ① 공지·팝업으로 돌린다. */
  function tabAllowedForSite(tab, siteId) {
    if (tab === "people" || tab === "inquiry") return siteId === "bokjimoa";
    return true;
  }

  function applyTab() {
    if (state.tab === "inquiry" && state.site !== "bokjimoa") state.tab = "notice";
    if (state.tab === "people" && state.site !== "bokjimoa") state.tab = "notice";
    if (state.tab === FINANCE_TAB && !signedIn()) state.tab = "notice";
    syncTabs();
    // 💰 개인 재무 모드는 어느 사이트 화면도 아니다 — 두 사이트 pill 을 모두 해제하고
    //    헤더의 「💰 개인 재무」 버튼을 눌린 모양(.is-on)으로 남겨 지금 보는 화면을 알린다.
    const financeMode = state.tab === FINANCE_TAB;
    $$(".site-btn").forEach((btn) => {
      const on = !financeMode && btn.dataset.site === state.site;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const siteSwitch = $(".site-switch");
    if (siteSwitch) siteSwitch.classList.toggle("is-finance", financeMode);
    const financeBtn = $("#btn-finance");
    if (financeBtn) {
      financeBtn.classList.toggle("is-on", financeMode);
      financeBtn.setAttribute("aria-pressed", financeMode ? "true" : "false");
    }
    $$(".tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === state.tab));
    $$(".panel").forEach((panel) => { panel.hidden = panel.dataset.panel !== state.tab; });
    // 개인 재무 표는 넓게 쓴다(모바일 미리보기 레일을 접는다).
    const layout = $(".layout");
    if (layout) layout.classList.toggle("is-wide", state.tab === FINANCE_TAB);
    // 위쪽 오른쪽 저장 버튼 — 💰 개인 재무 탭에서는 개인 표를 저장하는 버튼이므로 문구를 ‘저장’으로 바꾼다.
    // 다른 탭(공지·문구·⑤ 저장·배포 등)의 ‘저장 및 사이트 반영’은 그대로 둔다.
    const saveTop = $("#btn-save-top");
    if (saveTop) {
      const onFinance = state.tab === FINANCE_TAB;
      saveTop.textContent = onFinance ? "저장" : "저장 및 사이트 반영";
      saveTop.title = onFinance ? "개인 재무 표를 지금 서버(클라우드)에 저장합니다." : "";
    }
  }

  function setTab(tabId) {
    if (tabId === FINANCE_TAB && !signedIn()) tabId = "notice";
    // 👥 가입자·글은 복지모아 자료다 — 포케모아에서는 숨겨 둔 탭이라 열지 않는다.
    if (tabId === "people" && state.site !== "bokjimoa") tabId = "notice";
    state.tab = tabId;
    saveUi();
    applyTab();
    if (tabId === FINANCE_TAB && window.MOA_FINANCE) window.MOA_FINANCE.enter();
    if (tabId === "inquiry") renderInquiries();
    if (tabId === "stats") { loadStats(); loadSocialStats(); loadSocialLive(); }
    if (tabId === "people") loadPeople();
    if (tabId === "deploy") {
      renderRelayCard();
      if (state.site === "pokemoa") checkRelay(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ───────────── 입력 바인딩 ───────────── */
  /* 로그인 게이트는 앱이 뜨기 전에 먼저 붙여야 한다(로그인 전 화면이라 bindUi 보다 앞선다). */
  function bindGate() {
    const form = $("#gate-form");
    if (form) form.addEventListener("submit", handleGateSubmit);
    const tokenForm = $("#gate-token-form");
    if (tokenForm) tokenForm.addEventListener("submit", handleTokenGateSubmit);
    const demo = $("#gate-demo");
    if (demo) demo.addEventListener("click", handleDemo);
  }

  function bindUi() {
    // data-bind 입력 → 설정값
    const applyValue = (el) => {
      const path = el.dataset.bind;
      if (!path) return;
      let value;
      if (el.type === "checkbox") value = el.checked;
      else if (el.type === "number") value = el.value === "" ? 0 : Number(el.value);
      else value = el.value;
      setPath(config(), path, value);
      markDirty(true);
      updateDerived();
      syncSectionInput(path);
      schedulePreview();
    };
    document.addEventListener("input", (event) => {
      const el = event.target.closest("[data-bind]");
      if (el) applyValue(el);
    });
    document.addEventListener("change", (event) => {
      const el = event.target.closest("[data-bind]");
      if (el) applyValue(el);
    });

    // 사이트 전환
    $$(".site-btn").forEach((btn) => btn.addEventListener("click", () => setSite(btn.dataset.site)));
    // 탭 전환
    $$(".tab").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));
    // 헤더의 ‘💰 개인 재무’ 버튼은 같은 화면 안의 개인 재무 탭을 연다(새 탭·외부 주소 아님).
    const financeBtn = $("#btn-finance");
    if (financeBtn) {
      financeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        if (!signedIn()) { gateError("개인 재무는 로그인한 뒤에 열립니다."); return; }
        setTab(FINANCE_TAB);
      });
    }

    // 포케모아 팝업 버튼 동작(재고 찾기 · 탭 열기 · 링크 열기 · 닫기만)
    const figureAction = $("#figure-popup-action");
    if (figureAction) {
      figureAction.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-figure-action]");
        if (!btn) return;
        if (!config().figurePopup) config().figurePopup = {};
        config().figurePopup.buttonAction = btn.dataset.figureAction;
        markDirty(true);
        updateDerived();
        schedulePreview();
      });
    }

    // 배너 스타일
    const styleBox = $("#banner-style");
    styleBox.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-style]");
      if (!btn) return;
      config().banner.style = btn.dataset.style;
      markDirty(true);
      updateDerived();
      schedulePreview();
    });

    // 방문 통계 — 사이트·기간 필터
    const statsSite = $("#stats-site");
    if (statsSite) statsSite.addEventListener("change", () => {
      state.stats.site = statsSite.value;
      loadStats();
    });
    const statsPeriod = $("#stats-period");
    if (statsPeriod) statsPeriod.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-days]");
      if (!btn) return;
      state.stats.days = Number(btn.dataset.days) || 7;
      $$("button[data-days]", statsPeriod).forEach((b) => b.classList.toggle("is-active", b === btn));
      loadStats();
    });
    const statsRefresh = $("#stats-refresh");
    if (statsRefresh) statsRefresh.addEventListener("click", loadStats);
    // 「페이지·탭별 체류시간」 더보기(+5) / 접기(5개만) — 다시 부를 때(loadStats)와 달리 그 자리에서만 다시 그린다.
    const statsPagesToggle = $("#stats-pages-toggle");
    if (statsPagesToggle) statsPagesToggle.addEventListener("click", () => {
      const pages = state.stats.data && Array.isArray(state.stats.data.pages) ? state.stats.data.pages : [];
      const total = pages.length;
      if (!total) return;
      const shown = statsPagesShown(total);
      state.stats.pagesVisible = shown >= total ? STATS_PAGES_STEP : Math.min(total, shown + STATS_PAGES_STEP);
      renderStatsPages();
    });
    // 📊 통계 카드 순서 — ↑ / ↓ 버튼을 붙이고 이 브라우저에 저장된 순서를 되살린다.
    initStatsOrder();
    // 일별/월별/연도별 트렌드 전환 — 일별은 응답에 실려 오고, 기간(14/30/90)을 바꿀 때만 다시 부른다.
    const statsTrendMode = $("#stats-trend-mode");
    if (statsTrendMode) statsTrendMode.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-trend]");
      if (!btn) return;
      const wanted = btn.dataset.trend;
      state.stats.trend = wanted === "yearly" ? "yearly" : wanted === "daily" ? "daily" : "monthly";
      syncStatsControls();
      renderStatsTrend();
    });
    const statsDailyRange = $("#stats-daily-range");
    if (statsDailyRange) statsDailyRange.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-daily]");
      if (!btn) return;
      const days = Number(btn.dataset.daily) || 30;
      if (days === Number(state.stats.dailyDays)) return;
      state.stats.dailyDays = days;
      syncStatsControls();
      loadStats();
    });

    // 📱 인스타 · 네이버 블로그 성장 트렌드 — 기간·단위 전환, 새로고침, 빠른 입력(저장)
    const socialPeriod = $("#social-period");
    if (socialPeriod) socialPeriod.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-social-days]");
      if (!btn) return;
      const raw = btn.dataset.socialDays;
      state.social.days = raw === "all" ? "all" : Number(raw) || 30;
      syncSocialControls();
      loadSocialStats({ keepForm: true });
    });
    const socialMode = $("#social-mode");
    if (socialMode) socialMode.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-social-mode]");
      if (!btn) return;
      state.social.mode = btn.dataset.socialMode === "monthly" ? "monthly" : "daily";
      syncSocialControls();
      renderSocial();
    });
    const socialRefresh = $("#social-refresh");
    if (socialRefresh) socialRefresh.addEventListener("click", () => {
      // ‘새로고침’은 지금 값(자동)을 다시 읽고 오늘 스냅샷도 남긴 뒤, 기록 추이를 다시 그린다.
      loadSocialLive({ refresh: true });
      loadSocialStats({ keepForm: true });
    });
    // 카드 숨기기/다시 보이기(2026-11-28 v=65) — 이 브라우저(localStorage)에만 저장한다.
    const socialHide = $("#social-hide");
    if (socialHide) socialHide.addEventListener("click", () => hideStatsCard("social"));
    const hiddenChips = $("#stats-hidden-chips");
    if (hiddenChips) hiddenChips.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-stats-show]");
      if (btn) showStatsCard(btn.dataset.statsShow);
    });
    // 인스타 토큰 등록/해제 — 토큰은 password 칸으로만 받고, 저장 뒤 칸을 비운다.
    const socialTokenSave = $("#social-token-save");
    if (socialTokenSave) socialTokenSave.addEventListener("click", saveInstagramToken);
    const socialTokenInput = $("#social-token");
    if (socialTokenInput) socialTokenInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); saveInstagramToken(); }
    });
    const socialTokenRemove = $("#social-token-remove");
    if (socialTokenRemove) socialTokenRemove.addEventListener("click", removeInstagramToken);
    const socialForm = $("#social-form");
    if (socialForm) socialForm.addEventListener("submit", saveSocialStats);
    const socialToday = $("#social-today");
    if (socialToday) socialToday.addEventListener("click", () => {
      const input = socialDateInput();
      if (input) input.value = kstDateString();
      fillSocialForm();
    });
    const socialDate = $("#social-date");
    if (socialDate) socialDate.addEventListener("change", fillSocialForm);

    // 순서 편집(탭/섹션)
    ["tabs", "sections"].forEach((listName) => {
      const box = $(`#list-${listName}`);
      bindReorder(box, listName);
    });

    // ② 탭 안 섹션 — 편집할 탭 고르기
    const sectionTabs = $("#section-tabs");
    if (sectionTabs) {
      sectionTabs.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-stab]");
        if (!btn) return;
        setSectionTab(btn.dataset.stab);
      });
    }

    // 카드 편집
    $("#list-cards").addEventListener("input", (event) => {
      const el = event.target;
      const item = el.closest("[data-cardid]");
      if (!item) return;
      const card = config().cards.find((c) => c.id === item.dataset.cardid);
      if (!card) return;
      if (el.dataset.cardField) card[el.dataset.cardField] = el.value;
      if (el.dataset.cardAct === "vis") card.visible = el.checked;
      markDirty(true);
      schedulePreview();
    });
    $("#list-cards").addEventListener("change", (event) => {
      const el = event.target;
      if (el.dataset.cardAct !== "vis") return;
      const item = el.closest("[data-cardid]");
      if (!item) return;
      const card = config().cards.find((c) => c.id === item.dataset.cardid);
      if (!card) return;
      card.visible = el.checked;
      markDirty(true);
      schedulePreview();
    });

    // ③ 문구 — 묶음 접기/펼치기, 모두 펼치기·접기, ② 섹션으로 이동
    const copyForm = $("#copy-form");
    if (copyForm) {
      copyForm.addEventListener("click", (event) => {
        const all = event.target.closest("[data-copy-all]");
        if (all) {
          const open = all.dataset.copyAll === "open";
          $$("#copy-form details.copygroup").forEach((details) => {
            details.open = open;
            state.copyOpen[`${state.site}:${details.dataset.groupName}`] = open;
          });
          return;
        }
        const btn = event.target.closest("[data-goto-section]");
        if (!btn) return;
        event.preventDefault();   // <summary> 안의 버튼 — 묶음이 접히지 않게 한다
        const id = btn.dataset.gotoSection;
        if (!id) return;
        if (btn.dataset.gotoTab) state.sectionTab[state.site] = btn.dataset.gotoTab;
        state.openSections[`${state.site}:${id}`] = true;
        setTab("order");
        renderSectionTabs();
        renderOrderList("sections");
        const row = $(`#list-sections [data-id="${id}"]`);
        if (row && row.scrollIntoView) row.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      /* toggle 은 버블되지 않아 캡처 단계에서 받아 ‘펼쳐 둔 묶음’을 기억한다(새로 그려도 유지). */
      copyForm.addEventListener("toggle", (event) => {
        const details = event.target;
        if (!details || !details.classList || !details.classList.contains("copygroup")) return;
        state.copyOpen[`${state.site}:${details.dataset.groupName}`] = details.open;
      }, true);
    }

    // 상단 저장 / 배포 탭 저장
    $("#btn-save").addEventListener("click", saveToGitHub);
    $("#btn-save-top").addEventListener("click", () => {
      // 💰 개인 재무 탭의 ‘저장’ 은 사이트 설정이 아니라 개인 재무 표를 지금 바로 저장한다(0.5초 자동 저장 대기를 건너뜀).
      if (state.tab === FINANCE_TAB) {
        if (window.MOA_FINANCE) window.MOA_FINANCE.saveNow();
        return;
      }
      setTab("deploy");
      saveToGitHub();
    });
    $("#btn-pull").addEventListener("click", () => pullConfig(state.site, false));
    $("#btn-export").addEventListener("click", exportJson);
    $("#file-import").addEventListener("change", importJson);
    $("#btn-reset").addEventListener("click", resetConfig);

    // 로그아웃
    $("#btn-logout").addEventListener("click", logout);

    // 미리보기(모바일 오버레이)
    $("#btn-preview-toggle").addEventListener("click", (event) => {
      const rail = $("#preview-rail");
      const open = !rail.classList.contains("is-open");
      rail.classList.toggle("is-open", open);
      event.currentTarget.setAttribute("aria-pressed", open ? "true" : "false");
    });
    $("#preview-rail").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        event.currentTarget.classList.remove("is-open");
        $("#btn-preview-toggle").setAttribute("aria-pressed", "false");
      }
    });
    $("#preview-popup").addEventListener("change", (event) => {
      state.previewPopup = event.target.checked;
      renderPreview();
    });

    // 실제 미리보기(iframe) — 로드 완료·재시도·화면 크기 변화
    const frame = previewFrame();
    if (frame) {
      frame.addEventListener("load", () => {
        if (!frame.dataset.origin || frame.src === "about:blank") return;
        frame.dataset.loaded = "1";
        sendPreviewConfig(true);
      });
    }
    const retry = $("#pv-retry");
    if (retry) retry.addEventListener("click", retryPreview);
    const reload = $("#preview-reload");
    if (reload) reload.addEventListener("click", retryPreview);
    window.addEventListener("message", handlePreviewMessage, false);
    window.addEventListener("resize", debounce(fitPreviewFrame, 150));
    const screen = $("#phone-screen");
    if (screen && window.ResizeObserver) {
      try { new ResizeObserver(() => fitPreviewFrame()).observe(screen); } catch (err) { /* 무시 */ }
    }

    // 문의
    $("#inquiry-key-save").addEventListener("click", saveInquiryKey);
    $("#inquiry-key-forget").addEventListener("click", forgetInquiryKey);
    $("#inquiry-refresh").addEventListener("click", loadInquiries);
    $("#inquiry-status").addEventListener("change", loadInquiries);
    $("#inquiry-list").addEventListener("click", handleInquiryClick);

    // 👥 가입자·글 — 조회·찾기(찾기는 이미 받은 목록을 화면에서만 거른다)
    const peopleRefresh = $("#people-refresh");
    if (peopleRefresh) peopleRefresh.addEventListener("click", loadPeople);
    const peopleFilter = $("#people-filter");
    if (peopleFilter) {
      peopleFilter.addEventListener("input", () => {
        state.people.filter = peopleFilter.value;
        renderPeople();
      });
    }
    const peopleUsers = $("#people-users");
    if (peopleUsers) {
      peopleUsers.addEventListener("change", handlePeopleUsersChange);
    }
    const peopleCheckAll = $("#people-checkall");
    if (peopleCheckAll) peopleCheckAll.addEventListener("change", handlePeopleCheckAll);
    const peopleItems = $("#people-items");
    if (peopleItems) peopleItems.addEventListener("click", handlePeopleItemsClick);
    // 🧾 회원가입 시도 로그 (2026-11-28 v=61)
    const attemptsRefresh = $("#attempts-refresh");
    if (attemptsRefresh) attemptsRefresh.addEventListener("click", () => loadAttempts());
    const attemptsFilter = $("#attempts-filter");
    if (attemptsFilter) {
      attemptsFilter.addEventListener("change", () => {
        state.attempts.filter = attemptsFilter.value;
        loadAttempts();
      });
    }
    const attemptsClear = $("#attempts-clear");
    if (attemptsClear) attemptsClear.addEventListener("click", () => clearAttempts(attemptsClear));
    if (peopleUsers) {
      peopleUsers.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-domain-action]");
        if (btn) confirmCompanyDomain(Number(btn.dataset.id), btn.dataset.domainAction, btn);
      });
    }
    $$("[data-moderate]").forEach((btn) => {
      btn.addEventListener("click", () => moderatePeople(btn.dataset.moderate));
    });

    // 🔌 태블릿 중계 서버
    const relayCheck = $("#relay-check");
    if (relayCheck) relayCheck.addEventListener("click", () => checkRelay(false));
    const relayHealthBtn = $("#relay-health");
    if (relayHealthBtn) relayHealthBtn.addEventListener("click", () => checkRelay(false));
    const relaySave = $("#relay-url-save");
    if (relaySave) relaySave.addEventListener("click", saveRelayUrl);
    const relayUpdateBtn = $("#relay-update");
    if (relayUpdateBtn) relayUpdateBtn.addEventListener("click", updateRelay);
    const relayInput = $("#relay-url");
    if (relayInput) {
      relayInput.value = relaySavedUrl() || RELAY.fallback;
      relayInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); saveRelayUrl(); } });
    }

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    // 🔧 태블릿 점검 공지 — ① 카드와 ⑤ 중계 서버 카드의 버튼(한 번만 묶는다)
    bindMaintenance();
  }

  /* ───────────── 순서 목록 ───────────── */
  let drag = { el: null, listName: "" };

  /* 지금 화면에 그릴 항목 — 섹션은 고른 탭 안의 것만, 탭은 전체. */
  function listItems(listName) {
    const all = (config().navigation[listName] || []);
    if (listName !== "sections") return sortedByOrder(all);
    const tab = state.sectionTab[state.site];
    return sortedByOrder(all.filter((section) => sectionTabOf(section) === tab));
  }

  /* ② 화면의 탭 고르기(탭 안 섹션 편집기 머리). */
  function renderSectionTabs() {
    const box = $("#section-tabs");
    if (!box) return;
    const tabs = sortedByOrder(config().navigation.tabs);
    const active = state.sectionTab[state.site];
    if (tabs.length && !tabs.some((tab) => tab.id === active)) state.sectionTab[state.site] = tabs[0].id;
    const now = state.sectionTab[state.site];
    if (!tabs.length) {
      box.innerHTML = '<p class="note">탭이 없습니다.</p>';
      return;
    }
    box.innerHTML = tabs.map((tab) => {
      const count = config().navigation.sections.filter((section) => sectionTabOf(section) === tab.id).length;
      const on = tab.id === now;
      const hidden = tab.visible === false;
      return `<button type="button" class="stab${on ? " is-active" : ""}${hidden ? " is-off" : ""}" data-stab="${esc(tab.id)}" role="tab" aria-selected="${on ? "true" : "false"}">
        <span class="stab-label">${esc(tab.label)}</span>
        <span class="stab-count">${count}</span>
        ${hidden ? '<span class="stab-off">숨김</span>' : ""}
      </button>`;
    }).join("");

    const note = $("#section-tab-note");
    if (note) {
      const tab = tabs.find((x) => x.id === now) || tabs[0];
      const count = config().navigation.sections.filter((section) => sectionTabOf(section) === tab.id).length;
      note.textContent = `‘${tab.label}’ 탭 안의 섹션 ${count}개입니다. 순서·노출을 바꾸고, ✎ 를 누르면 그 섹션의 제목·설명은 물론 작은 버튼·라벨·안내 문구까지 한자리에서 고칩니다.`;
    }
  }

  function setSectionTab(tabId) {
    state.sectionTab[state.site] = tabId;
    saveUi();
    renderSectionTabs();
    renderOrderList("sections");
    schedulePreview();
  }

  function bindReorder(box, listName) {
    if (!box) return;
    box.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-act]");
      if (!btn) return;
      const row = btn.closest("[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      const action = btn.dataset.act;
      if (action === "up") moveItem(listName, id, -1);
      if (action === "down") moveItem(listName, id, 1);
      if (action === "edit") {
        // 목록을 다시 그리지 않고 그 자리에서 내용 편집기를 열고 닫는다.
        const key = `${state.site}:${id}`;
        const open = !state.openSections[key];
        state.openSections[key] = open;
        const editor = row.querySelector("[data-seditor]");
        if (editor) editor.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "▾" : "✎";
        row.classList.toggle("is-open", open);
      }
    });

    // 섹션 안쪽 문구(copy)와 본문 문단(sections[].body) 편집
    box.addEventListener("input", (event) => {
      const field = event.target.closest("[data-sfield]");
      if (field) {
        const keyName = field.dataset.sfield;
        setPath(config(), `copy.${keyName}`, field.value);
        markDirty(true);
        syncCopyInput(keyName);
        schedulePreview();
        return;
      }
      const bodyEl = event.target.closest("[data-sbody]");
      if (!bodyEl) return;
      const section = config().navigation.sections.find((x) => x.id === bodyEl.dataset.sbody);
      if (!section) return;
      section.body = bodyEl.value;
      markDirty(true);
      schedulePreview();
    });

    // 이름 편집 — 입력하는 즉시 설정·미리보기·‘저장 안 된 변경’에 반영한다.
    box.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-label-field]");
      if (!input) return;
      const row = input.closest("[data-id]");
      if (!row) return;
      const item = config().navigation[listName].find((x) => x.id === row.dataset.id);
      if (!item) return;
      item.label = input.value;
      markDirty(true);
      syncRowAria(row, input.value || item.id);
      schedulePreview();
    });
    // 입력을 마쳤을 때 비어 있으면 기본 이름으로 되돌린다.
    box.addEventListener("change", (event) => {
      const input = event.target.closest("input[data-label-field]");
      if (!input) return;
      const row = input.closest("[data-id]");
      if (!row) return;
      if (input.value.trim()) return;
      const item = config().navigation[listName].find((x) => x.id === row.dataset.id);
      if (!item) return;
      item.label = restoreDefaultLabel(listName, item.id);
      input.value = item.label;
      markDirty(true);
      syncRowAria(row, item.label);
      schedulePreview();
      toast("이름이 비어 있어 기본 이름으로 되돌렸습니다.");
    });

    /* 끌기는 이름칸·버튼·스위치가 아닌 곳에서만 시작한다(입력칸에서 글자를 고를 수 있도록). */
    box.addEventListener("pointerdown", (event) => {
      const row = event.target.closest(".rrow");
      if (!row) return;
      row.draggable = !event.target.closest("input, button, label, select, textarea, a");
    });
    box.addEventListener("change", (event) => {
      const el = event.target;
      if (el.dataset.act !== "vis") return;
      const row = el.closest("[data-id]");
      if (!row) return;
      const item = config().navigation[listName].find((x) => x.id === row.dataset.id);
      if (!item) return;
      item.visible = el.checked;
      row.classList.toggle("is-hidden-item", !item.visible);
      markDirty(true);
      updateDerived();
      schedulePreview();
    });

    box.addEventListener("dragstart", (event) => {
      const row = event.target.closest(".rrow");
      if (!row) return;
      drag.el = row;
      drag.listName = listName;
      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try { event.dataTransfer.setData("text/plain", row.dataset.id); } catch (err) { /* Safari */ }
      }
    });
    box.addEventListener("dragover", (event) => {
      if (!drag.el || drag.listName !== listName) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const over = event.target.closest(".rrow");
      if (!over || over === drag.el) return;
      const rect = over.getBoundingClientRect();
      const after = event.clientY - rect.top > rect.height / 2;
      box.insertBefore(drag.el, after ? over.nextSibling : over);
    });
    box.addEventListener("drop", (event) => {
      if (!drag.el) return;
      event.preventDefault();
    });
    box.addEventListener("dragend", () => {
      if (!drag.el || drag.listName !== listName) return;
      drag.el.classList.remove("is-dragging");
      drag.el = null;
      commitOrder(listName);
    });
  }

  function moveItem(listName, id, delta) {
    const list = listItems(listName);
    const index = list.findIndex((x) => x.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    if (listName === "sections") {
      // 섹션 순서는 ‘그 탭 안에서’ 1부터 — 다른 탭의 섹션은 건드리지 않는다.
      list.forEach((section, i) => { section.order = i + 1; });
    } else {
      config().navigation[listName] = renumber(list);
    }
    markDirty(true);
    renderOrderList(listName);
    renderSectionTabs();
    schedulePreview();
  }

  function commitOrder(listName) {
    const box = $(`#list-${listName}`);
    const ids = $$(".rrow", box).map((row) => row.dataset.id);
    const list = config().navigation[listName];
    const byId = new Map(list.map((item) => [item.id, item]));
    if (listName === "sections") {
      // 화면에 있는 섹션(그 탭)만 1부터 다시 매긴다.
      ids.forEach((id, i) => { const item = byId.get(id); if (item) item.order = i + 1; });
    } else {
      const next = ids.map((id) => byId.get(id)).filter(Boolean);
      list.forEach((item) => { if (!next.includes(item)) next.push(item); });
      config().navigation[listName] = renumber(next);
    }
    markDirty(true);
    renderOrderList(listName);
    renderSectionTabs();
    schedulePreview();
  }

  /* ② 섹션 편집기의 입력칸 하나 — ③ 문구와 같은 정의(kind·max)를 쓴다. */
  function sectionFieldHtml(key, titleKey) {
    const field = copyFieldOf(key);
    const id = `s-${state.site}-${key}`;
    const raw = getPath(config(), `copy.${key}`);
    const value = raw == null ? "" : String(raw);
    const rich = field.kind === "html" || field.kind === "areaHtml";
    const hint = rich ? ' <em>&lt;b&gt;·&lt;br&gt; 등 일부 태그 사용 가능</em>' : "";
    const badge = key === titleKey ? ' <span class="sfield-badge">화면 제목</span>' : "";
    const max = Number(field.max) || 80;
    if (field.kind === "area" || field.kind === "areaHtml") {
      return `<label class="field sfield" for="${esc(id)}">
        <span class="field-label">${esc(field.label)}${badge}${hint}</span>
        <textarea id="${esc(id)}" data-sfield="${esc(key)}" rows="2" maxlength="${max}">${esc(value)}</textarea>
      </label>`;
    }
    return `<label class="field sfield" for="${esc(id)}">
      <span class="field-label">${esc(field.label)}${badge}${hint}</span>
      <input type="text" id="${esc(id)}" data-sfield="${esc(key)}" value="${esc(value)}" maxlength="${max}">
    </label>`;
  }

  function renderOrderList(listName) {
    const box = $(`#list-${listName}`);
    if (!box) return;
    const isSection = listName === "sections";
    const list = listItems(listName);
    if (isSection && !list.length) {
      box.innerHTML = '<p class="note">이 탭에는 편집할 섹션이 없습니다. 위에서 다른 탭을 골라 주세요.</p>';
      return;
    }
    const limit = LABEL_LIMIT[listName] || 20;
    box.innerHTML = list.map((item, index) => {
      const kind = isSection ? "섹션" : "탭";
      const meta = isSection ? metaOf(item.id) : null;
      const title = isSection ? sectionTitleInfo(item) : { kind: "label", value: item.label, key: "" };
      const titleMax = title.kind === "copy" ? (Number(copyFieldOf(title.key).max) || 80) : limit;
      const noteParts = [];
      if (isSection && title.kind === "copy") noteParts.push(`화면 제목: 문구 ${title.key}`);
      if (isSection && meta && meta.note) noteParts.push(meta.note);
      const note = noteParts.join(" · ");
      const open = Boolean(state.openSections[`${state.site}:${item.id}`]);
      const titleInput = title.kind === "copy"
        ? `<input type="text" class="rlabel-input" data-sfield="${esc(title.key)}" value="${esc(title.value)}"
                 maxlength="${titleMax}" placeholder="화면에 보일 제목" spellcheck="false"
                 aria-label="${esc(item.id)} 섹션 제목" title="이 칸이 화면의 섹션 제목이 됩니다">`
        : `<input type="text" class="rlabel-input" data-label-field="1" value="${esc(item.label)}"
                 maxlength="${limit}" placeholder="화면에 보일 이름" spellcheck="false"
                 aria-label="${esc(item.id)} ${kind} 이름" title="이름을 눌러 고치면 미리보기와 사이트에 반영됩니다">`;
      const editBtn = isSection
        ? `<button type="button" class="icon-btn" data-act="edit" aria-expanded="${open ? "true" : "false"}" aria-controls="sedit-${esc(item.id)}" title="제목·부제·설명·본문 고치기" aria-label="${esc(item.label)} 내용 고치기">${open ? "▾" : "✎"}</button>`
        : "";
      const editor = isSection ? sectionEditorHtml(item, meta, open) : "";
      return `
      <div class="rrow ${item.visible ? "" : "is-hidden-item"}${open ? " is-open" : ""}" draggable="true" data-id="${esc(item.id)}">
        <span class="rdrag" title="끌어서 순서 바꾸기" aria-hidden="true">⠿</span>
        <span class="rnum">${index + 1}</span>
        <div class="rmain">
          ${titleInput}
          <div class="rid">${esc(item.id)}${note ? ` · <span class="rhint">${esc(note)}</span>` : ""}</div>
        </div>
        <div class="rmove">
          ${editBtn}
          <button type="button" class="icon-btn" data-act="up" aria-label="${esc(item.label)} 위로" ${index === 0 ? "disabled" : ""}>▲</button>
          <button type="button" class="icon-btn" data-act="down" aria-label="${esc(item.label)} 아래로" ${index === list.length - 1 ? "disabled" : ""}>▼</button>
          <label class="switch" title="${item.visible ? "노출 중" : "숨김"}">
            <input type="checkbox" data-act="vis" ${item.visible ? "checked" : ""} aria-label="${esc(item.label)} 노출">
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>
        ${editor}
      </div>`;
    }).join("");
  }

  /* 섹션 안쪽 내용 편집기 — 대표 문구(표제·제목·설명·링크) + 세부 문구(버튼·라벨·안내) + 본문.
     세부 문구는 기본 ‘+’ 접힘으로 두어 누를 때만 펼쳐진다(② 화면이 길어지지 않도록). */
  function sectionEditorHtml(section, meta, open) {
    const fields = (meta && meta.fields) || [];
    const titleKey = (meta && meta.titleKey) || "";
    const primary = fields.filter((field) => isPrimaryKey(field.key, titleKey));
    const detail = fields.filter((field) => !isPrimaryKey(field.key, titleKey));
    const body = section.body == null ? "" : String(section.body);
    const primaryHtml = primary.length
      ? `<div class="sedit-grid">${primary.map((field) => sectionFieldHtml(field.key, titleKey)).join("")}</div>`
      : "";
    const detailHtml = detail.length
      ? `<details class="sedit-more">
           <summary><span class="smark" aria-hidden="true"></span>세부 문구 ${detail.length}개 <em>버튼 · 라벨 · 안내 문구 — 눌러서 펼치기</em></summary>
           <div class="sedit-grid">${detail.map((field) => sectionFieldHtml(field.key, titleKey)).join("")}</div>
         </details>`
      : "";
    const empty = !fields.length
      ? '<p class="note sfield-empty">이 섹션에는 따로 고칠 문구가 없습니다. 아래 본문 문단을 쓸 수 있어요.</p>'
      : "";
    return `<div class="seditor" id="sedit-${esc(section.id)}" data-seditor="${esc(section.id)}" ${open ? "" : "hidden"}>
      <div class="sedit-head">
        <span>이 섹션 문구 <b>${fields.length}</b>개</span>
        <small>제목·설명은 물론 작은 버튼 · 라벨 · 안내 문구까지 여기서 함께 고칩니다.</small>
      </div>
      ${primaryHtml}${detailHtml}${empty}
      <label class="field sfield">
        <span class="field-label">본문 문단 <em>섹션 아래에 덧붙는 안내 글 · &lt;b&gt;·&lt;br&gt; 등 일부 태그 사용</em></span>
        <textarea data-sbody="${esc(section.id)}" rows="2" maxlength="600" placeholder="비우면 본문이 표시되지 않습니다">${esc(body)}</textarea>
      </label>
    </div>`;
  }

  /* 이름을 고치는 동안에는 목록을 다시 그리지 않는다(입력 중 커서가 튀지 않도록).
     버튼·스위치의 읽어주기 문구만 그 자리에서 새 이름으로 바꾼다. */
  function syncRowAria(row, label) {
    $$("button[data-act]", row).forEach((btn) => {
      const dir = btn.dataset.act === "up" ? "위로" : "아래로";
      btn.setAttribute("aria-label", `${label} ${dir}`);
    });
    const sw = $('input[data-act="vis"]', row);
    if (sw) sw.setAttribute("aria-label", `${label} 노출`);
  }

  /* ② 에서 고친 문구를 ③ 문구 화면의 같은 칸에도 바로 반영한다. */
  function syncCopyInput(key) {
    const el = document.getElementById(`copy-${key}`);
    if (!el) return;
    const value = getPath(config(), `copy.${key}`);
    el.value = value == null ? "" : String(value);
  }

  /* ③ 에서 고친 문구를 ② 섹션 편집기의 같은 칸에도 바로 반영한다(양방향 동기화). */
  function syncSectionInput(path) {
    if (!path || path.indexOf("copy.") !== 0) return;
    const key = path.slice("copy.".length);
    const value = getPath(config(), `copy.${key}`);
    $$(`[data-sfield="${key}"]`).forEach((el) => {
      const next = value == null ? "" : String(value);
      if (el.value !== next) el.value = next;
    });
  }

  /* 이름을 비우면 사이트에는 반영되지 않으므로 기본 이름으로 되돌린다. */
  function restoreDefaultLabel(listName, id) {
    const defaults = (current().defaults.navigation || {})[listName] || [];
    const found = defaults.find((x) => x.id === id);
    return found ? found.label : id;
  }

  /* ───────────── 카드 목록 ───────────── */
  function renderCards() {
    const box = $("#list-cards");
    const cards = sortedByOrder(config().cards);
    if (!cards.length) {
      box.innerHTML = '<p class="note">등록된 현황 카드가 없습니다.</p>';
      return;
    }
    box.innerHTML = cards.map((card) => `
      <div class="carditem" data-cardid="${esc(card.id)}">
        <div class="ci-head">
          <strong>${esc(card.title || card.id)}</strong>
          <span class="rid">${esc(card.id)}</span>
          <label class="switch" title="노출">
            <input type="checkbox" data-card-act="vis" ${card.visible ? "checked" : ""} aria-label="${esc(card.title)} 노출">
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>
        <label class="field">
          <span class="field-label">카드 제목</span>
          <input type="text" data-card-field="title" value="${esc(card.title)}" maxlength="30">
        </label>
        <label class="field" style="margin-bottom:0">
          <span class="field-label">카드 설명</span>
          <input type="text" data-card-field="description" value="${esc(card.description)}" maxlength="80">
        </label>
      </div>`).join("");
  }

  /* ───────────── 기능 스위치 ───────────── */
  /* sites.js 의 features 목록을 초록 스위치로 그린다.
     값은 config.features[아이디] 에 저장되고, 끄면 사이트 로더가 data-feature 요소를 숨긴다. */
  function renderFeatures() {
    const card = $("#feature-card");
    const box = $("#feature-list");
    if (!card || !box) return;
    const list = current().features || [];
    if (!list.length) {
      card.hidden = true;
      box.innerHTML = "";
      return;
    }
    const cfg = config();
    if (!cfg.features || typeof cfg.features !== "object") cfg.features = {};
    const values = cfg.features;
    list.forEach((item) => {
      if (values[item.id] === undefined) values[item.id] = item.on !== false;
    });
    card.hidden = false;
    box.innerHTML = list.map((item) => {
      const on = values[item.id] !== false;
      return `
      <div class="frow${on ? "" : " is-off"}" data-feature-row="${esc(item.id)}">
        <div class="fmain">
          <strong>${esc(item.label)}</strong>
          <div class="rid">features.${esc(item.id)}${item.note ? ` · <span class="rhint">${esc(item.note)}</span>` : ""}</div>
        </div>
        <label class="switch" title="${on ? "켜짐 — 사이트에 보입니다" : "꺼짐 — 사이트에서 숨깁니다"}">
          <input type="checkbox" data-bind="features.${esc(item.id)}" ${on ? "checked" : ""} aria-label="${esc(item.label)}">
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label" data-feature-state="${esc(item.id)}">${on ? "켜짐" : "꺼짐"}</span>
        </label>
      </div>`;
    }).join("");
  }

  /* ───────────── 문구 입력칸 ───────────── */
  /* ③ 문구 화면 — 머리말 → 탭별(탭 머리글 · 화면 공통 · 섹션들) → 꼬리말 순서로 묶어 그린다.
     각 섹션 묶음은 ② 의 ✎ 편집기와 같은 값(copy 키)을 쓰므로 양쪽이 실시간으로 동기화된다. */
  function renderCopyForm() {
    const box = $("#copy-form");
    if (!box) return;
    const groups = current().copyGroups || [];
    if (!groups.length) {
      box.innerHTML = '<p class="note">이 사이트에 등록된 문구 목록이 없습니다.</p>';
      return;
    }
    const counts = {};
    groups.forEach((group) => {
      if (group.tab && group.kind !== "tab" && group.kind !== "sum" && group.fields) {
        counts[group.tab] = (counts[group.tab] || 0) + group.fields.length;
      }
    });
    box.innerHTML = `<div class="copy-toolbar">
        <span>문구 <b>${groups.reduce((sum, g) => sum + ((g.kind === "tab" || g.kind === "sum") ? 0 : g.fields.length), 0)}</b>개 · 모든 묶음이 + 로 접혀 있어요. 왼쪽 + 를 누르면 펼쳐집니다.</span>
        <button type="button" class="btn btn-sm btn-ghost" data-copy-all="open">모두 펼치기</button>
        <button type="button" class="btn btn-sm btn-ghost" data-copy-all="close">모두 접기</button>
      </div>` + groups.map((group) => {
      if (group.kind === "tab") {
        return `<div class="copygrouptab" data-copytab="${esc(group.tab)}">
          <span>${esc(group.name)}</span><b>${counts[group.tab] || 0}개 문구</b>
        </div>`;
      }
      if (group.kind === "sum") return "";
      const openKey = `${state.site}:${group.name}`;
      const isOpen = Boolean(state.copyOpen[openKey]);
      const jump = group.kind === "section" && group.section
        ? `<button type="button" class="linkbtn" data-goto-section="${esc(group.section)}" data-goto-tab="${esc(group.tab || "")}">② 에서 이 섹션 편집 →</button>`
        : "";
      const empty = group.fields.length ? "" : '<p class="note">이 묶음에는 아직 문구가 없습니다.</p>';
      return `<details class="copygroup" data-group-kind="${esc(group.kind || "group")}" data-group-section="${esc(group.section || "")}" data-group-name="${esc(group.name)}"${isOpen ? " open" : ""}>
        <summary class="copygroup-head">
          <span class="cg-mark" aria-hidden="true"></span>
          <h4>${esc(group.name)}</h4>
          <span class="muted small">${group.fields.length}개</span>
          ${jump}
        </summary>
        <div class="copygroup-body">
          ${group.note ? `<p class="note">${esc(group.note)}</p>` : ""}
          ${empty}${group.fields.map(copyFieldHtml).join("")}
        </div>
      </details>`;
    }).join("") ;
  }

  function copyFieldHtml(field) {
    const raw = getPath(config(), `copy.${field.key}`);
    const value = raw == null ? "" : String(raw);
    const id = `copy-${field.key}`;
    const rich = field.kind === "html" || field.kind === "areaHtml";
    const hint = rich ? ' <em>&lt;b&gt;·&lt;br&gt; 등 일부 태그 사용 가능</em>' : "";
    const max = Number(field.max) || 80;
    if (field.kind === "area" || field.kind === "areaHtml") {
      return `<label class="field" for="${esc(id)}">
        <span class="field-label">${esc(field.label)}${hint}</span>
        <textarea id="${esc(id)}" data-bind="copy.${esc(field.key)}" rows="2" maxlength="${max}">${esc(value)}</textarea>
      </label>`;
    }
    return `<label class="field" for="${esc(id)}">
      <span class="field-label">${esc(field.label)}${hint}</span>
      <input type="text" id="${esc(id)}" data-bind="copy.${esc(field.key)}" value="${esc(value)}" maxlength="${max}">
    </label>`;
  }

  /* ───────────── 파생 UI(스위치 라벨 등) ───────────── */
  function updateDerived() {
    const cfg = config();
    const setState = (id, on) => { const el = $(id); if (el) el.textContent = on ? "켜짐" : "꺼짐"; };
    setState("#banner-state", Boolean(cfg.banner.enabled));
    setState("#popup-state", Boolean(cfg.popup.enabled));

    // 포케모아 「팜사이즈 원더 안내」 팝업 — 스위치 4개와 버튼 동작 표시
    const figure = cfg.figurePopup || {};
    setState("#figure-popup-state", figure.enabled !== false);
    setState("#figure-popup-auto-state", figure.autoOpen !== false);
    setState("#figure-popup-floating-state", figure.floating !== false);
    setState("#figure-popup-today-state", figure.dismissToday !== false);
    $$("#figure-popup-action button").forEach((btn) => {
      btn.classList.toggle("is-active", (btn.dataset.figureAction || "stock") === (figure.buttonAction || "stock"));
    });
    const figureNote = $("#figure-popup-note");
    if (figureNote) {
      const { startDate, endDate } = figure;
      figureNote.textContent = startDate || endDate
        ? `노출 기간: ${startDate || "제한 없음"} ~ ${endDate || "제한 없음"} · 기간 밖에는 팝업과 ‘다시 보기’ 버튼이 모두 숨습니다.`
        : "기간을 비우면 항상 노출됩니다. ‘다시 보기’ 버튼을 끄고 자동 열기도 끄면 방문자는 팝업을 볼 수 없습니다(사실상 끄기).";
    }

    $$("#banner-style button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.style === (cfg.banner.style || "info"));
    });

    (current().features || []).forEach((item) => {
      const on = getPath(cfg, `features.${item.id}`) !== false;
      $$(`[data-feature-state="${item.id}"]`).forEach((el) => { el.textContent = on ? "켜짐" : "꺼짐"; });
      $$(`[data-feature-row="${item.id}"]`).forEach((row) => {
        row.classList.toggle("is-off", !on);
        const sw = row.querySelector("label.switch");
        if (sw) sw.title = on ? "켜짐 — 사이트에 보입니다" : "꺼짐 — 사이트에서 숨깁니다";
      });
    });

    const note = $("#popup-period-note");
    if (note) {
      const { startDate, endDate } = cfg.popup;
      if (startDate || endDate) {
        note.textContent = `노출 기간: ${startDate || "제한 없음"} ~ ${endDate || "제한 없음"} · ‘다시 보지 않기’는 ${Number(cfg.popup.dismissDays) || 0}일 동안 유지됩니다.`;
      } else {
        note.textContent = "기간을 비우면 항상 노출됩니다. ‘다시 보지 않기’는 방문자 브라우저에 그 일수만큼 기억됩니다.";
      }
    }

    // 🔧 태블릿 점검 공지 — 스위치 라벨과 같은 원리로 입력이 바뀔 때마다 상태·미리보기를 맞춘다.
    renderMaintenance();
  }

  /* ───────────── 전체 렌더 ───────────── */
  function renderAll() {
    $$(".site-btn").forEach((btn) => {
      const on = btn.dataset.site === state.site;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    // 이 사이트에만 쓰는 칸(예: 포케모아의 팜사이즈 팝업 카드, 복지모아의 문의 탭)
    $$("[data-only-site]").forEach((el) => { el.hidden = el.dataset.onlySite !== state.site; });
    const inquiryTab = $('.tab[data-tab="inquiry"]');
    if (inquiryTab) inquiryTab.hidden = state.site !== "bokjimoa";
    applyTab();
    renderCopyForm();
    syncInputs();
    updateDerived();
    renderOrderList("tabs");
    renderSectionTabs();
    renderOrderList("sections");
    renderCards();
    renderFeatures();
    renderDeployTarget();
    renderChecks();
    renderRelayCard();
    renderActivityLog();
    renderInquiries();
    $("#preview-site").textContent = current().name;
    $("#btn-open-live").href = current().liveUrl;
    $("#path-note").textContent = current().path;
    const chip = $("#dirty-chip");
    if (chip) chip.hidden = !state.dirty[state.site];
    schedulePreview();
  }

  function syncInputs() {
    const cfg = config();
    $$("[data-bind]").forEach((el) => {
      const value = getPath(cfg, el.dataset.bind);
      if (el.type === "checkbox") el.checked = Boolean(value);
      else el.value = value == null ? "" : value;
    });
  }

  /* 미리보기 반영은 조금 모아서 보낸다(타이핑 중 매 글자마다 iframe 을 다시 그리지 않도록). */
  const schedulePreview = debounce(renderPreview, 120);

  /* ───────────── 실제 사이트 미리보기(iframe + postMessage) ─────────────
     가짜 모형 박스 대신 라이브 사이트를 390px 폭 iframe 으로 띄우고, 저장 전 draft 설정을
     postMessage 로 보내 그 자리에서 다시 그리게 한다(새로고침 없음).
     사이트 쪽은 site-config-loader.js v4 가 받아 적용하고 moa-preview-applied 로 응답한다. */
  function previewFrame() { return $("#pv-frame"); }

  function previewSiteId() { return state.preview.site || state.site; }

  /* 미리보기 iframe 의 출처 — 사이트 주소에서 구하고, 해석할 수 없으면 기본값을 쓴다. */
  function previewOrigin(siteId) {
    const site = SITES[siteId || previewSiteId()];
    try {
      if (site && site.liveUrl) return new URL(site.liveUrl).origin;
    } catch (err) { /* 아래 기본값 */ }
    return PREVIEW_ORIGIN[siteId || previewSiteId()] || "";
  }

  /* 사이트 화면을 iframe 에 물린다. force 면 캐시를 비켜 새로 받는다. */
  function mountPreviewFrame(force) {
    const frame = previewFrame();
    if (!frame) return;
    const site = current();
    const same = state.preview.site === site.id && frame.dataset.loaded === "1";
    if (same && !force) { fitPreviewFrame(); return; }

    state.preview.site = site.id;
    state.preview.ready = false;
    frame.dataset.loaded = "0";
    frame.dataset.origin = previewOrigin(site.id);
    if (frame.dataset.origin) frame.dataset.website = site.id;

    showPreviewOverlay(site.id === "bokjimoa"
      ? "복지모아 서버를 깨우는 중… (Render는 잠들어 있으면 30초쯤 걸려요)"
      : "실제 사이트를 불러오는 중…", false);
    startPreviewTimers();

    // 미리보기 HTML·로더가 캐시에 묶여 옛 빌드로 뜨지 않도록 항상 캐시를 비켜 받는다.
    // (GitHub Pages 는 HTML 을 10분 캐시하고, 옛 로더에는 미리보기 수신부가 없다.)
    const url = `${site.liveUrl}${site.liveUrl.indexOf("?") === -1 ? "?" : "&"}moa_preview=${Date.now()}`;
    try { frame.src = url; } catch (err) { showPreviewOverlay("미리보기를 열지 못했습니다.", true); }
    fitPreviewFrame();
  }

  /* iframe 을 화면 폭에 맞춰 축소한다(내부는 390px 기기 폭 그대로). */
  function fitPreviewFrame() {
    const screen = $("#phone-screen");
    const frame = previewFrame();
    if (!screen || !frame) return;
    const width = screen.clientWidth || 320;
    const height = screen.clientHeight || 620;
    const scale = width / 390;
    frame.style.width = "390px";
    frame.style.transform = `scale(${scale.toFixed(4)})`;
    frame.style.height = `${Math.max(480, Math.round(height / scale))}px`;
  }

  function showPreviewOverlay(text, withRetry) {
    const box = $("#pv-overlay");
    const label = $("#pv-overlay-text");
    const retry = $("#pv-retry");
    if (!box) return;
    box.hidden = false;
    box.classList.toggle("is-error", Boolean(withRetry));
    if (label) label.textContent = text;
    if (retry) retry.hidden = !withRetry;
  }

  function hidePreviewOverlay() {
    const box = $("#pv-overlay");
    if (box) box.hidden = true;
  }

  function clearPreviewTimers() {
    clearTimeout(state.preview.slowTimer);
    clearTimeout(state.preview.failTimer);
    state.preview.slowTimer = 0;
    state.preview.failTimer = 0;
  }

  function startPreviewTimers() {
    clearPreviewTimers();
    state.preview.slowTimer = setTimeout(() => {
      if (state.preview.ready) return;
      const site = SITES[previewSiteId()];
      showPreviewOverlay(`${site ? site.name : "사이트"}가 아직 응답하지 않아요. 서버가 잠들어 있으면 첫 로딩이 느릴 수 있습니다.`, true);
    }, PREVIEW_READY_MS);
    state.preview.failTimer = setTimeout(() => {
      if (state.preview.ready) return;
      showPreviewOverlay("미리보기가 뜨지 않았어요. 사이트가 iframe 표시를 거부했거나(X-Frame-Options·CSP) 네트워크가 막혔을 수 있습니다. ‘다시 불러오기’를 눌러 주세요.", true);
    }, PREVIEW_FAIL_MS);
  }

  /* 지금 편집 중인 draft 를 사이트에 그대로 보낸다(저장 전 값). */
  function sendPreviewConfig(force) {
    const frame = previewFrame();
    const siteId = previewSiteId();
    const origin = previewOrigin(siteId);
    if (!frame || !origin || !frame.contentWindow) return;
    if (frame.dataset.loaded !== "1" && !force) return;
    const payload = buildConfigForSave(siteId);
    if (!state.previewPopup) {
      payload.popup = Object.assign({}, payload.popup, { enabled: false });
      if (payload.figurePopup) payload.figurePopup = Object.assign({}, payload.figurePopup, { enabled: false });
    }
    const activeTab = state.sectionTab[siteId] || "";
    try {
      frame.contentWindow.postMessage({ type: "moa-preview-config", config: payload, activeTab, site: siteId }, origin);
    } catch (err) { /* iframe 이 아직 준비되지 않았으면 load·ready 에서 다시 보낸다 */ }
  }

  function retryPreview() {
    const frame = previewFrame();
    if (frame) frame.dataset.loaded = "0";
    state.preview.ready = false;
    mountPreviewFrame(true);
  }

  /* 사이트 로더가 보내는 준비·반영 완료 신호 */
  function handlePreviewMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const siteId = previewSiteId();
    const origin = previewOrigin(siteId);
    if (origin && event.origin !== origin) return;
    if (data.type === "moa-preview-ready") {
      const frame = previewFrame();
      if (frame) frame.dataset.loaded = "1";
      state.preview.ready = true;
      clearPreviewTimers();
      sendPreviewConfig(true);         // 로더가 살아났으니 지금 draft 를 보낸다
      return;
    }
    if (data.type === "moa-preview-applied") {
      state.preview.ready = true;
      state.preview.appliedAt = Date.now();
      clearPreviewTimers();
      hidePreviewOverlay();
      updatePreviewNote();
      return;
    }
    /* 미리보기에서 고칠 곳을 눌렀을 때 — 그 문구의 입력칸으로 데려간다 */
    if (data.type === "moa-preview-focus") {
      focusFromPreview(data.target || data);
    }
  }

  /* ─────────── 미리보기 클릭 → 해당 입력칸으로 이동 (2026-11-20) ───────────
     사이트(iframe)가 보낸 { kind, key } 를 그 칸으로 옮긴다.
       kind: copy    → ③ 문구의 그 키(없으면 ② 섹션 편집기)
       kind: section → ② 탭·섹션의 그 섹션(편집기 펼침)
       kind: banner/popup → ① 공지·팝업의 해당 입력 */
  function cssKey(key) { return String(key || "").replace(/["\\]/g, ""); }

  function highlightTarget(el) {
    if (!el) return;
    const box = el.closest(".field, .rrow, .card") || el;
    box.classList.remove("is-jump-target");
    void box.offsetWidth;              /* 애니메이션을 다시 시작하려면 리플로우 */
    box.classList.add("is-jump-target");
    clearTimeout(highlightTarget.timer);
    highlightTarget.timer = setTimeout(() => box.classList.remove("is-jump-target"), 2600);
    try { (el.closest(".rrow") || el).scrollIntoView({ block: "center", behavior: "smooth" }); }
    catch (err) { try { el.scrollIntoView(); } catch (e2) {} }
    setTimeout(() => {
      try {
        const field = el.matches("input, textarea, select") ? el : el.querySelector("input, textarea");
        if (field) {
          field.focus({ preventScroll: true });
          if (field.select && field.tagName === "INPUT") field.select();
        }
      } catch (err) { /* 포커스 실패는 무시 */ }
    }, 280);
  }

  function openCopyField(key) {
    const input = $(`#copy-form [data-bind="copy.${cssKey(key)}"]`);
    if (!input) return null;
    const group = input.closest("details.copygroup");
    if (group && !group.open) {
      group.open = true;
      state.copyOpen[`${state.site}:${group.dataset.groupName}`] = true;
    }
    return input;
  }

  function focusFromPreview(target) {
    if (!target || typeof target !== "object") return;
    /* 모바일(세로 배치)에서는 미리보기가 화면을 덮고 있으니 먼저 단는다 — 아래 입력칸이 보이게 */
    const rail = $("#preview-rail");
    if (rail && rail.classList.contains("is-open")) {
      rail.classList.remove("is-open");
      const toggleBtn = $("#btn-preview-toggle");
      if (toggleBtn) toggleBtn.setAttribute("aria-pressed", "false");
    }
    const kind = String(target.kind || "copy");
    const cfg = current();

    if (kind === "copy" && target.key) {
      setTab("copy");
      const input = openCopyField(target.key);
      if (input) { highlightTarget(input); return; }
      /* ③ 에 없는 키(섹션 본문 전용 등)는 ② 섹션 편집기의 같은 키로 */
      const sec = (cfg.sections || []).find((s) => (s.fields || []).some((f) => f.key === target.key));
      if (sec) { focusSection(sec, `[data-sfield="${cssKey(target.key)}"]`); return; }
      toast("이 문구는 어드민에 아직 등록되지 않았습니다.");
      return;
    }

    if (kind === "section" && target.id) {
      const sec = (cfg.sections || []).find((s) => s.id === target.id);
      if (!sec) { toast("이 구역은 어드민의 탭·섹션 목록에 없습니다."); return; }
      focusSection(sec, ".rlabel-input");
      return;
    }

    if (kind === "banner" || kind === "popup" || kind === "figurePopup") {
      setTab("notice");
      const sel = kind === "banner"
        ? '[data-bind="banner.text"]'
        : kind === "popup"
          ? '[data-bind="popup.title"]'
          : `[data-bind="figurePopup.${cssKey(target.key || "title")}"]`;
      highlightTarget($(sel) || (kind === "figurePopup" ? $('[data-bind="figurePopup.title"]') : null));
      return;
    }

    if (kind === "tab" && target.id) {
      setTab("order");
      const row = $(`#list-tabs [data-id="${cssKey(target.id)}"]`);
      if (row) highlightTarget(row.querySelector(".rlabel-input"));
    }
  }

  function focusSection(sec, innerSelector) {
    state.sectionTab[state.site] = sec.tab || state.sectionTab[state.site];
    state.openSections[`${state.site}:${sec.id}`] = true;
    setTab("order");
    renderSectionTabs();
    renderOrderList("sections");
    const row = $(`#list-sections [data-id="${cssKey(sec.id)}"]`);
    if (!row) return;
    const target = (innerSelector && row.querySelector(innerSelector)) || row;
    highlightTarget(target);
  }

  function updatePreviewNote() {
    const note = $("#preview-note");
    if (!note) return;
    const parts = ["실제 사이트를 390px 화면으로 축소했습니다. 고치는 즉시 반영돼요. 미리보기에서 고칠 곳을 누르면 해당 입력칸으로 이동합니다."];
    if (!state.previewPopup) parts.push("지금은 팝업을 숨긴 채로 보내고 있어요.");
    const cfg = config();
    const { startDate, endDate } = cfg.popup || {};
    const today = todayISO();
    if (cfg.popup && cfg.popup.enabled && ((startDate && today < startDate) || (endDate && today > endDate))) {
      parts.push(`팝업 기간(${startDate || "제한 없음"} ~ ${endDate || "제한 없음"}) 밖이라 방문자에게는 보이지 않습니다(미리보기에는 표시).`);
    }
    note.textContent = parts.join(" ");
  }

  /* ───────────── 미리보기 ───────────── */
  function renderPreview() {
    mountPreviewFrame(false);
    fitPreviewFrame();
    sendPreviewConfig(false);
    updatePreviewNote();

    const nowTab = sortedByOrder(config().navigation.tabs).find((tab) => tab.id === state.sectionTab[state.site]);
    const head = $("#preview-site");
    if (head) head.textContent = nowTab && nowTab.label ? `${current().name} · ${nowTab.label}` : current().name;
    const live = $("#preview-live-link");
    if (live) live.href = current().liveUrl;
  }

  /* ───────────── 배포 ───────────── */
  function buildConfigForSave(siteId) {
    const id = siteId || state.site;
    const site = SITES[id];
    const cfg = clone(state.configs[id]);
    cfg.site = id;
    cfg.siteName = cfg.copy.siteTitle || site.name;
    cfg.meta = cfg.meta || {};
    cfg.meta.updatedBy = state.session && state.session.login ? `moa-admin (@${state.session.login})` : "moa-admin";
    cfg.meta.updatedAt = new Date().toISOString();
    cfg.banner.updatedAt = cfg.banner.enabled ? cfg.meta.updatedAt : cfg.banner.updatedAt || null;
    cfg.popup.updatedAt = cfg.popup.enabled ? cfg.meta.updatedAt : cfg.popup.updatedAt || null;
    if (cfg.figurePopup && typeof cfg.figurePopup === "object") {
      cfg.figurePopup.updatedAt = cfg.figurePopup.enabled ? cfg.meta.updatedAt : cfg.figurePopup.updatedAt || null;
    }
    // 순서 필드를 항상 1부터 정리해 둔다. 섹션은 ‘탭 순서 → 탭 안 순서’로 늘어놓아
    // 각 탭의 섹션이 연속된 order 를 갖게 한다(사이트는 같은 탭 안에서만 정렬한다).
    cfg.navigation.tabs = renumber(sortedByOrder(cfg.navigation.tabs));
    const tabRank = new Map(cfg.navigation.tabs.map((tab, i) => [tab.id, i]));
    const rankOf = (section) => (tabRank.has(sectionTabOf(section, id)) ? tabRank.get(sectionTabOf(section, id)) : 999);
    cfg.navigation.sections = cfg.navigation.sections.slice()
      .sort((a, b) => rankOf(a) - rankOf(b) || (a.order || 0) - (b.order || 0))
      .map((section, i) => {
        const out = Object.assign({}, section, { order: i + 1, tab: sectionTabOf(section, id) });
        if (!out.body) delete out.body;
        return out;
      });
    cfg.cards = renumber(sortedByOrder(cfg.cards));
    if (cfg.popup.enabled && !cfg.popup.id) cfg.popup.id = `popup-${Date.now()}`;
    return cfg;
  }

  function setResult(html, isError) {
    const box = $("#deploy-result");
    if (!html) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.classList.toggle("error", Boolean(isError));
    box.innerHTML = html;
  }

  /* 저장·배포 — options.skipConfirm 이면 기본 확인 대화상자를 건너뛴다(부르는 쪽이 더 자세한 확인을 이미 받은 경우).
     outcome 만큼 커밋하면 true, 중단·실패하면 false 를 돌려준다(호출한 쪽이 결과를 알 수 있게). */
  async function saveToGitHub(options) {
    const opts = options || {};
    const site = current();
    const session = state.session || {};
    const viaServer = session.mode === "idpw";
    if (session.mode === "demo") {
      setResult(`<h4>데모 모드입니다</h4><p>실제 저장은 아이디로 로그인해야 합니다. 지금 설정은 ‘JSON 내려받기’로 파일로 보관할 수 있어요.</p>
        <p>로그아웃 후 아이디·비밀번호로 다시 로그인하면 <code>${esc(site.repo)}</code> 의 <code>${esc(site.path)}</code> 로 바로 커밋됩니다.</p>`, true);
      setTab("deploy");
      return false;
    }
    if (!viaServer && !session.token) {
      setResult("<h4>로그인이 필요합니다</h4><p>관리자 키만으로 로그인한 상태라 저장은 할 수 없습니다. 아이디로 다시 로그인해 주세요.</p>", true);
      setTab("deploy");
      return false;
    }
    if (!viaServer && session.repos && session.repos[site.id] === false) {
      setResult(`<h4>쓰기 권한이 없습니다</h4><p>이 토큰으로는 <code>${esc(site.repo)}</code> 에 커밋할 수 없습니다. GitHub 저장소 권한(Contents: Read and write)을 확인해 주세요.</p>`, true);
      setTab("deploy");
      return false;
    }
    // 저장된 설정을 아직 못 읽은 상태(기본값·불러오기 실패)에서 저장하면 화면의 기본값으로 덮어쓴다 — 한 번 더 확인한다.
    const sourceNow = String(state.source[site.id] || "");
    if (/^(기본값|불러오기 실패|GitHub에 아직|아직 설정 파일 없음)/.test(sourceNow)) {
      const ok = window.confirm(`${site.name}의 저장된 설정을 아직 읽지 못했습니다(지금 화면: ${sourceNow}).\n\n이대로 저장하면 화면의 기본값이 저장소 파일을 덮어씁니다. 먼저 ‘현재 값 불러오기’를 누르는 것이 안전합니다.\n\n그래도 저장할까요?`);
      if (!ok) return false;
    }
    if (opts.skipConfirm !== true && !window.confirm(`${site.name} (${site.repo}) 의 ${site.path} 에 저장하고 배포할까요?`)) return false;

    const payload = buildConfigForSave();
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    const contentPath = `/repos/${site.repo}/contents/${site.path}`;
    const buttons = [$("#btn-save"), $("#btn-save-top")];
    buttons.forEach((b) => { if (b) b.disabled = true; });
    setResult("<h4>커밋하는 중…</h4><p>복지모아 서버가 GitHub에 설정 파일을 올리고 있습니다.</p>", false);

    try {
      let commit = {};
      if (viaServer) {
        // 아이디 로그인 모드: 서버가 보관한 PAT 로 대신 커밋한다(브라우저에 토큰이 없다).
        const put = await apiRequest("/api/admin/repo-config", {
          method: "PUT",
          json: true,
          body: JSON.stringify({
            site: site.id,
            config: payload,
            message: `chore(config): ${site.name} 사이트 설정 업데이트 (moa-admin)`
          })
        });
        if (!put.ok) {
          setResult(`<h4>커밋하지 못했습니다</h4><p>${esc(put.error)}${put.status ? ` (HTTP ${put.status})` : ""}</p>
            <p>${put.status === 401 || put.status === 403 ? "로그인을 다시 해 주세요." : "잠시 뒤 다시 시도하거나 서버 상태를 확인해 주세요."}</p>`, true);
          return false;
        }
        commit = (put.data && put.data.commit) || {};
      } else {
        const head = await ghRequest(`${contentPath}?ref=${encodeURIComponent(site.branch)}`);
        let sha = null;
        if (head.ok && head.data && head.data.sha) sha = head.data.sha;
        else if (head.status !== 404) {
          setResult(`<h4>현재 파일을 읽지 못했습니다</h4><p>${esc(head.error || "알 수 없는 오류")}</p>`, true);
          return false;
        }

        const body = {
          message: `chore(config): ${site.name} 사이트 설정 업데이트 (moa-admin)`,
          content: toBase64(json),
          branch: site.branch,
          committer: {
            name: "모아 어드민",
            email: "moa-admin@users.noreply.github.com"
          }
        };
        if (sha) body.sha = sha;

        const put = await ghRequest(contentPath, { method: "PUT", body: JSON.stringify(body) });
        if (!put.ok) {
          setResult(`<h4>커밋하지 못했습니다</h4><p>${esc(put.error)}${put.status ? ` (HTTP ${put.status})` : ""}</p>
            <p>토큰 권한과 저장소 이름을 확인해 주세요.</p>`, true);
          return false;
        }
        commit = (put.data && put.data.commit) || {};
      }

      const shortSha = (commit.shortSha || commit.sha || "").slice(0, 7);
      const commitUrl = commit.htmlUrl || commit.html_url || "#";
      setResult(`<h4>배포 커밋 완료 ✅</h4>
        <p><b>커밋</b> <code>${esc(shortSha || "(SHA 없음)")}</code> · <a href="${esc(commitUrl)}" target="_blank" rel="noreferrer">GitHub에서 보기</a></p>
        <p><b>저장 위치</b> ${esc(site.repo)} / ${esc(site.path)} (${esc(site.branch)})</p>
        <p><b>반영 예상</b> ${esc(site.deployKind)} — ${esc(site.deployEta)}</p>
        <p><b>바뀐 내용</b> 공지 배너 ${payload.banner.enabled ? "ON" : "OFF"} · 팝업 ${payload.popup.enabled ? "ON" : "OFF"} · 탭 ${payload.navigation.tabs.filter((t) => t.visible).length}개 노출</p>
        <p><a href="${esc(site.liveUrl)}" target="_blank" rel="noreferrer">사이트 열어서 확인하기 →</a></p>`, false);

      state.configs[state.site] = payload;
      clearDirty(state.site);
      state.source[state.site] = `커밋 ${shortSha}`;
      addLog(`${site.name} 설정 커밋 ${shortSha}`);
      renderAll();
      toast("커밋했습니다. 잠시 뒤 사이트에 반영됩니다.");
      return true;
    } finally {
      buttons.forEach((b) => { if (b) b.disabled = false; });
    }
  }

  async function pullConfig(siteId, silent) {
    const site = SITES[siteId];
    const session = state.session || {};
    const viaServer = session.mode === "idpw";
    if (!viaServer && !session.token) {
      if (!silent) toast("아이디로 로그인해야 현재 설정을 불러올 수 있어요.", true);
      return;
    }
    if (!silent && state.dirty[siteId]) {
      const ok = window.confirm("저장하지 않은 편집 내용이 있습니다. GitHub의 현재 값으로 덮어쓸까요?");
      if (!ok) return;
    }

    let parsed = null;
    let sha = "";
    let label = "GitHub";
    if (viaServer) {
      const res = await apiRequest(`/api/admin/repo-config?site=${encodeURIComponent(siteId)}`);
      if (res.ok && res.data && res.data.exists === false) {
        state.source[siteId] = "아직 설정 파일 없음 (기본값 사용)";
        if (siteId === state.site) renderAll();
        if (!silent) toast("아직 저장소에 설정 파일이 없어 기본값을 쓰고 있어요.");
        return;
      }
      if (!res.ok || !res.data || !res.data.config) {
        if (!silent) toast(`설정을 불러오지 못했습니다: ${(res.data && res.data.error) || res.error}`, true);
        state.source[siteId] = `불러오기 실패 (${res.error})`;
        if (siteId === state.site) renderAll();
        return;
      }
      parsed = res.data.config;
      sha = res.data.sha || "";
      label = "서버";
    } else {
      const res = await ghRequest(`/repos/${site.repo}/contents/${site.path}?ref=${encodeURIComponent(site.branch)}`);
      if (res.status === 404) {
        state.source[siteId] = "GitHub에 아직 설정 파일 없음 (기본값 사용)";
        if (siteId === state.site) renderAll();
        if (!silent) toast("아직 저장소에 설정 파일이 없어 기본값을 쓰고 있어요.");
        return;
      }
      if (!res.ok || !res.data || !res.data.content) {
        if (!silent) toast(`설정을 불러오지 못했습니다: ${res.error}`, true);
        state.source[siteId] = `불러오기 실패 (${res.error})`;
        if (siteId === state.site) renderAll();
        return;
      }
      try {
        parsed = JSON.parse(fromBase64(res.data.content));
      } catch (err) {
        if (!silent) toast("설정 파일을 해석하지 못했습니다(JSON 형식 오류).", true);
        return;
      }
      sha = res.data.sha || "";
    }

    try {
      const merged = Object.assign(clone(site.defaults), parsed);
      merged.navigation = Object.assign({ tabs: [], sections: [] }, parsed.navigation || {});
      merged.copy = Object.assign(clone(site.defaults.copy), parsed.copy || {});
      merged.banner = Object.assign(clone(site.defaults.banner), parsed.banner || {});
      merged.popup = Object.assign(clone(site.defaults.popup), parsed.popup || {});
      // figurePopup 은 포케모아에만 있는 팝업 설정이다(복지모아 defaults 에는 없음).
      merged.figurePopup = Object.assign(clone(site.defaults.figurePopup || {}), parsed.figurePopup || {});
      merged.cards = Array.isArray(parsed.cards) && parsed.cards.length ? parsed.cards : clone(site.defaults.cards);
      merged.features = Object.assign(clone(site.defaults.features || {}), parsed.features || {});
      state.configs[siteId] = merged;
      const savedAt = parsed.meta && parsed.meta.updatedAt ? fmtDateTime(parsed.meta.updatedAt) : "";
      state.source[siteId] = `${label} ${String(sha).slice(0, 7)}${savedAt ? ` (${savedAt})` : ""}`;
      clearDirty(siteId);
      if (siteId === state.site) renderAll();
      if (!silent) toast("사이트의 현재 설정을 불러왔습니다.");
    } catch (err) {
      if (!silent) toast("설정 파일을 반영하지 못했습니다.", true);
    }
  }

  function exportJson() {
    const payload = buildConfigForSave();
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `site-config.${state.site}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    addLog(`${current().name} JSON 내려받기`);
  }

  function importJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || !parsed.copy) throw new Error("형식이 맞지 않습니다");
        const site = current();
        const merged = Object.assign(clone(site.defaults), parsed);
        merged.navigation = Object.assign({ tabs: [], sections: [] }, parsed.navigation || {});
        merged.copy = Object.assign(clone(site.defaults.copy), parsed.copy || {});
        merged.banner = Object.assign(clone(site.defaults.banner), parsed.banner || {});
        merged.popup = Object.assign(clone(site.defaults.popup), parsed.popup || {});
        merged.figurePopup = Object.assign(clone(site.defaults.figurePopup || {}), parsed.figurePopup || {});
        merged.cards = Array.isArray(parsed.cards) && parsed.cards.length ? parsed.cards : clone(site.defaults.cards);
        merged.features = Object.assign(clone(site.defaults.features || {}), parsed.features || {});
        state.configs[state.site] = merged;
        markDirty(true);
        renderAll();
        toast("JSON을 불러왔습니다. 내용을 확인하고 저장하세요.");
      } catch (err) {
        toast("JSON 파일을 읽지 못했습니다. 형식을 확인해 주세요.", true);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetConfig() {
    if (!window.confirm("이 사이트의 설정을 기본값으로 되돌릴까요? 저장 전에는 사이트에 반영되지 않습니다.")) return;
    state.configs[state.site] = clone(current().defaults);
    state.source[state.site] = "기본값";
    markDirty(true);
    renderAll();
    toast("기본값으로 되돌렸습니다.");
  }

  function renderDeployTarget() {
    const site = current();
    const cfg = config();
    const box = $("#deploy-target");
    if (!box) return;
    box.innerHTML = `
      <dt>저장소</dt><dd>${esc(site.repo)}</dd>
      <dt>경로</dt><dd>${esc(site.path)}</dd>
      <dt>브랜치</dt><dd>${esc(site.branch)}</dd>
      <dt>배포</dt><dd>${esc(site.deployKind)} · ${esc(site.deployEta)}</dd>
      <dt>설정 출처</dt><dd>${esc(state.source[state.site] || "기본값")}</dd>
      <dt>마지막 수정</dt><dd>${esc((cfg.meta && cfg.meta.updatedAt) ? fmtDateTime(cfg.meta.updatedAt) : "아직 저장한 적 없음")}</dd>
      <dt>사이트</dt><dd><a href="${esc(site.liveUrl)}" target="_blank" rel="noreferrer">${esc(site.liveUrl)}</a></dd>`;
  }

  function renderChecks() {
    const box = $("#session-checks");
    if (!box) return;
    const session = state.session || {};
    const items = [];
    if (session.mode === "demo") {
      items.push(["info", "데모 모드 — 실제 커밋은 하지 않습니다."]);
    } else if (session.mode === "idpw") {
      items.push(["ok", `${esc(session.login)} 아이디로 로그인됨 (복지모아 서버 프록시)`]);
      items.push(["ok", "저장·불러오기: bokjimoa.onrender.com 서버가 대신 커밋합니다"]);
      items.push(["ok", "문의 조회·삭제: 아이디 로그인 토큰으로 연결됩니다"]);
    } else if (session.mode === "live") {
      items.push(["ok", `GitHub @${esc(session.login)} 토큰 확인됨`]);
      Object.keys(SITES).forEach((id) => {
        const ok = session.repos && session.repos[id];
        items.push([ok ? "ok" : "bad", `${SITES[id].repo} 쓰기 권한 ${ok ? "있음" : "없음"}`]);
      });
    } else {
      items.push(["wait", "관리자 키 모드 — 저장 기능은 잠겨 있습니다."]);
    }
    if (session.mode !== "idpw") {
      items.push([session.key ? "ok" : "wait", session.key ? "복지모아 관리자 키 저장됨" : "복지모아 관리자 키 없음 (문의 조회 불가)"]);
    }
    box.innerHTML = items.map(([cls, text]) => {
      const mark = cls === "ok" ? "✓" : cls === "bad" ? "✕" : "•";
      return `<li><span class="${cls}">${mark}</span><span>${text}</span></li>`;
    }).join("");
  }

  /* ───────────── 활동 로그 ───────────── */
  function addLog(text) {
    const entry = { time: new Date().toISOString(), text };
    state.log.unshift(entry);
    state.log = state.log.slice(0, 20);
    try { localStorage.setItem(LS.log, JSON.stringify(state.log)); } catch (err) { /* 무시 */ }
    renderActivityLog();
  }
  function renderActivityLog() {
    const box = $("#activity-log");
    if (!box) return;
    if (!state.log.length) { box.innerHTML = '<li class="muted">아직 기록이 없습니다.</li>'; return; }
    box.innerHTML = state.log.map((item) => {
      const d = new Date(item.time);
      return `<li><time>${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}</time><span>${esc(item.text)}</span></li>`;
    }).join("");
  }

  /* ───────────── 문의 ───────────── */
  function saveInquiryKey() {
    if (state.session && state.session.mode === "idpw") {
      toast("아이디로 로그인한 상태에서는 문의가 자동으로 연결됩니다.");
      loadInquiries();
      return;
    }
    const value = $("#inquiry-key").value.trim();
    if (!value) { toast("관리자 키를 입력해 주세요.", true); return; }
    state.session.key = value;
    saveSession(state.session);
    addLog("복지모아 관리자 키 저장");
    renderChecks();
    toast("키를 저장했습니다.");
    loadInquiries();
  }
  function forgetInquiryKey() {
    state.session.key = "";
    saveSession(state.session);
    $("#inquiry-key").value = "";
    state.inquiries = { loading: false, error: "", list: [], byStatus: null, total: 0, operatorEmail: "", loadedAt: "" };
    const pill = $("#inquiry-conn");
    if (pill) { pill.textContent = "연결 전"; pill.className = "status-pill"; }
    const info = $("#inquiry-msg");
    if (info) info.textContent = "‘새로고침’을 누르면 문의를 불러옵니다.";
    renderChecks();
    renderInquiries();
    toast("키를 지웠습니다.");
  }

  async function loadInquiries() {
    const session = state.session || {};
    const viaServer = session.mode === "idpw";
    const info = $("#inquiry-msg");
    if (!viaServer && !session.key) {
      info.textContent = "아이디로 로그인하거나 관리자 키를 먼저 입력해 주세요.";
      $("#inquiry-conn").textContent = "연결 전";
      $("#inquiry-conn").className = "status-pill";
      return;
    }
    const status = $("#inquiry-status").value;
    state.inquiries.loading = true;
    info.textContent = "불러오는 중…";
    try {
      const res = await apiRequest(`/api/admin/inquiries?limit=100${status ? `&status=${encodeURIComponent(status)}` : ""}`);
      const data = res.data;
      if (!res.ok || !data) {
        throw new Error(res.error || `HTTP ${res.status}`);
      }
      state.inquiries = {
        loading: false,
        error: "",
        list: data.inquiries || [],
        byStatus: data.byStatus || null,
        total: data.total || 0,
        operatorEmail: data.operatorEmail || "",
        loadedAt: new Date().toISOString()
      };
      const pill = $("#inquiry-conn");
      pill.textContent = "연결됨";
      pill.className = "status-pill ok";
      info.textContent = `문의 ${data.total}건${state.inquiries.operatorEmail ? ` · 알림 메일 ${state.inquiries.operatorEmail}` : ""}`;
    } catch (err) {
      state.inquiries.loading = false;
      state.inquiries.error = err.message || "알 수 없는 오류";
      state.inquiries.list = [];
      const pill = $("#inquiry-conn");
      pill.textContent = "오류";
      pill.className = "status-pill bad";
      const isCors = err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(err.message));
      info.textContent = isCors
        ? "브라우저 직접 호출이 막혔습니다(CORS 또는 네트워크). 복지모아 서버가 moa-kr.github.io 출처를 허용하는지 확인해 주세요."
        : `불러오지 못했습니다: ${err.message}`;
    }
    renderInquiries();
  }

  function renderInquiries() {
    const list = $("#inquiry-list");
    const stats = $("#inquiry-stats");
    if (!list) return;
    const inf = state.inquiries;
    if (stats) {
      if (inf.byStatus) {
        const label = { new: "신규", read: "읽음", done: "완료" };
        stats.innerHTML = Object.keys(label).map((k) =>
          `<span class="stat">${label[k]}<b>${Number(inf.byStatus[k] || 0)}</b></span>`).join("") +
          `<span class="stat">전체<b>${Number(inf.total || 0)}</b></span>`;
        stats.hidden = false;
      } else {
        stats.hidden = true;
      }
    }
    const keyInput = $("#inquiry-key");
    const keyRow = $("#inquiry-key-row");
    const authNote = $("#inquiry-auth-note");
    const viaServer = Boolean(state.session && state.session.mode === "idpw");
    if (keyRow) keyRow.hidden = viaServer;
    if (authNote) authNote.hidden = !viaServer;
    const authTag = $("#inquiry-auth-tag");
    if (authTag) authTag.textContent = viaServer ? "아이디 로그인" : "x-sync-key";
    if (keyInput && state.session && state.session.key && !keyInput.value) keyInput.value = state.session.key;

    if (inf.loading) { list.innerHTML = '<p class="note">불러오는 중…</p>'; return; }
    if (!inf.list.length) {
      list.innerHTML = `<p class="note">${inf.error ? esc(inf.error) : "표시할 문의가 없습니다."}</p>`;
      return;
    }
    const statusLabel = { new: "신규", read: "읽음", done: "완료" };
    list.innerHTML = inf.list.map((item) => {
      const id = Number(item.id);
      return `
      <article class="inq" data-id="${id}">
        <div class="inq-top">
          <span class="badge">${esc(item.type || "문의")}</span>
          <span class="badge ${esc(item.status || "new")}">${esc(statusLabel[item.status] || item.status || "신규")}</span>
          <span class="inq-time">#${id} · ${esc(fmtDateTime(item.createdAt))}</span>
        </div>
        <p class="inq-msg">${esc(item.message)}</p>
        <div class="inq-meta">
          ${item.email ? `<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>` : '<span>회신 이메일 없음</span>'}
          ${item.page ? `<span>· ${esc(item.page)}</span>` : ""}
          <span class="inq-actions">
            ${inquiryStatusActions(item.status).map((action) =>
              `<button type="button" class="btn btn-sm btn-ghost" data-status="${esc(action.status)}" data-id="${id}" title="이 문의를 ‘${esc(statusLabel[action.status])}’ 상태로 바꿉니다">${esc(action.text)}</button>`).join("")}
            <button type="button" class="btn btn-sm btn-danger" data-del="${id}">삭제</button>
          </span>
        </div>
      </article>`;
    }).join("");
  }

  /* 지금 상태에 따라 보여 줄 다른 상태 버튼 — 지금 상태는 빼고 둘만 둔다.
     new → 읽음·완료 / read → 완료·새 문의 / done → 다시 열기(읽음)·새 문의 */
  function inquiryStatusActions(status) {
    const now = status === "read" || status === "done" ? status : "new";
    const order = now === "new" ? ["read", "done"] : now === "read" ? ["done", "new"] : ["read", "new"];
    const label = { new: "새 문의", read: "읽음", done: "완료" };
    return order.map((next) => ({
      status: next,
      text: next === "read" && now === "done" ? "다시 열기" : label[next]
    }));
  }

  /* 상태 변경 뒤 서버가 준 byStatus(없으면 지금 건수에서 한 건만 옴기는 계산)로 현황을 맞춘다. */
  function applyInquiryCounts(serverByStatus, prevStatus, nextStatus) {
    const counts = { new: 0, read: 0, done: 0 };
    if (serverByStatus && typeof serverByStatus === "object") {
      ["new", "read", "done"].forEach((key) => { counts[key] = Math.max(0, Number(serverByStatus[key]) || 0); });
    } else {
      const before = state.inquiries.byStatus || {};
      ["new", "read", "done"].forEach((key) => { counts[key] = Math.max(0, Number(before[key]) || 0); });
      if (prevStatus && counts[prevStatus] > 0) counts[prevStatus] -= 1;
      if (counts[nextStatus] !== undefined) counts[nextStatus] += 1;
    }
    state.inquiries.byStatus = counts;
    state.inquiries.total = counts.new + counts.read + counts.done;
    const info = $("#inquiry-msg");
    if (info) {
      info.textContent = `문의 ${state.inquiries.total}건${state.inquiries.operatorEmail ? ` · 알림 메일 ${state.inquiries.operatorEmail}` : ""}`;
    }
  }

  /* 받침에 따른 조사 ‘으로/로’ — ‘신규’로 · ‘읽음’으로 · ‘완료’로 처럼 읽히게 한다. */
  function roParticle(word) {
    const text = String(word || "");
    const code = text.charCodeAt(text.length - 1);
    const hasFinal = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : true;
    return hasFinal ? "으로" : "로";
  }

  /* 문의 한 건의 상태를 new·read·done 중 하나로 바꾼다(PATCH /api/admin/inquiries/:id).
     서버가 돌려준 byStatus 로 현황 건수를 맞추고, 고른 상태 필터와 달라진 문의는 목록에서 뺀다. */
  async function changeInquiryStatus(btn) {
    const id = Number(btn.dataset.id);
    const next = btn.dataset.status;
    if (!id || ["new", "read", "done"].indexOf(next) < 0) return;
    const label = { new: "신규", read: "읽음", done: "완료" };
    const card = btn.closest(".inq");
    const buttons = card ? Array.prototype.slice.call(card.querySelectorAll("button")) : [];
    const before = btn.textContent;
    buttons.forEach((b) => { b.disabled = true; });
    btn.textContent = "바꾸는 중…";
    const item = (state.inquiries.list || []).find((row) => Number(row.id) === id);
    const prev = item ? item.status : "";
    try {
      const res = await apiRequest(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        json: true,
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      const data = res.data || {};
      const saved = data.inquiry && data.inquiry.status ? data.inquiry.status : next;
      if (item) item.status = saved;
      applyInquiryCounts(data.byStatus, prev, saved);
      // ‘신규만 보기’ 같은 필터가 켜져 있는데 그 상태를 벗어났다면 목록에서 뺀다.
      const filter = $("#inquiry-status") ? $("#inquiry-status").value : "";
      if (filter && filter !== saved) {
        state.inquiries.list = (state.inquiries.list || []).filter((row) => Number(row.id) !== id);
      }
      renderInquiries();
      addLog(`문의 #${id} 상태 → ${label[saved] || saved}`);
      toast(`문의 #${id} 를 ‘${label[saved] || saved}’${roParticle(label[saved] || saved)} 바꿨습니다.`);
    } catch (err) {
      btn.textContent = before;
      buttons.forEach((b) => { b.disabled = false; });
      toast(`상태를 바꾸지 못했습니다: ${err.message}`, true);
    }
  }

  async function handleInquiryClick(event) {
    const statusBtn = event.target.closest("button[data-status]");
    if (statusBtn) { await changeInquiryStatus(statusBtn); return; }
    const btn = event.target.closest("button[data-del]");
    if (!btn) return;
    const id = Number(btn.dataset.del);
    if (!id) return;
    if (!window.confirm(`문의 #${id} 를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    btn.disabled = true;
    btn.textContent = "삭제 중…";
    try {
      const res = await apiRequest(`/api/admin/inquiries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(res.error || `HTTP ${res.status}`);
      }
      addLog(`문의 #${id} 삭제`);
      toast(`문의 #${id} 를 삭제했습니다.`);
      await loadInquiries();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "삭제";
      toast(`삭제하지 못했습니다: ${err.message}`, true);
    }
  }

  /* ───────────── 👥 가입자·글 (2026-11-24) ─────────────
     복지모아 서버의 GET /api/admin/users · GET /api/admin/submissions 를 그대로 그린다.
     서버가 비밀번호·솔트·카카오 ID 원문을 보내지 않으므로 화면에도 인증 여부만 남는다. */
  function peopleFilterText() {
    return String(state.people.filter || "").trim().toLowerCase();
  }

  /* 체크한 회원 — 화면을 다시 그려도 선택이 유지되도록 id 배열로만 들고 있는다. */
  function peopleSelection() {
    return Array.isArray(state.people.selected) ? state.people.selected : [];
  }
  function syncPeopleSelectionUi() {
    const picked = peopleSelection();
    const label = $("#people-picked");
    if (label) label.textContent = `선택 ${picked.length}명`;
    const all = $("#people-checkall");
    const boxes = $$("#people-users .people-check");
    if (all) {
      all.checked = boxes.length > 0 && picked.length === boxes.length;
      all.indeterminate = picked.length > 0 && picked.length < boxes.length;
    }
  }

  const PEOPLE_ACTION_LABEL = {
    suspend3: "3일 정지", suspend7: "7일 정지", suspend30: "30일(1달) 정지", ban: "영구 차단", clear: "정지·차단 해제"
  };

  async function moderatePeople(action) {
    const ids = peopleSelection();
    if (!Object.prototype.hasOwnProperty.call(PEOPLE_ACTION_LABEL, action)) return;
    const msg = $("#people-mod-msg");
    if (!ids.length) {
      toast("가입자 목록에서 회원을 먼저 체크해 주세요.", true);
      if (msg) msg.textContent = "가입자 목록에서 회원을 먼저 체크해 주세요.";
      return;
    }
    const label = PEOPLE_ACTION_LABEL[action];
    const reasonInput = $("#people-reason");
    const reason = reasonInput ? reasonInput.value.trim() : "";
    if (!window.confirm(`${ids.length}명에게 ‘${label}’을(를) 적용할까요?`)) return;
    const buttons = $$("[data-moderate]");
    buttons.forEach((btn) => { btn.disabled = true; });
    if (msg) msg.textContent = `${label} 적용 중…`;
    try {
      const res = await apiRequest("/api/admin/users/moderate", {
        method: "POST",
        json: true,
        body: JSON.stringify({ ids, action, reason })
      });
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      const data = res.data || {};
      addLog(`회원 ${label} — ${data.affected || ids.length}명`);
      toast(`${data.affected || ids.length}명에게 ‘${label}’을(를) 적용했습니다.`);
      if (msg) msg.textContent = `${label} 완료 — 정지 ${fmtCount(data.suspended)}명 · 영구 차단 ${fmtCount(data.banned)}명`;
      if (reasonInput) reasonInput.value = "";
      state.people.selected = [];
      await loadPeople();
    } catch (err) {
      if (msg) msg.textContent = `적용하지 못했습니다: ${err.message}`;
      toast(`적용하지 못했습니다: ${err.message}`, true);
    } finally {
      buttons.forEach((btn) => { btn.disabled = false; });
    }
  }

  async function moderateItem(action, id, next, button) {
    if (!id) return;
    if (action === "delete" && !window.confirm(`복지 항목 #${id} 를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    if (button) button.disabled = true;
    try {
      let res;
      if (action === "delete") {
        res = await apiRequest(`/api/admin/welfare/${id}`, { method: "DELETE" });
      } else {
        const patch = action === "verify" ? { isVerified: next === "true" } : { isHidden: next === "true" };
        res = await apiRequest(`/api/admin/welfare/${id}`, { method: "PATCH", json: true, body: JSON.stringify(patch) });
      }
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      addLog(`글 #${id} ${action === "delete" ? "삭제" : (action === "verify" ? "검증 상태 변경" : "숨김 상태 변경")}`);
      toast(action === "delete" ? `글 #${id} 를 삭제했습니다.` : `글 #${id} 상태를 바꿨습니다.`);
      await loadPeople();
    } catch (err) {
      if (button) button.disabled = false;
      toast(`적용하지 못했습니다: ${err.message}`, true);
    }
  }

  function handlePeopleUsersChange(event) {
    const box = event.target.closest("input.people-check");
    if (!box) return;
    const id = Number(box.dataset.id);
    if (!id) return;
    const picked = peopleSelection().slice();
    const index = picked.indexOf(id);
    if (box.checked && index === -1) picked.push(id);
    if (!box.checked && index !== -1) picked.splice(index, 1);
    state.people.selected = picked;
    syncPeopleSelectionUi();
  }

  function handlePeopleCheckAll(event) {
    const on = Boolean(event.target.checked);
    state.people.selected = on
      ? $$("#people-users .people-check").map((box) => Number(box.dataset.id)).filter(Boolean)
      : [];
    $$("#people-users .people-check").forEach((box) => { box.checked = on; });
    syncPeopleSelectionUi();
  }

  function handlePeopleItemsClick(event) {
    const btn = event.target.closest("button[data-item-action]");
    if (!btn) return;
    moderateItem(btn.dataset.itemAction, Number(btn.dataset.id), btn.dataset.next, btn);
  }

  async function loadPeople() {
    const pill = $("#people-conn");
    const msg = $("#people-msg");
    if (!pill || !msg) return;
    if (!signedIn()) {
      state.people.loading = false;
      state.people.users = null;
      state.people.subs = null;
      pill.textContent = "로그인 필요";
      pill.className = "status-pill wait";
      msg.textContent = "아이디로 로그인하면 가입자와 새로 올라온 글을 서버에서 불러옵니다.";
      renderPeople();
      return;
    }
    if (state.people.loading) return;
    state.people.loading = true;
    pill.textContent = "불러오는 중";
    pill.className = "status-pill wait";
    msg.textContent = "불러오는 중…";
    const [usersRes, subsRes] = await Promise.all([
      apiRequest("/api/admin/users?limit=500"),
      apiRequest("/api/admin/submissions?limit=100")
    ]);
    if (!usersRes.ok || !subsRes.ok) {
      state.people.loading = false;
      state.people.users = null;
      state.people.subs = null;
      state.people.error = usersRes.error || subsRes.error || "불러오지 못했습니다.";
      const status = usersRes.status || subsRes.status || 0;
      pill.textContent = status === 401 || status === 403 ? "인증 필요" : "오류";
      pill.className = "status-pill bad";
      msg.textContent = status === 401 || status === 403
        ? "로그인이 필요합니다. 아이디로 로그인한 뒤 새로고침해 주세요."
        : `불러오지 못했습니다: ${state.people.error}`;
      renderPeople();
      return;
    }
    state.people.loading = false;
    state.people.error = "";
    state.people.users = usersRes.data || null;
    state.people.subs = subsRes.data || null;
    state.people.loadedAt = new Date().toISOString();
    // 가입 시도 로그는 따로 읽는다(이 엔드포인트가 아직 없는 서버여도 가입자 목록은 보이게).
    loadAttempts();
    // 목록에서 사라진 회원은 선택에서도 뺀다(제재 직후 새로고침 대비).
    const alive = new Set((usersRes.data && usersRes.data.users || []).map((user) => Number(user.id)));
    state.people.selected = peopleSelection().filter((id) => alive.has(Number(id)));
    pill.textContent = "연결됨";
    pill.className = "status-pill ok";
    const u = state.people.users || {};
    const s = state.people.subs || {};
    msg.textContent = `가입자 ${fmtCount(u.total)}명 · 새로 쓴 복지 정보 ${fmtCount(s.itemTotal)}건 · 한 줄 팁 ${fmtCount(s.tipTotal)}건`;
    renderPeople();
  }

  /* ── 🧾 회원가입 시도 로그 (2026-11-28 v=61) ─────────────────────
     복지모아가 남기는 signup_attempts 를 그대로 보여 준다(최근 200건).
     이메일 원문은 서버가 저장하지 않으므로 표에도 @뒤 도메인만 나온다. */
  const ATTEMPT_LABELS = {
    success: { text: "성공", badge: "new" },
    pending: { text: "도메인 확인 대기", badge: "read" },
    blocked: { text: "차단", badge: "done" },
    error: { text: "오류", badge: "" }
  };

  async function loadAttempts() {
    const msg = $("#attempts-msg");
    const table = $("#attempts-table");
    if (!msg || !table) return;
    const count = $("#attempts-count");
    const tbody = table.querySelector("tbody");
    if (!signedIn()) {
      state.attempts.data = null;
      if (count) count.textContent = "";
      msg.textContent = "아이디로 로그인하면 가입 시도 로그를 불러옵니다.";
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="muted small">로그인이 필요합니다.</td></tr>';
      const summary = $("#attempts-summary");
      if (summary) summary.hidden = true;
      return;
    }
    if (state.attempts.loading) return;
    state.attempts.loading = true;
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="muted small">불러오는 중…</td></tr>';
    const filter = state.attempts.filter ? `&result=${encodeURIComponent(state.attempts.filter)}` : "";
    const res = await apiRequest(`/api/admin/signup-attempts?limit=200${filter}`);
    state.attempts.loading = false;
    if (!res.ok) {
      state.attempts.data = null;
      state.attempts.error = res.error || "불러오지 못했습니다.";
      if (count) count.textContent = "";
      msg.textContent = res.status === 401 || res.status === 403
        ? "로그인이 필요합니다. 아이디로 로그인한 뒤 새로고침해 주세요."
        : `불러오지 못했습니다: ${state.attempts.error}`;
      renderAttempts();
      return;
    }
    state.attempts.error = "";
    state.attempts.data = res.data || null;
    state.attempts.loadedAt = new Date().toISOString();
    const d = res.data || {};
    const c = d.counts || {};
    msg.textContent = `전체 ${fmtCount(d.total)}건 · 성공 ${fmtCount(c.success)} · 도메인 확인 대기 ${fmtCount(c.pending)} · 차단 ${fmtCount(c.blocked)} · 오류 ${fmtCount(c.error)}${d.lastAt ? ` · 최근 ${fmtDateTime(d.lastAt)}` : ""}`;
    if (count) count.textContent = `${fmtCount(d.total)}건`;
    renderAttempts();
  }

  /* 점검·테스트로 쌓인 가입 시도 기록을 지운다(2026-11-28 v=63 → 복지모아 v0.45.0 DELETE API).
     표 위 ‘결과’ 필터가 고른 범위만 지우고, ‘전체 결과’면 전부 지우되 건수를 알리는 확인을 한 번 더 받는다. */
  async function clearAttempts(button) {
    const data = state.attempts.data;
    if (!data) { toast("먼저 기록을 불러와 주세요."); return; }
    const filter = state.attempts.filter || "";
    const label = filter ? ((ATTEMPT_LABELS[filter] || {}).text || filter) : "전체";
    const count = filter ? Number((data.counts || {})[filter]) || 0 : Number(data.total) || 0;
    if (!count) { toast(filter ? `‘${label}’ 기록이 없습니다.` : "지울 기록이 없습니다."); return; }
    const warn = filter
      ? `‘${label}’ 가입 시도 기록 ${fmtCount(count)}건을 지웁니다.\n되돌릴 수 없습니다.`
      : `가입 시도 기록 ${fmtCount(count)}건을 모두 지웁니다.\n실제 가입 시도가 섞여 있으면 함께 지워집니다. 되돌릴 수 없습니다.`;
    if (!window.confirm(`${warn}\n\n계속할까요?`)) return;
    const original = button ? button.textContent : "";
    if (button) { button.disabled = true; button.textContent = "정리 중…"; }
    const query = filter ? `?result=${encodeURIComponent(filter)}` : "?all=1";
    const res = await apiRequest(`/api/admin/signup-attempts${query}`, { method: "DELETE" });
    if (button) { button.disabled = false; button.textContent = original; }
    if (!res.ok) { toast(res.error || "기록을 지우지 못했습니다.", true); return; }
    const deleted = Number((res.data || {}).deleted) || 0;
    const remaining = Number((res.data || {}).remaining) || 0;
    toast(`${fmtCount(deleted)}건을 지웠습니다. 남은 기록 ${fmtCount(remaining)}건.`);
    loadAttempts();
  }

  function renderAttempts() {
    const table = $("#attempts-table");
    const summary = $("#attempts-summary");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    const data = state.attempts.data;
    if (!data) {
      if (summary) { summary.hidden = true; summary.innerHTML = ""; }
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted small">${esc(state.attempts.error || "‘새로고침’을 눌러 불러와 주세요.")}</td></tr>`;
      return;
    }
    const c = data.counts || {};
    if (summary) {
      const cards = [
        { label: "전체 시도", value: data.total || 0, sub: data.lastAt ? `최근 ${fmtDateTime(data.lastAt)}` : "아직 기록 없음" },
        { label: "성공", value: c.success || 0, sub: "인증 메일까지 보냄" },
        { label: "도메인 확인 대기", value: c.pending || 0, sub: "관리자 확인 필요" },
        { label: "차단", value: c.blocked || 0, sub: "규칙에 걸림" },
        { label: "오류", value: c.error || 0, sub: "서버·메일 오류" }
      ];
      summary.innerHTML = cards.map((card) => `
        <div class="stat-card">
          <span>${esc(card.label)}</span>
          <strong>${esc(fmtCount(card.value))}</strong>
          <em>${esc(card.sub)}</em>
        </div>`).join("");
      summary.hidden = false;
    }
    const rows = data.attempts || [];
    if (!tbody) return;
    tbody.innerHTML = rows.length
      ? rows.map((row) => {
        const meta = ATTEMPT_LABELS[row.result] || { text: row.result || "-", badge: "" };
        return `
        <tr>
          <td><b>${esc(row.company || "(회사명 없음)")}</b></td>
          <td>${row.domain ? `@${esc(row.domain)}` : '<span class="muted">—</span>'}</td>
          <td><span class="badge ${meta.badge}">${esc(meta.text)}</span></td>
          <td>${esc(row.reason || "-")}</td>
          <td>${esc(fmtDateTime(row.createdAt))}</td>
        </tr>`;
      }).join("")
      : `<tr><td colspan="5" class="muted small">${state.attempts.filter ? "이 결과에 해당하는 시도가 없습니다." : "아직 가입 시도 기록이 없습니다."}</td></tr>`;
  }

  /* ‘도메인 확인 대기’ 회원을 확인(verified) 또는 되돌리기(pending) 처리한다. */
  async function confirmCompanyDomain(id, status, button) {
    if (!id || (status !== "verified" && status !== "pending")) return;
    if (status === "pending" && !window.confirm("이 회원의 재직 인증을 ‘도메인 확인 대기’로 되돌릴까요?")) return;
    const label = button ? button.textContent : "";
    if (button) { button.disabled = true; button.textContent = "처리 중…"; }
    const res = await apiRequest(`/api/admin/users/${id}/company-domain`, {
      method: "PATCH",
      json: true,
      body: JSON.stringify({ status })
    });
    if (button) { button.disabled = false; button.textContent = label; }
    if (!res.ok) { toast(res.error || "처리하지 못했습니다.", true); return; }
    toast(status === "verified" ? "도메인 확인 완료 — 재직 인증이 완성되었습니다." : "‘도메인 확인 대기’로 되돌렸습니다.");
    loadPeople();
  }

  function peopleCards() {
    const u = state.people.users || {};
    const s = state.people.subs || {};
    const total = Number(u.total) || 0;
    const verified = Number(u.verified) || 0;
    const rate = total ? Math.round((verified / total) * 100) : 0;
    return [
      { label: "가입자", value: total, sub: u.lastSignupAt ? `마지막 가입 ${fmtDateTime(u.lastSignupAt)}` : "아직 가입자 없음" },
      { label: "인증 완료", value: verified, sub: `미인증 ${fmtCount(u.unverified)}명 · ${rate}%` },
      { label: "카카오 연동", value: Number(u.kakaoLinked) || 0, sub: "선택 연동" },
      { label: "최근 7일 신규", value: Number(u.newLast7Days) || 0, sub: `30일 ${fmtCount(u.newLast30Days)}명` },
      { label: "사용자 복지 글", value: Number(s.itemTotal) || 0, sub: `시스템·자동 ${fmtCount(s.systemItemTotal)}건 제외` },
      { label: "한 줄 팁", value: Number(s.tipTotal) || 0, sub: s.latestAt ? `최근 ${fmtDateTime(s.latestAt)}` : "아직 없음" }
    ];
  }

  function renderPeople() {
    const summary = $("#people-summary");
    const usersBody = $("#people-users");
    if (!summary || !usersBody) return;
    const u = state.people.users;
    const s = state.people.subs;

    if (u) {
      summary.innerHTML = peopleCards().map((card) => `
        <div class="stat-card">
          <span>${esc(card.label)}</span>
          <strong>${esc(fmtCount(card.value))}</strong>
          <em>${esc(card.sub)}</em>
        </div>`).join("");
      summary.hidden = false;
    } else {
      summary.hidden = true;
      summary.innerHTML = "";
    }

    const usersTbody = $("#people-users tbody");
    const itemsTbody = $("#people-items tbody");
    const tipsTbody = $("#people-tips tbody");
    const usersCount = $("#people-users-count");
    const itemsCount = $("#people-items-count");
    const tipsCount = $("#people-tips-count");

    if (!u || !s) {
      const note = state.people.error ? esc(state.people.error) : (signedIn() ? "‘새로고침’을 눌러 불러와 주세요." : "아이디로 로그인하면 불러옵니다.");
      usersTbody.innerHTML = `<tr><td colspan="7" class="muted small">${note}</td></tr>`;
      itemsTbody.innerHTML = `<tr><td colspan="7" class="muted small">${note}</td></tr>`;
      tipsTbody.innerHTML = `<tr><td colspan="4" class="muted small">${note}</td></tr>`;
      [usersCount, itemsCount, tipsCount].forEach((el) => { if (el) el.textContent = ""; });
      syncPeopleSelectionUi();
      return;
    }

    const needle = peopleFilterText();
    const allUsers = (u.users || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const users = needle
      ? allUsers.filter((row) => `${row.email || ""} ${row.company || ""} ${row.kakaoNickname || ""}`.toLowerCase().includes(needle))
      : allUsers;
    if (usersCount) usersCount.textContent = needle
      ? `${fmtCount(users.length)} / ${fmtCount(u.total)}명`
      : `${fmtCount(u.total)}명 (최근 ${fmtCount(allUsers.length)}명 표시)`;
    const picked = peopleSelection();
    usersTbody.innerHTML = users.length
      ? users.map((row) => {
        const id = Number(row.id);
        const statusCell = row.status === "banned"
          ? `<span class="badge done">영구 차단</span>${row.banReason ? `<span class="cell-sub">${esc(row.banReason)}</span>` : ""}`
          : row.status === "suspended"
            ? `<span class="badge read">정지</span><span class="cell-sub">~ ${esc(fmtDateTime(row.suspendedUntil))}</span>${row.banReason ? `<span class="cell-sub">${esc(row.banReason)}</span>` : ""}`
            : '<span class="badge new">정상</span>';
        // 재직 인증이 ‘도메인 확인 대기’인 회원 — 여기서 한 번 누르면 확인 완료된다(2026-11-28 v=61).
        const domainCell = row.companyDomainStatus === "pending"
          ? `<span class="badge read">도메인 확인 대기</span><span class="cell-sub"><button type="button" class="btn btn-sm btn-ghost" data-domain-action="verified" data-id="${id}">✓ 도메인 확인</button></span>`
          : "";
        return `
        <tr>
          <td class="pick"><input type="checkbox" class="people-check" data-id="${id}"${picked.includes(id) ? " checked" : ""} aria-label="${esc(row.email)} 선택"></td>
          <td><b>${esc(row.email)}</b>${id ? `<span class="cell-sub">#${id}</span>` : ""}</td>
          <td>${esc(row.company || "-")}</td>
          <td>${row.verified ? '<span class="badge new">인증</span>' : '<span class="badge">미인증</span>'}</td>
          <td>${row.kakaoLinked ? `<span class="badge read">연동</span>${row.kakaoNickname ? `<span class="cell-sub">${esc(row.kakaoNickname)}</span>` : ""}` : "<span class=\"muted\">—</span>"}</td>
          <td>${statusCell}${domainCell}</td>
          <td>${esc(fmtDateTime(row.createdAt))}</td>
        </tr>`;
      }).join("")
      : `<tr><td colspan="7" class="muted small">${needle ? "조건에 맞는 가입자가 없습니다." : "아직 가입자가 없습니다."}</td></tr>`;
    syncPeopleSelectionUi();

    const items = s.items || [];
    if (itemsCount) itemsCount.textContent = `${fmtCount(s.itemTotal)}건`;
    itemsTbody.innerHTML = items.length
      ? items.map((row) => {
        const id = Number(row.id);
        const flagCell = `${row.isVerified ? '<span class="badge new">✓ 검증</span>' : '<span class="badge">미검증</span>'}${row.isHidden ? '<span class="badge done">숨김</span>' : ""}`;
        return `
        <tr>
          <td><b>${esc(row.title || "(제목 없음)")}</b>${row.detail ? `<span class="cell-sub">${esc(String(row.detail).slice(0, 70))}${String(row.detail).length > 70 ? "…" : ""}</span>` : ""}</td>
          <td>${esc(row.company || "-")}</td>
          <td>${esc(row.category || "-")}${row.jobType ? `<span class="cell-sub">${esc(row.jobType)}</span>` : ""}</td>
          <td>${row.authorEmail ? esc(row.authorEmail) : "<span class=\"muted\">작성자 없음</span>"}${row.authorCompany ? `<span class="cell-sub">${esc(row.authorCompany)}</span>` : ""}</td>
          <td>${flagCell}</td>
          <td class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-item-action="verify" data-id="${id}" data-next="${row.isVerified ? "false" : "true"}" title="운영자가 확인했으면 검증 배지를 붙입니다">${row.isVerified ? "검증 해제" : "✓ 검증"}</button>
            <button type="button" class="btn btn-sm btn-ghost" data-item-action="hide" data-id="${id}" data-next="${row.isHidden ? "false" : "true"}">${row.isHidden ? "숨김 해제" : "숨김"}</button>
            <button type="button" class="btn btn-sm btn-danger" data-item-action="delete" data-id="${id}">삭제</button>
          </td>
          <td>${esc(fmtDateTime(row.createdAt))}</td>
        </tr>`;
      }).join("")
      : '<tr><td colspan="7" class="muted small">사용자가 직접 올린 복지 정보가 아직 없습니다.</td></tr>';
    const itemsNote = $("#people-items-note");
    if (itemsNote) {
      const systemCount = Number(s.systemItemTotal) || 0;
      itemsNote.textContent = systemCount
        ? `시스템·자동 수집 항목 ${fmtCount(systemCount)}건은 사용자 작성 글이 아니라 목록에서 뺐습니다.`
        : "";
      itemsNote.hidden = !systemCount;
    }

    const tips = s.tips || [];
    if (tipsCount) tipsCount.textContent = `${fmtCount(s.tipTotal)}건`;
    tipsTbody.innerHTML = tips.length
      ? tips.map((row) => `
        <tr>
          <td>${esc(row.body || "")}</td>
          <td>${esc(row.welfareTitle || "-")}${row.welfareCompany ? `<span class="cell-sub">${esc(row.welfareCompany)}</span>` : ""}</td>
          <td>${row.authorEmail ? esc(row.authorEmail) : "<span class=\"muted\">작성자 없음</span>"}${row.authorCompany ? `<span class="cell-sub">${esc(row.authorCompany)}</span>` : ""}</td>
          <td>${esc(fmtDateTime(row.createdAt))}</td>
        </tr>`).join("")
      : '<tr><td colspan="4" class="muted small">한 줄 팁이 아직 없습니다.</td></tr>';
  }

  /* ───────────── 📊 통계 카드 순서 (2026-11-26 v=54) ─────────────
     `📊 통계` 탭의 섹션 카드마다 카드 머리 오른쪽 위에 ↑ / ↓ 를 붙여 순서를 바꾼다.
     바뀐 순서는 localStorage(moa-admin.stats.order)에 바로 저장되어 새로고침·재접속 뒤에도 그대로 보이고,
     포케모아·복지모아 두 화면이 같은 순서를 쓴다(통계 탭은 사이트 필터만 다르고 화면은 하나다).
     서버에 보내지 않는다 — 운영자 화면의 보기 방식이라 사이트 설정(site-config)과 섞지 않는다.
     저장된 키 중 지금 없는 카드는 버리고, 새로 생긴 카드는 원래 자리에 끼워 넣는다. */
  let statsOrderDefault = [];   // 이 화면을 처음 만들 때의 카드 순서(초기화 기준)

  function statsPanel() { return document.querySelector('[data-panel="stats"]'); }

  function statsCards() {
    const panel = statsPanel();
    return panel ? Array.prototype.slice.call(panel.querySelectorAll("[data-stats-card]")) : [];
  }

  function statsCardKeys() { return statsCards().map((card) => card.dataset.statsCard); }

  /* 카드 제목 — 머리의 h3 에서 태그(analytics·trend 같은 작은 표시)를 뺀 글자. */
  function statsCardTitle(card) {
    const h3 = card ? card.querySelector(".card-head h3") : null;
    if (!h3) return card ? card.dataset.statsCard : "";
    const copy = h3.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll(".tag"), (tag) => tag.remove());
    return (copy.textContent || "").replace(/\s+/g, " ").trim() || card.dataset.statsCard;
  }

  function readStatsOrder() {
    try {
      const raw = localStorage.getItem(LS.statsOrder);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
    } catch (err) { return []; }
  }

  /* 저장된 순서에 지금 화면의 카드를 맞춘다 — 모르는 키는 버리고, 빠진 카드는 뒤에 붙인다. */
  function normalizeStatsOrder(saved) {
    const present = statsCardKeys();
    const out = [];
    (Array.isArray(saved) ? saved : []).forEach((key) => {
      if (typeof key === "string" && present.indexOf(key) >= 0 && out.indexOf(key) < 0) out.push(key);
    });
    present.forEach((key) => { if (out.indexOf(key) < 0) out.push(key); });
    return out;
  }

  function saveStatsOrder(keys) {
    try {
      localStorage.setItem(LS.statsOrder, JSON.stringify(keys));
      return true;
    } catch (err) { return false; }
  }

  function clearStatsOrder() {
    try { localStorage.removeItem(LS.statsOrder); return true; } catch (err) { return false; }
  }

  /* 카드를 keys 순서대로 다시 놓는다. 카드가 아닌 요소(안내·다른 카드)는 건드리지 않는다. */
  function applyStatsOrder(keys) {
    const panel = statsPanel();
    if (!panel) return;
    const byKey = {};
    const cards = statsCards();
    if (!cards.length) return;
    cards.forEach((card) => { byKey[card.dataset.statsCard] = card; });
    const list = (Array.isArray(keys) ? keys : []).filter((key) => byKey[key]);
    if (!list.length) return;
    if (list.join("|") === cards.map((card) => card.dataset.statsCard).join("|")) return;
    // 카드 묶음 뒤에 다른 요소가 있어도 그 자리는 지키도록 마지막 카드의 다음 요소 앞에 끼워 넣는다.
    const anchor = cards[cards.length - 1].nextSibling;
    list.forEach((key) => { panel.insertBefore(byKey[key], anchor); });
  }

  function syncStatsOrderButtons() {
    const cards = statsCards();
    cards.forEach((card, index) => {
      const up = card.querySelector('[data-stats-move="up"]');
      const down = card.querySelector('[data-stats-move="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === cards.length - 1;
    });
    const reset = $("#stats-order-reset");
    if (reset) {
      // 저장값이 아니라 ‘지금 순서가 처음 순서인가’ 로 잠근다 — 손으로 되돌려 놓았으면 초기화할 것이 없다.
      const current = cards.map((card) => card.dataset.statsCard).join("|");
      const same = current === statsOrderDefault.join("|");
      reset.disabled = same;
      reset.title = same
        ? "지금이 처음 순서입니다."
        : "카드 순서를 처음(기본) 순서로 되돌립니다.";
    }
  }

  /* 카드마다 ↑ / ↓ 한 쌍을 카드 머리 끝에 붙인다(이미 있으면 건너뛴다). */
  function ensureStatsOrderControls() {
    statsCards().forEach((card) => {
      const head = card.querySelector(".card-head");
      if (!head || head.querySelector(".stats-order")) return;
      const title = statsCardTitle(card);
      const box = document.createElement("div");
      box.className = "stats-order";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", `${title} 카드 순서`);
      [
        ["up", "↑", "위로 이동"],
        ["down", "↓", "아래로 이동"]
      ].forEach((pair) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stats-order-btn";
        btn.dataset.statsMove = pair[0];
        btn.textContent = pair[1];
        btn.title = `${title} 카드를 ${pair[2]}`;
        btn.setAttribute("aria-label", `${title} 카드를 ${pair[2]}`);
        box.appendChild(btn);
      });
      head.appendChild(box);
    });
  }

  function moveStatsCard(key, direction) {
    const order = statsCardKeys();
    const from = order.indexOf(key);
    if (from < 0) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= order.length) return;
    const next = order.slice();
    next.splice(from, 1);
    next.splice(to, 0, key);
    applyStatsOrder(next);
    // 손으로 처음 순서까지 되돌렸으면 저장값을 지운다(다음에 열 때 초기 순서 그대로).
    const saved = next.join("|") === statsOrderDefault.join("|") ? clearStatsOrder() : saveStatsOrder(next);
    syncStatsOrderButtons();
    const title = statsCardTitle(statsCards().find((card) => card.dataset.statsCard === key));
    const where = direction === "up" ? "위" : "아래";
    if (saved) {
      toast(`「${title}」 카드를 ${where}로 옮겼습니다 · 이 브라우저에 저장되어 새로고침해도 그대로입니다.`);
    } else {
      toast(`「${title}」 카드를 ${where}로 옮겼지만 브라우저 저장소를 쓸 수 없어 이번 화면에서만 적용됩니다.`, true);
    }
  }

  function resetStatsOrder() {
    clearStatsOrder();
    applyStatsOrder(statsOrderDefault.slice());
    syncStatsOrderButtons();
    toast("카드 순서를 처음 상태로 되돌렸습니다.");
  }

  function onStatsOrderClick(event) {
    const btn = event.target.closest ? event.target.closest("[data-stats-move]") : null;
    if (!btn) return;
    const card = btn.closest("[data-stats-card]");
    if (!card) return;
    moveStatsCard(card.dataset.statsCard, btn.dataset.statsMove === "up" ? "up" : "down");
  }

  /* ── 카드 숨기기 / 다시 보이기 (2026-11-28 v=65) ──
     통계 화면의 카드 하나(예: 📱 인스타·블로그)를 이 브라우저에서만 감춘다.
     순서와 마찬가지로 localStorage 에만 두고(서버·사이트 설정과 섞지 않는다),
     감춘 카드는 위 ‘숨긴 카드’ 줄에 남겨 언제든 한 번에 되살릴 수 있다. */
  function readHiddenStats() {
    try {
      const raw = localStorage.getItem(LS.statsHidden);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string").slice(0, 40) : [];
    } catch (err) { return []; }
  }

  function saveHiddenStats(keys) {
    try {
      if (!keys.length) localStorage.removeItem(LS.statsHidden);
      else localStorage.setItem(LS.statsHidden, JSON.stringify(keys));
      return true;
    } catch (err) { return false; }
  }

  function renderHiddenChips(hidden) {
    const box = $("#stats-hidden-chips");
    if (!box) return;
    const keys = statsCardKeys().filter((key) => hidden.indexOf(key) >= 0);
    if (!keys.length) { box.hidden = true; box.innerHTML = ""; return; }
    const byKey = {};
    statsCards().forEach((card) => { byKey[card.dataset.statsCard] = card; });
    box.hidden = false;
    box.innerHTML = `<span class="muted small">숨긴 카드</span>${keys.map((key) => {
      const title = statsCardTitle(byKey[key]) || key;
      return `<button type="button" class="btn btn-sm btn-ghost stats-show-btn" data-stats-show="${esc(key)}" title="${esc(title)} 카드를 다시 보이기">${esc(title)} 다시 보이기</button>`;
    }).join("")}`;
  }

  function applyStatsHidden() {
    const hidden = readHiddenStats();
    statsCards().forEach((card) => {
      card.classList.toggle("stats-card-hidden", hidden.indexOf(card.dataset.statsCard) >= 0);
    });
    renderHiddenChips(hidden);
    return hidden;
  }

  function hideStatsCard(key) {
    const cards = statsCards();
    const card = cards.find((item) => item.dataset.statsCard === key);
    if (!card) return;
    const hidden = readHiddenStats();
    if (hidden.indexOf(key) < 0) hidden.push(key);
    if (!saveHiddenStats(hidden)) {
      toast("브라우저 저장소를 쓸 수 없어 이번 화면에서만 숨깁니다.", true);
    }
    applyStatsHidden();
    const title = statsCardTitle(card) || key;
    toast(`「${title}」 카드를 숨겼습니다 · 위 ‘숨긴 카드’에서 언제든 다시 보이기`);
  }

  function showStatsCard(key) {
    const hidden = readHiddenStats().filter((item) => item !== key);
    saveHiddenStats(hidden);
    applyStatsHidden();
    const card = statsCards().find((item) => item.dataset.statsCard === key);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    toast(`「${statsCardTitle(card) || key}」 카드를 다시 보입니다.`);
  }

  function initStatsOrder() {
    const panel = statsPanel();
    if (!panel) return;
    if (!statsOrderDefault.length) statsOrderDefault = statsCardKeys();
    ensureStatsOrderControls();
    applyStatsOrder(normalizeStatsOrder(readStatsOrder()));
    applyStatsHidden();
    syncStatsOrderButtons();
    if (panel.dataset.statsOrderBound === "1") return;  // 다시 로그인해도 한 번만 건다
    panel.dataset.statsOrderBound = "1";
    panel.addEventListener("click", onStatsOrderClick);
    const reset = $("#stats-order-reset");
    if (reset) reset.addEventListener("click", resetStatsOrder);
  }

  /* ───────────── 📊 방문 통계 (2026-11-19) ─────────────
     복지모아 서버가 집계한 /api/admin/analytics 를 그대로 그린다. 웹 표준 환경에서는
     나이대를 알 수 없어, 그 부분만 GA4 안내로 남긴다. */
  function fmtCount(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("ko-KR");
  }

  function fmtDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return `${total}초`;
    const min = Math.floor(total / 60);
    const sec = total % 60;
    if (min < 60) return sec ? `${min}분 ${sec}초` : `${min}분`;
    const hour = Math.floor(min / 60);
    const rest = min % 60;
    return rest ? `${hour}시간 ${rest}분` : `${hour}시간`;
  }

  function syncStatsControls() {
    const site = $("#stats-site");
    if (site && site.value !== state.stats.site) site.value = state.stats.site;
    $$("#stats-period button[data-days]").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.days) === Number(state.stats.days));
    });
    $$("#stats-trend-mode button[data-trend]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.trend === state.stats.trend);
    });
    /* 일별 기간(14/30/90)은 ‘일별 트렌드’를 골랐을 때만 보인다. */
    const dailyRange = $("#stats-daily-range");
    if (dailyRange) dailyRange.hidden = state.stats.trend !== "daily";
    $$("#stats-daily-range button[data-daily]").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.daily) === Number(state.stats.dailyDays));
    });
  }

  async function loadStats() {
    const pill = $("#stats-conn");
    const msg = $("#stats-msg");
    if (!pill) return;
    /* 조회 조건(사이트·기간)이나 새로고침으로 다시 부를 때는 목록을 5개 상태로 되돌린다. */
    state.stats.pagesVisible = STATS_PAGES_STEP;
    syncStatsControls();
    const session = state.session || {};
    if (session.mode === "demo" || (!session.token && !session.key)) {
      state.stats.data = null;
      state.stats.error = "";
      state.stats.loading = false;
      pill.textContent = "로그인 필요";
      pill.className = "status-pill wait";
      if (msg) msg.textContent = "방문 통계는 운영자 로그인(아이디·비밀번호 또는 관리자 키) 후 볼 수 있습니다. 데모 모드에서는 서버 자료를 불러오지 않습니다.";
      renderStats();
      return;
    }
    state.stats.loading = true;
    state.stats.error = "";
    pill.textContent = "불러오는 중…";
    pill.className = "status-pill wait";
    if (msg) msg.textContent = "서버에서 방문 자료를 모으는 중…";
    renderStats();
    try {
      const days = Number(state.stats.days) || 7;
      const dailyDays = Number(state.stats.dailyDays) || 30;
      const res = await apiRequest(`/api/admin/analytics?site=${encodeURIComponent(state.stats.site)}&days=${days}&daily=${dailyDays}`);
      if (!res.ok || !res.data) throw new Error(res.error || `HTTP ${res.status}`);
      state.stats.data = res.data;
      state.stats.loadedAt = new Date().toISOString();
      pill.textContent = "연결됨";
      pill.className = "status-pill ok";
      if (msg) {
        const extra = res.data.source && res.data.source !== "db" ? ` · 저장 방식: ${res.data.source}` : "";
        msg.textContent = `${res.data.siteLabel || "전체"} · 최근 ${res.data.days}일 · 이벤트 ${fmtCount(res.data.summary.events)}건${extra}`;
      }
    } catch (err) {
      state.stats.data = null;
      state.stats.error = err.message || "알 수 없는 오류";
      pill.textContent = "오류";
      pill.className = "status-pill bad";
      if (msg) msg.textContent = `통계를 불러오지 못했습니다: ${state.stats.error}`;
    }
    state.stats.loading = false;
    renderStats();
  }

  /* 기간별 트렌드(2026-11-25, 일별 2026-11-28 v=65) — 서버가 묶은 daily/monthly/yearly 를 그린다.
     위쪽 기간(days)·사이트 필터와는 별개이고, 한 응답에 셋 다 실려 와서 전환은 즉시 된다.
     일별은 고른 기간(14/30/90)만큼의 칸을 0 이라도 세워, 표에서 빠진 날이 없게 한다. */
  function renderStatsTrend() {
    const chart = $("#stats-trend-chart");
    const table = $("#stats-trend");
    const emptyNote = $("#stats-trend-empty");
    const note = $("#stats-trend-note");
    if (!chart || !table) return;
    const data = state.stats.data;
    const unit = state.stats.trend === "yearly" ? "yearly" : state.stats.trend === "daily" ? "daily" : "monthly";
    const rows = data && Array.isArray(data[unit]) ? data[unit] : [];
    const body = table.querySelector("tbody");
    const head = table.querySelector("thead tr");
    const meta = (data && data.trend) || {};
    const dailyTotals = (data && data.dailyTotals) || {};

    if (!rows.length) {
      chart.hidden = true;
      chart.innerHTML = "";
      if (emptyNote) emptyNote.hidden = false;
      if (body) body.innerHTML = '<tr><td colspan="5" class="muted small">아직 자료가 없습니다.</td></tr>';
      if (note) note.textContent = "기간(days) 조건과 상관없이 그 사이트에 쌓인 전체 기록을 셉니다.";
      return;
    }
    chart.hidden = false;
    if (emptyNote) emptyNote.hidden = true;

    const isDaily = unit === "daily";
    const totalViews = rows.reduce((sum, row) => sum + (Number(row.views) || 0), 0);
    const totalEvents = rows.reduce((sum, row) => sum + (Number(row.events) || 0), 0);
    if (note) {
      if (isDaily) {
        const sessions = Number(dailyTotals.sessions) || 0;
        note.textContent = `최근 ${rows.length}일 · 조회수 ${fmtCount(totalViews)} · 방문자(익명 세션) ${fmtCount(sessions)} · 기록 있는 날 ${fmtCount(dailyTotals.activeDays)}일 · 하루 평균 조회 ${fmtCount(Math.round(totalViews / Math.max(1, rows.length)))}`;
      } else {
        const scope = unit === "yearly" ? `연도별 ${rows.length}개 해` : `월별 최근 ${rows.length}개월`;
        const cumulative = meta.truncated ? " · 최근 자료부터 집계(한도 도달)" : "";
        note.textContent = `${scope} · 조회수 ${fmtCount(totalViews)} · 이벤트 ${fmtCount(totalEvents)} (전체 누적 ${fmtCount(meta.totalEvents)}건 중)${cumulative}`;
      }
    }

    const maxValue = Math.max(1, ...rows.map((row) => Number(row.views) || 0));
    const tickOf = (row) => (unit === "yearly" ? `${String(row.year).slice(2)}년` : unit === "daily" ? (row.label || socialDateLabel(row.date)) : `${row.month.slice(2).replace("-", ".")}`);
    const fullLabelOf = (row) => row.label || (unit === "yearly" ? `${row.year}년` : row.month);
    chart.setAttribute("aria-label", unit === "yearly" ? "연도별 조회수 추이" : unit === "daily" ? `${rows.length}일 일별 조회수 추이` : "월별 조회수 추이");
    /* 일별은 90칸까지 늘어나므로, 칸 최소폭을 없앤 전용 모양(.is-daily)으로 폭에 맞춰 모두 그린다.
       (월별·연도별은 칸이 몇 개뿐이라 지금 모양 그대로 둔다.) */
    chart.classList.toggle("is-daily", isDaily);
    const chartRows = rows;
    const step = Math.max(1, Math.ceil(chartRows.length / Math.max(2, Math.floor((chart.clientWidth || 360) / 34))));
    chart.innerHTML = chartRows.map((row, index) => {
      const views = Number(row.views) || 0;
      const height = views ? Math.max(6, Math.round((views / maxValue) * 100)) : 3;
      const title = `${fullLabelOf(row)} · 조회수 ${fmtCount(views)} · 세션 ${fmtCount(row.sessions)} · 이벤트 ${fmtCount(row.events)}`;
      const tick = index % step === 0 || index === chartRows.length - 1 ? tickOf(row) : "";
      return `<div class="trend-col${row.empty ? " is-empty" : ""}" title="${esc(title)}">
        <span class="trend-value">${views ? fmtCount(views) : ""}</span>
        <span class="trend-bar" style="height:${height}%"></span>
        <span class="trend-tick">${esc(tick)}</span>
      </div>`;
    }).join("");
    chart.removeAttribute("title");

    if (head) {
      head.innerHTML = isDaily
        ? '<th>날짜</th><th class="num">조회수</th><th class="num">방문자</th><th class="num">이벤트</th><th class="num">평균 체류</th>'
        : '<th>기간</th><th class="num">조회수</th><th class="num">세션</th><th class="num">이벤트</th><th class="num">평균 체류</th>';
    }
    if (body) {
      body.innerHTML = rows.slice().reverse().map((row) => {
        const views = Number(row.views) || 0;
        const sessions = Number(row.sessions) || 0;
        const events = Number(row.events) || 0;
        const duration = row.avgDurationText || fmtDuration(row.avgDurationSec);
        const emptyText = isDaily ? "방문 없음" : "기록 없음";
        return `<tr${row.empty ? ' class="is-empty"' : ""}>
          <td><b>${esc(fullLabelOf(row))}</b>${row.empty ? `<span class="cell-sub">${emptyText}</span>` : ""}</td>
          <td class="num">${fmtCount(views)}</td>
          <td class="num">${isDaily ? fmtCount(sessions) : fmtCount(sessions)}</td>
          <td class="num">${fmtCount(events)}</td>
          <td class="num">${events ? esc(duration) : "—"}</td>
        </tr>`;
      }).join("");
    }
  }

  /* 「페이지·탭별 체류시간」 — 기본 5개만 보여 주고, 더보기를 누를 때마다 5개씩 늘린다.
     끝까지 펼치면 ‘접기’로 바뀌어 다시 5개로 돌아온다. 5개 이하면 버튼을 숨긴다.
     막대 길이는 펼침과 상관없이 전체 목록의 최댓값을 기준으로 그려, 더 볼 때 길이가 흔들리지 않게 한다. */
  function statsPagesShown(total) {
    const want = Number(state.stats.pagesVisible) || STATS_PAGES_STEP;
    return Math.max(STATS_PAGES_STEP, Math.min(want, total));
  }

  function renderStatsPages() {
    const table = $("#stats-pages");
    const body = table ? table.querySelector("tbody") : null;
    if (!body) return;
    const box = $("#stats-pages-more");
    const btn = $("#stats-pages-toggle");
    const data = state.stats.data;
    const pages = data && Array.isArray(data.pages) ? data.pages : [];

    if (!pages.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted small">아직 자료가 없습니다.</td></tr>';
      if (box) box.hidden = true;
      return;
    }

    const total = pages.length;
    const shown = statsPagesShown(total);
    const maxAvg = Math.max(1, ...pages.map((page) => Number(page.avgDurationSec) || 0));
    body.innerHTML = pages.slice(0, shown).map((page) => {
      const width = Math.max(3, Math.round(((Number(page.avgDurationSec) || 0) / maxAvg) * 100));
      return `<tr>
        <td><b>${esc(page.label || page.path)}</b><span class="cell-sub">${esc(page.siteLabel)}</span></td>
        <td><code>${esc(page.path)}</code></td>
        <td class="num">${fmtCount(page.views)}</td>
        <td class="num">${esc(page.avgDurationText || fmtDuration(page.avgDurationSec))}</td>
        <td><span class="mini-bar" aria-hidden="true"><i style="width:${width}%"></i></span></td>
      </tr>`;
    }).join("");

    if (!box || !btn) return;
    box.hidden = total <= STATS_PAGES_STEP;
    if (box.hidden) return;
    const expanded = shown >= total;
    const remaining = total - shown;
    btn.textContent = expanded
      ? `접기 (${STATS_PAGES_STEP}개만 보기)`
      : (remaining <= STATS_PAGES_STEP
        ? `더보기 (남은 ${remaining}개)`
        : `더보기 (${STATS_PAGES_STEP}개 추가 · 남은 ${remaining}개)`);
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    btn.setAttribute("aria-label", expanded
      ? `페이지·탭별 체류시간 ${total}개를 상위 ${STATS_PAGES_STEP}개만 보기로 접기`
      : `페이지·탭별 체류시간 더보기 — 지금 ${shown}개, ${Math.min(total, shown + STATS_PAGES_STEP)}개까지`);
  }

  function renderStats() {
    const summary = $("#stats-summary");
    if (!summary) return;
    const data = state.stats.data;
    const refBox = $("#stats-referrers");
    const devBox = $("#stats-devices");
    const hourBox = $("#stats-hourly");
    const emptyNote = '<p class="note">아직 자료가 없습니다. 사이트를 방문하는 사람이 생기면 여기에 쌓입니다.</p>';

    if (!data || !data.summary) {
      summary.hidden = true;
      summary.innerHTML = "";
      renderStatsPages();
      [refBox, devBox, hourBox].forEach((box) => { if (box) box.innerHTML = emptyNote; });
      renderStatsTrend();
      return;
    }

    const s = data.summary;
    const peak = s.peakHour == null ? "—" : `${String(s.peakHour).padStart(2, "0")}:00`;
    summary.hidden = false;
    summary.innerHTML = [
      ["총 조회수", fmtCount(s.views), `전체 이벤트 ${fmtCount(s.events)}건`],
      ["방문자 (익명 세션)", fmtCount(s.sessions), `포케 ${fmtCount(s.sessionsBySite.pokemoa)} · 복지 ${fmtCount(s.sessionsBySite.bokjimoa)}`],
      ["평균 체류시간", fmtDuration(s.avgDurationSec), `${fmtCount(s.pages)}개 화면`],
      ["가장 붐비는 시간", peak, s.empty ? "자료 없음" : "한국 시간 기준"]
    ].map(([label, value, sub]) =>
      `<div class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(sub)}</em></div>`
    ).join("");

    // 페이지·탭별 체류시간 (5개씩 더보기·접기)
    renderStatsPages();

    // 유입 경로
    if (refBox) {
      if (!data.referrers.length) {
        refBox.innerHTML = emptyNote;
      } else {
        const maxRef = Math.max(1, ...data.referrers.map((row) => row.count));
        refBox.innerHTML = data.referrers.map((row) => {
          const width = Math.max(2, Math.round((row.count / maxRef) * 100));
          const hosts = (row.hosts || []).filter((host) => host.host && host.host !== "direct").slice(0, 4);
          const hostLine = hosts.length
            ? `<div class="bar-hosts">${hosts.map((host) => `<span>${esc(host.host)} ${fmtCount(host.count)}</span>`).join("")}</div>`
            : "";
          return `<div class="bar-row"><span class="bar-label">${esc(row.label)}</span>
            <span class="bar-track"><i style="width:${width}%"></i></span>
            <span class="bar-value">${fmtCount(row.count)} · ${row.share}%</span></div>${hostLine}`;
        }).join("");
      }
    }

    // 기기 · OS
    if (devBox) {
      if (!data.devices.length) {
        devBox.innerHTML = emptyNote;
      } else {
        const maxDev = Math.max(1, ...data.devices.map((row) => row.count));
        const bars = data.devices.map((row) => {
          const width = Math.max(2, Math.round((row.count / maxDev) * 100));
          return `<div class="bar-row"><span class="bar-label">${esc(row.label)}</span>
            <span class="bar-track"><i style="width:${width}%"></i></span>
            <span class="bar-value">${fmtCount(row.count)} · ${row.share}%</span></div>`;
        }).join("");
        const osChips = data.os.length
          ? `<div class="os-chips">${data.os.map((row) => `<span>${esc(row.name)}<b>${row.share}%</b></span>`).join("")}</div>`
          : "";
        devBox.innerHTML = bars + osChips;
      }
    }

    // 시간대별 접속 분포(0~23시)
    if (hourBox) {
      if (!data.hourly.length) {
        hourBox.innerHTML = emptyNote;
      } else {
        const maxHour = Math.max(1, ...data.hourly.map((row) => row.count));
        hourBox.innerHTML = `<div class="hour-chart" role="img" aria-label="0시부터 23시까지 시간대별 접속 분포">
          ${data.hourly.map((row) => {
            const height = row.count ? Math.max(8, Math.round((row.count / maxHour) * 100)) : 3;
            return `<div class="hour-col" title="${esc(row.label)} · ${fmtCount(row.count)}건">
              <span class="hour-bar" style="height:${height}%"></span>
              <span class="hour-tick">${row.hour % 3 === 0 ? row.hour : ""}</span>
            </div>`;
          }).join("")}
        </div>
        <div class="hour-legend"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>`;
      }
    }

    renderStatsTrend();
  }

  /* ───────────── 📱 인스타 · 네이버 블로그 (2026-11-26 v=53 · 2026-11-28 v=65) ─────────────
     두 층으로 그린다.
       ① 지금 값(자동) — 복지모아 서버가 인스타그램 Graph API·네이버 블로그 RSS를 읽어 온 값.
          인스타 토큰은 한 번 등록하면 서버에만 암호화해 보관하고, 화면·응답에는 원문이 나오지 않는다.
       ② 기록 추이 — social_stats_daily 스냅샷(하루 한 행). ‘새로고침’이 오늘 칸을 남겨 추이가 스스로 자란다.
     네이버 블로그 일 방문자·조회수는 네이버 로그인이 필요해 자동으로 읽을 수 없어 화면에서 뺐다.
     값이 없는 칸은 0 이 아니라 ‘—’로 그린다(못 잰 값과 실제 0 을 구분). */
  const SOCIAL_MAX_CHART_COLS = 31;

  /* 오늘 날짜(KST) — YYYY-MM-DD. 기기 시간대와 무관하게 한국 날짜로 적는다. */
  function kstDateString(date) {
    const base = date instanceof Date ? date : new Date();
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
    } catch (err) {
      return base.toISOString().slice(0, 10);
    }
  }

  /* ‘—’ 와 숫자 */
  function socialValue(value) {
    return value === null || value === undefined || value === "" ? "—" : fmtCount(value);
  }
  function socialDelta(value) {
    if (value === null || value === undefined) return "";
    if (!value) return "변화 없음";
    return (value > 0 ? "+" : "−") + fmtCount(Math.abs(value));
  }
  function socialDateLabel(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ""));
    if (!match) return String(text || "");
    return `${Number(match[2])}/${Number(match[3])}`;
  }
  /* ISO 시각 → ‘11/28 17:10’(KST). 값이 없으면 ‘—’. 기기 시간대와 상관없이 한국 시각으로 적는다. */
  function kstStamp(value) {
    if (!value) return "—";
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "—";
    const kst = new Date(time + 9 * 3600 * 1000);
    const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kst.getUTCDate()).padStart(2, "0");
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mi = String(kst.getUTCMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function syncSocialControls() {
    $$("#social-period button[data-social-days]").forEach((btn) => {
      const value = btn.dataset.socialDays;
      const wanted = state.social.days === "all" ? "all" : String(state.social.days);
      btn.classList.toggle("is-active", value === wanted);
    });
    $$("#social-mode button[data-social-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.socialMode === state.social.mode);
    });
  }

  function socialDateInput() {
    const input = $("#social-date");
    if (!input) return null;
    if (!input.value) input.value = kstDateString();
    return input;
  }

  function socialLoggedIn() {
    const session = state.session || {};
    return session.mode !== "demo" && Boolean(session.token || session.key);
  }

  /* ① 지금 값(자동) — /api/admin/social-live */
  async function loadSocialLive(opts) {
    const cards = $("#social-live-cards");
    const msg = $("#social-live-msg");
    const note = $("#social-live-note");
    if (!cards) return;
    if (!socialLoggedIn()) {
      state.social.live.data = null;
      cards.hidden = true;
      if (msg) msg.textContent = "운영자 로그인 뒤에 인스타그램·블로그 현재값을 자동으로 읽습니다.";
      return;
    }
    if (state.social.live.loading) {
      /* 이미 읽는 중이면 요청을 버리지 않고, 끝난 뒤 한 번 더(자동 스냅샷용) 부른다. */
      if (opts && opts.refresh) state.social.live.queuedRefresh = true;
      return;
    }
    state.social.live.loading = true;
    state.social.live.error = "";
    if (msg) msg.textContent = "인스타그램·블로그에서 지금 값을 읽는 중…";
    if (note) note.textContent = "읽는 중…";
    try {
      const refresh = opts && opts.refresh ? "?refresh=1" : "";
      const res = await apiRequest(`/api/admin/social-live${refresh}`);
      if (!res.ok || !res.data) throw new Error(res.error || `HTTP ${res.status}`);
      state.social.live.data = res.data;
      state.social.live.fetchedAt = res.data.fetchedAt || new Date().toISOString();
      state.social.live.error = "";
      if (note) note.textContent = `${kstStamp(state.social.live.fetchedAt)} 읽음 · 인스타그램 Graph API · 네이버 블로그 RSS`;
      renderSocialLive();
      /* 오늘 스냅샷이 새로 남았으면 기록 추이도 다시 그린다(그래프가 바로 늘어나게). */
      if (res.data.snapshot && !(opts && opts.noReload)) loadSocialStats({ keepForm: true });
    } catch (err) {
      state.social.live.error = err.message || "알 수 없는 오류";
      state.social.live.data = null;
      if (msg) msg.textContent = `지금 값을 읽지 못했습니다: ${state.social.live.error}`;
      if (note) note.textContent = "자동 읽기 실패";
      renderSocialLive();
    }
    state.social.live.loading = false;
    if (state.social.live.queuedRefresh) {
      state.social.live.queuedRefresh = false;
      loadSocialLive({ refresh: true });
    }
  }

  function renderSocialLive() {
    const cards = $("#social-live-cards");
    const msg = $("#social-live-msg");
    const box = $("#social-token-box");
    if (!cards) return;
    const data = state.social.live.data;
    const ig = (data && data.instagram) || null;
    const blog = (data && data.blog) || null;
    const lines = [];

    if (!data) {
      cards.hidden = true;
      cards.innerHTML = "";
      return;
    }

    const list = [];
    if (ig && ig.ok) {
      list.push(["📸 인스타 팔로워", socialValue(ig.followers), "@acewoni_ · Graph API"]);
      list.push(["📸 인스타 게시물", socialValue(ig.mediaCount), `최근 30일 ${socialValue(ig.posts30)}개 발행`]);
      list.push(["❤️ 좋아요 · 댓글", `${socialValue(ig.likes)} · ${socialValue(ig.comments)}`,
        `최근 ${fmtCount(ig.sampleSize)}개 게시물 합`]);
      list.push(["📸 인스타 조회수", "미지원", "인사이트(insights) 권한 없음"]);
    }
    if (blog && blog.ok) {
      list.push(["📝 블로그 전체 글", socialValue(blog.totalPosts), blog.totalSource === "rss" ? "RSS 기준" : "blog.naver.com 기준"]);
      list.push(["📝 블로그 최근 30일 발행", socialValue(blog.posts30), `최근 7일 ${socialValue(blog.posts7)}편`]);
      list.push(["📝 블로그 최근 발행", kstStamp(blog.latestPublishedAt), "@y__woni · RSS"]);
    }
    if (list.length) {
      cards.hidden = false;
      cards.innerHTML = list.map(([label, value, sub]) =>
        `<div class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(sub)}</em></div>`
      ).join("");
    } else {
      cards.hidden = true;
      cards.innerHTML = "";
    }

    if (ig && ig.ok) {
      lines.push(`인스타그램 @${ig.username || "acewoni_"} 값을 읽었습니다. ‘새로고침’을 누를 때마다 오늘 날짜 기록도 함께 남깁니다.`);
    } else if (ig && ig.configured === false) {
      lines.push("인스타그램은 아직 토큰이 등록되지 않았습니다. 아래 ‘인스타그램 Graph API 토큰 등록’에서 한 번만 넣으면 자동으로 읽습니다.");
    } else if (ig && ig.error) {
      lines.push(`인스타그램: ${ig.error}`);
    }
    if (blog && blog.ok) {
      const recent = (blog.recent || []).map((item) => {
        const title = String(item.title || "");
        return title.length > 42 ? `${title.slice(0, 42)}…` : title;
      }).filter(Boolean).slice(0, 2);
      if (recent.length) lines.push(`최근 글 — ${recent.join(" · ")}`);
    } else if (blog && blog.error) {
      lines.push(`네이버 블로그: ${blog.error}`);
    }
    if (ig && ig.ok && ig.insights && ig.insights.supported === false) {
      lines.push("참고 — " + (ig.insights.reason || "인사이트 권한이 없어 조회수는 읽지 못합니다.") + " Meta 앱 구성에서 권한을 더한 뒤 토큰을 다시 발급하면 읽을 수 있습니다.");
    }
    lines.push("블로그 일 방문자·조회수는 네이버 로그인이 필요한 값이라 자동으로 읽지 않고 화면에서도 뺐습니다.");
    if (msg) msg.textContent = lines.join(" ");
    if (box) {
      const configured = Boolean(ig && (ig.configured || ig.ok));
      const summary = box.querySelector("summary");
      if (summary) summary.textContent = configured
        ? "인스타그램 Graph API 토큰 (등록됨 · 다시 등록하려면 펼치기)"
        : "인스타그램 Graph API 토큰 등록";
      box.open = !configured;
    }
  }

  async function saveInstagramToken() {
    const input = $("#social-token");
    const btn = $("#social-token-save");
    const value = input ? String(input.value || "").trim() : "";
    if (!value) { toast("인스타그램 액세스 토큰을 넣어 주세요."); return; }
    if (state.social.live.savingToken) return;
    state.social.live.savingToken = true;
    if (btn) { btn.disabled = true; btn.textContent = "확인 중…"; }
    try {
      const res = await apiRequest("/api/admin/social-config", {
        method: "POST",
        json: true,
        body: JSON.stringify({ instagram_token: value })
      });
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      if (input) input.value = "";
      const info = (res.data && res.data.instagram) || {};
      toast(`인스타 토큰을 저장했습니다 · @${info.username || "acewoni_"} 팔로워 ${socialValue(info.followers)}`);
      await loadSocialLive({ refresh: true, noReload: true });
      await loadSocialStats({ keepForm: true });
    } catch (err) {
      toast(`토큰을 저장하지 못했습니다: ${err.message || "알 수 없는 오류"}`, true);
    }
    state.social.live.savingToken = false;
    if (btn) { btn.disabled = false; btn.textContent = "토큰 저장"; }
  }

  async function removeInstagramToken() {
    const btn = $("#social-token-remove");
    if (!state.social.live.data || !state.social.live.data.instagram || state.social.live.data.instagram.configured === false) {
      toast("등록된 인스타 토큰이 없습니다.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("등록한 인스타그램 토큰을 서버에서 지울까요? 지우면 ‘지금 값’의 인스타 숫자가 멈춥니다.")) return;
    if (btn) btn.disabled = true;
    try {
      const res = await apiRequest("/api/admin/social-config", { method: "DELETE" });
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      toast("인스타 토큰 등록을 해제했습니다.");
      await loadSocialLive({});
    } catch (err) {
      toast(`등록을 해제하지 못했습니다: ${err.message || "알 수 없는 오류"}`, true);
    }
    if (btn) btn.disabled = false;
  }

  /* 오늘 스냅샷이 비어 있을 때 한 번만 자동 수집(2026-11-28 v=71).
     ‘새로고침’을 누르지 않아도 통계 탭을 열면 그날 값이 한 칸 남아, 추이 그래프가 스스로 자란다. */
  function maybeAutoSocialSnapshot() {
    if (state.social.autoTried) return;
    const data = state.social.data;
    const latest = data && data.summary ? data.summary.latest : null;
    if (latest && latest.date === kstDateString()) { state.social.autoTried = true; return; }
    const live = state.social.live.data;
    if (live && live.instagram && live.instagram.configured === false) { state.social.autoTried = true; return; }
    state.social.autoTried = true;
    loadSocialLive({ refresh: true });
  }

  /* ② 기록 추이 — /api/admin/social-stats */
  async function loadSocialStats(opts) {
    const pill = $("#social-conn");
    const msg = $("#social-msg");
    if (!pill) return;
    syncSocialControls();
    const session = state.session || {};
    if (session.mode === "demo" || (!session.token && !session.key)) {
      state.social.data = null;
      state.social.error = "";
      state.social.loading = false;
      pill.textContent = "로그인 필요";
      pill.className = "status-pill wait";
      if (msg) msg.textContent = "SNS 기록은 운영자 로그인(아이디·비밀번호 또는 관리자 키) 후 볼 수 있습니다.";
      renderSocial();
      return;
    }
    state.social.loading = true;
    state.social.error = "";
    pill.textContent = "불러오는 중…";
    pill.className = "status-pill wait";
    renderSocial();
    try {
      const range = state.social.days === "all" ? "all" : String(Number(state.social.days) || 30);
      const res = await apiRequest(`/api/admin/social-stats?days=${encodeURIComponent(range)}`);
      if (!res.ok || !res.data) throw new Error(res.error || `HTTP ${res.status}`);
      state.social.data = res.data;
      state.social.loadedAt = new Date().toISOString();
      pill.textContent = "연결됨";
      pill.className = "status-pill ok";
      const total = res.data.summary ? res.data.summary.totalDays : 0;
      if (msg) {
        const scope = state.social.days === "all" ? "전체 기록" : `최근 ${res.data.days}일`;
        msg.textContent = total
          ? `${scope} · 기록 ${total}일 (${res.data.from} ~ ${res.data.to}) · 인스타 @acewoni_ · 블로그 y__woni`
          : `${scope}에 아직 기록이 없습니다. 위 ‘새로고침’을 누르면 오늘 값이 첫 기록으로 남습니다.`;
      }
      if (!opts || !opts.keepForm) fillSocialForm();
      /* 오늘 기록이 아직 비어 있으면 한 번만 자동으로 남긴다(통계를 열기만 해도 추이가 쌓이게).
         인스타 토큰이 없으면 남길 값이 없으니 건너뛴다. */
      maybeAutoSocialSnapshot();
    } catch (err) {
      state.social.data = null;
      state.social.error = err.message || "알 수 없는 오류";
      pill.textContent = "오류";
      pill.className = "status-pill bad";
      if (msg) msg.textContent = `SNS 기록을 불러오지 못했습니다: ${state.social.error}`;
    }
    state.social.loading = false;
    renderSocial();
  }

  /* 날짜 칸의 날짜가 이미 기록에 있으면 그 값을 입력칸에 채운다(수정하기 쉽게). */
  function fillSocialForm() {
    const dateInput = socialDateInput();
    if (!dateInput) return;
    const rows = (state.social.data && state.social.data.daily) || [];
    const found = rows.find((row) => row.date === dateInput.value) || null;
    const map = {
      "#social-ig-followers": "igFollowers",
      "#social-ig-media": "igMediaCount",
      "#social-ig-likes": "igLikes",
      "#social-ig-comments": "igComments"
    };
    Object.keys(map).forEach((sel) => {
      const input = $(sel);
      if (!input) return;
      const value = found ? found[map[sel]] : null;
      input.value = value === null || value === undefined ? "" : String(value);
    });
    const note = $("#social-note");
    if (note) note.value = found ? found.note || "" : "";
  }

  function renderSocialChart(el, rows, pick, labelOf) {
    if (!el) return;
    if (!rows.length) { el.innerHTML = ""; return; }
    const values = rows.map((row) => (row[pick] === null || row[pick] === undefined ? null : Number(row[pick]) || 0));
    const max = Math.max(1, ...values.filter((value) => value !== null));
    /* 칸이 좁으면 날짜 글자가 겹친다 — 폭에 들어가는 만큼만 눈금을 적고, 나머지는 띄엄띄엄 표시한다.
       (막대·숫자는 모든 칸에 그대로 두고 title 에 날짜·값을 함께 남긴다.) */
    const width = el.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 360);
    const maxLabels = Math.max(2, Math.floor(width / 34));
    const step = Math.max(1, Math.ceil(rows.length / maxLabels));
    el.innerHTML = rows.map((row, index) => {
      const value = values[index];
      const height = value === null ? 3 : value ? Math.max(6, Math.round((value / max) * 100)) : 3;
      const title = `${labelOf(row)} · ${value === null ? "기록 없음" : fmtCount(value)}`;
      const tick = index % step === 0 || index === rows.length - 1 ? labelOf(row) : "";
      return `<div class="trend-col${value === null ? " is-empty" : ""}" title="${esc(title)}">
        <span class="trend-value">${value === null ? "" : fmtCount(value)}</span>
        <span class="trend-bar" style="height:${height}%"></span>
        <span class="trend-tick">${esc(tick)}</span>
      </div>`;
    }).join("");
  }

  /* 차트용 날짜 배열 — 기록이 없는 날도 회색 막대로 세워 추이를 끊기지 않게 한다. */
  function socialChartRows() {
    const data = state.social.data;
    if (!data || !data.summary || !data.summary.totalDays) return [];
    const daily = data.daily || [];
    if (state.social.mode === "monthly") {
      return (data.monthly || []).slice(-12).map((row) => Object.assign({ label: row.label || row.month }, row));
    }
    const byDate = {};
    daily.forEach((row) => { byDate[row.date] = row; });
    let start;
    let end;
    const today = kstDateString();
    if (state.social.days === "all") {
      start = daily.length ? daily[0].date : today;
      end = daily.length ? daily[daily.length - 1].date : today;
    } else {
      const days = Number(state.social.days) || 30;
      const base = new Date(`${today}T00:00:00Z`);
      start = new Date(base.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
      end = today;
    }
    const list = [];
    let cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    let guard = 0;
    while (cursor <= last && guard < 400) {
      const key = cursor.toISOString().slice(0, 10);
      list.push(byDate[key] || { date: key, label: socialDateLabel(key), empty: true, igFollowers: null });
      cursor = new Date(cursor.getTime() + 86400000);
      guard += 1;
    }
    const cap = (typeof window !== "undefined" && window.innerWidth <= 640) ? 10 : SOCIAL_MAX_CHART_COLS;
    return list.slice(-cap);
  }

  function renderSocial() {
    const kpis = $("#social-kpis");
    if (!kpis) return;
    const data = state.social.data;
    const emptyNote = $("#social-empty");
    const charts = $("#social-charts");
    const table = $("#social-table");
    const body = table ? table.querySelector("tbody") : null;
    const head = table ? table.querySelector("thead tr") : null;

    if (!data || !data.summary || !data.summary.totalDays) {
      kpis.hidden = true;
      kpis.innerHTML = "";
      if (charts) charts.hidden = true;
      if (emptyNote) emptyNote.hidden = !(data && data.summary && !state.social.error);
      if (body) body.innerHTML = '<tr><td colspan="5" class="muted small">아직 기록이 없습니다. 위 ‘새로고침’을 누르면 오늘 값이 첫 기록으로 남습니다.</td></tr>';
      return;
    }

    const summary = data.summary;
    const latest = summary.latest || {};
    const delta = summary.delta || {};
    const stamp = latest.date ? `${latest.date} 기준` : "기록 없음";
    /* 값이 비어 있는 칸은 ‘기준일’이 아니라 ‘기록 없음’이라고 적는다(없는 값을 있는 것처럼 보이지 않게). */
    const subOf = (value, deltaValue) => {
      if (value === null || value === undefined) return "기록 없음 — 직접 기록에서 추가";
      if (deltaValue === null || deltaValue === undefined) return stamp;
      return `${socialDelta(deltaValue)} · ${stamp}`;
    };
    const cards = [
      ["📸 인스타 팔로워", socialValue(latest.igFollowers), subOf(latest.igFollowers, delta.igFollowers)],
      ["📸 인스타 게시물", socialValue(latest.igMediaCount), subOf(latest.igMediaCount, delta.igMediaCount)],
      ["❤️ 좋아요 · 댓글", `${socialValue(latest.igLikes)} · ${socialValue(latest.igComments)}`,
        (latest.igLikes === null && latest.igComments === null) ? "기록 없음 — 직접 기록에서 추가" : "최근 10개 게시물 합"]
    ];
    kpis.hidden = false;
    kpis.innerHTML = cards.map(([label, value, sub]) =>
      `<div class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(sub)}</em></div>`
    ).join("");
    if (emptyNote) emptyNote.hidden = true;

    const rows = socialChartRows();
    if (charts) charts.hidden = !rows.length;
    const labelOf = (row) => row.label || (state.social.mode === "monthly" ? row.month : socialDateLabel(row.date));
    renderSocialChart($("#social-chart-ig"), rows, "igFollowers", labelOf);

    const monthly = state.social.mode === "monthly";
    if (head) {
      head.innerHTML = '<th>기간</th><th class="num">팔로워</th><th class="num">게시물</th><th class="num">좋아요</th><th class="num">댓글</th>';
    }
    if (body) {
      if (monthly) {
        const list = (data.monthly || []).slice().reverse();
        body.innerHTML = list.map((row) => {
          const deltaText = row.igFollowersDelta === null || row.igFollowersDelta === undefined ? "" : socialDelta(row.igFollowersDelta);
          return `<tr>
            <td><b>${esc(row.label || row.month)}</b><span class="cell-sub">${esc(row.from)} ~ ${esc(row.to)} · ${fmtCount(row.days)}일 기록</span></td>
            <td class="num">${socialValue(row.igFollowers)}${deltaText ? `<span class="cell-sub">${esc(deltaText)}</span>` : ""}</td>
            <td class="num">${socialValue(row.igMediaCount)}</td>
            <td class="num">${socialValue(row.igLikes)}</td>
            <td class="num">${socialValue(row.igComments)}</td>
          </tr>`;
        }).join("") || '<tr><td colspan="5" class="muted small">아직 기록이 없습니다.</td></tr>';
      } else {
        const list = (data.daily || []).slice().reverse();
        body.innerHTML = list.map((row) => `<tr>
            <td class="social-when"><b>${esc(row.date)}</b>${row.note ? `<span class="cell-sub social-note-full">${esc(row.note)}</span><span class="social-note-mark" title="${esc(row.note)}">📝</span>` : ""}</td>
            <td class="num">${socialValue(row.igFollowers)}</td>
            <td class="num">${socialValue(row.igMediaCount)}</td>
            <td class="num">${socialValue(row.igLikes)}</td>
            <td class="num">${socialValue(row.igComments)}</td>
          </tr>`).join("") || '<tr><td colspan="5" class="muted small">아직 기록이 없습니다.</td></tr>';
      }
    }
  }

  async function saveSocialStats(event) {
    if (event) event.preventDefault();
    const dateInput = socialDateInput();
    const statePill = $("#social-save-state");
    if (!dateInput || !dateInput.value) {
      toast("날짜를 먼저 골라 주세요.");
      return;
    }
    const readNum = (sel) => {
      const input = $(sel);
      const text = input ? String(input.value || "").replace(/[,\s]/g, "").trim() : "";
      return text === "" ? null : text;
    };
    const payload = {
      stat_date: dateInput.value,
      ig_followers: readNum("#social-ig-followers"),
      ig_media_count: readNum("#social-ig-media"),
      ig_likes: readNum("#social-ig-likes"),
      ig_comments: readNum("#social-ig-comments"),
      note: (($("#social-note") || {}).value || "").trim()
    };
    if (state.social.saving) return;
    state.social.saving = true;
    const saveBtn = $("#social-save");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "저장 중…"; }
    if (statePill) { statePill.hidden = true; }
    try {
      const res = await apiRequest("/api/admin/social-stats", {
        method: "POST",
        json: true,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
      toast(`${dateInput.value} SNS 기록을 저장했습니다.`);
      if (statePill) { statePill.hidden = false; statePill.textContent = "저장됨"; statePill.className = "status-pill ok"; }
      await loadSocialStats({ keepForm: true });
    } catch (err) {
      toast(`SNS 기록을 저장하지 못했습니다: ${err.message || "알 수 없는 오류"}`, true);
      if (statePill) { statePill.hidden = false; statePill.textContent = "저장 실패"; statePill.className = "status-pill bad"; }
    }
    state.social.saving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "이 날짜로 저장"; }
  }

  /* ───────────── 🔧 태블릿 점검 공지 — 시작·종료 시각이 들어간 공지로 한 번에 바꾸고 되돌리기 ─────────────
     집 태블릿(중계 서버)을 재부팅·점검할 때 포케모아 위쪽 공지 바를 점검 안내로 바꾼다.
     · 켜기 전 공지(켜짐·문구·링크·링크 문구·강조)는 meta.maintenanceNotice 에 보관한다
       — 설정 파일에 실려 다른 기기·브라우저에서 꺼도 그대로 되돌아간다(사이트는 이 값을 읽지 않는다).
     · 고른 점검 시각은 meta.maintenanceNotice.window 에 남겨 새로고침·재접속해도 같은 시간이 보인다.
     · 누르면 초안에 바로 적용하고, 이어서 기존 저장·배포(saveToGitHub)로 커밋한다(확인 대화상자는 한 번). */
  const MAINTENANCE = {
    metaKey: "maintenanceNotice",
    head: "🔧 서버 점검 안내",
    tail: " · 재고 중계 서버 재부팅으로 실시간 재고 조회가 잠시 중단됩니다. (지도·도감·일정은 정상)",
    defaultMinutes: 15,
    quick: [10, 30, 60]
  };
  /* 화면에서 고른 점검 시각(datetime-local 문자열). 같은 날이면 ‘11/26 13:00 ~ 13:15’로 줄여 쓴다.
     source: auto = 아직 손대지 않음(설정에 보관된 점검 시각·기본값을 따른다) / user = 직접 고름(그대로 존중). */
  const maintenanceWhen = { start: "", end: "", source: "auto" };
  let maintenanceBound = false;

  function maintenanceSnapshot() {
    const cfg = config();
    const snap = cfg && cfg.meta && cfg.meta[MAINTENANCE.metaKey];
    return snap && typeof snap === "object" ? snap : null;
  }
  function isMaintenanceNotice() {
    return String(config().banner.text || "").trim().indexOf(`${MAINTENANCE.head} (`) === 0;
  }
  function toLocalInput(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function parseLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function roundedNow() {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  }
  function maintenanceRangeText(startStr, endStr) {
    const s = parseLocalInput(startStr);
    const e = parseLocalInput(endStr);
    if (!s || !e) return "";
    const day = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
    return sameDay ? `${day(s)} ${hm(s)} ~ ${hm(e)}` : `${day(s)} ${hm(s)} ~ ${day(e)} ${hm(e)}`;
  }
  /* 공지 바에 들어갈 한 문장 — 시각이 정확히 들어간다. */
  function maintenanceText(startStr, endStr) {
    const range = maintenanceRangeText(startStr, endStr);
    return range ? `${MAINTENANCE.head} (${range})${MAINTENANCE.tail}` : "";
  }
  function maintenanceValid() {
    const s = parseLocalInput(maintenanceWhen.start);
    const e = parseLocalInput(maintenanceWhen.end);
    return Boolean(s && e && e > s);
  }
  /* 처음 열 때·설정을 다시 불러올 때 — 보관된 점검 시각이 있으면 그대로, 없으면 ‘지금 ~ 15분 뒤’로 채운다.
     사용자가 직접 고른 시각(source: user)은 설정을 불러와도 덮지 않는다. */
  function ensureMaintenanceWhen() {
    if (maintenanceWhen.source === "user") return;
    const snap = maintenanceSnapshot();
    const win = snap && snap.window;
    if (win && win.start && win.end) {
      maintenanceWhen.start = String(win.start);
      maintenanceWhen.end = String(win.end);
      return;
    }
    if (maintenanceWhen.start && maintenanceWhen.end) return;
    const now = roundedNow();
    maintenanceWhen.start = toLocalInput(now);
    maintenanceWhen.end = toLocalInput(new Date(now.getTime() + MAINTENANCE.defaultMinutes * 60000));
  }
  function maintenanceStyleLabel(style) {
    return { info: "안내", warn: "주의", urgent: "긴급" }[style] || "안내";
  }
  /* 지금 공지 바가 어느 상태인가 — 점검 중 / 점검 문구만(꺼짐) / 평소 공지 / 꺼짐. */
  function maintenanceUiState() {
    const on = isMaintenanceNotice();
    const enabled = Boolean(config().banner.enabled);
    if (on && enabled) return { key: "on", label: "점검 중", tone: "wait" };
    if (on) return { key: "idle", label: "꺼짐 · 점검 문구", tone: "" };
    if (enabled) return { key: "notice", label: "공지 켜짐", tone: "ok" };
    return { key: "off", label: "꺼짐", tone: "" };
  }
  function maintenanceRangeShort() {
    return maintenanceRangeText(maintenanceWhen.start, maintenanceWhen.end);
  }

  /* 화면(① 카드 + ⑤ 중계 서버 카드의 한 줄)을 지금 설정에 맞춘다. */
  function renderMaintenance() {
    const startEl = $("#maintenance-start");
    if (!startEl) return;
    const endEl = $("#maintenance-end");
    ensureMaintenanceWhen();
    if (document.activeElement !== startEl) startEl.value = maintenanceWhen.start;
    if (endEl && document.activeElement !== endEl) endEl.value = maintenanceWhen.end;

    const state0 = maintenanceUiState();
    const pill = $("#maintenance-state");
    if (pill) {
      pill.textContent = state0.label;
      pill.className = "status-pill" + (state0.tone ? ` ${state0.tone}` : "");
      pill.title = state0.key === "on" ? "지금 포케모아 위쪽 공지 바에 점검 안내가 떠 있습니다." : "";
    }

    const text = maintenanceText(maintenanceWhen.start, maintenanceWhen.end);
    const preview = $("#maintenance-preview");
    if (preview) {
      preview.textContent = text || "시작·종료 시각을 넣으면 점검 공지 문구가 여기에 그대로 나옵니다.";
      preview.classList.toggle("is-empty", !text);
    }

    const note = $("#maintenance-window-note");
    if (note) {
      const s = parseLocalInput(maintenanceWhen.start);
      const e = parseLocalInput(maintenanceWhen.end);
      if (!s || !e) note.textContent = "시작·종료 시각을 모두 넣어 주세요.";
      else if (e <= s) note.textContent = "종료 시각은 시작 시각보다 뒤여야 합니다.";
      else {
        const mins = Math.round((e - s) / 60000);
        const now = Date.now();
        const left = Math.round((e.getTime() - now) / 60000);
        const tail = left > 0 ? `지금부터 ${left}분 뒤 종료` : "이미 종료 시각이 지났습니다";
        note.textContent = `점검 ${mins}분 (${maintenanceRangeShort()}) · ${tail} — 시각이 지나도 공지가 저절로 꺼지지는 않으니 점검이 끝나면 ‘원래 공지로’를 눌러 주세요.`;
      }
    }

    const valid = maintenanceValid();
    const onBtn = $("#maintenance-on");
    if (onBtn) {
      onBtn.textContent = state0.key === "on" ? "🔧 점검 공지를 다시 반영" : "🔧 점검 공지 켜고 지금 반영";
      onBtn.disabled = !valid;
      onBtn.title = valid ? "지금 설정 그대로 저장·배포합니다(확인 한 번)." : "점검 시작·종료 시각을 먼저 맞춰 주세요.";
    }
    const snap = maintenanceSnapshot();
    const offBtn = $("#maintenance-off");
    if (offBtn) {
      const canUndo = Boolean(snap) || Boolean(config().banner.enabled);
      offBtn.disabled = !canUndo;
      offBtn.title = snap
        ? `켜기 전 공지(${snap.text ? `「${snap.text}」` : "문구 없음"})로 되돌립니다.`
        : "보관한 공지가 없어 공지 바만 끕니다.";
    }

    const cur = $("#maintenance-current");
    if (cur) {
      const banner = config().banner;
      const textNow = String(banner.text || "").trim();
      cur.innerHTML = `지금 공지 바: <b>${banner.enabled ? "켜짐" : "꺼짐"}</b>${textNow ? ` · 「${esc(banner.text)}」` : " · 문구 없음"} <span class="muted small">(강조 ${maintenanceStyleLabel(banner.style)})</span>`;
    }
    const saved = $("#maintenance-saved");
    if (saved) {
      if (snap) {
        const when = snap.window && snap.window.start ? ` · 점검 ${maintenanceRangeText(snap.window.start, snap.window.end)}` : "";
        saved.innerHTML = `되돌릴 공지 보관됨: <b>${snap.enabled ? "켜짐" : "꺼짐"}</b>${snap.text ? ` · 「${esc(snap.text)}」` : " · 문구 없음"}${esc(when)} <span class="muted small">(${fmtDateTime(snap.at)})</span>`;
      } else {
        saved.textContent = "보관한 원래 공지가 없습니다 — ‘원래 공지로’를 누르면 공지 바만 꺼집니다.";
      }
    }

    /* ⑤ 태블릿 중계 서버 카드 안의 한 줄 컨트롤도 같은 상태를 보여 준다. */
    const relayPill = $("#relay-maintenance-pill");
    if (relayPill) {
      relayPill.textContent = state0.key === "on" ? "점검 공지 켜짐" : "점검 공지 꺼짐";
      relayPill.className = "status-pill" + (state0.key === "on" ? " wait" : "");
    }
    const relayWhen = $("#relay-maintenance-when");
    if (relayWhen) relayWhen.textContent = valid ? `점검 ${maintenanceRangeShort()}` : "점검 시각을 확인해 주세요";
    const relayOn = $("#relay-maintenance-on");
    if (relayOn) relayOn.disabled = !valid;
    const relayOff = $("#relay-maintenance-off");
    if (relayOff) relayOff.disabled = offBtn ? offBtn.disabled : false;

    renderMaintenanceRelay();
  }

  /* ① 카드의 중계 서버 상태 줄 — ⑤ 카드의 /health 결과(state.relay)를 그대로 보여 준다. */
  function renderMaintenanceRelay() {
    const pill = $("#maintenance-relay-pill");
    if (!pill) return;
    const note = $("#maintenance-relay-note");
    const relay = state.relay || {};
    if (!relay.at) {
      pill.textContent = "중계 서버 확인 전";
      pill.className = "status-pill";
      if (note) note.textContent = "집 태블릿이 켜져 있는지 여기서 바로 확인할 수 있어요.";
      return;
    }
    const at = fmtDateTime(relay.at);
    if (relay.online) {
      pill.textContent = `온라인 · v${relay.version || "?"}`;
      pill.className = "status-pill ok";
      if (note) note.textContent = `${at} 확인 — 재고 조회가 되고 있어요.`;
    } else {
      pill.textContent = "오프라인";
      pill.className = "status-pill bad";
      if (note) note.textContent = `${at} 확인 — 태블릿이 꺼졌거나 주소가 바뀌었을 수 있어요. 점검 중이라면 ‘점검 공지’를 켜 두세요.`;
    }
  }

  /* 시간을 ‘지금’ 기준으로 잡는다 — 빠른 선택(10·30·60분). */
  function setMaintenanceWhenFromNow(minutes) {
    const now = roundedNow();
    const span = minutes || MAINTENANCE.defaultMinutes;
    maintenanceWhen.start = toLocalInput(now);
    maintenanceWhen.end = toLocalInput(new Date(now.getTime() + span * 60000));
    maintenanceWhen.source = "user";
    const quick = $("#maintenance-quick");
    if (quick) $$("button[data-minutes]", quick).forEach((btn) => btn.classList.toggle("is-active", Number(btn.dataset.minutes) === span));
    renderMaintenance();
    toast(`점검 시간을 ‘지금 ~ ${span >= 60 ? `${span / 60}시간` : `${span}분`}’으로 넣었습니다 — ‘🔧 점검 공지 켜고 지금 반영’을 누르면 배포됩니다.`);
  }

  /* 초안에 적용만 한다(커밋은 toggleMaintenanceNotice 가 이어서). */
  function applyMaintenanceNotice(enable) {
    if (state.site !== "pokemoa") return false;
    if (enable && !maintenanceValid()) {
      toast("점검 시작·종료 시각을 먼저 맞춰 주세요.", true);
      return false;
    }
    const cfg = config();
    if (!cfg.meta || typeof cfg.meta !== "object") cfg.meta = {};
    if (enable) {
      let snap = maintenanceSnapshot();
      if (!snap) {
        // 지금 공지가 이미 점검 문구라면 그 문구를 ‘원래 공지’로 보관하지 않는다.
        snap = cfg.meta[MAINTENANCE.metaKey] = isMaintenanceNotice()
          ? { enabled: false, text: "", linkUrl: "", linkLabel: "", style: "info", at: new Date().toISOString() }
          : {
              enabled: Boolean(cfg.banner.enabled),
              text: cfg.banner.text || "",
              linkUrl: cfg.banner.linkUrl || "",
              linkLabel: cfg.banner.linkLabel || "",
              style: cfg.banner.style || "info",
              at: new Date().toISOString()
            };
      }
      snap.window = { start: maintenanceWhen.start, end: maintenanceWhen.end };
      cfg.banner.enabled = true;
      cfg.banner.text = maintenanceText(maintenanceWhen.start, maintenanceWhen.end);
      cfg.banner.linkUrl = "";
      cfg.banner.linkLabel = "";
      cfg.banner.style = "warn";
      addLog(`🔧 태블릿 점검 공지 켜기(초안) — ${maintenanceRangeShort()}`);
    } else {
      const snap = maintenanceSnapshot();
      if (snap) {
        cfg.banner.enabled = Boolean(snap.enabled);
        cfg.banner.text = String(snap.text || "");
        cfg.banner.linkUrl = String(snap.linkUrl || "");
        cfg.banner.linkLabel = String(snap.linkLabel || "");
        cfg.banner.style = String(snap.style || "info");
        delete cfg.meta[MAINTENANCE.metaKey];
        addLog("🔧 태블릿 점검 공지 끄기 — 원래 공지로 되돌림(초안)");
      } else {
        cfg.banner.enabled = false;
        addLog("🔧 태블릿 점검 공지 끄기(초안) — 보관한 공지 없음");
      }
    }
    markDirty(true);
    syncInputs();
    updateDerived();
    schedulePreview();
    return true;
  }

  /* 원클릭 — 적용하고 이어서 저장·배포한다. 확인은 한 번. */
  async function toggleMaintenanceNotice(enable) {
    if (state.site !== "pokemoa") {
      toast("태블릿 점검 공지는 포켓몬카드모아에서만 씁니다.", true);
      return;
    }
    const mode = (state.session || {}).mode;
    // 점검 공지는 설정을 통째로 저장한다. 저장 안 된 편집이 없으면 최신 설정을 먼저 읽어(조용한 불러오기)
    // 그 위에 점검 문구를 얹는다 — 오래된 화면으로 다른 곳의 변경을 덮어쓰지 않도록.
    const keepSnap = maintenanceSnapshot();
    if (!isDirty() && (mode === "idpw" || mode === "live")) {
      await pullConfig("pokemoa", true);
      // 서버 사본이 아직 커밋 직전 판이어도, 방금 보관한 공지를 잃지 않게 다시 붙인다.
      if (keepSnap && !maintenanceSnapshot()) {
        const fresh = config();
        if (!fresh.meta || typeof fresh.meta !== "object") fresh.meta = {};
        fresh.meta[MAINTENANCE.metaKey] = keepSnap;
      }
    }
    ensureMaintenanceWhen();
    if (!applyMaintenanceNotice(enable)) return;
    const sessionMode = (state.session || {}).mode;
    if (sessionMode === "demo" || !signedIn()) {
      toast("데모 모드입니다 — 초안에만 적용했어요. 아이디로 로그인하면 바로 배포됩니다.", true);
      return;
    }
    const snap = maintenanceSnapshot();
    const message = enable
      ? `🔧 점검 공지를 켜고 포켓몬카드모아에 지금 반영할까요?\n\n공지 바: ${maintenanceText(maintenanceWhen.start, maintenanceWhen.end)}\n\n· 켜기 전 공지(${snap && String(snap.text || "").trim() ? `「${snap.text}」` : "꺼짐"})는 보관해 두었다가 ‘원래 공지로’에서 그대로 되돌립니다.\n· 반영까지 30초 ~ 1분 걸립니다.`
      : `점검을 마치고 원래 공지로 되돌려 지금 반영할까요?\n\n되돌릴 공지: ${snap ? `${snap.enabled ? "켜짐" : "꺼짐"}${String(snap.text || "").trim() ? ` · 「${snap.text}」` : " · 문구 없음"}` : "보관한 공지 없음 — 공지 바만 끕니다."}\n· 반영까지 30초 ~ 1분 걸립니다.`;
    if (!window.confirm(message)) {
      toast("초안에만 적용했습니다 — ‘저장 및 사이트 반영’을 누르면 배포됩니다.");
      return;
    }
    await saveToGitHub({ skipConfirm: true });
  }

  /* ① 카드·⑤ 중계 서버 카드의 버튼을 한 번만 묶는다(다시 로그인해도 두 번 묶이지 않게). */
  function bindMaintenance() {
    if (maintenanceBound) return;
    maintenanceBound = true;
    const startInput = $("#maintenance-start");
    if (startInput) startInput.addEventListener("change", () => {
      maintenanceWhen.start = startInput.value;
      maintenanceWhen.source = "user";
      const s = parseLocalInput(maintenanceWhen.start);
      const e = parseLocalInput(maintenanceWhen.end);
      // 시작을 종료보다 뒤로 옮기면 종료를 ‘시작 + 15분’으로 따라 붙인다.
      if (s && (!e || e <= s)) maintenanceWhen.end = toLocalInput(new Date(s.getTime() + MAINTENANCE.defaultMinutes * 60000));
      renderMaintenance();
    });
    const endInput = $("#maintenance-end");
    if (endInput) endInput.addEventListener("change", () => {
      maintenanceWhen.end = endInput.value;
      maintenanceWhen.source = "user";
      renderMaintenance();
    });
    const quick = $("#maintenance-quick");
    if (quick) quick.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-minutes]");
      if (!btn) return;
      setMaintenanceWhenFromNow(Number(btn.dataset.minutes) || MAINTENANCE.defaultMinutes);
    });
    const onBtn = $("#maintenance-on");
    if (onBtn) onBtn.addEventListener("click", () => { toggleMaintenanceNotice(true); });
    const offBtn = $("#maintenance-off");
    if (offBtn) offBtn.addEventListener("click", () => { toggleMaintenanceNotice(false); });
    const relayOn = $("#relay-maintenance-on");
    if (relayOn) relayOn.addEventListener("click", () => { toggleMaintenanceNotice(true); });
    const relayOff = $("#relay-maintenance-off");
    if (relayOff) relayOff.addEventListener("click", () => { toggleMaintenanceNotice(false); });
    const relayMore = $("#relay-maintenance-more");
    if (relayMore) relayMore.addEventListener("click", () => setTab("notice"));
    const check = $("#maintenance-relay-check");
    if (check) check.addEventListener("click", () => { checkRelay(false); });
  }

  /* ───────────── 🔌 태블릿 중계 서버(relay) — 상태 확인 · 원클릭 업데이트 ─────────────
     태블릿 Termux 에서 도는 relay/server.js(v2.0) 를 브라우저에서 바로 확인·갱신한다.
     주소는 cloudflared 임시 주소라서 브라우저(localStorage)에 저장해 둔다. */
  const RELAY = {
    ls: "moa-admin.relayUrl",
    fallback: "https://nyc-rocks-epic-journalists.trycloudflare.com",
    healthMs: 6000,
    updateMs: 45000,
    confirmMs: 12000
  };

  function relaySavedUrl() {
    try { return localStorage.getItem(RELAY.ls) || ""; } catch (err) { return ""; }
  }
  function relayUrl() {
    const input = $("#relay-url");
    const value = (input && input.value.trim()) || relaySavedUrl() || RELAY.fallback;
    return value.replace(/\/+$/, "");
  }
  function relayPill(text, kind) {
    const pill = $("#relay-conn");
    if (!pill) return;
    pill.textContent = text;
    pill.className = "status-pill" + (kind ? " " + kind : "");
  }
  function relayNote(text) {
    const el = $("#relay-info");
    if (el) el.textContent = text;
  }
  function relayToken() {
    const session = state.session || {};
    /* 아이디 로그인이면 복지모아 서버가 발급한 HMAC 토큰, 아니면 x-sync-key 를 쓴다. */
    if (session.mode === "idpw" && session.token) return session.token;
    return session.key || "";
  }

  async function relayHealth(timeoutMs) {
    const base = relayUrl();
    if (!base) throw new Error("중계 서버 주소가 없습니다.");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || RELAY.healthMs);
    try {
      const res = await fetch(`${base}/health`, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function relayOfflineNote(why) {
    relayNote(`중계 서버에 연결하지 못했습니다 — ${why}. ① 태블릿이 켜져 있고 Termux 에서 서버가 도는지 ② cloudflared 주소가 지금 것과 같은지 확인해 주세요.`);
  }

  async function checkRelay(quiet) {
    if (!relayUrl()) { relayPill("주소 없음", "bad"); return null; }
    relayPill("확인 중", "wait");
    try {
      const data = await relayHealth(RELAY.healthMs);
      const version = String((data && data.version) || "?");
      const upSec = Number((data && data.uptimeSec) || 0);
      const upText = upSec >= 3600 ? `${Math.floor(upSec / 3600)}시간 ${Math.floor((upSec % 3600) / 60)}분째`
        : upSec >= 60 ? `${Math.floor(upSec / 60)}분째` : `${upSec}초째`;
      state.relay = { online: true, version, at: Date.now() };
      relayPill(`온라인 · v${version}`, "ok");
      relayNote(`${relayUrl()} · 버전 v${version} · ${upText} 가동 중 (${new Date().toLocaleTimeString("ko-KR")} 확인)`);
      renderMaintenanceRelay();
      return data;
    } catch (err) {
      state.relay = { online: false, version: "", at: Date.now() };
      relayPill("오프라인", "bad");
      renderMaintenanceRelay();
      const why = err && err.name === "AbortError" ? `${Math.round(RELAY.healthMs / 1000)}초 안에 응답 없음` : (err && err.message) || "연결 실패";
      relayOfflineNote(why);
      if (!quiet) toast("중계 서버에 연결하지 못했습니다.", true);
      return null;
    }
  }

  function saveRelayUrl() {
    const input = $("#relay-url");
    const value = (input && input.value.trim() || "").replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s]+$/i.test(value)) {
      toast("주소는 http:// 또는 https:// 로 시작해야 해요.", true);
      return;
    }
    try { localStorage.setItem(RELAY.ls, value); } catch (err) { /* 무시 */ }
    addLog(`중계 서버 주소 저장: ${value}`);
    toast("중계 서버 주소를 저장했습니다.");
    checkRelay(false);
  }

  async function updateRelay() {
    const token = relayToken();
    if (!token) {
      toast("아이디로 로그인하거나 복지모아 관리자 키를 저장한 뒤에 업데이트할 수 있어요.", true);
      return;
    }
    const btn = $("#relay-update");
    const target = relayUrl();
    btn.disabled = true;
    relayPill("업데이트 요청 중", "wait");
    relayNote("중계 서버가 GitHub 최신 판을 내려받아 문법 검사를 거쳐 교체하는 중입니다(최대 20초)…");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), RELAY.updateMs);
      let res;
      try {
        res = await fetch(`${target}/admin/update`, {
          method: "POST",
          headers: { "X-Admin-Token": token, "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          signal: ctrl.signal
        });
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (err) { data = null; }
      if (!res.ok || !data || data.ok === false) {
        const why = (data && data.error) || `HTTP ${res.status}`;
        relayPill("업데이트 실패", "bad");
        relayNote(`업데이트하지 못했습니다 — ${why}`);
        toast(`업데이트 실패: ${why}`, true);
        addLog(`중계 서버 업데이트 실패: ${why}`);
        return;
      }
      if (!data.restarting) {
        relayPill(`이미 최신 · v${data.nextVersion || "?"}`, "ok");
        relayNote(data.note || "이미 최신 버전입니다.");
        toast("이미 최신 버전입니다.");
        return;
      }
      /* 교체 뒤 재시작이 끝나 새 판이 응답하는지 1.2초 간격으로 확인한다. */
      relayPill("재시작 확인 중", "wait");
      relayNote(`v${data.previousVersion} → v${data.nextVersion} 교체 완료. 새 판이 응답하는지 확인하는 중입니다…`);
      const want = String(data.nextVersion || "");
      const startedAt = Date.now();
      let seen = null;
      while (Date.now() - startedAt < RELAY.confirmMs) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        try {
          const health = await relayHealth(3000);
          if (health && String(health.version) === want) { seen = health; break; }
        } catch (err) { /* 아직 재시작 중 — 다음 차례에 다시 */ }
      }
      if (seen) {
        state.relay = { online: true, version: want, at: Date.now() };
        relayPill(`업데이트 완료 · v${want}`, "ok");
        relayNote(`중계 서버가 v${data.previousVersion} → v${want} 로 바뀌었습니다(직전 판은 server.js.bak 으로 백업). 「동네에서 찾기」에서 실재고를 한 번 확인해 보세요.`);
        toast(`중계 서버를 v${want} 로 업데이트했습니다.`);
        addLog(`태블릿 중계 서버 v${data.previousVersion} → v${want} 업데이트`);
      } else {
        relayPill("재시작 확인 필요", "wait");
        relayNote(`v${data.previousVersion} → v${data.nextVersion} 교체는 끝났지만 ${Math.round(RELAY.confirmMs / 1000)}초 안에 새 판 응답을 못 봤습니다. 조금 뒤 「/health 다시 조회」를 눌러 주세요.`);
        toast("교체는 됐지만 새 판 응답이 아직입니다. 잠시 뒤 상태를 다시 확인해 주세요.", true);
      }
    } catch (err) {
      const isNet = err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String((err && err.message) || ""));
      const known = String((state.relay && state.relay.version) || "");
      /* v1.x 는 access-control-allow-headers 에 x-admin-token 이 없어 브라우저 POST 가
         프리플라이트에서 막힌다(Failed to fetch). 그 사실을 그대로 알려 준다. */
      if (isNet && known && !/^2\./.test(known)) {
        relayPill(`업데이트 불가 · v${known}`, "bad");
        relayNote(`서버가 아직 v${known} 이라 브라우저 요청(X-Admin-Token)을 받지 못합니다 — v2.0 이전 판에는 이 기능이 없습니다. 태블릿 Termux 에서 한 줄 설치를 한 번만 해 주시면, 그 다음부터는 이 버튼으로 갱신됩니다.`);
        toast(`v${known} 서버는 브라우저 업데이트를 지원하지 않아요. 태블릿에서 v2.0 한 줄 설치가 한 번 필요합니다.`, true);
        addLog(`중계 서버 v${known} — 브라우저 업데이트 미지원(v2.0 설치 필요)`);
        return;
      }
      const why = err && err.name === "AbortError" ? `${Math.round(RELAY.updateMs / 1000)}초 요청 시간 초과` : (err && err.message) || "연결 실패";
      relayPill("업데이트 실패", "bad");
      relayNote(`업데이트 요청이 끝나지 않았습니다 — ${why}. 「/health 다시 조회」로 서버 상태를 확인해 주세요.`);
      toast(`업데이트 요청 실패: ${why}`, true);
    } finally {
      btn.disabled = false;
    }
  }

  function renderRelayCard() {
    const card = $("#relay-card");
    if (!card) return;
    card.hidden = state.site !== "pokemoa";
    const input = $("#relay-url");
    if (input && !input.value) input.value = relaySavedUrl() || RELAY.fallback;
  }

  /* ───────────── 부팅 ───────────── */
  function boot() {
    const build = $("#build-chip");
    if (build) build.textContent = BUILD;
    try {
      const rawLog = localStorage.getItem(LS.log);
      if (rawLog) state.log = JSON.parse(rawLog).slice(0, 20);
    } catch (err) { state.log = []; }

    // ?reset=1 로 들어오면 편집 초안과 마지막 화면 기억을 지운다(처음 상태로 확인할 때).
    try {
      if (new URLSearchParams(location.search).get("reset") === "1") {
        Object.keys(SITES).forEach(clearDraft);
        sessionStorage.removeItem(LS.ui);
        history.replaceState(null, "", location.pathname);
      }
    } catch (err) { /* 무시 */ }

    bindGate();
    restoreUi();

    const session = loadSession();
    if (session && (session.token || session.key || session.mode === "demo")) {
      state.session = session;
      startApp(true);
    } else {
      showGate();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
