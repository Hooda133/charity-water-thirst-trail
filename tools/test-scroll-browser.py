#!/usr/bin/env python3
"""Real Chrome QA for scroll-friendly 3D chapters, sticky stages, and touch pages."""
import functools
import http.server
import importlib.util
from pathlib import Path
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work" / "scroll-qa"
spec = importlib.util.spec_from_file_location(
    "graphics_qa", Path(__file__).with_name("test-graphics-browser.py"))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

# Seed unfinished checkpoints so the chapter remains in active exploration.
# The existing screenshot fixture deliberately seeds a completed Canyon; a
# completed world does not accept camera input, which is correct behavior.
TEST_SEED = qa.seed("low") + """
;(() => {
  const key="thirstTrailProgressV2";
  const saved=JSON.parse(localStorage.getItem(key));
  saved.saves.canyon={x:170,y:425,energy:100,score:0,done:[],
    valves:[0,0,0],repairStep:0,cisternSafetyPassed:false,releaseBasins:[0,0]};
  saved.saves.coast={x:300,y:440,energy:100,score:0,done:[]};
  localStorage.setItem(key,JSON.stringify(saved));
})();
"""

CONFIGS = [
    ("valley", "#villageChapter", ".world-frame #world3dCanvas",
     "#gameScreen", ".canvas-column", ".sidebar"),
    ("canyon", "#canyonChapter", ".canyon-stage canvas:not(#canyonCanvas)",
     "#canyonScreen", ".canyon-stage", ".canyon-sidebar"),
    ("coast", "#coastChapter", ".coast-stage canvas:not(#coastCanvas)",
     "#coastScreen", ".coast-stage", ".coast-sidebar")
]


def verify_wheel(page, selector, chapter):
    details = page.evaluate("""selector => {
      const surface=document.querySelector(selector);
      const simulate=opts=>{
        const event=new WheelEvent("wheel",{bubbles:true,cancelable:true,deltaY:160,...opts});
        surface.dispatchEvent(event);
        return event.defaultPrevented;
      };
      return {regular:simulate({}),alt:simulate({altKey:true}),
              ctrl:simulate({ctrlKey:true}),meta:simulate({metaKey:true})};
    }""", selector)
    assert details["regular"] is False, (chapter, details, "Ordinary wheel was trapped")
    assert details["alt"] is True, (chapter, details, "Alt+wheel should zoom the camera")
    assert details["ctrl"] is False, (chapter, details, "Browser Ctrl+wheel zoom should remain available")
    assert details["meta"] is False, (chapter, details)
    keyboard = page.evaluate("""selector => {
      const surface=document.querySelector(selector);
      const check=(target,key)=>{
        const event=new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true});
        target.dispatchEvent(event);
        target.dispatchEvent(new KeyboardEvent("keyup",{key,bubbles:true}));
        return event.defaultPrevented;
      };
      return {page:check(document.body,"ArrowDown"),
        game:check(surface,"ArrowDown"),spacePage:check(document.body," ")};
    }""", selector)
    assert keyboard == {"page":False,"game":True,"spacePage":False}, (chapter, keyboard)


