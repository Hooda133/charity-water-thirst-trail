#!/usr/bin/env node
// Exercise real village controls, resource conservation and independent persistence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('village-life.js',root),'utf8');
const progressSource=readFileSync(new URL('progression.js',root),'utf8');
const modeSource=readFileSync(new URL('expedition-mode.js',root),'utf8');
function boot(values=new Map(),{denyRead=false,denyWrite=false}={}){
  const registry=new Map(),events=new Map(),notices=[],walks=[],sounds=[];
  const player={x:475,y:660};
  function node(tag='div'){
    const attributes=new Map();return {tag,hidden:false,children:[],dataset:{},style:{},listeners:{},textContent:'',
      classList:{toggle(){}},setAttribute(k,v){attributes.set(k,String(v));},getAttribute:k=>attributes.get(k),
      addEventListener(type,fn){this.listeners[type]=fn;},append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=[...children];},
      focus(){document.activeElement=this;},
      contains(target){return target===this||this.children.some(child=>child.contains?.(target));},
      querySelectorAll(selector){
        if(selector!=="[data-village-action]")return [];
        const visit=current=>[...(current.dataset.villageAction?[current]:[]),...current.children.flatMap(visit)];
        return visit(this);
      },
      click(){if(!this.disabled)this.listeners.click?.();}};
  }
  const document={activeElement:null,getElementById(id){if(!registry.has(id))registry.set(id,node());return registry.get(id);},createElement:node};
  const window={addEventListener(type,fn){(events.get(type)||events.set(type,[]).get(type)).push(fn);},
    dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},
    ThirstAudio:{tone:(...args)=>sounds.push(args)},matchMedia:()=>({matches:false})};
  const localStorage={getItem(k){if(denyRead)throw Error('Storage denied');return values.get(k)||null;},setItem(k,v){if(denyWrite)throw Error('Storage denied');values.set(k,String(v));}};
  const sandbox={window,document,localStorage,console,Event:class{constructor(type){this.type=type;}}};
  runInNewContext(modeSource,sandbox);
  if(!values.has('thirstTrailMode'))window.TrailMode.set('normal');
  runInNewContext(progressSource,sandbox);runInNewContext(source,sandbox);
  const api=window.TrailVillageLife,progress=window.TrailProgress;
  api.init({getPlayer:()=>player,navigate:point=>walks.push(point),notify:text=>notices.push(text)});
  const panel=document.getElementById('villageLifePanel');
  const descendants=el=>[el,...el.children.flatMap(descendants)];
  const button=id=>{const found=descendants(panel).find(el=>el.dataset.villageAction===id);assert.ok(found,'Missing activity control '+id);return found;};
  const click=id=>button(id).click();
  const go=id=>{const point=api.getDestinations().find(p=>p.id===id);assert.ok(point);Object.assign(player,point);api.update(.05);return point;};
  const text=()=>descendants(panel).map(el=>el.textContent).join(' ');
  return {api,progress,mode:window.TrailMode,values,player,notices,walks,sounds,panel,button,click,go,text,document};
}
let game=boot();
assert.equal(game.api.open(),false,'Village activities require a completed pump chapter');
game.progress.complete('valley');assert.equal(game.api.open(),true);
assert.equal(game.document.getElementById('villageOpenActivities').getAttribute('aria-expanded'),'true');
game.button('close').focus();game.click('close');
assert.equal(game.panel.hidden,true,'Close activities hides the sidebar panel');
assert.equal(game.document.activeElement,game.document.getElementById('villageOpenActivities'),
  'Closing an active panel returns keyboard focus to its opener');
