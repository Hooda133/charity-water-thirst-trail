#!/usr/bin/env node
// Regression: player coordinates must respond to keyboard and clicks after graphics merges.
// Runs the actual gameplay/controller IIFE with a mocked DOM and no WebGL.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
const root=resolve(import.meta.dirname,"..");
let script=readFileSync(resolve(root,"script.js"),"utf8");
const begin=script.indexOf("  createWorld(canvas, {");
const end=script.indexOf("  let audioContext = null;",begin);
assert.ok(begin>=0&&end>begin,"Expected asynchronous renderer initialization");
script=script.slice(0,begin)+"  // Skip WebGL initialization; exercise genuine gameplay and movement.\n"+script.slice(end);
// Test-only access to transition state; the shipped source stays read-only.
script=script.replace('window.ThirstTrail={','window.__valleyRegression={getState:()=>state};window.ThirstTrail={');
const handlers=new Map(), nodes=new Map(), frames=[];
let time=1000;
const context2d=new Proxy({},{
 get(target,key) {
   if(key==="createLinearGradient"||key==="createRadialGradient"||key==="createPattern")return ()=>({addColorStop(){}});
   if(key==="measureText")return ()=>({width:20});
   return ()=>{};
 },set(){return true}
});
const node=(id="div")=>{
 const listeners={},attributes=new Map();
 const result={
  id,hidden:id==='graphicsPanel',value:"",checked:false,textContent:"",innerHTML:"",
  style:{},dataset:{},children:[],listeners,attributes,scrollTop:0,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(k,v){attributes.set(k,String(v))},removeAttribute(k){attributes.delete(k)},
  focus(){},blur(){},click(){listeners.click?.({target:result})},
  getContext(){return context2d},
  getBoundingClientRect(){return {width:1000,height:610,left:0,top:0}},
  addEventListener(name,fn){listeners[name]=fn},
  append(...n){this.children.push(...n)},
  replaceChildren(...n){this.children=[...n]},
  querySelector(){return node("nested")},
  querySelectorAll(){return []}
 };
 return result;
};
const document={
 getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)},
 createElement:node,querySelectorAll(){return []},querySelector(){return node()},addEventListener(){}
};
const window={
 TrailProgress:null,
 addEventListener(event,cb){const array=handlers.get(event)||[];array.push(cb);handlers.set(event,array)},
 dispatchEvent(event){for(const cb of handlers.get(event.type)||[])cb(event)},
 scrollTo(){},
 matchMedia(){return {matches:false}}
};
const values=new Map([["thirstTrailTutorial","true"],["thirstTrailSound","false"]]);
const storage={getItem(k){return values.get(k)||null},setItem(k,v){values.set(k,String(v))},removeItem(k){values.delete(k)}};
const sandbox={document,window,localStorage:storage,console,
 performance:{now:()=>time},requestAnimationFrame(fn){frames.push(fn);return frames.length},
 setTimeout(fn){return 1},clearTimeout(){},Event:class{constructor(type){this.type=type}}};
runInNewContext(readFileSync(resolve(root,"progression.js"),"utf8"),sandbox);
runInNewContext(script,sandbox);
const snapshot=()=>window.ThirstTrail.snapshot();
const dispatch=(name,event={})=>{for(const cb of handlers.get(name)||[])cb(event)};
const press=key=>dispatch('keydown',{key,repeat:false,preventDefault(){}});
const release=key=>dispatch('keyup',{key});
const frame=()=>{
 time+=50;
 const next=frames.shift();
 assert.equal(typeof next,"function","Main loop must be scheduled");
 next(time);
};
assert.equal(nodes.get('soundButton').attributes.get('aria-pressed'),'false','Saved muted preference is reflected immediately');
nodes.get('soundButton').click();
assert.equal(values.get('thirstTrailSound'),'true','Unmuting persists across browser reloads');
nodes.get('soundButton').click();
assert.equal(values.get('thirstTrailSound'),'false','Muting persists across browser reloads');
nodes.get("startButton").listeners.click();
assert.equal(snapshot().screen,"playing");
assert.equal(window.TrailProgress.saved('valley')?.x,310,'A new expedition immediately has a checkpoint');
const initial=snapshot();
for(const cb of handlers.get("keydown")||[])cb({key:"d",repeat:false,preventDefault(){}});
for(let i=0;i<8;i++)frame();
assert.ok(snapshot().x>initial.x+20,"D key must move the player east");
for(const cb of handlers.get("keyup")||[])cb({key:"d"});
const afterEast=snapshot();
for(const cb of handlers.get("keydown")||[])cb({key:"w",repeat:false,preventDefault(){}});
for(let i=0;i<8;i++)frame();
assert.ok(snapshot().y<afterEast.y-20,"W key must move the player north");
for(const cb of handlers.get("keyup")||[])cb({key:"w"});
assert.ok(snapshot().screen==="playing","Movement must not end the expedition");
console.log("✓ Valley player responds to D and W across multiple frames");
console.log("✓ Movement, frame scheduling and gameplay state remain active");

