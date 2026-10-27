"use strict";
/* Shared play-style preference. A blocked store still permits the current game. */
(() => {
  const KEY="thirstTrailMode";
  const profiles=Object.freeze({
    explorer:Object.freeze({id:"explorer",label:"Explorer",energyMultiplier:.35,hints:true,bonusObjectives:false}),
    challenge:Object.freeze({id:"challenge",label:"Challenge",energyMultiplier:1.2,hints:false,bonusObjectives:true})
  });
  const valid=value=>typeof value==="string"&&Object.prototype.hasOwnProperty.call(profiles,value);
  let selected="explorer";
  try{const value=localStorage.getItem(KEY);if(valid(value))selected=value;}catch{/* preferences are optional */}
  function get(){return selected;}
  function profile(){return {...profiles[selected]};}
  function set(value){
    if(!valid(value))return false;
    selected=value;
    try{localStorage.setItem(KEY,value);}catch{/* keep the selected style for this session */}
    try{window.dispatchEvent(new Event("trail:mode"));}catch{/* no event host in isolated tests */}
    return true;
  }
  window.TrailMode=Object.freeze({get,set,profile});
})();
