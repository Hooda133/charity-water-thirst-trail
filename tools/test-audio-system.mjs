#!/usr/bin/env node
// Deterministic Web Audio contract tests; works offline without speakers.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=name=>readFileSync(resolve(root,name),"utf8");
const source=read("audio-system.js");
new Function(source);
const required=["tap","interact","collect","reward","confirm","mistake","warning",
  "repair","water","deliver","build","victory","failure","preview"];
let clock=1000;
const makeHarness=(initial={}, options={})=>{
  const memory=new Map(Object.entries(initial));
  const voices=[],targets=[],filters=[];
  let contextCount=0;
  class FakeParameter {
    constructor(){this.value=0;}
    setValueAtTime(value,time){assert.ok(Number.isFinite(time));this.value=value;if(this.initial===undefined)this.initial=value;}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);assert.ok(Number.isFinite(time));this.value=value;}
    setTargetAtTime(value,time,constant){assert.ok(Number.isFinite(value)&&constant>0);this.value=value;targets.push(value);}
  }
  class FakeGain {
    gain=new FakeParameter();
    connect(destination){assert.ok(destination);return destination;}
    disconnect(){}
  }
  class FakeFilter {
    constructor(){this.frequency=new FakeParameter();this.Q={value:0};this.type="lowpass";filters.push(this);}
    connect(destination){assert.ok(destination);return destination;}
    disconnect(){}
  }
  class FakeOscillator {
    frequency=new FakeParameter();
    type="sine";
    onended=null;
    connect(destination){assert.ok(destination);return destination;}
    disconnect(){}
    start(time){if(options.failStart)throw Error("Audio device unavailable");this.started=time;}
    stop(time){assert.ok(time>this.started,"every note must end");assert.ok(time-this.started<1,"no looping or extended audio");this.stopped=time;voices.push(this);}
  }
  class FakeAudioContext {
    constructor(){contextCount++;this.currentTime=10;this.state="running";this.destination={};}
    createGain(){return new FakeGain();}
    createBiquadFilter(){return new FakeFilter();}
    createOscillator(){return new FakeOscillator();}
    resume(){return Promise.resolve();}
    close(){this.state="closed";return Promise.resolve();}
  }
  const window={
    localStorage:{
      getItem:k=>memory.get(k)??null,
      setItem:(key,value)=>memory.set(key,String(value))
    },
    AudioContext:FakeAudioContext
  };
  runInNewContext(source,{window,performance:{now:()=>clock},Date,console});
  return {audio:window.TrailAudioEngine,memory,voices,filters,targets,get contextCount(){return contextCount;}};
};

const h=makeHarness();
assert.equal(h.audio.enabled,true);
assert.equal(h.audio.volume,.55);
assert.equal(h.audio.style,"soft","the gentler sound should be the default even on old installs");
assert.equal(h.contextCount,0,"no audio before first event or button");
assert.equal(h.audio.status().ambientLoops,false);
assert.equal(h.audio.status().backgroundMusic,false);
assert.equal(h.audio.play("not-a-cue"),false);
assert.equal(h.contextCount,0,"invalid actions must not create an AudioContext");
assert.equal(h.audio.play("collect"),true);
assert.equal(h.contextCount,1);
assert.equal(h.voices.length,2);
assert.ok(h.voices.every(v=>v.frequency.initial<=550),"soft cues avoid piercing high notes");
assert.equal(h.filters.length,2,"soft notes use gentle low-pass filters");
assert.equal(h.audio.play("collect"),false,"immediate identical cues are rate-limited");
clock+=100;
assert.equal(h.audio.play("mistake"),true);
assert.equal(h.voices.length,3,"soft mistakes should use a single restrained low note");
assert.equal(h.voices.at(-1).frequency.initial,215);
assert.ok(h.voices.every(v=>Number.isFinite(v.stopped)&&v.stopped>v.started));
h.voices.forEach(v=>v.onended?.());
assert.equal(h.audio.status().activeVoices,0,"oscillators are disposed when finished");
assert.equal(h.audio.setVolume(.25),.25);
assert.equal(h.memory.get("thirstTrailSfxVolume"),"0.25");
assert.equal(h.targets.at(-1),.25);
assert.equal(h.audio.setEnabled(false),false);
assert.equal(h.memory.get("thirstTrailSound"),"false");
assert.equal(h.targets.at(-1),0,"mute must immediately silence output");
const before=h.voices.length;
clock+=100;
assert.equal(h.audio.play("victory"),false,"no victory audio while muted");
assert.equal(h.audio.tone(700,.1),false,"legacy cues obey mute too");
assert.equal(h.voices.length,before);
const preserved=makeHarness(Object.fromEntries(h.memory));
assert.equal(preserved.audio.enabled,false,"prior mute preference retained on reload");
assert.equal(preserved.audio.volume,.25,"volume retained independently of mute");
assert.equal(preserved.audio.style,"soft","sound character defaults to soft when not yet saved");
assert.equal(preserved.contextCount,0,"no autoplay on reload");
assert.equal(preserved.audio.setEnabled(true),true);
assert.equal(preserved.audio.setStyle("minimal"),"minimal");
assert.equal(preserved.memory.get("thirstTrailSfxStyle"),"minimal","new style is independently saved");
assert.equal(preserved.audio.setStyle("unknown"),"minimal","invalid styles do not change preferences");
assert.equal(preserved.audio.style,"minimal");
clock+=100;
for(const name of required){
  assert.equal(preserved.audio.play(name),true,name+" cue must exist");
  preserved.voices.splice(0).forEach(v=>v.onended?.());
  clock+=100;
}
assert.equal(preserved.audio.setStyle("classic"),"classic");
assert.equal(preserved.audio.style,"classic");
preserved.voices.splice(0).forEach(v=>v.onended?.());
clock+=150;
assert.equal(preserved.audio.play("collect"),true);
assert.equal(preserved.voices.length,2);
assert.ok(preserved.voices.some(v=>v.frequency.initial>=1000),"classic retains the old bright sound for opt-in use");
assert.equal(preserved.filters.length,16,"classic skips low-pass filter and does not create more");
preserved.voices.splice(0).forEach(v=>v.onended?.());
assert.equal(preserved.audio.setStyle("soft"),"soft");
assert.equal(preserved.audio.setVolume(0),0);
assert.equal(preserved.audio.play("collect"),false,"zero volume must be silent without changing mute");
assert.equal(preserved.audio.setVolume(1),1);
assert.equal(preserved.audio.setVolume(45),1,"invalidly large input clamps safely");
assert.equal(preserved.audio.setVolume(-6),0,"negative input clamps safely");
assert.equal(preserved.audio.setVolume(NaN),0,"nonnumeric input preserves existing volume");
preserved.audio.dispose();
assert.equal(preserved.audio.status().initialized,false);
assert.equal(preserved.audio.status().ambientLoops,false);
assert.equal(preserved.audio.style,"soft");
const restoredStyle=makeHarness(Object.fromEntries(preserved.memory));
assert.equal(restoredStyle.audio.style,"soft","sound character persists through reload");
assert.equal(restoredStyle.contextCount,0,"saved sound character does not trigger autoplay");
const invalidStyle=makeHarness({thirstTrailSfxStyle:"alien",thirstTrailSound:"true"});
assert.equal(invalidStyle.audio.style,"soft","malformed stored sound characters safely fall back to soft");