// The periodic checkpoint must refresh through the real scheduled loop, without
// a modal, pagehide, chapter switch or direct call to the save function.
const beforeAutosave=window.TrailProgress.saved('valley');
assert.notEqual(beforeAutosave.x,snapshot().x,'Travel has advanced past the initial checkpoint');
for(let i=0;i<170;i++)frame();
const automaticCheckpoint=window.TrailProgress.saved('valley');
assert.equal(automaticCheckpoint.x,snapshot().x,'Periodic autosave stores the traveled position');
assert.equal(automaticCheckpoint.y,snapshot().y);
assert.ok(automaticCheckpoint.elapsed>=8,'Scheduled frames pass the eight-second autosave interval');
assert.ok(automaticCheckpoint.elapsed>beforeAutosave.elapsed,'Periodic autosave refreshes expedition time');
console.log('✓ Automatic checkpoint refresh after eight game seconds through scheduled main-loop frames');

// Checkpoint transitions must preserve a journey even if reloaded immediately.
nodes.get('valleyChapters').click();
const checkpoint=window.TrailProgress.saved('valley');
assert.equal(checkpoint.x,snapshot().x);
nodes.get('valleyChapter').click();
assert.equal(snapshot().x,checkpoint.x,'Continue restores the saved position');
assert.equal(window.TrailProgress.saved('valley')?.x,checkpoint.x,'Continue does not erase its checkpoint before the next autosave');

// Modal and browser focus transitions must not leave a held direction active.
press('d');frame();nodes.get('pauseButton').click();
const paused=snapshot();
assert.equal(window.__valleyRegression.getState().moving,false);
nodes.get('modalChoices').children.find(n=>n.textContent.includes('Resume adventure')).click();
frame();assert.equal(snapshot().x,paused.x,'Closing a modal does not resume stale held-key movement');
press('d');frame();dispatch('blur');const blurred=snapshot();frame();
assert.equal(snapshot().x,blurred.x,'Losing focus clears held movement');

// A completed click path settles in the same frame rather than animating in place.
const state=window.__valleyRegression.getState();
state.path=[{x:state.x+1,y:state.y}];state.moving=true;frame();
assert.equal(state.moving,false,'Finishing the final waypoint stops movement immediately');

// Restart establishes a fresh checkpoint without carrying inventory or held keys.
press('d');nodes.get('resetButton').click();
nodes.get('modalChoices').children.find(n=>n.textContent.includes('Restart adventure')).click();
assert.equal(snapshot().x,310);assert.equal(snapshot().y,620);
assert.equal(window.TrailProgress.saved('valley')?.x,310,'Restart writes its new checkpoint immediately');
const restarted=snapshot();frame();assert.equal(snapshot().x,restarted.x);
nodes.get('valleyChapters').click();press('d');
assert.equal(state.keys.size,0,'Chapter selection does not capture hidden Valley controls');
release('d');
console.log('✓ Saved sound preference, initial checkpoint, immediate Continue and restart');
console.log('✓ Modal, blur, chapter-selection and final-waypoint movement transitions');

// A damaged local checkpoint should fall back safely, without breaking Continue.
window.TrailProgress.save('valley',{
 x:850,y:300,energy:90,score:12,elapsed:4,
 done:{bad:true},inventory:'toolkit',supplies:true
});
nodes.get('valleyChapter').click();
assert.deepEqual(Array.from(snapshot().quests),[]);
assert.deepEqual(Array.from(snapshot().items),[]);
assert.equal(snapshot().x,310,'A checkpoint inside the river restores to the safe starting bank');
assert.equal(snapshot().y,620);