assert.equal(game.document.getElementById('villageOpenActivities').getAttribute('aria-expanded'),'false');
assert.equal(game.api.open(),true);
assert.equal(game.api.snapshot().jug,0);
game.click('go-home');assert.equal(game.walks.length,1);assert.equal(game.api.snapshot().jug,0,'Travel buttons never fill or deliver remotely');
const obsoleteFill=game.button('fill');
game.go('school');obsoleteFill.click();assert.equal(game.api.snapshot().jug,0,'Detached controls and wrong locations cannot fill a jug');
assert.equal(game.button('fill').disabled,true);
game.go('fountain');game.button('fill').focus();game.click('fill');assert.equal(game.api.snapshot().jug,8);
assert.equal(game.document.activeElement.dataset.villageAction,'tab-deliveries',
  'Finishing a focused fill action returns keyboard focus to the current tab instead of body');
game.button('tab-leaks').focus();game.click('tab-leaks');
assert.equal(game.document.activeElement.dataset.villageAction,'tab-leaks',
  'Switching tabs preserves focus on the newly rendered tab control');
game.click('tab-deliveries');
assert.equal(game.document.activeElement.dataset.villageAction,'tab-deliveries',
  'Changing back to deliveries keeps focus on its tab');
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
game.go('home');game.button('deliver-home').focus();game.click('deliver-home');assert.equal(game.api.snapshot().materials,6,'Further rounds do not farm first-delivery materials');
assert.equal(game.document.activeElement.dataset.villageAction,'tab-deliveries',
  'Completed delivery must not lose keyboard focus');
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
assert.equal(game.api.snapshot().materials,15);assert.equal(game.api.snapshot().bonus,false,'Normal difficulty does not award the optional Hard badge');
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
const legacyValues=new Map(reload.values);legacyValues.set('thirstTrailMode','challenge');
const legacy=boot(legacyValues);legacy.api.open();
assert.equal(legacy.api.snapshot().difficulty,'hard','Legacy Challenge preference maps to Hard');
assert.equal(legacy.api.snapshot().deliveryRequest,6);
for(const key of ['jug','materials','served','delivered','fixed','upgrades','repair'])
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.api.snapshot()[key])),JSON.parse(JSON.stringify(reload.api.snapshot()[key])),'Legacy preference migration preserves '+key);

// A settings change changes the next delivery without modifying carried water or earned work.
game=boot();game.progress.complete('valley');game.api.open();
game.go('fountain');game.click('fill');game.go('home');game.click('deliver-home');
game.click('tab-leaks');game.go('school-joint');game.api.interactNear();game.click('tool-school-joint-gasket');game.click('repair-school-joint-0');
game.click('tab-projects');game.click('build-station');
// One first delivery cannot fund the station; complete another legitimate delivery first.
assert.equal(game.api.snapshot().upgrades.length,0);
game.click('tab-deliveries');game.go('school');game.click('deliver-school');
game.click('tab-projects');game.click('build-station');
game.click('tab-deliveries');game.go('fountain');game.click('fill');
const beforeSwitch=game.api.snapshot(),oldDelivery=game.button('deliver-garden');
assert.equal(game.mode.setDifficulty('hard'),true);
let switched=game.api.snapshot();
for(const key of ['jug','materials','served','delivered','fixed','found','upgrades','repair','round'])
  assert.deepEqual(JSON.parse(JSON.stringify(switched[key])),JSON.parse(JSON.stringify(beforeSwitch[key])),'Changing difficulty preserves '+key);
