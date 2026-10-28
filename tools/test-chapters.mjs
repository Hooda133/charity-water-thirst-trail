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
const values=new Map(),events={},registry=new Map(),audioEvents=[];
const Event=class{constructor(type){this.type=type;}};
const storage={getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,String(v));}};
const frameCtx=new Proxy({createLinearGradient(){return {addColorStop(){}};}},{get(obj,k){return obj[k]||(()=>{});}});
function node(id){
 const classes=new Set();
 return {
  id,textContent:"",innerHTML:"",dataset:{},attributes:{},hidden:false,style:{},children:[],listeners:{},
  classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);},toggle(n,enabled){if(enabled)classes.add(n);else classes.delete(n);}},
  getContext(){return frameCtx;},focus(){},append(...children){this.children.push(...children);},
  replaceChildren(...children){this.children=[...children];},setAttribute(name,value){this.attributes[name]=String(value);},
  getAttribute(name){return this.attributes[name]??null;},
  addEventListener(name,fn){this.listeners[name]=fn;},
  getBoundingClientRect(){return {width:1000,height:610,left:0,top:0};}
 };
}
const document={
 getElementById(id){if(!registry.has(id))registry.set(id,node(id));return registry.get(id);},
 createElement:node,querySelectorAll(){return [];},addEventListener(){}
};
const window={
 ThirstAudio:{tone(frequency,duration){audioEvents.push({frequency,duration});}},
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
  'window.canyonTest={get:()=>state,interact,pressure:currentPressure,safe:pressureSafe,surface:surfaceHeight};\n})();');
