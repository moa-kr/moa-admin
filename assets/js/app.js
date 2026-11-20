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
    ui: "moa-admin.ui"
  };
  const REMEMBER_DAYS = 90;
  /* 화면·자산 버전 — index.html 의 ?v= 와 같게 맞춘다. 빌드 배지에 보여 캐시 여부를 바로 알 수 있게 한다. */
  const BUILD = "v=33";
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
    // 🔌 태블릿 중계 서버 상태 — 마지막으로 본 /health 결과
    relay: { online: false, version: "", at: 0 },
    // 📊 방문 통계 — 사이트 필터·기간별로 서버에서 집계해 온다.
    stats: { site: "all", days: 7, loading: false, error: "", data: null, loadedAt: "" },
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
        cache: "no-store"
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
    clearSession();
    state.session = null;
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
    // ‘⑤ 저장·배포’로 열렸으면 태블릿 중계 서버 버전을 먼저 조용히 확인한다
    // (복지모아 설정 불러오기를 기다리지 않도록 pullConfig 앞에서 부른다).
    if (state.tab === "deploy" && state.site === "pokemoa") checkRelay(true);

    if ((state.session.mode === "live" || state.session.mode === "idpw") && allowPrefetch) {
      await pullConfig(state.site, true);
    }
    if (Object.keys(SITES).some((id) => state.dirty[id])) {
      toast("저장하지 않은 편집 내용을 불러왔습니다.");
    }
    // 마지막으로 보던 탭이 ‘📊 통계’면 바로 자료를 불러온다(빈 화면으로 열리지 않도록).
    if (state.tab === "stats") loadStats();
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
    renderChecks();
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
    if (siteId !== "bokjimoa" && state.tab === "inquiry") state.tab = "notice";
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

  function applyTab() {
    if (state.tab === "inquiry" && state.site !== "bokjimoa") state.tab = "notice";
    $$(".tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === state.tab));
    $$(".panel").forEach((panel) => { panel.hidden = panel.dataset.panel !== state.tab; });
  }

  function setTab(tabId) {
    state.tab = tabId;
    saveUi();
    applyTab();
    if (tabId === "inquiry") renderInquiries();
    if (tabId === "stats") loadStats();
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
    $("#btn-save-top").addEventListener("click", () => { setTab("deploy"); saveToGitHub(); });
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
  }

  /* ───────────── 전체 렌더 ───────────── */
  function renderAll() {
    $$(".site-btn").forEach((btn) => {
      const on = btn.dataset.site === state.site;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
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
    if (!state.previewPopup) payload.popup = Object.assign({}, payload.popup, { enabled: false });
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

    if (kind === "banner" || kind === "popup") {
      setTab("notice");
      const sel = kind === "banner" ? '[data-bind="banner.text"]' : '[data-bind="popup.title"]';
      highlightTarget($(sel));
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

  async function saveToGitHub() {
    const site = current();
    const session = state.session || {};
    const viaServer = session.mode === "idpw";
    if (session.mode === "demo") {
      setResult(`<h4>데모 모드입니다</h4><p>실제 저장은 아이디로 로그인해야 합니다. 지금 설정은 ‘JSON 내려받기’로 파일로 보관할 수 있어요.</p>
        <p>로그아웃 후 아이디·비밀번호로 다시 로그인하면 <code>${esc(site.repo)}</code> 의 <code>${esc(site.path)}</code> 로 바로 커밋됩니다.</p>`, true);
      setTab("deploy");
      return;
    }
    if (!viaServer && !session.token) {
      setResult("<h4>로그인이 필요합니다</h4><p>관리자 키만으로 로그인한 상태라 저장은 할 수 없습니다. 아이디로 다시 로그인해 주세요.</p>", true);
      setTab("deploy");
      return;
    }
    if (!viaServer && session.repos && session.repos[site.id] === false) {
      setResult(`<h4>쓰기 권한이 없습니다</h4><p>이 토큰으로는 <code>${esc(site.repo)}</code> 에 커밋할 수 없습니다. GitHub 저장소 권한(Contents: Read and write)을 확인해 주세요.</p>`, true);
      setTab("deploy");
      return;
    }
    // 저장된 설정을 아직 못 읽은 상태(기본값·불러오기 실패)에서 저장하면 화면의 기본값으로 덮어쓴다 — 한 번 더 확인한다.
    const sourceNow = String(state.source[site.id] || "");
    if (/^(기본값|불러오기 실패|GitHub에 아직|아직 설정 파일 없음)/.test(sourceNow)) {
      const ok = window.confirm(`${site.name}의 저장된 설정을 아직 읽지 못했습니다(지금 화면: ${sourceNow}).\n\n이대로 저장하면 화면의 기본값이 저장소 파일을 덮어씁니다. 먼저 ‘현재 값 불러오기’를 누르는 것이 안전합니다.\n\n그래도 저장할까요?`);
      if (!ok) return;
    }
    if (!window.confirm(`${site.name} (${site.repo}) 의 ${site.path} 에 저장하고 배포할까요?`)) return;

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
          return;
        }
        commit = (put.data && put.data.commit) || {};
      } else {
        const head = await ghRequest(`${contentPath}?ref=${encodeURIComponent(site.branch)}`);
        let sha = null;
        if (head.ok && head.data && head.data.sha) sha = head.data.sha;
        else if (head.status !== 404) {
          setResult(`<h4>현재 파일을 읽지 못했습니다</h4><p>${esc(head.error || "알 수 없는 오류")}</p>`, true);
          return;
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
          return;
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
    list.innerHTML = inf.list.map((item) => `
      <article class="inq" data-id="${Number(item.id)}">
        <div class="inq-top">
          <span class="badge">${esc(item.type || "문의")}</span>
          <span class="badge ${esc(item.status || "new")}">${esc(statusLabel[item.status] || item.status || "신규")}</span>
          <span class="inq-time">#${Number(item.id)} · ${esc(fmtDateTime(item.createdAt))}</span>
        </div>
        <p class="inq-msg">${esc(item.message)}</p>
        <div class="inq-meta">
          ${item.email ? `<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>` : '<span>회신 이메일 없음</span>'}
          ${item.page ? `<span>· ${esc(item.page)}</span>` : ""}
          <button type="button" class="btn btn-sm btn-danger" data-del="${Number(item.id)}">삭제</button>
        </div>
      </article>`).join("");
  }

  async function handleInquiryClick(event) {
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
  }

  async function loadStats() {
    const pill = $("#stats-conn");
    const msg = $("#stats-msg");
    if (!pill) return;
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
      const res = await apiRequest(`/api/admin/analytics?site=${encodeURIComponent(state.stats.site)}&days=${days}`);
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

  function renderStats() {
    const summary = $("#stats-summary");
    if (!summary) return;
    const data = state.stats.data;
    const pagesBody = $("#stats-pages") ? $("#stats-pages").querySelector("tbody") : null;
    const refBox = $("#stats-referrers");
    const devBox = $("#stats-devices");
    const hourBox = $("#stats-hourly");
    const emptyNote = '<p class="note">아직 자료가 없습니다. 사이트를 방문하는 사람이 생기면 여기에 쌓입니다.</p>';

    if (!data || !data.summary) {
      summary.hidden = true;
      summary.innerHTML = "";
      if (pagesBody) pagesBody.innerHTML = '<tr><td colspan="5" class="muted small">아직 자료가 없습니다.</td></tr>';
      [refBox, devBox, hourBox].forEach((box) => { if (box) box.innerHTML = emptyNote; });
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

    // 페이지·탭별 체류시간
    if (pagesBody) {
      if (!data.pages.length) {
        pagesBody.innerHTML = '<tr><td colspan="5" class="muted small">아직 자료가 없습니다.</td></tr>';
      } else {
        const maxAvg = Math.max(1, ...data.pages.map((page) => Number(page.avgDurationSec) || 0));
        pagesBody.innerHTML = data.pages.slice(0, 50).map((page) => {
          const width = Math.max(3, Math.round(((Number(page.avgDurationSec) || 0) / maxAvg) * 100));
          return `<tr>
            <td><b>${esc(page.label || page.path)}</b><span class="cell-sub">${esc(page.siteLabel)}</span></td>
            <td><code>${esc(page.path)}</code></td>
            <td class="num">${fmtCount(page.views)}</td>
            <td class="num">${esc(page.avgDurationText || fmtDuration(page.avgDurationSec))}</td>
            <td><span class="mini-bar" aria-hidden="true"><i style="width:${width}%"></i></span></td>
          </tr>`;
        }).join("");
      }
    }

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
      return data;
    } catch (err) {
      state.relay = { online: false, version: "", at: Date.now() };
      relayPill("오프라인", "bad");
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
