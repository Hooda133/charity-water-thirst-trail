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
const first=boot();
assert.equal(first.mode.get(),"explorer","First-time players receive relaxed Explorer mode");
assert.equal(first.mode.profile().energyMultiplier,.35);
assert.equal(first.mode.profile().hints,true);
assert.equal(first.mode.profile().bonusObjectives,false);
assert.equal(first.mode.set("challenge"),true);
assert.equal(first.values.get(KEY),"challenge");
assert.equal(first.mode.get(),"challenge");
assert.equal(first.mode.profile().energyMultiplier,1.2);
assert.equal(first.mode.profile().hints,false);
assert.equal(first.mode.profile().bonusObjectives,true);
assert.deepEqual(first.events,["trail:mode"]);
const reload=boot(first.values);
assert.equal(reload.mode.get(),"challenge","The chosen mode survives reload");
const copy=reload.mode.profile();copy.energyMultiplier=99;copy.id="explorer";
assert.equal(reload.mode.profile().energyMultiplier,1.2,"Callers cannot mutate the selected profile");
assert.equal(reload.mode.get(),"challenge");
for(const invalid of [null,undefined,"",0,{},[],"toString","__proto__","hard","Explorer"]){
  assert.equal(reload.mode.set(invalid),false,"Only recognized mode names are accepted");
  assert.equal(reload.mode.get(),"challenge");
}
assert.equal(reload.events.length,0,"Rejected mode changes do not emit UI updates");
assert.equal(reload.mode.set("explorer"),true);
assert.equal(boot(first.values).mode.get(),"explorer");
for(const raw of ["invalid","{broken","null","toString",""]){
  assert.equal(boot(new Map([[KEY,raw]])).mode.get(),"explorer","Malformed stored preferences safely use Explorer");
}
const blocked=boot(new Map(),{denyRead:true,denyWrite:true});
assert.equal(blocked.mode.get(),"explorer");
assert.equal(blocked.mode.set("challenge"),true,"Storage denial does not block selecting a mode");
assert.equal(blocked.mode.get(),"challenge");
assert.equal(blocked.mode.profile().bonusObjectives,true);
assert.deepEqual(blocked.events,["trail:mode"]);
assert.equal(Object.isFrozen(first.mode),true);
console.log("✓ Explorer/Challenge defaults, persistence, profile isolation and accepted mode events");
console.log("✓ Invalid preferences and unavailable storage keep play-style selection usable");
