/* 모아 어드민 PWA 등록 + ‘앱 설치’ 버튼(2026-11-25 v=48)
 *
 * 1) 서비스 워커(sw.js)를 등록해, 홈 화면에 설치한 어드민이 오프라인에서도 안내 화면을 띄운다.
 * 2) 브라우저가 beforeinstallprompt 를 보내면 상단 바의 '📲 앱 설치' 버튼을 보여 주고, 누르면 설치 다이얼로그를 띄운다.
 * 3) 이미 앱(standalone)으로 실행 중이거나 설치가 끝나면 버튼을 숨긴다. 아이폰 사파리는 안내 문구로 대신한다.
 * 4) 어드민은 GitHub Pages 하위 경로(/moa-admin/)에서 열리므로 서비스 워커도 그 경로 기준으로 등록한다.
 * 어떤 실패도 화면 동작을 막지 않는다. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (window.top !== window.self) return; // 미리보기 iframe 안에서는 등록하지 않는다

  var button = document.getElementById("app-install");
  var deferredPrompt = null;
  var installed = false;

  function isStandalone() {
    try {
      if (window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches)) return true;
    } catch (err) { /* matchMedia 없는 환경 */ }
    return window.navigator.standalone === true;
  }
  function isIos() {
    var ua = window.navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }
  function showButton() {
    if (!button || installed || isStandalone()) return;
    button.hidden = false;
  }
  function hideButton() { if (button) button.hidden = true; }
  function note(text) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.className = "toast show";
    clearTimeout(note._timer);
    note._timer = setTimeout(function () { el.hidden = true; el.className = "toast"; }, 4600);
  }

  if (button) {
    button.addEventListener("click", function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        try { promptEvent.prompt(); } catch (err) { /* 이미 처리된 이벤트 등 */ }
        if (promptEvent.userChoice && typeof promptEvent.userChoice.then === "function") {
          promptEvent.userChoice.then(function (choice) {
            if (choice && choice.outcome === "accepted") { installed = true; hideButton(); }
            else if (!isStandalone()) { showButton(); }
          }).catch(function () { /* 무시 */ });
        }
        return;
      }
      note(isIos()
        ? "아이폰은 사파리 아래 ‘공유’ → ‘홈 화면에 추가’로 설치합니다."
        : "브라우저 메뉴(⋮) → ‘앱 설치’ 또는 ‘홈 화면에 추가’로 설치할 수 있습니다.");
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showButton();
  });
  window.addEventListener("appinstalled", function () {
    installed = true;
    deferredPrompt = null;
    hideButton();
  });

  if (isStandalone()) hideButton();
  else if (isIos()) showButton();

  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () { /* 등록 실패는 무시 */ });
  });
})();
