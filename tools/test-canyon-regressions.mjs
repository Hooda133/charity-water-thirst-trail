#!/usr/bin/env node
// Genuine Canyon callbacks and movement, isolated from GPU/CDN dependencies.
// This is a deterministic logic regression; it does not claim visual QA.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
const root=resolve(import.meta.dirname,"..");
const source=readFileSync(resolve(root,"canyon.js"),"utf8")
  .replace("save();buildWorld();","save(); /* graphics intentionally isolated */")
  .replace(/\}\)\(\);\s*$/,"window.canyonRegression={get:()=>state,interact,pathTo,update,blocked,goals,approaches,pressureSafe};\n})();");
const nodes=new Map(),events=new Map(),values=new Map();
const drawing=new Proxy({},{get:()=>()=>{}});
function node(id="div"){
  return {id,children:[],listeners:{},hidden:false,textContent:"",style:{},dataset:{},
    classList:{add(){},toggle(){}},getContext:()=>drawing,focus(){},setAttribute(){},
    append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},
    addEventListener(type,fn){this.listeners[type]=fn},
    getBoundingClientRect:()=>({left:0,top:0,width:1000,height:610}),
    click(){if(!this.disabled)this.listeners.click?.({target:this})}};
}
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)},
  createElement:node,querySelectorAll:()=>[],addEventListener(){}};
const window={addEventListener(type,fn){(events.get(type)||events.set(type,[]).get(type)).push(fn)},
  dispatchEvent(e){for(const fn of events.get(e.type)||[])fn(e)},scrollTo(){}};
const sandbox={window,document,console,localStorage:{getItem:k=>values.get(k)||null,
  setItem(k,v){values.set(k,v)}},performance:{now:()=>1000},requestAnimationFrame:()=>1,
  Event:class {constructor(type){this.type=type}}};
runInNewContext(readFileSync(resolve(root,"progression.js"),"utf8"),sandbox);
runInNewContext(readFileSync(resolve(root,"difficulty.js"),"utf8"),sandbox);
window.TrailProgress.complete("valley");
runInNewContext(source,sandbox);
const game=window.TrailCanyon,test=window.canyonRegression,progress=window.TrailProgress;
const state=()=>test.get(),options=()=>nodes.get("canyonModalOptions").children;
const panel=()=>nodes.get("canyonModalExtra");
const go=key=>{Object.assign(state(),test.approaches[key]||test.goals[key]);test.interact()};
const begin=()=>{game.launch(true);go("surveyor");options()[0].click();go("kit");options()[0].click()};
begin();
const earned=state().score;
go("kit");const oldCollect=options()[0];oldCollect.click();oldCollect.click();
assert.equal(state().score,earned,"Repeated collection cannot grant a duplicate reward");
go("span");assert.equal(state().modal,false,"Aqueduct is gated by calibrated valves");
assert.match(state().toast,/pressure valves/);
let solutions=0;
for(let a=0;a<=3;a++)for(let b=0;b<=3;b++)for(let c=0;c<=3;c++){
  state().valves=[a,b,c];const p=16*a+13*b+11*c;
  const safe=p>=65&&p<=73&&b>=1&&Math.abs(a-c)<=1;
  assert.equal(test.pressureSafe(),safe,`Valve condition mismatch ${a},${b},${c}`);
  if(safe)solutions++;
}
assert.ok(solutions>0,"At least one setting is reachable with the supplied controls");
state().valves=[0,0,0];go("valves");
const initialEnergy=state().energy,oldTest=options()[0];oldTest.click();
assert.equal(state().energy,initialEnergy-4);
oldTest.click();assert.equal(state().energy,initialEnergy-4,"An obsolete modal callback cannot penalize again");
options()[0].click();assert.equal(state().energy,initialEnergy-4,"Retesting identical settings is free");
options()[1].click();game.suspend();game.launch();go("valves");options()[0].click();
assert.equal(state().energy,initialEnergy-4,"Penalty history survives a checkpoint reload");
const valveRows=()=>panel().children[0].children;
valveRows()[1].children[1].click();options()[0].click();
assert.equal(state().failedValveTests.size,2);
assert.match(valveRows().at(-1).textContent,/69 kPa/,"Struggling players receive a concrete optional field note");
valveRows()[1].children[1].click();
valveRows()[1].children[2].click();
assert.equal(state().valves[0],1,"Decrease control reverses a valve adjustment");
valveRows()[1].children[1].click();
valveRows()[2].children[1].click();valveRows()[2].children[1].click();
valveRows()[3].children[1].click();
assert.equal(game.snapshot().pressure,69);options()[0].click();
assert.ok(state().done.has("valves"));
const energyAfterCalibration=state().energy;go("valves");
assert.equal(state().modal,false,"Completed valves cannot be reopened or miscalibrated");
assert.equal(state().energy,energyAfterCalibration);
go("span");panel().children[0].children[3].click();
assert.equal(state().repairStep,0);assert.match(nodes.get("canyonModalText").textContent,/Anchor supports/);
panel().children[0].children[0].click();
assert.equal(panel().children[0].children[0].disabled,true,"Finished assembly steps cannot be selected again");
options()[0].click();game.suspend();game.launch();go("span");
assert.equal(state().repairStep,1,"An interrupted assembly resumes at its next step");
for(const i of [1,2,3])panel().children[0].children[i].click();
assert.ok(state().done.has("span"));
go("cistern");const preQuiz=state().energy;options()[1].click();options()[1].click();
assert.equal(state().energy,Math.max(7,preQuiz-5),"A repeated unsafe answer does not stack penalties");
assert.match(nodes.get("canyonModalText").textContent,/invisible contamination/);
options()[2].click();game.suspend();game.launch();go("cistern");options()[1].click();
assert.equal(state().energy,Math.max(7,preQuiz-5),"Safety-answer feedback and penalty survive reload");
const finalAnswer=options()[0];finalAnswer.click();const finalScore=state().score;finalAnswer.click();
assert.equal(state().score,finalScore);assert.equal(state().finished,true);
assert.equal(progress.saved("canyon"),null);
console.log(`✓ All 64 valve configurations (${solutions} valid), real adjustment controls, guidance and deduplicated penalties`);
console.log("✓ Prerequisite gates, repeat rewards, obsolete callbacks, repair order, quiz retry and victory idempotence");

