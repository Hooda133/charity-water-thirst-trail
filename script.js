"use strict";
/* Thirst Trail: The Last Well — dependency-free adventure, built with HTML, CSS and JavaScript. */
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) { $("startTitle").textContent = "This browser cannot start the game."; return; }
  const W = 1800, H = 1100, VW = 1000, VH = 610;
  const spots = {
    elder:    {x:280,y:490, name:"Village Elder",  icon:"👵", kind:"story", color:"#ffd344", hint:"Hear the village's story"},
    toolkit:  {x:455,y:765, name:"Workshop",      icon:"🧰", kind:"quest", color:"#ffd344", hint:"Pick up the repair tools"},
    camp:     {x:540,y:350, name:"Rest Camp",     icon:"⛺", kind:"rest",  color:"#85edae", hint:"Restore energy (2 uses)"},
    river:    {x:705,y:610, name:"River Bank",    icon:"🔬", kind:"bonus",color:"#6fe1f2", hint:"Investigate the water"},
    gasket:   {x:1190,y:825,name:"Supply Depot", icon:"📦", kind:"quest", color:"#ffd344", hint:"Find a replacement gasket"},
    pump:     {x:1540,y:690,name:"Old Water Pump",icon:"⚙️",kind:"quest", color:"#ffd344", hint:"Repair the village pump"},
    spring:   {x:1460,y:265,name:"Hill Spring",   icon:"💧", kind:"bonus",color:"#6fe1f2", hint:"Explore an alternative source"}
  };
  const questDefs = [
    {key:"elder",title:"Meet the village elder", detail:"Learn what the village needs",icon:"💬"},
    {key:"toolkit",title:"Collect a repair toolkit",detail:"Visit the old workshop",icon:"🧰"},
    {key:"gasket",title:"Find a replacement gasket",detail:"Search the supply depot",icon:"📦"},
    {key:"pump",title:"Restore the village pump",detail:"Complete the repair challenge",icon:"⚙️"}
  ];
  const safeStore = {
    get() {try{return Number(localStorage.getItem("thirstTrailBest"))||0;}catch{return 0;}},
    set(v) {try{localStorage.setItem("thirstTrailBest",String(v));}catch{/* optional storage */}},
    getSound() {try{return localStorage.getItem("thirstTrailSound")!=="false";}catch{return true;}},
    setSound(v) {try{localStorage.setItem("thirstTrailSound",String(v));}catch{/* optional storage */}},
    tutorialSeen() {try{return localStorage.getItem("thirstTrailTutorial")==="true";}catch{return false;}},
    markTutorialSeen() {try{localStorage.setItem("thirstTrailTutorial","true");}catch{/* optional storage */}}
  };
  const state = {
    screen:"start", energy:100, score:0, elapsed:0, x:310, y:620, moving:false,
    walkT:0, facing:1, keys:new Set(), touch:new Set(), path:[], goal:null, destination:null,
    done:new Set(), inventory:new Set(), campUses:0, quizStep:0, modalOpen:false, modalKind:"",
    sound:safeStore.getSound(), cameraX:0, cameraY:0, nearby:null, ended:false, lastStatus:"",
    toastTimeout:null
  };
  let audioContext = null;
  function tone(freq=620,duration=.09){
    if (!state.sound) return;
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      audioContext = audioContext || new AudioClass();
      const o=audioContext.createOscillator(),g=audioContext.createGain();
      o.type="sine";o.frequency.setValueAtTime(freq,audioContext.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(100,freq*.7),audioContext.currentTime+duration);
      g.gain.setValueAtTime(.032,audioContext.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);
      o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);
    }catch{/* Audio is optional */}
  }
  function fmtTime(t){const sec=Math.floor(t);return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function riverCenter(y){return 850+44*Math.sin(y/195+.35);}
  function blocked(x,y){
    if(x<39||y<42||x>W-40||y>H-42)return true;
    return y<532||y>635 ? Math.abs(x-riverCenter(y))<94 : false;
  }
  function addScore(points){state.score+=points;tone(750,.13);}
  function drain(n){
    state.energy=Math.max(0,state.energy-n);
    if(state.energy<=0 && state.screen==="playing")end(false,"Your energy ran out before the expedition was complete. Rest at the camp, choose a shorter route, and try again.");
  }
  function notify(msg){
    const t=$("toast");t.textContent=msg;t.hidden=false;
    if(state.toastTimeout)clearTimeout(state.toastTimeout);
    state.toastTimeout=setTimeout(()=>t.hidden=true,3500);
  }
  function addItem(item){if(!state.inventory.has(item))state.inventory.add(item);}
  function updateUI(){
    $("energyValue").textContent=`${Math.ceil(state.energy)}%`;
    $("energyBar").style.width=`${state.energy}%`;
    $("energyBar").classList.toggle("low",state.energy<=28);
    $("scoreValue").textContent=String(state.score).padStart(4,"0");
    $("timeValue").textContent=fmtTime(state.elapsed);
    const completed=questDefs.filter(q=>state.done.has(q.key)).length;
    $("questsCompleted").textContent=`${completed} / 4`;
    $("progressLabel").textContent=`${completed} / 4 completed`;
    $("progressBar").style.width=`${completed/4*100}%`;
    $("chapterLabel").innerHTML=`<span class="live-dot"></span> ${completed>=4?"CHAPTER 02 / WATER STEWARDSHIP":"CHAPTER 01 / THE VALLEY"}`;
    const goals={elder:"Talk to the village elder.",toolkit:"Find the workshop and get your toolkit.",gasket:"Travel across the bridge to the supply depot.",pump:"Restore the pump to help the village."};
    const next=questDefs.find(q=>!state.done.has(q.key));
    const status=next?goals[next.key]:"You completed the main mission!";
    if(status!==state.lastStatus){$("statusLine").textContent=status;state.lastStatus=status;}
    $("inventoryCount").textContent=`${state.inventory.size} ITEM${state.inventory.size===1?"":"S"}`;
    $("inventoryList").replaceChildren();
    if(!state.inventory.size){const e=document.createElement("span");e.className="muted";e.textContent="Your bag is empty.";$("inventoryList").append(e);}
    const emoji={toolkit:"🧰",gasket:"🔩",testKit:"🧪",fieldNotes:"📓"};
    for(const item of state.inventory){const e=document.createElement("span");e.className="inventory-item";e.textContent=`${emoji[item]||"✦"} ${({toolkit:"Toolkit",gasket:"Gasket",testKit:"Test kit",fieldNotes:"Field notes"})[item]||item}`;$("inventoryList").append(e);}
    for(const el of $("questList").querySelectorAll("[data-quest]")){
      const completed=state.done.has(el.dataset.quest);el.classList.toggle("done",completed);
      el.querySelector(".quest-icon").textContent=completed?"✓":questDefs.find(q=>q.key===el.dataset.quest).icon;
    }
    for(const el of $("destinationList").querySelectorAll("[data-destination]"))el.classList.toggle("here",state.nearby===el.dataset.destination);
  }
  function populateSidebar(){
    const qs=$("questList"),ds=$("destinationList");qs.replaceChildren();ds.replaceChildren();
    for(const q of questDefs){const el=document.createElement("div");el.className="quest-card";el.dataset.quest=q.key;el.innerHTML=`<span class="quest-icon">${q.icon}</span><div><strong>${q.title}</strong><small>${q.detail}</small></div>`;qs.append(el);}
    for(const [key,sp] of Object.entries(spots)){
      const b=document.createElement("button");b.type="button";b.className="destination-btn";b.dataset.destination=key;
      b.innerHTML=`<span class="dest-icon">${sp.icon}</span><span class="dest-name">${sp.name}</span><span class="dest-arrow">↗</span>`;
      b.title=`Walk to ${sp.name}`;b.addEventListener("click",()=>navigateTo(key));ds.append(b);
    }
  }
  function start(){
    Object.assign(state,{screen:"playing",energy:100,score:0,elapsed:0,x:310,y:620,walkT:0,
      path:[],goal:null,destination:null,nearby:null,campUses:0,ended:false,lastStatus:"",cameraX:0,cameraY:0});
    state.keys.clear();state.touch.clear();state.done.clear();state.inventory.clear();
    $("startScreen").hidden=true;$("gameScreen").hidden=false;$("toast").hidden=true;
    closeModal(true);updateUI();canvas.focus({preventScroll:true});
    notify("MISSION STARTED · Visit the Village Elder to begin.");tone(480,.18);
    if(!safeStore.tutorialSeen())help();
  }
  function nearest(){let found=null,best=85;for(const [key,sp] of Object.entries(spots)){const d=dist({x:state.x,y:state.y},sp);if(d<best){found=key;best=d;}}return found;}
  function updateNearby(){
    const next=nearest();if(state.nearby!==next){state.nearby=next;
      $("nearbyPrompt").hidden=!next;
      if(next)$("nearbyName").textContent=spots[next].name;
      $("locationHint").textContent=next?spots[next].hint:"Follow the glowing markers";
    }
  }
  function navToPosition(target,spotKey=null){
    if(state.screen!=="playing"||state.modalOpen)return;
    state.keys.clear();state.touch.clear();
    const path=[],leftBank=x=>x<riverCenter(570)-92,rightBank=x=>x>riverCenter(570)+92;
    const curLeft=leftBank(state.x),curRight=rightBank(state.x),endLeft=leftBank(target.x),endRight=rightBank(target.x);
    if((curLeft&&endRight)||(curRight&&endLeft)){
      const departing=curLeft?{x:730,y:580}:{x:975,y:580};
      const arriving=curLeft?{x:975,y:580}:{x:730,y:580};
      path.push(departing,arriving);
    }
    path.push({x:target.x,y:target.y});state.path=path;state.goal={x:target.x,y:target.y};state.destination=spotKey;
    if(spotKey)notify(`Walking to ${spots[spotKey].name}…`);
    tone(500,.06);
  }
  function navigateTo(key){const sp=spots[key];if(sp)navToPosition(sp,key);}
  function handleMovement(dt){
    if(state.screen!=="playing"||state.modalOpen)return;
    const key=(...names)=>names.some(name=>state.keys.has(name)||state.touch.has(name));
    let dx=Number(key("arrowright","d","right"))-Number(key("arrowleft","a","left"));
    let dy=Number(key("arrowdown","s","down"))-Number(key("arrowup","w","up"));
    const direct=!!(dx||dy);if(direct){state.path=[];state.destination=null;state.goal=null;}
    else if(state.path.length){const t=state.path[0],dd=dist(state,t);if(dd<11){state.path.shift();if(!state.path.length){state.goal=null;state.destination=null;updateNearby();return;}}
      const to=state.path[0];if(to){dx=to.x-state.x;dy=to.y-state.y;}}
    if(!dx&&!dy){state.moving=false;return;}
    const length=Math.hypot(dx,dy);dx/=length;dy/=length;
    const sprint=direct&&state.keys.has("shift"),speed=sprint?330:215;
    const mx=dx*speed*dt,my=dy*speed*dt;
    const oldX=state.x,oldY=state.y;
    if(!blocked(state.x+mx,state.y))state.x+=mx;
    if(!blocked(state.x,state.y+my))state.y+=my;
    if(Math.abs(state.x-oldX)+Math.abs(state.y-oldY)<.1){
      state.moving=false;if(state.path.length){state.path=[];state.goal=null;state.destination=null;notify("Trail blocked. Try walking toward the bridge.");}return;
    }
    state.moving=true;state.walkT+=dt*10;state.facing=dx<-.05?-1:dx>.05?1:state.facing;
    drain(speed*dt*(sprint?.020:.014));
  }
  function openModal({tag="FIELD NOTES",icon="💧",title,description,choices=[],progress=0,total=0,tip="",kind="dialog",allowClose=true}){
    state.modalOpen=true;state.modalKind=kind;
    $("modalTag").textContent=tag;$("modalIllustration").textContent=icon;
    $("modalTitle").textContent=title;$("modalDescription").textContent=description;
    $("modalClose").hidden=!allowClose;
    $("modalTip").hidden=!tip;$("modalTip").textContent=tip;
    $("modalProgress").hidden=!total;
    $("modalProgress").replaceChildren();
    for(let i=0;i<total;i++){const pip=document.createElement("span");pip.className="progress-pip"+(i<progress?" filled":"");$("modalProgress").append(pip);}
    const list=$("modalChoices");list.replaceChildren();
    for(const c of choices){const b=document.createElement("button");b.type="button";b.className="choice"+(c.primary?" primary":"");b.textContent=c.text;
      const arrow=document.createElement("span");arrow.textContent="↗";b.append(arrow);
      if(c.disabled)b.disabled=true;
      b.addEventListener("click",c.action);list.append(b);
    }
    $("modalBackdrop").hidden=false;
    $("dialog").focus({preventScroll:true});
    tone(550,.07);
  }
  function closeModal(silent=false){
    if(state.modalKind==="end"&&!silent)return;
    $("modalBackdrop").hidden=true;state.modalOpen=false;state.modalKind="";
    if(!silent&&state.screen==="playing")canvas.focus({preventScroll:true});
  }
  function doneOnce(key,item=null,points=100){if(state.done.has(key))return false;state.done.add(key);if(item)addItem(item);addScore(points);return true;}
  function interact(){
    if(state.screen!=="playing"||state.modalOpen)return;
    const key=nearest();if(!key){notify("Walk closer to a glowing location, then press E.");return;}
    state.path=[];state.goal=null;state.destination=null;
    switch(key){
      case "elder":
        openModal({tag:"THE VILLAGE",icon:"👵",title:"A promise to the village",description:"‘Our only pump stopped working,’ says Amina, the village elder. ‘The children deserve reliable water. Visit the workshop for tools, cross the bridge for a replacement gasket, and come back to restore the pump.’",choices:[{text:state.done.has("elder")?"Review my mission":"I promise to help! (+80 impact)",primary:true,action:()=>{doneOnce("elder","fieldNotes",80);closeModal();updateUI();notify("Quest updated · The village is counting on you.");}}]});break;
      case "toolkit":
        if(state.done.has("toolkit")){openModal({icon:"🧰",title:"The workshop is empty",description:"You've already packed the repair toolkit. Take it to the old pump.",choices:[{text:"Back to the trail",primary:true,action:()=>closeModal()}]});break;}
        openModal({tag:"SUPPLIES FOUND",icon:"🧰",title:"Repair toolkit discovered!",description:"Inside the workshop you find a wrench, screwdriver, and sturdy pair of gloves. They'll help you fix the broken pump.",choices:[{text:"Pack the tools (+100 impact)",primary:true,action:()=>{doneOnce("toolkit","toolkit",100);drain(2);closeModal();updateUI();notify("🧰 Toolkit added to your backpack.");}}]});break;
      case "gasket":
        if(state.done.has("gasket")){openModal({icon:"📦",title:"Supply depot",description:"You've already found the replacement gasket. You're ready for the pump repair puzzle.",choices:[{text:"Continue",primary:true,action:()=>closeModal()}]});break;}
        openModal({tag:"EQUIPMENT FOUND",icon:"📦",title:"A missing piece",description:"You search the storage crates and discover a new pump gasket. This small seal might be the key to restoring water flow.",choices:[{text:"Take the gasket (+100 impact)",primary:true,action:()=>{doneOnce("gasket","gasket",100);drain(3);closeModal();updateUI();notify("🔩 Replacement gasket collected.");}}]});break;
      case "camp":restAtCamp();break;
      case "river":riverChallenge();break;
      case "pump":pumpChallenge();break;
      case "spring":springChallenge();break;
    }
  }
  function restAtCamp(){
    if(state.campUses>=2){openModal({tag:"REST CAMP",icon:"⛺",title:"Supplies have run out",description:"This campsite's sealed drinking-water supplies have been used. Choose your remaining route carefully.",choices:[{text:"Continue expedition",primary:true,action:()=>closeModal()}]});return;}
    openModal({tag:"SAFE SUPPLIES",icon:"⛺",title:"Take a breather",description:`A volunteer has sealed, ready-to-drink water and a place to rest. Recover 32 energy. ${2-state.campUses} rest stop(s) remaining.`,choices:[{text:"Rest and recover (+32 energy)",primary:true,action:()=>{state.energy=Math.min(100,state.energy+32);state.campUses++;addScore(25);closeModal();updateUI();notify("Rested at camp · Energy recovered!");}},{text:"Not yet",action:()=>closeModal()}]});
  }
  const riverQuestions=[
    {q:"The river looks crystal clear. Does that automatically mean the water is safe to drink?",answers:["Yes, clear water is always safe.","No, appearance alone can't establish safety.","Only if the water feels cold."],right:1,feedback:"Correct! Clear water may still carry contaminants. Appearance alone does not establish safety."},
    {q:"What's the safest next step when a community finds a potential new source?",answers:["Test the water and follow qualified local safety guidance.","Taste a little to check.","Assume flowing water is safe."],right:0,feedback:"Exactly. Testing and appropriate professional guidance are essential."}
  ];
  const springQuestions=[
    {q:"You discover a mountain spring. What's the right first step?",answers:["Tell everyone to drink it.","Assess and test the source before considering it safe.","Judge it by how blue it looks."],right:1,feedback:"Great thinking. A source should be properly evaluated before drinking."},
    {q:"A sustainable water source should be...",answers:["Close enough, even if untested.","Reliable, properly evaluated, and maintained over time.","Kept secret so no one uses it."],right:1,feedback:"Right! Safe water access depends on reliability, testing, and ongoing maintenance."}
  ];
  const pumpQuestions=[
    {q:"The pump is leaking around its seal. What part did you bring to replace the worn seal?",answers:["The replacement gasket","A glass bottle","A map of the valley"],right:0,feedback:"The new gasket can help seal the leaking joint."},
    {q:"You fit the new seal. What should you do before turning the repaired pump back on?",answers:["Skip the checks and leave.","Check and tighten the fittings using the tools.","Remove the gasket again."],right:1,feedback:"Good work! The repair is secure and ready for an inspection."},
    {q:"Water starts flowing! What matters before calling it safe drinking water?",answers:["It looks clear, so it's fine.","The pump makes a nice sound.","Qualified water-quality verification and continuing maintenance."],right:2,feedback:"Exactly. Reliable safe access requires verification and maintenance."}
  ];
  function quiz({tag,icon,title,questions,onWin,step=0}){
    const q=questions[step];
    openModal({tag,icon,title:`${title} · ${step+1}/${questions.length}`,description:q.q,progress:step,total:questions.length,kind:"quiz",tip:"Think carefully: wrong answers cost 6 energy.",choices:q.answers.map((answer,i)=>({text:answer,action:()=>{
      if(i!==q.right){drain(6);if(state.ended)return;quiz({tag,icon,title,questions,onWin,step});$("modalTip").textContent="Not quite. That choice may put people at risk. Try again (−6 energy).";tone(190,.16);updateUI();return;}
      tone(850,.13);
      if(step+1<questions.length){quiz({tag,icon,title,questions,onWin,step:step+1});$("modalTip").textContent=q.feedback;}
      else{closeModal();onWin();}
    }}))});
  }
  function riverChallenge(){
    if(state.inventory.has("testKit")){openModal({tag:"RIVER RESEARCH",icon:"🔬",title:"You studied the river",description:"You already collected the water test kit. Take it to Hill Spring if you want to explore an alternate route to victory.",choices:[{text:"Continue",primary:true,action:()=>closeModal()}]});return;}
    quiz({tag:"WATER KNOWLEDGE",icon:"🔬",title:"The River Test",questions:riverQuestions,onWin:()=>{addItem("testKit");addScore(130);drain(4);updateUI();notify("🧪 Water test kit earned! Explore Hill Spring to use it.");}});
  }
  function springChallenge(){
    if(!state.inventory.has("testKit")){openModal({tag:"HILL SPRING",icon:"💧",title:"A promising discovery",description:"The mountain spring looks beautiful, but appearance doesn't guarantee safety. Visit the River Bank to learn about testing and collect a test kit.",choices:[{text:"Go to the River Bank",primary:true,action:()=>{closeModal();navigateTo("river");}},{text:"Keep exploring",action:()=>closeModal()}]});return;}
    quiz({tag:"BONUS CHALLENGE",icon:"🏔️",title:"Spring Survey",questions:springQuestions,onWin:()=>{addScore(350);end(true,"You helped the village identify and responsibly evaluate a possible alternative water source! Your careful decisions earned a community impact bonus.","SPRING DISCOVERY");}});
  }
  function pumpChallenge(){
    if(state.done.has("pump"))return;
    const need=[!state.done.has("elder")&&"Talk to the elder",!state.inventory.has("toolkit")&&"Collect the toolkit",!state.inventory.has("gasket")&&"Find the gasket"].filter(Boolean);
    if(need.length){openModal({tag:"REPAIR STATION",icon:"⚙️",title:"The pump needs your help",description:`You can't start repairs yet. You still need: ${need.join(" · ")}.`,choices:[{text:"Show me the next stop",primary:true,action:()=>{closeModal();navigateTo(!state.done.has("elder")?"elder":!state.inventory.has("toolkit")?"toolkit":"gasket");}},{text:"Back to map",action:()=>closeModal()}]});return;}
    quiz({tag:"THE FINAL CHALLENGE",icon:"🔧",title:"Repair the Pump",questions:pumpQuestions,onWin:()=>{doneOnce("pump",null,520);end(true,"Water is flowing again! By listening to the village, gathering the right supplies, and checking your work, you restored the village's path toward reliable safe water.","THE LAST WELL RESTORED");}});
  }
  function end(won,description,headline="EXPEDITION ENDED"){
    if(state.ended)return;
    state.ended=true;state.screen="ended";state.path=[];
    if(won){state.score+=Math.ceil(state.energy)*3;state.score+=Math.max(0,240-Math.floor(state.elapsed))*2;const best=safeStore.get();if(state.score>best)safeStore.set(state.score);}
    const best=safeStore.get();$("highScoreStart").textContent=best?best.toLocaleString():"—";
    updateUI();
    openModal({tag:won?"✦ MISSION COMPLETE":"MISSION PAUSED FOREVER",icon:won?"🏆":"🌵",title:won?headline:"Out of energy!",description:`${description}  •  FINAL IMPACT: ${state.score.toLocaleString()}  •  TIME: ${fmtTime(state.elapsed)}  •  BEST: ${best.toLocaleString()}`,kind:"end",allowClose:false,choices:[{text:"↻ Play a new expedition",primary:true,action:start},{text:"↩ Back to title",action:()=>{closeModal(true);state.screen="start";$("gameScreen").hidden=true;$("startScreen").hidden=false;}}]});
    tone(won?920:210,.22);
  }
  function pause(){
    if(state.screen!=="playing"||state.modalOpen)return;
    openModal({tag:"GAME PAUSED",icon:"⏸️",title:"Take your time",description:"Your energy won't change while paused. Ready to continue your expedition?",kind:"pause",choices:[{text:"▶ Resume adventure",primary:true,action:()=>closeModal()},{text:"↻ Start a new expedition",action:start}]});
  }
  function help(){
    safeStore.markTutorialSeen();
    openModal({tag:"HOW TO PLAY",icon:"🧭",title:"Your adventure guide",description:"Move using WASD or arrow keys. On phones, use the on-screen directional buttons. Click or tap the map to walk there, or select a destination in the mission panel for automatic navigation. When you're near a glowing marker, press E or tap INTERACT. Solve challenges, collect items, and restore the village pump before your energy runs out. Rest at the camp to recharge. Press Shift to sprint (uses more energy).",kind:"help",choices:[{text:"Got it — let's go!",primary:true,action:()=>closeModal()}],tip:"BONUS ROUTE: Earn a test kit at the River Bank, then survey the Hill Spring. Your game progress resets on refresh; only your best score is saved."});
  }
  const plants=[];
  let seed=24521;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
  for(let i=0;i<520;i++){const x=45+random()*(W-90),y=45+random()*(H-90);if(Math.abs(x-riverCenter(y))<143)continue;plants.push({x,y,t:random(),s:.7+random()*.9});}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function roundRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function path(points,width,color){ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
  function drawTree(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ellipse(7,12,27,12,"#35582d45");roundRect(-5,-13,10,32,3,"#805b3b");ellipse(-14,-17,24,22,"#3e8a50");ellipse(12,-20,27,28,"#4a9959");ellipse(0,-36,25,23,"#64ad69");ellipse(-10,-40,10,6,"#8acb80a1");ctx.restore();}
  function drawHouse(x,y,tint="#edd4a5",size=1){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ellipse(11,45,76,32,"#1e504640");roundRect(-53,-22,106,75,7,tint);roundRect(-17,6,32,47,3,"#91664d");roundRect(-44,-8,20,21,3,"#6a9ca0");roundRect(27,-8,19,21,3,"#6a9ca0");path([[-68,-22],[0,-67],[68,-22]],18,"#8e5442");path([[-65,-23],[0,-66],[65,-23]],7,"#bd7350");ctx.restore();}
  function drawPump(x,y){ctx.save();ctx.translate(x,y);ellipse(9,42,71,27,"#375d5266");roundRect(-56,16,118,41,9,"#d4b783");roundRect(-22,-40,46,89,9,"#6b8c96");roundRect(-18,-34,38,82,8,"#bad2cf");path([[-33,-41],[16,-41],[50,-4]],13,"#304f58");path([[-33,-44],[16,-44],[50,-7]],6,"#d6dcce");roundRect(38,-12,26,12,5,"#7a9ca3");roundRect(35,-9,8,48,3,"#697b80");ellipse(-1,-40,18,9,"#648d95");ctx.restore();}
  function drawCamp(x,y){ctx.save();ctx.translate(x,y);ellipse(0,28,70,25,"#366c5260");ctx.fillStyle="#f3c46c";ctx.beginPath();ctx.moveTo(-50,34);ctx.lineTo(0,-51);ctx.lineTo(55,34);ctx.closePath();ctx.fill();ctx.fillStyle="#d88c50";ctx.beginPath();ctx.moveTo(0,-51);ctx.lineTo(55,34);ctx.lineTo(-2,34);ctx.closePath();ctx.fill();path([[-52,35],[57,35]],6,"#8a6343");ctx.restore();}
  function drawWorld(time){
    ctx.fillStyle="#95c78f";ctx.fillRect(0,0,W,H);
    // Rich terrain zones, dirt tracks, and the river divide.
    ellipse(270,170,510,225,"#aad296");ellipse(350,995,650,280,"#89bc80");
    ellipse(1540,140,640,330,"#87c58a");ellipse(1520,1020,590,260,"#79b779");
    ellipse(1200,550,530,230,"#9dc987");
    path([[285,490],[380,625],[455,765],[590,710],[705,610],[730,578],[970,578],[1180,815],[1540,690]],43,"#ad946d");
    path([[285,490],[380,625],[455,765],[590,710],[705,610],[730,578],[970,578],[1180,815],[1540,690]],30,"#dbbd8a");
    path([[535,350],[440,460],[285,490]],26,"#dfc792");
    path([[970,578],[1170,420],[1450,265]],27,"#c4a276");
    path([[970,578],[1170,420],[1450,265]],17,"#e6d3a1");
    for(const p of plants){if(p.t<.22){ellipse(p.x,p.y,2*p.s,5*p.s,"#498f49");ellipse(p.x+4,p.y+2,2*p.s,3*p.s,"#60a756");}else if(p.t<.75){ellipse(p.x,p.y,3*p.s,2*p.s,p.t>.54?"#f7ebaa":"#73ad69");}else if(p.t<.89){ellipse(p.x,p.y,2.5,2.5,"#e9aeb0");}else{ellipse(p.x,p.y,4*p.s,3*p.s,"#c7d6a9");}}
    ctx.beginPath();for(let y=-30;y<=H+30;y+=9){const x=riverCenter(y)-82;if(y===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}for(let y=H+30;y>=-30;y-=9)ctx.lineTo(riverCenter(y)+82,y);ctx.closePath();ctx.fillStyle="#6cd4d0";ctx.fill();ctx.strokeStyle="#d7e6bd";ctx.lineWidth=11;ctx.stroke();
    ctx.save();ctx.beginPath();for(let y=-30;y<=H+30;y+=9){const x=riverCenter(y)-76;if(y===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}for(let y=H+30;y>=-30;y-=9)ctx.lineTo(riverCenter(y)+76,y);ctx.closePath();ctx.clip();
    for(let i=0;i<78;i++){const y=(i*73+37)%H, x=riverCenter(y)+Math.sin(i*32)*59;path([[x-13+Math.sin(time*.4+i)*6,y],[x+17+Math.sin(time*.4+i)*6,y-3]],2,i%3===0?"#e4ffda78":"#4dadcc99");}
    ctx.restore();
    // Wooden bridge over the river at the only safe crossing.
    roundRect(742,543,223,78,11,"#61553d");
    for(let x=747;x<963;x+=22)roundRect(x,549,17,65,4,x%3===0?"#b68d62":"#d0a574");
    path([[746,540],[963,540]],9,"#8b6a4a");path([[746,622],[963,622]],9,"#8b6a4a");
    // Settlement and landmark art.
    drawHouse(150,405);drawHouse(355,280,"#e9ca9b",.72);drawHouse(282,815,"#e8b79b",.8);
    drawTree(90,720,1.3);drawTree(560,975,1.35);drawTree(610,180,1.1);drawTree(1120,178,1.2);
    drawTree(1280,565,1.12);drawTree(1685,455,1.4);drawTree(1720,875,.95);drawTree(1320,920,1.1);
    drawCamp(spots.camp.x,spots.camp.y-17);
    roundRect(spots.toolkit.x-42,spots.toolkit.y-29,82,50,8,"#a97d4b");roundRect(spots.toolkit.x-34,spots.toolkit.y-42,66,22,5,"#c4a06a");
    roundRect(spots.gasket.x-44,spots.gasket.y-30,82,61,6,"#ac8753");path([[spots.gasket.x-38,spots.gasket.y],[spots.gasket.x+31,spots.gasket.y]],8,"#d6b277");
    drawPump(spots.pump.x,spots.pump.y-2);
    ellipse(spots.spring.x,spots.spring.y+24,83,53,"#57b9bc");ellipse(spots.spring.x,spots.spring.y+27,59,31,"#a7e6d5");
    for(const [key,sp] of Object.entries(spots))drawSpot(key,sp,time);
  }
  function drawSpot(key,sp,time){
    const complete=state.done.has(key)||(key==="river"&&state.inventory.has("testKit"));
    const radius=37+Math.sin(time*3+sp.x)*3;
    ctx.save();ctx.translate(sp.x,sp.y);
    ellipse(0,8,radius+8,16,complete?"#4b8e73aa":"#153a4185");
    ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle=complete?"#65e5a477":"#ffe27955";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=complete?"#a7f5ba":sp.color;ctx.stroke();
    ctx.textAlign="center";ctx.font="29px system-ui";ctx.fillText(sp.icon,0,12);
    const tw=Math.max(104,ctx.measureText(sp.name).width+42);
    roundRect(-tw/2,48,tw,27,10,"#10343ae9");
    ctx.fillStyle="#fff8e6";ctx.font="700 14px system-ui";ctx.fillText(sp.name,0,66);
    if(complete){ctx.fillStyle="#a4f5ba";ctx.font="800 16px system-ui";ctx.fillText("✓",31,-27);}
    ctx.restore();
  }
  function drawPlayer(time){
    const bounce=state.moving?Math.sin(state.walkT*2)*3:Math.sin(time*2.2)*1.3;
    ctx.save();ctx.translate(state.x,state.y+bounce);
    ellipse(0,29,21,9,"#1b484568");
    // Boots, backpack, jacket and head.
    const step=state.moving?Math.sin(state.walkT*2)*7:0;
    roundRect(-13,18+step,10,17,3,"#254553");roundRect(4,18-step,10,17,3,"#254553");
    roundRect(-21,-14,40,38,12,"#f0aa4b");
    roundRect(state.facing===1?-22:13,-11,10,26,5,"#315666");
    roundRect(-13,-16,26,29,8,"#4ac4a0");
    ellipse(0,-26,19,19,"#bf7955");
    ctx.fillStyle="#1d363a";ctx.beginPath();ctx.arc(state.facing*7,-25,2.5,0,Math.PI*2);ctx.fill();
    roundRect(-22,-40,40,11,6,"#fbd05b");roundRect(2,-34,24,5,3,"#e3b649");
    ctx.restore();
  }
  function draw(){
    const time=performance.now()/1000;
    const goalX=Math.min(W-VW,Math.max(0,state.x-VW*.45)),goalY=Math.min(H-VH,Math.max(0,state.y-VH*.51));
    state.cameraX+=(goalX-state.cameraX)*.12;state.cameraY+=(goalY-state.cameraY)*.12;
    ctx.clearRect(0,0,VW,VH);
    ctx.save();ctx.translate(-state.cameraX,-state.cameraY);
    drawWorld(time);
    if(state.goal){
      const p=state.goal;ctx.save();ctx.setLineDash([7,7]);ctx.strokeStyle="#fff6ca";ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,48,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    drawPlayer(time);ctx.restore();
    // Atmospheric vignette keeps focus on the game world.
    const vignette=ctx.createRadialGradient(VW/2,VH/2,170,VW/2,VH/2,710);vignette.addColorStop(0,"#133b2000");vignette.addColorStop(1,"#12312268");ctx.fillStyle=vignette;ctx.fillRect(0,0,VW,VH);
  }
  let lastTime=0,uiTimer=0;
  function loop(t){
    const dt=lastTime?Math.min(.05,(t-lastTime)/1000):0;lastTime=t;
    if(state.screen==="playing"&&!state.modalOpen){state.elapsed+=dt;handleMovement(dt);updateNearby();uiTimer+=dt;if(uiTimer>.18){updateUI();uiTimer=0;}}
    if(state.screen!=="start")draw();
    requestAnimationFrame(loop);
  }
  function moveFromCanvas(event){
    if(state.screen!=="playing"||state.modalOpen)return;
    const rect=canvas.getBoundingClientRect();const x=(event.clientX-rect.left)*VW/rect.width+state.cameraX;
    const y=(event.clientY-rect.top)*VH/rect.height+state.cameraY;
    let key=null,d=75;for(const [k,sp] of Object.entries(spots)){const n=dist({x,y},sp);if(n<d){d=n;key=k;}}
    if(key){if(dist(state,spots[key])<90)interact();else navigateTo(key);}else navToPosition({x:Math.min(W-50,Math.max(50,x)),y:Math.min(H-50,Math.max(50,y))});
  }
  window.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&state.modalOpen&&state.modalKind!=="end"){closeModal();return;}
    if(state.modalOpen)return;
    const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","shift"].includes(k))state.keys.add(k);
    if((k==="e"||k===" ")&&!e.repeat&&state.screen==="playing")interact();
    if(k==="p"&&state.screen==="playing")pause();
  });
  window.addEventListener("keyup",e=>state.keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur",()=>{state.keys.clear();state.touch.clear();});
  document.addEventListener("visibilitychange",()=>{
    state.keys.clear();state.touch.clear();
    if(document.hidden&&state.screen==="playing"&&!state.modalOpen)pause();
  });
  canvas.addEventListener("click",moveFromCanvas);
  for(const b of document.querySelectorAll("[data-dir]")){
    const d=b.dataset.dir;
    b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);state.touch.add(d);state.path=[];state.goal=null;});
    for(const type of ["pointerup","pointercancel","lostpointercapture"])b.addEventListener(type,()=>state.touch.delete(d));
  }
  $("interactButton").addEventListener("click",interact);
  $("touchAction").addEventListener("click",interact);
  $("startButton").addEventListener("click",start);
  $("instructionsButton").addEventListener("click",help);
  $("helpButton").addEventListener("click",help);
  $("pauseButton").addEventListener("click",pause);
  $("resetButton").addEventListener("click",()=>openModal({tag:"NEW EXPEDITION",icon:"↻",title:"Restart this journey?",description:"Your current expedition progress and inventory will reset. Your best score will be kept.",choices:[{text:"Restart adventure",primary:true,action:start},{text:"Keep playing",action:()=>closeModal()}]}));
  $("modalClose").addEventListener("click",()=>closeModal());
  $("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop")&&state.modalKind!=="end")closeModal();});
  $("soundButton").addEventListener("click",()=>{state.sound=!state.sound;$("soundButton").setAttribute("aria-pressed",String(state.sound));$("soundButton").textContent=state.sound?"♫":"♪̸";if(state.sound)tone();});
  $("highScoreStart").textContent=safeStore.get()?safeStore.get().toLocaleString():"—";
  populateSidebar();updateUI();requestAnimationFrame(loop);
  // In development tests, the read-only state snapshot can be inspected without changing gameplay.
  window.ThirstTrail={snapshot:()=>({screen:state.screen,energy:state.energy,score:state.score,quests:[...state.done],items:[...state.inventory],x:Math.round(state.x),y:Math.round(state.y),nearby:state.nearby,elapsed:state.elapsed}),version:"2.0"};
})();