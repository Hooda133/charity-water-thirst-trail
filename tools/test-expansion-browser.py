#!/usr/bin/env python3
"""Browser regression for the living village, play modes and Stormbreak Coast.

The only seeded data is an old earned Chapter 1/2 completion record, allowing
the expansion's migration and post-game activities to be exercised directly.
All movement, puzzle actions, deliveries and project spending use real controls.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "work" / "expansion-qa"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
LEGACY_PROGRESS = {
    "version": 2, "unlocked": ["valley", "canyon"],
    "completed": ["valley", "canyon"], "saves": {},
    "lastLevel": "canyon", "revision": 2,
}


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(value, message):
    if not value:
        raise AssertionError(message)


def seed_script(extra=None):
    values = {
        "thirstTrailProgressV2": json.dumps(LEGACY_PROGRESS),
        "thirstTrailTutorial": "true", "thirstTrailSound": "false",
        "thirstTrailGraphics": json.dumps({
            "preset": "low", "resolution": .65, "shadows": False,
            "effects": False, "sensitivity": .9,
        }),
    }
    if extra:
        values.update(extra)
    # Initialize only once: reload assertions must read the app's actual saves.
    return "if (!localStorage.getItem('expansionQaInitialized')) {const data=" + json.dumps(values) + ";for(const [key,value] of Object.entries(data)) localStorage.setItem(key,value);localStorage.setItem('expansionQaInitialized','true');}"


def route_assets(context, three, directory):
    if not three:
        context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
        context.route("https://esm.sh/**", lambda route: route.abort())
        return
    modules = {"three.module.js": "three.module.mjs", "GLTFLoader.js": "GLTFLoader.js", "BufferGeometryUtils.js": "BufferGeometryUtils.js"}
    if (directory / "three.module.mjs").exists():
        def serve(route):
            name = modules.get(route.request.url.rsplit("/", 1)[-1])
            if name and (directory / name).exists():
                route.fulfill(path=str(directory / name), content_type="application/javascript", headers={"Access-Control-Allow-Origin": "*"})
            else:
                route.abort()
        context.route("https://cdn.jsdelivr.net/**", serve)


def check_mode_movement(page):
    ratios = {}
    for mode in ["explorer", "challenge"]:
        page.locator("#" + mode + "Mode").click()
        check(page.evaluate("TrailMode.get()") == mode, "Mode button did not select " + mode)
        page.locator("#startButton").click()
        if page.locator("#modalBackdrop").is_visible():
            page.locator("#modalChoices button").first.click()
        before = page.evaluate("ThirstTrail.snapshot()")
        page.keyboard.down("d")
        page.wait_for_function("x => ThirstTrail.snapshot().x > x + 35", arg=before["x"], timeout=12000)
        page.keyboard.up("d")
        after = page.evaluate("ThirstTrail.snapshot()")
        distance = ((after["x"] - before["x"])**2 + (after["y"] - before["y"])**2)**.5
        ratios[mode] = (before["energy"] - after["energy"]) / distance
        check(ratios[mode] > 0, "Walking should use a positive amount of energy")
        page.locator("#valleyChapters").click()
    check(ratios["challenge"] > ratios["explorer"] * 2, "Challenge should use materially more energy per metre than Explorer")
    page.locator("#explorerMode").click()
    print("PASS actual Explorer/Challenge movement energy", ratios, flush=True)


def life_snapshot(page):
    return page.evaluate("TrailVillageLife.snapshot()")


def life_action(page, action, timeout=60000):
    page.locator('[data-village-action="' + action + '"]').click(timeout=timeout)


def check_village(page):
    page.locator("#villageChapter").click()
    page.locator("#villageLifePanel").wait_for(state="visible")
    check(page.evaluate("ThirstTrail.snapshot().screen") == "village", "Community should permit world movement")
    check(life_snapshot(page)["active"], "Village activities did not activate")
    life_action(page, "go-fountain")
    life_action(page, "fill")
    check(life_snapshot(page)["jug"] == 8, "Fountain did not fill the 8L jug")
    for recipient in ["home", "school"]:
        print("Village delivery", recipient, life_snapshot(page), flush=True)
        life_action(page, "go-" + recipient)
        life_action(page, "deliver-" + recipient)
        check(recipient in life_snapshot(page)["served"], "Nearby water delivery was not recorded")
    check(life_snapshot(page)["jug"] == 0, "Two 4L deliveries should empty the jug")
    life_action(page, "go-fountain")
    life_action(page, "fill")
    life_action(page, "go-garden")
    life_action(page, "deliver-garden")
    check(life_snapshot(page)["jug"] == 4, "Garden delivery should use four litres")
    check(life_snapshot(page)["roundComplete"], "All three recipients should finish a delivery round")
    page.screenshot(path=str(ARTIFACTS / "fallback-community-deliveries.png"))
    life_action(page, "tab-leaks")
    for leak, tool in [("school-joint", "gasket"), ("home-pipe", "clamp"), ("garden-coupling", "torque")]:
        print("Village repair", leak, life_snapshot(page), flush=True)
        life_action(page, "go-" + leak)
        life_action(page, "inspect-" + leak)
        check(leak in life_snapshot(page)["found"], "Inspecting a wet patch should discover its leak")
        life_action(page, "tool-" + leak + "-" + tool)
        for step in range(3):
            life_action(page, "repair-" + leak + "-" + str(step))
        check(leak in life_snapshot(page)["fixed"], "The three hands-on repair actions did not fix the leak")
    check(life_snapshot(page)["materials"] >= 11, "Delivery/repair rewards should fund all three projects")
    life_action(page, "tab-projects")
    for upgrade in ["station", "irrigation", "shade"]:
        before = life_snapshot(page)["materials"]
        life_action(page, "build-" + upgrade)
        check(upgrade in life_snapshot(page)["upgrades"], "Building project was not recorded: " + upgrade)
        check(life_snapshot(page)["materials"] < before, "Projects must spend earned materials")
    earned = life_snapshot(page)
    page.screenshot(path=str(ARTIFACTS / "fallback-community-projects.png"))
    page.reload()
    page.wait_for_function("!!window.ThirstTrail && !!window.TrailVillageLife")
    page.locator("#villageChapter").click()
    page.locator("#villageLifePanel").wait_for(state="visible")
    resumed = life_snapshot(page)
    for key in ["jug", "materials", "served", "fixed", "upgrades"]:
        check(resumed[key] == earned[key], "Community reload lost " + key)
    check(page.evaluate("TrailProgress.saved('valley') !== null"), "Community work should preserve the earlier Valley replay checkpoint")
    print("PASS delivery jug, three households, three hands-on leaks, three upgrades and real reload", resumed, flush=True)
    page.locator("#valleyChapters").click()
    return earned


def check_coast(page, mobile=False):
    page.locator("#coastChapter").click()
    page.locator("#coastScreen").wait_for(state="visible")
    def snap():
        return page.evaluate("TrailCoast.snapshot()")
    if mobile:
        button=page.locator('[data-coast-key="d"]');button.scroll_into_view_if_needed();box=button.bounding_box()
        before=snap();cdp=page.context.new_cdp_session(page)
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}]})
        page.wait_for_function("x=>TrailCoast.snapshot().x>x+8",arg=before["x"],timeout=10000)
        cdp.send("Input.dispatchTouchEvent",{"type":"touchCancel","touchPoints":[]})
        stopped=snap();page.wait_for_timeout(200)
        check(abs(snap()["x"]-stopped["x"])<3,"Coast touch cancellation must stop movement")
    def choice(index=0):
        page.locator("#coastModalOptions button").nth(index).click()
    def go(key):
        print("Coast travel", key, snap(), flush=True)
        page.locator('[data-coast-destination="'+key+'"]').click()
        positions={"mara":[165,370],"power":[340,180],"bridge":[520,365],"tank":[740,180],"release":[850,390]}
        page.wait_for_function("p=>{let s=TrailCoast.snapshot();return Math.hypot(s.x-p[0],s.y-p[1])<86}",arg=positions[key],timeout=40000)
        page.locator("#coastInteract").click()
        page.locator("#coastModalBackdrop").wait_for(state="visible")
    go("mara");choice()
    go("power");choice()
    check("power" not in snap()["done"], "Incorrect circuit must stay unsolved")
    for switch in [0,2,3]:
        page.locator('[data-coast-switch="'+str(switch)+'"]').click()
    choice()
    go("bridge");choice()
    check("bridge" not in snap()["done"], "Unbalanced bridge must stay closed")
    page.locator('[data-coast-weight="1"][data-delta="1"]').click()
    choice(2)
    page.reload()
    page.wait_for_function("!!window.TrailCoast")
    page.locator("#coastChapter").click()
    check(snap()["weights"]==[0,1,0],"Partially balanced bridge must survive reload")
    go("bridge")
    for _ in range(2):page.locator('[data-coast-weight="1"][data-delta="1"]').click()
    for _ in range(2):page.locator('[data-coast-weight="2"][data-delta="1"]').click()
    check(snap()["torque"]==12,"Counterweights must reach target torque")
    choice()
    go("tank")
    page.locator('[data-coast-repair="2"]').click()
    check(snap()["tankStep"]==0,"Incorrect repair order must keep completed work")
    for step in [0,1,2]:page.locator('[data-coast-repair="'+str(step)+'"]').click()
    go("release");choice()
    check(not snap()["waterRestored"],"Incorrect sluices cannot release water")
    for i,value in enumerate([3,2,1]):
        page.locator('[data-coast-gate="'+str(i)+'"]').fill(str(value))
    page.screenshot(path=str(ARTIFACTS/"coast-sluice-puzzle.png"))
    choice()
    check(snap()["finished"] and len(snap()["done"])==5,"Coast must complete all five objectives")
    check(page.evaluate("TrailProgress.snapshot().completed.includes('coast')"),"Coast completion must persist")
    score=snap()["score"]
    page.screenshot(path=str(ARTIFACTS/"coast-celebration.png"))
    choice(2)
    page.locator("#coastCelebration").wait_for(state="visible")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(ARTIFACTS/"coast-water-restored.png"))
    page.locator("#coastCheer").click()
    page.locator("#coastResults").click()
    check(snap()["score"]==score,"Results and cheering cannot repeat rewards")
    choice(1)
    check(snap()["done"]==[] and not snap()["finished"],"Replay must reset Coast")
    page.locator("#coastHome").click()
    print("PASS Coast circuit, counterweights, repair, sluices, reload, celebration and replay",flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--3d",dest="three",action="store_true")
    parser.add_argument("--mobile",action="store_true")
    parser.add_argument("--coast-only",action="store_true")
    parser.add_argument("--browser",default=os.environ.get("CHROMIUM_PATH"))
    args=parser.parse_args()
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(QuietServer,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.browser or shutil.which("chromium") or shutil.which("google-chrome"),headless=True,args=["--no-sandbox","--disable-dev-shm-usage"]+(["--use-angle=swiftshader","--enable-unsafe-swiftshader"] if args.three else ["--disable-gpu"]))
        context=browser.new_context(viewport={"width":390,"height":844} if args.mobile else {"width":1440,"height":1100},is_mobile=args.mobile,has_touch=args.mobile,reduced_motion="reduce")
        route_assets(context,args.three,ROOT/"work")
        context.add_init_script(seed_script())
        page=context.new_page();page.on("pageerror",lambda error:errors.append(str(error)))
        try:
            page.goto(f"http://127.0.0.1:{server.server_port}")
            page.wait_for_function("!!window.TrailVillageLife && !!window.TrailCoast")
            check(page.evaluate("TrailProgress.unlocked('coast')"),"Legacy Canyon completion must unlock Coast")
            if not args.coast_only:
                check_mode_movement(page)
                check_village(page)
            check_coast(page,args.mobile)
            check(page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),"Page must fit viewport")
            check(not errors,"Uncaught errors: "+"; ".join(errors))
            print("PASS expansion browser", "3d" if args.three else "fallback", "mobile" if args.mobile else "desktop",flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS/"expansion-failure.png"))
            print("ERRORS",errors,flush=True)
            raise
        finally:
            context.close();browser.close()
    server.shutdown()


if __name__=="__main__":main()
