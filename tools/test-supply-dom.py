#!/usr/bin/env python3
"""Exercise supply drops through the real DOM and movement loop.

Requires optional Python Playwright and Chromium, like test-browser.py.
Run: python tools/test-supply-dom.py [--browser /path/to/chromium]
Checkpoints seed scenarios before page load; active gameplay is driven by controls.
"""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "work" / "browser-qa"
CACHES = ("village", "camptrail", "easttrail", "hillside")


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(value, message):
    if not value:
        raise AssertionError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    errors = []
    try:
        with sync_playwright() as p:
            executable = args.browser or ("/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None)
            browser = p.chromium.launch(
                executable_path=executable, headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])

            def open_game(*, mobile=False, saved=None, mode="normal"):
                context = browser.new_context(
                    viewport={"width": 390 if mobile else 1440, "height": 844 if mobile else 1100},
                    is_mobile=mobile, has_touch=mobile, reduced_motion="reduce")
                context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
                context.route("https://esm.sh/**", lambda route: route.abort())
                progress = {"version": 2, "unlocked": ["valley"], "completed": [],
                            "saves": {"valley": saved} if saved else {}, "lastLevel": "valley", "revision": 1}
                seed = {"thirstTrailProgressV2": json.dumps(progress),
                        "thirstTrailProgressV2Backup": json.dumps(progress),
                        "thirstTrailMode": {"easy":"explorer", "normal":"normal", "hard":"challenge"}[mode], "thirstTrailTutorial": "true", "thirstTrailSound": "false"}
                context.add_init_script("""(() => {
                    if (localStorage.getItem('__supplyDomSeeded')) return;
                    const seed = %s;
                    for (const [key,value] of Object.entries(seed)) localStorage.setItem(key,value);
                    localStorage.setItem('__supplyDomSeeded','true');
                })();""" % json.dumps(seed))
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(url)
                page.wait_for_function("!!window.ThirstTrail && !!window.TrailMode")
                check(snapshot(page)["difficulty"] == mode, "Fixture must select the shared difficulty")
                return context, page

            def begin(page, resume=False):
                page.locator("#valleyChapter" if resume else "#startButton").click()
                page.locator("#renderLoading").wait_for(state="hidden", timeout=10000)

            def snapshot(page):
                return page.evaluate("ThirstTrail.snapshot()")

            def assert_drop_count(page, remaining, collected):
                check(page.locator(".supply-dom-board [data-supply-id]").count() == remaining,
                      f"Expected {remaining} remaining drops")
                check(page.locator(".supply-dom-collected [data-collected-supply]").count() == collected,
                      f"Expected {collected} collected badges")

            def wait_collected(page, key):
                page.locator(f'.supply-dom-collected [data-collected-supply="{key}"]').wait_for()
                check(page.locator(f'.supply-dom-board [data-supply-id="{key}"]').count() == 0,
                      "Collected drop must leave the DOM")

            for mobile in (False, True):
                label = "mobile" if mobile else "desktop"
                context, page = open_game(mobile=mobile)
                if mobile:
                    page.locator(".play-style-options").screenshot(path=str(ARTIFACTS / "supply-dom-mobile-difficulty.png"))
                begin(page)
                assert_drop_count(page, 4, 0)
                drop = page.locator('[data-supply-id="village"]')
                stale_drop = drop.element_handle()
                before = snapshot(page)
                if mobile:
                    drop.focus()
                    page.keyboard.press("Enter")
                else:
                    drop.click()
                # Navigation may focus the canvas. Return focus to the activated
                # control so collection also exercises its focus handoff.
                if drop.count():
                    drop.focus()
                wait_collected(page, "village")
                after = snapshot(page)
                check(after["score"] == before["score"] + 25, "Real click/Enter must award one supply reward")
                check(abs(after["x"] - before["x"]) < 1 and abs(after["y"] - before["y"]) < 1, "Nearby manual collection must not teleport the explorer")
                assert_drop_count(page, 3, 1)
                check("1 / 4" in page.locator("#supplyCount").inner_text(), "HUD supply count must update")
                check(bool(page.locator(".supply-dom-status").inner_text().strip()), "Collection must announce its result")
                check(page.evaluate("document.activeElement.matches('.supply-dom-board [data-supply-id]')"),
                      "Removing a focused drop must move focus to a remaining drop")
                # A detached DOM reference can still receive a synthetic click.
                # The real listener must reject it without paying twice.
                stale_drop.evaluate("element => { element.click(); element.click(); }")
                check(snapshot(page)["score"] == after["score"], "Detached repeated clicks cannot award twice")
                assert_drop_count(page, 3, 1)
                # Nearby collection starts no route; verify modal guards in place.
                remaining = page.locator('[data-supply-id="camptrail"]').element_handle()
                badge = page.locator('[data-collected-supply="village"]').element_handle()
                page.locator("#pauseButton").click()
                paused = snapshot(page)
                remaining.evaluate("element => element.click()")
                page.wait_for_timeout(250)
                check(snapshot(page) == paused, "Drop clicks behind a pause modal must not change game state")
                check(remaining.evaluate("element => element.isConnected"), "Pause must preserve remaining drop nodes")
                check(badge.evaluate("element => element.isConnected"), "Pause must preserve collected badge nodes")
                page.locator("#modalChoices button").filter(has_text="Resume adventure").click()
                page.wait_for_timeout(500)  # Multiple real periodic HUD updates.
                check(remaining.evaluate("element => element.isConnected"), "HUD updates must preserve drop nodes")
                check(badge.evaluate("element => element.isConnected"), "HUD updates must preserve badge nodes")
                check(abs(snapshot(page)["x"] - paused["x"]) < 1 and abs(snapshot(page)["y"] - paused["y"]) < 1,
                      "A blocked modal click must not start a delayed route")
                # Collect a second cache through its real route. Both existing
                # collected badges and unrelated available controls must survive.
                other_drop = page.locator('[data-supply-id="hillside"]').element_handle()
                page.locator('[data-supply-id="camptrail"]').click()
                wait_collected(page, "camptrail")
                assert_drop_count(page, 2, 2)
                check(badge.evaluate("element => element.isConnected"), "A later pickup must preserve an existing badge")
                check(other_drop.evaluate("element => element.isConnected"), "A later pickup must preserve unrelated drop nodes")
                page.locator("#supplyInteraction").screenshot(path=str(ARTIFACTS / f"supply-dom-{label}-remaining.png"))
                if mobile:
                    check(page.evaluate("document.documentElement.scrollWidth") <= 390,
                          "Supply panel must not cause mobile horizontal overflow")
                page.reload()
                page.wait_for_function("!!window.ThirstTrail")
                begin(page, resume=True)
                wait_collected(page, "village")
                wait_collected(page, "camptrail")
                assert_drop_count(page, 2, 2)
                page.locator("#resetButton").click()
                page.locator("#modalChoices button").filter(has_text="Restart adventure").click()
                assert_drop_count(page, 4, 0)
                check("0 / 4" in page.locator("#supplyCount").inner_text(), "Restart must reset the HUD supply count")
                context.close()
                print(f"PASS {label}: actual DOM click/Enter routes, removes drops, adds badges, guards stale/modal clicks, preserves focus/nodes, reloads and restarts", flush=True)

            # Fixtures are loaded before the game starts, never written into a
            # live state. Sealed caches restore 12 energy on every difficulty.
            for mode, recovery in (("easy", 12), ("normal", 12), ("hard", 12)):
                saved = {"difficulty": mode, "x": 405, "y": 690, "energy": 40,
                         "score": 80, "elapsed": 12, "done": ["elder"], "inventory": ["fieldNotes"], "supplies": []}
                context, page = open_game(saved=saved, mode=mode)
                begin(page, resume=True)
                wait_collected(page, "village")
                check(abs(snapshot(page)["energy"] - (40 + recovery)) < .01, f"{mode} drop recovery must match its mode")
                check(snapshot(page)["score"] == 105, "Proximity collection awards exactly 25 points")
                context.close()

            context, page = open_game(saved={"x": 405, "y": 690, "energy": 90, "score": 0, "supplies": []})
            begin(page, resume=True)
            wait_collected(page, "village")
            check(snapshot(page)["difficulty"] == "normal", "Legacy checkpoint still defaults to Normal")
            check(snapshot(page)["energy"] == 100, "A near-full pickup must cap at exactly 100 energy")
            check("+10 energy" in page.locator("#toast").inner_text(), "Announcement must report actual capped recovery")
            context.close()

            # The last focused button falls back to the live status. Use a
            # genuine walk from outside pickup range to keep activation testable.
            saved = {"difficulty": "normal", "x": 180, "y": 690, "energy": 90, "score": 75,
                     "supplies": ["camptrail", "easttrail", "hillside"]}
            context, page = open_game(saved=saved)
            begin(page, resume=True)
            assert_drop_count(page, 1, 3)
            final_drop = page.locator('[data-supply-id="village"]')
            final_drop.focus()
            page.keyboard.press("Enter")
            if final_drop.count():
                final_drop.focus()
            wait_collected(page, "village")
            assert_drop_count(page, 0, 4)
            check(page.evaluate("document.activeElement.matches('.supply-dom-status')"), "Last drop must hand focus to its status")
            check(snapshot(page)["energy"] <= 100, "Recovery must respect the 100 energy cap")
            page.locator(".supply-dom-collected").screenshot(path=str(ARTIFACTS / "supply-dom-all-collected.png"))
            context.close()
            check(not errors, "Uncaught browser errors: " + repr(errors))
            browser.close()
            print("PASS all mode recovery values, proximity pickup, capped energy, final-drop focus; no page errors", flush=True)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
