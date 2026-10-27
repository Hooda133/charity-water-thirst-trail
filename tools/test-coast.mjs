#!/usr/bin/env node
// Genuine chapter callbacks, saved repairs and navigation without a GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url),nodes=new Map(),events=new Map(),values=new Map();
const context=new Proxy({},{get:()=>()=>{}});
function node(id='div'){
  const attrs=new Map();
  const n={id,children:[],listeners:{},dataset:{},style:{},hidden:false,textContent:'',innerHTML:'',
    classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){attrs.set(k,String(v))},
    getAttribute:k=>attrs.get(k),getContext:()=>context,focus(){},scrollIntoView(){},
    append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},
    querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:1000,height:610}),
    addEventListener(k,fn){this.listeners[k]=fn},click(){if(!this.disabled)this.listeners.click?.({target:this})}};
  return n;
}
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)},createElement:node,addEventListener(){}};
const window={addEventListener(k,fn){const list=events.get(k)||[];list.push(fn);events.set(k,list)},
  dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event)},scrollTo(){},matchMedia:()=>({matches:true})};
const sandbox={window,document,console,localStorage:{getItem:k=>values.get(k)||null,setItem(k,v){values.set(k,String(v))}},
  performance:{now:()=>1000},requestAnimationFrame:()=>1,Event:class{constructor(type){this.type=type}}};
runInNewContext(readFileSync(new URL('progression.js',root),'utf8'),sandbox);
const progress=window.TrailProgress;progress.complete('valley');progress.complete('canyon');
const original=readFileSync(new URL('coast.js',root),'utf8');
assert.ok(original.includes('save();buildWorld();if(!raf)'));
const code=original.replace('save();buildWorld();if(!raf)','save();if(!raf)')
  .replace(/\}\)\(\);\s*$/,'window.coastTest={state:()=>state,interact,goals,approaches,pathTo,update,blocked,powerSafe,bridgeSafe,gatesSafe};\n})();');
runInNewContext(code,sandbox);
const game=window.TrailCoast,t=window.coastTest,s=()=>t.state();
const options=()=>nodes.get('coastModalOptions').children,panel=()=>nodes.get('coastModalExtra');
const all=root=>[root,...(root.children||[]).flatMap(all)];
const button=(data,value)=>all(panel()).find(n=>n.dataset[data]===value);
const go=key=>{Object.assign(s(),t.approaches[key]||t.goals[key]);t.interact()};
game.launch();assert.equal(game.snapshot().active,true);
go('tank');assert.equal(s().modal,false,'Tank requires preceding repairs');
go('mara');options()[0].click();assert.ok(s().done.has('mara'));
go('power');const energy=s().energy;options()[0].click();const after=s().energy;
assert.ok(after<energy);options()[0].click();assert.equal(s().energy,after,'Retesting identical wrong inputs is free');
const staleSwitch=button('coastSwitch','0');options()[2].click();staleSwitch.click();
assert.equal(s().power[0],false,'Detached controls cannot alter a closed puzzle');
go('power');for(const i of [0,2,3])button('coastSwitch',String(i)).click();
assert.equal(t.powerSafe(),true);options()[0].click();assert.ok(s().done.has('power'));
go('bridge');const add=i=>all(panel()).find(n=>n.dataset.coastWeight===String(i)&&n.dataset.delta==='1').click();
add(1);options()[2].click();game.suspend();game.launch();
assert.deepEqual([...game.snapshot().weights],[0,1,0]);go('bridge');add(1);add(1);add(2);add(2);
assert.equal(t.bridgeSafe(),true);options()[0].click();assert.ok(s().done.has('bridge'));
const oldScore=s().score;go('bridge');assert.equal(s().modal,false);assert.equal(s().score,oldScore);
go('tank');button('coastRepair','2').click();assert.equal(s().tankStep,0);
button('coastRepair','0').click();options()[0].click();game.suspend();game.launch();
assert.equal(s().tankStep,1);go('tank');button('coastRepair','1').click();button('coastRepair','2').click();
assert.ok(s().done.has('tank'));assert.equal(game.snapshot().waterRestored,false);
go('release');options()[0].click();assert.equal(game.snapshot().finished,false);
for(const [i,value] of [3,2,1].entries()){
  const slider=button('coastGate',String(i));slider.value=String(value);slider.listeners.input();
}
assert.equal(t.gatesSafe(),true);const release=options()[0];release.click();const finalScore=s().score;release.click();
assert.equal(s().score,finalScore);assert.equal(s().finished,true);assert.equal(progress.saved('coast'),null);
assert.ok(progress.snapshot().completed.includes('coast'));
options()[2].click();assert.equal(nodes.get('coastCelebration').hidden,false);
nodes.get('coastCheer').click();nodes.get('coastResults').click();assert.equal(s().score,finalScore);
options()[1].click();assert.equal(s().finished,false);assert.equal(s().done.size,0);
assert.ok(progress.saved('coast'));assert.ok(progress.snapshot().completed.includes('coast'));

// True movement must cross the repaired bridge and reach every interaction.
Object.assign(s(),{done:new Set(['mara','power','bridge']),x:150,y:430,modal:false});
for(const key of ['power','bridge','tank','release','mara']){
  t.pathTo(t.goals[key],key);assert.ok(s().path.length,'A safe route exists to '+key);
  for(let i=0;i<2000&&s().path.length;i++)t.update(.05);
  assert.equal(s().path.length,0,'Route reaches '+key);
  assert.ok(Math.hypot(s().x-t.goals[key].x,s().y-t.goals[key].y)<88);
}
game.suspend();progress.save('coast',{done:['release'],energy:0,score:1270,gates:[NaN,8,-1],x:520,y:150});
game.launch();assert.equal(s().finished,true,'Interrupted final save recovers');assert.equal(game.snapshot().done.length,5);
assert.equal(game.snapshot().waterRestored,true);assert.equal(progress.saved('coast'),null);
game.launch(true);game.suspend();progress.save('coast',{energy:'bad',done:'bad',weights:[-1,100,1.5],power:[],gates:[null,5,0]});
game.launch();assert.equal(s().done.size,0);assert.equal(s().energy,100);assert.equal(game.snapshot().waterRestored,false);
assert.ok(s().weights.every(x=>Number.isInteger(x)&&x>=0&&x<=3));
game.suspend();progress.save('coast',{done:['bridge'],tankStep:3,score:590,energy:30});game.launch();
assert.ok(s().done.has('tank'),'An interrupted final tank layer remains completable');assert.equal(s().score,870);
game.suspend();game.launch();assert.equal(s().score,870,'Recovered tank reward is awarded once');
console.log('✓ Coast prerequisites, distinct puzzle controls, retry costs, partial repair saves and stale callbacks');
console.log('✓ Reachable landmark routes across the bridge, guarded release, celebration/replay and legacy recovery');
