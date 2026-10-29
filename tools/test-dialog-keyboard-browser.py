#!/usr/bin/env python3
"""Real keyboard regression for chapter dialogs and nested settings. No gameplay hooks."""
import functools
import argparse
import http.server
import json
import os
import shutil
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check_cycle(page, selector):
    panel = page.locator(selector)
    panel.wait_for(state="visible")
    controls = panel.locator('button:visible:enabled, a[href]:visible, input:visible:enabled, select:visible:enabled')
    first, last = controls.first, controls.last
    last.focus()
    page.keyboard.press("Tab")
    assert first.evaluate("node => node === document.activeElement"), selector + " forward wrap"
    page.keyboard.press("Shift+Tab")
    assert last.evaluate("node => node === document.activeElement"), selector + " reverse wrap"
    panel.focus()
    page.keyboard.press("Tab")
    assert first.evaluate("node => node === document.activeElement"), selector + " initial navigation"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.browser or shutil.which("google-chrome") or shutil.which("chromium"), args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            context = browser.new_context(reduced_motion="reduce")
            context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
            context.route("https://esm.sh/**", lambda route: route.abort())
            context.add_init_script("localStorage.setItem('thirstTrailProgressV2'," + json.dumps(json.dumps({
                "version": 2, "completed": ["valley", "canyon"], "unlocked": ["valley", "canyon", "coast"], "saves": {}
            })) + ");")
            page = context.new_page()
            errors, missing = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: missing.append(response.url) if response.status == 404 else None)
            page.goto(f"http://127.0.0.1:{server.server_port}")
            page.wait_for_function("!!window.ThirstTrail && !!window.TrailCoast")
            assert page.locator('.hero-scene[aria-hidden="true"][inert]').count() == 1
            page.locator("#instructionsButton").click()
            check_cycle(page, "#dialog")
            page.locator("#modalClose").click()
            for chapter in ["canyon", "coast"]:
                page.locator("#" + chapter + "Chapter").click()
                page.locator("#" + chapter + "Pause").click()
                check_cycle(page, "#" + chapter + "Modal")
                # Match the existing keyboard settings shortcut while a puzzle
                # backdrop covers the toolbar; do not click through the backdrop.
                page.locator("#graphicsButton").focus()
                page.keyboard.press("Enter")
                check_cycle(page, "#graphicsPanel")
                page.keyboard.press("Escape")
                assert page.locator("#graphicsPanel").is_hidden()
                check_cycle(page, "#" + chapter + "Modal")
                # Resume via the first pause choice, then use the chapter toolbar.
                page.locator("#" + chapter + "ModalOptions button").first.click()
                page.locator("#canyonToChapters" if chapter == "canyon" else "#coastHome").click()
            for width, height in [(320, 640), (390, 844), (768, 1024), (1024, 600), (1366, 768)]:
                page.set_viewport_size({"width": width, "height": height})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"Horizontal overflow at {width}"
                page.locator("#graphicsButton").click()
                check_cycle(page, "#graphicsPanel")
                page.keyboard.press("Escape")
            assert page.locator('.footer a[href="https://www.charitywater.org/"]').count() == 1
            assert page.locator('.footer a[href="https://www.charitywater.org/donate"]').count() == 1
            assert not errors, errors
            assert not missing, missing
            browser.close()
        print("PASS chapter dialog/settings keyboard boundaries, responsive title, footer links, no local 404s or page errors")
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
