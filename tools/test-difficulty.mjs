#!/usr/bin/env node
// Exercise actual chapter callbacks with the shared difficulty policy, without GPU/CDN work.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(root,name),'utf8');
const difficultySource=read('difficulty.js');
let valleySource=read('script.js');
const graphicsStart=valleySource.indexOf('  createWorld(canvas, {');
const graphicsEnd=valleySource.indexOf('  let audioContext = null;',graphicsStart);
assert.ok(graphicsStart>=0&&graphicsEnd>graphicsStart);
valleySource=valleySource.slice(0,graphicsStart)+valleySource.slice(graphicsEnd);
valleySource=valleySource.replace('window.ThirstTrail={',
  'window.difficultyValleyTest={get:()=>state,interact,handleMovement,collectNearbySupplies,end};window.ThirstTrail={');
const canyonSource=read('canyon.js').replace('save();buildWorld();','save(); /* isolate GPU */')
  .replace(/\}\)\(\);\s*$/,'window.difficultyCanyonTest={get:()=>state,interact,update,goals,approaches};\n})();');
const profiles={
  easy:{energyCost:.65,campUses:3,campRecovery:48,supplyRecovery:18,recoveryEnergy:65,canyonRecovery:51,valveHintAfter:0},
  normal:{energyCost:1,campUses:2,campRecovery:32,supplyRecovery:12,recoveryEnergy:50,canyonRecovery:34,valveHintAfter:2},
  hard:{energyCost:1.4,campUses:1,campRecovery:24,supplyRecovery:9,recoveryEnergy:35,canyonRecovery:26,valveHintAfter:4}
};
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,`${message}: expected ${expected}, got ${actual}`);
function boot(values=new Map(),{denyStorage=false,game=true}={}){
  const nodes=new Map(),events=new Map();
  const context2d=new Proxy({},{get(target,key){
    if(['createLinearGradient','createRadialGradient','createPattern'].includes(key))return ()=>({addColorStop(){}});
    if(key==='measureText')return ()=>({width:20});
    return ()=>{};
  }});
  function node(id='div'){
    const result={id,hidden:id==='graphicsPanel',value:'',checked:false,textContent:'',innerHTML:'',
      children:[],listeners:{},attributes:new Map(),dataset:{},style:{},scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},
      setAttribute(k,v){this.attributes.set(k,String(v))},removeAttribute(k){this.attributes.delete(k)},
      focus(){},blur(){},getContext:()=>context2d,
      append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},
      addEventListener(type,fn){this.listeners[type]=fn},
      getBoundingClientRect:()=>({width:1000,height:610,left:0,top:0}),
      querySelector:()=>node('nested'),querySelectorAll:()=>[],
      click(){if(!this.disabled)this.listeners.click?.({target:this})}};
    return result;
  }
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)},
    createElement:node,querySelectorAll:()=>[],querySelector:()=>node(),addEventListener(){}};
  const window={addEventListener(type,fn){(events.get(type)||events.set(type,[]).get(type)).push(fn)},
    dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event)},
    scrollTo(){},matchMedia:()=>({matches:false})};
  const localStorage={getItem(key){if(denyStorage)throw Error('Storage denied');return values.get(key)??null},
    setItem(key,value){if(denyStorage)throw Error('Storage denied');values.set(key,String(value))},
    removeItem(key){if(denyStorage)throw Error('Storage denied');values.delete(key)}};
  const sandbox={window,document,localStorage,console,
    Event:class{constructor(type){this.type=type}},
    performance:{now:()=>1000},requestAnimationFrame:()=>1,setTimeout:()=>1,clearTimeout(){}};
  runInNewContext(difficultySource,sandbox);
  if(game){
    // Suppress only the optional first-run guide, so all challenge callbacks stay real.
    if(!denyStorage){values.set('thirstTrailTutorial','true');values.set('thirstTrailSound','false')}
    runInNewContext(read('progression.js'),sandbox);
    runInNewContext(valleySource,sandbox);
    runInNewContext(canyonSource,sandbox);
  }
  return {window,nodes,values,sandbox};
}
const click=(app,id)=>app.nodes.get(id).click();
const choose=(app,id,index)=>app.nodes.get(id).children[index].click();
function visitValley(app,x,y){Object.assign(app.window.difficultyValleyTest.get(),{x,y});app.window.difficultyValleyTest.interact()}
function visitCanyon(app,key){
  const test=app.window.difficultyCanyonTest;
  Object.assign(test.get(),test.approaches[key]||test.goals[key]||{x:290,y:520});test.interact();
}
const html=read('index.html');
assert.ok(html.indexOf('src="difficulty.js"')>=0&&html.indexOf('src="difficulty.js"')<html.indexOf('src="script.js"'));
for(const id of ['difficultyEasy','difficultyNormal','difficultyHard','valleyDifficulty','canyonDifficulty'])
  assert.ok(html.includes(`id="${id}"`),`Difficulty UI includes ${id}`);