// Exercise the actual quest, pipe-tile and safety-quiz callbacks end to end.
// Only travel is accelerated through test-only coordinate access; no solver state
// or completion function is replaced.
nodes.get('startButton').click();
const choose=index=>nodes.get('modalChoices').children[index].click();
const go=(x,y)=>{state.x=x;state.y=y;press('e');};
for(const [key,x,y,item] of [
 ['elder',280,490,'fieldNotes'],['toolkit',455,765,'toolkit'],['gasket',1190,825,'gasket']
]){
 go(x,y);choose(0);
 assert.ok(snapshot().quests.includes(key),`Quest ${key} completes through its interaction`);
 assert.ok(snapshot().items.includes(item));
 assert.ok(window.TrailProgress.saved('valley').done.includes(key),'Quest reward is saved immediately');
}
go(1540,690);
assert.equal(state.modalKind,'pipe');
const beforeBadFlow=state.energy;choose(0);
assert.equal(state.energy,beforeBadFlow-2,'An incomplete pipe network cannot skip to the final quiz');
assert.equal(state.modalKind,'pipe');
for(let hint=0;hint<10;hint++){
 nodes.get('pipeHint').click();
 const text=nodes.get('pipeStatus').textContent;
 if(text.includes('valid leak-free network'))break;
 const match=text.match(/Tile (\d+).*click (\d+) more/);
 assert.ok(match,'A pipe hint identifies a tile and its remaining clockwise rotations');
 for(let turns=0;turns<Number(match[2]);turns++)
   nodes.get('pipeGrid').children[Number(match[1])-1].click();
}
assert.ok(nodes.get('pipeStatus').className.includes('is-success'),'Actual tile rotations form a leak-free supplied network');
choose(0);assert.equal(state.modalKind,'quiz');
const beforeWrongSafety=state.energy;choose(1);
assert.equal(state.energy,beforeWrongSafety-6,'Unsafe pump answer costs energy and keeps the quiz open');
assert.equal(state.modalKind,'quiz');
for(const answer of [0,1,2])choose(answer);
assert.equal(snapshot().screen,'ended');
assert.ok(snapshot().quests.includes('pump'));
assert.equal(state.effect.kind,'victory');
assert.equal(window.TrailProgress.unlocked('canyon'),true,'Pump victory unlocks the next chapter');
assert.equal(window.TrailProgress.saved('valley'),null,'Completion removes the finished checkpoint');
assert.ok(Number(values.get('thirstTrailBest'))>0,'Winning score is retained');
nodes.get('modalChoices').children.find(n=>n.textContent.includes('Chapter selection')).click();
nodes.get('valleyChapter').click();
assert.equal(snapshot().screen,'playing');assert.equal(snapshot().x,310);
assert.equal(snapshot().quests.length,0,'Replay starts with fresh quests');
assert.equal(window.TrailProgress.saved('valley')?.x,310,'Completed chapters still save a new replay');
assert.ok(window.TrailProgress.snapshot().completed.includes('valley'),'Replay keeps the completion/unlock record');
console.log('✓ Malformed checkpoint recovery and full Valley quests → real pipe callbacks → safety quiz → victory');
console.log('✓ Canyon unlock, winning score, completion checkpoint cleanup and resumable replay');


// Exercise the REAL camera-controller click and release functions in isolation.
// This catches JavaScript ReferenceErrors that a keyboard-only regression misses.
const completeScript=readFileSync(resolve(root,"script.js"),"utf8");
function between(start,end){
  const a=completeScript.indexOf(start);
  const b=completeScript.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Camera controller function missing: "+start);
  return completeScript.slice(a,b);
}
const selectSource=between("    function selectWorldPosition(event){",'    view.addEventListener("pointerdown"');
const finishSource=between("    function finishCameraGesture(event){",'    view.addEventListener("pointerup"');
const selected=[];
const pointer={x:0,y:0},hit={x:0,z:0};
const canvas3d={
 getBoundingClientRect(){return {left:0,top:0,width:1000,height:610}},
 focus(){},releasePointerCapture(){}
};
const raycaster={
 setFromCamera(){},
 ray:{intersectPlane(plane,out){out.x=2;out.z=1;return true}}
};
const createController=new Function("view","raycaster","pointer","camera","groundPlane",
 "hit","WORLD_W","WORLD_H","SCALE","options",`
 let cameraGesture=null,suppressNextClick=false;
 ${selectSource}
 ${finishSource}
 return {
  click:selectWorldPosition,
  release(gesture,event){
   cameraGesture=gesture;
   finishCameraGesture(event);
   return suppressNextClick;
  }
 };
`);
const cameraController=createController(canvas3d,raycaster,pointer,{},null,hit,1800,1100,40,
 {onSelect(x,y){selected.push([x,y])}});
const releaseEvent={pointerId:7,preventDefault(){}};
const tap={button:0,dragged:false,pointerId:7};
assert.equal(cameraController.release(tap,releaseEvent),false);
assert.deepEqual(selected,[[980,590]],"Short click should select a walking destination");
const moved={button:0,dragged:true,pointerId:7};
assert.equal(cameraController.release(moved,releaseEvent),true);
assert.equal(selected.length,1,"Dragging should not trigger click-to-walk");
console.log("✓ Actual 3D click release selects a destination without stale camera ReferenceErrors");
console.log("✓ Mouse dragging does not trigger walking");