def verify_desktop(browser, url):
    for chapter, button, canvas, screen, world, sidebar in CONFIGS:
        context = browser.new_context(viewport={"width":1280,"height":920},
                                      reduced_motion="reduce")
        context.add_init_script(TEST_SEED)
        page=context.new_page()
        errors=[]
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        try:
            page.goto(url,wait_until="domcontentloaded",timeout=60000)
            page.wait_for_function("!!window.TrailScrollLayout && !!window.TrailProgress",timeout=45000)
            page.locator(button).click()
            stage=page.locator(canvas)
            stage.wait_for(state="visible",timeout=60000)
            page.add_style_tag(content=f"{sidebar} {{min-height:1500px!important}}")
            page.wait_for_function("""chapter => TrailScrollLayout.status().some(
                row=>row.chapter===chapter && row.active && row.sticky)""",
                arg=screen.lstrip("#"),timeout=10000)
            assert page.locator(world).evaluate(
                "el=>getComputedStyle(el).position")=="sticky",chapter
            verify_wheel(page,canvas,chapter)
            # A real mouse wheel over the playing surface scrolls the document.
            page.evaluate("window.scrollTo(0,0)")
            page.wait_for_timeout(100)
            bounds=stage.bounding_box()
            assert bounds and bounds["width"]>50 and bounds["height"]>50,(chapter,bounds)
            x=bounds["x"]+bounds["width"]*.45
            y=max(25,min(850,bounds["y"]+min(bounds["height"]*.35,110)))
            page.mouse.move(x,y)
            page.mouse.wheel(0,480)
            page.wait_for_function("window.scrollY > 170",timeout=6000)
            moved=page.evaluate("window.scrollY")
            assert moved>170,(chapter,moved)
            stage_position=page.locator(world).evaluate("el=>el.getBoundingClientRect().top")
            assert 5 <= stage_position <= 26,(chapter,stage_position)
            page.mouse.wheel(0,-300)
            page.wait_for_function("previous => window.scrollY < previous-100",
                                   arg=moved,timeout=6000)
            # A short viewport cannot safely pin the full scene. No reflow.
            page.set_viewport_size({"width":1280,"height":590})
            page.wait_for_function("""chapter => TrailScrollLayout.status().some(
                row=>row.chapter===chapter && !row.sticky)""",
                arg=screen.lstrip("#"),timeout=6000)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),chapter
            assert not errors,(chapter,errors)
            page.screenshot(path=str(OUT / f"{chapter}-scroll.png"))
            print(f"PASS desktop {chapter}: normal wheel scrolls both directions, Alt zoom, keyboard scroll, sticky stage and short-screen fallback",flush=True)
        finally:
            context.close()


def verify_mobile(browser,url):
    context=browser.new_context(viewport={"width":390,"height":844},
                                is_mobile=True,has_touch=True,reduced_motion="reduce")
    context.add_init_script(TEST_SEED)
    page=context.new_page()
    try:
        page.goto(url,wait_until="domcontentloaded",timeout=60000)
        page.wait_for_function("!!window.TrailScrollLayout",timeout=30000)
        page.locator("#villageChapter").click()
        page.locator(".world-frame #world3dCanvas").wait_for(state="visible",timeout=60000)
        page.add_style_tag(content=".sidebar {min-height:1350px!important}")
        page.evaluate("window.scrollTo(0,0)")
        canvas=page.locator(".world-frame #world3dCanvas")
        style=canvas.evaluate("el=>getComputedStyle(el).touchAction")
        assert "pan-y" in style,(style,"vertical swipe should scroll over scenery")
        assert page.evaluate("TrailScrollLayout.status().every(row=>!row.sticky)"),"phone must never pin tall scenes"
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+2"),"mobile must not overflow horizontally"
        bounds=canvas.bounding_box()
        assert bounds and bounds["height"]>50,bounds
        x=bounds["x"]+min(100,bounds["width"]*.35)
        y=bounds["y"]+min(130,bounds["height"]*.55)
        assert 80<y<820,(x,y,bounds)
        # A real touch gesture, not a synthetic wheel event.
        session=context.new_cdp_session(page)
        session.send("Input.dispatchTouchEvent",{"type":"touchStart",
            "touchPoints":[{"x":x,"y":y}]})
        for step in range(1,9):
            session.send("Input.dispatchTouchEvent",{"type":"touchMove",
                "touchPoints":[{"x":x,"y":y-step*24}]})
            page.wait_for_timeout(12)
        session.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
        page.wait_for_function("window.scrollY > 25",timeout=4500)
        assert page.evaluate("window.scrollY")>25
        page.screenshot(path=str(OUT / "mobile-swipe.png"))
        print("PASS mobile: vertical canvas swipe scrolls document, no sticky or horizontal overflow",flush=True)
    finally:
        context.close()


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),
        functools.partial(qa.QuietServer,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"),
                headless=True,args=["--no-sandbox","--disable-dev-shm-usage",
                "--use-angle=swiftshader","--enable-unsafe-swiftshader"])
            try:
                url=f"http://127.0.0.1:{server.server_port}"
                verify_desktop(browser,url)
                verify_mobile(browser,url)
            finally:
                browser.close()
    finally:
        server.shutdown()

if __name__=="__main__":
    main()
