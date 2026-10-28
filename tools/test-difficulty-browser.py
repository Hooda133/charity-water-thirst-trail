#!/usr/bin/env python3
"""Exercise saved difficulty through Settings and the real game controls.

Earned Chapter 1/2 completion fixtures unlock the expanded game. Canyon and
Coast replay checkpoints contain valid partial puzzle work; the test never
injects game state or calls setters to complete a puzzle. CDN loading is
blocked to exercise the supported fallback without requiring a GPU.
"""
import argparse
import functools
import http.server
import json
import math
import os
from pathlib import Path
import re
import shutil
import threading

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
CANYON_REPLAY = {
    "x": 390, "y": 223, "energy": 90, "score": 210,
    "done": ["surveyor", "kit"], "valves": [1, 3, 1], "repairStep": 0,
}
COAST_REPLAY = {
    "x": 441, "y": 365, "energy": 90, "score": 330,
    "done": ["mara", "power"], "power": [True, False, True, True],
    "weights": [0, 1, 0], "tankStep": 0, "gates": [0, 0, 0],
}


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(value, message):
    if not value:
        raise AssertionError(message)


def seed_script(mode="normal"):
    progress = {
        "version": 2, "unlocked": ["valley", "canyon"],
        "completed": ["valley", "canyon"], "lastLevel": "canyon",
        "saves": {"canyon": CANYON_REPLAY, "coast": COAST_REPLAY},
    }
    values = {
        "thirstTrailProgressV2": json.dumps(progress),
        "thirstTrailMode": mode, "thirstTrailTutorial": "true",
        "thirstTrailSound": "false",
        "thirstTrailGraphics": json.dumps({
            "preset": "low", "resolution": .65, "shadows": False,
            "effects": False, "sensitivity": .9,
        }),
    }
    return """if(!localStorage.getItem('difficultyQaInitialized')) {
      const values=""" + json.dumps(values) + """;
      for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);
      localStorage.setItem('difficultyQaInitialized','true');
    }"""


def new_context(browser, mobile, mode="normal"):
    context = browser.new_context(
        viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 1000},
        is_mobile=mobile, has_touch=mobile, reduced_motion="reduce",
    )
    context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
    context.route("https://esm.sh/**", lambda route: route.abort())
    context.add_init_script(seed_script(mode))
    return context


def ready(page):
    page.wait_for_function("!!window.ThirstTrail && !!window.TrailMode && !!window.TrailCoast")


def check_viewport(page):
    check(page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
          "Settings/game layout overflows the viewport")


def open_settings(page):
    if not page.locator("#graphicsPanel").is_visible():
        page.locator("#graphicsButton").click()
    page.locator("#difficultySelect").wait_for(state="visible")
    check_viewport(page)
    box = page.locator("#difficultySelect").bounding_box()
    check(box and box["x"] >= 0 and box["width"] > 100,
          "Difficulty select is clipped or too narrow")
    check(box["x"] + box["width"] <= page.viewport_size["width"] + 1,
          "Difficulty select extends outside the viewport")


def close_settings(page):
    page.locator("#graphicsClose").click()
    for backdrop, options in [
        ("#modalBackdrop", "#modalChoices button"),
        ("#canyonModalBackdrop", "#canyonModalOptions button"),
        ("#coastModalBackdrop", "#coastModalOptions button"),
    ]:
        if page.locator(backdrop).is_visible():
            resume = page.locator(options).filter(has_text=re.compile("Resume", re.I))
            if resume.count():
                resume.first.click()


def select_difficulty(page, value, close=True):
    open_settings(page)
    page.locator("#difficultySelect").select_option(value)
    expected = {"easy": "explorer", "normal": "normal", "hard": "challenge"}[value]
    check(page.evaluate("TrailMode.get()") == expected, "Settings did not update shared mode")
    check(page.evaluate("TrailMode.getDifficulty()") == value, "Difficulty helper is out of sync")
    check(page.evaluate("TrailMode.profile().label") == value.title(), "Difficulty label is stale")
    check(page.locator("#playModeLabel").inner_text().startswith(value.title()),
          "Hub difficulty summary did not update")
    check(page.locator("#" + expected + "Mode").get_attribute("aria-checked") == "true",
          "Hub choice is out of sync with Settings")
    description = page.locator("#difficultyDescription")
    check(description.is_visible() and len(description.inner_text()) > 20,
          "Settings needs a readable difficulty description")
    if close:
        close_settings(page)
    return description.inner_text() if not close else value


