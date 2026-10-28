"use strict";
/* Stormbreak Coast — the third playable Thirst Trail expedition. */
(() => {
  const FONT_FAMILY = window.TrailTypography?.family || "sans-serif";
  const $=id=>document.getElementById(id),screen=$("coastScreen");
  if(!screen)return;
  screen.innerHTML=`
    <header class="coast-header"><div><span class="overline">CHAPTER 03 · AFTER THE STORM</span><h2>Stormbreak Coast<span class="yellow">.</span></h2><p id="coastObjective">Meet engineer Mara at the harbor.</p></div><div class="coast-header-actions"><span id="coastMode"></span><button id="coastPause" type="button">Ⅱ Pause</button><button id="coastHome" type="button">◈ Chapters</button></div></header>
    <div class="coast-layout"><div class="coast-stage"><div class="coast-stage-label"><span>◈ STORMBREAK HARBOR</span><button id="coastRecenter" type="button">⌖ Recenter</button></div><canvas id="coastCanvas" width="1000" height="610" tabindex="0" role="img" aria-label="Stormbreak Coast. Walk with WASD or arrows, interact with E, or choose a destination."></canvas><div class="coast-hud"><span id="coastEnergy"></span><span id="coastScore"></span><span id="coastTime"></span></div><div id="coastPrompt" class="coast-prompt" hidden><span id="coastPromptText"></span><button id="coastInteract" type="button">E · INTERACT</button></div><p id="coastToast" class="coast-toast" role="status" aria-live="polite" hidden></p><div class="coast-touch" aria-label="Coast movement"><button data-coast-key="w" type="button" aria-label="Move up">↑</button><button data-coast-key="a" type="button" aria-label="Move left">←</button><button data-coast-key="s" type="button" aria-label="Move down">↓</button><button data-coast-key="d" type="button" aria-label="Move right">→</button><button id="coastTouchAct" type="button">✦ ACT</button></div><div id="coastCelebration" class="coast-celebration" hidden><div><span>✦ STORMBREAK RESTORED</span><strong>The coast has water again!</strong><small>The harbor crew is celebrating your work.</small></div><div><button id="coastCheer" type="button">✦ Celebrate with the crew</button><button id="coastResults" type="button">View results</button><button id="coastFinishHome" type="button">Chapters →</button></div></div></div>
    <aside class="coast-sidebar"><span class="overline">HARBOR REPAIR LOG</span><h3>A stronger shore<span class="yellow">.</span></h3><p>Restore the power, balance the cargo bridge, seal the storage tank and open the distribution gates.</p><div class="coast-progress"><i id="coastProgressFill"></i></div><strong id="coastProgressLabel"></strong><div id="coastQuests" class="coast-quests"></div><span class="overline">GO SOMEWHERE</span><div id="coastDestinations" class="coast-destinations"></div><p id="coastSaveStatus" class="coast-save-note">Progress saves in this browser.</p><p class="coast-controls-note">WASD / arrows · E interact · Shift sprint · P pause · click ground to walk. Rest at the harbor shelter whenever you need energy.</p><div id="coastBonus" class="coast-bonus" hidden></div></aside></div>
    <div id="coastModalBackdrop" class="coast-modal-backdrop" hidden><section id="coastModal" class="coast-modal" role="dialog" aria-modal="true" aria-labelledby="coastModalTitle" aria-describedby="coastModalText" tabindex="-1"><span id="coastModalTag" class="coast-modal-tag"></span><h2 id="coastModalTitle"></h2><p id="coastModalText"></p><div id="coastModalExtra"></div><div id="coastModalOptions" class="coast-modal-options"></div></section></div>`;
  const canvas=$("coastCanvas"),ctx=canvas.getContext("2d"),progress=window.TrailProgress;
  const W=1000,H=610,wx=x=>(x-500)/24,wz=y=>(y-305)/24;
  const goals={
    mara:{x:165,y:370,title:"Meet engineer Mara",icon:"🧭",detail:"Hear the harbor’s recovery plan"},
    power:{x:340,y:180,title:"Restore backup power",icon:"⚡",detail:"Complete the switchboard circuit"},
    bridge:{x:520,y:365,title:"Balance the cargo bridge",icon:"⚖️",detail:"Match the counterweight torque"},
    tank:{x:740,y:180,title:"Seal the storm-damaged tank",icon:"🛠️",detail:"Fit three repair layers in order"},
    release:{x:850,y:390,title:"Distribute the water",icon:"💧",detail:"Set the three sluice gates and release"}
  };
  const order=Object.keys(goals),points={mara:90,power:240,bridge:260,tank:280,release:400};
  const approaches={power:{x:340,y:244},bridge:{x:441,y:365},tank:{x:740,y:245},release:{x:850,y:450}};
  const shelter={x:210,y:490,title:"Harbor rest shelter"};
  const caches=[{id:"beach",x:265,y:515},{id:"pier",x:650,y:490},{id:"lighthouse",x:885,y:125}];
  const blank=()=>({active:false,paused:false,finished:false,modal:false,modalVersion:0,x:150,y:430,energy:100,score:0,elapsed:0,done:new Set(),keys:new Set(),path:[],power:[false,false,false,false],weights:[0,0,0],gates:[0,0,0],tankStep:0,powerFailures:new Set(),bridgeFailures:new Set(),gateFailures:new Set(),bonus:new Set(),waterAt:0,cheerAt:-100,lastSave:0,lastUI:0,toastUntil:0});
  let state=blank(),world=null,creating=false,raf=0,lastFrame=0,refreshDifficulty=null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const mode=()=>window.TrailMode?.profile?.()||{id:"normal",label:"Normal",difficulty:"normal",energyMultiplier:1,mistakeMultiplier:1,hints:false,bonusObjectives:false};
  const reduced=()=>!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const tone=(note=620,duration=.08)=>window.ThirstAudio?.tone(note,duration);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function blocked(x,y){
    if(x<40||x>960||y<90||y>555)return true;
    if(x>470&&x<570&&(!state.done.has("bridge")||y<330||y>410))return true;
    if(Math.hypot(x-340,y-180)<44||Math.hypot(x-740,y-180)<47)return true;
    if(Math.hypot(x-835,y-375)<32)return true;
    return false;
  }
  function safeRestorePosition(){
    if(!blocked(state.x,state.y))return;
    const found=["power","tank"].find(key=>dist(state,goals[key])<85);
    state.x=found?approaches[found].x:150;state.y=found?approaches[found].y:430;
  }
  function toast(message){$("coastToast").textContent=message;$("coastToast").hidden=false;state.toastUntil=performance.now()+3700;}
  function save(){
    if(!state.active||state.finished||!progress)return;
    const stored=progress.save("coast",{x:Math.round(state.x),y:Math.round(state.y),energy:Math.round(state.energy*10)/10,score:state.score,elapsed:Math.round(state.elapsed),done:[...state.done],power:[...state.power],weights:[...state.weights],gates:[...state.gates],tankStep:state.tankStep,powerFailures:[...state.powerFailures],bridgeFailures:[...state.bridgeFailures],gateFailures:[...state.gateFailures],bonus:[...state.bonus]});
    $("coastSaveStatus").textContent=stored?"✓ Coast checkpoint saved in this browser":"Session progress ready · browser storage unavailable";
    state.lastSave=state.elapsed;
  }
  function restore(saved){
    if(!saved||typeof saved!=="object")return;
    const number=(value,fallback)=>typeof value==="number"&&Number.isFinite(value)?value:fallback;
    state.x=clamp(number(saved.x,150),40,960);state.y=clamp(number(saved.y,430),90,555);
    state.energy=clamp(number(saved.energy,100),5,100);state.score=clamp(Math.floor(number(saved.score,0)),0,10000000);
    state.elapsed=clamp(number(saved.elapsed,0),0,604800);
    state.done=new Set((Array.isArray(saved.done)?saved.done:[]).filter(key=>order.includes(key)));
    const last=Math.max(-1,...[...state.done].map(key=>order.indexOf(key)));
    for(let i=0;i<=last;i++)state.done.add(order[i]);
    if(Array.isArray(saved.power)&&saved.power.length===4)state.power=saved.power.map(value=>value===true);
    for(const [key,max] of [["weights",3],["gates",5]])if(Array.isArray(saved[key])&&saved[key].length===3)
      state[key]=saved[key].map(value=>Number.isInteger(value)?clamp(value,0,max):0);
    state.tankStep=clamp(Math.floor(number(saved.tankStep,0)),0,3);
    for(const key of ["powerFailures","bridgeFailures","gateFailures"])
      state[key]=new Set((Array.isArray(saved[key])?saved[key]:[]).filter(value=>typeof value==="string"&&value.length<30).slice(0,100));
    state.bonus=new Set((Array.isArray(saved.bonus)?saved.bonus:[]).filter(id=>caches.some(cache=>cache.id===id)));
    if(state.done.has("power")&&!powerSafe())state.power=[true,false,true,true];
    if(state.done.has("bridge")&&!bridgeSafe())state.weights=[0,3,2];
    if(state.done.has("bridge")&&state.tankStep===3&&!state.done.has("tank")){
      state.done.add("tank");state.score+=points.tank;
    }
    if(state.done.has("tank"))state.tankStep=3;
    if(state.done.has("release"))state.gates=[3,2,1];
    if(!state.done.has("bridge"))state.tankStep=0;
    if(!state.done.has("tank"))state.gates=[0,0,0];
    safeRestorePosition();
  }
  function spend(amount){state.energy=Math.max(0,Math.min(state.energy,Math.max(5,state.energy-amount*mode().energyMultiplier)));}
  function reward(key){
    if(!state.active||state.finished||state.done.has(key))return false;
    const index=order.indexOf(key);
    if(index<0||order.slice(0,index).some(previous=>!state.done.has(previous)))return false;
    state.done.add(key);state.score+=points[key];tone(780,.12);save();refresh();toast("✓ "+goals[key].title+" · +"+points[key]+" impact");return true;
  }
  function modal(tag,title,description,choices,extra){
    state.modal=true;state.keys.clear();state.path=[];refreshDifficulty=null;
    const owner=state,version=++state.modalVersion;
    $("coastModalTag").textContent=tag;$("coastModalTitle").textContent=title;$("coastModalText").textContent=description;
    $("coastModalExtra").replaceChildren();if(extra)extra($("coastModalExtra"));
    const options=$("coastModalOptions");options.replaceChildren();
    for(const choice of choices){const button=document.createElement("button");button.type="button";button.textContent=choice.text;
      if(choice.primary)button.classList.add("primary");
      button.addEventListener("click",()=>{if(state===owner&&state.modal&&state.modalVersion===version)choice.action();});options.append(button);}
    $("coastModal").classList.toggle("is-victory",state.finished);$("coastModalBackdrop").hidden=false;
    $("coastModal").scrollTop=0;$("coastModal").focus({preventScroll:true});save();refresh();tone(550,.06);
  }
  function close(){state.modal=false;state.modalVersion++;refreshDifficulty=null;$("coastModalBackdrop").hidden=true;refresh();(world?.dom||canvas).focus({preventScroll:true});}
  function easyHint(root,text){
    const note=document.createElement("p");note.className="coast-puzzle-status";note.dataset.coastHint="true";note.textContent="Mara’s field note: "+text;
    root.append(note);refreshDifficulty=()=>{note.hidden=!mode().hints;};refreshDifficulty();
  }
  function pathTo(point,key=null){
    if(!state.active||state.paused||state.modal)return;
    const target=approaches[key]||point;
    if(blocked(target.x,target.y))return toast(!state.done.has("bridge")&&target.x>470?"Balance the cargo bridge before crossing to the tank.":"Choose open harbor ground.");
    const nodes=[{x:state.x,y:state.y},target,{x:442,y:365},{x:600,y:365}];
    for(const [x,y,r] of [[340,180,58],[740,180,62],[835,375,44]])for(let i=0;i<8;i++)nodes.push({x:x+Math.cos(i*Math.PI/4)*r,y:y+Math.sin(i*Math.PI/4)*r});
    const clear=(a,b)=>{
      const count=Math.max(1,Math.ceil(dist(a,b)/4));
      for(let i=1;i<=count;i++)if(blocked(a.x+(b.x-a.x)*i/count,a.y+(b.y-a.y)*i/count))return false;
      return true;
    };
    const distance=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();distance[0]=0;
    for(let count=0;count<nodes.length;count++){
      let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||distance[i]<distance[at]))at=i;
      if(at<0||!Number.isFinite(distance[at]))break;if(at===1)break;visited.add(at);
      for(let i=1;i<nodes.length;i++)if(!visited.has(i)&&clear(nodes[at],nodes[i])){const next=distance[at]+dist(nodes[at],nodes[i]);if(next<distance[i]){distance[i]=next;previous[i]=at;}}
    }
    if(!Number.isFinite(distance[1]))return toast("The storm channel blocks that route. Reach the bridge controls first.");
    const route=[];for(let i=1;i>0;i=previous[i])route.unshift(nodes[i]);state.path=route;toast("Following the harbor trail…");
  }
  function nearest(){
    let found=null,best=88;
    for(const [key,point] of [...Object.entries(goals),["rest",shelter]]){const d=dist(state,point);if(d<best){best=d;found=key;}}
    return found;
  }
  function interact(){
    if(!state.active||state.paused||state.modal)return;
    const key=nearest();state.path=[];
    if(!key)return toast("Walk to a landmark, then press E or tap INTERACT.");
    if(key==="rest"){state.energy=Math.min(100,state.energy+45);save();refresh();tone();return toast("Rested at the harbor shelter · energy restored.");}
    if(key==="mara")return modal("MARA · HARBOR ENGINEER","A stronger shore",
      state.done.has("release")?"The homes, clinic and storage tank have a reliable flow again. The whole harbor is grateful.":"The storm cut power and damaged our only storage tank. Restore the backup circuit, balance the cargo bridge, seal the tank and set the distribution gates. Each repair brings us closer to opening the water.",
      [{text:state.done.has("mara")?"Return to the harbor":"Let’s restore the harbor (+90 impact)",primary:true,action:()=>{close();reward("mara");}},{text:"Keep exploring",action:close}]);
    if(!state.done.has("mara"))return toast("Speak with engineer Mara at the harbor first.");
    if(state.done.has(key))return toast("✓ "+goals[key].title+" is already complete.");
    const index=order.indexOf(key),missing=order.slice(0,index).find(previous=>!state.done.has(previous));
    if(missing)return toast("First: "+goals[missing].title+".");
    if(key==="power")powerPuzzle();else if(key==="bridge")bridgePuzzle();else if(key==="tank")tankPuzzle();else if(key==="release")gatePuzzle();
  }
  function powerOutputs(){const [a,b,c,d]=state.power;return [a!==b,b!==c,c&&d];}
  function powerSafe(){return powerOutputs().every(Boolean);}
  function bridgeTorque(){return state.weights.reduce((sum,weight,i)=>sum+weight*(i+1),0);}
  function bridgeSafe(){return bridgeTorque()===12&&state.weights.filter(Boolean).length>=2;}
  function gatesSafe(){return state.gates.every((value,i)=>value===[3,2,1][i]);}
  function fail(key,stamp,message){
    if(!state[key].has(stamp)){state[key].add(stamp);spend(3*(mode().mistakeMultiplier||1));}
    $("coastModalText").textContent=message;tone(190,.08);save();refresh();
  }
  function powerPuzzle(){
    let paint=()=>{};
    modal("BACKUP STATION · CIRCUIT PUZZLE","Light the harbor switchboard",
      "Make all three service lights glow. Switches A and B must differ for the lighthouse; B and C must differ for the pump. The clinic needs both C and D on.",
      [{text:"⚡ Test the circuit",primary:true,action:()=>{
        if(powerSafe()){close();reward("power");return;}
        fail("powerFailures",state.power.map(Number).join(""),"The circuit is incomplete. Check the three service lights and the wiring rules. Rechecking the same setting has no extra cost.");paint();
      }},{text:"Mara’s circuit hint",action:()=>{$("coastModalText").textContent="Try A on, B off, C on and D on. A/B and B/C differ, while C/D supply the clinic together.";}},{text:"Return to harbor",action:()=>{save();close();}}],root=>{
        const owner=state,version=state.modalVersion;
        const board=document.createElement("div");board.className="coast-circuit";
        const lights=document.createElement("div");lights.className="coast-service-lights";board.append(lights);
        const controls=document.createElement("div");controls.className="coast-switches";board.append(controls);
        const buttons=[];
        for(let i=0;i<4;i++){
          const button=document.createElement("button");button.type="button";button.dataset.coastSwitch=String(i);
          button.addEventListener("click",()=>{if(state!==owner||!state.modal||state.modalVersion!==version)return;state.power[i]=!state.power[i];tone(440,.04);save();paint();});controls.append(button);buttons.push(button);
        }
        paint=()=>{
          lights.replaceChildren();for(const [i,on] of powerOutputs().entries()){const light=document.createElement("span");light.className=on?"on":"";light.textContent=(on?"● ":"○ ")+["Lighthouse","Pump","Clinic"][i];lights.append(light);}
          buttons.forEach((button,i)=>{button.textContent=String.fromCharCode(65+i)+" · "+(state.power[i]?"ON":"OFF");button.setAttribute("aria-pressed",String(state.power[i]));button.classList.toggle("on",state.power[i]);});
        };root.append(board);easyHint(root,"Try A on, B off, C on and D on. A/B and B/C differ, while C/D supply the clinic together.");paint();
      });
  }
  function bridgePuzzle(){
    let paint=()=>{};
    modal("CARGO CROSSING · COUNTERWEIGHT PUZZLE","Balance the bridge",
      "The storm cargo pulls with 12 torque units. Add 0–3 weights at each left-hand distance. Match exactly 12 torque using at least two occupied positions. Weight × distance gives torque.",
      [{text:"⚖️ Test the balance",primary:true,action:()=>{
        if(bridgeSafe()){close();reward("bridge");return;}
        fail("bridgeFailures",state.weights.join(","),"The bridge is still tilted. Target 12 torque, and spread the weights across at least two positions.");paint();
      }},{text:"Mara’s balance hint",action:()=>{$("coastModalText").textContent="One solution: 0 weights at distance 1, 3 at distance 2, and 2 at distance 3. That gives 0 + 6 + 6 = 12 torque.";}},{text:"Return to harbor",action:()=>{save();close();}}],root=>{
        const owner=state,version=state.modalVersion,board=document.createElement("div");board.className="coast-counterweights";
        const beam=document.createElement("div");beam.className="coast-balance-beam";board.append(beam);
        const rows=[];
        for(let i=0;i<3;i++){
          const row=document.createElement("div");row.className="coast-weight-row";
          const label=document.createElement("strong");label.textContent="Distance "+(i+1);
          const value=document.createElement("output"),decrease=document.createElement("button"),increase=document.createElement("button");
          decrease.type=increase.type="button";decrease.textContent="−";increase.textContent="+";
          decrease.dataset.coastWeight=String(i);decrease.dataset.delta="-1";increase.dataset.coastWeight=String(i);increase.dataset.delta="1";
          decrease.setAttribute("aria-label","Remove weight at distance "+(i+1));increase.setAttribute("aria-label","Add weight at distance "+(i+1));
          const adjust=amount=>{if(state!==owner||!state.modal||state.modalVersion!==version)return;state.weights[i]=clamp(state.weights[i]+amount,0,3);save();paint();tone(470,.04);};
          decrease.addEventListener("click",()=>adjust(-1));increase.addEventListener("click",()=>adjust(1));
          row.append(label,decrease,value,increase);board.append(row);rows.push({value,decrease,increase});
        }
        const status=document.createElement("p");status.className="coast-puzzle-status";status.setAttribute("role","status");board.append(status);
        paint=()=>{const torque=bridgeTorque();beam.textContent="YOUR SIDE "+torque+"  ⚖  CARGO 12";beam.style.transform=reduced()?"none":"rotate("+clamp((torque-12)*.55,-7,7)+"deg)";
          rows.forEach((row,i)=>{row.value.textContent=state.weights[i]+" weights · "+state.weights[i]*(i+1)+" torque";row.decrease.disabled=state.weights[i]===0;row.increase.disabled=state.weights[i]===3;});
          status.textContent=bridgeSafe()?"✓ Balanced! Test the balance to lower the bridge.":"Current torque: "+torque+" / 12 · "+state.weights.filter(Boolean).length+" occupied positions";};
        root.append(board);easyHint(root,"Place 0 weights at distance 1, 3 at distance 2, and 2 at distance 3: 0 + 6 + 6 = 12 torque.");paint();
      });
  }
  const repairOrder=["Fit the inner liner","Seat the weather gasket","Tighten the outer clamp"];
  function tankPuzzle(){
    modal("STORAGE REPAIR · THREE LAYERS","Seal the storm-damaged tank",
      "The inner liner supports the seal, the gasket closes the joint, and the clamp holds it in place. Fit the layers from the inside out. Completed work stays saved.",
      [{text:"Return to harbor",action:()=>{save();close();}}],root=>{
        const owner=state,version=state.modalVersion,board=document.createElement("div");board.className="coast-tank-repair";
        const buttons=[];
        for(let i=0;i<3;i++){
          const button=document.createElement("button");button.type="button";button.dataset.coastRepair=String(i);button.textContent=["▧ ","◉ ","⊏ "][i]+repairOrder[i];
          button.addEventListener("click",()=>{
            if(state!==owner||!state.modal||state.modalVersion!==version||state.finished)return;
            if(i!==state.tankStep){$("coastModalText").textContent="Next: "+repairOrder[state.tankStep]+". Work from the inside out.";tone(190,.07);return;}
            state.tankStep++;tone(660,.06);
            if(state.tankStep===3){close();reward("tank");return;}
            save();paint();
          });board.append(button);buttons.push(button);
        }
        const label=document.createElement("p");label.className="coast-puzzle-status";board.append(label);
        const paint=()=>{buttons.forEach((button,i)=>{button.disabled=i<state.tankStep;button.classList.toggle("done",i<state.tankStep);});label.textContent=state.tankStep+" / 3 layers fitted · Next: "+(repairOrder[state.tankStep]||"Complete");};
        root.append(board);easyHint(root,"Fit the inner liner first, then seat the weather gasket, then tighten the outer clamp.");paint();
      });
  }
  function gatePuzzle(){
    let paint=()=>{};
    modal("DISTRIBUTION STATION · SLUICE PUZZLE","Share the restored flow",
      "Six units of flow are ready. Set the homes gate to 3, clinic to 2, and reserve storage to 1. Every destination must receive its allocation before you open the main release.",
      [{text:"💧 Open the main release",primary:true,action:()=>{
        if(gatesSafe()){close();reward("release");finish();return;}
        fail("gateFailures",state.gates.join(","),"The allocation is not ready. Homes need 3, clinic 2 and storage 1. All six units must be accounted for.");paint();
      }},{text:"Mara’s distribution hint",action:()=>{$("coastModalText").textContent="Move the Homes slider to 3, Clinic to 2, and Reserve to 1. The total is 6. Then open the main release.";}},{text:"Return to harbor",action:()=>{save();close();}}],root=>{
        const owner=state,version=state.modalVersion,board=document.createElement("div");board.className="coast-sluices";
        const values=[],sliders=[];
        for(let i=0;i<3;i++){
          const label=document.createElement("label"),copy=document.createElement("span"),value=document.createElement("output"),slider=document.createElement("input");
          label.className="coast-sluice";copy.textContent=["Homes · target 3","Clinic · target 2","Reserve · target 1"][i];
          slider.type="range";slider.min="0";slider.max="5";slider.step="1";slider.value=String(state.gates[i]);slider.dataset.coastGate=String(i);
          slider.setAttribute("aria-label",["Homes gate","Clinic gate","Reserve storage gate"][i]);
          slider.addEventListener("input",()=>{if(state!==owner||!state.modal||state.modalVersion!==version)return;state.gates[i]=clamp(Math.round(Number(slider.value)||0),0,5);save();paint();});
          label.append(copy,value,slider);board.append(label);values.push(value);sliders.push(slider);
        }
        const status=document.createElement("p");status.className="coast-puzzle-status";status.setAttribute("role","status");board.append(status);
        paint=()=>{values.forEach((value,i)=>{value.textContent=state.gates[i]+" units";sliders[i].value=String(state.gates[i]);});status.textContent=gatesSafe()?"✓ All destinations are ready. Open the main release!":"Allocated "+state.gates.reduce((a,b)=>a+b,0)+" / 6 flow units";};
        root.append(board);easyHint(root,"Set Homes to 3, Clinic to 2 and Reserve to 1. These use all 6 flow units.");paint();
      });
  }
  function finish(){
    if(state.finished||order.some(key=>!state.done.has(key)))return;
    state.finished=true;state.active=false;state.paused=false;state.keys.clear();state.path=[];
    state.score+=Math.round(state.energy)*2;state.waterAt=performance.now()/1000;state.cheerAt=state.waterAt;
    progress?.complete("coast");$("coastToast").hidden=true;tone(990,.18);refresh();results();
  }
  function results(){
    if(!state.finished||screen.hidden)return;
    const bonus=mode().bonusObjectives&&state.bonus.size===3?" You also earned the Storm Scout badge by recovering all three storm caches.":"";
    modal("✦ CHAPTER 03 COMPLETE","A stronger shore. A new beginning.",
      "The lighthouse has power, the cargo bridge is balanced, the storage tank is sealed, and water flows to homes and the clinic again. Your work brought Stormbreak Coast back to life. Total impact: "+state.score.toLocaleString()+"."+bonus,
      [{text:"◈ Return to chapter selection",primary:true,action:goHome},{text:"↻ Replay Stormbreak Coast",action:()=>{close();launch(true);}},{text:"💧 Watch the harbor come alive",action:()=>{close();screen.scrollIntoView?.({block:"start",behavior:"instant"});$("coastCheer").focus({preventScroll:true});}}],root=>{
        const scene=document.createElement("div");scene.className="coast-victory-art";scene.setAttribute("aria-hidden","true");
        const light=document.createElement("span");light.textContent="◈";const water=document.createElement("strong");water.textContent="≈  ≈  ≈";const caption=document.createElement("small");caption.textContent="STORMBREAK COAST · RESTORED BY YOU";scene.append(light,water,caption);root.append(scene);
      });
  }
  function refresh(){
    const next=order.find(key=>!state.done.has(key)),completed=state.done.size;
    $("coastObjective").textContent=state.finished?"The coast is restored. Celebrate with the harbor crew!":"Next: "+(goals[next]?.title||"Open the main release");
    $("coastEnergy").textContent="⚡ "+Math.ceil(state.energy)+"% energy";$("coastScore").textContent="✦ "+state.score.toLocaleString()+" impact";
    const seconds=Math.floor(state.elapsed);$("coastTime").textContent="◷ "+Math.floor(seconds/60).toString().padStart(2,"0")+":"+(seconds%60).toString().padStart(2,"0");
    $("coastMode").textContent=mode().label||mode().id;
    $("coastProgressLabel").textContent=completed+" / 5 harbor repairs";$("coastProgressFill").style.width=completed/5*100+"%";
    const stamp=[...state.done].join("|");
    if(state.questStamp!==stamp){
      state.questStamp=stamp;const quests=$("coastQuests"),destinations=$("coastDestinations");quests.replaceChildren();destinations.replaceChildren();
      for(const [key,goal] of Object.entries(goals)){
        const item=document.createElement("div");item.className="coast-quest"+(state.done.has(key)?" done":"");
        const icon=document.createElement("span");icon.textContent=state.done.has(key)?"✓":goal.icon;
        const body=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");title.textContent=goal.title;detail.textContent=goal.detail;body.append(title,detail);item.append(icon,body);quests.append(item);
        const button=document.createElement("button");button.type="button";button.dataset.coastDestination=key;button.textContent=(state.done.has(key)?"✓ ":"↗ ")+goal.title;button.addEventListener("click",()=>pathTo(goal,key));destinations.append(button);
      }
      const rest=document.createElement("button");rest.type="button";rest.textContent="⛺ Rest at the harbor shelter";rest.addEventListener("click",()=>pathTo(shelter));destinations.append(rest);
    }
    const near=nearest();$("coastPrompt").hidden=!near||!state.active||state.modal||state.paused;
    if(near)$("coastPromptText").textContent=near==="rest"?"Rest at the shelter":goals[near].title;
    $("coastCelebration").hidden=!state.finished||state.modal||screen.hidden;
    $("coastBonus").hidden=!mode().bonusObjectives;$("coastBonus").textContent="STORM SCOUT · Recover the three storm caches · "+state.bonus.size+" / 3";
  }
  function update(dt){
    if(!state.active||state.paused||state.modal)return;
    let dx=Number(state.keys.has("d")||state.keys.has("arrowright"))-Number(state.keys.has("a")||state.keys.has("arrowleft"));
    let dy=Number(state.keys.has("s")||state.keys.has("arrowdown"))-Number(state.keys.has("w")||state.keys.has("arrowup"));
    const direct=dx!==0||dy!==0;
    if(direct)state.path=[];
    else if(state.path.length){if(dist(state,state.path[0])<2)state.path.shift();if(state.path[0]){dx=state.path[0].x-state.x;dy=state.path[0].y-state.y;}}
    const length=Math.hypot(dx,dy);if(length){const speed=state.keys.has("shift")?255:185,step=Math.min(speed*dt,direct?speed*dt:length);dx=dx/length*step;dy=dy/length*step;
      if(!blocked(state.x+dx,state.y))state.x+=dx;if(!blocked(state.x,state.y+dy))state.y+=dy;
      spend(dt*(state.keys.has("shift")?.42:.22));}
    state.elapsed+=dt;
    for(const cache of caches)if(!state.bonus.has(cache.id)&&dist(state,cache)<29){state.bonus.add(cache.id);state.energy=Math.min(100,state.energy+12);state.score+=35;save();toast("Storm cache recovered · +12 energy · +35 impact");tone(880,.1);}
    if(state.elapsed-state.lastSave>7)save();
    if(state.elapsed-state.lastUI>.25){state.lastUI=state.elapsed;refresh();}
  }
  function drawFallback(time){
    if(!ctx)return;
    const c=ctx;c.clearRect(0,0,W,H);
    const sea=c.createLinearGradient(0,0,0,H);sea.addColorStop(0,"#72aebb");sea.addColorStop(1,"#176e89");c.fillStyle=sea;c.fillRect(0,0,W,H);
    c.fillStyle="#d7c391";c.beginPath();c.moveTo(25,75);c.lineTo(456,75);c.lineTo(470,548);c.lineTo(30,570);c.closePath();c.fill();c.beginPath();c.moveTo(570,75);c.lineTo(975,75);c.lineTo(970,560);c.lineTo(575,548);c.closePath();c.fill();
    c.strokeStyle="#e5f4db88";c.lineWidth=3;
    for(let i=0;i<16;i++){const y=576+i*5,x=i*83%W;c.beginPath();c.moveTo(x,y);c.lineTo(x+45,y+(reduced()?0:Math.sin(time+i)*3));c.stroke();}
    c.strokeStyle="#9e8d70";c.lineWidth=24;c.lineCap="round";
    for(const route of [[[165,370],[210,490],[335,360],[340,244]],[[340,244],[442,365]],[[600,365],[740,245],[850,390]]]){c.beginPath();route.forEach((point,i)=>i?c.lineTo(...point):c.moveTo(...point));c.stroke();}
    c.fillStyle=state.done.has("bridge")?"#b28a5e":"#766b60";c.fillRect(451,337,138,61);
    for(let x=458;x<588;x+=15){c.fillStyle="#e2c493";c.fillRect(x,341,9,53);}
    if(!state.done.has("bridge")){c.strokeStyle="#f4cf76";c.lineWidth=8;c.beginPath();c.moveTo(478,339);c.lineTo(566,396);c.stroke();}
    for(const [key,goal] of Object.entries(goals)){
      c.fillStyle=state.done.has(key)?"#73b8a1":"#f3dfa7";c.beginPath();c.arc(goal.x,goal.y,22,0,Math.PI*2);c.fill();
      c.fillStyle="#173b47";c.textAlign="center";c.font=`23px ${FONT_FAMILY}`;c.fillText(goal.icon,goal.x,goal.y+8);c.font=`800 13px ${FONT_FAMILY}`;c.fillText(goal.title,goal.x,goal.y-32);
    }
    c.fillStyle="#2e6c77";c.fillRect(315,150,50,38);powerOutputs().forEach((on,i)=>{c.fillStyle=on?"#98f5b5":"#667f7c";c.beginPath();c.arc(325+i*15,168,5,0,Math.PI*2);c.fill();});
    c.fillStyle="#709fa1";c.fillRect(713,142,54,65);c.fillStyle="#d6dbc0";c.fillRect(709,137,62,10);
    for(let i=0;i<state.tankStep;i++){c.fillStyle="#d9bb78";c.fillRect(718+i*14,169,9,16);}
    c.strokeStyle="#aeaa89";c.lineWidth=18;c.beginPath();c.moveTo(747,207);c.lineTo(800,295);c.lineTo(850,369);c.stroke();
    c.fillStyle="#c4c4a1";c.beginPath();c.ellipse(850,415,44,27,0,0,Math.PI*2);c.fill();
    if(state.finished){
      c.strokeStyle="#78e4de";c.lineWidth=10;c.beginPath();c.moveTo(747,207);c.lineTo(800,295);c.lineTo(850,369);c.stroke();c.fillStyle="#55ced1";c.beginPath();c.ellipse(850,415,36,20,0,0,Math.PI*2);c.fill();
      if(!reduced()){c.setLineDash([6,15]);c.lineDashOffset=-time*20;c.strokeStyle="#d5fff2";c.lineWidth=2;c.stroke();c.setLineDash([]);}
      for(let i=0;i<6;i++){const a=i*Math.PI/3;c.fillStyle="#72b97b";c.beginPath();c.ellipse(850+Math.cos(a)*57,415+Math.sin(a)*40,7,13,a,0,Math.PI*2);c.fill();}
    }
    c.fillStyle="#e3c47c";c.font=`24px ${FONT_FAMILY}`;c.fillText("⛺",shelter.x,shelter.y);
    for(const cache of caches)if(!state.bonus.has(cache.id)){c.fillStyle="#fff0ae";c.font=`22px ${FONT_FAMILY}`;c.fillText("✦",cache.x,cache.y);}
    c.fillStyle="#f1ca3f";c.fillRect(state.x-9,state.y-14,18,22);c.fillStyle="#2e8e8e";c.beginPath();c.ellipse(state.x,state.y+1,10,12,0,0,Math.PI*2);c.fill();c.fillStyle="#794529";c.beginPath();c.arc(state.x,state.y-9,7,0,Math.PI*2);c.fill();
  }
  async function buildWorld(){
    if(world||creating)return;creating=true;
    try{
      const THREE=await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
      await window.TrailTypography?.ready;
      if((!state.active&&!state.finished)||screen.hidden)return;
      let graphics={preset:"high",resolution:1.1,shadows:true,effects:true};try{graphics={...graphics,...(JSON.parse(localStorage.getItem("thirstTrailGraphics")||"null")||{})};}catch{}
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x93c4cd);scene.fog=new THREE.FogExp2(0xbed6cf,.006);
      const camera=new THREE.PerspectiveCamera(48,1000/610,.1,220),renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7)*clamp(Number(graphics.resolution)||1,.65,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const hemi=new THREE.HemisphereLight(0xe6f4ed,0x788b78,1.15);scene.add(hemi);
      const sun=new THREE.DirectionalLight(0xffe0ad,3.1);sun.position.set(-18,29,12);scene.add(sun);
      sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;
      sun.shadow.camera.near=1;sun.shadow.camera.far=90;sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;sun.shadow.radius=2;
      const fill=new THREE.DirectionalLight(0x9ccfdd,.35);fill.position.set(15,10,-12);scene.add(fill);
      const cinematic=window.TrailCinematic?.create(THREE,{renderer,scene,camera,chapter:"coast"});
      function applyGraphics(next={}){
        graphics={...graphics,...next};
        const quality=["low","medium","high","ultra"].includes(graphics.preset)?graphics.preset:"high";
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7)*clamp(Number(graphics.resolution)||1,.65,1.5));
        renderer.shadowMap.enabled=graphics.shadows!==false;sun.castShadow=renderer.shadowMap.enabled;
        const size=quality==="low"?512:quality==="medium"?1024:2048;
        if(sun.shadow.mapSize.x!==size){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size);sun.shadow.needsUpdate=true;}
        cinematic?.configure({...graphics,preset:quality});
      }
      applyGraphics(graphics);
      const art=window.TrailCoastVisuals?.build(THREE,{scene,getState:()=>state,wx,wz,surfaces:cinematic?.surfaces,getGraphics:()=>graphics});
      if(!art){const ground=new THREE.Mesh(new THREE.PlaneGeometry(45,29),new THREE.MeshStandardMaterial({color:0xd8c896}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);}
      const player=window.ThirstExplorer?.create(THREE)||new THREE.Group();
      if(!player.children.length){const body=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.65,8),new THREE.MeshStandardMaterial({color:0x2d9892}));body.position.y=.6;player.add(body);}
      scene.add(player);
      cinematic?.character(player);
      const characterVisibility=window.ThirstExplorer?.visibility?.(THREE,scene,player);
      const marks=[];
      for(const [key,goal] of Object.entries(goals)){
        const group=new THREE.Group();group.position.set(wx(goal.x),.2,wz(goal.y));scene.add(group);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.06,6,24),new THREE.MeshBasicMaterial({color:0xffd783}));ring.rotation.x=-Math.PI/2;group.add(ring);
        const labelCanvas=document.createElement("canvas");labelCanvas.width=512;labelCanvas.height=96;const g=labelCanvas.getContext("2d");
        if(g){g.fillStyle="#123b46";g.fillRect(0,0,512,96);g.strokeStyle="#e8d3a1";g.lineWidth=8;g.strokeRect(0,0,512,96);g.textAlign="center";g.fillStyle="#fff5d7";g.font=`bold 28px ${FONT_FAMILY}`;g.fillText(goal.title,256,59);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),depthTest:false}));label.position.y=3.8;label.scale.set(4.5,.85,1);group.add(label);}
        marks.push({key,group,ring});
      }
      const dom=renderer.domElement;dom.className="coast-webgl";dom.tabIndex=0;dom.style.cssText="display:block;width:100%;height:auto;aspect-ratio:1000/610;touch-action:none";
      let missionLabels=null;
      try{
        missionLabels=window.TrailWorldLabels?.create?.(THREE,{camera,canvas:dom,
          labels:marks.map(mark=>({id:mark.key,title:goals[mark.key].title,anchor:mark.group,offset:[0,3.8,0]}))})||null;
      }catch(error){console.warn("Coast mission label overlay unavailable; retaining sprites.",error);}
      canvas.parentElement.insertBefore(dom,canvas);canvas.style.display="none";
      const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
      dom.addEventListener("click",event=>{
        if(!state.active||state.modal||state.paused)return;const rect=dom.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
        const hit=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit))selectPoint({x:hit.x*24+500,y:hit.z*24+305});
      });
      let zoom=1,first=true,last=0,lastX=state.x,lastY=state.y,width=0,height=0;
      dom.addEventListener("wheel",event=>{event.preventDefault();zoom=clamp(zoom+Math.sign(event.deltaY)*.09,.75,1.7);},{passive:false});
      world={dom,recenter(){zoom=1;first=true;},setGraphicsSettings:applyGraphics,getGraphicsStatus(){return cinematic?.status()||null;},draw(time){
        const w=Math.max(300,Math.floor(dom.clientWidth||1000)),h=Math.max(180,Math.floor(dom.clientHeight||610));if(width!==w||height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();width=w;height=h;}
        const dx=state.x-lastX,dy=state.y-lastY,dt=last?clamp(time-last,0,.05):.016;last=time;lastX=state.x;lastY=state.y;
        player.position.set(wx(state.x),0,wz(state.y));if(Math.hypot(dx,dy)>.01)player.rotation.y=Math.atan2(dx,dy);
        window.ThirstExplorer?.animate(player,{time,dt,distance:Math.hypot(dx,dy)/24,running:state.keys.has("shift"),interaction:state.modal,victory:state.finished,reduced:reduced()});
        const focus=state.finished?(art?.getFocus?.()||{x:wx(850),y:.8,z:wz(390)}):{x:wx(state.x),y:.75,z:wz(state.y)};
        const aim=new THREE.Vector3(focus.x,focus.y,focus.z),desired=aim.clone().add(new THREE.Vector3(7.5,11,14).multiplyScalar(zoom));
        if(first||reduced()){camera.position.copy(desired);first=false;}else camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(aim);
        const next=order.find(key=>!state.done.has(key));
        for(const mark of marks){
          mark.ring.material.color.set(state.done.has(mark.key)?0x82d8b6:0xffd783);mark.group.visible=!state.finished;
          for(const child of mark.group.children)if(child.isSprite)child.visible=!missionLabels&&(mark.key===next||nearest()===mark.key);
        }
        missionLabels?.update({visible:!state.finished,completed:state.done,activeKey:next||null});
        art?.update(time,{reduced:reduced(),effects:graphics.effects!==false});
        if(state.finished)characterVisibility?.clear?.();else characterVisibility?.update(camera,dt);
        cinematic?.update(time,{reduced:reduced(),effects:graphics.effects!==false});
        if(cinematic)cinematic.render();else renderer.render(scene,camera);
      },dispose(){missionLabels?.dispose();characterVisibility?.dispose();art?.dispose();cinematic?.dispose();renderer.dispose();dom.remove();canvas.style.display="";}};
    }catch(error){console.warn("Coast 3D unavailable; using the playable harbor map.",error);canvas.style.display="";}finally{creating=false;}
  }
  function selectPoint(point){
    let closest=null,best=65;for(const [key,goal] of Object.entries(goals)){const d=dist(point,goal);if(d<best){closest=key;best=d;}}
    if(closest)pathTo(goals[closest],closest);else pathTo(point);
  }
  function frame(time){
    const dt=lastFrame?clamp((time-lastFrame)/1000,0,.05):0;lastFrame=time;
    if(!screen.hidden&&(state.active||state.finished)){
      update(dt);if(performance.now()>state.toastUntil)$("coastToast").hidden=true;
      if(world){try{world.draw(time/1000);}catch(error){console.warn("Coast graphics fallback",error);world.dispose();world=null;}}else drawFallback(time/1000);
    }
    raf=requestAnimationFrame(frame);
  }
  function launch(forceNew=false){
    if(!progress?.unlocked("coast"))return false;
    window.dispatchEvent(new Event("trail:coast"));
    if(forceNew)progress.clearSave("coast");const saved=!forceNew?progress.saved("coast"):null;
    state=blank();state.active=true;if(saved)restore(saved);lastFrame=0;
    for(const id of ["startScreen","gameScreen","canyonScreen"]){const element=$(id);if(element)element.hidden=true;}
    screen.hidden=false;close();world?.recenter();refresh();save();buildWorld();if(!raf)raf=requestAnimationFrame(frame);
    if(order.every(key=>state.done.has(key)))finish();else toast(saved?"Stormbreak checkpoint restored. Welcome back!":"Chapter 3 · Meet Mara at the harbor to begin.");
    screen.scrollIntoView?.({block:"start",behavior:"instant"});return true;
  }
  function suspend(){if(state.active)save();state.active=false;state.paused=false;state.keys.clear();state.path=[];state.modal=false;state.modalVersion++;refreshDifficulty=null;$("coastModalBackdrop").hidden=true;$("coastCelebration").hidden=true;}
  function goHome(){suspend();screen.hidden=true;window.dispatchEvent(new Event("trail:home"));}
  function pause(){
    if(!state.active||state.finished)return;state.paused=true;
    modal("HARBOR SHELTER","Take a moment by the shore","Your repair progress is saved. Rest, then continue the expedition when you are ready.",[{text:"▶ Resume expedition",primary:true,action:()=>{state.paused=false;close();}},{text:"◈ Chapter selection",action:goHome}]);
  }
  canvas.addEventListener("click",event=>{if(world||!state.active||state.modal||state.paused)return;const rect=canvas.getBoundingClientRect();selectPoint({x:(event.clientX-rect.left)/rect.width*W,y:(event.clientY-rect.top)/rect.height*H});});
  $("coastInteract").addEventListener("click",interact);$("coastTouchAct").addEventListener("click",interact);$("coastPause").addEventListener("click",pause);$("coastHome").addEventListener("click",goHome);$("coastFinishHome").addEventListener("click",goHome);$("coastResults").addEventListener("click",results);
  $("coastCheer").addEventListener("click",()=>{if(!state.finished||state.modal||screen.hidden)return;state.cheerAt=performance.now()/1000;tone(880,.12);toast("The harbor crew cheers with you. Stormbreak Coast is alive again!");});
  $("coastRecenter").addEventListener("click",()=>world?.recenter());
  for(const button of screen.querySelectorAll?.("[data-coast-key]")||[]){const key=button.dataset.coastKey;button.addEventListener("pointerdown",event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);state.keys.add(key);});for(const type of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(type,()=>state.keys.delete(key));}
  window.addEventListener("keydown",event=>{
    if(screen.hidden||!state.active)return;
    if(state.modal){if(event.key==="Escape"&&!state.finished){state.paused=false;close();}return;}
    if(["INPUT","SELECT","TEXTAREA"].includes(event.target?.tagName))return;if(["BUTTON","A"].includes(event.target?.tagName)&&["Enter"," "].includes(event.key))return;
    const key=event.key.toLowerCase();if(["arrowleft","arrowright","arrowup","arrowdown"," "].includes(key))event.preventDefault();
    if(["w","a","s","d","arrowleft","arrowright","arrowup","arrowdown","shift"].includes(key))state.keys.add(key);
    if(!event.repeat&&(key==="e"||key===" "))interact();if(!event.repeat&&key==="p")pause();if(!event.repeat&&key==="c")world?.recenter();
  });
  window.addEventListener("keyup",event=>state.keys.delete(event.key.toLowerCase()));window.addEventListener("blur",()=>state.keys.clear());window.addEventListener("pagehide",save);
  document.addEventListener("visibilitychange",()=>{state.keys.clear();if(document.hidden&&state.active&&!state.modal)pause();});
  window.addEventListener("trail:mode",()=>{if(state.active||state.finished){refresh();refreshDifficulty?.();}});
  window.addEventListener("trail:graphics",event=>world?.setGraphicsSettings?.(event.detail));
  window.TrailCoast=Object.freeze({launch,suspend,goHome,pause,snapshot:()=>({active:state.active,paused:state.paused,modal:state.modal,finished:state.finished,x:state.x,y:state.y,energy:state.energy,score:state.score,elapsed:state.elapsed,done:[...state.done],power:[...state.power],powerOutputs:powerOutputs(),weights:[...state.weights],torque:bridgeTorque(),tankStep:state.tankStep,gates:[...state.gates],bonus:[...state.bonus],waterRestored:state.finished,mode:mode().id,difficulty:mode().difficulty,renderer:world?"3d":"2d",graphics:world?.getGraphicsStatus?.()||null})});
})();