const preferences=boot(new Map(),{game:false});
const policy=preferences.window.TrailDifficulty;
assert.equal(policy.selected(),'normal','A first visit preserves the original game balance');
for(const invalid of [undefined,null,{},'unknown','toString','__proto__','constructor']){
  assert.equal(policy.normalize(invalid),'normal','Malformed modes cannot access inherited profile properties');
  assert.equal(policy.get(invalid).id,'normal');
}
for(const [id,expected] of Object.entries(profiles)){
  const profile=policy.get(id);
  assert.equal(profile.id,id);
  for(const [key,value] of Object.entries(expected))assert.equal(profile[key],value,`${id} ${key}`);
}
policy.select('hard');
assert.equal(boot(preferences.values,{game:false}).window.TrailDifficulty.selected(),'hard','Preference survives a new page');
const denied=boot(new Map(),{denyStorage:true,game:false});
denied.window.TrailDifficulty.select('easy');
assert.equal(denied.window.TrailDifficulty.selected(),'easy','Storage restrictions retain session preference');
console.log('✓ Shared profiles, invalid values, persistent preference and storage-denied selection');

for(const [id,profile] of Object.entries(profiles)){
  const app=boot(),{window:w}=app,p=w.TrailProgress;
  const state=()=>w.difficultyValleyTest.get();
  w.TrailDifficulty.select(id);click(app,'startButton');
  assert.equal(w.ThirstTrail.snapshot().difficulty,id);
  assert.equal(p.saved('valley').difficulty,id,'Initial checkpoint contains the chosen mode');
  // Movement consumes scaled energy while leaving the movement speed unchanged.
  const oldX=state().x;state().keys.add('d');w.difficultyValleyTest.handleMovement(.05);state().keys.clear();
  near(state().x-oldX,215*.05,'Walking speed is consistent across modes');
  near(100-state().energy,215*.05*.014*profile.energyCost,'Valley movement cost');
  state().energy=100;visitValley(app,705,610);choose(app,'modalChoices',0);
  near(state().energy,100-6*profile.energyCost,'Unsafe quiz answer uses the selected cost');
  assert.match(app.nodes.get('modalTip').textContent,new RegExp(String(Math.round(6*profile.energyCost*100)/100).replace('.','\\.')),'Penalty feedback matches the actual mode cost');
  // Choosing another home preference cannot rebalance an expedition already in progress.
  w.TrailDifficulty.select(id==='hard'?'easy':'hard');
  choose(app,'modalChoices',0);
  near(state().energy,100-12*profile.energyCost,'An active expedition keeps its own difficulty');
  assert.equal(state().difficulty,id);
  click(app,'valleyChapters');click(app,'valleyChapter');
  assert.equal(state().difficulty,id,'Continue ignores a different new-expedition preference');
  assert.equal(p.saved('valley').difficulty,id,'Continue keeps the mode in the refreshed checkpoint');
  // A fresh start uses the currently selected setting; then return to this fixture mode.
  click(app,'startButton');assert.equal(state().difficulty,id==='hard'?'easy':'hard');
  w.TrailDifficulty.select(id);click(app,'startButton');
  for(let use=0;use<profile.campUses;use++){
    state().energy=10;visitValley(app,540,350);choose(app,'modalChoices',0);
    near(state().energy,10+profile.campRecovery,'Camp recovery');
    assert.equal(state().campUses,use+1);
  }
  state().energy=10;visitValley(app,540,350);choose(app,'modalChoices',0);
  assert.equal(state().energy,10,'A used-up camp grants no extra recovery');
  assert.equal(state().campUses,profile.campUses);
  Object.assign(state(),{x:405,y:690});w.difficultyValleyTest.collectNearbySupplies();
  assert.equal(state().energy,10+profile.supplyRecovery,'Sealed supplies follow the selected recovery');
  w.difficultyValleyTest.collectNearbySupplies();
  assert.equal(state().energy,10+profile.supplyRecovery,'Each cache is collected only once');
  state().energy=.1;visitValley(app,705,610);choose(app,'modalChoices',0);
  assert.equal(state().screen,'ended');
  const recovery=app.nodes.get('modalChoices').children.find(n=>n.textContent.includes('Recover at camp'));
  assert.ok(recovery);recovery.click();
  assert.equal(state().energy,profile.recoveryEnergy,'Emergency recovery uses the expedition mode');
  assert.equal(state().difficulty,id);assert.equal(p.saved('valley').difficulty,id);
  assert.equal(state().campUses,profile.campUses,'Emergency recovery preserves consumed rest uses');

  p.complete('valley');w.TrailDifficulty.select(id);w.TrailCanyon.launch(true);
  const c=()=>w.difficultyCanyonTest.get();
  assert.equal(w.TrailCanyon.snapshot().difficulty,id);assert.equal(p.saved('canyon').difficulty,id);
  c().keys.add('d');w.difficultyCanyonTest.update(.05);c().keys.clear();
  near(100-c().energy,.05*.12*profile.energyCost,'Canyon movement cost');
  c().energy=10;visitCanyon(app,'rest');
  assert.equal(c().energy,10+profile.canyonRecovery,'Canyon shelter recovery');
  visitCanyon(app,'surveyor');choose(app,'canyonModalOptions',0);
  visitCanyon(app,'kit');choose(app,'canyonModalOptions',0);
  c().energy=100;visitCanyon(app,'valves');
  const hintVisible=()=>app.nodes.get('canyonModalExtra').children[0].children.some(n=>n.textContent.includes('69 kPa'));
  assert.equal(hintVisible(),profile.valveHintAfter===0,'Easy gives the concrete field note immediately');
  const tested=app.nodes.get('canyonModalOptions').children[0];tested.click();
  near(c().energy,100-4*profile.energyCost,'Wrong valve configuration cost');
  tested.click();near(c().energy,100-4*profile.energyCost,'Stale pressure callback cannot penalize again');
  choose(app,'canyonModalOptions',0);near(c().energy,100-4*profile.energyCost,'Retesting identical settings stays free');
  while(c().failedValveTests.size<profile.valveHintAfter){
    assert.equal(hintVisible(),false,'Normal/Hard do not reveal the solution before their threshold');
    const rows=app.nodes.get('canyonModalExtra').children[0].children;
    // Test only distinct, intentionally unbalanced settings; the regulator stays shut.
    if(c().valves[0]<3)rows[1].children[1].click();else rows[3].children[1].click();
    choose(app,'canyonModalOptions',0);
  }
  assert.equal(hintVisible(),true,'Concrete field note appears at the selected retry threshold');
  choose(app,'canyonModalOptions',1);
  w.TrailDifficulty.select(id==='hard'?'easy':'hard');w.TrailCanyon.suspend();w.TrailCanyon.launch();
  assert.equal(c().difficulty,id,'Canyon Continue preserves its saved difficulty');
  assert.equal(p.saved('canyon').difficulty,id);
  // Preserve the existing nonlethal floor and never grant energy below it.
  c().energy=7;c().keys.add('d');w.difficultyCanyonTest.update(.05);c().keys.clear();
  assert.equal(c().energy,7,'Every difficulty preserves the Canyon recovery floor');
  c().energy=1;c().keys.add('d');w.difficultyCanyonTest.update(.05);c().keys.clear();
  assert.equal(c().energy,1,'Below-floor interrupted state never gains energy from movement');
}
console.log('✓ All modes: real movement, quiz penalties, camp/cache/emergency recovery and Canyon retry guidance');
console.log('✓ Chapter checkpoints retain difficulty, fresh adventures pick preference and active runs remain stable');

