#!/usr/bin/env python3
"""Real WebGL presentation QA for all chapters; no source changes are shipped.

Use --site work/graphics-qa/baseline-site --label baseline --baseline for a committed-source
comparison, or --label polished after the graphics pass. Graphics presets are
changed using the real global panel. Screenshots establish appearance, not FPS.
Use --smoke for the small custom-shader check suitable for CI.
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

COMMUNITY = {
    "version": 1, "jug": 4, "materials": 4, "round": 1,
    "served": ["home", "school", "garden"],
    "delivered": {"home": 1, "school": 1, "garden": 1},
    "found": ["school-joint", "home-pipe", "garden-coupling"],
    "fixed": ["school-joint", "home-pipe", "garden-coupling"],
    "upgrades": ["station", "irrigation", "shade"], "repair": None, "bonus": True,
}
COAST = {"x": 850, "y": 440, "energy": 90, "score": 870,
         "done": ["mara", "power", "bridge", "tank"],
         "power": [True, False, True, True], "weights": [0, 3, 2],
         "tankStep": 3, "gates": [0, 0, 0]}
CANYON = {"x": 820, "y": 235, "energy": 90, "score": 1200,
          "done": ["surveyor", "kit", "valves", "span", "cistern"],
          "valves": [2, 2, 1], "repairStep": 4,
          "cisternSafetyPassed": True, "releaseBasins": [4, 3]}


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def seed(preset):
    profiles = {
        "low": {"resolution": .65, "shadows": False, "effects": True},
        "medium": {"resolution": 1, "shadows": True, "effects": True},
        "high": {"resolution": 1.1, "shadows": True, "effects": True},
        "ultra": {"resolution": 1.35, "shadows": True, "effects": True},
    }
    progress = {"version": 2, "unlocked": ["valley", "canyon", "coast"],
                "completed": ["valley", "canyon"],
                "saves": {"canyon": CANYON, "coast": COAST},
                "community": COMMUNITY, "lastLevel": "canyon"}
    storage = {
        "thirstTrailProgressV2": json.dumps(progress),
        "thirstTrailGraphics": json.dumps({"preset": preset, "sensitivity": .9, **profiles[preset]}),
        "thirstTrailMode": "explorer", "thirstTrailSound": "false",
        "thirstTrailTutorial": "true",
    }
    return "const data=" + json.dumps(storage) + ";for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);"


def local_three(context):
    # Hosted CI may use the pinned public module; local QA can run offline.
    if not (ROOT / "work" / "three.module.mjs").exists():
        return
    modules = {"three.module.js": "three.module.mjs", "GLTFLoader.js": "GLTFLoader.js",
               "BufferGeometryUtils.js": "BufferGeometryUtils.js"}
    def serve(route):
        name = modules.get(route.request.url.rsplit("/", 1)[-1])
        if name and (ROOT / "work" / name).exists():
            route.fulfill(path=str(ROOT / "work" / name), content_type="application/javascript",
                          headers={"Access-Control-Allow-Origin": "*"})
        else:
            route.abort()
    context.route("https://cdn.jsdelivr.net/**", serve)
    context.route("https://esm.sh/**", lambda route: route.abort())


def isolate_valley(context, site):
    source = (site / "script.js").read_text()
    begin = source.index("  createWorld(canvas, {")
    end = source.index("  let audioContext = null;", begin)
    isolated = source[:begin] + "  worldLoading=false;setRenderLoading(false);\n" + source[end:]
    context.route("**/script.js", lambda route: route.fulfill(body=isolated,
                                                            content_type="application/javascript"))


def canvas_metrics(page, selector):
    return page.locator(selector).evaluate("el=>({width:el.width,height:el.height,cssWidth:el.clientWidth,cssHeight:el.clientHeight,ratio:el.width/el.clientWidth})")


def set_preset(page, preset):
    page.locator("#graphicsButton").click()
    page.locator("#qualityPreset").select_option(preset)
    page.locator("#graphicsClose").click()


def start_scene(page, scene):
    if scene == "valley":
        page.locator("#villageChapter").click()
        page.wait_for_function("ThirstTrail.snapshot().renderer==='3d'", timeout=120000)
        return "#world3dCanvas", ".world-frame"
    if scene == "canyon":
        page.locator("#canyonChapter").click()
        page.wait_for_function("TrailCanyon.snapshot().renderer==='3d'", timeout=120000)
        page.locator("#canyonModalOptions button").nth(2).click()
        return ".canyon-webgl", ".canyon-stage"
    page.locator("#coastChapter").click()
    page.wait_for_function("TrailCoast.snapshot().renderer==='3d'", timeout=120000)
    page.locator("#coastInteract").click()
    for i, value in enumerate([3, 2, 1]):
        page.locator('[data-coast-gate="'+str(i)+'"]').fill(str(value))
    page.locator("#coastModalOptions button").first.click()
    page.locator("#coastModalOptions button").nth(2).click()
    return ".coast-webgl", ".coast-stage"


def assert_scene(page, scene):
    if scene == "valley":
        snapshot = page.evaluate("ThirstTrail.snapshot()")
        assert snapshot["screen"] == "village"
    else:
        snapshot = page.evaluate("TrailCanyon.snapshot()" if scene == "canyon" else "TrailCoast.snapshot()")
        assert snapshot["waterRestored"], snapshot
    assert snapshot["renderer"] == "3d", snapshot
    return snapshot


def graphics_status(page, scene):
    api = "ThirstTrail" if scene == "valley" else "TrailCanyon" if scene == "canyon" else "TrailCoast"
    return page.evaluate(api+".snapshot().graphics || null")


def render_scene(browser, url, site, out, scene, args):
    context = browser.new_context(viewport={"width": args.width, "height": args.height},
                                  reduced_motion="reduce" if args.reduced else "no-preference",
                                  device_scale_factor=1)
    local_three(context)
    if scene != "valley":
        isolate_valley(context, site)
    context.add_init_script(seed(args.presets[0]))
    errors, logs, assets = [], [], []
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: logs.append({"type": message.type, "text": message.text}))
    page.on("response", lambda response: assets.append({"status": response.status, "url": response.url})
            if response.status >= 400 else None)
    page.add_init_script("window.__graphicsContextLost=false;document.addEventListener('webglcontextlost',()=>window.__graphicsContextLost=true,true);")
    result = {"scene": scene, "presets": []}
    try:
        print("START graphics", args.label, scene, flush=True)
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("!!window.ThirstTrail && !!window.TrailCanyon && !!window.TrailCoast")
        selector, stage = start_scene(page, scene)
        if not args.baseline:
            api = "ThirstTrail" if scene == "valley" else "TrailCanyon" if scene == "canyon" else "TrailCoast"
            page.wait_for_function("api=>{const g=window[api].snapshot().graphics;return g&&g.pbr&&g.pbr.loaded>0}",
                                   arg=api, timeout=60000)
        page.wait_for_timeout(1800)
        for i, preset in enumerate(args.presets):
            if i:
                set_preset(page, preset)
                page.wait_for_timeout(1000)
            assert_scene(page, scene)
            page.locator(stage).scroll_into_view_if_needed()
            metrics = canvas_metrics(page, selector)
            status = graphics_status(page, scene)
            result["presets"].append({"preset": preset, **metrics, "graphics": status})
            if not args.baseline:
                assert status["quality"] == preset, status
                assert status["pbr"]["failed"] == 0, status
                assert status["waterMaterials"] > 0 and status["skyReflections"], status
                assert status["postFX"] == (preset in ["high", "ultra"]), status
            page.screenshot(path=str(out / (scene+"-"+preset+".png")), timeout=90000)
            print("CAPTURE", scene, preset, metrics, flush=True)
        if args.live_check:
            before = canvas_metrics(page, selector)
            set_preset(page, "low")
            page.wait_for_timeout(800)
            low = canvas_metrics(page, selector)
            set_preset(page, "high")
            page.wait_for_timeout(800)
            high = canvas_metrics(page, selector)
            result["live"] = {"before": before, "low": low, "high": high}
            if not args.baseline:
                assert high["ratio"] > low["ratio"] * 1.2, result["live"]
            page.locator("#graphicsButton").click()
            effects = page.locator("#effectsToggle")
            if effects.is_checked():
                effects.uncheck()
            page.locator("#graphicsClose").click()
            page.wait_for_timeout(800)
            assert_scene(page, scene)
            status = graphics_status(page, scene)
            result["effectsOff"] = status
            if not args.baseline:
                assert not status["postFX"] and status["waterMaterials"] > 0, status
            page.locator(stage).scroll_into_view_if_needed()
            page.screenshot(path=str(out / (scene+"-effects-off.png")), timeout=90000)
        result["snapshot"] = assert_scene(page, scene)
        bad_logs = [entry for entry in logs if entry["type"] == "error" or
                    any(word in entry["text"] for word in ["Shader Error", "VALIDATE_STATUS", "INVALID_OPERATION", "INVALID_ENUM", "INVALID_VALUE", "INVALID_FRAMEBUFFER", "graphics fallback", "renderer stopped", "3D unavailable"])]
        assert not errors, errors
        assert not bad_logs, bad_logs
        assert not assets, assets
        assert not page.evaluate("window.__graphicsContextLost"), "WebGL context lost"
        print("PASS graphics", scene, args.label, flush=True)
    except Exception:
        page.screenshot(path=str(out / (scene+"-failure.png")), timeout=90000)
        raise
    finally:
        result.update({"errors": errors, "logs": logs, "assetErrors": assets})
        (out / (scene+"-report.json")).write_text(json.dumps(result, indent=2))
        context.close()


def mobile_smoke(browser, url, out):
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                  has_touch=True, reduced_motion="reduce")
    context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
    context.route("https://esm.sh/**", lambda route: route.abort())
    context.add_init_script(seed("low"))
    page = context.new_page()
    errors=[]
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_function("!!window.TrailCoast")
    page.screenshot(path=str(out / "mobile-title.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Title overflows"
    page.locator("#coastChapter").click()
    page.locator("#coastInteract").click()
    page.screenshot(path=str(out / "mobile-coast-puzzle.png"))
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Puzzle overflows"
    assert not errors, errors
    context.close()
    print("PASS mobile presentation", flush=True)


def cinematic_smoke(browser, url, out):
    """Small actual-GPU regression for custom shader compilation and disposal."""
    html = r'''<!doctype html><html><head><base href="/">
      <link rel="icon" href="favicon.svg"><script src="surface-detail.js"></script>
      <script src="cinematic-renderer.js"></script></head><body style="margin:0">
      <script type="module">
      import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
      const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(640,480);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
      document.body.append(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color(0xa6cacf);
      const camera=new THREE.PerspectiveCamera(48,640/480,.1,100);camera.position.set(5,4,6);camera.lookAt(0,.4,0);
      scene.add(new THREE.HemisphereLight(0xe6f7ff,0x645e42,1.5));
      const sun=new THREE.DirectionalLight(0xffdfb1,3);sun.position.set(-5,8,6);scene.add(sun);
      const ocean=new THREE.MeshStandardMaterial({color:0x399eb2,roughness:.2,metalness:.05});ocean.name='Ocean water';
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(12,12,10,10),ocean);plane.rotation.x=-Math.PI/2;scene.add(plane);
      const stone=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
      const cube=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),stone);cube.position.y=1;scene.add(cube);
      const cinema=TrailCinematic.create(THREE,{renderer,scene,camera,chapter:'coast'});
      cinema.configure({preset:'high',effects:true});cinema.surfaces.apply(stone,'rock',[1,1],0xdcc5a3,.45);
      window.graphicsSmoke={status:()=>cinema.status(),sample(){
        cinema.update(4,{effects:true,reduced:false});cinema.render();
        const gl=renderer.getContext(),samples=[];
        for(const [x,y] of [[80,80],[320,240],[560,400],[320,100],[220,300]]){
          const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);samples.push(Array.from(pixel));
        }return samples;
      },dispose(){
        let disposed=0;const maps=new Set([stone.map,stone.normalMap,stone.roughnessMap]);
        for(const map of maps)map.addEventListener('dispose',()=>disposed++);
        cinema.dispose();const result={environmentRestored:scene.environment===null,maps:maps.size,disposed};
        cube.geometry.dispose();plane.geometry.dispose();stone.dispose();ocean.dispose();renderer.dispose();return result;
      }};
      let ticks=0;function frame(t){cinema.update(t/1000,{effects:true,reduced:false});cinema.render();
        if(++ticks>3)window.graphicsSmoke.ready=true;window.__smokeRaf=requestAnimationFrame(frame)}requestAnimationFrame(frame);
      </script></body></html>'''
    path = out / "smoke.html";path.write_text(html)
    context=browser.new_context(viewport={"width":640,"height":480})
    local_three(context)
    page=context.new_page();errors=[];logs=[];asset_errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.on("console",lambda message:logs.append({"type":message.type,"text":message.text}))
    page.on("response",lambda response:asset_errors.append({"status":response.status,"url":response.url}) if response.status>=400 else None)
    report={}
    try:
        page.goto(url+"/"+str(path.relative_to(ROOT)),wait_until="domcontentloaded")
        page.wait_for_function("window.graphicsSmoke?.ready && graphicsSmoke.status().pbr.loaded>0",timeout=60000)
        status=page.evaluate("graphicsSmoke.status()")
        samples=page.evaluate("graphicsSmoke.sample()")
        page.screenshot(path=str(out/"smoke.png"))
        assert status["postFX"] and status["skyReflections"] and status["waterMaterials"]==1,status
        assert status["pbr"]["loaded"]==1 and status["pbr"]["failed"]==0,status
        assert len({tuple(pixel[:3]) for pixel in samples})>1,samples
        assert any(max(pixel[:3])>20 for pixel in samples),samples
        page.evaluate("cancelAnimationFrame(window.__smokeRaf)")
        disposal=page.evaluate("graphicsSmoke.dispose()")
        assert disposal["environmentRestored"] and disposal["maps"]==disposal["disposed"]==3,disposal
        bad_logs=[message for message in logs if message["type"]=="error" or any(word in message["text"] for word in ["Shader Error","VALIDATE_STATUS","INVALID_OPERATION","INVALID_FRAMEBUFFER"])]
        assert not errors and not bad_logs and not asset_errors,(errors,bad_logs,asset_errors)
        report={"status":status,"pixels":samples,"disposal":disposal,"errors":errors,"logs":logs,"assetErrors":asset_errors}
        print("PASS cinematic WebGL smoke: PBR maps, water shader, environment, High post-pass, nonblank pixels and disposal",flush=True)
    finally:
        (out/"smoke-report.json").write_text(json.dumps(report or {"errors":errors,"logs":logs,"assetErrors":asset_errors},indent=2))
        context.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=ROOT)
    parser.add_argument("--label", default="polished")
    parser.add_argument("--scenes", default="valley,canyon,coast")
    parser.add_argument("--presets", default="low")
    parser.add_argument("--width", type=int, default=1360)
    parser.add_argument("--height", type=int, default=1000)
    parser.add_argument("--browser", default=os.environ.get("CHROMIUM_PATH"))
    parser.add_argument("--live-check", action="store_true")
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--reduced", action="store_true")
    parser.add_argument("--mobile", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    args=parser.parse_args();args.presets=args.presets.split(",")
    site=args.site.resolve();out=ROOT/"work"/"graphics-qa"/args.label;out.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(QuietServer,directory=str(site)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=args.browser or shutil.which("chromium") or shutil.which("google-chrome"),
                                      headless=True,args=["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
            if args.smoke:
                cinematic_smoke(browser,url,out)
            else:
                for scene in args.scenes.split(","):
                    if scene:render_scene(browser,url,site,out,scene,args)
                if args.mobile:mobile_smoke(browser,url,out)
            browser.close()
    finally:
        server.shutdown()


if __name__=="__main__":main()
