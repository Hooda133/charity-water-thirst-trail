"use strict";
/* Shared difficulty preference. Legacy play-style IDs keep existing saves usable. */
(() => {
  const KEY="thirstTrailMode";
  const profiles=Object.freeze({
    explorer:Object.freeze({id:"explorer",label:"Easy",difficulty:"easy",energyMultiplier:.35,
      mistakeMultiplier:.5,hints:true,bonusObjectives:false,pressureMin:65,pressureMax:73,deliveryRequest:4}),
    normal:Object.freeze({id:"normal",label:"Normal",difficulty:"normal",energyMultiplier:1,
      mistakeMultiplier:1,hints:false,bonusObjectives:false,pressureMin:65,pressureMax:73,deliveryRequest:4}),
    challenge:Object.freeze({id:"challenge",label:"Hard",difficulty:"hard",energyMultiplier:1.2,
      mistakeMultiplier:1.5,hints:false,bonusObjectives:true,pressureMin:67,pressureMax:71,deliveryRequest:6})
  });
  const difficultyIds=Object.freeze({easy:"explorer",normal:"normal",hard:"challenge"});
  const valid=value=>typeof value==="string"&&Object.prototype.hasOwnProperty.call(profiles,value);
  let selected="explorer";
  try{const value=localStorage.getItem(KEY);if(valid(value))selected=value;}catch{/* preferences are optional */}
  function get(){return selected;}
  function profile(){return {...profiles[selected]};}
  function getDifficulty(){return profiles[selected].difficulty;}
  function set(value){
    if(!valid(value))return false;
    selected=value;
    try{localStorage.setItem(KEY,value);}catch{/* keep the selected style for this session */}
    try{window.dispatchEvent(new Event("trail:mode"));}catch{/* no event host in isolated tests */}
    return true;
  }
  function setDifficulty(value){
    return typeof value==="string"&&Object.prototype.hasOwnProperty.call(difficultyIds,value)?set(difficultyIds[value]):false;
  }
  window.TrailMode=Object.freeze({get,set,profile,getDifficulty,setDifficulty});
})();