// Check old and damaged checkpoints with a different preference already saved.
for(const invalid of [undefined,null,'unknown','__proto__']){
  const app=boot(),{window:w}=app,p=w.TrailProgress;
  w.TrailDifficulty.select('hard');
  p.save('valley',{difficulty:invalid,energy:80,campUses:2,done:[]});click(app,'valleyChapter');
  assert.equal(w.ThirstTrail.snapshot().difficulty,'normal','Legacy Valley uses the original balance');
  assert.equal(p.saved('valley').difficulty,'normal','Legacy checkpoint is stamped after restoring');
  p.complete('valley');p.save('canyon',{difficulty:invalid,energy:80,done:[]});w.TrailCanyon.launch();
  assert.equal(w.TrailCanyon.snapshot().difficulty,'normal','Legacy Canyon uses the original balance');
  assert.equal(p.saved('canyon').difficulty,'normal');
}
console.log('✓ Missing and invalid saved modes migrate to Normal independently of the preferred mode');

for(const id of Object.keys(profiles)){
  const app=boot(),{window:w}=app,other=id==='hard'?'easy':'hard';
  w.TrailDifficulty.select(id);click(app,'startButton');
  const state=w.difficultyValleyTest.get();state.x=420;state.energy=76;
  click(app,'valleyChapters');w.TrailDifficulty.select(other);
  let reloaded=boot(app.values);
  assert.equal(reloaded.window.TrailDifficulty.selected(),other);
  click(reloaded,'valleyChapter');
  assert.equal(reloaded.window.ThirstTrail.snapshot().difficulty,id,'Valley mode survives full page serialization/reload');
  assert.equal(reloaded.window.ThirstTrail.snapshot().x,420);
  const progress=reloaded.window.TrailProgress;
  progress.complete('valley');reloaded.window.TrailDifficulty.select(id);
  reloaded.window.TrailCanyon.launch(true);reloaded.window.difficultyCanyonTest.get().score=123;
  reloaded.window.TrailCanyon.suspend();reloaded.window.TrailDifficulty.select(other);
  reloaded=boot(app.values);reloaded.window.TrailCanyon.launch();
  assert.equal(reloaded.window.TrailCanyon.snapshot().difficulty,id,'Canyon mode survives full page serialization/reload');
  assert.equal(reloaded.window.TrailCanyon.snapshot().score,123);
}
console.log('✓ Both chapters restore serialized difficulty after a fresh VM/page with a different saved preference');

