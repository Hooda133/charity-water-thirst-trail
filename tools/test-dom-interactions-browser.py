#!/usr/bin/env python3
"""Verify real DOM additions, removals and changes through player controls.

Uses legitimate earned checkpoints for a nearby supply and an unfinished pump.
It never calls game completion functions or injects live gameplay state. A
MutationObserver and retained DOM handles distinguish removal from hiding.
CDN blocking exercises the supported 2D fallback; this is not a GPU benchmark.
"""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import threading

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SUPPLY_IDS = ["village", "camptrail", "easttrail", "hillside"]
SUPPLY_CHECKPOINT = {
    "x": 310, "y": 620, "energy": 100, "score": 80, "elapsed": 5,
    "done": ["elder"], "inventory": ["fieldNotes"], "supplies": [],
}
PIPE_CHECKPOINT = {
    "x": 1470, "y": 690, "energy": 80, "score": 280, "elapsed": 30,
    "done": ["elder", "toolkit", "gasket"],
    "inventory": ["fieldNotes", "toolkit", "gasket"], "supplies": [],
    "pipeTurns": [1, 2, 3, 1, 2, 1, 3, 1, 2], "pipeReady": False,
}


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(value, message):
    if not value:
        raise AssertionError(message)


def snapshot(page):
    return page.evaluate("ThirstTrail.snapshot()")


def context_for(browser, mobile, checkpoint):
    context = browser.new_context(
        viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 1000},
        is_mobile=mobile, has_touch=mobile, reduced_motion="reduce",
    )
    context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
    context.route("https://esm.sh/**", lambda route: route.abort())
    progress = {
        "version": 2, "unlocked": ["valley"], "completed": [],
        "lastLevel": "valley", "saves": {"valley": checkpoint},
    }
    values = {
        "thirstTrailProgressV2": json.dumps(progress),
        "thirstTrailMode": "challenge", "thirstTrailTutorial": "true",
        "thirstTrailSound": "false",
        "thirstTrailGraphics": json.dumps({
            "preset": "low", "resolution": .65, "shadows": False,
            "effects": False, "sensitivity": .9,
        }),
    }
    context.add_init_script("""if(!localStorage.getItem('domOutcomeQaInitialized')) {
      const values=""" + json.dumps(values) + """;
      for(const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
      localStorage.setItem('domOutcomeQaInitialized','true');
    }""")
    return context


def ready(page):
    page.wait_for_function("!!window.ThirstTrail && !!window.TrailMode && !!window.TrailSupplyUI")
    page.locator("#renderLoading").wait_for(state="hidden")


def begin(page, url):
    page.goto(url, wait_until="domcontentloaded")
    ready(page)
    page.locator("#valleyChapter").click()
    page.wait_for_function("ThirstTrail.snapshot().screen==='playing'")


def inspect_layout(page):
    check(page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
          "Game has horizontal overflow")
    for control in page.locator("#supplyInteraction [data-supply-id]").all():
        box = control.bounding_box()
        check(box and box["width"] >= 44 and box["height"] >= 44,
              "Supply controls must be at least 44×44 pixels")
    check(page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
          "Reduced-motion fixture is not active")


def observe_supply_dom(page):
    page.evaluate("""() => {
      window.__supplyMutations=[];
      const describe=nodes=>Array.from(nodes).flatMap(node=>{
        if(node.nodeType!==1) return [];
        return [node,...node.querySelectorAll('[data-supply-id],[data-collected-supply]')]
          .filter(el=>el.dataset.supplyId||el.dataset.collectedSupply)
          .map(el=>({supply:el.dataset.supplyId||null,collected:el.dataset.collectedSupply||null}));
      });
      window.__supplyObserver=new MutationObserver(records=>{
        for(const record of records)window.__supplyMutations.push({
          type:record.type,attribute:record.attributeName,
          added:describe(record.addedNodes),removed:describe(record.removedNodes)
        });
      });
      __supplyObserver.observe(document.getElementById('supplyInteraction'),{
        subtree:true,childList:true,attributes:true,characterData:true
      });
    }""")


def wait_for_periodic_ui(page):
    elapsed = snapshot(page)["elapsed"]
    page.wait_for_function("t=>ThirstTrail.snapshot().elapsed>t+.4", arg=elapsed)


