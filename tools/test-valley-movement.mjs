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
