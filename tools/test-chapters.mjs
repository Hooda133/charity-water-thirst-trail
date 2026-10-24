#!/usr/bin/env node
// Thirst Trail 2.0 — gameplay, chapter gate, pressure valves, saving and restart regression.
// No browser, dependencies or internet required. Live 3D rendering is checked separately.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
const root=resolve(import.meta.dirname,"..");
const scripts={
  progress:readFileSync(resolve(root,"progression.js"),"utf8"),
  valley:readFileSync(resolve(root,"script.js"),"utf8"),
  canyon:readFileSync(resolve(root,"canyon.js"),"utf8")
};
const html=readFileSync(resolve(root,"index.html"),"utf8");
const css=readFileSync(resolve(root,"canyon.css"),"utf8");
for(const js of Object.values(scripts))new Function(js);
assert.ok(html.indexOf('src="progression.js"')<html.indexOf('src="script.js"'));
assert.ok(html.indexOf('src="script.js"')<html.indexOf('src="canyon.js"'));
assert.ok(css.includes(".canyon-stage") && css.includes(".chapter-select-grid"));
for(const id of ["canyonSound","canyonGraphics","canyonScenic","canyonHelp","canyonRestart",
  "canyonDaypart","canyonImpactBurst","canyonEnergyMeter"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing Canyon feature control "+id);
}
assert.match(scripts.valley,/trail:audio/,"Valley sound preferences must sync with Canyon");
assert.match(scripts.valley,/trail:graphics/,"Valley graphics settings must broadcast updates");
assert.match(scripts.canyon,/sound\.cue\("quest"\)/,"Quest sound effect missing");
assert.match(scripts.canyon,/sound\.cue\("victory"\)/,"Victory fanfare missing");
assert.match(scripts.canyon,/applyCanyonGraphics\(next\)/,"Live graphics update missing");
assert.match(scripts.canyon,/canyonDaypart\(state\.elapsed\)/,"Canyon day-night cycle missing");
assert.match(scripts.canyon,/movingNow&&state\.scenic/,"Walking must exit scenic mode to keep hero visible");
assert.ok(idsPlaceholder());
function idsPlaceholder(){
  // New camera exploration controls must remain wired in both chapters.
  assert.match(html, /id="valleyCameraReset"/);
  assert.match(html, /id="canyonCameraReset"/);
  assert.match(html, /DRAG TO EXPLORE/);
  assert.match(html, /DRAG TO LOOK AROUND/);
  for(const source of [scripts.valley,scripts.canyon]){
    assert.match(source,/pointerdown/);
    assert.match(source,/pointermove/);
    assert.match(source,/pointerup/);
    assert.match(source,/setPointerCapture/);
    assert.match(source,/suppress/);
    assert.match(source,/recenterCamera/);
    assert.match(source,/(?:key|k)==="c"/);
  }
  assert.match(scripts.valley,/else if\(freeCamera\)/);
  assert.match(scripts.valley,/freeTarget\.addScaledVector/);
  assert.match(scripts.valley,/cameraYaw/);
  assert.match(scripts.canyon,/cameraTarget\.set\(clamp\(baseX\+pan\.x/);
  return true;
}
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for(const source of [scripts.canyon,scripts.valley]){
 const refs=[...new Set([...source.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]))];
 assert.deepEqual(refs.filter(name=>!ids.has(name)),[],"Missing referenced HTML element");
}
const values=new Map(),events={},registry=new Map();
const Event=class{constructor(type){this.type=type;}};
const storage={getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,String(v));}};
const frameCtx=new Proxy({createLinearGradient(){return {addColorStop(){}};}},{get(obj,k){return obj[k]||(()=>{});}});
function node(id){
 const classes=new Set();
 return {
  id,textContent:"",innerHTML:"",dataset:{},hidden:false,
  style:{setProperty(name,value){this[name]=value;}},children:[],listeners:{},
  classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);}},
  getContext(){return frameCtx;},focus(){},append(...children){this.children.push(...children);},
  replaceChildren(){this.children=[];},setAttribute(){},
  addEventListener(name,fn){this.listeners[name]=fn;},
  getBoundingClientRect(){return {width:1000,height:610,left:0,top:0};}
 };
}
const document={
 getElementById(id){if(!registry.has(id))registry.set(id,node(id));return registry.get(id);},
 createElement:node,querySelectorAll(){return [];},addEventListener(){}
};
const window={
 addEventListener(name,fn){(events[name]??=[]).push(fn);},
 dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);},
 scrollTo(){}
};
const scheduledFrames=[];
const sandbox={window,document,localStorage:storage,Event,
 performance:{now(){return 1000;}},requestAnimationFrame(fn){scheduledFrames.push(fn);return 1;},console};
runInNewContext(scripts.progress,sandbox);
const progress=window.TrailProgress;
assert.ok(progress);
assert.equal(progress.unlocked("canyon"),false);
assert.deepEqual([...progress.snapshot().unlocked],["valley"]);
progress.save("valley",{x:410,score:123,energy:76,done:["elder"]});
assert.equal(progress.saved("valley").score,123);
assert.equal(progress.complete("valley"),true);
assert.equal(progress.saved("valley"),null);
assert.equal(progress.unlocked("canyon"),true);
// Replace the graphics invocation in this isolated test copy, never in the game.
const noGraphics=scripts.canyon.replace("save();buildWorld();","save(); /* isolated deterministic test */");
const testCode=noGraphics.replace(/\}\)\(\);\s*$/,
  'window.canyonTest={get:()=>state,interact,pressure:currentPressure,safe:pressureSafe};\n})();');
