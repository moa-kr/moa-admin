import json, sys, time
from playwright.sync_api import sync_playwright

URL = "https://moa-kr.github.io/moa-admin/"
OUT = "/workspace/downloads"
errors = []
console = []


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="ko-KR")
        page = ctx.new_page()
        page.on("console", lambda m: console.append({"type": m.type, "text": m.text}))
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(URL, wait_until="load")
        page.wait_for_timeout(600)
        page.click("#gate-demo")
        page.wait_for_selector("#app:not([hidden])")
        page.wait_for_timeout(500)

        report = {}

        # ① 공지 배너 켜기 + 긴급 스타일 + 팝업 켜기
        page.check("#banner-enabled")
        page.fill('input[data-bind="banner.text"]', "30th CELEBRATION 정가 구매처를 새로 정리했어요. 지도에서 바로 확인하세요.")
        page.click('#banner-style button[data-style="urgent"]')
        page.check("#popup-enabled")
        page.fill('input[data-bind="popup.title"]', "포켓몬카드모아 새 소식")
        page.fill('textarea[data-bind="popup.body"]', "30th CELEBRATION 정가 구매처를 정리했어요.\\n지도에서 내 주변 매장도 확인해 보세요.")
        page.select_option
        page.fill('input[data-bind="popup.dismissDays"]', "3")
        page.wait_for_timeout(400)
        report["banner_label_on"] = page.inner_text("#banner-state")
        report["popup_label_on"] = page.inner_text("#popup-state")
        report["preview_has_banner"] = page.locator(".pv-banner").count()
        report["preview_has_popup"] = page.locator(".pv-popup").count()
        report["preview_banner_text"] = page.inner_text(".pv-banner span") if page.locator(".pv-banner span").count() else ""

        # ② 탭·섹션 순서 화면으로 이동 (드래그앤드롭 UI)
        page.click('.tab[data-tab="order"]')
        page.wait_for_timeout(300)
        tabs_before = page.eval_on_selector_all("#list-tabs .rrow", "els => els.map(e => e.dataset.id)")
        # ▲▼ 버튼으로 순서 바꾸기
        page.click('#list-tabs .rrow[data-id="home"] button[data-act="up"]')
        page.wait_for_timeout(200)
        tabs_after_btn = page.eval_on_selector_all("#list-tabs .rrow", "els => els.map(e => e.dataset.id)")
        # HTML5 드래그 앤 드롭
        try:
            page.drag_and_drop('#list-tabs .rrow[data-id="trends"]', '#list-tabs .rrow[data-id="map"]')
            page.wait_for_timeout(300)
        except Exception as exc:  # noqa: BLE001
            report["drag_error"] = str(exc)[:200]
        tabs_after_drag = page.eval_on_selector_all("#list-tabs .rrow", "els => els.map(e => e.dataset.id)")
        report["tabs_before"] = tabs_before
        report["tabs_after_button"] = tabs_after_btn
        report["tabs_after_drag"] = tabs_after_drag
        # 노출 끄기
        page.uncheck('#list-sections .rrow[data-id="trend"] input[data-act="vis"]')
        page.wait_for_timeout(250)
        report["section_hidden_class"] = page.get_attribute('#list-sections .rrow[data-id="trend"]', "class")

        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/moa-admin-desktop.png")
        report["desktop_size"] = page.viewport_size

        # ③ 문구 화면
        page.click('.tab[data-tab="copy"]')
        page.wait_for_timeout(200)
        page.fill('input[data-bind="copy.siteTitle"]', "포켓몬카드모아")
        page.fill('input[data-bind="copy.subtitle"]', "정가·입고·재고를 한 번에 확인하는 카드 정보 사이트")
        page.wait_for_timeout(300)
        report["preview_subtitle"] = page.inner_text(".pv-sub")

        # 사이트 전환 → 복지모아
        page.click('.site-btn[data-site="bokjimoa"]')
        page.wait_for_timeout(400)
        report["bokjimoa_inquiry_tab_visible"] = page.is_visible('.tab[data-tab="inquiry"]')
        report["bokjimoa_preview_title"] = page.inner_text(".pv-title")
        page.click('.tab[data-tab="notice"]')
        page.wait_for_timeout(200)
        page.check("#banner-enabled")
        page.wait_for_timeout(300)
        report["bokjimoa_banner"] = page.locator(".pv-banner").count()

        # ⑤ 배포 화면 (데모라 저장 불가 안내)
        page.click('.tab[data-tab="deploy"]')
        page.wait_for_timeout(200)
        report["deploy_target_text"] = page.inner_text("#deploy-target")
        report["session_checks"] = page.inner_text("#session-checks")

        # 모바일 390×844
        page.set_viewport_size({"width": 390, "height": 844})
        page.click('.site-btn[data-site="pokemoa"]')
        page.wait_for_timeout(300)
        page.click('.tab[data-tab="notice"]')
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/moa-admin-mobile.png", full_page=False)
        report["mobile_size"] = page.viewport_size

        # 모바일에서 미리보기 열기
        page.click("#btn-preview-toggle")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/moa-admin-mobile-preview.png")
        page.click("#btn-preview-toggle")
        page.wait_for_timeout(200)

        # 모바일 순서 화면
        page.click('.tab[data-tab="order"]')
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/moa-admin-mobile-order.png")

        report["js_errors"] = page.evaluate("window.__moaAdminErrors")
        report["page_errors"] = errors
        report["console_errors"] = [c for c in console if c["type"] == "error"]
        browser.close()
        print(json.dumps(report, ensure_ascii=False, indent=2))


run()