def check_settings_and_energy(page, out):
    descriptions, ratios = {}, {}
    for difficulty in ["easy", "normal", "hard"]:
        descriptions[difficulty] = select_difficulty(page, difficulty, close=False)
        page.screenshot(path=str(out / ("settings-" + difficulty + ".png")))
        close_settings(page)
        page.locator("#startButton").click()
        if page.locator("#modalBackdrop").is_visible():
            page.locator("#modalChoices button").first.click()
        before = page.evaluate("ThirstTrail.snapshot()")
        page.keyboard.down("d")
        page.wait_for_function("x => ThirstTrail.snapshot().x > x + 35", arg=before["x"], timeout=12000)
        page.keyboard.up("d")
        after = page.evaluate("ThirstTrail.snapshot()")
        distance = math.hypot(after["x"] - before["x"], after["y"] - before["y"])
        ratios[difficulty] = (before["energy"] - after["energy"]) / distance
        check(ratios[difficulty] > 0, "Walking must use energy on " + difficulty)
        page.locator("#valleyChapters").click()
    check(len(set(descriptions.values())) == 3, "Each difficulty must explain its own rules")
    check(ratios["normal"] > ratios["easy"] * 2,
          "Easy should conserve substantially more movement energy")
    check(ratios["hard"] > ratios["normal"] * 1.1,
          "Hard should consume more movement energy than Normal")
    open_settings(page)
    select = page.locator("#difficultySelect")
    select.focus()
    check(page.evaluate("document.activeElement.id") == "difficultySelect", "Select is not keyboard focusable")
    select.press("Home")
    select.press("ArrowDown")
    select.press("Enter")
    check(select.input_value() == "normal", "Keyboard should select Normal")
    select.press("End")
    select.press("Enter")
    check(select.input_value() == "hard", "Keyboard should select Hard")
    close_settings(page)
    page.reload()
    ready(page)
    open_settings(page)
    check(page.locator("#difficultySelect").input_value() == "hard", "Difficulty did not survive reload")
    check(page.evaluate("localStorage.getItem('thirstTrailMode')") == "challenge",
          "Hard should preserve the compatible saved Challenge ID")
    check(page.locator("#qualityPreset").input_value() == "low", "Difficulty should preserve graphics preference")
    close_settings(page)
    print("PASS Settings choices, keyboard selection, saved reload and actual movement energy", ratios, flush=True)
    return ratios


def life(page):
    return page.evaluate("TrailVillageLife.snapshot()")


def life_action(page, name):
    page.locator('[data-village-action="' + name + '"]').click(timeout=60000)


def compare_community(before, after, keys):
    for key in keys:
        check(before[key] == after[key], "Difficulty change/reload lost village " + key)