runInNewContext(testCode,sandbox);
const canyon=window.TrailCanyon,test=window.canyonTest;
const select=()=>document.getElementById("canyonModalOptions").children;
function go(key){
 const p={
  surveyor:[165,270],kit:[305,455],valves:[390,165],
  span:[700,365],cistern:[820,175]
 }[key];
 const state=test.get();
 state.x=p[0];state.y=p[1];test.interact();
}
canyon.launch();
assert.equal(canyon.snapshot().active,true);
assert.equal(document.getElementById("canyonDaypart").textContent,"☀️ CANYON MORNING");
document.getElementById("canyonScenic").listeners.click();
assert.equal(test.get().scenic,true,"Scenic camera should toggle on");
document.getElementById("canyonScenic").listeners.click();
assert.equal(test.get().scenic,false,"Scenic camera should toggle off");
document.getElementById("canyonSound").listeners.click();
assert.equal(storage.getItem("thirstTrailSound"),"false","Canyon mute must persist across chapters");
document.getElementById("canyonSound").listeners.click();
assert.equal(storage.getItem("thirstTrailSound"),"true","Canyon sound must re-enable");
document.getElementById("canyonHelp").listeners.click();
assert.equal(document.getElementById("canyonModalTitle").textContent,"Your Canyon expedition guide");
select()[0].listeners.click();
assert.equal(test.get().modal,false,"Closing Canyon help should resume play");
// Regression: Level 2 character moves independently of the free-camera state.
const startX=canyon.snapshot().x;
test.get().keys.add("d");
for(let i=1;i<=9;i++){
 const tick=scheduledFrames.shift();
 assert.equal(typeof tick,"function","Canyon must keep rendering frames");
 tick(1000+i*50);
}
test.get().keys.delete("d");
assert.ok(canyon.snapshot().x>startX+15,"Canyon player must move on D key");
go("surveyor");select()[0].listeners.click();
assert.ok(canyon.snapshot().done.includes("surveyor"));
assert.equal(document.getElementById("canyonImpactBurst").hidden,false,
  "Canyon quests should show the same impact feedback as Chapter 1");
go("kit");select()[0].listeners.click();
assert.ok(canyon.snapshot().done.includes("kit"));
go("valves");assert.equal(test.safe(),false);
const energyBefore=test.get().energy;
select()[0].listeners.click();
assert.ok(test.get().energy<energyBefore,"Wrong pressure should cost energy");
const panel=document.getElementById("canyonModalExtra");
for(const [i,count] of [[0,2],[1,2],[2,1]]){
 for(let j=0;j<count;j++){
  const pressure=panel.children[0];
  pressure.children[i+1].children[1].listeners.click();
 }
}
assert.equal(test.pressure(),69);
assert.equal(test.safe(),true);
select()[0].listeners.click();
assert.ok(canyon.snapshot().done.includes("valves"));
go("span");
const rootPanel=document.getElementById("canyonModalExtra");
rootPanel.children[0].children[3].listeners.click(); // wrong order
assert.equal(canyon.snapshot().repairStep,0);
rootPanel.children[0].children[0].listeners.click();
rootPanel.children[0].children[1].listeners.click();
assert.equal(canyon.snapshot().repairStep,2);
select()[0].listeners.click(); // Save and leave the current challenge
const saved=progress.saved("canyon");
assert.equal(saved.repairStep,2);
canyon.suspend();canyon.launch(); // Automatically restore checkpoint
assert.equal(canyon.snapshot().repairStep,2);
assert.ok(canyon.snapshot().done.includes("valves"));
go("span");
rootPanel.children[0].children[2].listeners.click();
rootPanel.children[0].children[3].listeners.click();
assert.ok(canyon.snapshot().done.includes("span"));
go("cistern");
const energyBeforeWrong=test.get().energy;
select()[1].listeners.click();
assert.ok(test.get().energy<energyBeforeWrong);
select()[0].listeners.click();
assert.equal(canyon.snapshot().finished,true);
assert.ok(document.getElementById("canyonModalBackdrop").classList.contains("canyon-victory-backdrop"),
  "Finishing the water-safety quest must activate the victory celebration");
assert.ok(document.getElementById("canyonModalExtra").children.length>=2,
  "Victory modal must include a celebratory banner and confetti");
assert.match(scripts.canyon,/missionLabelLayer\.append\(label\)/,
  "Mission captions must be screen-space DOM labels, not depth-tested 3D sprites");
assert.match(scripts.canyon,/labelProjected\.copy\(m\.anchor\)\.project\(camera\)/,
  "Mission labels must track their 3D world markers");
assert.match(scripts.canyon,/keepExplorerVisible\(time,delta,baseX,baseZ\)/,
  "Camera must fade rocks blocking the moving explorer");
assert.match(css,/\.canyon-world-label\[hidden\]/,
  "Offscreen mission labels must hide cleanly");
assert.match(scripts.canyon,/heroProjected\.set\(baseX,1\.40,baseZ\)\.project\(camera\)/,
  "Follow camera must guard against losing the explorer offscreen");
assert.equal(canyon.snapshot().active,false);
assert.ok(progress.snapshot().completed.includes("canyon"));
assert.equal(progress.saved("canyon"),null);
assert.equal(canyon.snapshot().done.length,5);
assert.equal(document.getElementById("canyonBurstTitle").textContent,"The canyon has water again!",
  "End-of-chapter victory should replace the ordinary impact badge");
console.log("✓ Versioned chapter unlocking and Valley checkpoint storage");
console.log("✓ Five canyon quests, 69 kPa valve solution, unsafe pressure penalty");
console.log("✓ Aqueduct repair order, checkpoint restore, safety quiz and chapter completion");
console.log("✓ Existing Valley JavaScript and new chapter UI references validated");