assert.equal(switched.difficulty,'hard');assert.equal(switched.deliveryRequest,6);assert.equal(switched.jugCapacity,8);
assert.ok(game.text().includes('Each neighbour needs 6 litres.'));
assert.ok(game.button('deliver-garden').textContent.includes('Deliver 6 L'));
const snapshotBeforeStale=game.api.snapshot();game.go('garden');oldDelivery.click();
assert.equal(game.api.snapshot().jug,snapshotBeforeStale.jug,'Controls detached by settings changes cannot deliver');
game.click('deliver-garden');assert.equal(game.api.snapshot().jug,2);assert.equal(game.api.snapshot().delivered.garden,1);
game.click('next-round');game.go('school');
assert.equal(game.button('deliver-school').disabled,true,'Two remaining litres cannot satisfy a Hard delivery');
game.api.interactNear();assert.equal(game.api.snapshot().delivered.school,1);
assert.ok(game.text().includes('needs 6 litres'));
game.go('station');game.click('fill-station');assert.equal(game.api.snapshot().jug,8,'Built station refills the same 8L jug on Hard');
game.go('home');game.click('deliver-home');assert.equal(game.api.snapshot().jug,2);
game.go('fountain');game.click('fill');game.go('school');game.click('deliver-school');assert.equal(game.api.snapshot().jug,2);
game.go('fountain');game.click('fill');game.go('garden');game.click('deliver-garden');assert.equal(game.api.snapshot().roundComplete,true);
const hardSaved=game.api.snapshot();game=boot(game.values);game.api.open();
for(const key of ['jug','materials','served','delivered','fixed','found','upgrades','repair','round','difficulty','deliveryRequest'])
  assert.deepEqual(JSON.parse(JSON.stringify(game.api.snapshot()[key])),JSON.parse(JSON.stringify(hardSaved[key])),'Hard reload preserves '+key);
game.click('tab-leaks');game.go('school-joint');
assert.equal(game.api.snapshot().repair.step,1,'A partial repair remains resumable after a difficulty change and reload');
game.click('repair-school-joint-1');game.click('repair-school-joint-2');
for(const [id,tool] of [['home-pipe','clamp'],['garden-coupling','torque']]){
  game.go(id);game.api.interactNear();game.click('tool-'+id+'-'+tool);
  for(let step=0;step<3;step++)game.click('repair-'+id+'-'+step);
}
assert.equal(game.api.snapshot().bonus,true,'Hard Caretaker badge still requires actual deliveries and all three repairs');
game.click('tab-projects');game.click('build-irrigation');game.click('build-shade');
assert.equal(game.api.snapshot().upgrades.length,3,'Hard delivery and leak rewards still fund every project');
game.mode.setDifficulty('easy');assert.equal(game.api.snapshot().deliveryRequest,4);
assert.equal(game.api.snapshot().bonus,true,'Switching difficulty preserves an earned badge');
game.click('tab-deliveries');assert.ok(game.text().includes('Each neighbour needs 4 litres.'));
const labels=[];const drawingHard=new Proxy({},{get:(_,key)=>key==='fillText'?(...args)=>labels.push(args[0]):()=>{}});
game.click('next-round');game.mode.setDifficulty('hard');game.api.draw2D(drawingHard,5);
assert.ok(labels.includes('6L'),'2D destination labels show the current delivery requirement');
game.mode.setDifficulty('easy');labels.length=0;game.api.draw2D(drawingHard,5);
assert.ok(labels.includes('4L'),'2D labels refresh when difficulty changes');

// Storage restrictions retain a playable session and the selected delivery requirement.
const blocked=boot(new Map(),{denyRead:true,denyWrite:true});blocked.progress.complete('valley');blocked.api.open();
blocked.mode.setDifficulty('hard');blocked.go('fountain');blocked.click('fill');blocked.go('home');blocked.click('deliver-home');
assert.equal(blocked.api.snapshot().jug,2);assert.equal(blocked.api.snapshot().deliveryRequest,6);
assert.equal(blocked.api.snapshot().delivered.home,1);
console.log('✓ Real jug fill/delivery controls enforce proximity and conserve 8L capacity');
console.log('✓ First-delivery and leak rewards are once-only; finite resources build every project');
console.log('✓ Three tool-specific repair sequences, wrong-input feedback, saved steps and optional challenge badge');
console.log('✓ Community snapshots, reloads and projects persist independently of chapter replay; 2D draw remains valid');
console.log('✓ Live Easy/Normal/Hard delivery requirements preserve jug, rounds, projects, badges and partial repairs');
console.log('✓ Hard 6L deliveries require refills, remain fully fundable, survive reload and work with storage denied');