def check_village_difficulty(page, out):
    select_difficulty(page, "normal")
    page.locator("#villageChapter").click()
    page.locator("#villageLifePanel").wait_for(state="visible")
    life_action(page, "go-fountain")
    life_action(page, "fill")
    for person in ["home", "school"]:
        life_action(page, "go-" + person)
        life_action(page, "deliver-" + person)
    check(life(page)["jug"] == 0 and life(page)["materials"] == 4,
          "Normal should retain the existing two 4L deliveries per jug")
    life_action(page, "tab-projects")
    life_action(page, "build-station")
    life_action(page, "tab-deliveries")
    life_action(page, "go-fountain")
    life_action(page, "fill")
    life_action(page, "tab-leaks")
    life_action(page, "go-school-joint")
    life_action(page, "inspect-school-joint")
    life_action(page, "tool-school-joint-gasket")
    life_action(page, "repair-school-joint-0")
    before = life(page)
    check(before["jug"] == 8 and before["repair"]["step"] == 1,
          "Real controls must create a filled jug and a partial repair")
    select_difficulty(page, "hard")
    hard = life(page)
    preserved = ["jug", "materials", "round", "served", "delivered", "found", "fixed", "upgrades", "repair"]
    compare_community(before, hard, preserved)
    check(hard["jugCapacity"] == 8 and hard["deliveryRequest"] == 6,
          "Hard should request 6L without changing the 8L jug")
    life_action(page, "tab-deliveries")
    check("6" in page.locator("#villageLifePanel").inner_text(), "Village copy still shows old delivery amount")
    life_action(page, "go-garden")
    life_action(page, "deliver-garden")
    check(life(page)["jug"] == 2 and life(page)["roundComplete"], "Hard delivery must consume six litres")
    life_action(page, "next-round")
    life_action(page, "go-home")
    check(page.locator('[data-village-action="deliver-home"]').is_disabled(),
          "A 2L remainder cannot satisfy a 6L request")
    delivered = life(page)["delivered"]["home"]
    life_action(page, "go-fountain")
    life_action(page, "fill")
    life_action(page, "go-home")
    life_action(page, "deliver-home")
    earned = life(page)
    check(earned["jug"] == 2 and earned["delivered"]["home"] == delivered + 1,
          "Refilling should permit the next Hard delivery")
    check(earned["repair"]["step"] == 1 and "station" in earned["upgrades"],
          "Deliveries must retain partial repairs and built projects")
    page.screenshot(path=str(out / "hard-jug-deliveries.png"))
    page.reload()
    ready(page)
    page.locator("#villageChapter").click()
    page.locator("#villageLifePanel").wait_for(state="visible")
    resumed = life(page)
    compare_community(earned, resumed, preserved)
    check(resumed["deliveryRequest"] == 6 and resumed["difficulty"] == "hard",
          "Reload must retain the selected Hard village rules")
    page.locator("#valleyChapters").click()
    print("PASS live village difficulty, earned projects, partial repair, 6L deliveries/refill and reload", flush=True)
    return resumed


def canyon(page):
    return page.evaluate("TrailCanyon.snapshot()")


def check_canyon_difficulty(page, out):
    page.locator("#canyonChapter").click()
    page.locator("#canyonScreen").wait_for(state="visible")
    check(canyon(page)["valves"] == [1, 3, 1] and canyon(page)["pressure"] == 66,
          "Canyon fixture should resume actual partial valve work")
    check("Hard" in page.locator("#canyonModeLabel").inner_text(), "Canyon badge is stale")
    page.locator("#canyonInteract").click()
    text = page.locator("#canyonModalExtra").inner_text()
    check("67" in text and "71" in text, "Hard target must be 67–71 kPa")
    partial = canyon(page)["valves"]
    # Activate the global Settings control by keyboard while the puzzle is open.
    # Escape must close just Settings, preserving the underlying puzzle dialog.
    page.locator("#graphicsButton").focus()
    page.keyboard.press("Enter")
    select_difficulty(page, "normal", close=False)
    check(canyon(page)["valves"] == partial, "Settings change discarded Canyon valve work")
    check("Normal" in page.locator("#canyonModeLabel").inner_text(), "Canyon difficulty badge did not update")
    text = page.locator("#canyonModalExtra").inner_text()
    check("65" in text and "73" in text, "Normal target must return to 65–73 kPa")
    page.keyboard.press("Escape")
    check(not page.locator("#graphicsPanel").is_visible(), "Escape should close Settings")
    check(page.locator("#canyonModalBackdrop").is_visible()
          and "valves" in page.locator("#canyonModalTitle").inner_text(),
          "Escape replaced or dismissed the underlying Canyon puzzle")
    check(not canyon(page)["paused"], "Opening Settings over a puzzle must not replace it with pause")
    page.locator("#graphicsButton").focus()
    page.keyboard.press("Enter")
    select_difficulty(page, "hard", close=False)
    page.keyboard.press("Escape")
    before = canyon(page)["energy"]
    page.locator("#canyonModalOptions button").first.click()
    check("valves" not in canyon(page)["done"], "66 kPa must not pass Hard calibration")
    check(math.isclose(before - canyon(page)["energy"], 7.2, abs_tol=.02),
          "Hard valve penalty should combine the difficulty energy and mistake multipliers")
    page.get_by_role("button", name=re.compile("Increase intake valve")).click()
    page.get_by_role("button", name=re.compile("Decrease regulator valve")).click()
    check(canyon(page)["valves"] == [2, 2, 1] and canyon(page)["pressure"] == 69,
          "Actual valve adjustments should reach 69 kPa")
    page.screenshot(path=str(out / "hard-canyon-valves.png"))
    page.locator("#canyonModalOptions button").first.click()
    check("valves" in canyon(page)["done"], "69 kPa should pass Hard calibration")
    page.locator("#canyonToChapters").click()
    print("PASS Canyon Settings, preserved valves, live target ranges, Hard penalty and calibration", flush=True)


