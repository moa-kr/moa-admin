/* 모아 어드민 — 💰 개인 재무 표 (2026-11-23)
   개인 재무 관리 표(월 현금흐름·대출·카드 결제·보유 자산)를 관리자 로그인 뒤에서만 다룬다.

   - 기본값은 완전히 빈 표다. 어떤 금액도 이 파일(=공개 GitHub 저장소)에 두지 않는다.
   - 로그인하면 app.js 가 넘겨준 요청 함수로 GET /api/admin/personal-finance 를 불러와 그린다.
   - 고치면 0.5초 디바운스 뒤 PUT 으로 서버(복지모아 PostgreSQL)에 저장한다.
   - 로그아웃·세션 만료 시 화면과 메모리의 자료를 모두 지운다. */
(function () {
  "use strict";

  const PATH = "/api/admin/personal-finance";
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  const CAT_COLOR = {
    "개별주식": "#1d4ed8",
    "퇴직연금(DC)": "#0ea5e9",
    "부동산": "#0a9e6c",
    "현금·예금": "#f59e0b",
    "기타": "#7c3aed"
  };
  const PALETTE = ["#1d4ed8", "#0ea5e9", "#0a9e6c", "#f59e0b", "#7c3aed", "#64748b", "#db2777", "#0891b2"];
  const FIELDS = {
    cashflow: ["type", "name", "amount", "memo"],
    loans: ["org", "kind", "principal", "rate", "monthly", "payday", "repay", "memo"],
    cards: ["company", "date", "status", "amount", "memo"],
    assets: ["category", "name", "qty", "price", "total", "memo"]
  };
  const EMPTY_COLS = { cashflow: 5, loans: 9, cards: 6, assets: 7 };
  const EMPTY_HINT = {
    cashflow: "‘＋ 행 추가’로 월급·고정지출을 넣으면 월 순현금흐름이 바로 계산됩니다.",
    loans: "‘＋ 행 추가’로 대출을 넣으면 남은 원금·가중평균 금리·월 납입액이 합산됩니다.",
    cards: "‘＋ 행 추가’로 카드 결제일과 금액을 넣으면 위 ‘다가오는 주요 출금’에 자동으로 모입니다.",
    assets: "‘＋ 행 추가’로 주식·퇴직연금·부동산을 넣으면 총자산과 자산 비율이 계산됩니다."
  };

  const root = () => document.getElementById("finance-root");
  const $ = (sel) => (root() ? root().querySelector(sel) : null);
  const $$ = (sel) => (root() ? Array.from(root().querySelectorAll(sel)) : []);

  /* ───────── 유틸 ───────── */
  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function uid() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const text = String(value).replace(/[,\s원₩]/g, "").replace(/[^0-9.\-]/g, "");
    const n = parseFloat(text);
    return isFinite(n) ? n : 0;
  }
  function qtyNum(value) {
    const m = String(value === null || value === undefined ? "" : value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }
  function comma(n) {
    const x = Math.round(num(n));
    return x === 0 ? "0" : x.toLocaleString("ko-KR");
  }
  function won(n) { return comma(n) + "원"; }
  function signedWon(n) { return (n < 0 ? "-" : "") + comma(Math.abs(n)) + "원"; }
  function koreanAmount(value) {
    const n0 = Math.round(num(value));
    const sign = n0 < 0 ? "-" : "";
    const n = Math.abs(n0);
    if (n < 10000) return sign + n.toLocaleString("ko-KR") + "원";
    let eok = Math.floor(n / 100000000);
    let man = Math.round((n % 100000000) / 10000);
    if (man === 10000) { eok += 1; man = 0; }
    const parts = [];
    if (eok) parts.push(eok.toLocaleString("ko-KR") + "억");
    if (man) parts.push(man.toLocaleString("ko-KR") + "만");
    return sign + parts.join(" ") + " 원";
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function parseISO(text) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(text || "").trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function startOfDay(d) { const x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); return x; }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hhmm(value) {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function prettyTime(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function stamp() {
    const d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "_" + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  /* ───────── 상태 ───────── */
  function emptyState() { return { version: 1, cashflow: [], loans: [], cards: [], assets: [] }; }
  function normalize(input) {
    const out = { version: 1 };
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    Object.keys(FIELDS).forEach((table) => {
      const list = Array.isArray(source[table]) ? source[table] : [];
      out[table] = list.map((row) => {
        const item = { id: row && row.id ? String(row.id) : uid() };
        FIELDS[table].forEach((field) => {
          const value = row ? row[field] : "";
          item[field] = value === null || value === undefined ? "" : String(value);
        });
        if (row && row.manualTotal) item.manualTotal = true;
        return item;
      });
    });
    return out;
  }

  let state = emptyState();
  let loaded = false;
  let dirty = false;
  let saving = false;
  let updatedAt = null;
  let request = null;
  let saveTimer = null;
  let retryTimer = null;
  let retryCount = 0;
  let pollTimer = null;
  let destroyed = false;

  /* ───────── 상태 칩 · 안내 ───────── */
  function setChip(text, mode) {
    const chip = $("#fin-sync");
    const label = $("#fin-sync-text");
    if (!chip || !label) return;
    label.textContent = text;
    chip.className = "fin-chip" + (mode ? " " + mode : "");
  }
  function showWarn(message) {
    const box = $("#fin-warn");
    if (!box) return;
    if (!message) { box.textContent = ""; box.classList.remove("show"); return; }
    box.textContent = "⚠️ " + message;
    box.classList.add("show");
  }
  function setStamp(value) {
    const el = $("#fin-stamp");
    if (!el) return;
    el.textContent = value ? "마지막 저장: " + prettyTime(new Date(value)) : "아직 저장된 기록이 없습니다";
  }

  /* ───────── 토스트 ───────── */
  let toastTimer = null;
  let pendingUndo = null;
  function toast(message, undoFn) {
    const box = $("#fin-toast");
    const btn = $("#fin-toast-undo");
    const msg = $("#fin-toast-msg");
    if (!box || !btn || !msg) return;
    msg.textContent = message;
    if (undoFn) { pendingUndo = undoFn; btn.hidden = false; }
    else { pendingUndo = null; btn.hidden = true; }
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.classList.remove("show"); pendingUndo = null; }, 6000);
  }

  /* ───────── 표 그리기 ───────── */
  function getRow(table, id) {
    const list = state[table] || [];
    for (let i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }
  function emptyRow(table) {
    return `<tr><td colspan="${EMPTY_COLS[table]}" class="fin-empty">${esc(EMPTY_HINT[table])}</td></tr>`;
  }
  function fieldId(t, id) { return `data-t="${t}" data-f="${esc(id)}"`; }

  function renderCashflow() {
    const body = $("#fin-cf-body");
    if (!body) return;
    body.innerHTML = state.cashflow.length ? state.cashflow.map((r) => {
      const cls = r.type === "수입" ? "in" : "out";
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td><select class="type-sel ' + cls + '" ' + fieldId("cashflow", r.id) + ' data-k="type">' +
          '<option value="수입"' + (r.type === "수입" ? " selected" : "") + '>수입</option>' +
          '<option value="지출"' + (r.type === "지출" ? " selected" : "") + '>지출</option>' +
        '</select></td>' +
        '<td><input ' + fieldId("cashflow", r.id) + ' data-k="name" value="' + esc(r.name) + '" placeholder="항목명" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("cashflow", r.id) + ' data-k="amount" value="' + (String(r.amount).trim() === "" ? "" : comma(r.amount)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("cashflow", r.id) + ' data-k="memo" value="' + esc(r.memo) + '" placeholder="메모" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><button class="del" type="button" data-fin-del="cashflow" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td>' +
      '</tr>';
    }).join("") : emptyRow("cashflow");
    const count = $("#fin-cf-count");
    if (count) count.textContent = state.cashflow.length + "개";
  }

  function renderLoans() {
    const body = $("#fin-ln-body");
    if (!body) return;
    body.innerHTML = state.loans.length ? state.loans.map((r) =>
      '<tr data-id="' + esc(r.id) + '">' +
        '<td><input ' + fieldId("loans", r.id) + ' data-k="org" value="' + esc(r.org) + '" placeholder="기관명" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("loans", r.id) + ' data-k="kind" value="' + esc(r.kind) + '" placeholder="신용대출" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("loans", r.id) + ' data-k="principal" value="' + (String(r.principal).trim() === "" ? "" : comma(r.principal)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="decimal" ' + fieldId("loans", r.id) + ' data-k="rate" data-fmt="rate" value="' + esc(r.rate) + '" placeholder="0.00" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("loans", r.id) + ' data-k="monthly" value="' + (String(r.monthly).trim() === "" ? "" : comma(r.monthly)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td><input class="mono" inputmode="numeric" ' + fieldId("loans", r.id) + ' data-k="payday" value="' + esc(r.payday) + '" placeholder="25" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("loans", r.id) + ' data-k="repay" value="' + esc(r.repay) + '" placeholder="원리금균등 / 만기" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("loans", r.id) + ' data-k="memo" value="' + esc(r.memo) + '" placeholder="비고" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><button class="del" type="button" data-fin-del="loans" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td>' +
      '</tr>'
    ).join("") : emptyRow("loans");
    const count = $("#fin-ln-count");
    if (count) count.textContent = state.loans.length + "개";
  }

  function renderCards() {
    const body = $("#fin-cd-body");
    if (!body) return;
    body.innerHTML = state.cards.length ? state.cards.map((r) => {
      const ok = r.status === "확정";
      const parsed = parseISO(r.date);
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td><input ' + fieldId("cards", r.id) + ' data-k="company" value="' + esc(r.company) + '" placeholder="카드사" spellcheck="false" autocomplete="off"></td>' +
        '<td><input class="mono" type="date" ' + fieldId("cards", r.id) + ' data-k="date" value="' + (parsed ? isoOf(parsed) : "") + '"></td>' +
        '<td><select class="status-sel ' + (ok ? "ok" : "wait") + '" ' + fieldId("cards", r.id) + ' data-k="status">' +
          '<option value="확정"' + (ok ? " selected" : "") + '>확정</option>' +
          '<option value="예정"' + (ok ? "" : " selected") + '>예정</option>' +
        '</select></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("cards", r.id) + ' data-k="amount" value="' + (String(r.amount).trim() === "" ? "" : comma(r.amount)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("cards", r.id) + ' data-k="memo" value="' + esc(r.memo) + '" placeholder="메모" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><button class="del" type="button" data-fin-del="cards" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td>' +
      '</tr>';
    }).join("") : emptyRow("cards");
    const count = $("#fin-cd-count");
    if (count) count.textContent = state.cards.length + "개";
  }

  function renderAssets() {
    const body = $("#fin-as-body");
    if (!body) return;
    body.innerHTML = state.assets.length ? state.assets.map((r) =>
      '<tr data-id="' + esc(r.id) + '">' +
        '<td><input list="fin-cat-list" ' + fieldId("assets", r.id) + ' data-k="category" value="' + esc(r.category) + '" placeholder="분류" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("assets", r.id) + ' data-k="name" value="' + esc(r.name) + '" placeholder="자산명" spellcheck="false" autocomplete="off"></td>' +
        '<td><input class="mono" ' + fieldId("assets", r.id) + ' data-k="qty" value="' + esc(r.qty) + '" placeholder="10주" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("assets", r.id) + ' data-k="price" value="' + (String(r.price).trim() === "" ? "" : comma(r.price)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><input class="num" inputmode="numeric" ' + fieldId("assets", r.id) + ' data-k="total" value="' + (String(r.total).trim() === "" ? "" : comma(r.total)) + '" placeholder="0" spellcheck="false" autocomplete="off"></td>' +
        '<td><input ' + fieldId("assets", r.id) + ' data-k="memo" value="' + esc(r.memo) + '" placeholder="비고" spellcheck="false" autocomplete="off"></td>' +
        '<td class="num"><button class="del" type="button" data-fin-del="assets" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td>' +
      '</tr>'
    ).join("") : emptyRow("assets");
    const count = $("#fin-as-count");
    if (count) count.textContent = state.assets.length + "개";
  }

  const RENDER = { cashflow: renderCashflow, loans: renderLoans, cards: renderCards, assets: renderAssets };

  /* ───────── 계산 ───────── */
  function assetTotalOf(row) {
    if (row.manualTotal) return Math.round(num(row.total));
    const qty = qtyNum(row.qty);
    const price = num(row.price);
    if (qty > 0 && price > 0) return Math.round(qty * price);
    return Math.round(num(row.total));
  }
  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text;
  }
  function setClass(sel, className) {
    const el = $(sel);
    if (el) el.className = className;
  }

  function sync() {
    /* 월 현금흐름 */
    let income = 0;
    let expense = 0;
    state.cashflow.forEach((row) => {
      const value = num(row.amount);
      if (row.type === "수입") income += value; else expense += value;
    });
    const net = income - expense;
    setText("#fin-cf-inc", won(income));
    setText("#fin-cf-exp", won(expense));
    setText("#fin-cf-net", signedWon(net));
    setClass("#fin-cf-net", "sum-value " + (net > 0 ? "pos" : (net < 0 ? "neg" : "flat")));
    const badge = $("#fin-cf-badge");
    if (badge) {
      badge.textContent = net > 0 ? "흑자" : (net < 0 ? "적자" : "균형");
      badge.className = "fin-sum-badge " + (net > 0 ? "pos" : (net < 0 ? "neg" : ""));
    }
    setText("#fin-cf-note", "수입 " + comma(income) + "원 − 지출 " + comma(expense) + "원");

    /* 대출 */
    let principal = 0;
    let monthly = 0;
    let weighted = 0;
    let withPrincipal = 0;
    state.loans.forEach((row) => {
      const p = num(row.principal);
      const rate = num(row.rate);
      const m = num(row.monthly);
      principal += p;
      monthly += m;
      weighted += p * rate;
      if (p > 0) withPrincipal += 1;
    });
    const avgRate = principal > 0 ? weighted / principal : 0;
    setText("#fin-ln-principal", won(principal));
    setText("#fin-ln-rate", (Math.round(avgRate * 100) / 100).toFixed(2) + "%");
    setText("#fin-ln-monthly", won(monthly));

    /* 카드 */
    let cardTotal = 0;
    state.cards.forEach((row) => { cardTotal += num(row.amount); });
    setText("#fin-cd-total", won(cardTotal));

    /* 자산 */
    let assetTotal = 0;
    state.assets.forEach((row) => { assetTotal += assetTotalOf(row); });
    setText("#fin-as-total", won(assetTotal));
    renderComposition(assetTotal);

    /* KPI */
    const netWorth = assetTotal - principal;
    setText("#fin-kpi-assets", comma(assetTotal));
    setText("#fin-kpi-assets-sub", (assetTotal ? koreanAmount(assetTotal) + " · " : "") + state.assets.length + "건");
    setText("#fin-kpi-debt", comma(principal));
    setText("#fin-kpi-debt-sub", principal > 0 ? koreanAmount(principal) + " · 대출 " + withPrincipal + "건" : "등록된 대출 없음");
    setClass("#fin-kpi-net-wrap", "k-value " + (netWorth >= 0 ? "pos" : "neg"));
    setText("#fin-kpi-net", comma(netWorth));
    setText("#fin-kpi-net-sub", (netWorth >= 0 ? "자산 − 부채 · " : "부채가 자산보다 큼 · ") + koreanAmount(netWorth));
    setClass("#fin-kpi-net-card", "fin-kpi " + (netWorth >= 0 ? "tone-pos" : "tone-neg"));
    setClass("#fin-kpi-flow-wrap", "k-value " + (net > 0 ? "pos" : (net < 0 ? "neg" : "")));
    setText("#fin-kpi-flow", comma(net));
    const flowBadge = $("#fin-kpi-flow-badge");
    if (flowBadge) {
      flowBadge.textContent = net > 0 ? "흑자" : (net < 0 ? "적자" : "균형");
      flowBadge.className = "fin-sum-badge " + (net > 0 ? "pos" : (net < 0 ? "neg" : ""));
    }
    setText("#fin-kpi-flow-sub", "수입 " + comma(income) + " − 지출 " + comma(expense) + "원");
    setClass("#fin-kpi-flow-card", "fin-kpi " + (net > 0 ? "tone-pos" : (net < 0 ? "tone-neg" : "tone-pos")));

    renderUpcoming();
  }

  function renderComposition(total) {
    const map = {};
    const order = [];
    state.assets.forEach((row) => {
      const key = String(row.category || "").trim() || "기타";
      if (!(key in map)) { map[key] = 0; order.push(key); }
      map[key] += assetTotalOf(row);
    });
    const entries = order.map((key) => [key, map[key]])
      .filter((entry) => entry[1] > 0)
      .sort((a, b) => b[1] - a[1]);
    const bar = $("#fin-comp-bar");
    const legend = $("#fin-comp-legend");
    if (!bar || !legend) return;
    if (!entries.length || total <= 0) {
      bar.innerHTML = "";
      legend.innerHTML = '<span class="muted">금액을 입력하면 자산 구성이 여기에 표시됩니다.</span>';
      return;
    }
    const colors = {};
    let paletteIndex = 0;
    entries.forEach((entry) => {
      colors[entry[0]] = CAT_COLOR[entry[0]] || PALETTE[(paletteIndex++) % PALETTE.length];
    });
    bar.innerHTML = entries.map((entry) => {
      const pct = entry[1] / total * 100;
      return '<span style="width:' + pct.toFixed(2) + '%;background:' + colors[entry[0]] + '" title="' + esc(entry[0]) + ' ' + pct.toFixed(1) + '%"></span>';
    }).join("");
    legend.innerHTML = entries.map((entry) => {
      const pct = entry[1] / total * 100;
      return '<span><i style="background:' + colors[entry[0]] + '"></i>' + esc(entry[0]) + ' <b>' + pct.toFixed(1) + '%</b> · ' + koreanAmount(entry[1]) + '</span>';
    }).join("");
  }

  /* ───────── 다가오는 출금 ───────── */
  function nextMonthlyDate(from, day) {
    function make(year, month) {
      const last = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, last));
    }
    const year = from.getFullYear();
    const month = from.getMonth();
    let d = make(year, month);
    if (d.getTime() < from.getTime()) d = make(year, month + 1);
    return d;
  }

  function computeUpcoming() {
    const today = startOfDay(new Date());
    const items = [];
    state.cards.forEach((row) => {
      const date = parseISO(row.date);
      const amount = num(row.amount);
      if (!date || amount <= 0) return;
      const diff = daysBetween(today, date);
      if (diff < 0 || diff > 62) return;
      const label = String(row.company || "카드").replace(/\s*\(.*\)\s*$/, "").trim() || "카드";
      items.push({ date: date, label: label, amount: amount });
    });
    state.loans.forEach((row) => {
      const day = parseInt(String(row.payday || "").replace(/\D/g, ""), 10);
      const amount = num(row.monthly);
      if (!day || day < 1 || day > 31 || amount <= 0) return;
      const date = nextMonthlyDate(today, day);
      if (daysBetween(today, date) > 62) return;
      items.push({ date: date, label: String(row.org || "대출").trim() || "대출", amount: amount });
    });
    const groups = {};
    const list = [];
    items.forEach((item) => {
      const key = isoOf(item.date);
      if (!groups[key]) { groups[key] = { date: item.date, items: [] }; list.push(groups[key]); }
      groups[key].items.push(item);
    });
    list.sort((a, b) => a.date - b.date);
    return list.slice(0, 4);
  }

  function renderUpcoming() {
    const groups = computeUpcoming();
    const box = $("#fin-upcoming-body");
    const foot = $("#fin-upcoming-foot");
    const sum = $("#fin-upcoming-sum");
    if (!box || !foot || !sum) return;
    if (!groups.length) {
      box.innerHTML = '<p class="fin-due-empty">예정된 카드·대출 출금이 없습니다. ② 대출 표에 결제일(며칠)을, ③ 카드 표에 결제일과 금액을 넣으면 여기에 자동으로 모아 보여 드립니다.</p>';
      foot.textContent = "";
      sum.textContent = "";
      return;
    }
    const now = startOfDay(new Date());
    box.innerHTML = groups.map((group, index) => {
      const diff = daysBetween(now, group.date);
      const dday = diff === 0 ? "오늘" : (diff === 1 ? "내일" : "D-" + diff);
      const cls = "fin-due-card" + (index === 0 ? " is-next" : "") + (diff <= 3 ? " urgent" : "");
      const total = group.items.reduce((acc, item) => acc + item.amount, 0);
      const parts = group.items.map((item) => '<span class="part"><b>' + esc(item.label) + "</b> " + comma(item.amount) + "원</span>").join('<span class="plus">+</span>');
      return '<div class="' + cls + '">' +
        '<div class="fin-due-head"><span class="fin-due-date">' + (group.date.getMonth() + 1) + "/" + group.date.getDate() + " (" + WEEK[group.date.getDay()] + ')</span>' +
        '<span class="fin-dday">' + dday + '</span></div>' +
        '<div class="fin-due-parts">' + parts + '</div>' +
        (group.items.length > 1 ? '<div class="fin-due-total">= ' + comma(total) + '원</div>' : "") +
      "</div>";
    }).join("");
    const first = groups[0];
    const firstTotal = first.items.reduce((acc, item) => acc + item.amount, 0);
    sum.innerHTML = "가장 가까운 출금 <b>" + won(firstTotal) + "</b>";
    const in30 = groups.reduce((acc, group) => {
      return daysBetween(now, group.date) <= 30 ? acc + group.items.reduce((a, item) => a + item.amount, 0) : acc;
    }, 0);
    foot.innerHTML = "앞으로 30일 예정 합계 <b>" + won(in30) + "</b>" +
      (first.items.length > 1 ? " · " + (first.date.getMonth() + 1) + "/" + first.date.getDate() + "에 " + first.items.length + "건이 겹칩니다" : "");
  }

  function renderAll() {
    renderCashflow();
    renderLoans();
    renderCards();
    renderAssets();
    sync();
  }

  /* ───────── 서버 저장 ───────── */
  function scheduleSave() {
    if (!loaded) return;
    dirty = true;
    setChip("저장 중…", "busy");
    clearTimeout(saveTimer);
    clearTimeout(retryTimer);
    saveTimer = setTimeout(() => { push(); }, 500);
  }

  async function push(keepalive) {
    if (!loaded || !request) return;
    if (saving) { scheduleSave(); return; }
    saving = true;
    retryCount += 1;
    clearTimeout(saveTimer);
    setChip("저장 중…", "busy");
    const snapshot = clone(state);
    const result = await request(PATH, {
      method: "PUT",
      json: true,
      keepalive: Boolean(keepalive),
      body: JSON.stringify({ data: snapshot })
    });
    saving = false;
    if (!result.ok) {
      setChip("저장 실패", "err");
      showWarn(result.error || "저장하지 못했습니다. 인터넷 연결을 확인해 주세요.");
      if (retryCount <= 3) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { push(); }, 4000 * retryCount);
      }
      return;
    }
    retryCount = 0;
    dirty = false;
    showWarn("");
    const data = result.data || {};
    updatedAt = data.updatedAt || new Date().toISOString();
    setChip("클라우드 동기화됨 " + hhmm(updatedAt));
    setStamp(updatedAt);
  }

  async function load(options) {
    if (!request) return;
    const opts = options || {};
    if (dirty && !opts.force) return;
    setChip("불러오는 중…", "busy");
    const result = await request(PATH);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        clear();
        return;
      }
      setChip("불러오기 실패", "err");
      showWarn(result.error || "저장된 자료를 불러오지 못했습니다.");
      return;
    }
    const payload = result.data || {};
    if (payload.data === null || payload.data === undefined) {
      if (!loaded || opts.force) {
        state = emptyState();
        loaded = true;
        updatedAt = null;
        dirty = false;
        renderAll();
        setStamp(null);
        setChip("새 표 · 아직 저장 전");
      } else {
        setChip(updatedAt ? "클라우드 동기화됨 " + hhmm(updatedAt) : "새 표 · 아직 저장 전");
      }
      return;
    }
    if (!opts.force && updatedAt && payload.updatedAt && payload.updatedAt === updatedAt && loaded) return;
    state = normalize(payload.data);
    loaded = true;
    dirty = false;
    updatedAt = payload.updatedAt || null;
    renderAll();
    setStamp(updatedAt);
    setChip("클라우드 동기화됨 " + hhmm(updatedAt));
    showWarn("");
  }

  /* ───────── 행 편집 ───────── */
  function ensureLoaded() {
    if (loaded) return true;
    showWarn("로그인한 뒤 ‘🔄 서버에서 다시 불러오기’를 눌러 저장된 표를 먼저 불러와 주세요.");
    return false;
  }

  function blankRow(table) {
    if (table === "cashflow") return { id: uid(), type: "지출", name: "", amount: "", memo: "" };
    if (table === "loans") return { id: uid(), org: "", kind: "", principal: "", rate: "", monthly: "", payday: "", repay: "", memo: "" };
    if (table === "cards") return { id: uid(), company: "", date: "", status: "예정", amount: "", memo: "" };
    return { id: uid(), category: "현금·예금", name: "", qty: "1식", price: "", total: "", memo: "" };
  }

  function addRow(table) {
    if (!ensureLoaded()) return;
    const row = blankRow(table);
    state[table].push(row);
    RENDER[table]();
    sync();
    scheduleSave();
    const firstField = table === "cashflow" ? "name" : (table === "loans" ? "org" : (table === "cards" ? "company" : "name"));
    const el = root().querySelector('[data-t="' + table + '"][data-f="' + row.id + '"][data-k="' + firstField + '"]');
    if (el) {
      const scroller = el.closest(".fin-table-scroll");
      if (scroller) scroller.scrollLeft = 0;
      el.focus();
      if (el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function delRow(table, id) {
    if (!ensureLoaded()) return;
    const list = state[table];
    let index = -1;
    for (let i = 0; i < list.length; i += 1) if (list[i].id === id) { index = i; break; }
    if (index < 0) return;
    const removed = list.splice(index, 1)[0];
    RENDER[table]();
    sync();
    scheduleSave();
    toast("행을 삭제했습니다.", () => {
      state[table].splice(Math.min(index, state[table].length), 0, removed);
      RENDER[table]();
      sync();
      scheduleSave();
      toast("되살렸습니다.");
    });
  }

  /* ───────── 내보내기 · 불러오기 ───────── */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1200);
  }

  function backupObject() {
    const out = clone(state);
    out.app = "모아 어드민 · 개인 재무";
    out.exportedAt = new Date().toISOString();
    return out;
  }

  function exportJSON() {
    if (!ensureLoaded()) return;
    download("개인재무_백업_" + stamp() + ".json", JSON.stringify(backupObject(), null, 2), "application/json;charset=utf-8");
    toast("JSON 백업 파일을 저장했습니다(다운로드 폴더).");
  }

  function csvCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function buildCSV() {
    const lines = [];
    const line = (arr) => lines.push(arr.map(csvCell).join(","));
    line(["개인 재무"]);
    line(["내보낸 시각", prettyTime(new Date())]);
    line([]);
    line(["① 월 현금흐름"]);
    line(["구분", "항목", "금액(원)", "메모"]);
    let income = 0;
    let expense = 0;
    state.cashflow.forEach((row) => {
      const value = num(row.amount);
      if (row.type === "수입") income += value; else expense += value;
      line([row.type, row.name, value, row.memo]);
    });
    line(["수입 합계", "", income, ""]);
    line(["지출 합계", "", expense, ""]);
    line(["월 순현금흐름", "", income - expense, ""]);
    line([]);
    line(["② 대출 현황"]);
    line(["기관명", "대출종류", "남은 원금(원)", "연 금리(%)", "월 납입액(원)", "결제일", "상환방식/만기", "비고"]);
    let principal = 0;
    let monthly = 0;
    let weighted = 0;
    state.loans.forEach((row) => {
      const p = num(row.principal);
      const rate = num(row.rate);
      const m = num(row.monthly);
      principal += p; monthly += m; weighted += p * rate;
      line([row.org, row.kind, p, rate, m, row.payday, row.repay, row.memo]);
    });
    line(["합계", "", principal, principal > 0 ? (Math.round(weighted / principal * 100) / 100) : 0, monthly, "", "", ""]);
    line([]);
    line(["③ 카드 결제 예정"]);
    line(["카드사", "결제일", "구분", "금액(원)", "메모"]);
    let cardTotal = 0;
    state.cards.forEach((row) => { cardTotal += num(row.amount); line([row.company, row.date, row.status, num(row.amount), row.memo]); });
    line(["총 예정 결제액", "", "", cardTotal, ""]);
    line([]);
    line(["④ 보유 자산"]);
    line(["분류", "자산명", "수량/단위", "단가·평가액(원)", "총 평가액(원)", "비고"]);
    let assetTotal = 0;
    state.assets.forEach((row) => {
      const total = assetTotalOf(row);
      assetTotal += total;
      line([row.category, row.name, row.qty, num(row.price), total, row.memo]);
    });
    line(["총 자산", "", "", "", assetTotal, ""]);
    line([]);
    line(["요약"]);
    line(["총 자산", assetTotal]);
    line(["총 부채", principal]);
    line(["순자산", assetTotal - principal]);
    line(["월 수입", income]);
    line(["월 지출", expense]);
    line(["월 순현금흐름", income - expense]);
    return lines.join("\r\n");
  }

  function exportCSV() {
    if (!ensureLoaded()) return;
    download("개인재무_" + stamp() + ".csv", "\ufeff" + buildCSV(), "text/csv;charset=utf-8");
    toast("CSV 파일을 저장했습니다(엑셀에서 열면 한글 그대로).");
  }

  function importFile(file) {
    if (!ensureLoaded()) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(String(reader.result)); }
      catch (err) { window.alert("불러오지 못했습니다. JSON 백업 파일이 맞는지 확인해 주세요.\n(" + err.message + ")"); return; }
      if (!data || (!Array.isArray(data.cashflow) && !Array.isArray(data.loans) && !Array.isArray(data.cards) && !Array.isArray(data.assets))) {
        window.alert("이 파일에는 재무 표 데이터가 없습니다.");
        return;
      }
      if (!window.confirm("지금 표의 내용을 백업 파일 내용으로 바꿀까요?\n바꾸면 서버에도 그대로 저장됩니다.")) return;
      state = normalize(data);
      renderAll();
      scheduleSave();
      toast("백업을 불러왔습니다.");
    };
    reader.readAsText(file, "utf-8");
  }

  /* ───────── 이벤트 ───────── */
  let bound = false;
  function bind() {
    if (bound || !root()) return;
    bound = true;

    root().addEventListener("input", (event) => {
      const el = event.target;
      if (!el || !el.getAttribute || !el.getAttribute("data-t")) return;
      const table = el.getAttribute("data-t");
      const id = el.getAttribute("data-f");
      const key = el.getAttribute("data-k");
      const row = getRow(table, id);
      if (!row) return;
      row[key] = el.value;
      if (table === "assets" && key === "total") row.manualTotal = true;
      if (table === "assets" && (key === "qty" || key === "price")) {
        row.manualTotal = false;
        const total = assetTotalOf(row);
        row.total = String(total);
        const totalEl = root().querySelector('[data-t="assets"][data-f="' + id + '"][data-k="total"]');
        if (totalEl && document.activeElement !== totalEl) totalEl.value = comma(total);
      }
      sync();
      scheduleSave();
    });

    root().addEventListener("change", (event) => {
      const el = event.target;
      if (!el || !el.classList) return;
      if (el.classList.contains("type-sel")) el.className = "type-sel " + (el.value === "수입" ? "in" : "out");
      if (el.classList.contains("status-sel")) el.className = "status-sel " + (el.value === "확정" ? "ok" : "wait");
      sync();
    });

    root().addEventListener("focusin", (event) => {
      const el = event.target;
      if (!el || el.tagName !== "INPUT" || !el.classList.contains("num")) return;
      let raw = String(el.value).replace(/,/g, "");
      if (raw === "0") raw = "";
      if (el.value !== raw) el.value = raw;
      try { const n = el.value.length; el.setSelectionRange(n, n); } catch (err) { /* date input 등 */ }
    });

    root().addEventListener("focusout", (event) => {
      const el = event.target;
      if (!el || el.tagName !== "INPUT" || !el.classList.contains("num")) return;
      const key = el.getAttribute("data-k") || "";
      const row = getRow(el.getAttribute("data-t"), el.getAttribute("data-f"));
      const value = String(el.value).trim();
      if (value === "") {
        el.value = row && String(row[key]).trim() !== "" ? comma(row[key]) : "";
        return;
      }
      if (key === "rate") {
        const rate = num(value);
        el.value = (Math.round(rate * 100) / 100).toFixed(2);
        if (row) row.rate = el.value;
      } else {
        el.value = comma(value);
        if (row) row[key] = el.value;
      }
      sync();
    });

    root().addEventListener("click", (event) => {
      const addBtn = event.target.closest ? event.target.closest("[data-fin-add]") : null;
      if (addBtn) { event.preventDefault(); addRow(addBtn.getAttribute("data-fin-add")); return; }
      const delBtn = event.target.closest ? event.target.closest("[data-fin-del]") : null;
      if (delBtn) { event.preventDefault(); delRow(delBtn.getAttribute("data-fin-del"), delBtn.getAttribute("data-f")); }
    });

    const toastUndo = $("#fin-toast-undo");
    if (toastUndo) {
      toastUndo.addEventListener("click", () => {
        const fn = pendingUndo;
        pendingUndo = null;
        const box = $("#fin-toast");
        if (box) box.classList.remove("show");
        clearTimeout(toastTimer);
        if (fn) fn();
      });
    }

    const bindClick = (selector, handler) => {
      const el = $(selector);
      if (el) el.addEventListener("click", handler);
    };
    bindClick("#fin-json", exportJSON);
    bindClick("#fin-csv", exportCSV);
    bindClick("#fin-load", () => { const input = document.getElementById("fin-file"); if (input) input.click(); });
    bindClick("#fin-refresh", async () => {
      if (dirty && !window.confirm("아직 서버에 저장되지 않은 변경이 있습니다. 서버 자료로 다시 불러올까요?")) return;
      await load({ force: true });
      toast("서버에 저장된 자료를 다시 불러왔습니다.");
    });
    bindClick("#fin-reset", () => {
      if (!ensureLoaded()) return;
      const ok = window.confirm("모든 표를 빈 상태로 되돌립니다.\n\n지금 값은 JSON 백업 파일로 먼저 내려받은 뒤 비웁니다. 계속할까요?");
      if (!ok) return;
      try { download("개인재무_초기화전백업_" + stamp() + ".json", JSON.stringify(backupObject(), null, 2), "application/json;charset=utf-8"); } catch (err) { /* 저장 실패해도 비우기는 진행 */ }
      state = emptyState();
      renderAll();
      scheduleSave();
      toast("표를 비웠습니다. 방금 전 값은 백업 파일로 저장했습니다.");
    });

    const fileInput = document.getElementById("fin-file");
    if (fileInput) {
      fileInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) importFile(file);
        event.target.value = "";
      });
    }

    // 탭이 보이지 않을 때(다른 화면·다른 탭) 마지막 입력을 곧바로 밀어 넣는다.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && dirty && loaded) push(true);
    });
    window.addEventListener("pagehide", () => { if (dirty && loaded) push(true); });
  }

  /* ───────── 세션 ───────── */
  function clear() {
    state = emptyState();
    loaded = false;
    dirty = false;
    updatedAt = null;
    clearTimeout(saveTimer);
    clearTimeout(retryTimer);
    setChip("로그인하면 불러옵니다");
    setStamp(null);
    showWarn("");
    renderAll();
  }

  function startPolling() {
    clearTimeout(pollTimer);
    const tick = async () => {
      if (destroyed) return;
      if (loaded && !dirty && !saving && document.visibilityState === "visible") {
        const panel = document.querySelector('[data-panel="finance"]');
        if (panel && !panel.hidden) await load({});
      }
      pollTimer = setTimeout(tick, 60000);
    };
    pollTimer = setTimeout(tick, 60000);
  }

  window.MOA_FINANCE = {
    init(options) {
      request = options && options.request ? options.request : null;
      bind();
      renderAll();
      setChip("로그인하면 불러옵니다");
      startPolling();
    },
    /* 로그인 직후·탭을 열 때 — 비어 있으면 서버에서 불러온다. */
    async enter() {
      if (!request || dirty) return;
      await load({});
    },
    /* 로그아웃·세션 만료 — 화면과 메모리의 개인 자료를 지운다. */
    clear,
    isLoaded() { return loaded; }
  };
})();