// Failed starts must not exhaust the voice budget for the rest of the session.
const device={failStart:true},failed=makeHarness({},device);
for(let i=0;i<12;i++){clock+=150;failed.audio.play("collect");}
assert.equal(failed.audio.status().activeVoices,0,"failed audio starts release their voice slots");
device.failStart=false;clock+=150;failed.audio.play("collect");
assert.equal(failed.voices.length,2,"sound recovers when the audio device recovers");
const pending=[...failed.voices];
failed.audio.dispose();
assert.equal(failed.audio.status().activeVoices,0,"dispose releases pending voices immediately");
clock+=150;failed.audio.play("collect");
assert.equal(failed.audio.status().activeVoices,2);
pending.forEach(voice=>voice.onended?.());
assert.equal(failed.audio.status().activeVoices,2,"late old-context events cannot decrement new voices");

const unsupported={localStorage:{getItem:()=>null,setItem(){}}};
runInNewContext(source,{window:unsupported,performance:{now:()=>0},Date,console});
assert.equal(unsupported.TrailAudioEngine.play("collect"),false,"unsupported browser stays playable");
const denied={};
Object.defineProperty(denied,"localStorage",{get(){throw Error("Storage blocked");}});
runInNewContext(source,{window:denied,performance:{now:()=>0},Date,console});
assert.equal(denied.TrailAudioEngine.setVolume(.6),.6,"storage-denied session must still work");
assert.equal(denied.TrailAudioEngine.setEnabled(false),false);
assert.equal(denied.TrailAudioEngine.setStyle("minimal"),"minimal");
assert.equal(denied.TrailAudioEngine.play("preview"),false);

const html=read("index.html");
assert.ok(html.indexOf('src="audio-system.js"')>=0);
assert.ok(html.indexOf('src="audio-system.js"')<html.indexOf('src="script.js"'),
  "audio must initialize before the Valley scripts");
for(const id of ["soundButton","soundEnabledToggle","sfxVolume","sfxVolumeValue","sfxPreview",
  "soundStatus","soundDescription","sfxStyle"]){
  assert.ok(html.includes('id="'+id+'"'),"missing accessible audio control "+id);
}
assert.match(html,/<label class="graphics-field" for="sfxVolume">/);
assert.match(html,/id="sfxVolume"[^>]*type="range"/);
assert.match(html,/No background music or looping audio/);
assert.match(html,/id="sfxStyle"[^>]*aria-describedby="soundDescription"/);
assert.match(html,/value="soft">Soft &amp; natural/);
assert.match(html,/value="minimal">Quiet taps/);
assert.match(html,/value="classic">Classic electronic tones/);

const valley=read("script.js");
assert.match(valley,/audioEngine\?\.setEnabled\(state\.sound\)/,"legacy mute state bridged to new engine");
assert.match(valley,/audioEngine\?\.setVolume/,"saved volume slider wired");
assert.match(valley,/audioEngine\?\.setStyle/,"sound character selector wired");
assert.match(valley,/playCue\("collect"\)/);
assert.match(valley,/playCue\("mistake"\)/);
assert.match(valley,/playCue\("victory"\)/);
assert.match(valley,/get enabled\(\)\{return state\.sound;/);
for(const [name,events] of [
  ["canyon.js",["collect","mistake","repair","victory"]],
  ["coast.js",["collect","mistake","repair","victory"]],
  ["village-life.js",["water","deliver","repair","build"]]
]){
  const script=read(name);
  new Function(script);
  for(const event of events) assert.ok(script.includes('"'+event+'"'),name+" missing "+event+" cue");
}
for(const file of ["audio-system.js","script.js","canyon.js","coast.js","village-life.js"]){
  const text=read(file);
  assert.ok(!/\bsetInterval\s*\(/.test(text),"no repeating audio timer in "+file);
}
console.log("PASS: soft default, minimal and classic sound characters, preserved mute/volume, low-pass warmth, finite cues and all four chapters wired");