for(const id of Object.keys(profiles)){
  const other=id==='hard'?'easy':'hard';
  const values=new Map([['thirstTrailBest','1111'],['thirstTrailBest_easy','1111'],['thirstTrailBest_hard','1111']]);
  const key=id==='normal'?'thirstTrailBest':`thirstTrailBest_${id}`;values.set(key,'40');
  const app=boot(values),{window:w}=app;
  w.TrailDifficulty.select(id);click(app,'startButton');
  assert.equal(app.nodes.get('highScoreStart').textContent,'40','The selected mode has its own previous best');
  assert.equal(app.nodes.get('highScoreMode').textContent,w.TrailDifficulty.get(id).label);
  // Isolate victory bookkeeping with known earned work. Existing integration
  // tests exercise the full pipeline and quiz before invoking this same path.
  const state=w.difficultyValleyTest.get();
  for(const quest of ['elder','toolkit','gasket','pump'])state.done.add(quest);
  Object.assign(state,{score:100,energy:60,elapsed:300});
  w.TrailDifficulty.select(other);w.difficultyValleyTest.end(true,'Difficulty score fixture');
  assert.equal(state.score,280,'The original energy/time score formula remains intact');
  assert.equal(values.get(key),'280','Victory records the actual run mode, independently of the current preference');
  for(const mode of Object.keys(profiles))if(mode!==id){
    const untouched=mode==='normal'?'thirstTrailBest':`thirstTrailBest_${mode}`;
    assert.equal(values.get(untouched),'1111','A victory cannot overwrite another difficulty best');
  }
  assert.equal(app.nodes.get('highScoreStart').textContent,'1,111','Home high score follows the selected mode');
  assert.equal(app.nodes.get('highScoreMode').textContent,w.TrailDifficulty.get(other).label);
  const enter=app.nodes.get('modalChoices').children.find(n=>n.textContent.includes('Enter the Forgotten Canyon'));
  assert.ok(enter);enter.click();
  assert.equal(w.TrailCanyon.snapshot().difficulty,id,'Direct chapter transition inherits the completed run mode');
  assert.equal(w.TrailProgress.saved('canyon').difficulty,id);
  // Resume takes priority over the transition mode so earned Canyon work is safe.
  w.TrailCanyon.goHome();w.TrailProgress.save('canyon',{difficulty:other,score:654,energy:80});
  w.TrailDifficulty.select(id);click(app,'startButton');
  const replay=w.difficultyValleyTest.get();
  for(const quest of ['elder','toolkit','gasket','pump'])replay.done.add(quest);
  Object.assign(replay,{score:0,energy:1,elapsed:300});
  w.difficultyValleyTest.end(true,'Lower-score replay fixture');
  assert.equal(values.get(key),'280','A lower replay score keeps the previous mode best');
  app.nodes.get('modalChoices').children.find(n=>n.textContent.includes('Enter the Forgotten Canyon')).click();
  assert.equal(w.TrailCanyon.snapshot().difficulty,other,'An existing Canyon checkpoint retains its mode during the direct transition');
  assert.equal(w.TrailCanyon.snapshot().score,654,'Direct transition preserves the existing Canyon checkpoint');
}
console.log('✓ Per-mode best scores preserve legacy Normal records; direct Canyon entry inherits the run or resumes its saved mode');

