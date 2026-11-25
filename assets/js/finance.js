/* 모아 어드민 — 💰 개인 재무 표 (2026-11-24 · 엑셀 가계부 구조 v2)
   부장님이 쓰던 엑셀(고정지출·수입·카드 3사·부채·자산·초과근로·퇴직금 DC)의 표 구조를 그대로 옮기고,
   표를 고칠 때마다 위쪽 ‘실시간 자동 분석’이 즉시 다시 계산된다.

   - 기본값은 완전히 빈 표다. 어떤 금액도 이 파일(=공개 GitHub 저장소)에 두지 않는다.
   - 로그인하면 app.js 가 넘겨준 요청 함수로 GET /api/admin/personal-finance 를 불러와 그린다.
   - 고치면 0.5초 디바운스 뒤 PUT 으로 서버(복지모아 PostgreSQL, personal_finance_state)에 저장한다.
   - 로그아웃·세션 만료 시 화면과 메모리의 자료를 모두 지운다. */
(function () {
  "use strict";

  const PATH = "/api/admin/personal-finance";
  const QUOTE_PATH = "/api/admin/stock-quotes";
  const VERSION = 3;
  /* ② 고정지출 정렬 — 값은 meta.fixedSort 로 서버에 함께 저장된다(기본: 지금 순서 그대로). */
  const SORTS = ["manual", "day-asc", "day-desc", "payday"];
  const SORT_LABEL = { manual: "직접 순서", "day-asc": "이체일 오름차순", "day-desc": "이체일 내림차순", payday: "월급일(20일) 기준" };
  const DEFAULT_SORT = "manual";
  const PAYDAY = 20;
  const FIELDS = {
    fixed: ["name", "amount", "day", "paid"],
    income: ["name", "amount"],
    cards: ["name", "amount"],
    nextCards: ["name", "amount"],
    debts: ["name", "balance", "rate", "principal", "interest", "maturity", "months", "memo"],
    assets: ["name", "buy", "qty", "price", "avg", "total", "memo", "link"],
    stocks: ["name", "code", "qty", "avg", "price", "change", "changeRate", "memo"],
    dcEtf: ["name", "code", "qty", "avg", "price", "change", "changeRate", "memo"],
    dc: ["year", "amount"]
  };
  const EMPTY_COLS = { fixed: 6, income: 3, cards: 3, nextCards: 3, debts: 10, assets: 9, stocks: 10, dcEtf: 10, dc: 3 };
  const EMPTY_HINT = {
    fixed: "‘＋ 행 추가’로 월세·보험·카드 대금처럼 매달 나가는 돈을 넣으면 이체일별 소계와 미납 잔금이 자동으로 잡힙니다.",
    income: "‘＋ 행 추가’로 월급·OT·기타 수입을 넣으면 위 리포트의 이달 적자/흑자가 바로 바뀝니다.",
    cards: "‘＋ 행 추가’로 이번 달 카드 3사 청구액을 넣으면 합계가 잡힙니다.",
    nextCards: "‘＋ 행 추가’로 다음 달 청구 예정액을 넣으면 위 리포트에 예정액 합계가 표시됩니다.",
    debts: "‘＋ 행 추가’로 대출을 넣으면 잔금·금리·월 이자가 합산되고 고금리 순위가 리포트에 뜹니다.",
    assets: "‘＋ 행 추가’로 주식·부동산·퇴직금을 넣으면 총자산·비중·손익이 계산됩니다. 개별 보유주식·DC 퇴직연금 ETF 는 아래 종목 표에 넣으면 이 표의 ‘보유주식’·‘퇴직금 DC’ 행으로 합계가 자동 반영됩니다.",
    stocks: "‘＋ 행 추가’로 종목명·종목코드(6자리)·수량·매입단가를 넣고 「🔄 호가 새로고침」을 누르면 현재가·평가금액이 채워집니다. 합계는 ⑤ 자산의 ‘보유주식’ 행으로 자동 반영됩니다.",
    dcEtf: "‘＋ 행 추가’로 퇴직연금에 담은 ETF 종목명·종목코드·수량·매입단가를 넣으세요. 합계는 ⑤ 자산의 ‘퇴직금 DC’ 행으로 자동 반영됩니다.",
    dc: "‘＋ 행 추가’로 연도별 DC 입금액을 넣으면 적립 합계가 잡힙니다."
  };
  /* ⑤ 자산 표와 자동으로 이어지는 두 종목 표(2026-11-25 v3).
     자산 표의 한 행(link="stocks"·"dcEtf")이 그 표의 합계를 따라가므로, 같은 금액이 두 번 합산되지 않는다. */
  const HOLDINGS = {
    stocks: { label: "개별 보유주식", assetName: "보유주식", badge: "🔗 보유주식 합계" },
    dcEtf: { label: "DC 퇴직연금 ETF", assetName: "퇴직금 DC", badge: "🔗 퇴직금 DC 합계" }
  };
  const HOLDING_TABLES = ["stocks", "dcEtf"];
  const PALETTE = ["#1d4ed8", "#0ea5e9", "#0a9e6c", "#f59e0b", "#7c3aed", "#64748b", "#db2777", "#0891b2"];

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
    const text = String(value).replace(/[,\s원₩%]/g, "").replace(/[^0-9.\-]/g, "");
    const n = parseFloat(text);
    return isFinite(n) ? n : 0;
  }
  function qtyNum(value) {
    const m = String(value === null || value === undefined ? "" : value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }
  function comma(n) {
    const raw = num(n);
    if (!isFinite(raw)) return "0";
    const rounded = Math.round(raw * 100) / 100;
    return rounded.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  }
  function won(n) { return comma(n) + "원"; }
  function signedWon(n) { return (num(n) < 0 ? "-" : "") + won(Math.abs(num(n))); }
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
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dayNum(text) {
    const m = String(text === null || text === undefined ? "" : text).match(/\d{1,2}/);
    return m ? parseInt(m[0], 10) : 0;
  }
  function dayOf(row) {
    const d = dayNum(row && row.day);
    return d > 0 ? Math.min(d, 31) : 0;
  }
  /* 이름 비교용 열쇠 — 띄어쓰기·괄호·‘카드’ 글자를 빼고 대문자로. (‘카드 현대’ ↔ ‘현대카드’) */
  function nameKey(name) {
    return String(name === null || name === undefined ? "" : name)
      .replace(/[\s()\[\]{}·.,\-_\/]/g, "").replace(/카드/g, "").toUpperCase();
  }
  function isOtIncome(row) {
    const key = nameKey(row && row.name);
    return key === "OT" || key.indexOf("OT") === 0 || key.indexOf("초과") >= 0;
  }
  function monthsUntil(text) {
    const m = /^(\d{4})-(\d{1,2})/.exec(String(text || "").trim());
    if (!m) return 0;
    const now = new Date();
    const diff = (Number(m[1]) - now.getFullYear()) * 12 + (Number(m[2]) - (now.getMonth() + 1));
    return diff > 0 ? diff : 0;
  }

  /* ───────── 상태 ───────── */
  function emptyState() {
    return { version: VERSION, meta: { asOf: "", fixedSort: DEFAULT_SORT, lastDebtDeductedMonth: "", quoteAt: "" }, fixed: [], income: [], cards: [], nextCards: [], debts: [], assets: [], stocks: [], dcEtf: [], dc: [], overtime: { hours: "", over8: "", night: "", wage: "" } };
  }
  function normalizeRow(table, row) {
    const item = { id: row && row.id ? String(row.id) : uid() };
    FIELDS[table].forEach((field) => {
      const value = row ? row[field] : "";
      item[field] = value === null || value === undefined ? "" : String(value);
    });
    if (row && row.manualAvg) item.manualAvg = true;
    if (row && row.manualTotal) item.manualTotal = true;
    if (row && row.manualInterest) item.manualInterest = true;
    if (row && row.manualMonths) item.manualMonths = true;
    return item;
  }
  /* 예전(v1: cashflow·loans·cards·assets) 자료도 잃지 않게 새 표로 옮긴다. */
  function upgradeLegacy(source) {
    const out = emptyState();
    const cash = Array.isArray(source.cashflow) ? source.cashflow : [];
    cash.forEach((row) => {
      const name = String(row && row.name ? row.name : "").trim();
      const amount = String(row && row.amount ? row.amount : "");
      if (!name && !amount) return;
      if (row && row.type === "수입") out.income.push(normalizeRow("income", { name: name || "수입", amount }));
      else out.fixed.push(normalizeRow("fixed", { name: name || "지출", amount, day: "", paid: "" }));
    });
    (Array.isArray(source.loans) ? source.loans : []).forEach((row) => {
      const org = String(row && row.org ? row.org : "").trim();
      const kind = String(row && row.kind ? row.kind : "").trim();
      const name = (org + " " + kind).trim();
      if (!name && !num(row && row.principal)) return;
      out.debts.push(normalizeRow("debts", {
        name: name || "대출",
        balance: row ? row.principal : "",
        rate: row ? row.rate : "",
        principal: "",
        interest: row && num(row.monthly) > 0 ? String(Math.round(num(row.monthly))) : "",
        maturity: "",
        months: "",
        memo: [row && row.repay, row && row.memo].filter(Boolean).join(" · ")
      }));
    });
    (Array.isArray(source.cards) ? source.cards : []).forEach((row) => {
      const name = String(row && row.company ? row.company : "").trim();
      if (!name && !num(row && row.amount)) return;
      out.cards.push(normalizeRow("cards", { name: name || "카드", amount: row ? row.amount : "" }));
    });
    (Array.isArray(source.assets) ? source.assets : []).forEach((row) => {
      const name = String(row && row.name ? row.name : "").trim();
      const category = String(row && row.category ? row.category : "").trim();
      if (!name && !num(row && row.total)) return;
      out.assets.push(normalizeRow("assets", {
        name: (category && category !== "기타" ? name : name) || "자산",
        buy: row && num(row.price) > 0 && qtyNum(row.qty) > 0 ? String(Math.round(num(row.price) * qtyNum(row.qty))) : "",
        qty: row ? row.qty : "",
        price: row ? row.price : "",
        avg: "",
        total: row ? row.total : "",
        memo: [category, row && row.memo].filter(Boolean).join(" · ")
      }));
    });
    return out;
  }
  function normalize(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const legacy = !Array.isArray(source.fixed) && !Array.isArray(source.debts) && (Array.isArray(source.cashflow) || Array.isArray(source.loans));
    const base = legacy ? upgradeLegacy(source) : emptyState();
    const out = emptyState();
    out.meta.asOf = source.meta && source.meta.asOf ? String(source.meta.asOf) : base.meta.asOf;
    const sort = source.meta && source.meta.fixedSort ? String(source.meta.fixedSort) : base.meta.fixedSort;
    out.meta.fixedSort = SORTS.indexOf(sort) >= 0 ? sort : DEFAULT_SORT;
    const deducted = source.meta && source.meta.lastDebtDeductedMonth ? String(source.meta.lastDebtDeductedMonth).trim() : "";
    out.meta.lastDebtDeductedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(deducted) ? deducted : "";
    const quoted = source.meta && source.meta.quoteAt ? String(source.meta.quoteAt).trim() : "";
    out.meta.quoteAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(quoted) ? quoted.slice(0, 19) + "Z" : "";
    Object.keys(FIELDS).forEach((table) => {
      const list = Array.isArray(source[table]) ? source[table] : base[table];
      out[table] = (Array.isArray(list) ? list : []).map((row) => normalizeRow(table, row));
    });
    const ot = source.overtime && typeof source.overtime === "object" ? source.overtime : base.overtime;
    ["hours", "over8", "night", "wage"].forEach((key) => {
      const value = ot ? ot[key] : "";
      out.overtime[key] = value === null || value === undefined ? "" : String(value);
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
  let lastTotals = {};

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

  /* ───────── 입력 칸 만들기 ───────── */
  function attrs(table, id, key) { return 'data-t="' + table + '" data-f="' + esc(id) + '" data-k="' + key + '"'; }
  function textInput(table, row, key, placeholder, extra) {
    return '<input ' + attrs(table, row.id, key) + ' value="' + esc(row[key]) + '" placeholder="' + esc(placeholder || "") + '" spellcheck="false" autocomplete="off"' + (extra || "") + '>';
  }
  /* 종목코드 칸 — 6자리(숫자·신규 ETF 영문)만 받고 항상 대문자로 보여 준다. */
  function codeInput(table, row) {
    const value = String(row.code === null || row.code === undefined ? "" : row.code).trim();
    return '<input class="mono code" inputmode="text" maxlength="6" ' + attrs(table, row.id, "code") +
      ' value="' + esc(value) + '" placeholder="005930" spellcheck="false" autocomplete="off"' +
      ' style="text-transform:uppercase;letter-spacing:.5px">';
  }
  function moneyInput(table, row, key, extra) {
    const value = String(row[key] === null || row[key] === undefined ? "" : row[key]).trim();
    return '<input class="num" inputmode="numeric" ' + attrs(table, row.id, key) + ' value="' + (value === "" ? "" : comma(value)) + '" placeholder="0" spellcheck="false" autocomplete="off"' + (extra || "") + '>';
  }
  function countInput(table, row, key, placeholder, extra) {
    const value = String(row[key] === null || row[key] === undefined ? "" : row[key]).trim();
    return '<input class="num" inputmode="decimal" ' + attrs(table, row.id, key) + ' value="' + esc(value) + '" placeholder="' + esc(placeholder || "0") + '" spellcheck="false" autocomplete="off"' + (extra || "") + '>';
  }
  function delCell(table, row) {
    return '<td class="num"><button class="del" type="button" data-fin-del="' + table + '" data-f="' + esc(row.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td>';
  }
  function emptyRow(table) {
    return '<tr><td colspan="' + EMPTY_COLS[table] + '" class="fin-empty">' + esc(EMPTY_HINT[table]) + '</td></tr>';
  }
  function getRow(table, id) {
    const list = state[table] || [];
    for (let i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }

  /* ───────── 표 그리기 ───────── */
  function isPaidRow(r) {
    const paid = String(r.paid || "").trim();
    return paid !== "" && paid !== "미납";
  }
  /* 같은 이체일을 하나로 묶는 열쇠 — ‘25’·‘025’·‘25일’을 모두 25 로 본다. */
  function dayKeyOf(row) {
    const d = dayOf(row);
    return d ? String(d) : String((row && row.day) || "").trim();
  }
  /* 화면에 보여 줄 고정지출 순서 — 같은 이체일은 항상 한 덩어리로 모으고,
     직접 순서면 ‘날짜가 처음 나온 차례’를 그대로 그룹 순서로 쓴다. */
  function displayFixed() {
    const list = state.fixed.slice();
    const sort = state.meta && SORTS.indexOf(state.meta.fixedSort) >= 0 ? state.meta.fixedSort : DEFAULT_SORT;
    if (sort === "manual") {
      const days = [];
      list.forEach((r) => { const key = dayKeyOf(r); if (days.indexOf(key) < 0) days.push(key); });
      return list.sort((a, b) => days.indexOf(dayKeyOf(a)) - days.indexOf(dayKeyOf(b)));
    }
    const rank = (r) => {
      const d = dayOf(r);
      if (!d) return -1;                      // 이체일 미지정은 언제나 맨 아래
      if (sort === "payday") return (d - PAYDAY + 31) % 31;  // 20 → 0, 21 → 1 … 19 → 30
      return d;
    };
    list.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra < 0 && rb < 0) return 0;
      if (ra < 0) return 1;
      if (rb < 0) return -1;
      return sort === "day-desc" ? rb - ra : ra - rb;
    });
    return list;
  }
  function cardLinkKeys() {
    const keys = new Set();
    state.cards.forEach((c) => { const key = nameKey(c.name); if (key) keys.add(key); });
    return keys;
  }
  function renderFixed() {
    const body = $("#fin-fx-body");
    if (!body) return;
    renderBulkNote();
    if (!state.fixed.length) { body.innerHTML = emptyRow("fixed"); updateLinkNotes(); return; }
    const order = displayFixed();
    const groups = [];
    order.forEach((r) => {
      const day = dayKeyOf(r);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.rows.push(r);
      else groups.push({ day, rows: [r] });
    });
    const linked = cardLinkKeys();
    const html = [];
    groups.forEach((group) => {
      let sum = 0;
      let unpaid = 0;
      group.rows.forEach((r) => {
        sum += num(r.amount);
        if (!isPaidRow(r)) unpaid += num(r.amount);
      });
      const dayText = group.day === "" ? "이체일 미지정" : (/^\d+$/.test(group.day) ? Number(group.day) + "일" : group.day);
      /* 그룹 소계 줄은 항목 위(그룹 머리)에 둔다. */
      html.push('<tr class="fin-sub">' +
        '<td class="fx-day">📅 ' + esc(dayText) + ' <span class="fin-sub-count">' + group.rows.length + '건</span></td>' +
        '<td class="num fx-sum">' + won(sum) + '</td>' +
        '<td class="fx-blank"></td>' +
        '<td class="num fx-unpaid ' + (unpaid ? "t-neg fin-sub-unpaid" : "muted") + '">' + (unpaid ? "잔금 " + won(unpaid) : "완납") + '</td>' +
        '<td class="fx-blank" colspan="2"></td></tr>');
      group.rows.forEach((r) => {
        const index = order.indexOf(r);
        const key = dayKeyOf(r);
        const canUp = index > 0 && dayKeyOf(order[index - 1]) === key;
        const canDown = index < order.length - 1 && dayKeyOf(order[index + 1]) === key;
        const cardTag = linked.has(nameKey(r.name)) ? '<span class="fin-link-dot" title="③ 이번 달 카드 금액을 따라갑니다">③↔</span>' : "";
        html.push('<tr data-id="' + esc(r.id) + '">' +
          '<td class="fx-name"><div class="fin-name-cell">' + textInput("fixed", r, "name", "항목 (예: 주택담보)") + cardTag + '</div></td>' +
          '<td class="num fx-amount">' + moneyInput("fixed", r, "amount") + '</td>' +
          '<td class="fx-day" data-label="이체일">' + textInput("fixed", r, "day", "20", ' class="mono day"') + '</td>' +
          '<td class="center fx-paid"><button type="button" class="paid-toggle ' + (isPaidRow(r) ? "on" : "off") + '" data-fin-paid="' + esc(r.id) + '" title="눌러서 O / 미납 전환">' + (isPaidRow(r) ? "O" : "미납") + '</button></td>' +
          '<td class="center fin-move fx-move">' +
            '<button type="button" class="mv" data-fin-move="up" data-f="' + esc(r.id) + '" title="같은 이체일 안에서 위로" aria-label="위로 이동"' + (canUp ? "" : " disabled") + '>↑</button>' +
            '<button type="button" class="mv" data-fin-move="down" data-f="' + esc(r.id) + '" title="같은 이체일 안에서 아래로" aria-label="아래로 이동"' + (canDown ? "" : " disabled") + '>↓</button>' +
          '</td>' +
          '<td class="num fx-del"><button class="del" type="button" data-fin-del="fixed" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button></td></tr>');
      });
    });
    body.innerHTML = html.join("");
    const count = $("#fin-fx-count");
    if (count) count.textContent = state.fixed.length + "개";
    updateLinkNotes();
  }

  /* 툴바의 작은 현황 — 일괄 체크/해제 뒤 몇 건이 납입·미납인지 바로 보이게 한다. */
  function renderBulkNote() {
    const el = $("#fin-fx-bulk-note");
    if (!el) return;
    if (!state.fixed.length) { el.textContent = ""; return; }
    const paid = state.fixed.filter(isPaidRow).length;
    const unpaid = state.fixed.length - paid;
    el.innerHTML = '납입 <b class="on">' + paid + '</b> · 미납 <b class="off">' + unpaid + '</b> / ' + state.fixed.length + '건';
  }

  /* 정렬 선택칸과 연동 안내 문구 */
  function renderSortSelect() {
    const el = $("#fin-fx-sort");
    if (!el || document.activeElement === el) return;
    el.value = SORTS.indexOf(state.meta.fixedSort) >= 0 ? state.meta.fixedSort : DEFAULT_SORT;
  }
  function updateLinkNotes() {
    const fxNote = $("#fin-fx-link");
    if (fxNote) {
      const keys = cardLinkKeys();
      const matched = state.fixed.filter((r) => keys.has(nameKey(r.name)));
      if (!matched.length) {
        fxNote.innerHTML = "🔗 ③ 이번 달 카드와 <b>이름이 같은 행</b>이 있으면 그 금액이 여기로 자동 반영됩니다(예: ③ ‘카드 현대’ → ② ‘카드 현대’).";
      } else {
        fxNote.innerHTML = "🔗 ③ 이번 달 카드 금액을 따라가는 행 <b>" + matched.length + "개</b> — " + matched.map((r) => esc(r.name || "(이름 없음)")).join(" · ") + " (③에서 고치면 이 표도 함께 바뀝니다)";
      }
    }
    const inNote = $("#fin-in-link");
    if (!inNote) return;
    const total = overtimeTotalRounded();
    const target = state.income.filter(isOtIncome)[0] || null;
    if (!total && !target) {
      inNote.innerHTML = "🔗 ⑥ 초과근로에 시간·시급을 넣으면 그 <b>합계(반올림 원)</b>가 여기 <b>OT</b> 항목에 자동으로 들어갑니다.";
    } else if (!total) {
      inNote.innerHTML = "🔗 ⑥ 초과근로 시간·시급을 넣으면 OT 항목이 자동으로 맞춰집니다. (지금 OT 금액은 직접 적은 값입니다)";
    } else if (!target) {
      inNote.innerHTML = "🔗 ⑥ 초과근로 합계 <b>" + won(total) + "</b> — 초과근로 시간·시급을 고치면 OT 행이 자동으로 생깁니다.";
    } else if (num(target.amount) === total) {
      inNote.innerHTML = "🔗 ⑥ 초과근로 합계 <b>" + won(total) + "</b> — OT 항목과 같습니다 (자동 반영 중).";
    } else {
      inNote.innerHTML = "🔗 ⑥ 초과근로 합계 <b>" + won(total) + "</b> · OT 항목 <b>" + won(num(target.amount)) + "</b> — 명세서 숫자로 직접 고친 값입니다. 초과근로 시간·시급을 다시 바꾸면 자동으로 맞춰집니다.";
    }
  }

  /* 매달 직접 고치는 줄에 붙는 붉은 * — 공개 코드에 개인 항목명을 적지 않고 규칙으로 고른다.
     · 카드: 카드사 금액은 매달 청구액으로 바뀌므로 모든 행
     · 수입: 금액이 적힌 행(월급·OT·날짜 수입 등) — 빈 ‘기타’ 행은 표시하지 않는다 */
  function starRow(table, row) {
    if (table === "cards") return true;
    if (table === "income") {
      return isOtIncome(row) || String(row.amount === null || row.amount === undefined ? "" : row.amount).trim() !== "";
    }
    return false;
  }
  function renderSimple(table, bodySel, countSel, namePh) {
    const body = $(bodySel);
    if (!body) return;
    if (!state[table].length) { body.innerHTML = emptyRow(table); return; }
    body.innerHTML = state[table].map((r) =>
      '<tr data-id="' + esc(r.id) + '">' +
        '<td><div class="fin-name-cell">' +
          (starRow(table, r) ? '<span class="req-star" title="매달 직접 고치는 칸">*</span>' : "") +
          textInput(table, r, "name", namePh) + '</div></td>' +
        '<td class="num">' + moneyInput(table, r, "amount") + '</td>' +
        delCell(table, r) + '</tr>'
    ).join("");
    const count = $(countSel);
    if (count) count.textContent = state[table].length + "개";
  }

  function renderDebts() {
    const body = $("#fin-dt-body");
    if (!body) return;
    if (!state.debts.length) { body.innerHTML = emptyRow("debts"); const c = $("#fin-dt-count"); if (c) c.textContent = "0개"; return; }
    body.innerHTML = state.debts.map((r) =>
      '<tr data-id="' + esc(r.id) + '">' +
        '<td>' + textInput("debts", r, "name", "종목 (예: 주택담보)") + '</td>' +
        '<td class="num">' + moneyInput("debts", r, "balance") + '</td>' +
        '<td class="num">' + countInput("debts", r, "rate", "0.00", ' data-fmt="rate"') + '</td>' +
        '<td class="num calc" data-calc="debt-pay:' + esc(r.id) + '">0원</td>' +
        '<td class="num">' + moneyInput("debts", r, "principal") + '</td>' +
        '<td class="num">' + moneyInput("debts", r, "interest", ' data-auto="interest"') + '</td>' +
        '<td>' + textInput("debts", r, "maturity", "2040-06", ' class="mono"') + '</td>' +
        '<td class="num">' + countInput("debts", r, "months", "0", ' data-auto="months"') + '</td>' +
        '<td>' + textInput("debts", r, "memo", "원리금 / 마통") + '</td>' +
        delCell("debts", r) + '</tr>'
    ).join("");
    const count = $("#fin-dt-count");
    if (count) count.textContent = state.debts.length + "개";
  }

  function renderAssets() {
    const body = $("#fin-as-body");
    if (!body) return;
    if (!state.assets.length) { body.innerHTML = emptyRow("assets"); const c = $("#fin-as-count"); if (c) c.textContent = "0개"; return; }
    body.innerHTML = state.assets.map((r) => (r && r.link ? renderLinkedAssetRow(r) :
      '<tr data-id="' + esc(r.id) + '">' +
        '<td>' + textInput("assets", r, "name", "종목 (예: 국내주식 A)") + '</td>' +
        '<td class="num">' + moneyInput("assets", r, "buy") + '</td>' +
        '<td class="num">' + countInput("assets", r, "qty", "0") + '</td>' +
        '<td class="num">' + moneyInput("assets", r, "price") + '</td>' +
        '<td class="num">' + moneyInput("assets", r, "avg", ' data-auto="avg"') + '</td>' +
        '<td class="num calc" data-calc="as-weight:' + esc(r.id) + '">0.0%</td>' +
        '<td class="num calc" data-calc="as-pl:' + esc(r.id) + '">0원</td>' +
        '<td class="num">' + moneyInput("assets", r, "total", ' data-auto="total"') + '</td>' +
        delCell("assets", r) + '</tr>'
    )).join("");
    const count = $("#fin-as-count");
    if (count) count.textContent = state.assets.length + "개";
  }

  function renderDC() {
    const body = $("#fin-dc-body");
    if (!body) return;
    if (!state.dc.length) { body.innerHTML = emptyRow("dc"); const c = $("#fin-dc-count"); if (c) c.textContent = "0개"; return; }
    body.innerHTML = state.dc.map((r) =>
      '<tr data-id="' + esc(r.id) + '">' +
        '<td>' + textInput("dc", r, "year", "25년 입금", ' class="mono"') + '</td>' +
        '<td class="num">' + moneyInput("dc", r, "amount") + '</td>' +
        delCell("dc", r) + '</tr>'
    ).join("");
    const count = $("#fin-dc-count");
    if (count) count.textContent = state.dc.length + "개";
  }

  /* ───────── 종목 표(개별 보유주식 · DC 퇴직연금 ETF) ─────────
     행 하나가 [종목명 · 종목코드(6자리) · 수량 · 매입단가 · 매입금액 · 현재가(호가) · 전일대비 · 평가금액 · 손익].
     매입금액 = 수량 × 매입단가, 평가금액 = 수량 × 현재가, 손익 = 평가금액 − 매입금액.
     표 합계는 ⑤ 자산 표의 연동 행(link) 한 곳으로만 들어가므로 두 번 합산되지 않는다. */
  function codeOfRow(row) {
    const code = String(row && row.code ? row.code : "").replace(/[\s-]/g, "").toUpperCase();
    return /^[0-9A-Z]{6}$/.test(code) ? code : "";
  }
  function holdingCostOf(row) { return Math.round(qtyNum(row && row.qty) * num(row && row.avg)); }
  function holdingValueOf(row) { return Math.round(qtyNum(row && row.qty) * num(row && row.price)); }
  function holdingsTotals(table) {
    const out = { count: 0, cost: 0, value: 0, pl: 0 };
    (state[table] || []).forEach((row) => {
      out.count += 1;
      out.cost += holdingCostOf(row);
      out.value += holdingValueOf(row);
    });
    out.pl = out.value - out.cost;
    return out;
  }
  function changeText(row) {
    const change = num(row && row.change);
    const rate = num(row && row.changeRate);
    if (!change && !rate) return num(row && row.price) > 0 ? "보합" : "–";
    const arrow = change > 0 ? "▲" : (change < 0 ? "▼" : "－");
    return arrow + " " + comma(Math.abs(change)) + " (" + (rate > 0 ? "+" : rate < 0 ? "−" : "") + Math.abs(rate).toFixed(2) + "%)";
  }
  /* 전일대비·손익 색 — 한국 주식 관례(상승=빨강, 하락=파랑, 보합=회색). */
  function changeClass(row) {
    const change = num(row && row.change);
    if (change > 0) return "t-up";
    if (change < 0) return "t-down";
    return "t-flat";
  }
  function plClass(value) {
    if (value > 0) return "t-up";
    if (value < 0) return "t-down";
    return "t-flat";
  }

  function renderHoldings(table) {
    const body = $('[data-fin-body="' + table + '"]');
    if (!body) return;
    const count = $('[data-fin-count="' + table + '"]');
    if (!state[table].length) {
      body.innerHTML = emptyRow(table);
      if (count) count.textContent = "0개";
      return;
    }
    body.innerHTML = state[table].map((r) => {
      const cost = holdingCostOf(r);
      const value = holdingValueOf(r);
      const pl = value - cost;
      const valued = value > 0 || cost > 0;
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td><div class="fin-name-cell">' + textInput(table, r, "name", "종목명") + '</div></td>' +
        '<td>' + codeInput(table, r) + '</td>' +
        '<td class="num">' + countInput(table, r, "qty", "0") + '</td>' +
        '<td class="num">' + moneyInput(table, r, "avg") + '</td>' +
        '<td class="num calc" data-calc="h-cost:' + esc(r.id) + '">' + won(cost) + '</td>' +
        '<td class="num">' + moneyInput(table, r, "price") + '</td>' +
        '<td class="num calc ' + changeClass(r) + '" data-calc="h-chg:' + esc(r.id) + '">' + esc(changeText(r)) + '</td>' +
        '<td class="num calc" data-calc="h-val:' + esc(r.id) + '">' + won(value) + '</td>' +
        '<td class="num calc ' + plClass(pl) + '" data-calc="h-pl:' + esc(r.id) + '">' + (valued ? signedWon(pl) : "–") + '</td>' +
        delCell(table, r) + '</tr>';
    }).join("");
    if (count) count.textContent = state[table].length + "개";
  }

  /* 연동 행 — 종목 표가 비어 있는데 자산 표에 연동 행이 있으면, 표를 채울 때 바로 반영되도록 하나만 둔다. */
  function linkedRowsOf(link) { return state.assets.filter((r) => r && r.link === link); }
  function primaryLinkedRow(link) { const list = linkedRowsOf(link); return list.length ? list[0] : null; }
  function ensureLinkedAssets() {
    let added = false;
    HOLDING_TABLES.forEach((table) => {
      if (!state[table].length) return;
      if (linkedRowsOf(table).length) return;
      const row = blankRow("assets");
      row.name = HOLDINGS[table].assetName;
      row.link = table;
      state.assets.push(row);
      added = true;
    });
    return added;
  }
  function renderLinkedAssetRow(r) {
    const meta = HOLDINGS[r.link] || { label: r.link, badge: "연동" };
    const group = holdingsTotals(r.link);
    const primary = primaryLinkedRow(r.link) === r;
    const value = primary ? group.value : 0;
    const cost = primary ? group.cost : 0;
    return '<tr data-id="' + esc(r.id) + '" class="fin-linked">' +
      '<td><div class="fin-name-cell">' + textInput("assets", r, "name", meta.assetName) +
        '<span class="fin-link-dot" title="' + esc(meta.label) + ' 표의 합계를 따라갑니다">🔗</span></div>' +
        '<span class="fin-linked-note">' + (primary ? esc(meta.badge) : "중복 연동 — 합계에서 제외") + '</span></td>' +
      '<td class="num calc" data-calc="as-buy:' + esc(r.id) + '">' + won(cost) + '</td>' +
      '<td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td>' +
      '<td class="num calc" data-calc="as-weight:' + esc(r.id) + '">0.0%</td>' +
      '<td class="num calc" data-calc="as-pl:' + esc(r.id) + '">0원</td>' +
      '<td class="num calc" data-calc="as-total:' + esc(r.id) + '">' + won(value) + '</td>' +
      '<td class="num">' + (group.count
        ? '<span class="fin-lock" title="' + esc(meta.label) + ' 표에서 행을 지우면 이 행도 합계에서 빠집니다">🔒</span>'
        : '<button class="del" type="button" data-fin-del="assets" data-f="' + esc(r.id) + '" title="이 행 삭제" aria-label="이 행 삭제">✕</button>') + '</td></tr>';
  }

  function renderOvertimeInputs() {
    const ot = state.overtime || {};
    ["hours", "over8", "night", "wage"].forEach((key) => {
      const el = root() ? root().querySelector('[data-t="overtime"][data-k="' + key + '"]') : null;
      if (!el || document.activeElement === el) return;
      const value = String(ot[key] === null || ot[key] === undefined ? "" : ot[key]).trim();
      el.value = key === "wage" && value !== "" ? comma(value) : value;
    });
  }

  function renderAsOf() {
    const el = $("#fin-asof");
    if (!el || document.activeElement === el) return;
    el.value = state.meta && state.meta.asOf ? state.meta.asOf : "";
  }
  function renderQuoteStamp() {
    const el = $("#fin-quote-time");
    if (!el) return;
    const at = state.meta && state.meta.quoteAt ? new Date(state.meta.quoteAt) : null;
    el.textContent = at && !isNaN(at.getTime())
      ? "마지막 호가 " + prettyTime(at) + " · 네이버 금융 기준(종가)"
      : "아직 호가를 불러오지 않았습니다";
  }

  function renderAll() {
    renderFixed();
    renderSimple("income", "#fin-in-body", "#fin-in-count", "항목 (예: 월급 20일)");
    renderSimple("cards", "#fin-cd-body", "#fin-cd-count", "카드사 (예: 현대)");
    renderSimple("nextCards", "#fin-nc-body", "#fin-nc-count", "카드사 (예: 현대)");
    renderDebts();
    renderAssets();
    renderHoldings("stocks");
    renderHoldings("dcEtf");
    renderDC();
    renderOvertimeInputs();
    renderAsOf();
    renderSortSelect();
    updateDebtBadge();
    sync();
  }

  /* ───────── 🔄 호가 새로고침 — 종목 표의 6자리 코드로 현재가·전일 대비를 받아 온다 ─────────
     서버(복지모아 POST /api/admin/stock-quotes)가 네이버 금융 공개 시세를 읽어 준다.
     받은 현재가로 평가금액·자산 합계·순자산·부채비율이 즉시 다시 계산되고, 0.5초 뒤 DB 에 저장된다. */
  let quoting = false;
  const MAX_QUOTE_CODES = 40; /* 서버 한도와 같다 */
  function holdingCodeList() {
    const out = [];
    HOLDING_TABLES.forEach((table) => {
      (state[table] || []).forEach((r) => {
        const code = codeOfRow(r);
        if (code && out.indexOf(code) < 0) out.push(code);
      });
    });
    return out;
  }
  function holdingCodes() { return holdingCodeList().slice(0, MAX_QUOTE_CODES); }
  function setQuoting(on) {
    quoting = on;
    $$("[data-fin-quotes]").forEach((btn) => {
      btn.disabled = on;
      btn.textContent = on ? "⏳ 시세 불러오는 중…" : "🔄 호가 새로고침";
    });
  }
  async function refreshQuotes() {
    if (!loaded) { ensureLoaded(); return; }
    if (!request || quoting) return;
    const allCodes = holdingCodeList();
    const codes = allCodes.slice(0, MAX_QUOTE_CODES);
    if (!codes.length) {
      toast("종목코드가 있는 행이 없습니다. 종목명과 6자리 종목코드를 먼저 넣어 주세요.");
      return;
    }
    setQuoting(true);
    const result = await request(QUOTE_PATH, { method: "POST", json: true, body: JSON.stringify({ codes }) });
    setQuoting(false);
    if (!result.ok) {
      showWarn(result.error || "시세를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      toast("시세를 불러오지 못했습니다.");
      return;
    }
    const data = result.data || {};
    const quotes = Array.isArray(data.quotes) ? data.quotes : [];
    const byCode = {};
    quotes.forEach((q) => { if (q && q.code) byCode[String(q.code).toUpperCase()] = q; });
    let updated = 0;
    const missing = [];
    HOLDING_TABLES.forEach((table) => {
      (state[table] || []).forEach((r) => {
        const code = codeOfRow(r);
        if (!code) return;
        const quote = byCode[code];
        if (!quote) { if (missing.indexOf(code) < 0) missing.push(code); return; }
        r.price = String(quote.price);
        r.change = String(quote.change);
        r.changeRate = String(quote.changeRate);
        /* 종목명을 비워 둔 행은 시세에서 받은 이름으로 채워 준다. */
        if (String(r.name || "").trim() === "" && quote.name) r.name = String(quote.name).slice(0, 60);
        updated += 1;
      });
    });
    if (updated) {
      const at = data.fetchedAt ? new Date(data.fetchedAt) : new Date();
      state.meta.quoteAt = isNaN(at.getTime()) ? new Date().toISOString().slice(0, 19) + "Z" : at.toISOString().slice(0, 19) + "Z";
    }
    renderHoldings("stocks");
    renderHoldings("dcEtf");
    renderAssets();
    sync();
    if (updated) scheduleSave();
    const parts = [];
    if (updated) parts.push("현재가 " + updated + "종목 반영");
    if (missing.length) parts.push("못 찾은 코드 " + missing.join("·"));
    if (allCodes.length > codes.length) parts.push("한 번에 " + MAX_QUOTE_CODES + "종목까지만 조회(나머지 " + (allCodes.length - codes.length) + "종목은 다음에)");
    toast(parts.join(" · ") || "바뀐 시세가 없습니다.");
    showWarn(missing.length ? "일부 종목의 시세를 찾지 못했습니다(" + missing.join(", ") + "). 종목코드 6자리를 확인해 주세요." : "");
  }

  /* ───────── 계산 ───────── */
  function interestOf(row) {
    if (String(row.interest || "").trim() !== "") return num(row.interest);
    return Math.round(num(row.balance) * num(row.rate) / 1200);
  }
  function assetTotalOf(row) {
    if (row && row.link) {
      /* 연동 행은 종목 표의 합계를 따른다. 같은 link 가 둘 이상이면 첫 번째 행만 값을 가진다(중복 합산 방지). */
      if (primaryLinkedRow(row.link) !== row) return 0;
      return holdingsTotals(row.link).value;
    }
    if (row.manualTotal && String(row.total || "").trim() !== "") return Math.round(num(row.total));
    const qty = qtyNum(row.qty);
    const price = num(row.price);
    if (qty > 0 && price > 0) return Math.round(qty * price);
    return Math.round(num(row.total));
  }
  /* 매입금액(원가) — 연동 행은 종목 표의 수량×매입단가 합계. */
  function assetCostOf(row) {
    if (row && row.link) {
      if (primaryLinkedRow(row.link) !== row) return 0;
      return holdingsTotals(row.link).cost;
    }
    return num(row.buy);
  }
  /* 평가액(합계)이 있는 행만 손익을 계산한다. 평가하지 않은 행(전액 손실 처리 등)은 ‘–’. */
  function assetValued(row) {
    if (row && row.link) return holdingsTotals(row.link).count > 0;
    if (String(row.total || "").trim() !== "") return true;
    return qtyNum(row.qty) > 0 && num(row.price) > 0;
  }
  function assetAvgOf(row) {    if (row.manualAvg && String(row.avg || "").trim() !== "") return Math.round(num(row.avg));
    const qty = qtyNum(row.qty);
    if (qty > 0) return Math.round(num(row.buy) / qty);
    return Math.round(num(row.avg));
  }
  function overtimeTotalRounded() { return Math.round(overtimeTotals().total); }
  function overtimeTotals() {
    const ot = state.overtime || {};
    const wage = num(ot.wage);
    const hours = num(ot.hours);
    const over8 = num(ot.over8);
    const night = num(ot.night);
    const base = wage * hours;
    const ext = wage * 0.5 * hours;
    const over8Pay = wage * 0.5 * over8;
    const nightPay = wage * 0.5 * night;
    return { base, ext, over8: over8Pay, night: nightPay, total: base + ext + over8Pay + nightPay };
  }
  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text;
  }
  function setClass(sel, className) {
    const el = $(sel);
    if (el) el.className = className;
  }
  function setCalc(key, text) {
    if (!root()) return;
    const el = root().querySelector('[data-calc="' + key + '"]');
    if (el) el.textContent = text;
  }
  function setInputValue(table, id, key, value) {
    const el = root() ? root().querySelector('[data-t="' + table + '"][data-f="' + id + '"][data-k="' + key + '"]') : null;
    if (!el || document.activeElement === el) return;
    el.value = value === "" ? "" : comma(value);
  }

  function totals() {
    let fixedTotal = 0;
    let unpaidTotal = 0;
    let unpaidCount = 0;
    const byDay = {};
    const dayOrder = [];
    state.fixed.forEach((r) => {
      const amount = num(r.amount);
      const day = String(r.day || "").trim();
      const paid = String(r.paid || "").trim();
      const isPaid = paid !== "" && paid !== "미납";
      fixedTotal += amount;
      if (!(day in byDay)) { byDay[day] = { sum: 0, unpaid: 0, count: 0 }; dayOrder.push(day); }
      byDay[day].sum += amount;
      byDay[day].count += 1;
      if (!isPaid) {
        unpaidTotal += amount;
        unpaidCount += 1;
        byDay[day].unpaid += amount;
      }
    });
    let incomeTotal = 0;
    state.income.forEach((r) => { incomeTotal += num(r.amount); });
    let cardTotal = 0;
    state.cards.forEach((r) => { cardTotal += num(r.amount); });
    let nextCardTotal = 0;
    state.nextCards.forEach((r) => { nextCardTotal += num(r.amount); });
    let debtBalance = 0;
    let debtInterest = 0;
    let debtPrincipal = 0;
    let weighted = 0;
    state.debts.forEach((r) => {
      const balance = num(r.balance);
      debtBalance += balance;
      debtInterest += interestOf(r);
      debtPrincipal += num(r.principal);
      weighted += balance * num(r.rate);
    });
    let assetTotal = 0;
    let assetBuy = 0;
    const assetValues = {};
    state.assets.forEach((r) => {
      const value = assetTotalOf(r);
      assetValues[r.id] = value;
      assetTotal += value;
      assetBuy += assetCostOf(r);
    });
    let dcTotal = 0;
    state.dc.forEach((r) => { dcTotal += num(r.amount); });
    return {
      fixedTotal, unpaidTotal, unpaidCount, byDay, dayOrder,
      incomeTotal, cardTotal, nextCardTotal,
      debtBalance, debtInterest, debtPrincipal,
      avgRate: debtBalance > 0 ? weighted / debtBalance : 0,
      assetTotal, assetBuy, assetValues, dcTotal,
      flow: incomeTotal - fixedTotal,
      net: assetTotal - debtBalance,
      ot: overtimeTotals()
    };
  }

  function sync() {
    const t = totals();
    lastTotals = t;

    /* 고정지출 */
    setText("#fin-fx-total", won(t.fixedTotal));
    setText("#fin-fx-unpaid", won(t.unpaidTotal));
    setText("#fin-fx-income", won(t.incomeTotal));
    setText("#fin-fx-flow", signedWon(t.flow));
    setClass("#fin-fx-flow", "num " + (t.flow > 0 ? "t-pos" : (t.flow < 0 ? "t-neg" : "")));

    /* 수입 · 카드 */
    setText("#fin-in-total", won(t.incomeTotal));
    setText("#fin-cd-total", won(t.cardTotal));
    setText("#fin-nc-total", won(t.nextCardTotal));

    /* 부채 */
    setText("#fin-dt-balance", won(t.debtBalance));
    setText("#fin-dt-rate", (Math.round(t.avgRate * 100) / 100).toFixed(2) + "%");
    setText("#fin-dt-pay", won(t.debtPrincipal + t.debtInterest));
    setText("#fin-dt-principal", won(t.debtPrincipal));
    setText("#fin-dt-interest", won(t.debtInterest));
    state.debts.forEach((r) => {
      setCalc("debt-pay:" + r.id, won(num(r.principal) + interestOf(r)));
    });

    /* 자산 */
    setText("#fin-as-total", won(t.assetTotal));
    setText("#fin-as-buy", won(t.assetBuy));
    let plTotal = 0;
    state.assets.forEach((r) => {
      const value = t.assetValues[r.id] || 0;
      const cost = assetCostOf(r);
      const valued = assetValued(r);
      const pl = value - cost;
      if (valued) plTotal += pl;
      setCalc("as-weight:" + r.id, valued && t.assetTotal > 0 ? (value / t.assetTotal * 100).toFixed(1) + "%" : "0.0%");
      setCalc("as-pl:" + r.id, valued ? ((pl < 0 ? "−" : "") + comma(Math.abs(pl)) + "원") : "–");
      /* 행별 손실/수익도 한국 주식 관례 색(상승=빨강, 하락=파랑, 보합·미평가=회색)으로 칠한다. */
      const plCell = root() ? root().querySelector('[data-calc="as-pl:' + r.id + '"]') : null;
      if (plCell) plCell.className = "num calc " + (valued ? plClass(pl) : "");
      /* 연동 행은 매입금액·평가금액도 계산값으로 보여 주고, 백업·CSV 에 같은 숫자가 남게 행에도 적어 둔다. */
      if (r.link && primaryLinkedRow(r.link) === r) {
        setCalc("as-buy:" + r.id, won(cost));
        setCalc("as-total:" + r.id, won(value));
        r.buy = String(Math.round(cost));
        r.total = String(Math.round(value));
      }
    });
    setText("#fin-as-pl", signedWon(plTotal));
    setClass("#fin-as-pl", "num " + plClass(plTotal));
    renderComposition(t.assetTotal);

    /* 종목 표 — 행별 매입금액·평가금액·손익·전일대비 */
    HOLDING_TABLES.forEach((table) => {
      (state[table] || []).forEach((r) => {
        const cost = holdingCostOf(r);
        const value = holdingValueOf(r);
        const pl = value - cost;
        setCalc("h-cost:" + r.id, won(cost));
        setCalc("h-val:" + r.id, won(value));
        setCalc("h-pl:" + r.id, (value > 0 || cost > 0) ? signedWon(pl) : "–");
        const chgCell = root() ? root().querySelector('[data-calc="h-chg:' + r.id + '"]') : null;
        if (chgCell) { chgCell.textContent = changeText(r); chgCell.className = "num calc " + changeClass(r); }
        const plCell = root() ? root().querySelector('[data-calc="h-pl:' + r.id + '"]') : null;
        if (plCell) plCell.className = "num calc " + plClass(pl);
      });
      const sum = holdingsTotals(table);
      setText('[data-fin-sum="' + table + ':cost"]', won(sum.cost));
      setText('[data-fin-sum="' + table + ':value"]', won(sum.value));
      setText('[data-fin-sum="' + table + ':pl"]', signedWon(sum.pl));
      setClass('[data-fin-sum="' + table + ':pl"]', "num " + plClass(sum.pl));
    });
    renderQuoteStamp();

    /* DC */
    setText("#fin-dc-total", won(t.dcTotal));

    /* 초과근로 */
    setCalc("ot:base", won(t.ot.base));
    setCalc("ot:ext", won(t.ot.ext));
    setCalc("ot:over8", won(t.ot.over8));
    setCalc("ot:night", won(t.ot.night));
    setCalc("ot:total", won(t.ot.total));

    /* 연동 안내 */
    updateLinkNotes();

    /* 리포트 */
    setText("#fin-kpi-assets", comma(t.assetTotal));
    setText("#fin-kpi-assets-sub", (t.assetTotal ? koreanAmount(t.assetTotal) + " · " : "") + state.assets.length + "건");
    setText("#fin-kpi-debt", comma(t.debtBalance));
    setText("#fin-kpi-debt-sub", t.debtBalance > 0 ? koreanAmount(t.debtBalance) + " · 가중평균 " + (Math.round(t.avgRate * 100) / 100).toFixed(2) + "%" : "등록된 대출 없음");
    setClass("#fin-kpi-net-wrap", "k-value " + (t.net >= 0 ? "pos" : "neg"));
    setText("#fin-kpi-net", comma(t.net));
    setText("#fin-kpi-net-sub", (t.assetTotal > 0 ? "부채비율 " + (t.debtBalance / t.assetTotal * 100).toFixed(1) + "% · " : "") + koreanAmount(t.net));
    setClass("#fin-kpi-net-card", "fin-kpi " + (t.net >= 0 ? "tone-pos" : "tone-neg"));
    setClass("#fin-kpi-flow-wrap", "k-value " + (t.flow > 0 ? "pos" : (t.flow < 0 ? "neg" : "")));
    setText("#fin-kpi-flow", comma(t.flow));
    setText("#fin-kpi-flow-sub", "수입 " + comma(t.incomeTotal) + " − 지출 " + comma(t.fixedTotal) + "원");
    const flowBadge = $("#fin-kpi-flow-badge");
    if (flowBadge) {
      flowBadge.textContent = t.flow > 0 ? "흑자" : (t.flow < 0 ? "적자" : "균형");
      flowBadge.className = "fin-sum-badge " + (t.flow > 0 ? "pos" : (t.flow < 0 ? "neg" : ""));
    }
    setClass("#fin-kpi-flow-card", "fin-kpi " + (t.flow > 0 ? "tone-pos" : (t.flow < 0 ? "tone-neg" : "tone-pos")));
    setText("#fin-kpi-unpaid", comma(t.unpaidTotal));
    setText("#fin-kpi-unpaid-sub", t.unpaidCount ? t.unpaidCount + "건 / 고정지출 " + state.fixed.length + "건 중" : "미납 없음");
    setText("#fin-kpi-interest", comma(t.debtInterest));
    setText("#fin-kpi-interest-sub", t.incomeTotal > 0 ? "수입의 " + (t.debtInterest / t.incomeTotal * 100).toFixed(1) + "%" : "수입을 넣으면 비율 표시");

    renderInsights(t);
  }

  function renderComposition(total) {
    const legend = $("#fin-comp-legend");
    const bar = $("#fin-comp-bar");
    if (!bar || !legend) return;
    const entries = state.assets
      .map((r, index) => ({ name: String(r.name || "이름 없음"), value: assetTotalOf(r), color: PALETTE[index % PALETTE.length] }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!entries.length || total <= 0) {
      bar.innerHTML = "";
      legend.innerHTML = '<span class="muted">금액을 입력하면 자산 구성이 여기에 표시됩니다.</span>';
      return;
    }
    bar.innerHTML = entries.map((e) => '<span style="width:' + (e.value / total * 100).toFixed(2) + '%;background:' + e.color + '" title="' + esc(e.name) + '"></span>').join("");
    legend.innerHTML = entries.map((e) => '<span><i style="background:' + e.color + '"></i>' + esc(e.name) + ' <b>' + (e.value / total * 100).toFixed(1) + '%</b></span>').join("");
  }

  /* ───────── 인사이트 카드 ───────── */
  function insightCard(tone, title, body, foot) {
    return '<div class="fin-insight ' + tone + '">' +
      '<div class="ins-title">' + esc(title) + '</div>' +
      '<div class="ins-body">' + body + '</div>' +
      (foot ? '<div class="ins-foot">' + foot + '</div>' : "") +
      '</div>';
  }

  function renderInsights(t) {
    const box = $("#fin-insights");
    if (!box) return;
    const cards = [];

    /* 1) 이달 현금흐름 */
    if (t.incomeTotal || t.fixedTotal) {
      const body = '수입 <b>' + won(t.incomeTotal) + '</b> − 고정지출 <b>' + won(t.fixedTotal) + '</b> = <b class="' + (t.flow >= 0 ? "pos" : "neg") + '">' + signedWon(t.flow) + '</b>';
      let foot = "";
      if (t.flow < 0 && t.ot.total > 0) foot = "이번 달 초과근로 예상액 " + won(t.ot.total) + "을 더하면 " + signedWon(t.flow + t.ot.total);
      cards.push(insightCard(t.flow >= 0 ? "tone-pos" : "tone-neg", "이달 현금흐름 · " + (t.flow >= 0 ? "흑자" : "적자"), body, foot));
    }

    /* 2) 고금리 우선 상환 */
    const highRate = state.debts
      .map((r) => ({ name: r.name || "대출", rate: num(r.rate), balance: num(r.balance), interest: interestOf(r) }))
      .filter((r) => r.rate > 0)
      .sort((a, b) => b.rate - a.rate);
    if (highRate.length) {
      const top = highRate.slice(0, 3).map((r, i) =>
        '<div class="ins-line"><span class="rank">' + (i + 1) + '</span><b>' + esc(r.name) + '</b> <span class="rate">' + r.rate.toFixed(2) + '%</span> <span class="muted">잔금 ' + koreanAmount(r.balance) + ' · 월 이자 ' + won(r.interest) + '</span></div>'
      ).join("");
      const risky = highRate.filter((r) => r.rate >= 5);
      cards.push(insightCard(risky.length ? "tone-warn" : "", "고금리 우선 상환 순위",
        top, risky.length ? "5% 이상 " + risky.length + "건 · 월 이자 " + won(risky.reduce((a, r) => a + r.interest, 0)) + " 먼저 줄이는 게 유리" : ""));
    }

    /* 3) 미납 잔금 */
    if (t.unpaidCount) {
      const days = t.dayOrder.filter((d) => t.byDay[d] && t.byDay[d].unpaid > 0)
        .map((d) => '<span class="ins-chip">' + esc(d || "미지정") + (/\d/.test(d) ? "일" : "") + ' ' + comma(t.byDay[d].unpaid) + '원</span>').join("");
      cards.push(insightCard("tone-warn", "아직 안 나간 돈 " + t.unpaidCount + "건",
        '<b>' + won(t.unpaidTotal) + '</b> 이 남았습니다.', days));
    } else if (state.fixed.length) {
      cards.push(insightCard("tone-pos", "이번 달 고정지출", "모두 납입 완료로 표시되어 있습니다. (" + won(t.fixedTotal) + ")"));
    }

    /* 4) 다음 달 카드 */
    if (t.nextCardTotal) {
      const parts = state.nextCards.filter((r) => num(r.amount) > 0)
        .map((r) => '<span class="ins-chip">' + esc(r.name || "카드") + ' ' + comma(r.amount) + '원</span>').join("");
      cards.push(insightCard("", "다음 달 카드 예정액", '<b>' + won(t.nextCardTotal) + '</b>', parts));
    }

    /* 5) 이번 달 카드 */
    if (t.cardTotal) {
      const parts = state.cards.filter((r) => num(r.amount) > 0)
        .map((r) => '<span class="ins-chip">' + esc(r.name || "카드") + ' ' + comma(r.amount) + '원</span>').join("");
      cards.push(insightCard("", "이번 달 카드 청구", '<b>' + won(t.cardTotal) + '</b>', parts));
    }

    /* 6) 재무 건전성 */
    if (t.assetTotal || t.debtBalance) {
      const ratio = t.assetTotal > 0 ? (t.debtBalance / t.assetTotal * 100) : 0;
      const body = '총자산 <b>' + koreanAmount(t.assetTotal) + '</b> · 총부채 <b>' + koreanAmount(t.debtBalance) + '</b><br>순자산 <b class="' + (t.net >= 0 ? "pos" : "neg") + '">' + koreanAmount(t.net) + '</b>';
      let foot = "부채비율 " + ratio.toFixed(1) + "%";
      if (t.incomeTotal > 0) foot += " · 월 이자가 수입의 " + (t.debtInterest / t.incomeTotal * 100).toFixed(1) + "%";
      cards.push(insightCard(t.net >= 0 ? "tone-pos" : "tone-neg", "재무 건전성", body, foot));
    }

    /* 7) 초과근로 */
    if (t.ot.total > 0) {
      cards.push(insightCard("", "이번 달 초과근로 예상", '<b>' + won(t.ot.total) + '</b>',
        "기본 " + won(t.ot.base) + " + 가산 " + won(t.ot.ext + t.ot.over8 + t.ot.night)));
    }

    /* 8) DC 적립 */
    if (state.dc.length) {
      const prev = state.dc.slice(-2);
      let foot = "연도 " + state.dc.length + "건";
      if (prev.length === 2 && num(prev[0].amount) > 0) {
        const diff = num(prev[1].amount) - num(prev[0].amount);
        foot += " · 최근 " + (diff >= 0 ? "+" : "−") + comma(Math.abs(diff)) + "원";
      }
      cards.push(insightCard("", "퇴직금 DC 적립 합계", '<b>' + won(t.dcTotal) + '</b>', foot));
    }

    box.innerHTML = cards.join("") || '<p class="fin-empty">표에 금액을 넣으면 여기에 분석 카드가 나타납니다.</p>';
  }

  /* ───────── 자동 채우기 ───────── */
  function autofill(table, row, key) {
    if (table === "debts") {
      if (key === "interest") row.manualInterest = String(row.interest || "").trim() !== "";
      if (key === "months") row.manualMonths = String(row.months || "").trim() !== "";
      if (key === "balance" || key === "rate") {
        if (!row.manualInterest) {
          const value = Math.round(num(row.balance) * num(row.rate) / 1200);
          row.interest = value ? String(value) : "";
          setInputValue("debts", row.id, "interest", row.interest);
        }
      }
      if (key === "maturity" && !row.manualMonths) {
        const months = monthsUntil(row.maturity);
        row.months = months ? String(months) : "";
        setInputValue("debts", row.id, "months", row.months);
      }
      return;
    }
    if (table === "assets") {
      if (key === "total") row.manualTotal = String(row.total || "").trim() !== "";
      if (key === "avg") row.manualAvg = String(row.avg || "").trim() !== "";
      if (key === "buy" || key === "qty" || key === "price") {
        if (!row.manualTotal) {
          const qty = qtyNum(row.qty);
          const price = num(row.price);
          const value = qty > 0 && price > 0 ? Math.round(qty * price) : 0;
          row.total = value ? String(value) : "";
          setInputValue("assets", row.id, "total", row.total);
        }
        if (!row.manualAvg) {
          const qty = qtyNum(row.qty);
          const value = qty > 0 ? Math.round(num(row.buy) / qty) : 0;
          row.avg = value ? String(value) : "";
          setInputValue("assets", row.id, "avg", row.avg);
        }
      }
    }
  }

  /* ───────── 매월 25일(한국 시간) 부채 원금 자동 차감 ─────────
     부장님 요청(2026-11-24): 매월 25일이 지난 뒤 처음 열 때, 각 부채 행의 ‘원금’만큼
     잔금을 줄이고(최소 0) 남은개월이 양수면 1 줄인다. 한 달에 한 번만 실행되고,
     마지막 차감 월(meta.lastDebtDeductedMonth)은 DB 에 함께 저장된다.
     원리금균등이라 이자가 매달 달라지므로 잔금 정합성은 부장님이 직접 맞춘다. */
  const DEDUCT_DAY = 25;
  function seoulNow() {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
  }
  function ymOf(date) { return date.getFullYear() + "-" + pad2(date.getMonth() + 1); }
  function prevYm(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
    if (!m) return "";
    let year = Number(m[1]);
    let month = Number(m[2]) - 1;
    if (month < 1) { month = 12; year -= 1; }
    return year + "-" + pad2(month);
  }
  /* 오늘(한국 시간) 기준으로 차감돼야 할 달 — 25일 전이면 지난달, 25일부터는 이번 달. */
  function dueDeductMonth(today) {
    const d = today || seoulNow();
    const thisYm = ymOf(d);
    return d.getDate() >= DEDUCT_DAY ? thisYm : prevYm(thisYm);
  }
  /* 저장된 마지막 차감 월. 값이 없으면(이 기능을 붙이기 전 저장분) ‘지난달’로 본다 —
     그래서 오늘(11-24)에는 차감되지 않고, 내일 11-25에 처음 열 때 11월분이 한 번 차감된다. */
  function lastDeducted(today) {
    const stored = state.meta && state.meta.lastDebtDeductedMonth ? String(state.meta.lastDebtDeductedMonth).trim() : "";
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(stored)) return stored;
    return prevYm(ymOf(today || seoulNow()));
  }
  function planDebtDeduction(today) {
    const due = dueDeductMonth(today);
    if (!due || due <= lastDeducted(today)) return { due: "", changes: [] };
    const changes = [];
    state.debts.forEach((r) => {
      const balance = num(r.balance);
      if (balance <= 0) return;
      /* 원금 칸이 비어 있으면 (원금+이자 − 이자) = 0 이므로 그 행은 건너뛴다. */
      const principal = String(r.principal || "").trim() !== "" ? num(r.principal) : 0;
      if (principal <= 0) return;
      changes.push({ row: r, before: { balance: r.balance, months: r.months }, balance: Math.max(0, Math.round(balance - principal)) });
    });
    return { due, changes };
  }
  function applyDebtDeduction(plan) {
    plan.changes.forEach((c) => {
      c.row.balance = String(c.balance);
      const months = num(c.row.months);
      if (String(c.row.months || "").trim() !== "" && months > 0) c.row.months = String(months - 1);
    });
    state.meta.lastDebtDeductedMonth = plan.due;
  }
  function maybeDeductDebts(today) {
    if (!loaded || destroyed) return false;
    const plan = planDebtDeduction(today);
    if (!plan.due) return false;
    if (!plan.changes.length) {
      /* 이번 달에 줄 부채가 없어도 ‘이번 달은 처리됨’으로 둔다 — 월 중간에 새 부채를 넣어도
         예상치 못하게 차감되지 않도록. */
      state.meta.lastDebtDeductedMonth = plan.due;
      updateDebtBadge();
      scheduleSave();
      return false;
    }
    const snapshot = plan.changes.map((c) => ({ row: c.row, balance: c.before.balance, months: c.before.months }));
    applyDebtDeduction(plan);
    renderDebts();
    sync();
    updateDebtBadge();
    scheduleSave();
    toast("📅 25일 원금 자동 차감 반영(" + plan.due + ") — 부채 " + plan.changes.length + "건 잔금 차감", () => {
      snapshot.forEach((s) => { s.row.balance = s.balance; s.row.months = s.months; });
      renderDebts();
      sync();
      updateDebtBadge();
      scheduleSave();
      toast("자동 차감을 되돌렸습니다. 이번 달은 다시 차감하지 않습니다.");
    });
    return true;
  }
  function updateDebtBadge() {
    const el = $("#fin-dt-deduct");
    if (!el) return;
    const last = state.meta && state.meta.lastDebtDeductedMonth ? String(state.meta.lastDebtDeductedMonth) : "";
    el.textContent = "📅 25일 원금 자동 차감" + (last ? " · 최근 " + last : " · 아직 없음");
    el.title = "매월 25일(한국 시간)이 지난 뒤 처음 열 때 원금 칸 금액만큼 잔금이 줄고 남은개월이 1 줄어듭니다. 한 달에 한 번만 실행됩니다. 원금이 비어 있는 행은 건너뜁니다." +
      (last ? "\n최근 자동 차감: " + last : "");
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
    if (!opts.force && updatedAt && payload.updatedAt && payload.updatedAt === updatedAt && loaded) {
      /* 서버 자료가 그대로여도, 탭을 켜 둔 채 25일이 지났을 수 있으니 차감 여부만 다시 본다. */
      maybeDeductDebts();
      return;
    }
    state = normalize(payload.data);
    loaded = true;
    dirty = false;
    updatedAt = payload.updatedAt || null;
    renderAll();
    setStamp(updatedAt);
    setChip("클라우드 동기화됨 " + hhmm(updatedAt));
    showWarn("");
    /* 종목 표는 있는데 연동 행이 없으면 여기서 한 번 만들어 서버에도 저장한다. */
    if (ensureLinkedAssets()) { renderAssets(); sync(); scheduleSave(); }
    /* 25일이 지났는데 이번 달 차감 전이면 여기서 한 번만 실행된다. */
    maybeDeductDebts();
  }

  /* ───────── 행 편집 ───────── */
  function ensureLoaded() {
    if (loaded) return true;
    showWarn("로그인한 뒤 ‘🔄 서버에서 다시 불러오기’를 눌러 저장된 표를 먼저 불러와 주세요.");
    return false;
  }

  function blankRow(table) {
    const row = { id: uid() };
    FIELDS[table].forEach((field) => { row[field] = ""; });
    return row;
  }

  function addRow(table) {
    if (!ensureLoaded()) return;
    const row = blankRow(table);
    state[table].push(row);
    /* 종목 표에 첫 행이 생기면 ⑤ 자산에 연동 행(‘보유주식’·‘퇴직금 DC’)을 하나 만들어 합계가 바로 잡히게 한다. */
    const linked = HOLDING_TABLES.indexOf(table) >= 0 ? ensureLinkedAssets() : false;
    RENDER[table]();
    if (linked) renderAssets();
    sync();
    scheduleSave();
    const el = root().querySelector('[data-t="' + table + '"][data-f="' + row.id + '"][data-k="name"]') ||
      root().querySelector('[data-t="' + table + '"][data-f="' + row.id + '"][data-k="year"]');
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
    if (HOLDING_TABLES.indexOf(table) >= 0) renderAssets();
    sync();
    scheduleSave();
    toast("행을 삭제했습니다.", () => {
      state[table].splice(Math.min(index, state[table].length), 0, removed);
      RENDER[table]();
      if (HOLDING_TABLES.indexOf(table) >= 0) renderAssets();
      sync();
      scheduleSave();
      toast("되살렸습니다.");
    });
  }

  function togglePaid(id) {
    if (!ensureLoaded()) return;
    const row = getRow("fixed", id);
    if (!row) return;
    const paid = String(row.paid || "").trim();
    row.paid = (paid !== "" && paid !== "미납") ? "" : "O";
    renderFixed();
    sync();
    scheduleSave();
  }

  /* 납입여부 일괄 체크/해제(2026-11-25) — ② 표의 모든 행을 한 번에 바꾸고 바로 저장한다.
     바꾸기 전 값을 기억해 두었다가 토스트의 ‘되돌리기’로 원래 상태를 복구할 수 있게 한다. */
  function setAllFixedPaid(markPaid) {
    if (!ensureLoaded()) return;
    if (!state.fixed.length) { toast("②월 고정지출에 항목이 없습니다. ‘＋ 행 추가’로 먼저 넣어 주세요."); return; }
    const before = state.fixed.map((r) => ({ id: r.id, paid: r.paid }));
    let changed = 0;
    state.fixed.forEach((r) => {
      if (isPaidRow(r) !== Boolean(markPaid)) changed += 1;
      r.paid = markPaid ? "O" : "";
    });
    renderFixed();
    sync();
    scheduleSave();
    const total = state.fixed.length;
    if (!changed) {
      toast(markPaid ? "이미 모두 납입(O)으로 표시되어 있습니다." : "이미 모두 미납 상태입니다.");
      return;
    }
    toast(
      markPaid ? "고정지출 " + total + "건을 모두 납입(O)으로 표시했습니다." : "고정지출 " + total + "건을 모두 미납으로 되돌렸습니다.",
      () => {
        before.forEach((item) => {
          const row = getRow("fixed", item.id);
          if (row) row.paid = item.paid;
        });
        renderFixed();
        sync();
        scheduleSave();
        toast("일괄 변경 전 상태로 되돌렸습니다.");
      }
    );
  }

  /* ───────── 연동: ③ 카드 → ② 고정지출 / ⑥ 초과근로 → ③ 수입 OT ───────── */
  /* ③ 이번 달 카드의 한 행 금액을 ② 의 이름이 같은 행(예: 카드 현대)에 그대로 옮긴다. */
  function pushCardToFixed(cardRow) {
    if (!ensureLoaded()) return false;
    const key = nameKey(cardRow && cardRow.name);
    if (!key) return false;
    const targets = state.fixed.filter((r) => nameKey(r.name) === key);
    if (!targets.length) return false;
    let changed = false;
    const next = cardRow.amount === null || cardRow.amount === undefined ? "" : String(cardRow.amount);
    targets.forEach((r) => {
      const now = r.amount === null || r.amount === undefined ? "" : String(r.amount);
      if (now !== next) { r.amount = next; changed = true; }
    });
    if (changed) renderFixed();
    return changed;
  }
  /* ⑥ 초과근로 합계(반올림 원)를 ③ 수입의 OT 행에 넣는다. OT 행이 없으면 새로 만든다. */
  function syncOvertimeToIncome() {
    if (!ensureLoaded()) return false;
    const total = overtimeTotalRounded();
    const target = state.income.filter(isOtIncome)[0] || null;
    if (!target) {
      if (total <= 0) return false;
      const row = normalizeRow("income", { name: "OT", amount: String(total) });
      state.income.push(row);
      RENDER.income();
      return true;
    }
    target.amount = total > 0 ? String(total) : "";
    setInputValue("income", target.id, "amount", target.amount);
    return true;
  }

  /* ───────── 고정지출 행 순서(↑ ↓) ───────── */
  /* 화면에 보이는 순서 그대로를 저장 순서로 굳힌 뒤 한 칸 옮긴다. 정렬 중이었다면 ‘직접 순서’로 바뀐다. */
  function moveFixed(id, dir) {
    if (!ensureLoaded()) return;
    const order = displayFixed();
    let index = -1;
    for (let i = 0; i < order.length; i += 1) if (order[i].id === id) { index = i; break; }
    if (index < 0) return;
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return;
    /* 이체일이 다른 그룹과는 자리를 바꾸지 않는다(그룹 소계가 갈라지지 않게). */
    if (dayKeyOf(order[target]) !== dayKeyOf(order[index])) return;
    const next = order.slice();
    const moved = next.splice(index, 1)[0];
    next.splice(target, 0, moved);
    const switched = state.meta.fixedSort !== "manual";
    state.fixed = next;
    state.meta.fixedSort = "manual";
    renderFixed();
    renderSortSelect();
    sync();
    scheduleSave();
    if (switched) toast("‘직접 순서’로 바꿔 이 행을 옮겼습니다. 이제 ↑ ↓ 로 순서를 바꿀 수 있어요.");
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
    const t = totals();
    line(["개인 재무"]);
    line(["기준일", state.meta.asOf || ""]);
    line(["내보낸 시각", prettyTime(new Date())]);
    line([]);
    line(["② 월 고정지출 · 이체"]);
    line(["종목", "금액(원)", "이체일", "납입여부"]);
    state.fixed.forEach((r) => line([r.name, num(r.amount), r.day, r.paid]));
    line(["총합", t.fixedTotal, "잔금", t.unpaidTotal]);
    line(["이달 적자/흑자", t.flow, "수입", t.incomeTotal]);
    line([]);
    line(["③ 이번 달 수입"]);
    line(["종목", "금액(원)"]);
    state.income.forEach((r) => line([r.name, num(r.amount)]));
    line(["합계", t.incomeTotal]);
    line([]);
    line(["③ 이번 달 카드"]);
    line(["카드사", "금액(원)"]);
    state.cards.forEach((r) => line([r.name, num(r.amount)]));
    line(["합계", t.cardTotal]);
    line([]);
    line(["③ 다음 달 카드 예정액"]);
    line(["카드사", "금액(원)"]);
    state.nextCards.forEach((r) => line([r.name, num(r.amount)]));
    line(["합계", t.nextCardTotal]);
    line([]);
    line(["④ 부채(대출)"]);
    line(["종목", "잔금(원)", "금리(%)", "원금+이자(원)", "원금(원)", "이자(원)", "만기", "남은개월", "비고"]);
    state.debts.forEach((r) => line([r.name, num(r.balance), num(r.rate), num(r.principal) + interestOf(r), num(r.principal), interestOf(r), r.maturity, r.months, r.memo]));
    line(["부채 합계", t.debtBalance, t.avgRate.toFixed(2), t.debtPrincipal + t.debtInterest, t.debtPrincipal, t.debtInterest, "", "", ""]);
    line([]);
    line(["⑤ 자산"]);
    line(["종목", "매입금액(원)", "수량", "시세(원)", "평균단가(원)", "비중(%)", "손실/수익(원)", "합계(원)", "연동"]);
    let csvPl = 0;
    state.assets.forEach((r) => {
      const value = assetTotalOf(r);
      const cost = assetCostOf(r);
      const valued = assetValued(r);
      const pl = valued ? value - cost : "";
      if (valued) csvPl += value - cost;
      line([r.name, cost, qtyNum(r.qty), num(r.price), assetAvgOf(r), valued && t.assetTotal > 0 ? (value / t.assetTotal * 100).toFixed(1) : "0.0", pl, value, r.link ? "→ " + ((HOLDINGS[r.link] || {}).label || r.link) : ""]);
    });
    line(["자산 총합", t.assetBuy, "", "", "", "100.0", csvPl, t.assetTotal, ""]);
    line([]);
    HOLDING_TABLES.forEach((table) => {
      const meta = HOLDINGS[table];
      line(["⑤ " + meta.label + " (수량 × 현재가)"]);
      line(["종목명", "종목코드", "수량", "매입단가(원)", "매입금액(원)", "현재가(원)", "전일대비", "등락률(%)", "평가금액(원)", "손익(원)"]);
      state[table].forEach((r) => line([r.name, codeOfRow(r), qtyNum(r.qty), num(r.avg), holdingCostOf(r), num(r.price), num(r.change), num(r.changeRate), holdingValueOf(r), holdingValueOf(r) - holdingCostOf(r)]));
      const sum = holdingsTotals(table);
      line(["합계", "", "", "", sum.cost, "", "", "", sum.value, sum.pl]);
      line([]);
    });
    line(["⑥ 초과근로"]);
    line(["초과근로 시간", num(state.overtime.hours)]);
    line(["8시간초과 시간", num(state.overtime.over8)]);
    line(["야간 가산 시간", num(state.overtime.night)]);
    line(["통상 시급", num(state.overtime.wage)]);
    line(["기본 초과임금", t.ot.base]);
    line(["연장근로 가산분", t.ot.ext]);
    line(["8시간 초과 가산분", t.ot.over8]);
    line(["야간가산분", t.ot.night]);
    line(["합계", t.ot.total]);
    line([]);
    line(["⑥ 퇴직금 DC 적립"]);
    line(["연도", "금액(원)"]);
    state.dc.forEach((r) => line([r.year, num(r.amount)]));
    line(["적립 합계", t.dcTotal]);
    line([]);
    line(["요약"]);
    line(["총자산", t.assetTotal]);
    line(["총부채", t.debtBalance]);
    line(["순자산", t.net]);
    line(["이달 수입", t.incomeTotal]);
    line(["이달 고정지출", t.fixedTotal]);
    line(["이달 적자/흑자", t.flow]);
    line(["미납 잔금", t.unpaidTotal]);
    line(["월 이자 부담", t.debtInterest]);
    line(["이번 달 카드", t.cardTotal]);
    line(["다음 달 카드 예정액", t.nextCardTotal]);
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
      const hasTable = data && (Array.isArray(data.fixed) || Array.isArray(data.debts) || Array.isArray(data.cashflow) || Array.isArray(data.loans) || Array.isArray(data.stocks) || Array.isArray(data.dcEtf));
      if (!hasTable) { window.alert("이 파일에는 개인 재무 표 데이터가 없습니다."); return; }
      if (!window.confirm("지금 표의 내용을 백업 파일 내용으로 바꿀까요?\n바꾸면 서버에도 그대로 저장됩니다.")) return;
      state = normalize(data);
      ensureLinkedAssets();
      renderAll();
      scheduleSave();
      toast("백업을 불러왔습니다.");
    };
    reader.readAsText(file, "utf-8");
  }

  /* ───────── 이벤트 ───────── */
  const RENDER = { fixed: renderFixed, income: () => renderSimple("income", "#fin-in-body", "#fin-in-count", "항목 (예: 월급 20일)"), cards: () => renderSimple("cards", "#fin-cd-body", "#fin-cd-count", "카드사 (예: 현대)"), nextCards: () => renderSimple("nextCards", "#fin-nc-body", "#fin-nc-count", "카드사 (예: 현대)"), debts: renderDebts, assets: renderAssets, stocks: () => renderHoldings("stocks"), dcEtf: () => renderHoldings("dcEtf"), dc: renderDC };

  let bound = false;
  function bind() {
    if (bound || !root()) return;
    bound = true;

    root().addEventListener("input", (event) => {
      const el = event.target;
      if (!el || !el.getAttribute || !el.getAttribute("data-t")) return;
      const table = el.getAttribute("data-t");
      const key = el.getAttribute("data-k");
      const id = el.getAttribute("data-f");
      if (table === "overtime") {
        state.overtime[key] = el.value;
        syncOvertimeToIncome();
        sync();
        scheduleSave();
        return;
      }
      const row = getRow(table, id);
      if (!row) return;
      row[key] = el.value;
      autofill(table, row, key);
      /* ③ 이번 달 카드 금액을 고치면 ② 의 이름이 같은 카드 행도 함께 바뀐다. */
      if (table === "cards" && (key === "amount" || key === "name")) pushCardToFixed(row);
      sync();
      scheduleSave();
    });

    root().addEventListener("change", (event) => {
      const el = event.target;
      if (!el || !el.getAttribute) return;
      if (el.id === "fin-asof") {
        state.meta.asOf = el.value || "";
        sync();
        scheduleSave();
        return;
      }
      if (el.id === "fin-fx-sort") {
        const value = el.value;
        state.meta.fixedSort = SORTS.indexOf(value) >= 0 ? value : DEFAULT_SORT;
        renderFixed();
        renderSortSelect();
        sync();
        scheduleSave();
        toast("정렬을 ‘" + SORT_LABEL[state.meta.fixedSort] + "’로 바꿨습니다. 행을 옮기면 ‘직접 순서’로 바뀝니다.");
        return;
      }
      if (el.getAttribute("data-t") === "fixed" && el.getAttribute("data-k") === "day") {
        /* 이체일을 고치면 그 날짜 그룹으로 바로 다시 묶는다. */
        renderFixed();
        sync();
        scheduleSave();
        return;
      }
      if (el.getAttribute("data-t")) { sync(); }
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
      const table = el.getAttribute("data-t");
      const key = el.getAttribute("data-k") || "";
      const value = String(el.value).trim();
      if (table === "overtime") { el.value = value === "" ? "" : comma(value); return; }
      const row = getRow(table, el.getAttribute("data-f"));
      if (!row) return;
      if (value === "") {
        if (key === "rate" || key === "qty" || key === "months") el.value = "";
        else el.value = "";
        if (table === "cards" && key === "amount") { if (pushCardToFixed(row)) renderFixed(); }
        return;
      }
      if (key === "rate") {
        const rate = num(value);
        el.value = (Math.round(rate * 100) / 100).toFixed(2);
        row.rate = el.value;
      } else if (key === "qty" || key === "months" || key === "year") {
        el.value = value;
        row[key] = value;
      } else {
        el.value = comma(value);
        row[key] = el.value;
      }
      autofill(table, row, key);
      if (table === "cards" && key === "amount") { if (pushCardToFixed(row)) renderFixed(); }
      sync();
      scheduleSave();
    });

    root().addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      const addBtn = target.closest("[data-fin-add]");
      if (addBtn) { event.preventDefault(); addRow(addBtn.getAttribute("data-fin-add")); return; }
      const quoteBtn = target.closest("[data-fin-quotes]");
      if (quoteBtn) { event.preventDefault(); refreshQuotes(); return; }
      const moveBtn = target.closest("[data-fin-move]");
      if (moveBtn && !moveBtn.disabled) { event.preventDefault(); moveFixed(moveBtn.getAttribute("data-f"), moveBtn.getAttribute("data-fin-move")); return; }
      const paidBtn = target.closest("[data-fin-paid]");
      if (paidBtn) { event.preventDefault(); togglePaid(paidBtn.getAttribute("data-fin-paid")); return; }
      const bulkBtn = target.closest("[data-fin-bulk]");
      if (bulkBtn) { event.preventDefault(); setAllFixedPaid(bulkBtn.getAttribute("data-fin-bulk") === "check"); return; }
      const delBtn = target.closest("[data-fin-del]");
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
    /* 위쪽 ‘저장’ 버튼 — 0.5초 자동 저장을 기다리지 않고 지금 바로 서버에 저장한다. */
    saveNow() {
      if (!loaded) { ensureLoaded(); return false; }
      clearTimeout(saveTimer);
      clearTimeout(retryTimer);
      push();
      return true;
    },
    /* 로그아웃·세션 만료 — 화면과 메모리의 개인 자료를 지운다. */
    clear,
    isLoaded() { return loaded; },
    _debug: {
      get state() { return state; },
      totals,
      normalize,
      holdingsTotals,
      ensureLinkedAssets,
      primaryLinkedRow,
      holdingCodes,
      refreshQuotes,
      due: dueDeductMonth,
      lastDeducted,
      planDebtDeduction,
      deduct: maybeDeductDebts,
      displayFixed
    }
  };
})();
