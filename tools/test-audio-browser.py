#!/usr/bin/env python3
"""Verify that the live settings UI controls Web Audio, persists across reloads,
and never starts audio on page load. Uses a fake output device to avoid sound.
"""
import functools
import http.server
from pathlib import Path
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "work" / "audio-qa"

class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

FAKE_AUDIO = r"""
(() => {
  window.__sfxLog = {contexts:0,starts:[],stops:[],volumes:[]};
  class Param {
    constructor(){this.value=0;}
    setValueAtTime(v){this.value=v;}
    linearRampToValueAtTime(v){this.value=v;}
    exponentialRampToValueAtTime(v){this.value=v;}
    setTargetAtTime(v){this.value=v;window.__sfxLog.volumes.push(v);}
  }
  class FakeGain {
    constructor(){this.gain=new Param();}
    connect(out){return out;}
    disconnect(){}
  }
  class FakeOscillator {
    constructor(){this.frequency=new Param();this.type="sine";}
    connect(out){return out;}
    disconnect(){}
    start(t){window.__sfxLog.starts.push(t);}
    stop(t){window.__sfxLog.stops.push(t);}
  }
  class FakeAudioContext {
    constructor(){this.state="running";this.currentTime=12;this.destination={};window.__sfxLog.contexts++;}
    createGain(){return new FakeGain();}
    createOscillator(){return new FakeOscillator();}
    resume(){return Promise.resolve();}
    close(){return Promise.resolve();}
  }
  window.AudioContext=FakeAudioContext;
  window.webkitAudioContext=FakeAudioContext;
})();
"""

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),
        functools.partial(QuietServer,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"),
                headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            try:
                context=browser.new_context(viewport={"width":1000,"height":780})
                # 3D dependencies may be unavailable in CI; 2D gameplay and audio
                # settings must still work without these external network calls.
                context.route("https://cdn.jsdelivr.net/**",lambda route:route.abort())
                context.route("https://esm.sh/**",lambda route:route.abort())
                context.add_init_script(FAKE_AUDIO)
                page=context.new_page()
                errors=[]
                page.on("pageerror",lambda e:errors.append(str(e)))
                page.goto(url,wait_until="domcontentloaded")
                page.wait_for_function("!!window.TrailAudioEngine && !!window.ThirstAudio")
                initial=page.evaluate("()=>({audio:TrailAudioEngine.status(),created:__sfxLog.contexts,started:__sfxLog.starts.length})")
                assert initial["audio"]["enabled"] is True, initial
                assert initial["created"]==0 and initial["started"]==0, "No sounds should autoplay"
                page.locator("#graphicsButton").click()
                assert page.locator("#graphicsPanel").is_visible()
                assert page.locator("#soundEnabledToggle").is_checked()
                assert page.locator("#sfxVolumeValue").inner_text()=="55%"
                page.locator("#sfxPreview").click()
                first=page.evaluate("()=>({...__sfxLog,volume:TrailAudioEngine.volume})")
                assert first["contexts"]==1 and len(first["starts"])>=2, first
                assert len(first["starts"])==len(first["stops"]), "Each oscillator must stop"
                assert all(end>start and end-start<1 for start,end in zip(first["starts"],first["stops"]))
                page.locator("#sfxVolume").evaluate("el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));}")
                assert page.locator("#sfxVolumeValue").inner_text()=="30%"
                assert page.evaluate("localStorage.getItem('thirstTrailSfxVolume')")=="0.3"
                assert page.evaluate("TrailAudioEngine.volume")==.3
                page.locator("#soundEnabledToggle").uncheck()
                assert page.locator("#soundButton").get_attribute("aria-pressed")=="false"
                assert page.locator("#sfxPreview").is_disabled()
                before=page.evaluate("__sfxLog.starts.length")
                assert page.evaluate("TrailAudioEngine.play('collect')") is False
                assert page.evaluate("__sfxLog.starts.length")==before
                page.screenshot(path=str(OUTPUT / "muted-settings.png"))
                page.reload(wait_until="domcontentloaded")
                page.wait_for_function("!!window.TrailAudioEngine && !!window.ThirstAudio")
                page.locator("#graphicsButton").click()
                assert not page.locator("#soundEnabledToggle").is_checked(), "Mute preserved after reload"
                assert page.locator("#sfxVolumeValue").inner_text()=="30%", "Volume preserved after reload"
                assert page.evaluate("__sfxLog.contexts")==0, "Reload must never autoplay"
                page.locator("#soundButton").click()
                assert page.locator("#soundEnabledToggle").is_checked()
                assert page.locator("#soundButton").get_attribute("aria-pressed")=="true"
                assert page.locator("#sfxPreview").is_enabled()
                page.locator("#sfxVolume").evaluate("el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));}")
                assert page.locator("#sfxPreview").is_disabled()
                assert page.evaluate("TrailAudioEngine.play('victory')") is False
                assert page.evaluate("localStorage.getItem('thirstTrailSound')")=="true"
                page.locator("#sfxVolume").evaluate("el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));}")
                assert page.locator("#sfxPreview").is_enabled()
                page.wait_for_timeout(110) # Allow preview cooldown to expire
                page.locator("#sfxPreview").click()
                assert page.evaluate("__sfxLog.starts.length")>0
                assert page.evaluate("TrailAudioEngine.status().ambientLoops") is False
                assert page.evaluate("TrailAudioEngine.status().backgroundMusic") is False
                page.screenshot(path=str(OUTPUT / "sound-panel.png"))
                assert not errors, errors
                print("PASS browser: sound on/off sync, volume slider, preview, no autoplay, reload persistence, zero-volume mute and finite notes",flush=True)
                context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()

if __name__=="__main__":
    main()