// Simulate interruption in the old two-write repair transition.
game.suspend();progress.save("canyon",{x:700,y:397,done:["surveyor","kit","valves"],
  valves:[2,2,1],repairStep:4,energy:10,score:460});game.launch();
assert.ok(state().done.has("span"));assert.equal(state().score,770);
game.suspend();game.launch();assert.equal(state().score,770,"Recovered reward is awarded once");
// Completed later objectives imply prerequisites; impossible settings normalize.
game.suspend();progress.save("canyon",{done:["span"],valves:[0,0,0],repairStep:0,energy:0});game.launch();
assert.deepEqual([...state().done].sort(),["kit","span","surveyor","valves"].sort());
assert.equal(state().repairStep,4);assert.equal(game.snapshot().pressure,69);assert.equal(state().energy,7);
go("cistern");options()[0].click();assert.equal(state().finished,true,"Low energy cannot prevent final inspection");
// Simulate closing the page after final quest save but before victory display.
progress.save("canyon",{done:["surveyor","kit","valves","span","cistern"],energy:40,score:1200});
game.launch();assert.equal(state().finished,true);assert.equal(progress.saved("canyon"),null);
console.log("✓ Interrupted final repair and final victory recover; inconsistent and zero-energy checkpoints remain playable");

begin();state().energy=1;go("valves");options()[0].click();
assert.equal(state().energy,1,"An unsafe valve test cannot increase energy below the recovery floor");
options()[1].click();state().done.add("valves");state().done.add("span");go("cistern");options()[1].click();
assert.equal(state().energy,1,"An unsafe cistern answer cannot increase energy below the recovery floor");
console.log("✓ Incorrect inputs never grant energy, including below-floor interrupted states");

// Travel uses actual gameplay path planning + frame updates, with no teleports
// between route start and destination. Sample every produced segment as well.
function travel(from,target){
  Object.assign(state(),from);state().keys.clear();test.pathTo(target);
  assert.ok(state().path.length,`Route exists from ${JSON.stringify(from)} to ${JSON.stringify(target)}`);
  const route=[{...from},...state().path];
  for(let i=1;i<route.length;i++)for(let j=0;j<=200;j++){
    const u=j/200,a=route[i-1],b=route[i];
    assert.equal(test.blocked(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u),false,"Route segments stay on accessible floor");
  }
  for(let i=0;i<1600&&state().path.length;i++)test.update(.05);
  assert.equal(state().path.length,0,"Explorer reaches the destination without getting stuck");
  return {x:state().x,y:state().y};
}
game.launch(true);
let position={x:170,y:425};
for(const key of ["surveyor","kit","valves","span","cistern","surveyor"]){
  position=travel(position,test.goals[key]);
  assert.ok(Math.hypot(position.x-test.goals[key].x,position.y-test.goals[key].y)<78,`Mission ${key} is reachable within interaction range`);
}
for(const target of [{x:160,y:100},{x:900,y:510}])travel({x:510,y:350},target);
travel({x:390,y:90},{x:390,y:265});
travel({x:820,y:85},{x:820,y:270});
travel({x:700,y:290},{x:700,y:415});
assert.equal(test.blocked(390,165),true);assert.equal(test.blocked(820,175),true);
assert.equal(test.blocked(500,300),true);assert.equal(test.blocked(500,350),false);
// Rest remains independently reachable beside the supply shelter.
travel({x:305,y:455},{x:290,y:520});state().energy=7;test.interact();assert.equal(state().energy,41);
// Sprint changes movement speed rather than merely its authored animation.
Object.assign(state(),{x:150,y:420});state().keys.add("d");test.update(.05);const walk=state().x-150;
Object.assign(state(),{x:150,y:420});state().keys.add("shift");test.update(.05);
assert.ok(state().x-150>walk);state().keys.clear();
console.log("✓ Actual movement reaches every mission, both bridge exits and rest; solid landmarks block movement; sprint works");

// Re-run the exact seeded skyline layout and ensure its bases clear walkable land.
const canyon=readFileSync(resolve(root,"canyon.js"),"utf8");
const start=canyon.indexOf("      let seed=31415;"),end=canyon.indexOf("      // Distinct winding desert roads.",start);
assert.ok(start>=0&&end>start);const mesas=[];
const code=canyon.slice(start,end);
class CylinderGeometry {constructor(top,radius,height){Object.assign(this,{radius,height})}}
new Function("THREE","rock","put",code)({CylinderGeometry},[0,1,2,3],(geometry,material,x,y,z)=>{
  if(geometry.height>.15)mesas.push({x,z,radius:geometry.radius});return {rotation:{}};
});
assert.equal(mesas.length,44);
assert.ok(mesas.every(m=>Math.abs(m.x)-m.radius>=22.8-1e-9),"Every skyline mesa stays outside the accessible map");
console.log("✓ Seeded skyline geometry keeps all 44 solid mesa bases clear of missions and playable floor");
