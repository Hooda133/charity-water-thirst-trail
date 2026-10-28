"use strict";
/* Shared expedition balancing. A preference affects new runs; checkpoints own their mode. */
(() => {
  const KEY="thirstTrailDifficulty";
  const modes=Object.freeze({
    easy:Object.freeze({id:"easy",label:"Easy",energyCost:.65,campUses:3,campRecovery:48,
      supplyRecovery:18,recoveryEnergy:65,canyonRecovery:51,valveHintAfter:0}),
    normal:Object.freeze({id:"normal",label:"Normal",energyCost:1,campUses:2,campRecovery:32,
      supplyRecovery:12,recoveryEnergy:50,canyonRecovery:34,valveHintAfter:2}),
    hard:Object.freeze({id:"hard",label:"Hard",energyCost:1.4,campUses:1,campRecovery:24,
      supplyRecovery:9,recoveryEnergy:35,canyonRecovery:26,valveHintAfter:4})
  });
  const normalize=value=>typeof value==="string"&&Object.hasOwn(modes,value)?value:"normal";
  const get=value=>modes[normalize(value)];
  let preference="normal";
  try{preference=normalize(localStorage.getItem(KEY));}catch{/* Session preferences work without storage. */}
  const selected=()=>preference;
  const descriptions={
    easy:"35% less energy use · 3 camp rests (+48 each) · immediate canyon valve hints.",
    normal:"Original energy use · 2 camp rests (+32 each) · canyon valve hints after 2 failed settings.",
    hard:"40% more energy use · 1 camp rest (+24) · canyon valve hints after 4 failed settings."
  };
  function reflect(){
    if(typeof document==="undefined")return;
    for(const profile of Object.values(modes)){
      const input=document.getElementById?.("difficulty"+profile.label);
      if(input)input.checked=profile.id===preference;
    }
    const note=document.getElementById?.("difficultyNote");
    if(note)note.textContent=descriptions[preference]+" Applies to new expeditions. Saved chapters keep their difficulty.";
  }
  function select(value){
    preference=normalize(value);
    try{localStorage.setItem(KEY,preference);}catch{/* Keep the selection for this page. */}
    reflect();
    try{
      const detail={id:preference,profile:get(preference)};
      const event=typeof CustomEvent==="function"?new CustomEvent("trail:difficulty",{detail}):
        Object.assign(new Event("trail:difficulty"),{detail});
      window.dispatchEvent(event);
    }catch{/* Event support is optional for standalone logic checks. */}
    return preference;
  }
  window.TrailDifficulty=Object.freeze({modes,normalize,get,selected,select});
  function bind(){
    if(typeof document==="undefined")return;
    for(const profile of Object.values(modes)){
      const input=document.getElementById?.("difficulty"+profile.label);
      input?.addEventListener?.("change",()=>{if(input.checked)select(profile.id);});
    }
    reflect();
  }
  // Deferred scripts run after the form exists; also support a direct script include.
  if(typeof document!=="undefined"&&document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
