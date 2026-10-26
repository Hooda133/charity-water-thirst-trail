"use strict";
/* Thirst Trail 2.0 — versioned, defensive local progress persistence.
   Legacy high scores and preferences remain stored under their original keys. */
(() => {
  const KEY="thirstTrailProgressV2",BACKUP=KEY+"Backup";
  const levels=Object.freeze(["valley","canyon"]),MAX_CHECKPOINT=12000,MAX_PROGRESS=32000;
  const blank=()=>({version:2,unlocked:["valley"],completed:[],saves:{},lastLevel:"valley",revision:0});
  const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  function checkpoint(value){
    if(!object(value))return null;
    try{
      const json=JSON.stringify(value);
      if(json.length>=MAX_CHECKPOINT)return null;
      const parsed=JSON.parse(json);return object(parsed)?parsed:null;
    }catch{return null;} // Cycles, BigInt and unavailable custom serializers are not save data.
  }
  function normalize(data){
    if(!object(data)||![undefined,1,2].includes(data.version))return null;
    // Migrate only recognized chapter fields from older snapshots. Salvage them
    // rather than erase a whole expedition when one optional field is missing.
    if(data.version===undefined&&!('unlocked' in data||'completed' in data||'saves' in data))return null;
    const completed=levels.filter(x=>Array.isArray(data.completed)&&data.completed.includes(x));
    // A finished Canyon proves Valley was finished, even if its flag was damaged.
    if(completed.includes("canyon")&&!completed.includes("valley"))completed.unshift("valley");
    const unlocked=levels.filter(x=>x==="valley"||completed.includes(x)||
      (x==="canyon"&&completed.includes("valley"))||
      (Array.isArray(data.unlocked)&&data.unlocked.includes(x)));
    const saves={};
    for(const name of levels){
      const row=object(data.saves)?checkpoint(data.saves[name]):null;
      if(row&&unlocked.includes(name))saves[name]=row;
    }
    return {version:2,completed,unlocked,saves,
      lastLevel:unlocked.includes(data.lastLevel)?data.lastLevel:"valley",
      revision:Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0};
  }
  let newerSave=false,status={persisted:true,reason:null};
  function read(){
    const candidates=[];
    let readable=false;
    for(const key of [KEY,BACKUP]){
      try{
        const raw=localStorage.getItem(key);readable=true;
        if(!raw||raw.length>MAX_PROGRESS)continue;
        const parsed=JSON.parse(raw);
        if(object(parsed)&&Number(parsed.version)>2){newerSave=true;continue;}
        const data=normalize(parsed);
        if(data){
          // Prefer an intact copy over a newer record whose collections were
          // damaged. Do not combine checkpoint maps: a completed chapter may
          // intentionally have cleared an older replay checkpoint.
          const intact=Array.isArray(parsed.unlocked)&&Array.isArray(parsed.completed)&&object(parsed.saves)&&
            levels.every(name=>parsed.saves[name]===undefined||checkpoint(parsed.saves[name])!==null);
          candidates.push({data,intact});
        }
      }catch{/* A broken primary can still be recovered from the independent backup. */}
    }
    status={persisted:readable&&!newerSave,reason:newerSave?"newer-save":readable?null:"unavailable"};
    return candidates.sort((a,b)=>Number(b.intact)-Number(a.intact)||b.data.revision-a.data.revision)[0]?.data||blank();
  }
  // Memory is authoritative during this page's lifetime. Storage restrictions must
  // never relock Chapter 2 or discard a checkpoint while the player is still here.
  let current=read();
  function write(data){
    data.revision=Math.min(Number.MAX_SAFE_INTEGER,current.revision+1);
    current=data;
    let persisted=false;
    if(!newerSave){
      const json=JSON.stringify(data);
      for(const key of [KEY,BACKUP]){
        try{localStorage.setItem(key,json);persisted=true;}catch{/* Keep playing with the session checkpoint. */}
      }
    }
    status={persisted,reason:newerSave?"newer-save":persisted?null:"unavailable"};
    try{window.dispatchEvent(new Event("trail:progress"));}catch{/* optional event */}
    return persisted;
  }
  function snapshot(){return clone(current);}
  function unlocked(level){return current.unlocked.includes(level);}
  function save(level,value){
    if(!levels.includes(level)||!current.unlocked.includes(level))return false;
    const row=checkpoint(value);
    if(!row)return false;
    const data=snapshot();
    // A replay keeps the completion badge and gets its own resumable checkpoint.
    const stamped=checkpoint({...row,savedAt:Date.now()});
    if(!stamped)return false;
    data.saves[level]=stamped;
    data.lastLevel=level;return write(data);
  }
  function saved(level){return levels.includes(level)&&current.saves[level]?clone(current.saves[level]):null;}
  function complete(level){
    if(!levels.includes(level)||!current.unlocked.includes(level))return false;
    const data=snapshot();
    if(!data.completed.includes(level))data.completed.push(level);
    if(level==="valley"&&!data.unlocked.includes("canyon"))data.unlocked.push("canyon");
    delete data.saves[level];data.lastLevel=level;
    return write(data);
  }
  function clearSave(level){
    if(!levels.includes(level))return false;
    const data=snapshot();delete data.saves[level];return write(data);
  }
  function storageStatus(){return {...status};}
  window.TrailProgress=Object.freeze({snapshot,unlocked,save,saved,complete,clearSave,storageStatus,levels});
})();
