#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("../expedition-mode.js",import.meta.url),"utf8");
const KEY="thirstTrailMode";
function boot(values=new Map(),{denyRead=false,denyWrite=false}={}){
  const events=[];
  const localStorage={
    getItem(key){if(denyRead)throw Error("Storage denied");return values.get(key)??null},
    setItem(key,value){if(denyWrite)throw Error("Storage denied");values.set(key,String(value))}
  };
  const window={dispatchEvent(event){events.push(event.type)}};
  runInNewContext(source,{window,localStorage,Event:class{constructor(type){this.type=type}}});
  return {mode:window.TrailMode,values,events};
}
const expected={
  explorer:{id:"explorer",label:"Easy",difficulty:"easy",energyMultiplier:.35,mistakeMultiplier:.5,
    hints:true,bonusObjectives:false,pressureMin:65,pressureMax:73,deliveryRequest:4},
  normal:{id:"normal",label:"Normal",difficulty:"normal",energyMultiplier:1,mistakeMultiplier:1,
    hints:false,bonusObjectives:false,pressureMin:65,pressureMax:73,deliveryRequest:4},
  challenge:{id:"challenge",label:"Hard",difficulty:"hard",energyMultiplier:1.2,mistakeMultiplier:1.5,
    hints:false,bonusObjectives:true,pressureMin:67,pressureMax:71,deliveryRequest:6}
};
const plain=value=>JSON.parse(JSON.stringify(value));
const first=boot();
assert.equal(first.mode.get(),"explorer","First-time players retain relaxed Explorer/Easy mode");
assert.equal(first.mode.getDifficulty(),"easy");
assert.deepEqual(plain(first.mode.profile()),expected.explorer);
for(const [id,profile] of Object.entries(expected)){
  const values=new Map([["thirstTrailProgressV2",'{"completed":["valley","canyon"]}'],["thirstTrailGraphics",'{"preset":"high"}']]);
  const session=boot(values);
  assert.equal(session.mode.set(id),true);
  assert.equal(session.values.get(KEY),id,"Canonical mode IDs remain in the original preference key");
  assert.deepEqual(plain(session.mode.profile()),profile);
  assert.equal(session.mode.getDifficulty(),profile.difficulty);
  assert.deepEqual(session.events,["trail:mode"]);
  const reload=boot(values);
  assert.equal(reload.mode.get(),id,"Every difficulty survives reload, including legacy IDs");
  assert.deepEqual(plain(reload.mode.profile()),profile);
  assert.equal(values.get("thirstTrailProgressV2"),'{"completed":["valley","canyon"]}',"Difficulty changes preserve chapter/community saves");
  assert.equal(values.get("thirstTrailGraphics"),'{"preset":"high"}',"Difficulty is independent of graphics quality");
  const copy=reload.mode.profile();
  copy.energyMultiplier=99;copy.id="different";copy.deliveryRequest=99;
  assert.deepEqual(plain(reload.mode.profile()),profile,"Callers cannot mutate shared profile definitions through copies");
  assert.notEqual(reload.mode.profile(),reload.mode.profile(),"Each caller receives its own profile object");
}
const aliases=boot();
for(const [difficulty,id] of [["hard","challenge"],["normal","normal"],["easy","explorer"]]){
  assert.equal(aliases.mode.setDifficulty(difficulty),true);
  assert.equal(aliases.mode.get(),id);
  assert.equal(aliases.mode.getDifficulty(),difficulty);
  assert.equal(aliases.values.get(KEY),id);
}
assert.deepEqual(aliases.events,["trail:mode","trail:mode","trail:mode"]);
const rejected=boot(new Map([[KEY,"challenge"]]));
for(const invalid of [null,undefined,"",0,{},[],"toString","__proto__","hard","easy","Explorer","Normal"]){
  assert.equal(rejected.mode.set(invalid),false,"Canonical setter accepts only recognized stored IDs");
  assert.equal(rejected.mode.get(),"challenge");
}
for(const invalid of [null,undefined,"",0,{},[],"toString","__proto__","explorer","challenge","Hard","Normal"]){
  assert.equal(rejected.mode.setDifficulty(invalid),false,"UI setter accepts only the three difficulty names");
  assert.equal(rejected.mode.getDifficulty(),"hard");
}
assert.deepEqual(rejected.events,[],"Rejected changes do not emit UI updates");
for(const raw of ["invalid","{broken","null","toString","__proto__","easy","hard",""]){
  assert.equal(boot(new Map([[KEY,raw]])).mode.get(),"explorer","Malformed stored preferences safely use Easy");
}
const blocked=boot(new Map(),{denyRead:true,denyWrite:true});
assert.equal(blocked.mode.get(),"explorer");
for(const difficulty of ["normal","hard","easy"]){
  assert.equal(blocked.mode.setDifficulty(difficulty),true,"Unavailable storage does not block difficulty changes");
  assert.equal(blocked.mode.getDifficulty(),difficulty);
}
assert.deepEqual(blocked.events,["trail:mode","trail:mode","trail:mode"]);
assert.equal(Object.isFrozen(first.mode),true);
console.log("✓ Easy/Normal/Hard profiles, resource and puzzle settings, defensive copies and live events");
console.log("✓ Legacy preference migration, all-three reloads, difficulty aliases and unchanged progress/graphics saves");
console.log("✓ Invalid names and unavailable storage keep difficulty selection usable without stale UI events");
