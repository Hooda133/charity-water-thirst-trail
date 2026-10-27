#!/usr/bin/env node
// Exercise real village controls, resource conservation and independent persistence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('village-life.js',root),'utf8');
const progressSource=readFileSync(new URL('progression.js',root),'utf8');
function boot(values=new Map()){
  const registry=new Map(),events=new Map(),notices=[],walks=[],sounds=[];
  const player={x:475,y:660};
  function node(tag='div'){
    const attributes=new Map();return {tag,hidden:false,children:[],dataset:{},style:{},listeners:{},textContent:'',
      classList:{toggle(){}},setAttribute(k,v){attributes.set(k,String(v));},getAttribute:k=>attributes.get(k),
      addEventListener(type,fn){this.listeners[type]=fn;},append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=[...children];},click(){if(!this.disabled)this.listeners.click?.();}};
  }
  const document={getElementById(id){if(!registry.has(id))registry.set(id,node());return registry.get(id);},createElement:node};
  const window={addEventListener(type,fn){(events.get(type)||events.set(type,[]).get(type)).push(fn);},
    dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},
    TrailMode:{get:()=> 'challenge'},ThirstAudio:{tone:(...args)=>sounds.push(args)},matchMedia:()=>({matches:false})};
  const localStorage={getItem:k=>values.get(k)||null,setItem(k,v){values.set(k,String(v));}};
  const sandbox={window,document,localStorage,console,Event:class{constructor(type){this.type=type;}}};
  runInNewContext(progressSource,sandbox);runInNewContext(source,sandbox);
  const api=window.TrailVillageLife,progress=window.TrailProgress;
  api.init({getPlayer:()=>player,navigate:point=>walks.push(point),notify:text=>notices.push(text)});
  const panel=document.getElementById('villageLifePanel');
  const descendants=el=>[el,...el.children.flatMap(descendants)];
  const button=id=>{const found=descendants(panel).find(el=>el.dataset.villageAction===id);assert.ok(found,'Missing activity control '+id);return found;};
  const click=id=>button(id).click();
  const go=id=>{const point=api.getDestinations().find(p=>p.id===id);assert.ok(point);Object.assign(player,point);api.update(.05);return point;};
  return {api,progress,values,player,notices,walks,sounds,panel,button,click,go};
}
let game=boot();
assert.equal(game.api.open(),false,'Village activities require a completed pump chapter');
game.progress.complete('valley');assert.equal(game.api.open(),true);
assert.equal(game.api.snapshot().jug,0);
game.click('go-home');assert.equal(game.walks.length,1);assert.equal(game.api.snapshot().jug,0,'Travel buttons never fill or deliver remotely');
const obsoleteFill=game.button('fill');
game.go('school');obsoleteFill.click();assert.equal(game.api.snapshot().jug,0,'Detached controls and wrong locations cannot fill a jug');
assert.equal(game.button('fill').disabled,true);
game.go('fountain');game.click('fill');assert.equal(game.api.snapshot().jug,8);
const all=game.api.getDestinations();assert.equal(all.length,7,'Fountain, three neighbours and three wet trails are available');
for(const id of ['home','school']){
  game.go(id);game.click('deliver-'+id);
  const score=game.api.snapshot().materials;
  game.click('deliver-'+id);assert.equal(game.api.snapshot().materials,score,'A served neighbour cannot repeat first-delivery materials');
}
assert.equal(game.api.snapshot().jug,0);assert.equal(game.api.snapshot().materials,4);
game.go('garden');game.click('deliver-garden');assert.equal(game.api.snapshot().delivered.garden,0,'A delivery cannot use an empty jug');
game.go('fountain');game.click('fill');game.go('garden');game.click('deliver-garden');
assert.equal(game.api.snapshot().jug,4);assert.equal(game.api.snapshot().materials,6);assert.equal(game.api.snapshot().roundComplete,true);
// Reload a genuinely independent browser progress snapshot.
const saved=game.values;game=boot(saved);game.api.open();
assert.equal(game.api.snapshot().jug,4);assert.equal(game.api.snapshot().served.length,3);assert.equal(game.api.snapshot().materials,6);
const old=game.api.snapshot();old.served.length=0;old.delivered.home=999;
assert.equal(game.api.snapshot().served.length,3);assert.equal(game.api.snapshot().delivered.home,1,'Read-only snapshots do not expose mutable activity state');
game.click('next-round');assert.equal(game.api.snapshot().round,2);assert.equal(game.api.snapshot().served.length,0);
game.go('home');game.click('deliver-home');assert.equal(game.api.snapshot().materials,6,'Further rounds do not farm first-delivery materials');
assert.equal(game.api.snapshot().jug,0);
// Three distinct faults use the correct tool and real, ordered repair controls.
game.click('tab-leaks');
for(const [id,tool] of [['school-joint','gasket'],['home-pipe','clamp'],['garden-coupling','torque']]){
  game.go(id);assert.equal(game.api.interactNear(),true);
  assert.ok(game.api.snapshot().found.includes(id));
  const wrong=tool==='clamp'?'gasket':'clamp';game.click('tool-'+id+'-'+wrong);
  assert.equal(game.api.snapshot().repair,null,'Wrong tool does not begin the repair');
  game.click('tool-'+id+'-'+tool);assert.equal(game.api.snapshot().repair.step,0);
  game.click('repair-'+id+'-2');assert.equal(game.api.snapshot().repair.step,0,'Wrong repair order preserves completed work');
  game.click('repair-'+id+'-0');assert.equal(game.api.snapshot().repair.step,1);
  if(id==='school-joint'){
    game=boot(game.values);game.api.open();game.click('tab-leaks');game.go(id);
    assert.equal(game.api.snapshot().repair.step,1,'Interrupted leak repair resumes its next step');
  }
  game.click('repair-'+id+'-1');game.click('repair-'+id+'-2');
  assert.ok(game.api.snapshot().fixed.includes(id));assert.equal(game.api.snapshot().repair,null);
  const materials=game.api.snapshot().materials;game.api.interactNear();
  assert.equal(game.api.snapshot().materials,materials,'A fixed leak cannot repeat its material reward');
}
assert.equal(game.api.snapshot().materials,15);assert.equal(game.api.snapshot().bonus,true,'Challenge caretaker badge is earned by actual delivery and repair work');
game.click('tab-projects');
for(const id of ['station','irrigation','shade'])game.click('build-'+id);
assert.deepEqual([...game.api.snapshot().upgrades].sort(),['irrigation','shade','station']);
assert.equal(game.api.snapshot().materials,4,'All projects are reachable from finite first-delivery/leak rewards');
assert.ok(game.api.getDestinations().some(p=>p.id==='station'));
const before=game.api.snapshot().materials;game.click('build-station');assert.equal(game.api.snapshot().materials,before,'Built projects cannot charge again');
// The station is a second real refill point, not merely an illustration.
game.click('tab-deliveries');game.go('station');assert.equal(game.api.interactNear(),true);assert.equal(game.api.snapshot().jug,8);
game.api.close();assert.equal(game.panel.hidden,true);assert.equal(game.api.interactNear(),false);
// Chapter replays do not erase an independently saved village.
game.progress.clearSave('valley');game.progress.save('valley',{x:310,done:[]});
const reload=boot(game.values);reload.api.open();assert.equal(reload.api.snapshot().upgrades.length,3);assert.equal(reload.api.snapshot().fixed.length,3);assert.equal(reload.api.snapshot().jug,8);
const drawing=new Proxy({},{get:()=>()=>{}});reload.api.draw2D(drawing,20);reload.api.close();reload.api.draw2D(drawing,20,true);
console.log('✓ Real jug fill/delivery controls enforce proximity and conserve 8L capacity');
console.log('✓ First-delivery and leak rewards are once-only; finite resources build every project');
console.log('✓ Three tool-specific repair sequences, wrong-input feedback, saved steps and optional challenge badge');
console.log('✓ Community snapshots, reloads and projects persist independently of chapter replay; 2D draw remains valid');