def check_coast_difficulty(page, out):
    page.locator("#coastChapter").click()
    page.locator("#coastScreen").wait_for(state="visible")
    check(page.evaluate("TrailCoast.snapshot().weights") == [0, 1, 0],
          "Coast fixture should resume partial bridge work")
    page.locator("#coastInteract").click()
    page.locator('[data-coast-weight="2"][data-delta="1"]').click()
    partial = page.evaluate("TrailCoast.snapshot()")
    page.locator("#graphicsButton").focus()
    page.keyboard.press("Enter")
    select_difficulty(page, "normal", close=False)
    page.keyboard.press("Escape")
    check(not page.locator("#graphicsPanel").is_visible()
          and page.locator("#coastModalBackdrop").is_visible(),
          "Escape must close Settings and retain the underlying Coast puzzle")
    check("Balance" in page.locator("#coastModalTitle").inner_text(),
          "Opening Settings replaced the partial Coast puzzle")
    changed = page.evaluate("TrailCoast.snapshot()")
    for key in ["weights", "power", "done", "score", "tankStep", "gates"]:
        check(changed[key] == partial[key], "Settings discarded Coast " + key)
    check("Normal" in page.locator("#coastMode").inner_text(), "Coast badge is stale")
    check(page.evaluate("TrailCoast.snapshot().weights") == [0, 1, 1], "Partial bridge weights changed")
    page.locator("#coastModalOptions button").filter(has_text="Return to harbor").click()
    page.reload()
    ready(page)
    page.locator("#coastChapter").click()
    check(page.evaluate("TrailCoast.snapshot().weights") == [0, 1, 1],
          "Coast partial puzzle did not survive settings/reload")
    open_settings(page)
    page.locator("#difficultySelect").focus()
    page.screenshot(path=str(out / "coast-settings.png"))
    close_settings(page)
    print("PASS Coast Settings, shared badge, preserved partial puzzle and reload", flush=True)


def check_normal_canyon(browser, url, mobile):
    context = new_context(browser, mobile)
    page = context.new_page()
    try:
        page.goto(url)
        ready(page)
        page.locator("#canyonChapter").click()
        page.locator("#canyonInteract").click()
        check(canyon(page)["pressure"] == 66, "Normal fixture pressure changed")
        page.locator("#canyonModalOptions button").first.click()
        check("valves" in canyon(page)["done"], "66 kPa must remain valid on Normal")
        print("PASS Normal accepts the 66 kPa setting rejected by Hard", flush=True)
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mobile", action="store_true")
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    args = parser.parse_args()
    out = ROOT / "work" / "difficulty-qa" / ("mobile" if args.mobile else "desktop")
    out.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
        functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    errors, assets, report = [], [], {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=args.browser or shutil.which("chromium") or shutil.which("google-chrome"),
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            context = new_context(browser, args.mobile)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: assets.append({"status": response.status, "url": response.url})
                    if response.status >= 400 and response.url.startswith(url) else None)
            try:
                page.goto(url)
                ready(page)
                check(page.evaluate("TrailProgress.unlocked('coast')"), "Older Canyon completion must unlock Coast")
                report["movementEnergyPerMetre"] = check_settings_and_energy(page, out)
                report["village"] = check_village_difficulty(page, out)
                check_canyon_difficulty(page, out)
                check_coast_difficulty(page, out)
                check_viewport(page)
                check(not errors, "Uncaught page errors: " + "; ".join(errors))
                check(not assets, "Local asset errors: " + json.dumps(assets))
                check_normal_canyon(browser, url, args.mobile)
                report.update({"passed": True, "mobile": args.mobile, "errors": errors, "assetErrors": assets})
                print("PASS difficulty browser", "mobile 390×844" if args.mobile else "desktop", flush=True)
            except Exception:
                page.screenshot(path=str(out / "failure.png"))
                print("ERRORS", errors, flush=True)
                raise
            finally:
                (out / "report.json").write_text(json.dumps(report or {"errors": errors, "assetErrors": assets}, indent=2))
                context.close()
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