runInNewContext(testCode,sandbox);
const canyon=window.TrailCanyon,test=window.canyonTest;
const select=()=>document.getElementById("canyonModalOptions").children;
function descendants(root){return [root,...root.children.flatMap(descendants)];}
function releaseAction(name){
 const button=descendants(document.getElementById("canyonModalExtra")).find(el=>
  el.dataset.releaseAction===name||el.getAttribute("data-release-action")===name);
 assert.ok(button,"Missing water-measuring control: "+name);
 if(!button.disabled)button.listeners.click();
}
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
assert.equal(canyon.snapshot().waterRestored,false,"Water release waits for final safety inspection");
assert.equal(document.getElementById("canyonCelebration").hidden,true);
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
events.keydown[0]({key:"d",target:{tagName:"BUTTON"}});
assert.ok(test.get().keys.has("d"),"WASD still works after a toolbar button keeps focus");
events.keyup[0]({key:"d"});
events.keydown[0]({key:"d",target:{tagName:"INPUT"}});
assert.equal(test.get().keys.has("d"),false,"Editing a control does not move the explorer");
assert.equal(audioEvents.length,0,"Launching and walking in Canyon stay quiet");
assert.equal(test.surface(500,350),.29,"The character stands on the bridge deck");
assert.equal(test.surface(170,425),0,"Trail foot placement stays at ground level");
assert.ok(test.surface(415,350)>0&&test.surface(415,350)<.29,"Bridge entry rises along its access ramp");
go("surveyor");select()[0].listeners.click();
assert.ok(canyon.snapshot().done.includes("surveyor"));
assert.ok(audioEvents.some(e=>e.frequency===550)&&audioEvents.some(e=>e.frequency===750),"Interactions reuse Chapter 1 feedback tones");
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
assert.equal(canyon.snapshot().cisternSafetyPassed,true,"Safety inspection unlocks the measuring puzzle");
assert.equal(canyon.snapshot().finished,false,"The safety answer alone cannot complete the chapter");
assert.equal(canyon.snapshot().waterRestored,false);
assert.equal(canyon.snapshot().done.length,4,"Cistern reward waits for the release puzzle");
assert.equal(rootPanel.children[0].className,"canyon-release-puzzle");
const energyBeforeRelease=test.get().energy,scoreBeforeRelease=test.get().score;
select()[0].listeners.click();
assert.equal(canyon.snapshot().finished,false,"An unmeasured release is rejected");
assert.equal(test.get().energy,energyBeforeRelease,"Trying the release puzzle does not drain energy");
assert.equal(test.get().score,scoreBeforeRelease,"An unsolved release does not award points");
releaseAction("fill-large");releaseAction("pour-large");
assert.deepEqual([...canyon.snapshot().releaseBasins],[2,3]);
select()[2].listeners.click();canyon.suspend();canyon.launch();
assert.equal(canyon.snapshot().cisternSafetyPassed,true,"The safety result survives reload");
assert.deepEqual([...canyon.snapshot().releaseBasins],[2,3],"Partially measured water survives reload");
go("cistern");
assert.equal(rootPanel.children[0].className,"canyon-release-puzzle","Resume returns directly to the measuring puzzle");
releaseAction("return-small");releaseAction("pour-large");releaseAction("fill-large");releaseAction("pour-large");
assert.deepEqual([...canyon.snapshot().releaseBasins],[4,3],"The two chamber sizes can measure exactly four litres");
assert.equal(canyon.snapshot().finished,false,"Measured water waits for the player's release action");
select()[0].listeners.click();
assert.equal(canyon.snapshot().finished,true);
assert.equal(canyon.snapshot().active,false);
assert.ok(progress.snapshot().completed.includes("canyon"));
assert.equal(progress.saved("canyon"),null);
assert.equal(canyon.snapshot().done.length,5);
assert.equal(canyon.snapshot().waterRestored,true,"Completing all objectives restores the water immediately");
assert.equal(rootPanel.children[0].className,"canyon-victory-scene","The ending includes the water celebration scene");
const finalScore=canyon.snapshot().score;
select()[2].listeners.click();
assert.equal(document.getElementById("canyonModalBackdrop").hidden,true,"Watch water reveals the restored world");
assert.equal(document.getElementById("canyonCelebration").hidden,false);
document.getElementById("canyonViewResults").listeners.click();
assert.equal(document.getElementById("canyonModalBackdrop").hidden,false,"Results can be reopened from the restored world");
assert.equal(document.getElementById("canyonCelebration").hidden,true,"Celebration controls do not overlap the dialog");
assert.equal(canyon.snapshot().score,finalScore,"Reopening results never awards the completion bonus again");
// Replaying a completed chapter must preserve both the completion badge and a
// new resumable checkpoint rather than silently disabling all future saves.
select()[1].listeners.click();
assert.equal(canyon.snapshot().done.length,0);
assert.equal(canyon.snapshot().waterRestored,false,"Replay closes the completed water release");
assert.equal(canyon.snapshot().cisternSafetyPassed,false,"Replay resets the safety inspection");
assert.deepEqual([...canyon.snapshot().releaseBasins],[0,0],"Replay resets the measuring chambers");
assert.equal(document.getElementById("canyonCelebration").hidden,true,"Replay clears the celebration");
assert.ok(progress.saved("canyon"),"A completed chapter replay can save");
test.get().x=248;test.get().score=75;
canyon.suspend();canyon.launch();
assert.equal(canyon.snapshot().x,248);
assert.equal(canyon.snapshot().score,75);
assert.ok(progress.snapshot().completed.includes("canyon"));
// A damaged checkpoint is discarded field by field without crashing launch.
canyon.suspend(); // Do not overwrite the fixture with the live replay.
progress.save("canyon",{x:500,y:50,energy:"invalid",score:null,done:"broken",repairStep:Infinity});
canyon.launch();
assert.equal(canyon.snapshot().x,170,"A saved position inside the gorge is reset safely");
assert.equal(canyon.snapshot().done.length,0);
assert.equal(canyon.snapshot().energy,100);
assert.equal(canyon.snapshot().repairStep,0);
console.log("✓ Versioned chapter unlocking and Valley checkpoint storage");
console.log("✓ Five canyon quests, 69 kPa valve solution, unsafe pressure penalty");
console.log("✓ Aqueduct repair order, checkpoint restore, safety quiz and chapter completion");
console.log("✓ Final water-measuring puzzle gates celebration, saves partial progress and resets on replay");
console.log("✓ Existing Valley JavaScript and new chapter UI references validated");
console.log("✓ Completed-chapter replay saving, restore and malformed-checkpoint recovery");
console.log("✓ Immediate water restoration, watch-water/results controls, score stability and celebration reset");
