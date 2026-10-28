#!/usr/bin/env node
// Real canyon-map module, mocked canvas and rAF. Tests keyboard accessibility
// and that hidden map / high-FPS frames do not redraw the entire canvas.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../canyon-map.js",import.meta.url),"utf8");
new Function(source);
const queue=[],routes=[],stops=["surveyor","kit","valves","span","cistern"];
const attributes=new Map();
let mapElement,paintCount=0;
const ctx=new Proxy({},{
  get(_,key){
    if(key==="createLinearGradient")return ()=>({addColorStop(){}});
    if(key==="fillRect")return (...args)=>{if(args[0]===0&&args[1]===0)paintCount++;};
    return ()=>{};
  },
  set(){return true}
});
function element(tag){
  const e={
    tag,children:[],style:{},dataset:{},hidden:false,listeners:{},textContent:"",
    setAttribute(name,value){this.attributes??=new Map();this.attributes.set(name,value);},
    append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){this.listeners[name]=fn;},
    getContext(){return ctx;},
    getBoundingClientRect(){return {left:0,top:0,width:500,height:305};}
  };
  if(tag==="canvas")mapElement=e;
  return e;
}
const buttons=Array.from({length:6},(_,i)=>({disabled:false,click(){routes.push(i);}}));
const sidebar={children:[],insertBefore(child){this.children.push(child);}};
const destinations={querySelectorAll(selector){assert.equal(selector,"button");return buttons;}};
const chapter={hidden:false};
const document={
  hidden:false,readyState:"complete",head:{append(){}},
  createElement:element,
  querySelector(selector){return selector===".canyon-sidebar"?sidebar:null;},
  getElementById(id){return id==="canyonDestinations"?destinations:id==="canyonScreen"?chapter:null;}
};
const state={x:165,y:270,done:[]};
const window={TrailCanyon:{snapshot(){return {...state};}},TrailTypography:{family:"sans-serif"}};
const requestAnimationFrame=fn=>queue.push(fn);
runInNewContext(source,{window,document,requestAnimationFrame,performance:{now:()=>0},
  console,Math,Set});
assert.ok(mapElement,"interactive map must be created");
assert.equal(mapElement.attributes.get("role"),"button","clickable map must not use non-interactive img role");
assert.match(mapElement.attributes.get("aria-label"),/Enter or Space/);
assert.equal(queue.length,1,"only one animation frame loop should be registered");
function tick(time){
  const frame=queue.shift();
  assert.equal(typeof frame,"function","next frame should be scheduled");
  frame(time);
  assert.equal(queue.length,1,"keep one active animation frame callback");
}
tick(0);
assert.equal(paintCount,1,"first visible frame should draw map");
tick(16);tick(50);tick(99);
assert.equal(paintCount,1,"map should not redraw 60 times per second");
tick(100);
assert.equal(paintCount,2,"map draws once the 100 ms budget passes");
chapter.hidden=true;
tick(200);tick(350);
assert.equal(paintCount,2,"hidden chapter must not draw map");
chapter.hidden=false;
tick(360);
assert.equal(paintCount,3,"map repaints when returning to Canyon");
document.hidden=true;
tick(470);
assert.equal(paintCount,3,"backgrounded browser tab must not paint");
document.hidden=false;
tick(480);
assert.equal(paintCount,4,"visible browser resumes map");
mapElement.listeners.click({clientX:165*.5,clientY:270*.5});
assert.equal(routes.at(-1),0,"map pointer target follows surveyor");
const keys=[];
mapElement.listeners.keydown({key:" ",preventDefault(){keys.push("prevent");},stopPropagation(){keys.push("stop");}});
assert.deepEqual(keys,["prevent","stop"],"Space must not trigger global chapter interactions");
assert.equal(routes.at(-1),0,"Space routes first unfinished quest");
state.done=["surveyor"];
mapElement.listeners.keydown({key:"Enter",preventDefault(){},stopPropagation(){}});
assert.equal(routes.at(-1),1,"Enter routes next unfinished quest");
buttons[2].disabled=true;
mapElement.listeners.click({clientX:390*.5,clientY:165*.5});
assert.equal(routes.at(-1),1,"disabled destinations must not be activated");
console.log("PASS: accessible Canyon marker map, focus keyboard events, throttled drawing and hidden chapter/tab resource savings");
