#!/usr/bin/env python3
"""Real Chromium gameplay regression. Requires Python Playwright and Chromium.
Run: python tools/test-browser.py [--3d]
The default deliberately blocks the Three.js CDN to verify the functional 2D fallback.
Uses public read-only snapshots for assertions; travel and puzzles use player controls.
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
ARTIFACTS.mkdir(parents=True, exist_ok=True)

class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def check(value, message):
    if not value:
        raise AssertionError(message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--3d", dest="three", action="store_true")
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"), help="Chromium executable (default: system Chromium or Playwright bundled browser)")
    parser.add_argument("--offline-three", type=Path, default=ROOT / "work", help="Directory containing three.module.mjs, GLTFLoader.js and BufferGeometryUtils.js")
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    mode = "3d" if args.three else "fallback"
    failures = []
    with sync_playwright() as p:
        executable = args.browser or ("/usr/bin/chromium" if Path("/usr/bin/chromium").exists() else None)
        browser = p.chromium.launch(executable_path=executable, headless=True,
                                  args=(["--no-sandbox", "--disable-dev-shm-usage"] + (["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] if args.three else ["--disable-gpu"])))
        context = browser.new_context(viewport={"width": 1440, "height": 1100}, reduced_motion="reduce")
        if not args.three:
            context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
            context.route("https://esm.sh/**", lambda route: route.abort())
        elif (args.offline_three / "three.module.mjs").exists():
            local_modules = {"three.module.js": "three.module.mjs", "GLTFLoader.js": "GLTFLoader.js", "BufferGeometryUtils.js": "BufferGeometryUtils.js"}
            def serve_module(route):
                filename = local_modules.get(route.request.url.rsplit("/", 1)[-1])
                if filename and (args.offline_three / filename).exists():
                    route.fulfill(path=str(args.offline_three / filename), content_type="application/javascript", headers={"Access-Control-Allow-Origin": "*"})
                else:
                    route.abort()
            context.route("https://cdn.jsdelivr.net/**", serve_module)
        context.add_init_script("if (!localStorage.getItem('thirstTrailGraphics')) localStorage.setItem('thirstTrailGraphics', JSON.stringify({preset:'low',resolution:.75,shadows:false,effects:false,sensitivity:.9}));")
        page = context.new_page()
        page.on("pageerror", lambda err: failures.append(str(err)))
        page.goto(url)
        page.wait_for_function("!!window.ThirstTrail && !!window.TrailCanyon")
        page.locator("#startButton").click()
        if page.locator("#modalBackdrop").is_visible():
            page.locator("#modalChoices button").first.click()

        if args.three:
            page.locator("#world3dCanvas").wait_for(state="visible", timeout=60000)
        else:
            page.locator("#renderLoading").wait_for(state="hidden", timeout=10000)

        def vsnap():
            return page.evaluate("window.ThirstTrail.snapshot()")
        def csnap():
            return page.evaluate("window.TrailCanyon.snapshot()")
        def vgo(key):
            print("Valley travel", key, vsnap(), flush=True)
            page.locator(f'[data-destination="{key}"]').click()
            try:
                page.wait_for_function("key => window.ThirstTrail.snapshot().nearby === key", arg=key, timeout=90000)
            except Exception:
                print("Travel failed", vsnap(), page.locator("#toast").inner_text(), flush=True)
                page.screenshot(path=str(ARTIFACTS / f"{mode}-failed-valley-{key}.png"))
                raise
            page.locator("#interactButton").click()
            page.locator("#modalBackdrop").wait_for(state="visible")
        def vchoice(index=0):
            page.locator("#modalChoices button").nth(index).click()
        def cgo(key):
            print("Canyon travel", key, csnap(), flush=True)
            labels = {"surveyor": "Meet the canyon surveyor", "kit": "Recover the seal kit", "valves": "Balance the pressure valves", "span": "Rebuild the aqueduct", "cistern": "Test the village cistern"}
            page.locator("#canyonDestinations button").filter(has_text=labels[key]).click()
            points = {"surveyor": [165,270], "kit": [305,455], "valves": [390,165], "span": [700,365], "cistern": [820,175]}
            page.wait_for_function("p=>{const s=window.TrailCanyon.snapshot();return Math.hypot(s.x-p[0],s.y-p[1])<77}", arg=points[key], timeout=45000)
            page.locator("#canyonInteract").click()
            page.locator("#canyonModalBackdrop").wait_for(state="visible")
        def cchoice(index=0):
            page.locator("#canyonModalOptions button").nth(index).click()

        # Exercise real keyboard movement before destination auto-walk.
        before = vsnap()
        page.keyboard.down("d")
        page.wait_for_function("x => window.ThirstTrail.snapshot().x > x + 10", arg=before["x"], timeout=5000)
        page.keyboard.up("d")
        check(vsnap()["x"] > before["x"] + 10, "Valley keyboard movement failed: " + str(vsnap()))
        print("PASS keyboard", flush=True)
        page.keyboard.press("c")
        if args.three:
            view = page.locator("#world3dCanvas")
            view.scroll_into_view_if_needed()
            rect = view.bounding_box()
            before_drag = vsnap()
            page.mouse.move(rect["x"]+rect["width"]*.5, rect["y"]+rect["height"]*.5)
            page.mouse.down()
            page.mouse.move(rect["x"]+rect["width"]*.6, rect["y"]+rect["height"]*.57, steps=10)
            page.mouse.up()
            page.wait_for_timeout(200)
            check(abs(vsnap()["x"]-before_drag["x"])<2 and abs(vsnap()["y"]-before_drag["y"])<2, "Valley camera drag moved explorer")
            page.locator("#valleyCameraReset").click()
            # Click visible foreground ground; verify the actual canvas selection walks.
            rect = view.bounding_box()
            page.mouse.click(rect["x"]+rect["width"]*.56, rect["y"]+rect["height"]*.65)
            page.wait_for_function("p=>{const s=window.ThirstTrail.snapshot();return Math.hypot(s.x-p.x,s.y-p.y)>8}", arg=before_drag, timeout=10000)
        else:
            # Full map view gives a deterministic fallback click-to-walk target.
            page.locator("#scenicViewButton").click()
            view = page.locator("#gameCanvas")
            rect = view.bounding_box()
            before_click = vsnap()
            page.mouse.click(rect["x"]+360/1800*rect["width"], rect["y"]+620/1100*rect["height"])
            page.wait_for_function("x=>window.ThirstTrail.snapshot().x>x+8", arg=before_click["x"], timeout=10000)
            page.locator("#valleyCameraReset").click()
        print("PASS canvas click-walk and camera controls", flush=True)
        vgo("elder"); vchoice()
        page.screenshot(path=str(ARTIFACTS / f"{mode}-valley-gameplay.png"))
        vgo("toolkit"); vchoice()
        check(set(vsnap()["items"]) >= {"fieldNotes", "toolkit"}, "Valley inventory missing")
        # Pagehide must persist; the Continue button must restore objectives and inventory.
        page.reload()
        page.wait_for_function("!!window.ThirstTrail")
        page.locator("#valleyChapter").click()
        check(set(vsnap()["quests"]) >= {"elder", "toolkit"}, "Valley reload lost missions")
        check("toolkit" in vsnap()["items"], "Valley reload lost toolkit")
        vgo("gasket"); vchoice()
        vgo("pump")
        check(page.locator("#pipeGrid button").count() == 9, "Expected all nine pipe controls")
        energy = vsnap()["energy"]
        vchoice()
        check(vsnap()["energy"] <= energy-2, "Incorrect pipe test did not deduct energy")
        page.locator("#pipeHint").click()
        check("Hint:" in page.locator("#pipeStatus").inner_text(), "Pipe hint unavailable")
        for i, turns in enumerate([1,2,3,1,2,1,3,1,2]):
            for _ in range((4-turns)%4):
                page.locator("#pipeGrid button").nth(i).click()
        check("all 9 pipes supplied" in page.locator("#pipeStatus").inner_text(), "Correct pipe network rejected")
        vchoice()
        # Wrong and then correct safety answer, with no progression skip.
        energy = vsnap()["energy"]
        vchoice(1)
        check(vsnap()["energy"] <= energy-6, "Unsafe pump answer did not deduct energy")
        for answer in [0,1,2]:
            vchoice(answer)
        check("pump" in vsnap()["quests"], "Pump mission did not complete")
        check(page.evaluate("window.TrailProgress.unlocked('canyon')"), "Chapter 1 did not unlock Canyon")
        page.screenshot(path=str(ARTIFACTS / f"{mode}-valley-victory.png"))
        vchoice(0)
        page.locator("#canyonScreen").wait_for(state="visible")
        if args.three:
            page.locator(".canyon-webgl").wait_for(state="visible", timeout=60000)
            check(csnap()["renderer"] == "3d", "Canyon 3D renderer did not start")
        cgo("surveyor"); cchoice()
        page.locator("#canyonCameraReset").click()
        page.screenshot(path=str(ARTIFACTS / f"{mode}-canyon-surveyor.png"))
        if args.three:
            view = page.locator(".canyon-webgl")
            view.scroll_into_view_if_needed()
            rect = view.bounding_box()
            before_drag = csnap()
            page.mouse.move(rect["x"]+rect["width"]*.5, rect["y"]+rect["height"]*.5)
            page.mouse.down()
            page.mouse.move(rect["x"]+rect["width"]*.58, rect["y"]+rect["height"]*.54, steps=10)
            # Cancellation must release capture and suppress an accidental walk click.
            view.dispatch_event("pointercancel", {"pointerId": 1, "pointerType": "mouse"})
            page.mouse.up()
            page.wait_for_timeout(200)
            check(abs(csnap()["x"]-before_drag["x"])<2 and abs(csnap()["y"]-before_drag["y"])<2, "Canyon camera drag/cancel moved explorer")
            page.locator("#canyonCameraReset").click()
        cgo("kit"); cchoice()
        cgo("valves")
        energy = csnap()["energy"]
        cchoice()
        check(csnap()["energy"] <= energy-4, "Invalid valve pressure did not deduct energy")
        for i,n in enumerate([2,2,1]):
            for _ in range(n):
                page.locator(".canyon-valve").nth(i).locator("button").first.click()
        check("69 kPa" in page.locator("#canyonModalExtra").inner_text(), "Controls did not reach valid pressure")
        cchoice()
        check("valves" in csnap()["done"], "Valid pressure rejected")
        cgo("span")
        page.locator(".canyon-repair-tiles button").nth(3).click()
        check(csnap()["repairStep"] == 0, "Wrong aqueduct order advanced")
        page.locator(".canyon-repair-tiles button").nth(0).click()
        page.locator(".canyon-repair-tiles button").nth(1).click()
        cchoice()
        page.reload()
        page.wait_for_function("!!window.TrailCanyon")
        page.locator("#canyonChapter").click()
        check(csnap()["repairStep"] == 2, "Canyon reload lost repair stages")
        check(set(csnap()["done"]) >= {"surveyor", "kit", "valves"}, "Canyon reload lost missions")
        cgo("span")
        page.locator(".canyon-repair-tiles button").nth(2).click()
        page.locator(".canyon-repair-tiles button").nth(3).click()
        check(not csnap()["waterRestored"], "Repaired aqueduct released final water before safety inspection")
        cgo("cistern")
        energy = csnap()["energy"]
        cchoice(1)
        check(csnap()["energy"] <= energy-5, "Unsafe cistern answer did not deduct energy")
        cchoice(0)
        check(csnap()["cisternSafetyPassed"] and not csnap()["finished"], "Safety answer did not lead to the measuring puzzle")
        check(not csnap()["waterRestored"] and len(csnap()["done"]) == 4, "Safety answer skipped the final release puzzle")
        page.locator(".canyon-release-puzzle").wait_for(state="visible")
        puzzle_energy, puzzle_score = csnap()["energy"], csnap()["score"]
        cchoice(0)
        check(not csnap()["finished"], "An unsolved release gate triggered the ending")
        check(csnap()["energy"] == puzzle_energy and csnap()["score"] == puzzle_score, "An unsolved gate changed energy or awarded points")
        cchoice(1)
        check(not csnap()["finished"], "Asking for a hint skipped the puzzle")
        def release_action(name):
            page.locator(f'[data-release-action="{name}"]').click()
        release_action("fill-large")
        release_action("pour-large")
        check(csnap()["releaseBasins"] == [2, 3], "Water transfer did not conserve the chamber volumes")
        page.screenshot(path=str(ARTIFACTS / f"{mode}-canyon-release-puzzle.png"))
        cchoice(2)
        page.reload()
        page.wait_for_function("!!window.TrailCanyon")
        page.locator("#canyonChapter").click()
        check(csnap()["cisternSafetyPassed"] and csnap()["releaseBasins"] == [2, 3], "Reload lost the measuring puzzle checkpoint")
        cgo("cistern")
        page.locator(".canyon-release-puzzle").wait_for(state="visible")
        puzzle_energy, puzzle_score = csnap()["energy"], csnap()["score"]
        for action in ["return-small", "pour-large", "fill-large", "pour-large"]:
            release_action(action)
        check(csnap()["releaseBasins"] == [4, 3], "Five and three litre chambers failed to measure four litres")
        check(not csnap()["finished"] and not csnap()["waterRestored"], "Measuring four litres skipped the release action")
        check(csnap()["energy"] == puzzle_energy and csnap()["score"] == puzzle_score, "Measuring actions changed energy or awarded points")
        cchoice(0)
        check(csnap()["finished"] and len(csnap()["done"]) == 5, "Final Canyon victory did not trigger")
        check(page.evaluate("window.TrailProgress.snapshot().completed.includes('canyon')"), "Canyon completion badge missing")
        check(page.evaluate("window.TrailProgress.saved('canyon') === null"), "Completed Canyon checkpoint not cleared")
        check(csnap()["waterRestored"], "Final completion did not restore the water")
        page.locator(".canyon-victory-scene").wait_for(state="visible")
        page.screenshot(path=str(ARTIFACTS / f"{mode}-canyon-victory.png"))
        score = csnap()["score"]
        cchoice(2)
        page.locator("#canyonModalBackdrop").wait_for(state="hidden")
        page.locator("#canyonCelebration").wait_for(state="visible")
        check(csnap()["finished"] and not csnap()["active"], "Watching restored water restarted gameplay")
        page.screenshot(path=str(ARTIFACTS / f"{mode}-canyon-water-restored.png"))
        page.locator("#canyonViewResults").click()
        page.locator(".canyon-victory-scene").wait_for(state="visible")
        check(not page.locator("#canyonCelebration").is_visible(), "Celebration controls overlap the results dialog")
        check(csnap()["score"] == score, "Reopening results changed the final score")
        cchoice(1)
        check(not csnap()["waterRestored"] and len(csnap()["done"]) == 0, "Replay retained the restored water state")
        check(not csnap()["cisternSafetyPassed"] and csnap()["releaseBasins"] == [0, 0], "Replay retained a solved measuring puzzle")
        check(not page.locator("#canyonCelebration").is_visible(), "Replay retained the celebration")
        check(page.evaluate("window.TrailProgress.snapshot().completed.includes('canyon')"), "Replay erased the earned completion badge")
        check(not failures, "Browser uncaught errors: " + "; ".join(failures))
        print(f"PASS {mode}: actual UI Chapter 1 → Chapter 2, nine pipes, safety quizzes, all five Canyon goals, 69 kPa valves, aqueduct order, four-litre measuring puzzle, checkpoint reloads, keyboard and final victory; no uncaught page errors", flush=True)
        # Mobile smoke uses completion/unlock data earned by the actual walkthrough.
        mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=1, reduced_motion="reduce")
        mobile.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
        mobile.route("https://esm.sh/**", lambda route: route.abort())
        earned_storage = page.evaluate("Object.fromEntries(Object.entries(localStorage))")
        earned_storage["thirstTrailSound"] = "false"
        mobile.add_init_script("window.__qaAudioStarts=0;const NativeAudioContext=window.AudioContext;if(NativeAudioContext)window.AudioContext=new Proxy(NativeAudioContext,{construct(target,args){window.__qaAudioStarts++;return Reflect.construct(target,args);}});")
        mobile.add_init_script("const data=" + json.dumps(earned_storage) + ";for (const [k,v] of Object.entries(data)) localStorage.setItem(k,v);")
        mp = mobile.new_page()
        mp.on("pageerror", lambda err: failures.append(str(err)))
        mp.goto(url)
        mp.wait_for_function("!!window.ThirstTrail")
        mp.locator("#valleyChapter").tap()
        mp.locator("#renderLoading").wait_for(state="hidden")
        check(mp.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), "Reduced motion preference not present")
        check(mp.locator("#soundButton").get_attribute("aria-pressed") == "false", "Persisted mute not respected")
        cdp = mobile.new_cdp_session(mp)
        def touch_hold(selector, snapshot, cancel=False):
            button = mp.locator(selector)
            button.scroll_into_view_if_needed()
            box = button.bounding_box()
            before = mp.evaluate(snapshot)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": box["x"]+box["width"]/2, "y": box["y"]+box["height"]/2}]})
            mp.wait_for_function("data=>{const s=eval(data.expression);return s.x>data.x+8}", arg={"expression": snapshot, "x": before["x"]}, timeout=10000)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancel else "touchEnd", "touchPoints": []})
            end = mp.evaluate(snapshot)
            mp.wait_for_timeout(200)
            after = mp.evaluate(snapshot)
            check(abs(after["x"]-end["x"])<3, "Touch release/cancel left movement held")
        touch_hold('[data-dir="right"]', "window.ThirstTrail.snapshot()")
        mp.locator('[data-destination="elder"]').tap()
        mp.wait_for_function("window.ThirstTrail.snapshot().nearby === 'elder'", timeout=30000)
        mp.locator("#touchAction").tap()
        mp.locator("#modalBackdrop").wait_for(state="visible")
        check(mp.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Mobile page has horizontal overflow")
        mp.screenshot(path=str(ARTIFACTS / "mobile-valley-dialog.png"))
        mp.locator("#modalChoices button").first.tap()
        mp.locator("#valleyChapters").tap()
        mp.locator("#canyonChapter").tap()
        touch_hold('[data-canyon-move="right"]', "window.TrailCanyon.snapshot()", cancel=True)
        mp.locator("#canyonPause").tap()
        check(mp.evaluate("window.TrailCanyon.snapshot().paused"), "Mobile Canyon pause failed")
        mp.locator("#canyonModalOptions button").first.tap()
        check(not mp.evaluate("window.TrailCanyon.snapshot().paused"), "Mobile Canyon resume failed")
        mp.screenshot(path=str(ARTIFACTS / "mobile-canyon-gameplay.png"))
        check(mp.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Mobile Canyon horizontal overflow")
        check(mp.evaluate("window.__qaAudioStarts === 0"), "Muted mobile game still starts Web Audio")
        check(not failures, "Mobile uncaught errors: " + "; ".join(failures))
        print("PASS mobile 390×844: real touch movement/release/cancel, Valley dialogue, Canyon pause/resume, persisted mute, reduced-motion preference and no horizontal overflow", flush=True)
        mobile.close()
        context.close()
        browser.close()
    server.shutdown()

if __name__ == "__main__":
    main()
