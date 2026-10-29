#!/usr/bin/env python3
"""Visual smoke test: the imported CC0 GLBs must actually load inside each 3D world."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import threading
from playwright.sync_api import sync_playwright
import importlib.util
spec = importlib.util.spec_from_file_location(
    "graphics_qa", Path(__file__).with_name("test-graphics-browser.py"))
graphics_qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(graphics_qa)
ROOT, QuietServer, seed, isolate_valley = (
    graphics_qa.ROOT, graphics_qa.QuietServer,
    graphics_qa.seed, graphics_qa.isolate_valley)

OUT = ROOT / "work" / "scenic-qa"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    site = functools.partial(QuietServer, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), site)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"
    results = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                executable_path=args.browser or shutil.which("google-chrome") or shutil.which("chromium"),
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage",
                      "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            try:
                for scene in ("valley", "village", "canyon", "coast"):
                    ctx = browser.new_context(viewport={"width": 1360, "height": 880},
                                              reduced_motion="reduce")
                    graphics_qa.local_three(ctx)
                    if scene in ("canyon", "coast"):
                        isolate_valley(ctx, ROOT)
                    ctx.add_init_script(seed("high"))
                    page = ctx.new_page()
                    errors = []
                    failed_assets = []
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.on("response", lambda r: failed_assets.append(r.url)
                            if r.status >= 400 and "assets/upgraded_graphics/" in r.url else None)
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=60000)
                        page.wait_for_function("() => window.TrailScenicAssets && window.ThirstTrail && window.TrailCanyon && window.TrailCoast", timeout=60000)
                        if scene in ("valley", "village"):
                            page.locator("#villageChapter").click()
                        elif scene == "canyon":
                            page.locator("#canyonChapter").click()
                        else:
                            page.locator("#coastChapter").click()
                        page.wait_for_function(
                            "chapter => window.TrailScenicAssets.status().some(x => x.chapter===chapter && x.loaded>=1)",
                            arg=scene, timeout=60000)
                        scene_status = page.evaluate("() => TrailScenicAssets.status()")
                        status = next(x for x in scene_status if x["chapter"] == scene)
                        assert status["loaded"] >= 1, (scene, status)
                        assert not failed_assets, (scene, failed_assets)
                        assert not errors, (scene, errors)
                        path = OUT / f"{scene}-cc0.png"
                        page.screenshot(path=str(path), timeout=60000)
                        print("PASS GLB rendered", scene, "loaded", status["loaded"],
                              "of", status["total"], flush=True)
                        results.append({"chapter": scene, "status": status, "image": str(path.relative_to(ROOT))})
                    finally:
                        ctx.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        (OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    assert len(results) == 4, "All four areas must load an actual imported GLB"

if __name__ == "__main__":
    main()