def check_supply_actions(page, url, out, mobile):
    begin(page, url)
    root = page.locator("#supplyInteraction")
    root.wait_for(state="visible")
    check(root.locator("[data-supply-id]").count() == 4, "Fresh checkpoint needs four drops")
    check(root.locator("[data-collected-supply]").count() == 0, "Fresh checkpoint has no collected badges")
    inspect_layout(page)
    village = root.locator('[data-supply-id="village"]')
    retained = village.element_handle()
    remaining = root.locator('[data-supply-id="camptrail"]').element_handle()
    before = snapshot(page)
    counter_before = root.locator(".supply-dom-counter").inner_text()
    observe_supply_dom(page)
    if mobile:
        village.tap()
    else:
        village.click()
    village.wait_for(state="detached")
    root.locator('[data-collected-supply="village"]').wait_for(state="visible")
    after = snapshot(page)
    check(retained.evaluate("el=>!el.isConnected"), "Clicked drop was hidden instead of removed")
    check(after["score"] == before["score"] + 25, "Drop collection must award one cache reward")
    check(after["energy"] == 100, "Collecting at full energy must never exceed 100")
    check(after["supplies"] == ["village"], "Collection should update the actual saved supply IDs")
    check(root.locator(".supply-dom-counter").inner_text() != counter_before,
          "Collection counter must visibly change")
    check("1 / 4" in root.locator(".supply-dom-counter").inner_text(), "Collection count is stale")
    mutations = page.evaluate("__supplyMutations")
    check(any(any(node["supply"] == "village" for node in record["removed"]) for record in mutations),
          "MutationObserver did not record the removed water-drop element")
    check(any(any(node["collected"] == "village" for node in record["added"]) for record in mutations),
          "MutationObserver did not record the added collection badge")
    check(any(record["type"] in ["characterData", "childList", "attributes"] for record in mutations),
          "Player action did not change DOM state")
    retained.evaluate("el=>el.click()")
    check(snapshot(page)["score"] == after["score"], "A detached drop must not repeat its reward")
    wait_for_periodic_ui(page)
    check(remaining.evaluate("el=>el.isConnected && document.querySelector('[data-supply-id=camptrail]')===el"),
          "Periodic UI updates should retain each uncollected button node")
    page.screenshot(path=str(out / "supply-collected.png"))

    # A distant drop guides travel, then the same existing proximity pickup
    # removes its DOM control. Merely clicking it must not award it remotely.
    distant = root.locator('[data-supply-id="camptrail"]')
    before_travel = snapshot(page)
    distant.click()
    immediate = snapshot(page)
    check(immediate["score"] == before_travel["score"], "Distant drop awarded a remote pickup")
    check("camptrail" not in immediate["supplies"], "Distant drop was collected before arrival")
    page.wait_for_function("ThirstTrail.snapshot().supplies.includes('camptrail')", timeout=45000)
    check(snapshot(page)["score"] == before_travel["score"] + 25, "Travel pickup must award exactly one cache")
    distant.wait_for(state="detached")
    wait_for_periodic_ui(page)
    check(snapshot(page)["score"] == before_travel["score"] + 25, "Proximity pickup must be idempotent")

    saved = snapshot(page)
    page.reload()
    ready(page)
    page.locator("#valleyChapter").click()
    resumed = snapshot(page)
    for key in ["score", "supplies", "quests", "items", "difficulty"]:
        check(resumed[key] == saved[key], "Reload lost " + key)
    check(page.evaluate("JSON.parse(localStorage.getItem('thirstTrailGraphics')).preset") == "low",
          "Collecting drops changed the graphics preference")
    check(root.locator("[data-collected-supply]").count() == 2, "Reload must restore collection badges")
    check(root.locator('[data-supply-id="village"]').count() == 0, "Reload resurrected a used drop")

    # Replay restores the four interactive nodes, removes earned markers, and
    # enables another independent expedition. Pausing guards hidden callbacks.
    page.locator("#resetButton").click()
    page.locator("#modalChoices button").first.click()
    root.locator('[data-supply-id="village"]').wait_for(state="visible")
    check(root.locator("[data-supply-id]").count() == 4, "Replay should restore all four drop buttons")
    check(root.locator("[data-collected-supply]").count() == 0, "Replay should remove old badges")
    paused_drop = root.locator('[data-supply-id="village"]').element_handle()
    page.locator("#pauseButton").click()
    page.locator("#modalBackdrop").wait_for(state="visible")
    page.wait_for_function("document.querySelector('[data-supply-id=village]').disabled")
    paused = snapshot(page)
    paused_drop.evaluate("el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    check(snapshot(page)["score"] == paused["score"], "A paused callback must not collect or reward")
    check(snapshot(page)["supplies"] == [], "A paused callback collected a hidden drop")
    page.locator("#modalChoices button").first.click()
    village = root.locator('[data-supply-id="village"]')
    village.wait_for(state="visible")
    village.focus()
    village.press("Space")
    village.wait_for(state="detached")
    check(snapshot(page)["supplies"] == ["village"], "Keyboard Space did not collect the nearby drop")
    check(snapshot(page)["score"] == paused["score"] + 25, "Keyboard collection did not award once")
    active_supply = page.evaluate("document.activeElement?.dataset.supplyId||document.activeElement?.tagName")
    check(active_supply == "camptrail",
          "Removing a focused drop should focus the next remaining control; got " + str(active_supply))
    inspect_layout(page)
    print("PASS supply DOM remove/add/change, stable nodes, guarded rewards, travel, reload, replay and keyboard", flush=True)
    return {"mutations": mutations, "collectedAfterReload": resumed["supplies"],
            "scoreIncrease": after["score"] - before["score"]}


def check_final_supply(page, url, out):
    begin(page, url)
    root = page.locator("#supplyInteraction")
    check(root.locator("[data-supply-id]").count() == 1, "Earned checkpoint should leave one drop")
    check(root.locator("[data-collected-supply]").count() == 3, "Earned checkpoint needs three badges")
    root.locator('[data-supply-id="hillside"]').click()
    check(root.locator("[data-supply-id]").count() == 0, "Last collected drop must be removed")
    check(root.locator("[data-collected-supply]").count() == 4, "Last collection must add the fourth badge")
    complete = root.locator(".supply-dom-complete")
    complete.wait_for(state="visible")
    check(complete.count() == 1, "Completion message must be inserted once")
    wait_for_periodic_ui(page)
    check(complete.count() == 1, "Periodic updates must not duplicate completion elements")
    check("4 / 4" in root.locator(".supply-dom-counter").inner_text(), "Completed counter is stale")
    check(snapshot(page)["energy"] <= 100, "Final supply overflowed energy")
    page.screenshot(path=str(out / "supplies-complete.png"))
    print("PASS fourth collection adds one completion element and four persisted badges", flush=True)


def check_pipe_actions(page, url, out):
    begin(page, url)
    page.locator("#interactButton").click()
    page.locator("#pipeGrid").wait_for(state="visible")
    tile = page.locator('[data-pipe-tile="0"]')
    check(page.locator("#pipeGrid [data-pipe-tile]").count() == 9, "Pump must keep nine interactive tiles")
    first = int(tile.get_attribute("data-rotation"))
    label = tile.get_attribute("aria-label")
    tile.click()
    tile = page.locator('[data-pipe-tile="0"]')
    second = int(tile.get_attribute("data-rotation"))
    check(second == (first + 90) % 360, "Click should turn the tile 90 degrees")
    check(tile.get_attribute("aria-label") != label, "Rotated ports must update accessible tile text")
    feedback = page.locator("#pipeActionFeedback").inner_text()
    check(len(feedback) > 5, "Pipe rotation must produce visible action feedback")
    check(page.evaluate("document.activeElement?.dataset.pipeTile==='0'"),
          "Click rotation must retain focus on the same tile")
    tile.press("Enter")
    tile = page.locator('[data-pipe-tile="0"]')
    third = int(tile.get_attribute("data-rotation"))
    check(third == (second + 90) % 360, "Enter should turn the focused tile another 90 degrees")
    check(page.locator("#pipeActionFeedback").inner_text() != feedback, "Repeated rotation must change feedback")
    check(page.evaluate("document.activeElement?.dataset.pipeTile==='0'"),
          "Keyboard rotation must retain focus on the tile")
    turns = page.evaluate("TrailProgress.saved('valley').pipeTurns")
    check(turns[0] * 90 == third, "The actual saved pipe rotation must match the DOM")
    check(not snapshot(page)["waterRestored"], "Tile rotation must not bypass the repair or release")
    page.screenshot(path=str(out / "pipe-rotated.png"))
    page.reload()
    ready(page)
    page.locator("#valleyChapter").click()
    page.locator("#interactButton").click()
    tile = page.locator('[data-pipe-tile="0"]')
    tile.wait_for(state="visible")
    check(int(tile.get_attribute("data-rotation")) == third, "Reload lost the visible rotation")
    check(page.evaluate("TrailProgress.saved('valley').pipeTurns") == turns, "Reload lost partial pipeline work")
    check(page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Pipe controls overflow")
    print("PASS pipe click/Enter visibly changes rotation, ports, feedback and saved state without losing focus", flush=True)
    return {"rotationDegrees": [first, second, third], "savedTurns": turns}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    parser.add_argument("--mobile", action="store_true")
    args = parser.parse_args()
    out = ROOT / "work" / "dom-outcome-qa" / ("mobile" if args.mobile else "desktop")
    out.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    errors, asset_errors, report = [], [], {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=args.browser or shutil.which("chromium") or shutil.which("google-chrome"),
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            final_checkpoint = {**SUPPLY_CHECKPOINT, "x": 1250, "y": 430, "energy": 95,
                                "score": 155, "supplies": SUPPLY_IDS[:3]}
            cases = [("supplies", SUPPLY_CHECKPOINT, check_supply_actions),
                     ("completion", final_checkpoint, check_final_supply),
                     ("pipes", PIPE_CHECKPOINT, check_pipe_actions)]
            try:
                for name, checkpoint, test in cases:
                    context = context_for(browser, args.mobile, checkpoint)
                    page = context.new_page()
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("response", lambda response: asset_errors.append({"status": response.status, "url": response.url})
                            if response.url.startswith(url) and response.status >= 400 else None)
                    try:
                        report[name] = test(page, url, out, args.mobile) if name == "supplies" else test(page, url, out)
                        check(not errors, "Uncaught page errors: " + "; ".join(errors))
                        check(not asset_errors, "Local asset failures: " + json.dumps(asset_errors))
                    except Exception:
                        page.screenshot(path=str(out / ("failure-" + name + ".png")))
                        raise
                    finally:
                        context.close()
                report.update({"passed": True, "mobile": args.mobile, "errors": errors, "assetErrors": asset_errors})
                print("PASS DOM interactions browser", "mobile 390×844" if args.mobile else "desktop", flush=True)
            finally:
                (out / "report.json").write_text(json.dumps(report or {"errors": errors, "assetErrors": asset_errors}, indent=2))
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
