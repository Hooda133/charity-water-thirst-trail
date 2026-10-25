"use strict";
/* Thirst Trail 2.0 — versioned, defensive local progress persistence.
   Legacy high scores and preferences remain stored under their original keys. */
(() => {
  const KEY="thirstTrailProgressV2";
  const levels=["valley","canyon"];
  const blank=()=>({version:2,unlocked:["valley"],completed:[],saves:{},lastLevel:"valley"});
  function read(){
    let data;
    try{data=JSON.parse(localStorage.getItem(KEY)||"null");}catch{return blank();}
    if(!data||data.version!==2||!Array.isArray(data.unlocked)||!Array.isArray(data.completed)||!data.saves||typeof data.saves!=="object")return blank();
    const completed=levels.filter(x=>data.completed.includes(x));
    const unlocked=levels.filter(x=>data.unlocked.includes(x)||x==="valley"||(x==="canyon"&&completed.includes("valley")));
    const saves={};
    for(const name of levels){
      const row=data.saves[name];
      if(row&&typeof row==="object"&&!Array.isArray(row)&&JSON.stringify(row).length<12000) saves[name]=row;
    }
    return {version:2,completed,unlocked,saves,lastLevel:levels.includes(data.lastLevel)?data.lastLevel:"valley"};
  }
  function write(data){
    try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* Private mode/storage full: gameplay still works. */}
    try{window.dispatchEvent(new Event("trail:progress"));}catch{/* optional event */}
    return data;
  }
  function snapshot(){return read();}
  function unlocked(level){return read().unlocked.includes(level);}
  function save(level,value){
    if(!levels.includes(level)||!value||typeof value!=="object")return false;
    const data=read();
    // Completion keeps a chapter unlocked; a later replay still needs its own
    // resumable checkpoint. Completing that replay clears the checkpoint again.
    if(!data.unlocked.includes(level))return false;
    data.saves[level]={...value,savedAt:Date.now()};
    data.lastLevel=level;write(data);
    return true;
  }
  function saved(level){return read().saves[level]||null;}
  function complete(level){
    if(!levels.includes(level))return false;
    const data=read();
    if(!data.unlocked.includes(level))return false;
    if(!data.completed.includes(level))data.completed.push(level);
    if(level==="valley"&&!data.unlocked.includes("canyon"))data.unlocked.push("canyon");
    delete data.saves[level];data.lastLevel=level;
    write(data);return true;
  }
  function clearSave(level){
    if(!levels.includes(level))return;
    const data=read();delete data.saves[level];write(data);
  }
  window.TrailProgress=Object.freeze({snapshot,unlocked,save,saved,complete,clearSave,levels:[...levels]});
})();
