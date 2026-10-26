#!/usr/bin/env node
// Exercise the public save API across real serialization/reload boundaries.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../progression.js",import.meta.url),"utf8");
const KEY="thirstTrailProgressV2",BACKUP=KEY+"Backup";
function boot(values=new Map(),{denyRead=false,denyWrite=false,denyPrimary=false}={}){
  let events=0;
  const localStorage={
    getItem(key){if(denyRead)throw Error("Storage denied");return values.get(key)??null;},
    setItem(key,value){if(denyWrite||(denyPrimary&&key===KEY))throw Error("Storage full");values.set(key,String(value));}
  };
  const window={dispatchEvent(){events++;}};
  runInNewContext(source,{localStorage,window,Event:class{constructor(type){this.type=type;}}});
  return {progress:window.TrailProgress,values,events:()=>events};
}
const {progress:p,values,events}=boot();
assert.deepEqual(Array.from(p.snapshot().unlocked),["valley"]);
assert.equal(p.save("canyon",{done:[]}),false,"Locked chapters cannot acquire checkpoints");
assert.equal(p.complete("canyon"),false);
for(const key of ["toString","__proto__","constructor","unknown",null,undefined]){
  assert.equal(p.saved(key),null,"Unknown chapter names never read inherited object properties");
}
assert.equal(p.save("valley",{done:["elder"],inventory:[],energy:54}),true);
assert.equal(events(),1);
let restored=boot(values).progress;
assert.equal(restored.saved("valley").energy,54,"Checkpoints survive a fresh page");
assert.equal(p.complete("valley"),true);
assert.equal(p.unlocked("canyon"),true);
assert.equal(p.saved("valley"),null);
p.save("canyon",{done:["surveyor","kit"],repairStep:2});
restored=boot(values).progress;
assert.equal(restored.unlocked("canyon"),true);
assert.equal(restored.saved("canyon").repairStep,2);
assert.equal(restored.complete("canyon"),true);
assert.equal(restored.save("canyon",{done:[],score:0}),true,"Completed chapters can save a replay");
assert.ok(restored.snapshot().completed.includes("canyon"));
assert.equal(restored.clearSave("canyon"),true);
assert.equal(boot(values).progress.saved("canyon"),null);

const defensive=boot().progress;
const input={done:["elder"],inventory:["toolkit"]};
defensive.save("valley",input);
input.done.push("pump");
const output=defensive.saved("valley");output.inventory.length=0;
const snapshot=defensive.snapshot();snapshot.unlocked.push("canyon");snapshot.saves.valley.done.push("gasket");
assert.equal(defensive.unlocked("canyon"),false);
assert.deepEqual(Array.from(defensive.saved("valley").done),["elder"]);
assert.deepEqual(Array.from(defensive.saved("valley").inventory),["toolkit"]);
const cyclic={};cyclic.self=cyclic;
for(const invalid of [[],null,cyclic,{value:1n},{huge:"x".repeat(12000)},{toJSON(){return "bad row";}}]){
  assert.equal(defensive.save("valley",invalid),false,"Invalid checkpoints are rejected without replacing a good save");
}
assert.ok(defensive.saved("valley"));

// A single bad field must not destroy independent valid progress.
const old={version:1,completed:["valley","made-up"],saves:{valley:[],canyon:{repairStep:3}},lastLevel:"canyon"};
const migrated=boot(new Map([[KEY,JSON.stringify(old)]])).progress;
assert.equal(migrated.unlocked("canyon"),true);
assert.equal(migrated.saved("valley"),null);
assert.equal(migrated.saved("canyon").repairStep,3);
assert.equal(migrated.snapshot().version,2);
const damaged=boot(new Map([[KEY,JSON.stringify({version:2,completed:["canyon"],unlocked:null,saves:"broken",lastLevel:"unknown"})]])).progress;
assert.ok(damaged.snapshot().completed.includes("valley"));
assert.equal(damaged.unlocked("canyon"),true);
assert.equal(damaged.snapshot().lastLevel,"valley");
for(const raw of ["{broken",JSON.stringify([]),JSON.stringify(null),"x".repeat(33000)]){
  const recovered=boot(new Map([[KEY,raw],[BACKUP,JSON.stringify(old)]])).progress;
  assert.equal(recovered.saved("canyon").repairStep,3,"Corrupted primary recovers the last good backup");
}

// Parseable corruption also needs backup recovery; a larger revision alone must
// not give malformed collection fields priority over a healthy checkpoint.
const healthy={version:2,revision:4,unlocked:["valley","canyon"],completed:["valley"],saves:{canyon:{done:["surveyor","kit"],repairStep:2}},lastLevel:"canyon"};
for(const changes of [{unlocked:null},{completed:"broken"},{saves:null},{saves:{canyon:[]}}]){
  const corrupt={...healthy,revision:5,...changes};
  const repaired=boot(new Map([[KEY,JSON.stringify(corrupt)],[BACKUP,JSON.stringify(healthy)]])).progress;
  assert.equal(repaired.snapshot().revision,4,"An intact backup outranks structurally damaged newer data");
  assert.equal(repaired.unlocked("canyon"),true);
  assert.equal(repaired.saved("canyon").repairStep,2);
}
const finished={...healthy,revision:6,completed:["valley","canyon"],saves:{}};
const completion=boot(new Map([[KEY,JSON.stringify(finished)],[BACKUP,JSON.stringify(healthy)]])).progress;
assert.equal(completion.saved("canyon"),null,"An old checkpoint must not be merged into a completed primary");
assert.ok(completion.snapshot().completed.includes("canyon"));
const salvage=boot(new Map([[KEY,JSON.stringify({...healthy,unlocked:null,revision:7})]])).progress;
assert.equal(salvage.unlocked("canyon"),true,"Without an intact copy, valid fields still survive repair");
assert.equal(salvage.saved("canyon").repairStep,2);

// Browser restrictions must not prevent the player from continuing this session.
for(const options of [{denyRead:true,denyWrite:true},{denyWrite:true}]){
  const session=boot(new Map(),options).progress;
  assert.equal(session.save("valley",{done:["elder"]}),false);
  assert.equal(session.saved("valley").done[0],"elder");
  assert.equal(session.complete("valley"),false,"Return value describes persistence, not session progression");
  assert.equal(session.unlocked("canyon"),true);
  assert.equal(session.save("canyon",{repairStep:2}),false);
  assert.equal(session.saved("canyon").repairStep,2);
  assert.equal(session.storageStatus().reason,"unavailable");
}
const partial=boot(new Map(),{denyPrimary:true});
assert.equal(partial.progress.complete("valley"),true,"An independent backup can persist if the primary key fails");
assert.equal(boot(partial.values).progress.unlocked("canyon"),true);
const futureRaw=JSON.stringify({version:3,completed:["valley"],saves:{valley:{unknown:true}}});
const future=boot(new Map([[KEY,futureRaw]]));
assert.equal(future.progress.complete("valley"),false);
assert.equal(future.progress.unlocked("canyon"),true);
assert.equal(future.values.get(KEY),futureRaw,"An older game never overwrites a newer save format");
assert.equal(future.progress.storageStatus().reason,"newer-save");
console.log("✓ Save/reload, unlock, completion and replay persistence");
console.log("✓ Snapshot isolation and invalid/oversized/cyclic checkpoint rejection");
console.log("✓ Legacy migration, field repair and corrupt/parseable-damaged primary backup recovery");
console.log("✓ Storage-denied session continuity and future-version preservation");
