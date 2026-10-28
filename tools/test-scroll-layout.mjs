#!/usr/bin/env node
// Scroll-aware layout and input contract tests: no browser dependencies.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const root=new URL("../",import.meta.url);
const read=name=>readFileSync(new URL(name,root),"utf8");
const source=read("scroll-layout.js");
new Function(source);

let tall=true,wide=true,height=930,frame=0,worldHeight=560;
const events=new Map(),pending=[],elements=new Map();
function classList(){
  const list=new Set();
  return {
    toggle(name,on){if(on)list.add(name);else list.delete(name);},
    contains(name){return list.has(name)}
  };
}
function element(className,boxHeight){
  return {name:className,height:boxHeight,hidden:false,classList:classList(),
    getBoundingClientRect(){return {height:this.height}}};
}
for(const [screenId,worldName,sidebarName] of [
  ["gameScreen",".canvas-column",".sidebar"],
  ["canyonScreen",".canyon-stage",".canyon-sidebar"],
  ["coastScreen",".coast-stage",".coast-sidebar"]
]){
  const world=element(worldName,worldHeight);
  const sidebar=element(sidebarName,1500);
  const screen=element(screenId,0);
  screen.querySelector=name=>name===worldName?world:name===sidebarName?sidebar:null;
  elements.set(screenId,{world,sidebar,screen});
}
const observers=[],mutations=[];
class ResizeObserverMock {
  constructor(fn){this.fn=fn;observers.push(this);this.targets=[];}
  observe(node){this.targets.push(node);}
}
class MutationObserverMock {
  constructor(fn){this.fn=fn;mutations.push(this);this.targets=[];}
  observe(node,opts){this.targets.push({node,opts});}
}
const window={
  innerHeight:height,
  matchMedia:()=>({get matches(){return wide;}}),
  requestAnimationFrame:cb=>{pending.push(cb);return pending.length;},
  addEventListener:(event,fn)=>events.set(event,fn),
  visualViewport:{addEventListener:(event,fn)=>events.set("visual-"+event,fn)}
};
const document={
  readyState:"complete",
  addEventListener:(event,fn)=>events.set(event,fn),
  getElementById:id=>elements.get(id)?.screen||null
};
runInNewContext(source,{window,document,ResizeObserver:ResizeObserverMock,
  MutationObserver:MutationObserverMock});
const api=window.TrailScrollLayout;
assert.ok(api);
assert.equal(pending.length,1,"first layout measurement batches into one frame");
const flush=()=>{
  while(pending.length){const cb=pending.shift();cb(frame++);}
};
flush();
assert.equal(api.status().length,3);
assert.ok(api.status().every(x=>x.sticky),"fitting world pins beside much taller quest sidebar");
assert.equal(observers.length,1);
assert.equal(observers[0].targets.length,6);
assert.equal(mutations[0].targets.length,3);
for(const row of mutations[0].targets)
  assert.deepEqual(Array.from(row.opts.attributeFilter),["hidden","class"]);

// Shrink browser: scrolling stays normal and the pinned stage is removed.
window.innerHeight=690;
wide=false;events.get("resize")();flush();
assert.ok(api.status().every(x=>!x.sticky),"narrow or low screen must use standard flow");
window.innerHeight=930;wide=true;events.get("resize")();flush();
assert.ok(api.status().every(x=>x.sticky));

// A huge game scene must never stick half off-screen.
elements.get("gameScreen").world.height=960;
observers[0].fn();flush();
assert.equal(api.status()[0].sticky,false);
assert.equal(api.status()[1].sticky,true);
elements.get("gameScreen").world.height=560;

// A short quest log needs no sticky state.
elements.get("coastScreen").sidebar.height=580;
api.refresh();flush();
assert.equal(api.status()[2].sticky,false);
elements.get("coastScreen").sidebar.height=1500;

// Switching chapters stops pinning hidden worlds.
elements.get("canyonScreen").screen.hidden=true;
mutations[0].fn();flush();
assert.equal(api.status()[1].sticky,false);
assert.equal(api.status()[1].active,false);
elements.get("canyonScreen").screen.hidden=false;
api.refresh();api.refresh();
assert.equal(pending.length,1,"repeated resize or mutation events coalesce");
flush();
assert.ok(api.status().every(row=>row.sticky));

// Check deployed HTML loads the scroll helper only after chapter markup.
const html=read("index.html");
assert.ok(html.includes('src="scroll-layout.js"'));
assert.ok(html.indexOf('src="coast.js"')<html.indexOf('src="scroll-layout.js"'));
const css=read("cinematic-ui.css");
assert.match(css,/\.scroll-sticky-active/);
assert.match(css,/min-width:1100px/);
assert.match(css,/touch-action:pan-y pinch-zoom/);
for(const id of ["gameCanvas","world3dCanvas","canyonCanvas","coastCanvas"])
  assert.ok(css.includes("#"+id),"mobile page scroll coverage: "+id);
const valley=read("script.js"),canyon=read("canyon.js"),coast=read("coast.js");
for(const [label,code] of [["Valley",valley],["Canyon",canyon],["Coast",coast]]){
  new Function(code);
  assert.ok(code.includes("!event.altKey")||code.includes("!event.altKey"),
    label+" should not steal native mouse-wheel page scrolling");
  assert.ok(code.includes("event.ctrlKey")&&code.includes("event.metaKey"),
    label+" should preserve browser zoom");
  assert.match(code,/canvasFocused/,"arrow keys only captured while canvas is focused: "+label);
}
assert.ok(html.includes("ALT + SCROLL ZOOM"),"game instructions explain deliberate zoom");
assert.equal(source.includes("localStorage"),false,"scroll layout cannot touch player data");
assert.equal(source.includes("preventDefault"),false,"layout controller must not prevent page scroll");
console.log("PASS: responsive 3-world sticky state, viewport bounds, hidden chapters, mobile touch scrolling, native wheel, browser zoom, and keyboard navigation");
