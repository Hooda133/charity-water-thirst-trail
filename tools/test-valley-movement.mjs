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
 const listeners={};
 const result={
  id,hidden:false,value:"",checked:false,textContent:"",innerHTML:"",
  style:{},dataset:{},children:[],listeners,scrollTop:0,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(){},removeAttribute(){},
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
const values=new Map([["thirstTrailTutorial","true"]]);
const storage={getItem(k){return values.get(k)||null},setItem(k,v){values.set(k,String(v))},removeItem(k){values.delete(k)}};
const sandbox={document,window,localStorage:storage,console,
 performance:{now:()=>time},requestAnimationFrame(fn){frames.push(fn);return frames.length},
 setTimeout(fn){return 1},clearTimeout(){},Event:class{constructor(type){this.type=type}}};
runInNewContext(readFileSync(resolve(root,"progression.js"),"utf8"),sandbox);
runInNewContext(script,sandbox);
const snapshot=()=>window.ThirstTrail.snapshot();
const frame=()=>{
 time+=50;
 const next=frames.shift();
 assert.equal(typeof next,"function","Main loop must be scheduled");
 next(time);
};
nodes.get("startButton").listeners.click();
assert.equal(snapshot().screen,"playing");
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
