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
    spring:   {x:1460,y:265,name:"Hill Spring",   icon:"💧", kind:"bonus",color:"#6fe1f2", hint:"Explore an alternative source"},
    ridge:    {x:1160,y:200,name:"Raincatch Ridge",icon:"🌦️",kind:"bonus",color:"#a4dbe7",hint:"Build a safe rainwater collection plan"},
    marsh:    {x:560,y:970,name:"Wetland Sanctuary",icon:"🪷",kind:"bonus",color:"#9fe8ba",hint:"Remove litter without disturbing wildlife"}
  };
  // Sealed expedition drinking-water caches are placed on safe walkable banks.
  // Unlike river or rainwater, these are pre-packed supplies for the explorer.
  const supplyCaches=[
    {id:"village",x:405,y:690},{id:"camptrail",x:610,y:455},
    {id:"easttrail",x:1115,y:695},{id:"hillside",x:1350,y:430}
  ];
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
    markTutorialSeen() {try{localStorage.setItem("thirstTrailTutorial","true");}catch{/* optional storage */}},
    getGraphics() {try{return JSON.parse(localStorage.getItem("thirstTrailGraphics")||"null");}catch{return null;}},
    setGraphics(v) {try{localStorage.setItem("thirstTrailGraphics",JSON.stringify(v));}catch{/* optional storage */}}
  };
  const graphicsPresets={
    low:{resolution:.75,shadows:false,effects:false,sensitivity:.9},
    medium:{resolution:1,shadows:true,effects:true,sensitivity:1},
    high:{resolution:1.25,shadows:true,effects:true,sensitivity:1},
    ultra:{resolution:1.5,shadows:true,effects:true,sensitivity:1.15}
  };
  const savedGraphics=safeStore.getGraphics();
  const graphics={...graphicsPresets.medium,...(savedGraphics||{})};
  let graphicsPreset=savedGraphics?.preset||"medium";
  function graphicsProfile(){return {...graphics,preset:graphicsPreset};}
  const state = {
    screen:"start", energy:100, score:0, elapsed:0, x:310, y:620, moving:false,
    walkT:0, facing:1, keys:new Set(), touch:new Set(), path:[], goal:null, destination:null,
    done:new Set(), inventory:new Set(), campUses:0, quizStep:0, modalOpen:false, modalKind:"",
    sound:safeStore.getSound(), cameraX:0, cameraY:0, nearby:null, ended:false, lastStatus:"",
    toastTimeout:null, effect:null, impactTimer:null, supplies:new Set(), scenic:false
  };

  const chapters=window.TrailProgress;
  let lastValleySaveTime=0;
  function saveValley(){
    if(state.screen!=="playing"||!chapters||state.ended)return;
    chapters.save("valley",{
      energy:Math.round(state.energy*10)/10,score:state.score,
      elapsed:Math.round(state.elapsed),x:Math.round(state.x),y:Math.round(state.y),
      done:[...state.done],inventory:[...state.inventory],
      supplies:[...state.supplies],campUses:state.campUses
    });
  }
  function refreshChapters(){
    if(!chapters)return;
    const data=chapters.snapshot(),valleySave=!!data.saves.valley,
      canyonSave=!!data.saves.canyon,canyonUnlocked=chapters.unlocked("canyon");
    $("valleyChapterStatus").textContent=data.completed.includes("valley")?"✓ Chapter complete · Replay":
      valleySave?"▶ Continue saved journey":"Start chapter →";
    $("canyonChapter").disabled=!canyonUnlocked;
    $("canyonChapter").classList.toggle("is-locked",!canyonUnlocked);
    $("canyonChapter").classList.toggle("is-ready",canyonUnlocked);
    $("canyonChapterStatus").textContent=data.completed.includes("canyon")?"✓ Chapter complete · Replay":
      canyonUnlocked?(canyonSave?"▶ Continue saved chapter":"▶ Chapter unlocked"):"🔒 Finish Chapter 1 to unlock";
  }
  function showChapters(){
    closeModal(true);
    state.screen="start";state.moving=false;state.keys.clear();state.touch.clear();
    $("gameScreen").hidden=true;$("canyonScreen").hidden=true;$("startScreen").hidden=false;
    window.TrailCanyon?.suspend?.();refreshChapters();
    window.scrollTo?.(0,0);
  }
  function continueValley(){
    const saved=chapters?.saved("valley");
    start({resume:!!saved});
    if(!saved)return;
    closeModal(true);
    const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
    state.x=Math.max(50,Math.min(W-50,number(saved.x,310)));
    state.y=Math.max(50,Math.min(H-50,number(saved.y,620)));
    if(blocked(state.x,state.y)){state.x=310;state.y=620;}
    state.energy=Math.max(1,Math.min(100,number(saved.energy,100)));
    state.score=Math.max(0,number(saved.score,0));
    state.elapsed=Math.max(0,number(saved.elapsed,0));
    lastValleySaveTime=state.elapsed;
    state.done=new Set((Array.isArray(saved.done)?saved.done:[]).filter(k=>spots[k]));
    state.inventory=new Set((Array.isArray(saved.inventory)?saved.inventory:[]).filter(x=>typeof x==="string"));
    state.supplies=new Set((Array.isArray(saved.supplies)?saved.supplies:[]).filter(x=>supplyCaches.some(s=>s.id===x)));
    state.campUses=Math.max(0,Math.min(2,Number(saved.campUses)||0));
    state.lastStatus="";updateNearby();updateUI();notify("Welcome back — valley progress restored.");
    saveValley();
  }
  // The 3D world is loaded without blocking startup. If Three.js cannot be reached,
  // the original Canvas 2D renderer remains available as a playable fallback.
  let world3d = null;
  function setRenderLoading(visible, message="Loading the 3D expedition view…"){
    const loading=$("renderLoading");
    if(!loading)return;
    loading.hidden=!visible;
    const copy=loading.querySelector("small");
    if(copy)copy.textContent=message;
  }
  setRenderLoading(true);
  createWorld(canvas, {
      onSelect(x,y) {
        if(state.screen!=="playing" || state.modalOpen)return;
        let nearestKey=null, best=80;
        for(const [key,sp] of Object.entries(spots)) {
          const distance=Math.hypot(x-sp.x,y-sp.y);
          if(distance<best){nearestKey=key;best=distance;}
        }
        if(nearestKey){
          if(dist(state,spots[nearestKey])<88)interact();
          else navigateTo(nearestKey);
        } else navToPosition({x,y});
      }
    })
    .then(engine => {world3d=engine;world3d.render(state,performance.now()/1000);setRenderLoading(false);})
    .catch(error => {setRenderLoading(false);console.warn("3D graphics unavailable; using the original 2D game.", error);});
  let audioContext = null;
  function tone(freq=620,duration=.09){
    if (!state.sound) return;
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      audioContext = audioContext || new AudioClass();
      if(audioContext.state==="suspended")audioContext.resume()?.catch(()=>{});
      duration=Math.max(.03,Math.min(.35,duration));
      const o=audioContext.createOscillator(),g=audioContext.createGain();
      o.type="sine";o.frequency.setValueAtTime(freq,audioContext.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(100,freq*.7),audioContext.currentTime+duration);
      g.gain.setValueAtTime(.001,audioContext.currentTime);
      g.gain.linearRampToValueAtTime(.032,audioContext.currentTime+.006);
      g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);
      o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);
      o.onended=()=>{o.disconnect();g.disconnect();};
    }catch{/* Audio is optional */}
  }
  // Both chapters share short interaction cues and the same persisted mute setting.
  // No ambient oscillator, sound loop or background track is created.
  window.ThirstAudio=Object.freeze({tone,get enabled(){return state.sound;}});
  // One gentle dawn-to-dusk cycle lasts eight in-game minutes. Exploration
  // remains fully playable after sunset; nothing changes collision or quests.
  function timeOfDay(elapsed){
    const phase=(Math.max(0,elapsed)%480)/480;
    const evening=(1-Math.cos(phase*Math.PI*2))/2;
    const label=phase<.18?"☀️ DAY ONE · MORNING":
      phase<.38?"🌤️ DAY ONE · GOLDEN HOUR":
      phase<.62?"🌙 DAY ONE · STARLIGHT":
      phase<.82?"🌅 DAY TWO · DAWN":"☀️ DAY TWO · MORNING";
    return {phase,evening,label};
  }
  function fmtTime(t){const sec=Math.floor(t);return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function riverCenter(y){return 850+44*Math.sin(y/195+.35);}

  // Live expedition navigator. Reuses world coordinates and route waypoints
  // from the real game, works even if 3D rendering is unavailable.
  const miniMap=$("miniMap");
  const miniCtx=miniMap?.getContext("2d");
  const mapW=540,mapH=316;
  const mapX=x=>x/W*mapW, mapY=y=>y/H*mapH;
  const mapNames={elder:"ELDER",toolkit:"TOOLS",camp:"CAMP",river:"RIVER",gasket:"DEPOT",pump:"PUMP",spring:"SPRING",ridge:"RIDGE",marsh:"MARSH"};
  let lastMapDraw=-1;

  function recommendedDestination(){
    if(state.destination&&spots[state.destination])return state.destination;
    const next=questDefs.find(q=>!state.done.has(q.key));
    return next?.key||"pump";
  }
  function drawMiniMap(timestamp){
    if(!miniCtx || $("mapBody").hidden || state.screen==="start")return;
    const c=miniCtx;const dest=recommendedDestination();
    const bg=c.createLinearGradient(0,0,0,mapH);
    bg.addColorStop(0,"#b7d79a");bg.addColorStop(1,"#5c9b73");
    c.clearRect(0,0,mapW,mapH);
    c.fillStyle=bg;c.fillRect(0,0,mapW,mapH);
    // Meadow patches, woodland and recognizable village geography.
    for(let i=0;i<48;i++){
      const x=(i*137+39)%mapW,y=(i*79+41)%mapH;
      c.fillStyle=i%3===0?"#52966b65":"#d6e7ac5d";
      c.beginPath();c.ellipse(x,y,14+i%5*4,7+i%4*3,i*.7,0,Math.PI*2);c.fill();
    }
    const roadPaths=[
      [[285,490],[370,630],[455,765],[610,708],[730,580],[970,580],[1180,825],[1540,690]],
      [[280,490],[420,435],[540,350]],[[970,580],[1170,415],[1460,265]],[[1100,440],[1120,315],[1160,200]],[[455,765],[510,870],[560,970]]
    ];
    for(const path of roadPaths){
      c.beginPath();path.forEach((p,i)=>i?c.lineTo(mapX(p[0]),mapY(p[1])):c.moveTo(mapX(p[0]),mapY(p[1])));
      c.lineCap="round";c.lineJoin="round";c.strokeStyle="#ab8058";c.lineWidth=9;c.stroke();
      c.strokeStyle="#efdcad";c.lineWidth=5;c.stroke();
    }
    c.beginPath();
    for(let y=-12;y<=H+12;y+=12){
      const x=mapX(riverCenter(y)),py=mapY(y);
      if(y===-12)c.moveTo(x,py);else c.lineTo(x,py);
    }
    c.lineWidth=43;c.strokeStyle="#d2dfac";c.stroke();
    c.lineWidth=35;c.strokeStyle="#319cae";c.stroke();
    c.lineWidth=29;c.strokeStyle="#75d7d8";c.stroke();
    // Bridge directly matches the crossing required by the movement logic.
    c.fillStyle="#704a34";c.fillRect(mapX(735),mapY(543),mapX(965)-mapX(735),mapY(615)-mapY(543));
    for(let x=741;x<958;x+=21){c.fillStyle="#d6a66e";c.fillRect(mapX(x),mapY(550),4,mapY(609)-mapY(550));}
    // A selected walking route remains visible through the bridge.
    if(state.path.length && state.screen==="playing"){
      c.beginPath();c.moveTo(mapX(state.x),mapY(state.y));
      for(const waypoint of state.path)c.lineTo(mapX(waypoint.x),mapY(waypoint.y));
      c.strokeStyle="#163b47bf";c.lineWidth=5;c.stroke();
      c.strokeStyle="#fff0a0";c.lineWidth=2.5;c.setLineDash([7,5]);c.stroke();c.setLineDash([]);
    }
    const pinFont="800 12px system-ui";
    c.textBaseline="middle";c.font=pinFont;
    for(const [key,sp] of Object.entries(spots)){
      const x=mapX(sp.x),y=mapY(sp.y),isTarget=key===dest;
      const done=state.done.has(key);
      if(isTarget){
        c.beginPath();c.arc(x,y,16,0,Math.PI*2);c.fillStyle="#ffda6e55";c.fill();
        c.lineWidth=2;c.strokeStyle="#fff1b2";c.stroke();
      }
      c.beginPath();c.arc(x,y,isTarget?8:6,0,Math.PI*2);
      c.fillStyle=done?"#7ee9b1":sp.color;c.fill();
      c.lineWidth=2;c.strokeStyle="#123c44";c.stroke();
      c.fillStyle="#173d40";c.fillText(mapNames[key],x+10,y-(isTarget?11:9));
    }
    // Reusable sealed supplies appear in both the overview map and 3D valley.
    for(const cache of supplyCaches){
      if(state.supplies.has(cache.id))continue;
      c.beginPath();c.arc(mapX(cache.x),mapY(cache.y),4.5,0,Math.PI*2);
      c.fillStyle="#b8f7ff";c.fill();c.strokeStyle="#1c6980";c.lineWidth=1.6;c.stroke();
    }
    // Player arrow and pulse are drawn last to keep them visible.
    const px=mapX(state.x),py=mapY(state.y);
    c.beginPath();c.arc(px,py,11,0,Math.PI*2);
    c.fillStyle="#08252c88";c.fill();
    const pulse=(Math.sin(timestamp*.004)+1)*.5;
    c.beginPath();c.arc(px,py,4.4+pulse*1.5,0,Math.PI*2);
    c.fillStyle="#fff9e7";c.fill();c.lineWidth=2.5;c.strokeStyle="#0c4752";c.stroke();
    c.fillStyle="#e7f9ed";c.font="900 12px system-ui";c.fillText("N",14,16);
    c.fillStyle="#567c76";c.fillRect(11,25,2,13);
    const goal=spots[dest];
    $("mapGoalLabel").textContent=goal?
      (state.destination?"Traveling: ":"Next: ")+goal.name:"Explore the valley";
  }
  function toggleNavigator(){
    const body=$("mapBody"),button=$("mapToggle");
    const hidden=body.hidden=!body.hidden;
    button.textContent=hidden?"Show map +":"Hide map −";
    button.setAttribute("aria-expanded",String(!hidden));
    if(!hidden)lastMapDraw=-1;
  }
  function blocked(x,y){
    if(x<39||y<42||x>W-40||y>H-42)return true;
    return y<532||y>635 ? Math.abs(x-riverCenter(y))<94 : false;
  }
  function addScore(points){state.score+=points;tone(750,.13);}
  function collectNearbySupplies(){
    if(state.screen!=="playing"||state.modalOpen)return;
    for(const cache of supplyCaches){
      if(state.supplies.has(cache.id))continue;
      if(Math.hypot(state.x-cache.x,state.y-cache.y)>42)continue;
      state.supplies.add(cache.id);
      const gained=Math.min(12,100-state.energy);
      state.energy=Math.min(100,state.energy+12);
      state.score+=25;
      tone(920,.14);
      notify("🧴 Sealed drinking-water supply found! +"+Math.ceil(gained)+" energy · +25 impact");
      updateUI();saveValley();
    }
  }
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
  const rewardNames={elder:"A promise made",toolkit:"Toolkit collected",gasket:"Gasket secured",pump:"The Last Well restored",river:"Water research complete",spring:"New water source discovered",ridge:"Rainwater plan completed",marsh:"Wetland habitat protected"};
  const rewardIcons={elder:"🤝",toolkit:"🧰",gasket:"🔩",pump:"💧",river:"🔬",spring:"🏔️",ridge:"🌦️",marsh:"🪷"};
  function celebrate(key,points=0,victory=false){
    const time=performance.now()/1000;
    state.effect={key,kind:victory?"victory":"quest",at:time};
    const panel=$("impactBurst");
    $("impactBurstIcon").textContent=victory?"🏆":(rewardIcons[key]||"✦");
    $("impactBurstTitle").textContent=rewardNames[key]||"Mission progress!";
    $("impactBurstPoints").textContent=victory?"YOU MADE AN IMPACT":points?`+${points} IMPACT POINTS`:"";
    panel.hidden=false;
    panel.classList.remove("replay");
    // Restart the short CSS entry animation when consecutive achievements arrive.
    void panel.offsetWidth;
    panel.classList.add("replay");
    if(state.impactTimer)clearTimeout(state.impactTimer);
    state.impactTimer=setTimeout(()=>{panel.hidden=true;panel.classList.remove("replay");},victory?4200:2400);
  }
  function updateUI(){
    $("energyValue").textContent=`${Math.ceil(state.energy)}%`;
    $("energyBar").style.width=`${state.energy}%`;
    $("energyBar").classList.toggle("low",state.energy<=28);
    $("scoreValue").textContent=String(state.score).padStart(4,"0");
    $("timeValue").textContent=fmtTime(state.elapsed);
    $("supplyCount").textContent="🧴 SEALED SUPPLIES "+state.supplies.size+" / "+supplyCaches.length;
    $("daypartLabel").textContent=timeOfDay(state.elapsed).label;
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
    const emoji={toolkit:"🧰",gasket:"🔩",testKit:"🧪",fieldNotes:"📓",rainNotes:"🌦️",habitatBadge:"🪷"};
    for(const item of state.inventory){const e=document.createElement("span");e.className="inventory-item";e.textContent=`${emoji[item]||"✦"} ${({toolkit:"Toolkit",gasket:"Gasket",testKit:"Test kit",fieldNotes:"Field notes",rainNotes:"Raincatch notes",habitatBadge:"Habitat badge"})[item]||item}`;$("inventoryList").append(e);}
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
  function start({resume=false}={}){
    lastValleySaveTime=0;
    Object.assign(state,{screen:"playing",energy:100,score:0,elapsed:0,x:310,y:620,walkT:0,
      path:[],goal:null,destination:null,nearby:null,campUses:0,ended:false,moving:false,lastStatus:"",cameraX:0,cameraY:0,effect:null,scenic:false});
    $("scenicViewButton").setAttribute("aria-pressed","false");
    $("scenicViewButton").textContent="◈ SCENIC VIEW";
    state.keys.clear();state.touch.clear();state.done.clear();state.inventory.clear();state.supplies.clear();
    if(state.impactTimer)clearTimeout(state.impactTimer);
    state.impactTimer=null;$("impactBurst").hidden=true;
    world3d?.recenter?.();
    if(!resume)chapters?.clearSave("valley");
    $("startScreen").hidden=true;$("gameScreen").hidden=false;$("toast").hidden=true;
    setRenderLoading(!world3d,"Preparing the 2D expedition fallback…");
    closeModal(true);updateUI();
    if(!resume)saveValley();
    if(world3d)world3d.focus();else canvas.focus({preventScroll:true});
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
    if(blocked(target.x,target.y)){
      notify("That spot is across the water or outside the safe trail. Select a land destination.");
      return;
    }
    state.keys.clear();state.touch.clear();
    const leftBridge={x:730,y:580},rightBridge={x:975,y:580};
    // At the bridge's center the old route planner treated the player as being
    // on neither bank, causing it to walk diagonally into a blocked river edge.
    // Determine both banks using the river's actual curve, not a fixed x value.
    const side=(x,y)=>{
      const center=riverCenter(y);
      return x<center-92?-1:x>center+92?1:0;
    };
    const start=side(state.x,state.y),end=side(target.x,target.y);
    const path=[];
    if(start!==end){
      if(start===-1)path.push(leftBridge,rightBridge);
      else if(start===1)path.push(rightBridge,leftBridge);
      else if(end===-1)path.push(leftBridge);
      else if(end===1)path.push(rightBridge);
    }
    path.push({x:target.x,y:target.y});
    state.path=path;state.goal={x:target.x,y:target.y};state.destination=spotKey;
    if(spotKey)notify(`Walking to ${spots[spotKey].name}…`);
    tone(500,.06);
  }
  function navigateTo(key){const sp=spots[key];if(sp)navToPosition(sp,key);}
  function recenterValleyCamera(){
    if(state.screen!=="playing"||state.modalOpen)return;
    world3d?.recenter?.();
    state.scenic=false;
    $("scenicViewButton").setAttribute("aria-pressed","false");
    $("scenicViewButton").textContent="◈ SCENIC VIEW";
    notify("Camera returned to your explorer.");
  }
  function toggleScenicView(){
    if(state.screen!=="playing"||state.modalOpen)return;
    state.scenic=!state.scenic;
    const control=$("scenicViewButton");
    control.setAttribute("aria-pressed",String(state.scenic));
    control.textContent=state.scenic?"◈ FOLLOW PLAYER":"◈ SCENIC VIEW";
    notify(state.scenic?
      "Scenic camera enabled · Explore the whole valley with the mini-map. Press V to follow again.":
      "Following your explorer again.");
    tone(state.scenic?720:510,.08);
    if(world3d)world3d.focus();
  }
  function handleMovement(dt){
    if(state.screen!=="playing"||state.modalOpen)return;
    const key=(...names)=>names.some(name=>state.keys.has(name)||state.touch.has(name));
    let dx=Number(key("arrowright","d","right"))-Number(key("arrowleft","a","left"));
    let dy=Number(key("arrowdown","s","down"))-Number(key("arrowup","w","up"));
    const direct=!!(dx||dy);if(direct){state.path=[];state.destination=null;state.goal=null;}
    else if(state.path.length){const t=state.path[0],dd=dist(state,t);if(dd<11){state.path.shift();if(!state.path.length){state.moving=false;state.goal=null;state.destination=null;updateNearby();return;}}
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
  function openModal({tag="FIELD NOTES",icon="💧",title,description,choices=[],progress=0,total=0,tip="",kind="dialog",allowClose=true,celebrateWin=false}){
    saveValley();
    state.keys.clear();state.touch.clear();state.moving=false;
    state.modalOpen=true;state.modalKind=kind;
    $("dialog").classList.toggle("is-victory",celebrateWin);
    // The pipe challenge uses a wider two-column workshop layout, while
    // dialogue, rain, wetland and victory screens keep their original design.
    $("dialog").classList.toggle("is-pipe",kind==="pipe");
    $("pipePuzzle").hidden=true;$("rainPanel").hidden=true;$("marshPanel").hidden=true;
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
    // Reopening a puzzle should start at the top even after scrolling another
    // dialog; otherwise its title and controls can appear cut off.
    $("dialog").scrollTop=0;
    $("dialog").focus({preventScroll:true});
    tone(550,.07);
  }
  function closeModal(silent=false){
    if(state.modalKind==="end"&&!silent)return;
    $("modalBackdrop").hidden=true;$("pipePuzzle").hidden=true;$("rainPanel").hidden=true;$("marshPanel").hidden=true;
    state.modalOpen=false;state.modalKind="";
    if(!silent)saveValley();
    if(!silent&&state.screen==="playing"){
      if(world3d)world3d.focus();else canvas.focus({preventScroll:true});
    }
  }
  function doneOnce(key,item=null,points=100){
    if(state.done.has(key))return false;
    state.done.add(key);if(item)addItem(item);addScore(points);
    saveValley();
    // The pump uses the larger finale effect from end() rather than a duplicate reward.
    if(key!=="pump")celebrate(key,points);
    return true;
  }
  function interact(){
    if(state.screen!=="playing"||state.modalOpen)return;
    const key=nearest();if(!key){notify("Walk closer to a glowing location, then press E.");return;}
    state.path=[];state.goal=null;state.destination=null;
    switch(key){
      case "ridge":rainChallenge();break;
      case "marsh":marshChallenge();break;
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
    quiz({tag:"WATER KNOWLEDGE",icon:"🔬",title:"The River Test",questions:riverQuestions,onWin:()=>{addItem("testKit");addScore(130);drain(4);celebrate("river",130);updateUI();notify("🧪 Water test kit earned! Explore Hill Spring to use it.");}});
  }
  function springChallenge(){
    if(!state.inventory.has("testKit")){openModal({tag:"HILL SPRING",icon:"💧",title:"A promising discovery",description:"The mountain spring looks beautiful, but appearance doesn't guarantee safety. Visit the River Bank to learn about testing and collect a test kit.",choices:[{text:"Go to the River Bank",primary:true,action:()=>{closeModal();navigateTo("river");}},{text:"Keep exploring",action:()=>closeModal()}]});return;}
    quiz({tag:"BONUS CHALLENGE",icon:"🏔️",title:"Spring Survey",questions:springQuestions,onWin:()=>{addScore(350);end(true,"You helped the village identify and responsibly evaluate a possible alternative water source! Your careful decisions earned a community impact bonus.","SPRING DISCOVERY");}});
  }



  // Leave wild plants, animals and nests untouched. Collect only obvious litter.
  const marshItems=[
    {icon:"🧴",name:"Plastic bottle",litter:true},
    {icon:"🛍️",name:"Plastic bag",litter:true},
    {icon:"🪺",name:"Bird nest",litter:false},
    {icon:"🥫",name:"Metal can",litter:true},
    {icon:"🌱",name:"Reed seedlings",litter:false},
    {icon:"🧵",name:"Discarded line",litter:true}
  ];
  let marshPicked=new Set();
  function renderMarsh(){
    const grid=$("marshGrid");grid.replaceChildren();
    const total=marshItems.filter((item,i)=>item.litter&&marshPicked.has(i)).length;
    $("marshProgress").textContent=total+" / 4 litter items";
    for(let i=0;i<marshItems.length;i++){
      const item=marshItems[i],done=marshPicked.has(i);
      const tile=document.createElement("button");tile.type="button";
      tile.className="marsh-item"+(done?" is-collected":"");
      tile.disabled=done;
      tile.setAttribute("aria-label",item.name+(done?", removed":", inspect or collect"));
      const icon=document.createElement("span");icon.className="marsh-item-icon";icon.textContent=done?"✓":item.icon;
      const name=document.createElement("span");name.className="marsh-item-title";name.textContent=item.name;
      tile.append(icon);tile.append(name);
      tile.addEventListener("click",()=>inspectMarsh(i));
      grid.append(tile);
    }
    const status=$("marshStatus");
    status.className="marsh-status"+(total===4?" is-success":"");
    status.textContent=total===4?"All litter is collected. The nest and seedlings are safe. Complete the cleanup!":
      "Identify litter to remove; protect habitat features and living things.";
  }
  function inspectMarsh(index){
    if(state.modalKind!=="marsh"||marshPicked.has(index))return;
    const item=marshItems[index];
    if(!item.litter){
      drain(3);if(state.ended)return;
      const status=$("marshStatus");status.className="marsh-status is-error";
      status.textContent=item.name+" belongs in the habitat. Leave it undisturbed (−3 energy).";
      tone(190,.12);updateUI();return;
    }
    marshPicked.add(index);tone(650+index*40,.085);renderMarsh();
  }
  function verifyMarsh(){
    if(state.modalKind!=="marsh")return;
    if(marshPicked.size!==4){
      const status=$("marshStatus");status.className="marsh-status is-error";
      status.textContent="Look for all four litter items before finishing.";
      return;
    }
    closeModal();doneOnce("marsh","habitatBadge",180);updateUI();
    notify("🪷 Wetland cleaned up · Habitat protected · +180 impact");
  }
  function marshChallenge(){
    if(state.done.has("marsh")){
      openModal({tag:"WETLAND FIELD NOTES",icon:"🪷",title:"The sanctuary is protected",
        description:"You collected litter while leaving wildlife habitat undisturbed. You earned your habitat stewardship badge.",
        choices:[{text:"Continue exploring",primary:true,action:()=>closeModal()}]});
      return;
    }
    marshPicked=new Set();
    openModal({tag:"OPTIONAL HABITAT MISSION",icon:"🪷",title:"Protect the Wetland Sanctuary",
      description:"A boardwalk overlooks a fragile wetland. Collect four pieces of litter, but don't disturb nests or living plants.",
      kind:"marsh",
      tip:"Select the items you would safely remove. Disturbing wildlife and plants costs 3 energy.",
      choices:[{text:"✓ Finish cleanup",primary:true,action:verifyMarsh},
        {text:"Back to the trail",action:()=>closeModal()}]});
    $("marshPanel").hidden=false;renderMarsh();
  }
  // Optional Raincatch Ridge activity. These are collection precautions,
  // not a guarantee that collected water is safe to drink.
  const rainOptions=[
    {icon:"↪",title:"Divert first roof runoff",detail:"Keep the dirtiest initial flow out of the tank."},
    {icon:"▧",title:"Add a debris filter",detail:"Remove leaves and larger particles before storage."},
    {icon:"▣",title:"Cover the storage tank",detail:"Reduce contamination and mosquito access."}
  ];
  let rainSelected=[false,false,false];
  function renderRainControls(){
    const wrap=$("rainControls");wrap.replaceChildren();
    const count=rainSelected.filter(Boolean).length;
    $("rainGauge").textContent=count+"/3 precautions";
    for(let i=0;i<rainOptions.length;i++){
      const option=rainOptions[i],button=document.createElement("button");
      button.type="button";button.className="rain-option";
      button.setAttribute("aria-pressed",String(rainSelected[i]));
      const symbol=document.createElement("span");symbol.className="rain-symbol";
      symbol.setAttribute("aria-hidden","true");symbol.textContent=option.icon;
      const copy=document.createElement("span");copy.className="rain-copy";
      const name=document.createElement("strong");name.textContent=option.title;
      const detail=document.createElement("small");detail.textContent=option.detail;
      copy.append(name);copy.append(detail);
      const tick=document.createElement("span");tick.className="rain-check";
      tick.setAttribute("aria-hidden","true");tick.textContent=rainSelected[i]?"✓":"○";
      button.append(symbol);button.append(copy);button.append(tick);
      button.addEventListener("click",()=>{
        if(state.modalKind!=="rain")return;
        rainSelected[i]=!rainSelected[i];tone(490,.07);
        renderRainControls();
      });
      wrap.append(button);
    }
    const status=$("rainStatus");status.className="rain-status";
    status.textContent=count===3?
      "Your collection plan is ready for inspection. Remember: collected water still needs testing and appropriate treatment before drinking.":
      "Select the precautions that reduce contamination before and during storage.";
  }
  function verifyRainPlan(){
    if(state.modalKind!=="rain")return;
    if(rainSelected.every(Boolean)){
      closeModal();
      doneOnce("ridge","rainNotes",220);
      updateUI();
      notify("🌦️ Raincatch plan completed! Testing and treatment are still needed before drinking.");
      return;
    }
    drain(2);
    if(state.ended)return;
    const status=$("rainStatus");status.className="rain-status is-error";
    status.textContent="This plan needs improvement. Consider roof runoff, filtration and protected storage (−2 energy).";
    updateUI();tone(220,.12);
  }
  function rainChallenge(){
    if(state.done.has("ridge")){
      openModal({tag:"RIDGE FIELD NOTES",icon:"🌦️",title:"Your raincatch study",
        description:"You designed a better rainwater collection plan. It reduces contamination but does not make collected water automatically safe to drink. Testing and treatment are essential.",
        choices:[{text:"Back to the valley",primary:true,action:()=>closeModal()}]});
      return;
    }
    rainSelected=[false,false,false];
    openModal({tag:"OPTIONAL EXPLORATION",icon:"🌦️",title:"Raincatch Ridge · Collection lab",
      description:"An unused collection tank sits below the ridge roof. Choose three precautions to reduce contamination, then inspect your plan.",
      kind:"rain",
      tip:"Rainwater is not automatically potable. This educational game covers basic collection precautions, not a drinking-water safety determination.",
      choices:[{text:"Inspect collection plan",primary:true,action:verifyRainPlan},
        {text:"Back to the valley",action:()=>closeModal()}]});
    $("rainPanel").hidden=false;renderRainControls();
  }
  // A full nine-piece plumbing network with T-junctions and end caps.
  // With only two-ended pipes, all nine cells cannot form a path between
  // these two middle-edge terminals (checkerboard parity). The tees branch
  // to the capped ends so every tile genuinely participates.
  const PIPE_DIRS=["n","e","s","w"];
  const PIPE_BASE=[
    ["s","e"],["w","s","e"],["w","s"],
    ["w","n"],["n","s"],["n","e"],
    ["e"],["n","w","e"],["w"]
  ];
  const PIPE_START=[1,2,3,1,2,1,3,1,2];
  let pipeTurns=[...PIPE_START],pipeTests=0;
  const rotatedPipe=(index,turns=pipeTurns)=>{
    const r=((turns[index]%4)+4)%4;
    return PIPE_BASE[index].map(dir=>PIPE_DIRS[(PIPE_DIRS.indexOf(dir)+r)%4]);
  };
  function pipeFlow(turns=pipeTurns){
    const start=3,goal=5,seen=new Set(),queue=[],leaks=[];
    if(rotatedPipe(start,turns).includes("w")){seen.add(start);queue.push(start);}
    const offset={n:-3,e:1,s:3,w:-1};
    const inverse={n:"s",e:"w",s:"n",w:"e"};
    for(let i=0;i<queue.length;i++){
      const current=queue[i],row=Math.floor(current/3),col=current%3;
      for(const dir of rotatedPipe(current,turns)){
        // These are the only permitted exterior source/sink connections.
        if((current===start&&dir==="w")||(current===goal&&dir==="e"))continue;
        const nr=row+(dir==="s"?1:dir==="n"?-1:0);
        const nc=col+(dir==="e"?1:dir==="w"?-1:0);
        if(nr<0||nr>2||nc<0||nc>2){
          leaks.push({tile:current,direction:dir,reason:"edge"});
          continue;
        }
        const target=current+offset[dir];
        if(!rotatedPipe(target,turns).includes(inverse[dir])){
          leaks.push({tile:current,direction:dir,reason:"disconnected"});
          continue;
        }
        if(!seen.has(target)){seen.add(target);queue.push(target);}
      }
    }
    const delivered=seen.has(goal)&&rotatedPipe(goal,turns).includes("e");
    return {solved:delivered&&seen.size===PIPE_BASE.length&&leaks.length===0,
      delivered,connected:seen,leaks};
  }
  // A deterministic guide follows one verified leak-free layout without automatically solving it.
  // Prioritize the inlet, then the upper route, the outlet and the two capped branches.
  const PIPE_HINT_ORDER=[3,0,1,2,5,4,7,6,8];
  function showPipeHint(){
    if(state.modalKind!=="pipe")return;
    const next=PIPE_HINT_ORDER.find(i=>pipeTurns[i]%4!==0);
    const status=$("pipeStatus");
    if(next===undefined){
      status.className="pipe-status is-success";
      status.textContent="All tiles match a valid leak-free network. Select Test the flow!";
      return;
    }
    const needed=(4-(pipeTurns[next]%4))%4;
    const row=Math.floor(next/3)+1,col=next%3+1;
    status.className="pipe-status is-hint";
    status.textContent="Hint: Tile "+(next+1)+" (row "+row+", column "+col+"): click "+
      needed+" more time"+(needed===1?"":"s")+" clockwise. Then follow the illuminated water route.";
  }
  function renderPipePuzzle(){
    const board=$("pipeGrid");board.replaceChildren();
    const flow=pipeFlow(),status=$("pipeStatus");
    for(let i=0;i<9;i++){
      const button=document.createElement("button");
      button.type="button";
      const supplied=flow.connected.has(i);
      const leakDirections=new Set(flow.leaks.filter(leak=>leak.tile===i).map(leak=>leak.direction));
      button.className="pipe-tile"+(supplied?" is-connected":"")+
        (leakDirections.size?" is-leaking":"")+(i===3||i===5?" is-terminal":"");
      const ports=rotatedPipe(i);
      button.setAttribute("aria-label",
        "Pipe row "+(Math.floor(i/3)+1)+", column "+(i%3+1)+
        ". Open "+ports.join(" and ")+
        (supplied?". Water reaches this pipe.":". Not yet supplied.")+
        (leakDirections.size?". Open joint pointing "+[...leakDirections].join(", ")+".":"")+
        (i===3?". Water enters from the LEFT.":i===5?". Village outlet is on the RIGHT.":"")+
        " Click to rotate clockwise.");
      const number=document.createElement("span");
      number.className="pipe-tile-number";number.textContent=String(i+1);
      button.append(number);
      if(i===3||i===5){
        const endpoint=document.createElement("span");
        endpoint.className="pipe-terminal-badge"+(
          i===3&&ports.includes("w")||i===5&&ports.includes("e")?" is-aligned":"");
        endpoint.textContent=i===3?"◀ IN":"OUT ▶";
        endpoint.setAttribute("aria-hidden","true");
        button.append(endpoint);
      }
      for(const dir of ports){
        const arm=document.createElement("span");
        arm.className="pipe-arm "+dir+(supplied?" is-flowing":"")+(leakDirections.has(dir)?" is-leaking":"");
        arm.setAttribute("aria-hidden","true");
        button.append(arm);
      }
      const hub=document.createElement("span");hub.className="pipe-hub";
      hub.setAttribute("aria-hidden","true");button.append(hub);
      button.addEventListener("click",()=>rotatePipe(i));
      board.append(button);
    }
    const firstLeak=flow.leaks[0];
    const directionName={n:"north (top)",e:"east (right)",s:"south (bottom)",w:"west (left)"};
    const leakHelp=firstLeak?" Open joint: tile "+(firstLeak.tile+1)+
      " points "+directionName[firstLeak.direction]+".":"";
    status.className="pipe-status"+(flow.solved?" is-success":"");
    status.textContent=flow.solved?
      "Success: all 9 pipes supplied, both capped branches sealed and water reaches VILLAGE OUTLET. Test the flow!":
      flow.connected.size===0?
      "No water entering. Tile 4 must face LEFT toward WATER IN. Rotate tile 4 to open the inlet.":
      flow.delivered?
      "Water reaches VILLAGE OUTLET, but only "+flow.connected.size+
      "/9 pipes are supplied; "+flow.leaks.length+" open joint(s) remain."+
      leakHelp+" Connect all nine pieces, including the two capped branches.":
      flow.connected.size+"/9 pipes receiving water. "+flow.leaks.length+
      " open joint(s) remain."+leakHelp+
      " Follow the teal tiles toward the outlet; red marks show leaks.";
  }
  function rotatePipe(index){
    if(state.modalKind!=="pipe")return;
    pipeTurns[index]=(pipeTurns[index]+1)%4;
    tone(440+index*24,.045);
    renderPipePuzzle();
  }
  function finalPumpSafetyQuiz(){
    quiz({tag:"THE FINAL CHALLENGE",icon:"🔧",title:"Repair the Pump",
      questions:pumpQuestions,onWin:()=>{
        doneOnce("pump",null,520);
        end(true,"Water is flowing again! By listening to the village, gathering the right supplies, and checking your work, you restored the village's path toward reliable safe water.","THE LAST WELL RESTORED");
      }});
  }
  function verifyPipe(){
    if(state.modalKind!=="pipe")return;
    pipeTests++;
    if(pipeFlow().solved){
      tone(960,.17);
      closeModal();
      finalPumpSafetyQuiz();
      return;
    }
    drain(2);
    if(state.ended)return;
    const status=$("pipeStatus");
    status.className="pipe-status is-error";
    const flow=pipeFlow();
    status.textContent=(flow.delivered?"The outlet has water but the branches are incomplete. ":"No safe water reached the outlet. ")+
      flow.connected.size+"/9 pieces connected, "+flow.leaks.length+
      " open joints. Repair the pipeline and try again (−2 energy).";
    updateUI();
    tone(210,.15);
  }
  function beginPipePuzzle(){
    pipeTurns=[...PIPE_START];pipeTests=0;
    openModal({tag:"PUMP REPAIR • STEP 1 OF 2",icon:"🔧",
      title:"Reconnect the water pipeline",
      description:"Connect all nine pipe sections. Water enters from middle LEFT and exits middle RIGHT. Turn the T-junctions to feed the branches and use the end caps to prevent leaks.",
      kind:"pipe",tip:"IN connects to tile 4 on the left; OUT leaves tile 6 on the right. Teal shows supplied pipes, red shows open joints. Hints are free; unsuccessful flow tests cost 2 energy.",
      choices:[
        {text:"💧 Test the flow",primary:true,action:verifyPipe},
        {text:"↩ Back to the valley",action:()=>closeModal()}
      ]});
    $("pipePuzzle").hidden=false;
    renderPipePuzzle();
  }
  function pumpChallenge(){
    if(state.done.has("pump"))return;
    const need=[!state.done.has("elder")&&"Talk to the elder",!state.inventory.has("toolkit")&&"Collect the toolkit",!state.inventory.has("gasket")&&"Find the gasket"].filter(Boolean);
    if(need.length){openModal({tag:"REPAIR STATION",icon:"⚙️",title:"The pump needs your help",description:`You can't start repairs yet. You still need: ${need.join(" · ")}.`,choices:[{text:"Show me the next stop",primary:true,action:()=>{closeModal();navigateTo(!state.done.has("elder")?"elder":!state.inventory.has("toolkit")?"toolkit":"gasket");}},{text:"Back to map",action:()=>closeModal()}]});return;}
    beginPipePuzzle();
  }
  function end(won,description,headline="EXPEDITION ENDED"){
    if(state.ended)return;
    state.ended=true;state.screen="ended";state.path=[];
    if(!won){
      // A failed expedition must never leave a previous quest's victory effects visible.
      state.effect=null;
      if(state.impactTimer)clearTimeout(state.impactTimer);
      state.impactTimer=null;$("impactBurst").hidden=true;
    }
    if(won){state.score+=Math.ceil(state.energy)*3;state.score+=Math.max(0,240-Math.floor(state.elapsed))*2;const best=safeStore.get();if(state.score>best)safeStore.set(state.score);chapters?.complete("valley");refreshChapters();}
    const best=safeStore.get();$("highScoreStart").textContent=best?best.toLocaleString():"—";
    updateUI();
    if(won)celebrate(state.done.has("pump")?"pump":"spring",0,true);
    openModal({tag:won?"✦ MISSION COMPLETE":"MISSION PAUSED FOREVER",icon:won?"🏆":"🌵",title:won?headline:"Out of energy!",description:`${description}  •  FINAL IMPACT: ${state.score.toLocaleString()}  •  TIME: ${fmtTime(state.elapsed)}  •  BEST: ${best.toLocaleString()}`,kind:"end",allowClose:false,celebrateWin:won,choices:[...(won?[{text:"🏜️ Enter the Forgotten Canyon",primary:true,action:()=>{showChapters();window.TrailCanyon?.launch();}}]:[]),{text:"↻ Play a new expedition",primary:!won,action:start},{text:"↩ Chapter selection",action:showChapters}]});
    if(won){
      // A short three-note flourish, using the existing optional Web Audio system.
      tone(620,.13);
      setTimeout(()=>{if(state.screen==="ended")tone(825,.15);},130);
      setTimeout(()=>{if(state.screen==="ended")tone(1100,.24);},280);
    }else tone(210,.22);
  }
  function pause(){
    if(state.screen!=="playing"||state.modalOpen)return;
    openModal({tag:"GAME PAUSED",icon:"⏸️",title:"Take your time",description:"Your energy won't change while paused. Ready to continue your expedition?",kind:"pause",choices:[{text:"▶ Resume adventure",primary:true,action:()=>closeModal()},{text:"↻ Start a new expedition",action:start}]});
  }
  function help(){
    if(window.TrailCanyon?.snapshot().active){window.TrailCanyon.pause?.();return;}
    safeStore.markTutorialSeen();
    openModal({tag:"HOW TO PLAY",icon:"🧭",title:"Your adventure guide",description:"Move using WASD or arrow keys. On phones, use the on-screen directional buttons. Click the 3D world once to walk; hold and drag with the left button to pan the camera without moving, or right-drag to rotate around the landscape. Use the mouse wheel to zoom, and press C to return the camera to your explorer. The live mini-map shows your location and route; click one of its markers to travel there, or press M to hide or show it. Press V or select SCENIC VIEW above the world to see the full valley, and press it again to follow your explorer. When you're near a glowing marker, press E or tap INTERACT. Solve challenges, collect items, rotate the pipe sections during the pump repair, and restore water before your energy runs out. Raincatch Ridge is an optional hands-on collection activity. Rest at the camp to recharge. Press Shift to sprint (uses more energy).",kind:"help",choices:[{text:"Got it — let's go!",primary:true,action:()=>closeModal()}],tip:"BONUS ROUTES: Earn a test kit at the River Bank to survey Hill Spring, or inspect the collection station at Raincatch Ridge. Progress saves automatically on this device. Choose Continue from chapter selection after a refresh."});
  }
  const plants=[];
  let seed=24521;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
  for(let i=0;i<520;i++){const x=45+random()*(W-90),y=45+random()*(H-90);if(Math.abs(x-riverCenter(y))<143)continue;plants.push({x,y,t:random(),s:.7+random()*.9});}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function roundRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function path(points,width,color){ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
  function gradient(x0,y0,x1,y1,stops){const g=ctx.createLinearGradient(x0,y0,x1,y1);for(const [at,color] of stops)g.addColorStop(at,color);return g;}
  function drawTree(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.shadowColor="#173d2b55";ctx.shadowBlur=12;ctx.shadowOffsetY=10;ellipse(7,13,31,13,"#244b345c");ctx.shadowColor="transparent";roundRect(-6,-19,12,39,4,"#69452f");path([[-1,8],[-16,-4]],5,"#795137");path([[2,1],[17,-10]],4,"#795137");const shades=["#276c49","#368354","#4a9a5c","#62ae67"];[[ -20,-17,25,24],[14,-20,29,27],[-2,-39,28,26],[-21,-39,17,18],[19,-45,16,17]].forEach((p,i)=>{ellipse(p[0],p[1],p[2],p[3],shades[i%shades.length]);});ellipse(-10,-45,9,5,"#a0d27f99");ellipse(12,-28,8,4,"#8bca78aa");ctx.restore();}
  function drawHouse(x,y,tint="#edd4a5",size=1){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ellipse(11,48,82,31,"#1e504655");ctx.shadowColor="#173a3a55";ctx.shadowBlur=8;ctx.shadowOffsetY=8;roundRect(-53,-22,106,75,7,tint);ctx.shadowColor="transparent";roundRect(-17,5,32,48,3,"#754935");roundRect(-12,12,21,41,2,"#b7794e");roundRect(-44,-8,20,21,3,"#8cc7bf");roundRect(27,-8,19,21,3,"#8cc7bf");ctx.fillStyle="#d8f1dc99";ctx.fillRect(-42,-6,16,4);ctx.fillRect(29,-6,15,4);path([[-68,-22],[0,-67],[68,-22]],20,"#713d39");path([[-65,-24],[0,-66],[65,-24]],10,"#a95145");path([[-49,-28],[0,-56],[48,-28]],3,"#dc8660");ctx.restore();}
  function drawPump(x,y){ctx.save();ctx.translate(x,y);ellipse(9,45,76,27,"#375d5266");roundRect(-60,18,126,41,9,"#a98250");roundRect(-54,24,114,27,5,"#d8b66d");roundRect(-23,-42,48,91,9,"#536e73");roundRect(-18,-36,38,82,8,gradient(-18,-36,20,46,[[0,"#d8eeea"],[.5,"#8baeb0"],[1,"#52747b"]]));path([[-35,-43],[15,-43],[51,-7]],14,"#304c53");path([[-34,-46],[16,-46],[52,-10]],7,"#e3e1cb");roundRect(39,-14,29,12,5,"#7399a0");roundRect(36,-11,9,49,3,"#596a6b");ellipse(-1,-42,18,9,"#77a8a6");ctx.strokeStyle="#31565a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(-1,-42,9,0,Math.PI*2);ctx.stroke();ctx.restore();}
  function drawCamp(x,y){ctx.save();ctx.translate(x,y);ellipse(0,30,73,25,"#366c5260");ctx.fillStyle="#f0be62";ctx.beginPath();ctx.moveTo(-52,35);ctx.lineTo(0,-53);ctx.lineTo(57,35);ctx.closePath();ctx.fill();ctx.fillStyle="#d77b48";ctx.beginPath();ctx.moveTo(0,-53);ctx.lineTo(57,35);ctx.lineTo(-2,35);ctx.closePath();ctx.fill();path([[-53,35],[58,35]],7,"#80583d");ellipse(-76,30,13,6,"#d7a253");ellipse(76,30,13,6,"#d7a253");ctx.restore();}
  function drawWorld(time){
    ctx.fillStyle=gradient(0,0,0,H,[[0,"#a7d59a"],[.48,"#91c582"],[1,"#6ea86f"]]);ctx.fillRect(0,0,W,H);
    // Layered hills and terrain patches create an isometric-style sense of depth.
    ctx.fillStyle="#5c927a";ctx.beginPath();ctx.moveTo(0,245);ctx.lineTo(170,100);ctx.lineTo(340,215);ctx.lineTo(540,75);ctx.lineTo(770,230);ctx.lineTo(1000,125);ctx.lineTo(1280,245);ctx.lineTo(1510,115);ctx.lineTo(1800,250);ctx.lineTo(1800,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
    ctx.fillStyle="#78ad7b";ctx.beginPath();ctx.moveTo(0,355);ctx.quadraticCurveTo(320,170,650,340);ctx.quadraticCurveTo(940,145,1260,350);ctx.quadraticCurveTo(1540,180,1800,335);ctx.lineTo(1800,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
    ellipse(270,170,510,225,"#b2d99d");ellipse(350,995,650,280,"#86bb7d");
    ellipse(1540,140,640,330,"#8fc98b");ellipse(1520,1020,590,260,"#78b477");ellipse(1200,550,530,230,"#a4cf8d");
    for(let i=0;i<65;i++){const x=(i*113)%W,y=120+(i*197)%H;ellipse(x,y,18+(i%4)*5,4,"#5d9b6c22");}
    path([[285,490],[380,625],[455,765],[590,710],[705,610],[730,578],[970,578],[1180,815],[1540,690]],43,"#ad946d");
    path([[285,490],[380,625],[455,765],[590,710],[705,610],[730,578],[970,578],[1180,815],[1540,690]],30,"#dbbd8a");
    path([[535,350],[440,460],[285,490]],26,"#dfc792");
    path([[970,578],[1170,420],[1450,265]],27,"#c4a276");
    path([[970,578],[1170,420],[1450,265]],17,"#e6d3a1");
    for(const p of plants){if(p.t<.22){ellipse(p.x,p.y,2*p.s,5*p.s,"#498f49");ellipse(p.x+4,p.y+2,2*p.s,3*p.s,"#60a756");}else if(p.t<.75){ellipse(p.x,p.y,3*p.s,2*p.s,p.t>.54?"#f7ebaa":"#73ad69");}else if(p.t<.89){ellipse(p.x,p.y,2.5,2.5,"#e9aeb0");}else{ellipse(p.x,p.y,4*p.s,3*p.s,"#c7d6a9");}}
    ctx.beginPath();for(let y=-30;y<=H+30;y+=9){const x=riverCenter(y)-82;if(y===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}for(let y=H+30;y>=-30;y-=9)ctx.lineTo(riverCenter(y)+82,y);ctx.closePath();ctx.fillStyle=gradient(0,0,W,0,[[0,"#238da8"],[.35,"#70d4d2"],[.6,"#3bb9c2"],[1,"#1e7898"]]);ctx.fill();ctx.strokeStyle="#d7e6bd";ctx.lineWidth=11;ctx.stroke();
    ctx.save();ctx.beginPath();for(let y=-30;y<=H+30;y+=9){const x=riverCenter(y)-76;if(y===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}for(let y=H+30;y>=-30;y-=9)ctx.lineTo(riverCenter(y)+76,y);ctx.closePath();ctx.clip();
    for(let i=0;i<78;i++){const y=(i*73+37)%H, x=riverCenter(y)+Math.sin(i*32)*59;path([[x-13+Math.sin(time*.8+i)*8,y],[x+17+Math.sin(time*.8+i)*8,y-3]],2,i%3===0?"#e4ffda99":"#4dadcc99");}
    ctx.restore();
    // Wooden bridge over the river at the only safe crossing.
    ctx.save();ctx.shadowColor="#183c3c88";ctx.shadowBlur=14;ctx.shadowOffsetY=10;roundRect(742,543,223,78,11,"#564936");ctx.shadowColor="transparent";for(let x=747;x<963;x+=22){roundRect(x,549,17,65,4,x%3===0?"#9d704c":"#c28e5c");path([[x+2,554],[x+14,554]],2,"#e1b57c");}path([[746,540],[963,540]],9,"#704d38");path([[746,622],[963,622]],9,"#704d38");for(let x=760;x<955;x+=42)path([[x,536],[x+18,628]],4,"#4a392f");ctx.restore();
    // Settlement and landmark art.
    drawHouse(150,405);drawHouse(355,280,"#e9ca9b",.72);drawHouse(282,815,"#e8b79b",.8);
    drawTree(90,720,1.3);drawTree(560,975,1.35);drawTree(610,180,1.1);drawTree(1120,178,1.2);
    drawTree(1280,565,1.12);drawTree(1685,455,1.4);drawTree(1720,875,.95);drawTree(1320,920,1.1);
    drawCamp(spots.camp.x,spots.camp.y-17);
    roundRect(spots.toolkit.x-42,spots.toolkit.y-29,82,50,8,"#a97d4b");roundRect(spots.toolkit.x-34,spots.toolkit.y-42,66,22,5,"#c4a06a");
    roundRect(spots.gasket.x-44,spots.gasket.y-30,82,61,6,"#ac8753");path([[spots.gasket.x-38,spots.gasket.y],[spots.gasket.x+31,spots.gasket.y]],8,"#d6b277");
    drawPump(spots.pump.x,spots.pump.y-2);
    ellipse(spots.spring.x,spots.spring.y+24,83,53,"#57b9bc");ellipse(spots.spring.x,spots.spring.y+27,59,31,"#a7e6d5");
    for(let i=0;i<26;i++){const px=(i*149+time*9)%W,py=(i*83+Math.sin(time+i)*16)%H;ellipse(px,py,1.5,1.5,"#fff4c866");}
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
    roundRect(-21,-14,40,38,12,gradient(-21,-14,19,24,[[0,"#e98249"],[.55,"#f8b35a"],[1,"#c9673f"]]));
    roundRect(state.facing===1?-22:13,-11,10,26,5,"#315666");
    roundRect(-13,-16,26,29,8,"#3cae99");path([[-6,-10],[5,3]],2,"#a9e1bb");path([[5,-10],[-6,3]],2,"#a9e1bb");
    ellipse(0,-26,19,19,"#bf7955");
    ctx.fillStyle="#1d363a";ctx.beginPath();ctx.arc(state.facing*7,-25,2.5,0,Math.PI*2);ctx.fill();
    roundRect(-22,-40,40,11,6,"#fbd05b");roundRect(2,-34,24,5,3,"#e3b649");
    ctx.fillStyle="#f9d69b";ctx.fillRect(-5,-27,3,2);
    ctx.restore();
  }
  function draw(){
    const time=performance.now()/1000;
    const scenic2d=state.scenic&&!world3d;
    const goalX=Math.min(W-VW,Math.max(0,state.x-VW*.45)),goalY=Math.min(H-VH,Math.max(0,state.y-VH*.51));
    if(scenic2d){state.cameraX=0;state.cameraY=0;}
    else{state.cameraX+=(goalX-state.cameraX)*.12;state.cameraY+=(goalY-state.cameraY)*.12;}
    ctx.clearRect(0,0,VW,VH);
    ctx.save();
    if(scenic2d)ctx.scale(VW/W,VH/H);
    else ctx.translate(-state.cameraX,-state.cameraY);
    drawWorld(time);
    for(const cache of supplyCaches){
      if(state.supplies.has(cache.id))continue;
      ctx.fillStyle="#2c9bb1";ctx.strokeStyle="#fff9d5";ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(cache.x,cache.y,18+Math.sin(time*2)*2,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="#ffffff";ctx.font="24px sans-serif";ctx.textAlign="center";
      ctx.fillText("✦",cache.x,cache.y+8);
    }
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
    if(t-lastMapDraw>140 || lastMapDraw<0){
      try{drawMiniMap(t);}catch(error){
        // The navigator is optional and must not interrupt the actual game loop.
        if(lastMapDraw<0)console.warn("Mini-map unavailable",error);
      }
      lastMapDraw=t;
    }
    if(state.screen==="playing"&&!state.modalOpen){state.elapsed+=dt;handleMovement(dt);collectNearbySupplies();updateNearby();uiTimer+=dt;if(uiTimer>.18){updateUI();uiTimer=0;}if(state.elapsed-lastValleySaveTime>=8){saveValley();lastValleySaveTime=state.elapsed;}}
    if(world3d && $("canyonScreen").hidden){
      try { world3d.render(state,t/1000); }
      catch(error){
        console.error("3D renderer stopped; falling back to the playable 2D game.",error);
        try{world3d.dispose();}catch(disposeError){console.warn("3D cleanup:",disposeError);}
        world3d=null;
        canvas.style.display="";
      }
    }
    if(!world3d && state.screen!=="start")draw();
    requestAnimationFrame(loop);
  }
  function moveFromCanvas(event){
    if(state.screen!=="playing"||state.modalOpen)return;
    const rect=canvas.getBoundingClientRect();
    const scenic2d=state.scenic&&!world3d;
    const x=(event.clientX-rect.left)*(scenic2d?W:VW)/rect.width+(scenic2d?0:state.cameraX);
    const y=(event.clientY-rect.top)*(scenic2d?H:VH)/rect.height+(scenic2d?0:state.cameraY);
    let key=null,d=75;for(const [k,sp] of Object.entries(spots)){const n=dist({x,y},sp);if(n<d){d=n;key=k;}}
    if(key){if(dist(state,spots[key])<90)interact();else navigateTo(key);}else navToPosition({x:Math.min(W-50,Math.max(50,x)),y:Math.min(H-50,Math.max(50,y))});
  }
  window.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&state.modalOpen&&state.modalKind!=="end"){closeModal();return;}
    if(state.screen!=="playing"||state.modalOpen||!$("graphicsPanel").hidden)return;
    if(e.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    if((e.key===" "||e.key==="Enter")&&e.target?.closest?.('button,a'))return;
    const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","shift"].includes(k))state.keys.add(k);
    if((k==="e"||k===" ")&&!e.repeat&&state.screen==="playing")interact();
    if(k==="p"&&state.screen==="playing")pause();
    if(k==="m"&&state.screen==="playing"&&!e.repeat)toggleNavigator();
    if(k==="v"&&state.screen==="playing"&&!e.repeat)toggleScenicView();
    if(k==="c"&&state.screen==="playing"&&!e.repeat)recenterValleyCamera();
  });
  window.addEventListener("keyup",e=>state.keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur",()=>{state.keys.clear();state.touch.clear();});
  window.addEventListener("pagehide",()=>saveValley());
  document.addEventListener("visibilitychange",()=>{
    state.keys.clear();state.touch.clear();
    if(document.hidden&&state.screen==="playing"&&!state.modalOpen)pause();
  });
  canvas.addEventListener("click",moveFromCanvas);
  $("mapToggle").addEventListener("click",toggleNavigator);
  $("scenicViewButton").addEventListener("click",toggleScenicView);
  $("valleyCameraReset").addEventListener("click",recenterValleyCamera);
  miniMap.addEventListener("click",event=>{
    if(state.screen!=="playing"||state.modalOpen)return;
    const rect=miniMap.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=(event.clientX-rect.left)*mapW/rect.width;
    const y=(event.clientY-rect.top)*mapH/rect.height;
    let nearestKey=null,nearestDistance=30;
    for(const [key,sp] of Object.entries(spots)){
      const d=Math.hypot(x-mapX(sp.x),y-mapY(sp.y));
      if(d<nearestDistance){nearestKey=key;nearestDistance=d;}
    }
    if(nearestKey){
      navigateTo(nearestKey);
      $("mapGoalLabel").textContent="Traveling: "+spots[nearestKey].name;
    }
  });
  for(const b of document.querySelectorAll("[data-dir]")){
    const d=b.dataset.dir;
    b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);state.touch.add(d);state.path=[];state.goal=null;});
    for(const type of ["pointerup","pointercancel","lostpointercapture"])b.addEventListener(type,()=>state.touch.delete(d));
  }
  $("interactButton").addEventListener("click",interact);
  $("touchAction").addEventListener("click",interact);
  $("pipeHint").addEventListener("click",showPipeHint);
  $("startButton").addEventListener("click",start);
  $("valleyChapter").addEventListener("click",continueValley);
  $("canyonChapter").addEventListener("click",()=>{
    if(!chapters?.unlocked("canyon"))return;
    state.screen="start";$("gameScreen").hidden=true;
    window.TrailCanyon?.launch();
  });
  $("valleyChapters").addEventListener("click",()=>{saveValley();showChapters();});
  window.addEventListener("trail:progress",refreshChapters);
  window.addEventListener("trail:home",showChapters);
  $("instructionsButton").addEventListener("click",help);
  $("helpButton").addEventListener("click",help);
  $("pauseButton").addEventListener("click",pause);
  $("resetButton").addEventListener("click",()=>openModal({tag:"NEW EXPEDITION",icon:"↻",title:"Restart this journey?",description:"Your current expedition progress and inventory will reset. Your best score will be kept.",choices:[{text:"Restart adventure",primary:true,action:start},{text:"Keep playing",action:()=>closeModal()}]}));
  $("modalClose").addEventListener("click",()=>closeModal());
  $("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop")&&state.modalKind!=="end")closeModal();});
  function syncSoundButton(){
    $("soundButton").setAttribute("aria-pressed",String(state.sound));
    $("soundButton").setAttribute("aria-label",state.sound?"Mute interaction sounds":"Enable interaction sounds");
    $("soundButton").textContent=state.sound?"♫":"♪̸";
  }
  $("soundButton").addEventListener("click",()=>{
    state.sound=!state.sound;safeStore.setSound(state.sound);syncSoundButton();
    if(state.sound)tone();
  });
  syncSoundButton();
  const graphicsPanel=$("graphicsPanel"),qualityPreset=$("qualityPreset");
  function syncGraphicsPanel(){
    qualityPreset.value=graphicsPresets[graphicsPreset]?graphicsPreset:"medium";
    $("resolutionScale").value=graphics.resolution;
    $("cameraSensitivity").value=graphics.sensitivity;
    $("resolutionValue").textContent=Math.round(graphics.resolution*100)+"%";
    $("sensitivityValue").textContent=Math.round(graphics.sensitivity*100)+"%";
    $("shadowToggle").checked=graphics.shadows;
    $("effectsToggle").checked=graphics.effects;
  }
  function saveGraphics(){
    world3d?.setGraphicsSettings(graphics);
    safeStore.setGraphics(graphicsProfile());
    syncGraphicsPanel();
    window.dispatchEvent(new CustomEvent("trail:graphics",{detail:graphicsProfile()}));
  }
  $("graphicsButton").addEventListener("click",()=>{
    graphicsPanel.hidden=!graphicsPanel.hidden;
    if(!graphicsPanel.hidden){
      if(window.TrailCanyon?.snapshot().active)window.TrailCanyon.pause?.();
      else if(state.screen==="playing"&&!state.modalOpen)pause();
      syncGraphicsPanel();
    }
  });
  $("graphicsClose").addEventListener("click",()=>{graphicsPanel.hidden=true;});
  qualityPreset.addEventListener("change",()=>{
    graphicsPreset=qualityPreset.value;
    Object.assign(graphics,graphicsPresets[graphicsPreset]);
    saveGraphics();
  });
  $("resolutionScale").addEventListener("input",event=>{
    graphicsPreset="medium";graphics.resolution=Number(event.target.value);saveGraphics();
  });
  $("cameraSensitivity").addEventListener("input",event=>{
    graphicsPreset="medium";graphics.sensitivity=Number(event.target.value);saveGraphics();
  });
  $("shadowToggle").addEventListener("change",event=>{
    graphicsPreset="medium";graphics.shadows=event.target.checked;saveGraphics();
  });
  $("effectsToggle").addEventListener("change",event=>{
    graphicsPreset="medium";graphics.effects=event.target.checked;saveGraphics();
  });
  syncGraphicsPanel();
  $("highScoreStart").textContent=safeStore.get()?safeStore.get().toLocaleString():"—";
  populateSidebar();updateUI();refreshChapters();requestAnimationFrame(loop);
  // In development tests, the read-only state snapshot can be inspected without changing gameplay.
  window.ThirstTrail={snapshot:()=>({screen:state.screen,energy:state.energy,score:state.score,quests:[...state.done],items:[...state.inventory],x:Math.round(state.x),y:Math.round(state.y),nearby:state.nearby,elapsed:state.elapsed}),version:"2.0"};

  // Self-contained renderer avoids authenticated preview requests for world3d.js.
  /* Thirst Trail - real-time, stylized Three.js world.
     Original quest, energy and interaction logic remains in script.js.
     Three.js is loaded at runtime; if unavailable, the original 2D game remains playable. */
  async function createWorld(originalCanvas, options = {}) {
    let THREE, usePinnedThree=true;
    try {
      THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
    } catch (primaryError) {
      usePinnedThree=false;
      THREE = await import("https://esm.sh/three@0.170.0");
    }
  
    const WORLD_W = 1800, WORLD_H = 1100, SCALE = 40;
    const wx = x => (x - 900) / SCALE;
    const wz = y => (y - 550) / SCALE;
    const riverCenter = y => 850 + 44 * Math.sin(y / 195 + .35);
    const spots = [
      ["elder",280,490,"Village Elder",0xffd45b],
      ["toolkit",455,765,"Workshop",0xffd45b],
      ["camp",540,350,"Rest Camp",0x8af9bf],
      ["river",705,610,"River Bank",0x75edff],
      ["gasket",1190,825,"Supply Depot",0xffd45b],
      ["pump",1540,690,"Water Pump",0xffd45b],
      ["spring",1460,265,"Hill Spring",0x75edff],
      ["ridge",1160,200,"Raincatch Ridge",0xa4dbe7],
      ["marsh",560,970,"Wetland Sanctuary",0x9fe8ba]
    ];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb9dfdf);
    const skyDay=new THREE.Color(0x9bcfd6),skyGolden=new THREE.Color(0xd79a78),
      skyNight=new THREE.Color(0x142c4a),skyColor=new THREE.Color();
    const sunDay=new THREE.Color(0xffe7b1),sunGolden=new THREE.Color(0xffa66f),
      sunNight=new THREE.Color(0x7895c7),sunColor=new THREE.Color();
    // Moderate distance fog provides atmosphere without washing out nearby terrain.
    scene.fog = new THREE.FogExp2(0x9bc9d1, .009);
    const camera = new THREE.PerspectiveCamera(46, 1, .1, 180);
    const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, graphics.resolution * 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = graphics.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const view = renderer.domElement;
    let effectsEnabled=graphics.effects;
    let cameraSensitivity=graphics.sensitivity;
    function applyGraphicsSettings(next){
      effectsEnabled=!!next.effects;
      cameraSensitivity=Math.max(.5,Math.min(1.8,Number(next.sensitivity)||1));
      const scale=Math.max(.65,Math.min(1.5,Number(next.resolution)||1));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,scale*1.7));
      renderer.shadowMap.enabled=!!next.shadows;
      sun.castShadow=!!next.shadows;
      const quality=graphicsPreset==="ultra"?2048:graphicsPreset==="high"?1536:graphicsPreset==="medium"?1024:512;
      sun.shadow.mapSize.set(quality,quality);
      renderer.toneMappingExposure=graphicsPreset==="low"?1.08:graphicsPreset==="ultra"?1.16:1.2;
      scene.fog.density=graphicsPreset==="low"?.012:graphicsPreset==="ultra"?.0075:.009;
    }
    view.id = "world3dCanvas";
    view.tabIndex = 0;
    view.setAttribute("aria-label","Three-dimensional Thirst Trail adventure world. Use WASD to walk, E to interact, or click the landscape.");
    // Pointer gestures belong to the renderer. "manipulation" lets the browser
    // cancel a drag as a scroll gesture before pointer capture can take effect.
    view.style.touchAction = "none";
    view.style.cursor = "grab";
    view.style.display = "block";
    const host = originalCanvas.parentElement;
    const hero = document.querySelector(".hero-scene");
  
    // Warm directional sunlight and cool sky bounce build depth without
    // using an expensive postprocessing pipeline.
    const ambient=new THREE.HemisphereLight(0xdff5fb,0x526646,1.32);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffdfaa, 2.9);
    sun.position.set(-24, 37, -17);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    // Focus shadow resolution on the walkable valley; the giant landscape
    // beyond it receives terrain light without consuming shadow resolution.
    sun.shadow.camera.left = -29;
    sun.shadow.camera.right = 29;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -.00022;
    sun.shadow.normalBias = .019;
    sun.shadow.radius = 2.1;
    scene.add(sun, sun.target);
    applyGraphicsSettings(graphics);
    const fill = new THREE.DirectionalLight(0x8bcad6, .42);
    fill.position.set(19,14,12); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xa7dfff,.34);
    rim.position.set(-8,10,24);scene.add(rim);
    const contactShadows=[];
    function contactShadow(x,z,sx,sz,opacity=.22){
      const shadow=mesh(new THREE.CircleGeometry(1,24),
        new THREE.MeshBasicMaterial({color:0x18352e,transparent:true,opacity,
          depthWrite:false}),scene,false);
      shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.012,z);
      shadow.scale.set(sx,sz,1);contactShadows.push(shadow);return shadow;
    }
    const makeMat = (color, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
    const mats = {
      grass:makeMat(0x87b96a), grass2:makeMat(0x6ea45d), grass3:makeMat(0xa4cb74),
      trunks:makeMat(0x80533b), leaf1:makeMat(0x3d985f), leaf2:makeMat(0x6cbb68),
      leaf3:makeMat(0x237b60), leaf4:makeMat(0x9dcb76), wood:makeMat(0x95603b),
      lightWood:makeMat(0xc79056), rock:makeMat(0x8c9c86), rock2:makeMat(0xbac0a1),
      sand:makeMat(0xe9bf7d), dark:makeMat(0x2a4650), gold:makeMat(0xffd76f),
      roof:makeMat(0xb9634e), wall:makeMat(0xf0d5a3), door:makeMat(0x94623e),
      trim:makeMat(0xffeed0), roofDark:makeMat(0x884537), flower:makeMat(0xf9b4b6),
      pine:makeMat(0x26775d), pineLight:makeMat(0x469570)
    };
    // Procedural, offline textures. Generated once on startup and shared by
    // all meshes — no broken CDN links, downloads, or bloated model files.
    function artTexture(style){
      const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
      const p=canvas.getContext("2d");
      if(!p)return null;
      let seed=style.split("").reduce((n,c)=>n*31+c.charCodeAt(0),72341)>>>0;
      const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      p.fillStyle=style==="roof"?"#f2d9cf":style==="stone"?"#e2e4dc":
        style==="grass"?"#f0f7e9":style==="plaster"?"#f7f3e7":
        style==="trail"?"#f6ead7":"#eee0cd";
      p.fillRect(0,0,256,256);
      if(style==="roof"){
        // Overlapping terracotta tiles with slight individual-color variation.
        for(let row=0;row<17;row++)for(let col=-1;col<14;col++){
          const x=col*22+(row%2?11:0),y=row*16;
          const tone=rand();
          p.fillStyle=tone>.7?"#d8a899":tone>.27?"#e8c5b6":"#bb897e";
          p.fillRect(x+1,y+1,20,15);
          p.strokeStyle="#8d615d";p.lineWidth=1;
          p.beginPath();p.moveTo(x+1,y+15);p.lineTo(x+21,y+15);p.stroke();
          p.fillStyle="#fff9";p.fillRect(x+2,y+2,17,1);
        }
      }else if(style==="wood"){
        p.strokeStyle="#8b6759";
        for(let i=0;i<12;i++){
          const x=i*24+rand()*8;p.lineWidth=1.3+rand();
          p.beginPath();p.moveTo(x,0);p.bezierCurveTo(x+5,72,x-5,160,x+3,256);p.stroke();
        }
        for(let i=0;i<160;i++){
          const x=rand()*256,y=rand()*256;
          p.strokeStyle=rand()>.5?"#b6958055":"#775b4755";
          p.lineWidth=.45;p.beginPath();p.moveTo(x,y);
          p.lineTo(x-2+rand()*5,y+12+rand()*16);p.stroke();
        }
      }else if(style==="stone"){
        for(let y=0;y<256;y+=37)for(let x=-40;x<280;x+=52){
          const xx=x+(Math.floor(y/37)%2)*23;
          p.fillStyle=rand()>.5?"#c8c9be":"#f0f1e6";
          p.fillRect(xx+2,y+2,49,33);
          p.strokeStyle="#8c968d";p.lineWidth=2;p.strokeRect(xx+2,y+2,49,33);
        }
      }else{
        const n=style==="grass"?1200:style==="plaster"?930:1150;
        for(let i=0;i<n;i++){
          const x=rand()*256,y=rand()*256, r=rand()*2.3+.45;
          p.fillStyle=style==="grass"?(rand()>.5?"#608f5e48":"#accd855e"):
            style==="plaster"?(rand()>.5?"#a38f7666":"#ffffff66"):
            (rand()>.5?"#b9a48e64":"#ffffff74");
          p.fillRect(x,y,r,r+rand()*2);
        }
      }
      const map=new THREE.CanvasTexture(canvas);
      map.colorSpace=THREE.SRGBColorSpace;
      map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.RepeatWrapping;
      map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      return map;
    }
    const art={
      roof:artTexture("roof"),wood:artTexture("wood"),
      stone:artTexture("stone"),plaster:artTexture("plaster"),
      grass:artTexture("grass"),trail:artTexture("trail")
    };
    for(const [key,kind] of [
      ["roof","roof"],["roofDark","roof"],["wood","wood"],
      ["lightWood","wood"],["trunks","wood"],["door","wood"],
      ["rock","stone"],["rock2","stone"],["wall","plaster"],
      ["sand","trail"]
    ])if(art[kind]){
      mats[key].map=art[kind];
      mats[key].roughness=kind==="roof"?.83:1;
      mats[key].needsUpdate=true;
    }
    const unitBox = new THREE.BoxGeometry(1,1,1);
    const unitSphere = new THREE.IcosahedronGeometry(1,1);
    const cylinder = new THREE.CylinderGeometry(1,1,1,8);
    function mesh(geometry, material, parent=scene, cast=true) {
      const obj = new THREE.Mesh(geometry,material);
      obj.castShadow=cast; obj.receiveShadow=true; parent.add(obj); return obj;
    }
    function box(parent, material, x,y,z, sx,sy,sz, cast=true) {
      const m=mesh(unitBox,material,parent,cast);
      m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;
    }
    function ball(parent, material, x,y,z, sx=1,sy=sx,sz=sx, cast=true) {
      const m=mesh(unitSphere,material,parent,cast);
      m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;
    }
    function cyl(parent, material, x,y,z, top,bottom,height,segments=10) {
      const m=mesh(new THREE.CylinderGeometry(top,bottom,height,segments),material,parent);
      m.position.set(x,y,z);return m;
    }
    function seeded() { let s=19743021; return () => ((s=(1664525*s+1013904223)>>>0)/4294967296); }
    const rng=seeded();
    function ribbon(points, width, height, material, parent=scene) {
      const verts=[], uvs=[], inds=[];
      for(let i=0;i<points.length;i++){
        const p=points[i], before=points[Math.max(0,i-1)], after=points[Math.min(points.length-1,i+1)];
        const dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1;
        const nx=-dz/len,nz=dx/len;
        for(const side of [-1,1]){verts.push(p[0]+nx*width*side/2,height,p[1]+nz*width*side/2);uvs.push(side===-1?0:1,i/points.length);}
        if(i){const n=2*i;inds.push(n-2,n-1,n,n-1,n+1,n);}
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
      geo.setIndex(inds);geo.computeVertexNormals();
      const obj=mesh(geo,material,parent,false);obj.receiveShadow=true;return obj;
    }
  
    // Rolling grass, meadow patches and a raised perimeter give the world actual depth.
    // Wrap the original interactive region in a large continuous landscape,
    // so panoramic views never reveal a rectangular island suspended in sky.
    // The middle stays nearly level, preserving path, bridge and quest positions.
    function terrainElevation(x,z){
      const mx=Math.max(0,(Math.abs(x)-18)/10);
      const mz=Math.max(0,(Math.abs(z)-10)/10);
      const rim=Math.max(mx,mz);
      const shoulder=Math.min(3.6,Math.pow(rim,1.28)*.67);
      const distantWaves=Math.min(1,rim)*(
        Math.sin(x*.21+z*.14)*.38+Math.cos(z*.31-x*.11)*.27
      );
      return -.21+Math.sin(x*.43)*.07+Math.cos(z*.67)*.06+
        shoulder+distantWaves;
    }
    const terrainGeometry=new THREE.PlaneGeometry(118,112,122,112);
    terrainGeometry.rotateX(-Math.PI/2);
    const positions=terrainGeometry.getAttribute("position");
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      positions.setY(i,terrainElevation(x,z));
    }
    // Vertex colors give the whole valley broad patches of warm grass, forest
    // greens, and sunlit meadows rather than a single uniform green surface.
    const colors=new Float32Array(positions.count*3);
    const meadowA=new THREE.Color(0x86b574),meadowB=new THREE.Color(0xb6cb88);
    const meadowC=new THREE.Color(0x5b986f);
    const vertexColor=new THREE.Color();
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      // Multi-scale meadow patches: broad groundcover, shaded tree groves,
      // and fine irregular flecks. Everything stays deterministic per vertex.
      const broad=Math.sin(x*.19+Math.cos(z*.14)*1.7)*
        Math.cos(z*.22-x*.075);
      const medium=Math.sin(x*.57+z*.36)*Math.cos(z*.39-x*.28);
      const flecks=Math.sin(x*1.71+z*1.23)*Math.sin(z*1.59-x*.87);
      const sunlit=Math.max(0,broad*.76+medium*.24);
      const shadow=Math.max(0,-broad*.67+medium*.33);
      vertexColor.copy(meadowA);
      vertexColor.lerp(meadowB,Math.min(.75,sunlit*.59));
      vertexColor.lerp(meadowC,Math.min(.58,shadow*.49));
      vertexColor.multiplyScalar(.96+medium*.048+flecks*.022);
      colors[i*3]=vertexColor.r;colors[i*3+1]=vertexColor.g;colors[i*3+2]=vertexColor.b;
    }
    terrainGeometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
    terrainGeometry.computeVertexNormals();
    const groundArt=art.grass;
    if(groundArt)groundArt.repeat.set(28,24);
    mesh(terrainGeometry,new THREE.MeshStandardMaterial({
      vertexColors:true,map:groundArt||null,roughness:1,metalness:0,
      side:THREE.DoubleSide
    }),scene,false);
    // Layered distant mountain silhouettes add scale and recognizable scenery.
    // Mountains sit beyond the playable bounds and never affect navigation.
    const mountainDistant=makeMat(0x769c99),mountainNear=makeMat(0x6d887d);
    const mountainLit=makeMat(0xa1b5a0),snowCap=makeMat(0xe9ebd7);
    // Keep mountains on a distant back ridge, away from the playable camera
    // and sky. Previous giant cones framed the scene like a wall of triangles.
    const scenicMountains=[];
    for(let i=0;i<12;i++){
      const x=-46+i*8.25;
      const z=-39-(i%3)*3.5;
      const height=5.7+(i*7%7);
      const radius=5.2+(i%3)*1.25;
      // Place their bases on the same terrain instead of floating above it.
      const group=new THREE.Group();
      group.position.set(x,terrainElevation(x,z)-.28,z);scene.add(group);
      const peak=mesh(new THREE.ConeGeometry(radius,height,7),
        i%3?mountainDistant:mountainNear,group,false);
      peak.position.y=height*.49;peak.rotation.y=i*.76;
      const snow=mesh(new THREE.ConeGeometry(radius*.25,height*.14,7),
        snowCap,group,false);
      snow.position.y=height*.49+height*.43;snow.rotation.y=i*.76;
      scenicMountains.push(group);
    }
    // Distant pine stands make a natural transition from valley to mountains.
    // Instancing adds hundreds of silhouettes with only two draw calls.
    const ridgeCount=120,farTreeDummy=new THREE.Object3D();
    const ridgeTrunks=new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.075,.12,.82,5),mats.trunks,ridgeCount);
    const ridgeCrowns=new THREE.InstancedMesh(
      new THREE.ConeGeometry(.64,2.0,6),mats.pine,ridgeCount);
    for(let i=0;i<ridgeCount;i++){
      const x=(rng()-.5)*105,z=-19-rng()*17;
      const yy=terrainElevation(x,z);
      const scale=.5+rng()*.9;
      farTreeDummy.position.set(x,yy+.41*scale,z);
      farTreeDummy.rotation.set(0,rng()*Math.PI*2,0);
      farTreeDummy.scale.setScalar(scale);farTreeDummy.updateMatrix();
      ridgeTrunks.setMatrixAt(i,farTreeDummy.matrix);
      farTreeDummy.position.y=yy+1.64*scale;
      farTreeDummy.updateMatrix();
      ridgeCrowns.setMatrixAt(i,farTreeDummy.matrix);
    }
    ridgeTrunks.instanceMatrix.needsUpdate=true;
    ridgeCrowns.instanceMatrix.needsUpdate=true;
    ridgeTrunks.castShadow=false;ridgeCrowns.castShadow=false;
    scene.add(ridgeTrunks,ridgeCrowns);
    for(let i=0;i<34;i++){
      const x=(rng()-.5)*43,z=(rng()-.5)*26;
      const patch=mesh(new THREE.CircleGeometry(1,22),i%3===0?mats.grass3:mats.grass2,scene,false);
      patch.rotation.x=-Math.PI/2;patch.position.set(x,-.07,z);patch.scale.set(.8+rng()*2.8,.4+rng()*1.7,1);
    }
    const riverPoints=[];
    for(let i=0;i<=80;i++){const py=-80+i*16;riverPoints.push([wx(riverCenter(py)),wz(py)]);}
    ribbon(riverPoints,5.3,-.015,makeMat(0xd7c49a));
    // Matte turquoise river avoids the white, mirror-like blowouts from the
    // former clearcoat-heavy physical material at strong sunlight angles.
    const waterMat=new THREE.MeshStandardMaterial({
      color:0x329fb3,metalness:.025,roughness:.38,side:THREE.DoubleSide
    });
    // Create a reusable, hand-painted flow pattern entirely in the browser.
    // Animated texture coordinates evoke moving water without a costly shader
    // pipeline or a network dependency for water assets.
    const flowCanvas=document.createElement("canvas");
    flowCanvas.width=256;flowCanvas.height=512;
    const flowCtx=flowCanvas.getContext("2d");
    let flowTexture=null;
    if(flowCtx){
      flowCtx.fillStyle="#e7f9f2";
      flowCtx.fillRect(0,0,256,512);
      let waterSeed=93281;
      const waterRng=()=>{
        waterSeed=(Math.imul(waterSeed,1664525)+1013904223)>>>0;
        return waterSeed/4294967296;
      };
      for(let i=0;i<270;i++){
        const x=waterRng()*255,y=waterRng()*512,w=8+waterRng()*48;
        flowCtx.strokeStyle=i%5===0?"rgba(53,154,171,.24)":
          i%3===0?"rgba(255,255,255,.43)":"rgba(86,182,183,.18)";
        flowCtx.lineWidth=.65+waterRng()*2.0;
        flowCtx.lineCap="round";
        flowCtx.beginPath();
        flowCtx.moveTo(x,y);
        flowCtx.bezierCurveTo(x+w*.15,y-2-waterRng()*8,
          x+w*.7,y-2-waterRng()*8,x+w,y+waterRng()*4);
        flowCtx.stroke();
      }
      flowTexture=new THREE.CanvasTexture(flowCanvas);
      flowTexture.colorSpace=THREE.SRGBColorSpace;
      flowTexture.wrapS=THREE.RepeatWrapping;
      flowTexture.wrapT=THREE.RepeatWrapping;
      flowTexture.repeat.set(1,4.5);
      flowTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    }
    const riverWaterMat=waterMat.clone();
    if(flowTexture)riverWaterMat.map=flowTexture;
    riverWaterMat.needsUpdate=true;
    const shallowWaterMat=new THREE.MeshBasicMaterial({
      color:0x8cd7cb,transparent:true,opacity:.27,depthWrite:false,
      side:THREE.DoubleSide
    });
    ribbon(riverPoints,5.28,.032,shallowWaterMat);
    ribbon(riverPoints,4.55,.038,riverWaterMat);
    const ripples=[];
    const rippleMat=new THREE.MeshBasicMaterial({color:0xc5fff4,transparent:true,opacity:.27,depthWrite:false});
    for(let i=0;i<42;i++){
      const z=-15+(i/42)*30,x=wx(riverCenter(z*SCALE+550))+(rng()-.5)*2.8;
      const wave=mesh(new THREE.TorusGeometry(.12+rng()*.21,.015,5,18,Math.PI),rippleMat,scene,false);
      wave.rotation.x=-Math.PI/2;wave.position.set(x,.064,z);wave.rotation.z=rng()*6;
      wave.userData.startZ=z;
      ripples.push(wave);
    }
    // Floating water glints bring the stream to life without external textures.
    // Small additive highlights are intentionally kept to a low mesh count.
    const glintMat=new THREE.MeshBasicMaterial({
      color:0xd5fff8,transparent:true,opacity:.27,depthWrite:false,
      blending:THREE.NormalBlending,side:THREE.DoubleSide
    });
    const glints=[];
    const glintGeo=new THREE.PlaneGeometry(.28,.035);
    for(let i=0;i<28;i++){
      const z=-13.5+rng()*27;
      const drift=(rng()-.5)*3.65;
      const shine=mesh(glintGeo,glintMat,scene,false);
      shine.rotation.x=-Math.PI/2;
      shine.position.set(wx(riverCenter(z*SCALE+550))+drift,.091,z);
      shine.rotation.z=(rng()-.5)*.36;
      const size=.7+rng()*1.3;shine.scale.set(size,size,1);
      glints.push({mesh:shine,baseZ:z,phase:rng()*6.283,offset:drift});
    }
    const waterEdgeMat=new THREE.MeshBasicMaterial({
      color:0xb7fff3,transparent:true,opacity:.18,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide
    });
    const waterEdges=[];
    for(const side of [-1,1]){
      const edgePoints=riverPoints.map(([x,z])=>[x+side*2.17,z]);
      const edge=ribbon(edgePoints,.055,.094,waterEdgeMat,scene);
      waterEdges.push({edge,side});
    }
    // Instanced meadow wildflowers: colorful detail without expensive draw calls.
    // Leave the main route, riverbank and all quest interaction areas clear.
    const flowerStemGeo=new THREE.CylinderGeometry(.013,.019,.28,5);
    const blossomGeo=new THREE.IcosahedronGeometry(.10,0);
    const flowerStemMat=makeMat(0x447f53);
    const blossomMats=[makeMat(0xf3da7d),makeMat(0xe8a6b8),makeMat(0xf5ede2),makeMat(0x9ec9e7)];
    const flowers=[];
    const flowersPerColor=62;
    const stemBatch=new THREE.InstancedMesh(flowerStemGeo,flowerStemMat,flowersPerColor*4);
    stemBatch.castShadow=false;
    const blossomBatches=blossomMats.map(mat=>{
      const batch=new THREE.InstancedMesh(blossomGeo,mat,flowersPerColor);
      batch.castShadow=false;return batch;
    });
    const flowerDummy=new THREE.Object3D();
    const flowerLocations=[];
    let flowerAttempts=0;
    while(flowerLocations.length<flowersPerColor*4 && flowerAttempts++<2500){
      const x=(rng()-.5)*43.2,z=(rng()-.5)*26.2;
      const y=z*SCALE+550,px=x*SCALE+900;
      if(Math.abs(x-wx(riverCenter(y)))<3.5)continue;
      if(spots.some(([key,sx,sy])=>Math.hypot(px-sx,y-sy)<125))continue;
      // Leave wide breaks at the busiest village and bridge routes.
      if(z>-.3&&z<2.3&&x>-5.2&&x<3.9)continue;
      flowerLocations.push({x,z,s:.8+rng()*.85});
    }
    for(let i=0;i<flowerLocations.length;i++){
      const spot=flowerLocations[i];
      flowerDummy.position.set(spot.x,.14,spot.z);
      flowerDummy.rotation.set(0,i*.47,0);
      flowerDummy.scale.set(spot.s,spot.s,spot.s);flowerDummy.updateMatrix();
      stemBatch.setMatrixAt(i,flowerDummy.matrix);
      flowerDummy.position.y=.30*spot.s;
      flowerDummy.rotation.set(i*.37,i*.2,i*.11);
      flowerDummy.scale.setScalar(.65*spot.s);flowerDummy.updateMatrix();
      blossomBatches[Math.floor(i/flowersPerColor)].setMatrixAt(i%flowersPerColor,flowerDummy.matrix);
    }
    stemBatch.instanceMatrix.needsUpdate=true;scene.add(stemBatch);
    for(const batch of blossomBatches){batch.instanceMatrix.needsUpdate=true;scene.add(batch);}
    // Riverbank reeds and stones make the water part of a lived-in landscape.
    // Shared instanced geometry keeps the extra detail inexpensive to render.
    const reedStem=new THREE.ConeGeometry(.045,.66,5);
    const reedField=new THREE.InstancedMesh(reedStem,makeMat(0x4e8c56),150);
    reedField.castShadow=false;
    const reedDummy=new THREE.Object3D();
    for(let i=0;i<150;i++){
      const z=-13.4+rng()*26.8;
      const side=i%2===0?-1:1;
      const x=wx(riverCenter(z*SCALE+550))+side*(2.25+rng()*1.15);
      reedDummy.position.set(x,.22,z);
      reedDummy.rotation.set((rng()-.5)*.28,rng()*6,(rng()-.5)*.24);
      reedDummy.scale.setScalar(.65+rng()*.85);reedDummy.updateMatrix();
      reedField.setMatrixAt(i,reedDummy.matrix);
    }
    reedField.instanceMatrix.needsUpdate=true;scene.add(reedField);
    const foamMat=new THREE.MeshBasicMaterial({color:0xdbfff1,transparent:true,opacity:.33,depthWrite:false});
    const foam=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),foamMat,90);
    foam.castShadow=false;const foamDummy=new THREE.Object3D();
    for(let i=0;i<90;i++){
      const z=-13.7+i*.31,x=wx(riverCenter(z*SCALE+550))+(i%2?2.15:-2.15);
      foamDummy.position.set(x,.07,z);foamDummy.scale.set(.06,.012,.23+rng()*.20);
      foamDummy.updateMatrix();foam.setMatrixAt(i,foamDummy.matrix);
    }
    foam.instanceMatrix.needsUpdate=true;scene.add(foam);
    // Sculpt a rugged-looking river channel with shallow boulders and mossy
    // shore stones. Instancing gives hundreds of facets in just two draw calls.
    const riverStoneGeo=new THREE.IcosahedronGeometry(1,1);
    const channelBoulders=new THREE.InstancedMesh(riverStoneGeo,mats.rock,66);
    const brightBoulders=new THREE.InstancedMesh(riverStoneGeo,mats.rock2,30);
    const pebbleDummy=new THREE.Object3D();
    for(let i=0;i<66;i++){
      const z=-13.1+((i+rng()*.7)/66)*26.2;
      if(Math.abs(z-wz(580))<1.45){ // clear the bridge's center crossing
        pebbleDummy.position.set(0,-20,0);pebbleDummy.scale.setScalar(.001);
      }else{
        const mid=wx(riverCenter(z*SCALE+550));
        const shore=i%2?-1:1;
        const x=mid+shore*(2.65+rng()*1.80);
        const scale=.18+rng()*.40;
        pebbleDummy.position.set(x,scale*.23-.08,z);
        pebbleDummy.scale.set(scale*1.3,scale*.52,scale*.95);
      }
      pebbleDummy.rotation.set(rng()*.25,rng()*6.28,rng()*.20);
      pebbleDummy.updateMatrix();channelBoulders.setMatrixAt(i,pebbleDummy.matrix);
    }
    for(let i=0;i<30;i++){
      const z=-13.1+((i+rng()*.8)/30)*26.2,mid=wx(riverCenter(z*SCALE+550));
      const sc=.14+rng()*.31;
      pebbleDummy.position.set(mid+(i%2?-1:1)*(2.05+rng()*1.20),sc*.24,z);
      pebbleDummy.scale.set(sc*1.2,sc*.35,sc*.82);
      pebbleDummy.rotation.set(rng()*.4,rng()*6.28,rng()*.25);
      pebbleDummy.updateMatrix();brightBoulders.setMatrixAt(i,pebbleDummy.matrix);
    }
    channelBoulders.instanceMatrix.needsUpdate=true;
    brightBoulders.instanceMatrix.needsUpdate=true;
    channelBoulders.castShadow=false;brightBoulders.castShadow=false;
    scene.add(channelBoulders,brightBoulders);
    // Paths are curves integrated into the meadow rather than straight flat UI lines.
    const mainTrailMat=makeMat(0xb99467);
    if(art.trail)mainTrailMat.map=art.trail;
    const featheredTrailMat=new THREE.MeshStandardMaterial({
      color:0xbba978,roughness:1,transparent:true,opacity:.19,
      polygonOffset:true,polygonOffsetFactor:-1,depthWrite:false,
      side:THREE.DoubleSide
    });
    function road(raw,width=.95){
      const curve=new THREE.CatmullRomCurve3(raw.map(p=>new THREE.Vector3(wx(p[0]),.075,wz(p[1]))));
      const pts=curve.getPoints(85).map(p=>[p.x,p.z]);
      // Three layers make the track settle into the grass instead of
      // appearing as a single solid-colored stripe.
      ribbon(pts,width*1.53,.067,featheredTrailMat);
      ribbon(pts,width*1.11,.077,mats.sand);
      ribbon(pts,width*.69,.087,mainTrailMat);
    }
    road([[285,490],[370,630],[455,765],[610,708],[730,580],[970,580],[1180,825],[1540,690]]);
    road([[280,490],[420,435],[540,350]],.65);
    road([[970,580],[1170,415],[1460,265]],.65);
    road([[1100,440],[1120,315],[1160,200]],.65);
    road([[455,765],[510,870],[560,970]],.67);
    // Timber bridge landmark at the existing collision-safe crossing. The
    // deck is decorative only; navigation remains governed by the 2D route.
    function riverBridge(screenY){
      const riverX=wx(riverCenter(screenY)),z=wz(screenY);
      const bridgeGroup=new THREE.Group();bridgeGroup.position.set(riverX,.05,z);scene.add(bridgeGroup);
      const bridgeWood=makeMat(0x8a5536,.92);
      const bridgeTrim=makeMat(0xc58b55,.84);
      const bridgeStone=makeMat(0x71856f,.98);
      box(bridgeGroup,bridgeWood,0,0,0,5.8,.18,1.42);
      for(let i=-8;i<=8;i++){
        const plank=box(bridgeGroup,bridgeTrim,i*.34,.13,0,.27,.10,1.52,false);
        plank.rotation.y=(i%3-1)*.018;
      }
      for(const x of [-2.45,2.45])for(const zOffset of [-.55,.55]){
        box(bridgeGroup,bridgeWood,x,.78,zOffset,.18,1.45,.18);
        box(bridgeGroup,bridgeTrim,x*.5,1.42,zOffset,4.9,.13,.13);
      }
      for(const x of [-2.15,-1.08,0,1.08,2.15])for(const zOffset of [-.55,.55])
        box(bridgeGroup,bridgeTrim,x,.82,zOffset,.10,1.05,.10);
      for(const x of [-2.05,2.05])for(const zOffset of [-.52,.52])
        cyl(bridgeGroup,bridgeStone,x,-.13,zOffset,.28,.38,.62,7);
      const ropeMat=new THREE.MeshStandardMaterial({color:0x554438,roughness:1});
      for(const zOffset of [-.60,.60]){
        const ropeCurve=new THREE.CatmullRomCurve3([
          new THREE.Vector3(-2.45,1.28,zOffset),
          new THREE.Vector3(0,1.08,zOffset),
          new THREE.Vector3(2.45,1.28,zOffset)
        ]);
        const rope=new THREE.Mesh(new THREE.TubeGeometry(ropeCurve,12,.035,5,false),ropeMat);
        bridgeGroup.add(rope);
      }
      contactShadow(riverX,z,2.2,.72,.16);
    }
    riverBridge(580);
    // Hand-set path shoulders and courtyard cobbles break up the broad grass
    // plane while staying decorative and outside the navigation collision map.
    const cobbleGeo=new THREE.IcosahedronGeometry(1,1);
    const cobbleMat=makeMat(0x9eaa91,.92);
    const cobbles=new THREE.InstancedMesh(cobbleGeo,cobbleMat,180);
    const cobbleDummy=new THREE.Object3D();
    const cobbleLines=[
      [[285,490],[370,630],[455,765]],
      [[455,765],[610,708],[730,580]],
      [[970,580],[1180,825],[1540,690]],
      [[280,490],[420,435],[540,350]]
    ];
    let cobbleIndex=0;
    for(const line of cobbleLines){
      const curve=new THREE.CatmullRomCurve3(line.map(p=>new THREE.Vector3(wx(p[0]),.10,wz(p[1]))));
      const samples=curve.getPoints(43);
      for(let i=0;i<samples.length&&cobbleIndex<180;i++){
        const p=samples[i],t=i/samples.length,side=i%2?-1:1;
        const tangent=samples[Math.min(samples.length-1,i+1)].clone().sub(
          samples[Math.max(0,i-1)]).normalize();
        const offset=new THREE.Vector3(-tangent.z,0,tangent.x).multiplyScalar(.66+(i%3)*.13);
        cobbleDummy.position.copy(p).add(offset);cobbleDummy.position.y=.10;
        const size=.10+(i%4)*.025;
        cobbleDummy.scale.set(size*1.45,size*.62,size);
        cobbleDummy.rotation.set(0,Math.atan2(tangent.x,tangent.z)+side*.18,0);
        cobbleDummy.updateMatrix();cobbles.setMatrixAt(cobbleIndex++,cobbleDummy.matrix);
      }
    }
    cobbles.count=cobbleIndex;cobbles.instanceMatrix.needsUpdate=true;
    cobbles.castShadow=false;cobbles.receiveShadow=true;scene.add(cobbles);
    // Discreet trail lights provide readable depth cues after sunset without
    // adding expensive point lights to each marker.
    const lanternGlow=new THREE.MeshBasicMaterial({color:0xffe7a2});
    const lanternLights=[];
    for(const [px,py] of [[390,620],[610,709],[1040,650],[1310,735]]){
      const g=new THREE.Group();g.position.set(wx(px),0,wz(py));scene.add(g);
      cyl(g,mats.wood,0,.48,0,.065,.09,.92);
      const frame=box(g,mats.dark,0,1.01,0,.30,.42,.30);
      frame.castShadow=false;
      ball(g,lanternGlow,0,1.02,.02,.14,.17,.14,false);
      box(g,mats.gold,0,1.29,0,.37,.08,.37);
      // Only four low-intensity sources; keeps graphics practical for laptops.
      const light=new THREE.PointLight(0xffc475,0,5.8,2);
      light.position.set(0,1.14,0);g.add(light);lanternLights.push(light);
    }
    // The bridge is true geometry: elevated planks, support pillars, railings and posts.
    const bridge=new THREE.Group();bridge.position.set(wx(850),0,wz(580));scene.add(bridge);
    box(bridge,mats.wood,0,.24,0,6.35,.37,2.65);
    for(let i=0;i<25;i++){
      const x=-3.06+i*.255;
      box(bridge,i%4===0?mats.lightWood:mats.wood,x,.49,0,.225,.16,2.73);
      box(bridge,mats.lightWood,x,.585,-1.31,.10,.035,.08,false);
    }
    for(const side of [-1,1]){
      for(let i=0;i<=6;i++){
        const x=-3.1+i*1.04;
        box(bridge,mats.wood,x,1.03,side*1.33,.15,1.2,.16);
        ball(bridge,mats.gold,x,1.68,side*1.33,.12,.12,.12);
      }
      box(bridge,mats.lightWood,0,1.24,side*1.33,6.45,.12,.12);
    }
    for(const x of [-2.75,2.75])for(const z of [-.95,.95])cyl(bridge,mats.wood,x,-.26,z,.21,.27,1.3);
    // Bridge ropes and extra braces add detail while preserving its safe crossing footprint.
    for(const side of [-1,1]){
      for(let i=0;i<6;i++){
        const beam=box(bridge,mats.lightWood,-2.58+i*1.04,.79,side*1.35,.11,.95,.10);
        beam.rotation.z=(i%2?-1:1)*.18;
      }
    }
  
    // Richly grouped trees: roots, tapered bark, several shaded foliage crowns.
    const treeMaterials=[mats.leaf1,mats.leaf2,mats.leaf3,mats.leaf4];
    const windTrees=[];
    const canopySparkleLocations=[];
    function tree(x,z,s=1){
      const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);
      const trunk=cyl(g,mats.trunks,0,.76,0,.22,.33,1.57,9);
      trunk.rotation.z=(rng()-.5)*.08;
      ball(g,mats.trunks,-.22,.14,.12,.36,.17,.34);
      // Forked limbs create a readable tree silhouette instead of a single
      // trunk hidden by spherical foliage.
      for(const branch of [[-.34,1.18,.02,-.34],[.34,1.30,.08,.30],[-.08,1.55,-.18,-.12]]){
        const limb=cyl(g,mats.trunks,branch[0],branch[1],branch[2],.09,.13,.72,7);
        limb.rotation.z=branch[3];
        limb.rotation.x=(rng()-.5)*.18;
      }
      const offsets=[
        [0,2.18,0,.96],[-.67,1.86,.15,.75],[.61,2.06,.25,.82],
        [.16,2.63,-.41,.86],[-.31,2.50,.43,.69],[.02,2.92,.02,.57]
      ];
      for(let j=0;j<offsets.length;j++){
        const v=offsets[j];
        const crown=mesh(new THREE.IcosahedronGeometry(1,1),treeMaterials[j%4],g);
        crown.position.set(v[0],v[1],v[2]);
        crown.scale.set(v[3],v[3]*.89,v[3]);
        crown.rotation.set(rng()*.18,rng()*Math.PI,rng()*.18);
      }
      if(windTrees.length<23 && rng()<.27)windTrees.push({group:g,phase:rng()*Math.PI*2});
      // Collect clustered leaf highlights for a single instanced detail pass.
      // Creating one mesh per leaf would substantially hurt integrated GPUs.
      for(let j=0;j<5;j++){
        const angle=j*2.39996+rng()*.35;
        canopySparkleLocations.push({
          x:x+Math.cos(angle)*(.34+.34*rng())*s,
          y:(1.91+.48*rng())*s,
          z:z+Math.sin(angle)*(.32+.30*rng())*s,
          scale:(.15+.15*rng())*s
        });
      }
      return g;
    }
    const objectivePositions=spots.map(p=>[wx(p[1]),wz(p[2])]);
    // Thin canopy around interaction hotspots: players should see cabins,
    // the bridge, and NPCs instead of a solid wall of oversized treetops.
    for(let i=0;i<100;i++){
      const x=(rng()-.5)*45,z=(rng()-.5)*27;
      const screenY=z*SCALE+550;
      if(Math.abs(x-wx(riverCenter(screenY)))<3.8)continue;
      if(objectivePositions.some(p=>Math.hypot(x-p[0],z-p[1])<3.3))continue;
      if(Math.abs(x+13)<4.1 && z> -5 && z<8)continue;
      tree(x,z,.49+rng()*.43);
    }
    const leafHighlightGeo=new THREE.IcosahedronGeometry(1,0);
    const leafHighlightMat=new THREE.MeshStandardMaterial({
      color:0xb7de8d,roughness:1,flatShading:true,
      vertexColors:false
    });
    const leafHighlights=new THREE.InstancedMesh(
      leafHighlightGeo,leafHighlightMat,canopySparkleLocations.length);
    const leafDummy=new THREE.Object3D();
    for(let i=0;i<canopySparkleLocations.length;i++){
      const spot=canopySparkleLocations[i];
      leafDummy.position.set(spot.x,spot.y,spot.z);
      leafDummy.scale.set(spot.scale,spot.scale*.58,spot.scale*.86);
      leafDummy.rotation.set(0,i*.71,i*.37);
      leafDummy.updateMatrix();
      leafHighlights.setMatrixAt(i,leafDummy.matrix);
    }
    leafHighlights.instanceMatrix.needsUpdate=true;
    leafHighlights.castShadow=false;
    leafHighlights.receiveShadow=false;
    scene.add(leafHighlights);
    // Small understory clusters give the grass a lived-in, layered look.
    // Instancing keeps these hundreds of leafy forms to only three draw calls.
    const undergrowthGeo=new THREE.IcosahedronGeometry(.35,0);
    const undergrowthColors=[
      new THREE.MeshStandardMaterial({color:0x377e58,roughness:1,flatShading:true}),
      new THREE.MeshStandardMaterial({color:0x65a96a,roughness:1,flatShading:true}),
      new THREE.MeshStandardMaterial({color:0xa2c579,roughness:1,flatShading:true})
    ];
    const undergrowthDummy=new THREE.Object3D();
    for(let group=0;group<undergrowthColors.length;group++){
      const shrubCount=90;
      const shrubs=new THREE.InstancedMesh(
        undergrowthGeo,undergrowthColors[group],shrubCount);
      shrubs.castShadow=false;
      shrubs.receiveShadow=false;
      let placed=0,attempts=0;
      while(placed<shrubCount && attempts++<2200){
        const x=(rng()-.5)*45,z=(rng()-.5)*27;
        const sy=z*SCALE+550,sx=x*SCALE+900;
        if(Math.abs(x-wx(riverCenter(sy)))<4.15)continue;
        if(spots.some(([key,px,py])=>Math.hypot(px-sx,py-sy)<120))continue;
        if(z>-.6&&z<2.9&&x>-7&&x<4)continue;
        const factor=.45+rng()*1.05;
        undergrowthDummy.position.set(x,.12+factor*.1,z);
        undergrowthDummy.rotation.set(0,rng()*6.283,0);
        undergrowthDummy.scale.set(factor,.5*factor,.85*factor);
        undergrowthDummy.updateMatrix();
        shrubs.setMatrixAt(placed++,undergrowthDummy.matrix);
      }
      // All instances must be initialized, even if a future map adds obstacles.
      for(let i=placed;i<shrubCount;i++){
        undergrowthDummy.position.set(0,-100,0);
        undergrowthDummy.scale.setScalar(.001);
        undergrowthDummy.updateMatrix();
        shrubs.setMatrixAt(i,undergrowthDummy.matrix);
      }
      shrubs.instanceMatrix.needsUpdate=true;scene.add(shrubs);
    }
    // Tall cedar and pine trees break up the repeated round canopies.
    function pine(x,z,s=1){
      const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);
      cyl(g,mats.trunks,0,.72,0,.15,.2,1.38);
      for(let i=0;i<3;i++){
        const cone=mesh(new THREE.ConeGeometry(1.00-i*.17,1.75,7),i===1?mats.pineLight:mats.pine,g);
        cone.position.y=1.5+i*.79;
      }
      ball(g,mats.pineLight,-.34,.72,.29,.24,.18,.27);
    }
    for(let i=0;i<27;i++){
      const x=(rng()-.5)*44,z=(rng()-.5)*26;
      const riverX=wx(riverCenter(z*SCALE+550));
      if(Math.abs(x-riverX)<3.8 || objectivePositions.some(p=>Math.hypot(x-p[0],z-p[1])<3.3))continue;
      pine(x,z,.72+rng()*.44);
    }
    // Low understory planting gives the clearings a natural transition from
    // lawn to woodland without placing blockers on the established routes.
    const shrubGeo=new THREE.IcosahedronGeometry(1,1);
    const shrubBatch=new THREE.InstancedMesh(shrubGeo,mats.leaf3,110);
    const shrubDummy=new THREE.Object3D();
    for(let i=0;i<110;i++){
      const x=(rng()-.5)*44,z=(rng()-.5)*26;
      const px=x*SCALE+900,py=z*SCALE+550;
      if(Math.abs(x-wx(riverCenter(py)))<3.4||
        objectivePositions.some(p=>Math.hypot(x-p[0],z-p[1])<2.8))continue;
      const size=.16+rng()*.26;
      shrubDummy.position.set(x,size*.52,z);
      shrubDummy.scale.set(size*1.25,size,size*.92);
      shrubDummy.rotation.set(rng()*.2,rng()*Math.PI,rng()*.2);
      shrubDummy.updateMatrix();shrubBatch.setMatrixAt(i,shrubDummy.matrix);
    }
    shrubBatch.instanceMatrix.needsUpdate=true;
    shrubBatch.castShadow=false;shrubBatch.receiveShadow=true;
    scene.add(shrubBatch);
    // A slim foothill band replaces the old 360-degree ring of mountain
    // cones, which previously appeared directly in front of the village.
    const foothillMat=[makeMat(0x759d89),makeMat(0x86aa98),makeMat(0x678b83)];
    for(let i=0;i<12;i++){
      const x=-34+i*6.1,z=-26-(i%3)*2.1;
      const height=2.6+(i*5%5);
      const hill=mesh(new THREE.ConeGeometry(4.2,height,6),
        foothillMat[i%3],scene,false);
      hill.position.set(x,terrainElevation(x,z)+height*.44-.14,z);
    }
    for(let i=0;i<105;i++){
      const x=(rng()-.5)*43,z=(rng()-.5)*26;
      if(Math.abs(x-wx(riverCenter(z*SCALE+550)))<2.6)continue;
      const s=.13+rng()*.35;
      const m=ball(scene,i%3?mats.rock:mats.rock2,x,s*.35,z,s,s*.6,s*.79);
      m.rotation.y=rng()*6;
    }
    // Small flowers and tufts using instancing to keep the world fast.
    const flowerMat=new THREE.MeshStandardMaterial({color:0xffd886,flatShading:true,roughness:1});
    const grassGeometry=new THREE.ConeGeometry(.1,.44,4);
    const instanced=new THREE.InstancedMesh(grassGeometry,mats.grass3,360);
    instanced.castShadow=false;instanced.receiveShadow=false;
    const dummy=new THREE.Object3D();
    for(let i=0;i<360;i++){
      const x=(rng()-.5)*44,z=(rng()-.5)*27;
      dummy.position.set(x,.1,z);dummy.rotation.y=rng()*Math.PI*2;
      dummy.scale.setScalar(.55+rng()*1.5);dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate=true;scene.add(instanced);
    for(let i=0;i<95;i++){
      const x=(rng()-.5)*43,z=(rng()-.5)*26;
      ball(scene,i%2?flowerMat:makeMat(0xffffff),x,.16,z,.085,.09,.085,false);
    }
  
    // Delicate butterflies add motion close to the paths and garden.
    // The two wings use the same simple geometry and material on every butterfly.
    const butterflyWing=new THREE.PlaneGeometry(.26,.19);
    const butterflyColors=[
      new THREE.MeshBasicMaterial({color:0xffd977,side:THREE.DoubleSide}),
      new THREE.MeshBasicMaterial({color:0x86d9f1,side:THREE.DoubleSide}),
      new THREE.MeshBasicMaterial({color:0xffaac6,side:THREE.DoubleSide})
    ];
    const butterflies=[];
    for(let i=0;i<8;i++){
      const group=new THREE.Group();
      const bx=wx(280+(i%4)*86),bz=wz(550+Math.floor(i/4)*240);
      group.position.set(bx,.82,bz);
      for(const side of [-1,1]){
        const pivot=new THREE.Group();pivot.position.x=side*.11;group.add(pivot);
        const wing=mesh(butterflyWing,butterflyColors[i%3],pivot,false);
        wing.position.x=side*.10;wing.rotation.y=side*.14;
        pivot.userData.side=side;
      }
      ball(group,mats.dark,0,0,0,.055,.17,.055,false);
      scene.add(group);
      butterflies.push({group,x:bx,z:bz,phase:rng()*6.283});
    }
    // Village cottages use wall volumes, roof geometry, windows, chimney and door.
    // Shared pitched-roof geometry with real gable ends. The old cottage
    // roofs were square pyramids and read like low-detail placeholders.
    const roofGeo=new THREE.BufferGeometry();
    const roofVertices=[
      -1.88,2.51,-1.64, 0,3.91,-1.64, -1.88,2.51,1.64, 0,3.91,1.64,
       0,3.91,-1.64, 1.88,2.51,-1.64, 0,3.91,1.64, 1.88,2.51,1.64
    ];
    const roofUV=[0,0,3.4,0,0,4.6,3.4,4.6,0,0,3.4,0,0,4.6,3.4,4.6];
    roofGeo.setAttribute("position",new THREE.Float32BufferAttribute(roofVertices,3));
    roofGeo.setAttribute("uv",new THREE.Float32BufferAttribute(roofUV,2));
    roofGeo.setIndex([0,2,1,1,2,3,4,6,5,5,6,7]);
    roofGeo.computeVertexNormals();
    mats.roof.side=THREE.DoubleSide;
    const gableGeo=new THREE.BufferGeometry();
    gableGeo.setAttribute("position",new THREE.Float32BufferAttribute([
      -1.65,2.51,1.38,1.65,2.51,1.38,0,3.72,1.38,
      -1.65,2.51,-1.38,1.65,2.51,-1.38,0,3.72,-1.38
    ],3));
    gableGeo.setAttribute("uv",new THREE.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));
    gableGeo.setIndex([0,1,2,5,4,3]);gableGeo.computeVertexNormals();
    const warmWindow=new THREE.MeshStandardMaterial({
      color:0xffc884,emissive:0xffb05c,emissiveIntensity:.49,
      roughness:.36,metalness:0
    });
    // Feathered smoke sprites replace distracting solid white geometric balls.
    const smokeCanvas=document.createElement("canvas");
    smokeCanvas.width=64;smokeCanvas.height=64;
    const smokeCtx=smokeCanvas.getContext("2d");
    if(smokeCtx){
      const shade=smokeCtx.createRadialGradient(32,32,1,32,32,31);
      shade.addColorStop(0,"rgba(240,245,235,.55)");
      shade.addColorStop(.45,"rgba(214,229,220,.24)");
      shade.addColorStop(1,"rgba(208,222,215,0)");
      smokeCtx.fillStyle=shade;smokeCtx.fillRect(0,0,64,64);
    }
    const smokeTexture=new THREE.CanvasTexture(smokeCanvas);
    const chimneySmokes=[];
    function cottage(px,py,size=1,tint=0xf0d5a3){
      const g=new THREE.Group();g.position.set(wx(px),0,wz(py));g.scale.setScalar(size);scene.add(g);
      const wall=makeMat(tint);
      if(art.plaster)wall.map=art.plaster;
      box(g,wall,0,1.25,0,3.2,2.5,2.7);
      box(g,mats.door,0,.83,1.36,.78,1.65,.12);
      ball(g,mats.gold,.26,.92,1.47,.06);
      for(const x of [-1.1,1.1]){
        box(g,mats.dark,x,1.67,1.38,.61,.72,.07);
        box(g,warmWindow,x,1.67,1.43,.44,.55,.05);
        box(g,mats.trim,x,1.66,1.49,.065,.65,.055);
        box(g,mats.trim,x,1.66,1.49,.50,.065,.055);
        box(g,mats.wood,x,1.32,1.52,.73,.09,.22);
        for(const side of [-1,1]){
          const shutter=box(g,mats.wood,x+side*.37,1.68,1.46,.20,.76,.09);
          shutter.rotation.y=side*.14;
        }
      }
      const gables=mesh(gableGeo,wall,g);
      gables.material.side=THREE.DoubleSide;
      const roof=mesh(roofGeo,mats.roof,g);
      for(const side of [-1,1]){
        const eave=box(g,mats.roofDark,side*1.88,2.52,0,.14,.16,3.48);
        eave.castShadow=false;
        // Actual sloped trim along the front and back edges.
        for(const z of [-1.65,1.65]){
          const rafter=box(g,mats.lightWood,side*.94,3.23,z,.11,.12,2.34);
          rafter.rotation.z=side*.64;
        }
      }
      const chimney=box(g,mats.rock2,-.98,3.30,-.42,.46,1.25,.48);
      for(let row=0;row<5;row++){
        box(g,row%2?mats.rock:mats.rock2,-.98,2.78+row*.24,-.16,.52,.057,.055,false);
      }
      box(g,mats.rock,-.98,3.98,-.42,.59,.14,.62);
      // Small translucent chimney smoke puffs, no heavy volumetric effects.
      const smoke=new THREE.Group();smoke.position.set(-.98,4.08,-.42);
      g.add(smoke);
      for(let i=0;i<3;i++){
        const puff=new THREE.Sprite(new THREE.SpriteMaterial({
          map:smokeTexture,transparent:true,opacity:.14,depthWrite:false
        }));
        puff.position.set(0,i*.26,0);
        puff.scale.set(.42+i*.13,.48+i*.14,1);
        smoke.add(puff);
        chimneySmokes.push({puff,phase:i*.42+px*.003,source:smoke});
      }
      for(const x of [-1.47,1.47]){
        box(g,mats.wood,x,1.26,1.43,.15,2.5,.13);
        box(g,mats.wood,x,.3,0,.17,.6,2.8);
        box(g,mats.wood,x,1.95,1.44,.13,.95,.13);
        box(g,mats.lightWood,x,1.22,1.51,.16,.11,.16);
      }
      // Cottage timber framing adds structure to the previously flat walls.
      for(const yy of [.43,2.38]){
        box(g,mats.wood,0,yy,1.39,3.13,.11,.15);
        box(g,mats.wood,0,yy,-1.39,3.13,.11,.15);
      }
      for(const z of [-1.23,1.23]){
        box(g,mats.wood,-1.62,1.25,z,.10,2.50,.10);
        box(g,mats.wood,1.62,1.25,z,.10,2.50,.10);
      }
      // Roof ridge, shutter panels, planters and entry step.
      box(g,mats.roofDark,0,3.85,0,.13,.14,3.48);
      box(g,mats.rock2,0,.13,1.88,1.25,.25,.75);
      for(const x of [-1.04,1.04]){
        box(g,mats.wood,x,1.05,1.54,.95,.17,.43);
        box(g,mats.grass2,x,1.17,1.55,.85,.16,.33);
        for(const offset of [-.25,0,.25])
          ball(g,mats.flower,x+offset,1.35,1.59,.11,.12,.11,false);
      }
      return g;
    }
    // A real glTF asset pipeline, with one original authored model pack.
    // The existing procedural houses remain visible until a model is fully
    // loaded and validated. If CDN access, parsing, or asset fetch fails,
    // the adventure keeps the playable fallback village.
    const villagePlacements=[
      {name:"ElderHall",x:150,y:400,size:1.15,tint:0xf0d5a3},
      {name:"UpperCottage",x:345,y:270,size:.86,tint:0xeac7a3},
      {name:"LowerCottage",x:270,y:830,size:.75,tint:0xf8d2b4},
      {name:"Workshop",x:460,y:760,size:.87,tint:0xe0bc8c}
    ];
    const villageFallbacks=villagePlacements.map(p=>cottage(p.x,p.y,p.size,p.tint));
    for(const p of villagePlacements)contactShadow(wx(p.x),wz(p.y),1.65*p.size,1.35*p.size,.18);
    const upgradedVillageObjects=[];
    let villageAssetDisposed=false;
    const villageAssetState={status:"fallback",loaded:0,total:villagePlacements.length};
    async function loadVillageModels(){
      if(options.skipExternalAssets||(!usePinnedThree&&!options.assetLoaderFactory))return;
      villageAssetState.status="loading";
      try{
        // Relative to the HTML page: works in Codespaces and GitHub Pages.
        const assetUrl="./assets/village/village-kit.gltf";
        let pack;
        if(options.assetLoaderFactory){
          // Allows tests to verify model replacement without a CDN or WebGL.
          pack=await options.assetLoaderFactory(assetUrl,THREE);
        }else{
          // Import-map pin ensures GLTFLoader shares this exact Three.js runtime.
          const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
          if(villageAssetDisposed)return;
          pack=await new GLTFLoader().loadAsync(assetUrl);
        }
        if(villageAssetDisposed)return;
        for(let i=0;i<villagePlacements.length;i++){
          const p=villagePlacements[i];
          const original=pack.scene.getObjectByName(p.name);
          // A glTF node may be a Mesh directly, without child objects.
          if(!original || !(original.isMesh || original.children?.length))continue;
          const asset=original.clone(true);
          asset.position.set(wx(p.x),0,wz(p.y));
          asset.scale.setScalar(p.size);
          asset.traverse(node=>{
            if(node.isMesh){
              node.castShadow=true;node.receiveShadow=true;node.frustumCulled=true;
              const materials=Array.isArray(node.material)?node.material:[node.material];
              for(const material of materials){
                if(!material)continue;
                material.flatShading=false;
                material.needsUpdate=true;
                const name=(material.name||"").toLowerCase();
                if(name.includes("metal")||name.includes("hardware")){
                  material.metalness=Math.max(material.metalness||0,.55);
                  material.roughness=Math.min(material.roughness??.86,.34);
                }else if(name.includes("skin")||name.includes("hair")){
                  material.roughness=Math.min(material.roughness??.86,.72);
                }else{
                  material.roughness=Math.max(.48,Math.min(material.roughness??.86,.9));
                }
              }
            }
          });
          scene.add(asset);
          upgradedVillageObjects.push(asset);
          villageFallbacks[i].visible=false;
          villageAssetState.loaded++;
        }
        villageAssetState.status=villageAssetState.loaded===villagePlacements.length?"ready":villageAssetState.loaded?"partial":"fallback";
        if(villageAssetState.loaded&&typeof console!=="undefined"&&typeof console.info==="function")
          console.info("Thirst Trail: loaded "+villageAssetState.loaded+" original glTF village models.");
      }catch(error){
        villageAssetState.status=villageAssetState.loaded?"partial":"fallback";
        if(typeof console!=="undefined"&&typeof console.warn==="function")
          console.warn("Thirst Trail: keeping procedural village (model pack unavailable)",error);
      }
    }
    void loadVillageModels();
    // Fence and field props create a sense of place around the homes.
    function fence(x,z,length=5){
      for(let i=0;i<=length;i++){
        const postX=x+i*.68;
        box(scene,mats.lightWood,postX,.47,z,.15,.95,.17);
        ball(scene,mats.gold,postX,.98,z,.10,.13,.10);
      }
      for(const y of [.36,.66])box(scene,mats.wood,x+length*.34,y,z,length*.68,.11,.13);
    }
    fence(wx(150)-2.8,wz(400)+2.8,6);
    fence(wx(345)-2.4,wz(270)+2.6,5);
    // A painted information sign beside the village trail.
    const sign=new THREE.Group();sign.position.set(wx(300)+1.2,0,wz(510)-1.1);scene.add(sign);
    box(sign,mats.wood,0,.8,0,.19,1.7,.18);
    box(sign,mats.dark,0,1.73,0,2.45,.75,.19);
    box(sign,mats.gold,0,1.73,.12,2.13,.52,.04);
    box(sign,mats.dark,0,1.73,.153,1.84,.3,.043);
    // Village square: shaded market stall, storage jars, crop boxes and cloth banners.
    const square=new THREE.Group();square.position.set(wx(245),0,wz(475));scene.add(square);
    for(const x of [-1.35,1.35])for(const z of [-.75,.75])
      box(square,mats.wood,x,1.15,z,.13,2.3,.13);
    const canopy=mesh(new THREE.ConeGeometry(2.1,.68,4),makeMat(0xd8ac5e),square);
    canopy.position.set(0,2.44,0);canopy.rotation.y=Math.PI/4;canopy.scale.z=.60;
    box(square,mats.wood,0,.86,0,2.7,.14,1.20);
    for(const x of [-.85,-.35,.35,.85]){
      const pot=cyl(square,mats.roof,x,1.08,0,.19,.13,.31,8);
      ball(square,x>0?mats.grass2:mats.leaf2,x,1.35,0,.24,.21,.24);
    }
    // Fabric garlands use a small number of paper-thin triangular pennants.
    const buntingMat=[makeMat(0xf8cf5d),makeMat(0x8ac7c2),makeMat(0xf09b81)];
    const garland=new THREE.Group();garland.position.set(wx(310),0,wz(420));scene.add(garland);
    box(garland,mats.lightWood,0,2.9,0,8.3,.025,.025,false);
    for(let i=0;i<16;i++){
      const flag=mesh(new THREE.ConeGeometry(.23,.48,3),buntingMat[i%3],garland,false);
      flag.position.set(-3.85+i*.52,2.63,0);flag.rotation.y=Math.PI/3;
    }
    // Raised garden patches border the trail without blocking movement.
    for(const [gx,gz] of [[wx(380),wz(340)],[wx(405),wz(355)]]){
      box(scene,mats.wood,gx,.13,gz,1.5,.24,.72);
      box(scene,mats.trunks,gx,.28,gz,1.32,.11,.56);
      for(let i=0;i<5;i++)ball(scene,mats.leaf2,gx-.52+i*.26,.44,gz,.16,.2,.13);
    }
    // Supply station with recognizable crates and banner.
    const supply=new THREE.Group();supply.position.set(wx(1190),0,wz(825));scene.add(supply);
    for(let i=0;i<4;i++){
      const x=(i%2)*.98-.5,z=Math.floor(i/2)*.92-.4;
      box(supply,mats.wood,x,.39,z,.9,.78,.86);
      box(supply,mats.lightWood,x,.81,z,.93,.09,.91);
      box(supply,mats.dark,x,.39,z,.08,.75,.9);
      box(supply,mats.gold,x-.31,.43,z+.45,.10,.42,.07);
      box(supply,mats.gold,x+.31,.43,z+.45,.10,.42,.07);
    }
    // Workshop frontage: an awning, workbench and stacked timber make the
    // depot read as a working place rather than an isolated crate marker.
    const workshopFront=new THREE.Group();
    workshopFront.position.set(wx(455),0,wz(765)+1.55);scene.add(workshopFront);
    for(const x of [-1.25,1.25])box(workshopFront,mats.wood,x,1.15,0,.13,2.3,.13);
    const awning=box(workshopFront,mats.roofDark,0,2.25,0,2.9,.13,1.55);
    awning.rotation.z=-.08;
    box(workshopFront,mats.lightWood,0,.78,.42,2.35,.16,.74);
    for(let i=0;i<3;i++){
      const log=cyl(workshopFront,mats.wood,-.78+i*.58,.42,.54,.16,.18,1.25,8);
      log.rotation.z=Math.PI/2;
    }
    for(let i=0;i<4;i++)box(workshopFront,mats.rock2,-1.35+i*.9,.14,.44,.28,.22,.44);
    // Campsite: pitched tent, logs and warm firelight.
    const camp=new THREE.Group();camp.position.set(wx(540),0,wz(350));scene.add(camp);
    contactShadow(wx(540),wz(350),2.45,2.0,.24);
    const tentMat=makeMat(0xf2b464),tentSide=makeMat(0xd7814c);
    const t1=mesh(new THREE.ConeGeometry(2.0,2.8,4),tentMat,camp);
    t1.rotation.y=Math.PI/4;t1.position.y=1.39;t1.scale.z=.68;
    const opening=mesh(new THREE.ConeGeometry(.8,1.65,3),tentSide,camp);
    opening.rotation.y=Math.PI/3;opening.position.set(0,.83,1.22);
    cyl(camp,mats.rock,.0,.16,3.0,.73,.68,.26);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ball(camp,mats.rock,Math.cos(a)*.75,.16,3+Math.sin(a)*.75,.26,.22,.24);}
    const flameMat=new THREE.MeshBasicMaterial({color:0xffaa42});
    const fire=mesh(new THREE.ConeGeometry(.28,.7,6),flameMat,camp,false);
    fire.position.set(0,.63,3);
    const fireLight=new THREE.PointLight(0xffae5e,15,9,2);
    fireLight.position.set(0,1.1,3);camp.add(fireLight);
    for(const z of [-1.65,1.65])box(camp,mats.wood,2.5,.27,z,1.8,.42,.48);
    // Polished metallic pump, crank, spout and basin.
    const pump=new THREE.Group();pump.position.set(wx(1540),0,wz(690));scene.add(pump);
    contactShadow(wx(1540),wz(690),1.8,1.45,.28);
    const metal=makeMat(0x6aa9ac,.35,.6),lightMetal=makeMat(0xd2e2d7,.28,.5);
    cyl(pump,mats.rock,0,.19,0,1.12,1.2,.4,12);
    cyl(pump,metal,0,1.52,0,.47,.57,2.5,12);
    cyl(pump,lightMetal,0,2.85,0,.68,.53,.33,12);
    const spout=cyl(pump,metal,0,2.22,.75,.16,.18,1.72,12);
    spout.rotation.x=Math.PI/2;
    cyl(pump,lightMetal,0,3.18,0,.16,.16,.55);
    box(pump,mats.dark,.65,3.45,0,1.45,.14,.16);
    ball(pump,mats.gold,1.4,3.45,0,.20);
    cyl(pump,mats.rock2,0,.23,1.45,.89,1.03,.45,12);
    // Broad stone apron grounds the pump landmark and keeps its silhouette
    // legible against the surrounding meadow.
    for(let i=0;i<11;i++){
      const a=i/11*Math.PI*2;
      const stone=ball(pump,mats.rock2,Math.cos(a)*1.28,.12,1.0+Math.sin(a)*.88,
        .34,.16,.28,false);
      stone.rotation.y=a;
    }
    cyl(pump,makeMat(0x2899a7,.18),0,.47,1.45,.68,.68,.035,14);
    // Pressure gauge and water droplets visually distinguish the repair objective.
    const gauge=new THREE.Group();gauge.position.set(.38,2.49,.32);pump.add(gauge);
    const gaugeRim=cyl(gauge,mats.dark,0,0,0,.26,.26,.12,20);
    gaugeRim.rotation.x=Math.PI/2;
    const gaugeFace=cyl(gauge,mats.trim,0,0,.075,.20,.20,.025,20);
    gaugeFace.rotation.x=Math.PI/2;
    const needle=box(gauge,mats.roofDark,.055,.035,.098,.13,.025,.026);
    needle.rotation.z=-.6;
    for(const dx of [-.46,.46]){
      box(pump,mats.lightWood,dx,.57,1.45,.16,.14,.18);
    }
    // Water flowing from a repaired pump provides a visible, story-driven reward.
    const pumpFlow=new THREE.Group();pump.add(pumpFlow);
    const flowMat=new THREE.MeshBasicMaterial({
      color:0x82e9ff,transparent:true,opacity:.83,depthWrite:false
    });
    const flowGeo=new THREE.SphereGeometry(.10,8,6);
    const flowDroplets=[];
    for(let i=0;i<13;i++){
      const drop=mesh(flowGeo,flowMat,pumpFlow,false);
      drop.scale.set(.75,1.1,.75);flowDroplets.push(drop);
    }
    pumpFlow.visible=false;
    // The hillside waterworks is an explorable landmark, not a flat icon:
    // terraced stone, blue reservoirs, a small wooden waterwheel and distant orchard.
    const terrace=new THREE.Group();
    terrace.position.set(wx(1360),0,wz(365));scene.add(terrace);
    const stoneDeep=makeMat(0x718b80),stoneLite=makeMat(0xb6c8aa);
    for(let level=0;level<3;level++){
      const width=5.9-level*.65;
      box(terrace,stoneDeep,0,level*.27,.0+level*.65,width,.44,1.45);
      box(terrace,stoneLite,0,level*.27+.23,.0+level*.65,width+.07,.08,1.43);
      for(let i=0;i<9;i++){
        const x=(i-4)*(width/10);
        ball(terrace,i%2?mats.grass3:mats.leaf2,x,level*.27+.38,level*.65,
          .22,.19,.24,false);
      }
    }
    const reservoir=mesh(new THREE.CylinderGeometry(1.38,1.48,.34,24),mats.rock2,terrace);
    reservoir.position.set(1.55,.52,2.95);
    const basinWater=mesh(new THREE.CylinderGeometry(1.28,1.28,.06,24),waterMat,terrace,false);
    basinWater.position.set(1.55,.73,2.95);
    const waterwheel=new THREE.Group();
    waterwheel.position.set(-1.15,1.0,2.35);terrace.add(waterwheel);
    const wheelAxle=cyl(waterwheel,mats.wood,0,0,0,.17,.17,.62,10);
    wheelAxle.rotation.x=Math.PI/2;
    for(const offset of [-.32,.32]){
      const rim=mesh(new THREE.TorusGeometry(.84,.085,8,24),mats.lightWood,waterwheel);
      rim.position.z=offset;
      for(let i=0;i<10;i++){
        const angle=i*Math.PI/5;
        const spoke=box(waterwheel,mats.wood,
          Math.cos(angle)*.44,Math.sin(angle)*.44,offset,.11,.85,.11);
        spoke.rotation.z=angle-Math.PI/2;
      }
    }
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      const paddle=box(waterwheel,mats.wood,Math.cos(a)*.84,Math.sin(a)*.84,0,
        .12,.31,.85);
      paddle.rotation.z=a;
    }
    // A short stream links the high basin to the valley with layered flow.
    const chute=new THREE.Group();terrace.add(chute);
    box(chute,mats.wood,1.55,.93,1.74,.91,.16,1.75);
    const chuteWater=box(chute,waterMat,1.55,1.035,1.74,.65,.035,1.69,false);
    // A bright cascading spillway becomes a recognizable destination landmark.
    // Layered translucent water curtains are cheaper than animated fluid geometry.
    const cascade=new THREE.Group();cascade.position.set(1.55,0,3.85);terrace.add(cascade);
    const fallMaterials=[
      new THREE.MeshBasicMaterial({color:0x7cdeee,transparent:true,opacity:.59,
        depthWrite:false,side:THREE.DoubleSide}),
      new THREE.MeshBasicMaterial({color:0xdbffff,transparent:true,opacity:.39,
        depthWrite:false,side:THREE.DoubleSide})
    ];
    const cascadeStrips=[];
    for(let i=0;i<7;i++){
      const strip=mesh(new THREE.PlaneGeometry(.15+i%2*.045,1.6),fallMaterials[i%2],cascade,false);
      strip.position.set((i-3)*.115,1.28+(i%3)*.045,(i%2)*.08);
      strip.rotation.x=-.12;
      cascadeStrips.push(strip);
    }
    const plunge=mesh(new THREE.CylinderGeometry(.81,.88,.065,28),waterMat,cascade,false);
    plunge.position.y=.19;plunge.position.z=.22;
    const waterfallMist=new THREE.MeshBasicMaterial({color:0xd4fff9,
      transparent:true,opacity:.67,depthWrite:false});
    const mistParticles=[];
    for(let i=0;i<21;i++){
      const particle=ball(cascade,waterfallMist,0,.32,0,
        .045+i%4*.019,.045+i%3*.014,.045+i%4*.019,false);
      mistParticles.push(particle);
    }
    const sprayRing=mesh(new THREE.TorusGeometry(.78,.038,5,36),
      new THREE.MeshBasicMaterial({color:0xd6ffff,transparent:true,opacity:.52,
        depthWrite:false}),cascade,false);
    sprayRing.rotation.x=-Math.PI/2;sprayRing.position.set(0,.255,.20);
    // Orchards beside the hill use foliage colors distinct from the forest.
    const orchardLeaf=makeMat(0x8bc47f),fruitMat=makeMat(0xf0ac62);
    for(let i=0;i<10;i++){
      const x=wx(1200+(i%5)*59),z=wz(145+Math.floor(i/5)*70);
      const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
      cyl(group,mats.trunks,0,.64,0,.13,.18,1.28);
      ball(group,orchardLeaf,0,1.67,0,.75,.61,.72);
      for(let k=0;k<3;k++){
        const a=(i+k)*2.4;
        ball(group,fruitMat,Math.cos(a)*.48,1.50+Math.sin(a)*.16,Math.sin(a)*.47,
          .11,.11,.11,false);
      }
    }
    // Raincatch Ridge: raised catchment roof, covered tank, pipes and wind vane.
    // The activity's physical landmark remains visible even before the quest begins.
    const rainStation=new THREE.Group();rainStation.position.set(wx(1160),0,wz(200));scene.add(rainStation);
    const roofTin=makeMat(0x6eaba7,.48,.18),roofBorder=makeMat(0xeccb8d);
    for(const x of [-1.25,1.25])for(const z of [-.75,.75])
      box(rainStation,mats.wood,x,1.25,z,.16,2.5,.17);
    for(const x of [-.66,.66]){
      const roofPanel=box(rainStation,roofTin,x,2.54,0,1.62,.13,2.5);
      roofPanel.rotation.z=x<0?-.31:.31;
    }
    box(rainStation,roofBorder,0,2.92,0,.15,.12,2.67);
    box(rainStation,roofBorder,-1.30,2.33,0,.14,.12,2.55);
    box(rainStation,roofBorder,1.30,2.33,0,.14,.12,2.55);
    const catchTank=cyl(rainStation,metal,2.18,.80,.55,.8,.82,1.48,18);
    cyl(rainStation,lightMetal,2.18,1.59,.55,.87,.87,.14,18);
    const tankCap=cyl(rainStation,mats.dark,2.18,1.7,.55,.95,.95,.10,18);
    box(rainStation,mats.lightWood,2.18,.57,1.36,.25,.54,.17);
    const roofDrain=box(rainStation,lightMetal,1.35,1.91,.55,.12,.78,.12);
    const roofOutlet=box(rainStation,lightMetal,1.76,1.50,.55,.84,.12,.12);
    // Tall weather vane draws attention to the new optional area from a distance.
    cyl(rainStation,mats.wood,-1.98,2.15,-.45,.055,.073,4.25,9);
    const rainVane=new THREE.Group();rainVane.position.set(-1.98,4.27,-.45);rainStation.add(rainVane);
    box(rainVane,mats.gold,0,0,0,1.25,.09,.10);
    const vanePointer=mesh(new THREE.ConeGeometry(.19,.48,3),mats.gold,rainVane);
    vanePointer.position.x=.76;vanePointer.rotation.z=-Math.PI/2;
    ball(rainVane,mats.gold,0,.01,0,.11,.11,.11);
    // A few translucent droplets circulate through the rainwater barrel.
    const rainDropMat=new THREE.MeshBasicMaterial({color:0xa9f4f5,transparent:true,opacity:.6,depthWrite:false});
    const stationDroplets=[];
    for(let i=0;i<10;i++){
      const droplet=ball(rainStation,rainDropMat,1.65,2.1,.62,.06,.14,.06,false);
      stationDroplets.push(droplet);
    }
    // Alternative mountain spring.
    const spring=new THREE.Group();spring.position.set(wx(1460),0,wz(265));scene.add(spring);
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2;
      ball(spring,mats.rock2,Math.cos(a)*1.3,.25,Math.sin(a)*.95,.6,.37,.48);
    }
    const pond=mesh(new THREE.CylinderGeometry(1.18,1.18,.09,32),waterMat,spring,false);
    pond.position.y=.20;
    // Soft turquoise rings give the alternative spring its own landmark character.
    const springRings=[];
    for(let i=0;i<3;i++){
      const ring=mesh(new THREE.TorusGeometry(.55+i*.26,.024,5,36),
        new THREE.MeshBasicMaterial({
          color:0xd6fff9,transparent:true,opacity:.42,depthWrite:false
        }),spring,false);
      ring.rotation.x=-Math.PI/2;ring.position.y=.278;
      springRings.push(ring);
    }

    // Wetland Sanctuary: low water, raised boardwalk, reeds, floating leaves
    // and a resident wading bird. Decorative geometry doesn't change collisions.
    const marshWorld=new THREE.Group();marshWorld.position.set(wx(560),0,wz(970));scene.add(marshWorld);
    const wetMud=makeMat(0x75977a),marshLeaves=makeMat(0x4d9c74),bloom=makeMat(0xe9b0c5);
    const pondBed=mesh(new THREE.CylinderGeometry(3.05,3.11,.10,32),wetMud,marshWorld);
    pondBed.position.set(1.55,.03,-.22);
    const marshWater=mesh(new THREE.CylinderGeometry(2.77,2.8,.07,32),waterMat,marshWorld,false);
    marshWater.position.set(1.55,.11,-.22);
    for(let i=0;i<14;i++){
      const z=-2.4+i*.34;
      box(marshWorld,i%3===0?mats.lightWood:mats.wood,-.35,.37,z,1.45,.17,.30);
      if(i%3===0)for(const side of [-1,1])
        box(marshWorld,mats.wood,-.35+side*.81,.72,z,.10,.73,.11);
    }
    for(const x of [-1.17,.47])box(marshWorld,mats.lightWood,x,1.12,-.1,.09,.10,4.92);
    const marshReeds=new THREE.InstancedMesh(new THREE.ConeGeometry(.055,.85,5),marshLeaves,80);
    const reedDummy2=new THREE.Object3D();
    for(let i=0;i<80;i++){
      const a=i*2.399963+Math.PI*.4,r=2.85+(i%4)*.16;
      reedDummy2.position.set(1.55+Math.cos(a)*r,.35,-.22+Math.sin(a)*r*.75);
      reedDummy2.rotation.y=i*.72;reedDummy2.scale.setScalar(.6+(i%6)*.11);
      reedDummy2.updateMatrix();marshReeds.setMatrixAt(i,reedDummy2.matrix);
    }
    marshReeds.instanceMatrix.needsUpdate=true;marshWorld.add(marshReeds);
    for(let i=0;i<9;i++){
      const a=i*2.1,r=.8+(i%3)*.48;
      const x=1.55+Math.cos(a)*r,z=-.22+Math.sin(a)*r*.7;
      const leaf=mesh(new THREE.CylinderGeometry(.26,.26,.025,9),marshLeaves,marshWorld,false);
      leaf.position.set(x,.16,z);
      if(i%3===0){
        ball(marshWorld,bloom,x,.32,z,.17,.11,.17,false);
        ball(marshWorld,mats.gold,x,.42,z,.055,.045,.055,false);
      }
    }
    // A wading heron provides a recognizable wildlife landmark.
    const heron=new THREE.Group();heron.position.set(3.05,0,-1.30);marshWorld.add(heron);
    const birdWhite=makeMat(0xe1e9d4),birdBeak=makeMat(0xe5a95c);
    for(const x of [-.13,.13])cyl(heron,mats.wood,x,.52,0,.035,.04,1.02,7);
    ball(heron,birdWhite,0,1.29,0,.42,.32,.29);
    const heronNeck=cyl(heron,birdWhite,.24,1.74,.02,.092,.09,.78,8);
    heronNeck.rotation.z=-.13;
    ball(heron,birdWhite,.23,2.19,.02,.19,.17,.17);
    const bill=mesh(new THREE.ConeGeometry(.09,.50,5),birdBeak,heron,false);
    bill.position.set(.24,2.14,.30);bill.rotation.x=Math.PI/2;
    ball(heron,mats.dark,.35,2.23,.14,.03,.034,.035,false);
    // Sign and litter baskets make the stewardship area readable at game scale.
    const bin=mesh(new THREE.CylinderGeometry(.41,.35,.82,9),makeMat(0x5f9890),marshWorld);
    bin.position.set(-1.84,.42,1.08);
    box(marshWorld,mats.gold,-1.84,.91,1.08,.95,.11,.85);
    box(marshWorld,mats.wood,-2.10,.97,-1.20,.13,1.94,.13);
    box(marshWorld,mats.trim,-2.1,1.71,-1.10,1.6,.64,.12);
    // Mission markers and billboard labels that stay legible as the camera moves.
    function labelTexture(title){
      const cn=document.createElement("canvas");cn.width=512;cn.height=128;
      const c=cn.getContext("2d");
      c.fillStyle="#0e323d";c.beginPath();c.roundRect(10,8,492,109,28);c.fill();
      c.strokeStyle="rgba(255,229,148,.8)";c.lineWidth=4;c.stroke();
      c.fillStyle="#fff5d6";c.font="bold 40px system-ui";c.textAlign="center";
      c.fillText(title,256,80,450);
      return new THREE.CanvasTexture(cn);
    }
    const markers={};
    for(const [key,sx,sy,name,color] of spots){
      const g=new THREE.Group();g.position.set(wx(sx),0,wz(sy));scene.add(g);
      const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.62,depthWrite:false});
      const ring=mesh(new THREE.TorusGeometry(.85,.07,8,45),mat,g,false);
      ring.rotation.x=-Math.PI/2;ring.position.y=.15;
      const beacon=mesh(new THREE.CylinderGeometry(.07,.45,1.5,12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.15,depthWrite:false}),g,false);
      beacon.position.y=.90;
      const badge=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(name),transparent:true,depthTest:false,depthWrite:false}));
      badge.position.set(0,3.28,0);badge.scale.set(3.45,.86,1);g.add(badge);
      const dot=ball(g,new THREE.MeshBasicMaterial({color}),0,1.72,0,.23,.23,.23,false);
      markers[key]={group:g,ring,beacon,dot,mat};
    }
    // Four sealed-water supply caches: collecting them restores some energy.
    const supplyModels=[];
    const bottleMat=new THREE.MeshStandardMaterial({color:0x91e1e5,roughness:.29,metalness:.08});
    for(const cache of supplyCaches){
      const g=new THREE.Group();g.position.set(wx(cache.x),0,wz(cache.y));scene.add(g);
      cyl(g,mats.wood,0,.18,0,.58,.65,.38,8);
      const bottle=cyl(g,bottleMat,0,.84,0,.22,.24,.93,10);
      cyl(g,mats.gold,0,1.35,0,.14,.14,.17,10);
      box(g,mats.trim,0,.84,.24,.32,.24,.05,false);
      const halo=mesh(new THREE.TorusGeometry(.48,.05,6,26),new THREE.MeshBasicMaterial({
        color:0x9feaff,transparent:true,opacity:.72,depthWrite:false
      }),g,false);
      halo.rotation.x=-Math.PI/2;halo.position.y=.10;
      supplyModels.push({g,halo,id:cache.id,bottle});
    }
    // Waypoint beacons create a readable 3D trail to the selected mission.
    // Positions follow the existing collision-aware path, including the bridge.
    const trailBeacons=[];
    const trailMaterial=new THREE.MeshBasicMaterial({
      color:0xffe29a,transparent:true,opacity:.85,depthWrite:false
    });
    const beaconShape=new THREE.OctahedronGeometry(.18,0);
    for(let i=0;i<16;i++){
      const point=mesh(beaconShape,trailMaterial,scene,false);
      point.visible=false;trailBeacons.push(point);
    }
    // A few birds high above the fields make the horizon feel inhabited.
    // They are background silhouettes and are never obstacles.
    const birds=[];
    // Birds read as small pale silhouettes in the distance, not enormous
    // dark triangles flying over the player and river.
    const birdMaterial=new THREE.MeshBasicMaterial({
      color:0xe3eee2,side:THREE.DoubleSide
    });
    for(let i=0;i<5;i++){
      const g=new THREE.Group();scene.add(g);g.scale.setScalar(.58);
      const wings=[];
      for(const side of [-1,1]){
        const pivot=new THREE.Group();pivot.position.x=side*.045;g.add(pivot);
        const wing=mesh(new THREE.ConeGeometry(.085,.43,3),birdMaterial,pivot,false);
        wing.rotation.z=side*Math.PI/2;wing.position.x=side*.22;
        wings.push({pivot,side});
      }
      birds.push({group:g,wings,phase:i*1.37,originX:-10+i*4.2,originZ:-21-(i%3)*2.4});
    }
    // World-space achievement bursts: small reusable gems, expanding rings and light.
    // These effects are driven by real quest state and never block player controls.
    const achievementGroup=new THREE.Group();scene.add(achievementGroup);
    achievementGroup.visible=false;
    const sparkleMaterials=[
      new THREE.MeshBasicMaterial({color:0xffe29a,depthWrite:false}),
      new THREE.MeshBasicMaterial({color:0xa0ffe1,depthWrite:false}),
      new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false})
    ];
    const sparkleGeometry=new THREE.OctahedronGeometry(.12,0);
    const sparkles=[];
    for(let i=0;i<48;i++){
      const gem=mesh(sparkleGeometry,sparkleMaterials[i%3],achievementGroup,false);
      gem.visible=false;
      sparkles.push(gem);
    }
    const achievementRings=[];
    for(let i=0;i<3;i++){
      const ringMat=new THREE.MeshBasicMaterial({
        color:i===1?0xa1ffe5:0xffe39b,transparent:true,opacity:.55,
        side:THREE.DoubleSide,depthWrite:false
      });
      const ring=mesh(new THREE.TorusGeometry(.92,.055,7,52),ringMat,achievementGroup,false);
      ring.rotation.x=-Math.PI/2;ring.position.y=.14+i*.04;ring.visible=false;
      achievementRings.push(ring);
    }
    const achievementLight=new THREE.PointLight(0xffdea0,0,12,2);
    achievementLight.position.set(0,2.2,0);achievementGroup.add(achievementLight);
    // Residents give each objective a visible human presence rather than only
    // presenting a floating quest marker. They remain decorative: interaction
    // continues through the original quest logic and E key.
    function resident(px,py,coatColor,headCover=false){
      const g=new THREE.Group();g.position.set(wx(px),0,wz(py));scene.add(g);
      const coat=makeMat(coatColor),skin=makeMat(0xc58b67);
      cyl(g,coat,0,1.03,0,.33,.51,1.20,9);
      ball(g,skin,0,1.92,.045,.29,.33,.30);
      if(headCover){
        ball(g,mats.trim,0,2.08,-.08,.34,.23,.32);
        for(const side of [-1,1])box(g,mats.trim,side*.27,1.62,-.10,.14,.43,.20);
      }else{
        ball(g,mats.roofDark,0,2.13,-.06,.32,.17,.30);
      }
      for(const side of [-1,1]){
        box(g,coat,side*.39,1.22,0,.21,.73,.26);
        box(g,mats.wood,side*.17,.38,0,.25,.74,.29);
      }
      const waveArm=new THREE.Group();waveArm.position.set(.39,1.55,0);g.add(waveArm);
      cyl(waveArm,coat,0,-.22,0,.13,.12,.51,8);
      ball(waveArm,skin,0,-.49,.02,.14,.16,.12);
      return {g,waveArm,baseX:g.position.x,baseZ:g.position.z};
    }
    const villagers=[
      resident(245,515,0x8c6699,true),
      resident(472,825,0x4f8c9b,false)
    ];
    // Slightly larger stylized explorer, visible even at the standard isometric zoom.
    const explorer=new THREE.Group();scene.add(explorer);
    explorer.scale.setScalar(1.19);
    const characterFill=new THREE.PointLight(0xffe5ce,.55,6.5,2);
    characterFill.position.set(-1.2,3.6,2.2);
    explorer.add(characterFill);
    const skin=makeMat(0xce9169),shirt=makeMat(0x29a6a0),pants=makeMat(0x335772),
          boots=makeMat(0x3d3035),bag=makeMat(0xdc814e),hat=makeMat(0xf9c768),hair=makeMat(0x47342d);
    const shadow=mesh(new THREE.CircleGeometry(.56,22),new THREE.MeshBasicMaterial({color:0x203d34,transparent:true,opacity:.26,depthWrite:false}),explorer,false);
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.05;
    const body=new THREE.Group();explorer.add(body);
    cyl(body,shirt,0,1.35,0,.43,.38,.99);
    ball(body,skin,0,2.13,.04,.34,.39,.34);
    ball(body,hair,0,2.37,-.05,.36,.19,.33);
    cyl(body,hat,0,2.49,0,.41,.40,.16);
    cyl(body,hat,0,2.43,.2,.51,.51,.06);
    // Hat band, ears, eyebrows, and nose add character at close camera distances.
    cyl(body,mats.roofDark,0,2.445,0,.417,.417,.047,12);
    for(const side of [-1,1])ball(body,skin,side*.335,2.12,0,.09,.13,.10);
    for(const x of [-.13,.13]){
      ball(body,mats.dark,x,2.18,.335,.041,.053,.035);
      box(body,hair,x,2.285,.32,.10,.035,.045);
    }
    ball(body,skin,0,2.055,.37,.08,.09,.065);
    box(body,bag,0,1.45,-.47,.78,.94,.36);
    box(body,mats.lightWood,0,1.5,-.67,.46,.07,.05);
    // Backpack straps, neck scarf and a small water flask.
    for(const side of [-.27,.27])
      box(body,mats.wood,side,1.57,.29,.11,.74,.09);
    box(body,mats.gold,0,1.80,.28,.48,.14,.17);
    // Small jacket pockets and a rolled sleeping mat give the explorer a richer silhouette.
    for(const side of [-1,1]){
      box(body,mats.dark,side*.25,1.31,.35,.24,.25,.10);
      box(body,mats.trim,side*.25,1.19,.41,.15,.035,.04);
    }
    const bedroll=cyl(body,makeMat(0x679486),0,1.98,-.54,.29,.29,.97,9);
    bedroll.rotation.z=Math.PI/2;
    for(const x of [-.32,.32]){
      box(body,mats.wood,x,1.96,-.81,.085,.13,.11);
    }
    // Layered belt and a compass badge turn simple primitives into adventure gear.
    box(body,mats.wood,0,1.04,.245,.74,.16,.11);
    box(body,mats.gold,0,1.04,.305,.20,.17,.035);
    const compass=cyl(body,mats.gold,.25,1.62,.46,.14,.14,.075,14);
    compass.rotation.x=Math.PI/2;
    const scarfTail=box(body,mats.gold,-.27,1.61,-.11,.19,.38,.15);
    scarfTail.rotation.z=-.25;
    const flask=cyl(body,makeMat(0x4ab9cb,.35,.35),-.53,1.12,-.31,.17,.17,.49,12);
    flask.rotation.z=.16;
    cyl(body,mats.lightWood,-.53,1.41,-.31,.1,.10,.10);

    // Arm/leg joints add subtle bend to walking, waving and celebrating.
    const arms=[],legs=[],elbows=[],knees=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.48,1.75,0);body.add(arm);
      cyl(arm,shirt,0,-.18,0,.18,.17,.39);
      const elbow=new THREE.Group();elbow.position.y=-.37;arm.add(elbow);
      cyl(elbow,skin,0,-.20,0,.13,.12,.39);
      ball(elbow,skin,0,-.41,.045,.15,.16,.15);
      box(arm,mats.gold,0,-.32,0,.28,.08,.28);
      arms.push(arm);elbows.push(elbow);

      const leg=new THREE.Group();leg.position.set(side*.22,.9,0);body.add(leg);
      cyl(leg,pants,0,-.21,0,.19,.18,.43);
      const knee=new THREE.Group();knee.position.y=-.40;leg.add(knee);
      cyl(knee,pants,0,-.12,0,.17,.155,.30);
      box(knee,boots,0,-.34,.10,.35,.25,.53);
      box(knee,mats.gold,0,-.27,.29,.27,.055,.04);
      legs.push(leg);knees.push(knee);
    }
    explorer.position.set(wx(310),0,wz(620));

    // Authored glTF adventurer: articulated named joints drive the SAME gameplay
    // motion as the original character. Keep the procedural body until validated.
    const characterAssetState={status:"fallback",loaded:0,total:1};
    let characterAssetDisposed=false,characterRig=null;
    let characterModel=null;
    const characterMotion={locomotion:0,running:0,greeting:0,celebration:0,phase:0,lastTime:0};
    const rigJointNames=[
      "ExplorerBody","ExplorerHead","ExplorerEyes","ExplorerScarfTail",
      "ExplorerArmLeft","ExplorerArmRight","ExplorerElbowLeft","ExplorerElbowRight",
      "ExplorerLegLeft","ExplorerLegRight","ExplorerKneeLeft","ExplorerKneeRight",
      "ExplorerPackFlap"
    ];
    async function loadExplorerModel(){
      if(!window.ThirstExplorer&&(options.skipExternalAssets||(!usePinnedThree&&!options.characterLoaderFactory)))return;
      characterAssetState.status="loading";
      try{
        let asset;
        const assetUrl="./assets/characters/explorer.gltf";
        if(window.ThirstExplorer){
          asset={scene:window.ThirstExplorer.create(THREE)};
        }else if(options.characterLoaderFactory){
          asset=await options.characterLoaderFactory(assetUrl,THREE);
        }else{
          const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
          if(characterAssetDisposed)return;
          asset=await new GLTFLoader().loadAsync(assetUrl);
        }
        if(characterAssetDisposed)return;
        const source=asset?.scene?.getObjectByName("ExplorerCharacter");
        if(!source)throw Error("ExplorerCharacter node missing");
        const candidate=window.ThirstExplorer&&!options.characterLoaderFactory?source:source.clone(true);
        const joints={};
        for(const name of rigJointNames){
          const part=candidate.getObjectByName(name);
          if(!part)throw Error("Missing character rig joint: "+name);
          joints[name]=part;
        }
        let triangleMeshes=0;
        candidate.traverse(part=>{
          if(part.isMesh){part.castShadow=true;part.receiveShadow=true;triangleMeshes++;}
        });
        if(triangleMeshes<6)throw Error("Character asset has insufficient geometry");
        characterModel=candidate;
        explorer.add(candidate);
        characterRig={
          body:joints.ExplorerBody,head:joints.ExplorerHead,eyes:joints.ExplorerEyes,
          scarf:joints.ExplorerScarfTail,flap:joints.ExplorerPackFlap,
          arms:[joints.ExplorerArmLeft,joints.ExplorerArmRight],
          elbows:[joints.ExplorerElbowLeft,joints.ExplorerElbowRight],
          legs:[joints.ExplorerLegLeft,joints.ExplorerLegRight],
          knees:[joints.ExplorerKneeLeft,joints.ExplorerKneeRight]
        };
        body.visible=false;
        characterAssetState.loaded=1;
        characterAssetState.status="ready";
        if(typeof console!=="undefined"&&typeof console.info==="function")
          console.info("Thirst Trail: loaded original animated explorer model.");
      }catch(error){
        characterAssetState.status="fallback";
        if(typeof console!=="undefined"&&typeof console.warn==="function")
          console.warn("Thirst Trail: keeping procedural explorer (3D asset unavailable)",error);
      }
    }
    void loadExplorerModel();
    // Keep clouds distant and above the horizon. Placing volumetric clouds near
    // the follow camera used to obscure half of the playable valley.
    const cloudMat=new THREE.MeshBasicMaterial({
      color:0xfaf8ef,transparent:true,opacity:.39,depthWrite:false,fog:true
    });
    const clouds=[];
    for(let i=0;i<7;i++){
      const g=new THREE.Group();
      g.position.set((rng()-.5)*46,12+rng()*3,-19-rng()*7);
      for(let j=0;j<4;j++){
        ball(g,cloudMat,(j-1.5)*1.08,Math.sin(j)*.13,0,
          .75+rng()*.24,.26+rng()*.12,.53,false);
      }
      scene.add(g);clouds.push(g);
    }
    // Visible celestial discs and broad halo rings lend the world a strong,
    // illustrated sky identity without a bloom/post-processing dependency.
    const solarGlow=new THREE.MeshBasicMaterial({
      color:0xffe4a0,transparent:true,opacity:.17,
      depthWrite:false,side:THREE.DoubleSide,fog:false
    });
    const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(2.1,20,12),
      new THREE.MeshBasicMaterial({color:0xffedb0,fog:false}));
    sunDisc.position.set(-21,30,-42);scene.add(sunDisc);
    const haloOuter=mesh(new THREE.RingGeometry(2.6,4.7,44),
      solarGlow,scene,false);
    haloOuter.position.copy(sunDisc.position);
    const haloInner=mesh(new THREE.RingGeometry(2.2,2.46,44),
      new THREE.MeshBasicMaterial({
        color:0xfff3b4,transparent:true,opacity:.23,
        depthWrite:false,side:THREE.DoubleSide,fog:false
      }),scene,false);
    haloInner.position.copy(sunDisc.position);
    const moonDisc=mesh(new THREE.SphereGeometry(1.25,14,10),
      new THREE.MeshBasicMaterial({color:0xd8f4ef,fog:false}),scene,false);
    moonDisc.position.set(19,33,-43);moonDisc.visible=false;
    const moonHalo=mesh(new THREE.RingGeometry(1.7,3.5,40),
      new THREE.MeshBasicMaterial({
        color:0xb3eaf2,transparent:true,opacity:.19,
        depthWrite:false,side:THREE.DoubleSide,fog:false
      }),scene,false);
    moonHalo.position.copy(moonDisc.position);moonHalo.visible=false;
    // A few dusk fireflies and distant stars use inexpensive unlit geometry.
    const fireflyMat=new THREE.MeshBasicMaterial({color:0xffeaa0,transparent:true,opacity:.75,depthWrite:false});
    const fireflyGeo=new THREE.SphereGeometry(.065,6,5);
    const fireflies=[];
    for(let i=0;i<20;i++){
      const glow=mesh(fireflyGeo,fireflyMat,scene,false);
      const x=(rng()-.5)*39,z=(rng()-.5)*23;
      glow.position.set(x,.8+rng()*.9,z);
      glow.visible=false;
      fireflies.push({glow,baseX:x,baseZ:z,phase:i*2.34});
    }
    const stars=[];
    const starGeo=new THREE.SphereGeometry(.125,5,4);
    const starMat=new THREE.MeshBasicMaterial({color:0xffffdc,transparent:true,opacity:.7,depthWrite:false,fog:false});
    for(let i=0;i<45;i++){
      const star=mesh(starGeo,starMat,scene,false);
      star.position.set((rng()-.5)*90,31+rng()*24,-20-rng()*30);
      star.scale.setScalar(.45+rng());
      star.visible=false;stars.push(star);
    }
    const characterVisibility=window.ThirstExplorer?.visibility(THREE,scene,explorer);
    const camTarget=new THREE.Vector3(),camPos=new THREE.Vector3();
    const freeTarget=new THREE.Vector3();
    let freeCamera=false;
    let cameraYaw=Math.atan2(10.2,20);
    let cameraPitch=Math.atan2(16.3,Math.hypot(10.2,20));
    let cameraGesture=null;
    let suppressNextClick=false;
    const cameraUp=new THREE.Vector3(0,1,0);
    const cameraForward=new THREE.Vector3();
    const cameraRight=new THREE.Vector3();
    const cameraDistanceForWorld=29;
    function beginFreeCamera(){
      if(freeCamera)return;
      freeCamera=true;
      freeTarget.copy(explorer.position);
      freeTarget.y+=.8;
      const offset=camera.position.clone().sub(freeTarget);
      const horizontal=Math.max(.001,Math.hypot(offset.x,offset.z));
      cameraYaw=Math.atan2(offset.x,offset.z);
      cameraPitch=Math.atan2(offset.y,horizontal);
    }
    function recenterCamera(){
      freeCamera=false;
      cameraGesture=null;
      freeTarget.copy(explorer.position);
      freeTarget.y+=.8;
      cameraYaw=Math.atan2(10.2,20);
      cameraPitch=Math.atan2(16.3,Math.hypot(10.2,20));
      cameraDistanceTarget=.82;
      firstFrame=true;
    }
    function clampFreeTarget(){
      freeTarget.x=Math.max(-20,Math.min(20,freeTarget.x));
      freeTarget.z=Math.max(-13,Math.min(13,freeTarget.z));
    }
    // Gentle camera zoom without changing the existing keyboard movement controls.
    let cameraDistance=.82;
    let cameraDistanceTarget=.82;
    let lastCameraFrame=0;
    view.addEventListener("wheel",event=>{
      if(!view.isConnected || view.parentElement===hero)return;
      event.preventDefault();
      beginFreeCamera();
      cameraDistanceTarget=Math.max(.62,Math.min(1.65,cameraDistanceTarget+event.deltaY*.0009));
    },{passive:false});
    const raycaster=new THREE.Raycaster();
    const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const pointer=new THREE.Vector2(),hit=new THREE.Vector3();
    function selectWorldPosition(event){
      // The previous exploreDrag state belonged to the removed camera controller.
      // Current gestures are handled by cameraGesture and finishCameraGesture.
      // This function is called only for a completed short left click.
      if(typeof options.onSelect!=="function")return;
      const rect=view.getBoundingClientRect();
      pointer.x=(event.clientX-rect.left)/rect.width*2-1;
      pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
      raycaster.setFromCamera(pointer,camera);
      if(!raycaster.ray.intersectPlane(groundPlane,hit))return;
      const x=Math.max(45,Math.min(WORLD_W-45,hit.x*SCALE+900));
      const y=Math.max(45,Math.min(WORLD_H-45,hit.z*SCALE+550));
      options.onSelect(x,y);
      view.focus({preventScroll:true});
    }
    view.addEventListener("pointerdown",event=>{
      if(event.button!==0&&event.button!==2)return;
      if(!view.isConnected || view.parentElement===hero)return;
      event.preventDefault();
      view.setPointerCapture?.(event.pointerId);
      cameraGesture={
        button:event.button,startX:event.clientX,startY:event.clientY,
        lastX:event.clientX,lastY:event.clientY,dragged:false,pointerId:event.pointerId
      };
    });
    view.addEventListener("pointermove",event=>{
      const gesture=cameraGesture;
      if(!gesture||event.pointerId!==gesture.pointerId)return;
      const dx=event.clientX-gesture.lastX,dy=event.clientY-gesture.lastY;
      const totalX=event.clientX-gesture.startX,totalY=event.clientY-gesture.startY;
      gesture.lastX=event.clientX;gesture.lastY=event.clientY;
      if(!gesture.dragged&&Math.hypot(totalX,totalY)>5){
        gesture.dragged=true;
        beginFreeCamera();
      }
      if(!gesture.dragged)return;
      event.preventDefault();
      if(gesture.button===2){
          cameraYaw-=dx*.008*cameraSensitivity;
          cameraPitch=Math.max(.22,Math.min(1.18,cameraPitch+dy*.006*cameraSensitivity));
        return;
      }
      camera.getWorldDirection(cameraForward);
      cameraForward.y=0;cameraForward.normalize();
      cameraRight.crossVectors(cameraForward,cameraUp).normalize();
      const scale=(cameraDistanceForWorld*cameraDistance*cameraSensitivity)/Math.max(240,view.clientHeight);
      freeTarget.addScaledVector(cameraRight,-dx*scale);
      freeTarget.addScaledVector(cameraForward,dy*scale);
      clampFreeTarget();
    });
    function finishCameraGesture(event){
      const gesture=cameraGesture;
      if(!gesture)return;
      cameraGesture=null;
      view.releasePointerCapture?.(event.pointerId);
      if(gesture.dragged){
        suppressNextClick=true;
        event.preventDefault();
      }else if(gesture.button===0){
        selectWorldPosition(event);
      }
    }
    view.addEventListener("pointerup",finishCameraGesture);
    view.addEventListener("pointercancel",event=>{cameraGesture=null;view.releasePointerCapture?.(event.pointerId);});
    view.addEventListener("contextmenu",event=>event.preventDefault());
    view.addEventListener("click",event=>{
      if(suppressNextClick){suppressNextClick=false;event.preventDefault();}
    });
    const reduceMotion=typeof window.matchMedia==="function"
      &&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastParent=null,lastWidth=0,lastHeight=0,firstFrame=true;
    function render(state,time){
      const playing=state.screen!=="start";
      const parent=playing?host:hero;
      if(!parent || !parent.isConnected)return;
      if(parent!==lastParent){
        if(lastParent===hero)hero.classList.remove("is-3d");
        if(parent===hero){
          hero.insertBefore(view,hero.firstChild);
          hero.classList.add("is-3d");
          view.style.position="absolute";view.style.inset="0";
          view.style.width="100%";view.style.height="100%";
        } else {
          originalCanvas.style.display="none";
          originalCanvas.parentElement.insertBefore(view,originalCanvas);
          view.style.position="relative";view.style.inset="";
          view.style.width="100%";view.style.height="auto";
          view.style.aspectRatio="1000 / 610";
        }
        lastParent=parent;lastWidth=0;lastHeight=0;
      }
      const rect=parent===hero?hero.getBoundingClientRect():host.getBoundingClientRect();
      const width=Math.max(200,Math.floor(rect.width||1000));
      const height=parent===hero?Math.max(240,Math.floor(rect.height||550)):Math.max(100,Math.floor(width*.61));
      if(lastWidth!==width||lastHeight!==height){
        renderer.setSize(width,height,false);
        camera.aspect=width/height;camera.updateProjectionMatrix();
        lastWidth=width;lastHeight=height;
      }
      // Lighting is based on expedition time, never on frame rate.
      const cycle=timeOfDay(state.elapsed||0), night=cycle.evening;
      if(flowTexture)flowTexture.offset.y=reduceMotion?0:-(time*.019%1);
      const golden=Math.pow(Math.max(0,1-Math.abs(night*2-1)),1.35);
      // Intentional cinematic grading: blue atmospheric distance, golden sun,
      // and deeper under-canopy shade. Preserve enough light for nighttime play.
      skyColor.copy(night>.48?skyNight:skyDay).lerp(skyGolden,golden*.72);
      scene.background.copy(skyColor);
      scene.fog.color.copy(scene.background);
      ambient.intensity=1.04+.28*(1-night)+.08*golden;
      sun.intensity=.72+2.18*(1-night)+.22*golden;
      sunColor.copy(night>.62?sunNight:sunDay).lerp(sunGolden,golden);
      sun.color.copy(sunColor);
      fill.intensity=.34+.20*night+.12*golden;
      rim.intensity=.20+.22*(1-night)+.10*golden;
      renderer.toneMappingExposure=1.02+.10*(1-night)+.04*golden;
      for(const light of lanternLights)light.intensity=night*2.6;
      warmWindow.emissiveIntensity=.22+night*.42+golden*.12;
      const darkSky=night>.55;
      const solarVisible=night<.80;
      sunDisc.visible=solarVisible;
      haloOuter.visible=solarVisible;haloInner.visible=solarVisible;
      sunDisc.position.y=30-night*9;
      haloOuter.position.y=sunDisc.position.y;
      haloInner.position.y=sunDisc.position.y;
      solarGlow.opacity=.19*(1-night*.75);
      moonDisc.visible=darkSky;moonHalo.visible=darkSky;
      // Halos face the follow camera as sky art rather than flat world signage.
      haloOuter.quaternion.copy(camera.quaternion);
      haloInner.quaternion.copy(camera.quaternion);
      moonHalo.quaternion.copy(camera.quaternion);
      for(let i=0;i<stars.length;i++)stars[i].visible=darkSky;
      for(const firefly of fireflies){
        firefly.glow.visible=effectsEnabled&&night>.4;
        if(firefly.glow.visible&&!reduceMotion){
          firefly.glow.position.set(
            firefly.baseX+Math.sin(time*.73+firefly.phase)*.34,
            1.05+Math.sin(time*1.3+firefly.phase)*.38,
            firefly.baseZ+Math.cos(time*.53+firefly.phase)*.28);
        }
      }
      const playerX=wx(state.x),playerZ=wz(state.y);
      const actualDistance=Number.isFinite(explorer.userData.lastX)?Math.hypot(playerX-explorer.userData.lastX,playerZ-explorer.userData.lastZ):0;
      const crossing=state.y>530&&state.y<635&&state.x>735&&state.x<967;
      const playerY=crossing?.58:terrainElevation(playerX,playerZ);
      explorer.position.set(playerX,playerY,playerZ);
      const isMoving=!!state.moving&&state.screen==="playing";
      const effect=state.effect;
      const effectAge=effect?Math.max(0,time-effect.at):99;
      const celebrating=effect&&effectAge<1.5;
      const frameDelta=characterMotion.lastTime?Math.min(.05,Math.max(0,time-characterMotion.lastTime)):.016;
      characterMotion.lastTime=time;
      const smooth=(current,target,rate)=>current+(target-current)*(1-Math.exp(-rate*frameDelta));
      const running=!!state.keys?.has("shift");
      characterMotion.locomotion=smooth(characterMotion.locomotion,isMoving?1:0,11);
      characterMotion.running=smooth(characterMotion.running,isMoving&&running?1:0,8);
      characterMotion.greeting=smooth(characterMotion.greeting,!isMoving&&state.nearby&&state.screen==="playing"?1:0,9);
      characterMotion.celebration=smooth(characterMotion.celebration,celebrating?1:0,10);
      characterMotion.phase+=frameDelta*(1.7+characterMotion.locomotion*(9.5+characterMotion.running*4.5));
      const stride=Math.sin(characterMotion.phase)*characterMotion.locomotion*(.52+characterMotion.running*.12);
      const strideOpp=Math.sin(characterMotion.phase+Math.PI)*characterMotion.locomotion*(.52+characterMotion.running*.12);
      legs[0].rotation.x=stride;legs[1].rotation.x=strideOpp;
      knees[0].rotation.x=Math.max(0,stride)*-.34;
      knees[1].rotation.x=Math.max(0,strideOpp)*-.34;
      arms[0].rotation.x=-stride*.72;arms[1].rotation.x=-strideOpp*.72;
      elbows[0].rotation.x=Math.max(0,stride)*-.24;
      elbows[1].rotation.x=Math.max(0,strideOpp)*-.24;
      arms[0].rotation.z=0;arms[1].rotation.z=0;
      const celebrationWeight=characterMotion.celebration;
      const greetingWeight=characterMotion.greeting*(1-celebrationWeight);
      arms[0].rotation.z=-2.12*celebrationWeight;
      arms[1].rotation.z=2.12*celebrationWeight+greetingWeight*(reduceMotion?.78:.93+Math.sin(time*4)*.12);
      elbows[0].rotation.x-=.26*celebrationWeight;
      elbows[1].rotation.x-=.26*celebrationWeight;
      body.position.y=reduceMotion?0:(characterMotion.locomotion*Math.abs(Math.sin(characterMotion.phase))*.08+
        celebrationWeight*Math.abs(Math.sin(time*9))*.13+(1-characterMotion.locomotion)*Math.sin(time*1.9)*.027);
      body.rotation.z=reduceMotion?0:characterMotion.locomotion*Math.sin(characterMotion.phase*.5)*.028+
        (1-characterMotion.locomotion)*Math.sin(time*.85)*.011;
      body.rotation.x=reduceMotion?0:-.045*characterMotion.locomotion+(1-characterMotion.locomotion)*Math.sin(time*1.5)*.012;
      scarfTail.rotation.z=-.25+(reduceMotion?0:characterMotion.locomotion*Math.sin(characterMotion.phase)*.15+
        (1-characterMotion.locomotion)*Math.sin(time*1.5)*.03);
      // Mirror gameplay animation onto independently authored glTF joints.
      // Locomotion, greeting and the victory pose still share one state source.
      if(characterRig){
        const rig=characterRig;
        rig.body.position.y=body.position.y;
        rig.body.rotation.copy(body.rotation);
        for(let i=0;i<2;i++){
          rig.arms[i].rotation.copy(arms[i].rotation);
          rig.elbows[i].rotation.copy(elbows[i].rotation);
          rig.legs[i].rotation.copy(legs[i].rotation);
          rig.knees[i].rotation.copy(knees[i].rotation);
        }
        rig.scarf.rotation.z=scarfTail.rotation.z;
        rig.flap.rotation.x=reduceMotion?0:-.08*characterMotion.locomotion+
          (characterMotion.locomotion?Math.sin(characterMotion.phase)*.06:Math.sin(time*1.8)*.024);
        rig.head.rotation.y=reduceMotion?0:Math.sin(time*.58)*.065;
        rig.head.rotation.x=celebrating?-.12:(reduceMotion?0:Math.sin(time*1.4)*.025);
        // Short natural blink: visible only near the explorer, with no timers.
        const blinkTime=time%5.3;
        rig.eyes.scale.y=reduceMotion?1:(blinkTime<.13?.15:1);
      }
      if(isMoving){
        const dx=playerX-explorer.userData.lastX, dz=playerZ-explorer.userData.lastZ;
        if(Number.isFinite(dx)&&Number.isFinite(dz)&&Math.hypot(dx,dz)>.003){
          const heading=Math.atan2(dx,dz);
          let diff=((heading-explorer.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
          explorer.rotation.y+=diff*(1-Math.exp(-10*frameDelta));
        }
      }
      if(characterModel?.userData.adventure)window.ThirstExplorer.animate(characterModel,{
        time,dt:frameDelta,distance:isMoving?actualDistance/1.19:0,running,
        interaction:!!state.modalOpen||!!state.nearby,victory:celebrating||(state.screen==="ended"&&state.effect?.kind==="victory"),reduced:reduceMotion
      });
      explorer.userData.lastX=playerX;explorer.userData.lastZ=playerZ;
      if(!reduceMotion&&effectsEnabled){
        // Time-based displacement stays consistent across refresh rates.
        for(let i=0;i<ripples.length;i++){
          const wave=ripples[i];
          const z=((wave.userData.startZ+15.2+time*1.6)%30.4)-15.2;
          wave.position.z=z;
          wave.position.x=wx(riverCenter(z*SCALE+550))+Math.sin(i*32)*.21;
        }
        for(const shine of glints){
          const z=shine.baseZ+Math.sin(time*.85+shine.phase)*.75;
          shine.mesh.position.z=z;
          shine.mesh.position.x=wx(riverCenter(z*SCALE+550))+shine.offset;
          shine.mesh.scale.y=.65+Math.abs(Math.sin(time*1.6+shine.phase))*.9;
        }
        for(const {edge,side} of waterEdges){
          edge.position.y=Math.sin(time*1.7+side)*.012;
          edge.material.opacity=.13+Math.abs(Math.sin(time*1.25+side))*.08;
        }
        for(const item of butterflies){
          const t=time*1.25+item.phase;
          item.group.position.set(item.x+Math.sin(t)*.75,.76+Math.sin(t*2.3)*.28,item.z+Math.cos(t)*.62);
          item.group.rotation.y=t+.4;
          for(const pivot of item.group.children){
            if(pivot.userData.side)pivot.rotation.y=pivot.userData.side*Math.sin(time*15+item.phase)*.95;
          }
        }
      }
      if(!reduceMotion)for(const smoke of chimneySmokes){
        const t=(time*.21+smoke.phase)%1;
        smoke.puff.position.set(Math.sin(time*.45+smoke.phase)*t*.24,t*1.25,.02);
        smoke.puff.scale.set(.35+t*.52,.44+t*.70,1);
        smoke.puff.material.opacity=.16*(1-t)*(.6+.4*Math.sin(t*Math.PI));
      }
      if(!reduceMotion)for(let i=0;i<clouds.length;i++){
        clouds[i].position.x+=.0014;
        if(clouds[i].position.x>28)clouds[i].position.x=-28;
      }
      // Lay out trail lights along the actual auto-walk route, never through
      // the blocked riverbank. A route with no waypoints displays no lights.
      const route=state.screen==="playing"?state.path||[]:[];
      const routeSegments=[];
      let last={x:state.x,y:state.y},routeDistance=0;
      for(const waypoint of route){
        const length=Math.hypot(waypoint.x-last.x,waypoint.y-last.y);
        if(length>0.01){routeSegments.push({from:last,to:waypoint,start:routeDistance,length});routeDistance+=length;}
        last=waypoint;
      }
      for(let i=0;i<trailBeacons.length;i++){
        const light=trailBeacons[i],at=75+i*57;
        light.visible=routeDistance>at;
        if(!light.visible)continue;
        const segment=routeSegments.find(segment=>segment.start+segment.length>=at);
        if(!segment){light.visible=false;continue;}
        const t=(at-segment.start)/segment.length;
        light.position.set(
          wx(segment.from.x+(segment.to.x-segment.from.x)*t),
          .30+(reduceMotion?0:Math.sin(time*3+i*.75)*.07),
          wz(segment.from.y+(segment.to.y-segment.from.y)*t)
        );
        if(!reduceMotion)light.rotation.y=time*.8+i*.35;
      }
      if(!reduceMotion){
        for(const tree of windTrees){
          tree.group.rotation.z=Math.sin(time*.9+tree.phase)*.011;
          tree.group.rotation.x=Math.cos(time*.67+tree.phase)*.009;
        }
        for(const bird of birds){
          const t=time*.23+bird.phase;
          bird.group.position.set(bird.originX+Math.sin(t)*1.9,10.5+Math.cos(t*1.9)*.38,
            bird.originZ+Math.cos(t*.8)*1.2);
          bird.group.rotation.y=-t+.7;
          for(const wing of bird.wings){
            wing.pivot.rotation.z=wing.side*(Math.sin(time*6+bird.phase)*.36);
          }
        }
      }else for(const bird of birds)bird.group.visible=effectsEnabled;
      for(let i=0;i<supplyModels.length;i++){
        const entry=supplyModels[i];
        entry.g.visible=!state.supplies?.has(entry.id);
        if(entry.g.visible&&!reduceMotion){
          entry.bottle.position.y=.84+Math.sin(time*2.4+i)*.055;
          entry.halo.rotation.z=time*.32+i;
        }
      }
      for(const [key,m] of Object.entries(markers)){
        const done=(state.done&&state.done.has(key))||(key==="river"&&state.inventory&&state.inventory.has("testKit"));
        m.mat.color.setHex(done?0x69edaa:(key==="camp"?0x8af9bf:(key==="river"||key==="spring"?0x75edff:0xffd45b)));
        m.ring.scale.setScalar(1+Math.sin(time*3+spots.findIndex(s=>s[0]===key))*.08);
        m.dot.position.y=1.73+Math.sin(time*2.2)*.17;
        m.beacon.visible=!done;
      }
      // Trigger a burst only while an earned achievement is recent.
      const effectLength=effect?.kind==="victory"?5.3:2.8;
      const activeEffect=!!effect&&effectAge<effectLength;
      achievementGroup.visible=activeEffect;
      if(activeEffect){
        const spot=spots.find(p=>p[0]===effect.key);
        const centerX=spot?wx(spot[1]):playerX, centerZ=spot?wz(spot[2]):playerZ;
        achievementGroup.position.set(centerX,.18,centerZ);
        const progress=effectAge/effectLength;
        const spread=effect.kind==="victory"?3.15:1.95;
        for(let i=0;i<sparkles.length;i++){
          const gem=sparkles[i];
          const angle=i*2.39996323;
          const tier=.42+(i%7)/8;
          gem.visible=!reduceMotion||i<12;
          const radius=reduceMotion?.8*tier:tier*spread*(.32+progress*.85);
          const rise=reduceMotion?.95:.45+Math.sin(progress*Math.PI)*(1.2+(i%5)*.24);
          gem.position.set(Math.cos(angle)*radius,rise+(reduceMotion?0:Math.sin(angle*3+time)*.12),
            Math.sin(angle)*radius);
          const size=reduceMotion?.65:(.55+.5*Math.sin(progress*Math.PI))*(1-progress*.6);
          gem.scale.setScalar(size);
          if(!reduceMotion)gem.rotation.set(time*1.2+i*.2,time*1.9+i*.4,0);
        }
        for(let i=0;i<achievementRings.length;i++){
          const ring=achievementRings[i];
          const t=Math.max(0,Math.min(1,progress*1.65-i*.17));
          ring.visible=reduceMotion?i===0:(t>0&&t<1);
          ring.scale.setScalar(reduceMotion?1.45:.48+t*(effect.kind==="victory"?3.3:2.2));
          ring.material.opacity=reduceMotion?.34:(1-t)*.48;
        }
        achievementLight.intensity=reduceMotion?0:Math.sin(progress*Math.PI)*8;
      }else{
        achievementLight.intensity=0;
      }
      for(let i=0;i<villagers.length;i++){
        const resident=villagers[i];
        const nearby=Math.hypot(state.x-(i?472:245),state.y-(i?825:515))<135;
        const communityVictory=state.screen==="ended"&&state.done?.has("pump");
        resident.waveArm.rotation.z=communityVictory
          ?(reduceMotion?-.75:-.8+Math.sin(time*6+i)*.4)
          :(nearby?(reduceMotion?-.45:-.6+Math.sin(time*5)*.3):.05);
        resident.g.position.y=reduceMotion?0:(communityVictory
          ?Math.abs(Math.sin(time*4.5+i))*.14
          :Math.sin(time*1.3+i)*.027);
      }
      // Waterwheel and raincatch station respond to the valley wind.
      if(!reduceMotion&&effectsEnabled){
        rainVane.rotation.y=Math.sin(time*.35)*1.1;
        for(let i=0;i<stationDroplets.length;i++){
          const drop=stationDroplets[i],p=(i/10+time*.27)%1;
          drop.position.set(1.45+p*.65,2.07-p*.66,.61);
          drop.scale.y=.75+(1-p)*.55;
        }
      }
      if(!reduceMotion&&effectsEnabled){
        for(let i=0;i<cascadeStrips.length;i++){
          const strip=cascadeStrips[i];
          strip.scale.y=.96+Math.sin(time*5+i*1.7)*.06;
          strip.position.y=1.27+(i%3)*.045+Math.sin(time*3.1+i)*.04;
        }
        for(let i=0;i<mistParticles.length;i++){
          const m=mistParticles[i],p=(time*.63+i/mistParticles.length)%1;
          const angle=i*2.39996;
          m.position.set(Math.cos(angle)*(.17+p*.87),.20+p*.65,
            .23+Math.sin(angle)*(.12+p*.57));
          m.scale.setScalar((.5+(1-p)*.85)*(.7+i%4*.14));
        }
        sprayRing.scale.setScalar(.94+Math.sin(time*2.4)*.12);
      }
      if(!reduceMotion&&effectsEnabled)waterwheel.rotation.z=-time*(state.done?.has("pump")?0.63:0.28);
      const restored=!!state.done?.has("pump");
      pumpFlow.visible=restored;
      if(restored){
        for(let i=0;i<flowDroplets.length;i++){
          const p=(i/flowDroplets.length+(reduceMotion?0:time*.43))%1;
          const droplet=flowDroplets[i];
          droplet.position.set(.02,2.2-p*1.65,1.14+p*.28);
          droplet.scale.set(.69+(1-p)*.23,.78+(1-p)*.55,.72);
        }
      }
      if(!reduceMotion)heron.rotation.y=Math.sin(time*.55)*.18;
      if(!reduceMotion)for(let i=0;i<springRings.length;i++){
        const f=(time*.22+i/3)%1;
        springRings[i].scale.setScalar(.6+f*.8);
        springRings[i].material.opacity=.34*(1-f);
      }
      fire.scale.y=reduceMotion?1:.84+Math.sin(time*13)*.15;
      fireLight.intensity=effectsEnabled?(2.4+night*8.6+(reduceMotion?0:Math.sin(time*9)*1.2)):1.2;
      // Keep camera interpolation timing independent of the character animation clock.
      const cameraFrameDelta=lastCameraFrame?Math.min(.05,Math.max(0,time-lastCameraFrame)):.016;
      lastCameraFrame=time;
      cameraDistance+=(cameraDistanceTarget-cameraDistance)*(1-Math.exp(-10*cameraFrameDelta));
      // If the player starts walking after exploring, restore visible follow mode.
      // Free camera is still available whenever the player is stationary and dragging.
      if(playing&&freeCamera&&state.moving&&!cameraGesture?.dragged)recenterCamera();
      let aim;
      if(playing){
        // Scenic overview deliberately frames the whole explorable island;
        // the normal mode still follows the player for precise movement.
        if(state.scenic){
          aim=new THREE.Vector3(-.8,.5,-.1);
          camPos.copy(aim).add(new THREE.Vector3(13,30,37));
        }else if(freeCamera){
          aim=freeTarget;
          const horizontal=Math.cos(cameraPitch)*cameraDistanceForWorld*cameraDistance;
          camPos.copy(aim).add(new THREE.Vector3(
            Math.sin(cameraYaw)*horizontal,
            Math.sin(cameraPitch)*cameraDistanceForWorld*cameraDistance,
            Math.cos(cameraYaw)*horizontal
          ));
        }else{
          aim=new THREE.Vector3(playerX,playerY+.8,playerZ);
          // After victory, briefly reveal more of the restored valley.
          const finaleZoom=effect?.kind==="victory"&&effectAge<4.5&&!reduceMotion?1.17:1;
          camPos.copy(aim).add(new THREE.Vector3(10.2,16.3,20).multiplyScalar(cameraDistance*finaleZoom));
        }
      } else {
        // A nearly imperceptible flyover keeps the 3D title screen alive.
        const drift=reduceMotion?0:Math.sin(time*.115);
        aim=new THREE.Vector3(-4+drift*2.0,0,-1+Math.cos(time*.09)*.6);
        camPos.copy(aim).add(new THREE.Vector3(
          16+drift*2.4,22+Math.sin(time*.08)*.8,27+Math.cos(time*.105)*2.0));
      }
      if(!state.scenic){
        const floor=terrainElevation(camPos.x,camPos.z)+1.15;
        if(camPos.y<floor)camPos.y=floor;
      }
      if(firstFrame){
        camera.position.copy(camPos);camTarget.copy(aim);firstFrame=false;
      }else{
        camera.position.lerp(camPos,.055);
        camTarget.lerp(aim,.075);
      }
      camera.lookAt(camTarget);
      characterVisibility?.update(camera,frameDelta);
      renderer.render(scene,camera);
    }
    return {
      render,
      focus(){view.focus({preventScroll:true});},
      dispose(){
        villageAssetDisposed=true;
        characterVisibility?.dispose();
        characterAssetDisposed=true;
        if(characterModel){
          const seenGeo=new Set(),seenMat=new Set();
          characterModel.traverse(node=>{
            if(!node.isMesh)return;
            if(node.geometry&&!seenGeo.has(node.geometry)){
              seenGeo.add(node.geometry);node.geometry.dispose();
            }
            for(const material of (Array.isArray(node.material)?node.material:[node.material])){
              if(material&&!seenMat.has(material)){
                seenMat.add(material);material.dispose();
              }
            };
          });
        }
        // Geometry is shared by cloned models; clean up only once per pack.
        const seenGeometries=new Set(),seenMaterials=new Set();
        for(const root of upgradedVillageObjects)root.traverse(object=>{
          if(!object.isMesh)return;
          if(object.geometry && !seenGeometries.has(object.geometry)){
            seenGeometries.add(object.geometry);object.geometry.dispose();
          }
          const materials=Array.isArray(object.material)?object.material:[object.material];
          for(const mat of materials)if(mat&&!seenMaterials.has(mat)){
            seenMaterials.add(mat);mat.dispose();
          }
        });
        renderer.dispose();view.remove();
        hero?.classList.remove("is-3d");originalCanvas.style.display="";
      },
      recenter(){recenterCamera();},
      recenterCamera(){recenterCamera();},
      setGraphicsSettings(next){applyGraphicsSettings(next);},
      getCanvas(){return view;},
      recenterCamera,
      getAssetStatus(){return {...villageAssetState};},
      getCharacterAssetStatus(){return {...characterAssetState};}
    };
  }
  
})();
