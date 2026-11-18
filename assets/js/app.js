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
    log: "moa-admin.log"
  };
  const REMEMBER_DAYS = 90;

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
    previewPopup: true,
    inquiries: { loading: false, error: "", list: [], byStatus: null, total: 0, operatorEmail: "", loadedAt: "" },
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

  /* ───────────── 로그인 게이트 ───────────── */
  function showGate() {
    $("#gate").hidden = false;
    $("#app").hidden = true;
    setTimeout(() => { const el = $("#gate-token"); if (el) el.focus(); }, 30);
  }

  function gateError(message) {
    const el = $("#gate-error");
    if (!message) { el.hidden = true; el.textContent = ""; return; }
    el.textContent = message;
    el.hidden = false;
  }

  async function handleGateSubmit(event) {
    event.preventDefault();
    gateError("");
    const token = $("#gate-token").value.trim();
    const key = $("#gate-key").value.trim();
    const remember = $("#gate-remember").checked;
    if (!token && !key) {
      gateError("GitHub 토큰이나 관리자 키 중 하나는 넣어 주세요. 화면만 둘러보려면 ‘데모 모드’를 누르세요.");
      return;
    }

    const submit = $("#gate-submit");
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
      submit.textContent = "로그인하고 시작";
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

    if (state.session.mode === "live" && allowPrefetch) {
      await pullConfig(state.site, true);
    }
    if (Object.keys(SITES).some((id) => state.dirty[id])) {
      toast("저장하지 않은 편집 내용을 불러왔습니다.");
    }
  }

  function updateSessionUi() {
    const session = state.session || {};
    const chip = $("#mode-chip");
    chip.textContent = session.mode === "live" ? "실서버 연결" : session.mode === "key" ? "관리자 키 모드" : "데모 모드";
    chip.classList.toggle("live", session.mode === "live");

    const userChip = $("#user-chip");
    if (session.login) {
      userChip.innerHTML = `${session.avatar ? `<img src="${esc(session.avatar)}" alt="">` : ""}<span>@${esc(session.login)}</span>`;
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
    state.site = siteId;
    $$(".site-btn").forEach((btn) => {
      const on = btn.dataset.site === siteId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const inquiryTab = $('.tab[data-tab="inquiry"]');
    if (inquiryTab) inquiryTab.hidden = siteId !== "bokjimoa";
    if (siteId !== "bokjimoa" && state.tab === "inquiry") setTab("notice");
    renderAll();
  }

  function setTab(tabId) {
    state.tab = tabId;
    $$(".tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === tabId));
    $$(".panel").forEach((panel) => { panel.hidden = panel.dataset.panel !== tabId; });
    if (tabId === "inquiry") renderInquiries();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ───────────── 입력 바인딩 ───────────── */
  /* 로그인 게이트는 앱이 뜨기 전에 먼저 붙여야 한다(로그인 전 화면이라 bindUi 보다 앞선다). */
  function bindGate() {
    const form = $("#gate-form");
    if (form) form.addEventListener("submit", handleGateSubmit);
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

    // 순서 편집(탭/섹션)
    ["tabs", "sections"].forEach((listName) => {
      const box = $(`#list-${listName}`);
      bindReorder(box, listName);
    });

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

    // 문의
    $("#inquiry-key-save").addEventListener("click", saveInquiryKey);
    $("#inquiry-key-forget").addEventListener("click", forgetInquiryKey);
    $("#inquiry-refresh").addEventListener("click", loadInquiries);
    $("#inquiry-status").addEventListener("change", loadInquiries);
    $("#inquiry-list").addEventListener("click", handleInquiryClick);

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  /* ───────────── 순서 목록 ───────────── */
  let drag = { el: null, listName: "" };

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
    const list = renumber(sortedByOrder(config().navigation[listName]));
    const index = list.findIndex((x) => x.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    config().navigation[listName] = renumber(list);
    markDirty(true);
    renderOrderList(listName);
    schedulePreview();
  }

  function commitOrder(listName) {
    const box = $(`#list-${listName}`);
    const ids = $$(".rrow", box).map((row) => row.dataset.id);
    const list = config().navigation[listName];
    const byId = new Map(list.map((item) => [item.id, item]));
    const next = ids.map((id) => byId.get(id)).filter(Boolean);
    list.forEach((item) => { if (!next.includes(item)) next.push(item); });
    config().navigation[listName] = renumber(next);
    markDirty(true);
    renderOrderList(listName);
    schedulePreview();
  }

  function renderOrderList(listName) {
    const box = $(`#list-${listName}`);
    if (!box) return;
    const list = sortedByOrder(config().navigation[listName]);
    box.innerHTML = list.map((item, index) => `
      <div class="rrow ${item.visible ? "" : "is-hidden-item"}" draggable="true" data-id="${esc(item.id)}">
        <span class="rdrag" aria-hidden="true">⠿</span>
        <span class="rnum">${index + 1}</span>
        <div style="min-width:0;flex:1">
          <div class="rlabel">${esc(item.label)}</div>
          <div class="rid">${esc(item.id)}</div>
        </div>
        <div class="rmove">
          <button type="button" class="icon-btn" data-act="up" aria-label="${esc(item.label)} 위로" ${index === 0 ? "disabled" : ""}>▲</button>
          <button type="button" class="icon-btn" data-act="down" aria-label="${esc(item.label)} 아래로" ${index === list.length - 1 ? "disabled" : ""}>▼</button>
          <label class="switch" title="${item.visible ? "노출 중" : "숨김"}">
            <input type="checkbox" data-act="vis" ${item.visible ? "checked" : ""} aria-label="${esc(item.label)} 노출">
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </div>
      </div>`).join("");
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

  /* ───────────── 파생 UI(스위치 라벨 등) ───────────── */
  function updateDerived() {
    const cfg = config();
    const setState = (id, on) => { const el = $(id); if (el) el.textContent = on ? "켜짐" : "꺼짐"; };
    setState("#banner-state", Boolean(cfg.banner.enabled));
    setState("#popup-state", Boolean(cfg.popup.enabled));

    $$("#banner-style button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.style === (cfg.banner.style || "info"));
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
    const inquiryTab = $('.tab[data-tab="inquiry"]');
    if (inquiryTab) inquiryTab.hidden = state.site !== "bokjimoa";
    syncInputs();
    updateDerived();
    renderOrderList("tabs");
    renderOrderList("sections");
    renderCards();
    renderDeployTarget();
    renderChecks();
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

  const schedulePreview = debounce(renderPreview, 60);

  /* ───────────── 미리보기 ───────────── */
  function renderPreview() {
    const site = current();
    const cfg = config();
    const dark = site.id === "pokemoa";
    const accent = dark ? "#ffcb05" : "#2c5bf6";
    const inkBg = dark ? "#101f3c" : "#ffffff";
    const inkColor = dark ? "#ffffff" : "#101f3c";

    const tabs = sortedByOrder(cfg.navigation.tabs).filter((t) => t.visible);
    const sections = sortedByOrder(cfg.navigation.sections).filter((s) => s.visible);
    const cards = sortedByOrder(cfg.cards).filter((c) => c.visible);

    const banner = cfg.banner.enabled && String(cfg.banner.text || "").trim()
      ? `<div class="pv-banner ${esc(cfg.banner.style || "info")} ${dark ? "dark" : ""}">
           <span>${esc(cfg.banner.text)}</span>
           ${cfg.banner.linkLabel ? `<span class="pv-blink">${esc(cfg.banner.linkLabel)} ›</span>` : ""}
         </div>`
      : "";

    const nav = tabs.length
      ? `<div class="pv-nav">${tabs.map((t, i) => `<span style="background:${i === 0 ? accent : (dark ? "rgba(255,255,255,.08)" : "#f0f3fa")};color:${i === 0 ? (dark ? "#101f3c" : "#fff") : (dark ? "#c9d2e6" : "#4a5875")}">${esc(t.label)}</span>`).join("")}</div>`
      : '<div class="pv-nav"><span class="pv-empty">노출 중인 탭이 없습니다</span></div>';

    const statusCard = cards.length
      ? `<div class="pv-cards">${cards.slice(0, 3).map((c) => `
          <div class="pv-card" style="background:${dark ? "rgba(255,255,255,.06)" : "#f5f7fc"};color:${dark ? "#e8eefb" : "#101f3c"}">
            <b>${esc(c.title)}</b><span>${esc(c.description)}</span>
          </div>`).join("")}</div>`
      : "";

    const hasStatusSection = sections.some((s) => s.id === "status");
    const cardBlock = (!hasStatusSection && statusCard)
      ? `<div class="pv-sect"><h2 style="color:${inkColor};--bar:${accent}">현황</h2>${statusCard}</div>`
      : "";

    const sectionHtml = sections.map((section) => {
      if (section.id === "status") {
        return `<div class="pv-sect"><h2 style="color:${inkColor};--bar:${accent}">${esc(section.label)}</h2>${statusCard || '<div class="pv-empty">표시할 카드가 없습니다</div>'}</div>`;
      }
      if (section.id === "hero") {
        return `<div class="pv-hero" style="background:${dark ? "linear-gradient(135deg,#18264a,#0f1b35)" : "#eef3ff"};color:${dark ? "#fff" : "#101f3c"}">
          <h1>${esc(cfg.copy.heroTitle)}</h1>
          <p>${esc(cfg.copy.heroDescription)}</p>
          ${cfg.copy.ctaLabel ? `<span class="pv-cta" style="background:${accent};color:${dark ? "#101f3c" : "#fff"}">${esc(cfg.copy.ctaLabel)}</span>` : ""}
        </div>`;
      }
      return `<div class="pv-sect"><h2 style="color:${inkColor};--bar:${accent}">${esc(section.label)}</h2>
        <div class="pv-row" style="background:${dark ? "rgba(255,255,255,.10)" : "#e8ecf5"};width:92%"></div>
        <div class="pv-row" style="background:${dark ? "rgba(255,255,255,.08)" : "#eef1f7"};width:78%"></div>
        <div class="pv-row" style="background:${dark ? "rgba(255,255,255,.06)" : "#f2f5fa"};width:85%"></div>
      </div>`;
    }).join("");

    const popupVisible = cfg.popup.enabled && state.previewPopup;
    const popup = popupVisible ? `
      <div class="pv-popup-bg">
        <div class="pv-popup">
          <h3>${esc(cfg.popup.title || "제목 없음")}</h3>
          <p>${esc(cfg.popup.body || "")}</p>
          <button type="button" class="pv-btn" style="background:${accent};color:${dark ? "#101f3c" : "#fff"}">${esc(cfg.popup.buttonText || "확인")}</button>
          <div class="pv-dismiss">${Number(cfg.popup.dismissDays) > 0 ? `<span>${Number(cfg.popup.dismissDays)}일 동안 보지 않기</span>·` : ""}<span>닫기</span></div>
        </div>
      </div>` : "";

    const html = `<div class="pv" style="background:${inkBg};color:${inkColor}">
      ${banner}
      <div class="pv-header">
        <span class="pv-logo" style="background:${dark ? "#0c1730" : "#eef3ff"}">
          <i style="background:${accent}"></i><i style="background:${accent};opacity:.7"></i>
          <i style="background:${accent};opacity:.7"></i><i style="background:${accent}"></i>
        </span>
        <div style="min-width:0">
          <div class="pv-title">${esc(cfg.copy.siteTitle)}</div>
          <div class="pv-sub" style="color:${dark ? "#8d9ab8" : "#8490a8"}">${esc(cfg.copy.subtitle)}</div>
        </div>
      </div>
      ${nav}
      <div class="pv-body">${cardBlock}${sectionHtml || (cardBlock ? "" : '<div class="pv-empty">노출 중인 섹션이 없습니다</div>')}</div>
      <div class="pv-footer" style="border-top:1px solid ${dark ? "rgba(255,255,255,.1)" : "#eef1f7"};color:${dark ? "#8d9ab8" : "#8490a8"}">${esc(cfg.copy.footerText)}</div>
      ${popup}
    </div>`;

    $("#phone-screen").innerHTML = html;

    // 팝업 기간 안내
    const note = $("#preview-note");
    const { startDate, endDate } = cfg.popup;
    const today = todayISO();
    if (cfg.popup.enabled && ((startDate && today < startDate) || (endDate && today > endDate))) {
      note.textContent = `팝업이 노출 기간(${startDate || "제한 없음"} ~ ${endDate || "제한 없음"}) 밖이라 실제 사이트에서는 보이지 않습니다.`;
    } else {
      note.textContent = "화면은 실제 사이트와 세부 디자인이 조금 다를 수 있어요.";
    }
  }

  /* ───────────── 배포 ───────────── */
  function buildConfigForSave() {
    const cfg = clone(config());
    cfg.site = state.site;
    cfg.siteName = cfg.copy.siteTitle || current().name;
    cfg.meta = cfg.meta || {};
    cfg.meta.updatedBy = state.session && state.session.login ? `moa-admin (@${state.session.login})` : "moa-admin";
    cfg.meta.updatedAt = new Date().toISOString();
    cfg.banner.updatedAt = cfg.banner.enabled ? cfg.meta.updatedAt : cfg.banner.updatedAt || null;
    cfg.popup.updatedAt = cfg.popup.enabled ? cfg.meta.updatedAt : cfg.popup.updatedAt || null;
    // 순서 필드를 항상 1부터 정리해 둔다.
    cfg.navigation.tabs = renumber(sortedByOrder(cfg.navigation.tabs));
    cfg.navigation.sections = renumber(sortedByOrder(cfg.navigation.sections));
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
    if (session.mode === "demo") {
      setResult(`<h4>데모 모드입니다</h4><p>실제 저장은 GitHub 토큰으로 로그인해야 합니다. 지금 설정은 ‘JSON 내려받기’로 파일로 보관할 수 있어요.</p>
        <p>로그아웃 후 토큰을 넣고 다시 로그인하면 <code>${esc(site.repo)}</code> 의 <code>${esc(site.path)}</code> 로 바로 커밋됩니다.</p>`, true);
      setTab("deploy");
      return;
    }
    if (!session.token) {
      setResult("<h4>GitHub 토큰이 없습니다</h4><p>관리자 키만으로 로그인한 상태라 저장은 할 수 없습니다. 토큰을 넣고 다시 로그인해 주세요.</p>", true);
      setTab("deploy");
      return;
    }
    if (session.repos && session.repos[site.id] === false) {
      setResult(`<h4>쓰기 권한이 없습니다</h4><p>이 토큰으로는 <code>${esc(site.repo)}</code> 에 커밋할 수 없습니다. GitHub 저장소 권한(Contents: Read and write)을 확인해 주세요.</p>`, true);
      setTab("deploy");
      return;
    }
    if (!window.confirm(`${site.name} (${site.repo}) 의 ${site.path} 에 저장하고 배포할까요?`)) return;

    const payload = buildConfigForSave();
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    const contentPath = `/repos/${site.repo}/contents/${site.path}`;
    const buttons = [$("#btn-save"), $("#btn-save-top")];
    buttons.forEach((b) => { if (b) b.disabled = true; });
    setResult("<h4>커밋하는 중…</h4><p>GitHub에 설정 파일을 올리고 있습니다.</p>", false);

    try {
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

      const commit = (put.data && put.data.commit) || {};
      const shortSha = (commit.sha || "").slice(0, 7);
      setResult(`<h4>배포 커밋 완료 ✅</h4>
        <p><b>커밋</b> <code>${esc(shortSha || "(SHA 없음)")}</code> · <a href="${esc(commit.html_url || "#")}" target="_blank" rel="noreferrer">GitHub에서 보기</a></p>
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
    if (!session.token) {
      if (!silent) toast("GitHub 토큰이 있어야 현재 설정을 불러올 수 있어요.", true);
      return;
    }
    if (!silent && state.dirty[siteId]) {
      const ok = window.confirm("저장하지 않은 편집 내용이 있습니다. GitHub의 현재 값으로 덮어쓸까요?");
      if (!ok) return;
    }
    const res = await ghRequest(`/repos/${site.repo}/contents/${site.path}?ref=${encodeURIComponent(site.branch)}`);
    if (res.ok && res.data && res.data.content) {
      try {
        const parsed = JSON.parse(fromBase64(res.data.content));
        const merged = Object.assign(clone(site.defaults), parsed);
        merged.navigation = Object.assign({ tabs: [], sections: [] }, parsed.navigation || {});
        merged.copy = Object.assign(clone(site.defaults.copy), parsed.copy || {});
        merged.banner = Object.assign(clone(site.defaults.banner), parsed.banner || {});
        merged.popup = Object.assign(clone(site.defaults.popup), parsed.popup || {});
        merged.cards = Array.isArray(parsed.cards) && parsed.cards.length ? parsed.cards : clone(site.defaults.cards);
        state.configs[siteId] = merged;
        state.source[siteId] = `GitHub ${(res.data.sha || "").slice(0, 7)} (${fmtDateTime(parsed.meta && parsed.meta.updatedAt)})`;
        clearDirty(siteId);
        if (siteId === state.site) renderAll();
        if (!silent) toast("GitHub의 현재 설정을 불러왔습니다.");
      } catch (err) {
        if (!silent) toast("설정 파일을 해석하지 못했습니다(JSON 형식 오류).", true);
      }
      return;
    }
    if (res.status === 404) {
      state.source[siteId] = "GitHub에 아직 설정 파일 없음 (기본값 사용)";
      if (siteId === state.site) renderAll();
      if (!silent) toast("아직 저장소에 설정 파일이 없어 기본값을 쓰고 있어요.");
      return;
    }
    if (!silent) toast(`설정을 불러오지 못했습니다: ${res.error}`, true);
    state.source[siteId] = `불러오기 실패 (${res.error})`;
    if (siteId === state.site) renderAll();
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
    } else if (session.mode === "live") {
      items.push(["ok", `GitHub @${esc(session.login)} 토큰 확인됨`]);
      Object.keys(SITES).forEach((id) => {
        const ok = session.repos && session.repos[id];
        items.push([ok ? "ok" : "bad", `${SITES[id].repo} 쓰기 권한 ${ok ? "있음" : "없음"}`]);
      });
    } else {
      items.push(["wait", "관리자 키 모드 — 저장 기능은 잠겨 있습니다."]);
    }
    items.push([session.key ? "ok" : "wait", session.key ? "복지모아 관리자 키 저장됨" : "복지모아 관리자 키 없음 (문의 조회 불가)"]);
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
    renderChecks();
    renderInquiries();
    toast("키를 지웠습니다.");
  }

  async function loadInquiries() {
    const key = (state.session && state.session.key) || "";
    const info = $("#inquiry-msg");
    if (!key) {
      info.textContent = "관리자 키를 먼저 입력해 주세요.";
      $("#inquiry-conn").textContent = "연결 전";
      $("#inquiry-conn").className = "status-pill";
      return;
    }
    const status = $("#inquiry-status").value;
    state.inquiries.loading = true;
    info.textContent = "불러오는 중…";
    try {
      const url = `${API_BASE}/api/admin/inquiries?limit=100${status ? `&status=${encodeURIComponent(status)}` : ""}`;
      const res = await fetch(url, { headers: { "x-sync-key": key }, cache: "no-store" });
      let data = null;
      const text = await res.text();
      try { data = text ? JSON.parse(text) : null; } catch (err) { data = null; }
      if (!res.ok || !data || data.ok === false) {
        const reason = (data && data.error) || `HTTP ${res.status}`;
        throw new Error(reason);
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
      info.textContent = `문의 ${data.total}건${state.inquiries.operatorEmail ? ` · 알림 메일 ${data.operatorEmail}` : ""}`;
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
    const key = (state.session && state.session.key) || "";
    btn.disabled = true;
    btn.textContent = "삭제 중…";
    try {
      const res = await fetch(`${API_BASE}/api/admin/inquiries/${id}`, {
        method: "DELETE",
        headers: { "x-sync-key": key },
        cache: "no-store"
      });
      let data = null;
      const text = await res.text();
      try { data = text ? JSON.parse(text) : null; } catch (err) { data = null; }
      if (!res.ok || !data || data.ok === false) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
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

  /* ───────────── 부팅 ───────────── */
  function boot() {
    try {
      const rawLog = localStorage.getItem(LS.log);
      if (rawLog) state.log = JSON.parse(rawLog).slice(0, 20);
    } catch (err) { state.log = []; }

    bindGate();

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
