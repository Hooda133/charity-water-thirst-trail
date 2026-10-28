"use strict";
/* Thirst Trail 2.0 — standalone second chapter with a distinct 3D world.
   Falls back to a playable 2D canyon if WebGL / CDN loading fails. */
(() => {
  const FONT_FAMILY = window.TrailTypography?.family || "sans-serif";
  const $=id=>document.getElementById(id),progress=window.TrailProgress;
  const canvas=$("canyonCanvas"),ctx=canvas?.getContext("2d");
  if(!canvas||!ctx)return;
  const W=1000,H=610;
  const goals={
    surveyor:{x:165,y:270,title:"Meet the canyon surveyor",icon:"🧭",detail:"Learn what damaged the aqueduct"},
    kit:{x:305,y:455,title:"Recover the seal kit",icon:"🎒",detail:"Search the weathered supply shelter"},
    valves:{x:390,y:165,title:"Balance the pressure valves",icon:"🎛️",detail:"Regulate flow through three control valves"},
    span:{x:700,y:365,title:"Rebuild the aqueduct",icon:"🛠️",detail:"Repair the broken crossing in order"},
    cistern:{x:820,y:175,title:"Test the village cistern",icon:"💧",detail:"Pass the inspection and solve the reservoir lock"}
  };
  const questOrder=Object.keys(goals);
  const rest={x:290,y:520,title:"Shaded rest shelter",icon:"⛺"};
  const defaultState=()=>({
    active:false,paused:false,finished:false,celebrationStart:0,x:170,y:425,
    energy:100,score:0,elapsed:0,done:new Set(),keys:new Set(),
    path:[],nearby:null,modal:false,modalVersion:0,valves:[0,0,0],repairStep:0,
    failedValveTests:new Set(),cisternMistake:false,cisternSafetyPassed:false,
    releaseBasins:[0,0],releaseHint:false,
    lastSave:0,toastUntil:0,toast:""
  });
  let state=defaultState(),world=null,creating=false,lastFrame=0,raf=0,refreshDifficulty=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const reducedMotion=()=>!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const celebrationTime=()=>state.finished?Math.max(0,(performance.now()-state.celebrationStart)/1000):0;
  // Reuse Chapter 1's optional, muted-by-default-setting audio path. Canyon has
  // only short action cues and a finite victory chime, with no ambient loop.
  const sound=(frequency=620,duration=.09)=>window.ThirstAudio?.tone(frequency,duration);
  const cue=name=>window.ThirstAudio?.play?.(name);
  const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const mode=()=>window.TrailMode?.profile?.()||{id:"normal",label:"Normal",difficulty:"normal",energyMultiplier:1,mistakeMultiplier:1,hints:false,pressureMin:65,pressureMax:73};
  // Keep the Canyon's nonlethal recovery floor without ever granting energy
  // when a damaged or externally restored state starts below that floor.
  const spendEnergy=amount=>{const scale=mode().energyMultiplier||1;state.energy=Math.max(0,Math.min(state.energy,Math.max(7,state.energy-amount*scale)));};
  const mistakeCost=amount=>spendEnergy(amount*(mode().mistakeMultiplier||1));
  const wX=x=>(x-500)/24,wZ=y=>(y-305)/24;
  const isWaterGarden=(x,z)=>{
    const dx=x-wX(goals.cistern.x),dz=z-wZ(goals.cistern.y);
    return dx>-.9&&dx<5.1&&dz>1.2&&dz<8.3;
  };
  const approaches={valves:{x:390,y:223},span:{x:700,y:397},cistern:{x:820,y:235}};
  // Collision footprints include the explorer's body, so tanks and aqueduct
  // masonry cannot swallow the character. Markers remain at their landmarks.
  const solidCircles=[{x:390,y:165,r:46},{x:820,y:175,r:49}];
  const solidSpan={left:638,right:762,top:332,bottom:374};
  function blocked(x,y){
    if(x<39||x>961||y<43||y>567)return true;
    if(x>451&&x<566&&(y<324||y>384))return true;
    if(solidCircles.some(circle=>Math.hypot(x-circle.x,y-circle.y)<circle.r))return true;
    return x>solidSpan.left&&x<solidSpan.right&&y>solidSpan.top&&y<solidSpan.bottom;
  }
  function surfaceHeight(x,y){
    if(y<316||y>392)return 0;
    // Match the .29-high crossing deck and its two short access ramps.
    return .29*Math.min(clamp((x-405)/19,0,1),clamp((598-x)/19,0,1));
  }
  function pathTo(point){
    if(!state.active||state.paused||state.modal)return;
    const goalKey=questOrder.find(key=>point===goals[key]);
    const target=approaches[goalKey]||point;
    if(blocked(target.x,target.y))return toast("That spot is blocked. Choose open trail or a mission marker.");
    const nodes=[{x:state.x,y:state.y},target,{x:438,y:350},{x:579,y:350}];
    for(const circle of solidCircles)for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      nodes.push({x:circle.x+Math.cos(angle)*(circle.r+12),y:circle.y+Math.sin(angle)*(circle.r+12)});
    }
    for(const x of [solidSpan.left-10,solidSpan.right+10])
      for(const y of [solidSpan.top-10,solidSpan.bottom+10])nodes.push({x,y});
    const clear=(a,b)=>{
      const steps=Math.max(1,Math.ceil(pointDistance(a,b)/4));
      for(let i=1;i<=steps;i++){
        const t=i/steps;
        if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
      }
      return true;
    };
    // The small visibility graph routes around solid landmarks and through the
    // bridge from either bank, including a click made mid-crossing.
    const distance=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();distance[0]=0;
    for(let step=0;step<nodes.length;step++){
      let next=-1;
      for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(next<0||distance[i]<distance[next]))next=i;
      if(next<0||!Number.isFinite(distance[next]))break;
      if(next===1)break;
      visited.add(next);
      for(let i=1;i<nodes.length;i++){
        if(visited.has(i)||!clear(nodes[next],nodes[i]))continue;
        const cost=distance[next]+pointDistance(nodes[next],nodes[i]);
        if(cost<distance[i]){distance[i]=cost;previous[i]=next;}
      }
    }
    if(!Number.isFinite(distance[1]))return toast("No clear trail there. Choose a nearby open spot.");
    const route=[];
    for(let i=1;i>0;i=previous[i])route.unshift(nodes[i]);
    state.path=route;
    toast("Following the canyon trail…");
  }
  function closest(){
    let found=null,best=78;
    for(const [key,obj] of [...Object.entries(goals),["rest",rest]]){
      const d=pointDistance(state,obj);
      if(d<best){best=d;found=key;}
    }
    return found;
  }
  function toast(message){
    state.toast=message;state.toastUntil=performance.now()+3400;
    const el=$("canyonToast");el.textContent=message;el.hidden=false;
  }
  function currentPressure(){return 16*state.valves[0]+13*state.valves[1]+11*state.valves[2];}
  function valvesSafe(minimum,maximum){
    const [a,b,c]=state.valves,p=currentPressure();
    return p>=minimum&&p<=maximum&&b>=1&&Math.abs(a-c)<=1;
  }
  function pressureSafe(){return valvesSafe(mode().pressureMin??65,mode().pressureMax??73);}
  function save(){
    if(!state.active||state.finished||!progress)return;
    const saved=progress.save("canyon",{
      x:Math.round(state.x),y:Math.round(state.y),
      energy:Math.round(state.energy*10)/10,score:state.score,
      elapsed:Math.round(state.elapsed),
      done:[...state.done],valves:[...state.valves],repairStep:state.repairStep,
      failedValveTests:[...state.failedValveTests],cisternMistake:state.cisternMistake,
      cisternSafetyPassed:state.cisternSafetyPassed,releaseBasins:[...state.releaseBasins],releaseHint:state.releaseHint
    });
    $("canyonSaveStatus").textContent=saved?"✓ Checkpoint saved in this browser":
      progress.storageStatus?.().reason==="newer-save"?"Session checkpoint ready · newer browser save preserved":
      "Session checkpoint ready · browser storage unavailable";
    state.lastSave=state.elapsed;
  }
  function restore(saved){
    if(!saved||typeof saved!=="object")return;
    const number=(value,fallback)=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):fallback;
    state.x=clamp(number(saved.x,170),45,955);
    state.y=clamp(number(saved.y,425),45,565);
    if(blocked(state.x,state.y)){
      const landmark=questOrder.find(key=>approaches[key]&&pointDistance(state,goals[key])<78);
      state.x=landmark?approaches[landmark].x:170;
      state.y=landmark?approaches[landmark].y:425;
    }
    state.energy=clamp(number(saved.energy,100),7,100);
    state.score=Math.max(0,number(saved.score,0));
    state.elapsed=Math.max(0,number(saved.elapsed,0));
    state.done=new Set((Array.isArray(saved.done)?saved.done:[]).filter(key=>questOrder.includes(key)));
    if(Array.isArray(saved.valves)&&saved.valves.length===3)
      state.valves=saved.valves.map(x=>clamp(Math.trunc(Number(x)||0),0,3));
    state.repairStep=clamp(Math.trunc(number(saved.repairStep,0)),0,4);
    state.failedValveTests=new Set((Array.isArray(saved.failedValveTests)?saved.failedValveTests:[])
      .filter(value=>typeof value==="string"&&/^[0-3],[0-3],[0-3]$/.test(value)));
    state.cisternMistake=saved.cisternMistake===true;
    state.cisternSafetyPassed=saved.cisternSafetyPassed===true;
    state.releaseHint=saved.releaseHint===true;
    if(Array.isArray(saved.releaseBasins)&&saved.releaseBasins.length===2)
      state.releaseBasins=saved.releaseBasins.map((value,i)=>
        Number.isInteger(value)&&value>=0&&value<=[5,3][i]?value:0);
    // Completed later work proves that its prerequisites were completed. Keep
    // earned work when repairing an older or interrupted checkpoint.
    const lastDone=Math.max(-1,...[...state.done].map(key=>questOrder.indexOf(key)));
    for(let i=0;i<=lastDone;i++)state.done.add(questOrder[i]);
    // A stricter difficulty cannot undo calibration already earned on an older run.
    if(state.done.has("valves")&&!valvesSafe(65,73))state.valves=[2,2,1];
    if(state.done.has("span"))state.repairStep=4;
    // Step four used to be saved before the span flag, leaving no clickable
    // repair step after a reload. Reconcile it without giving a second reward.
    if(state.repairStep===4&&state.done.has("valves")&&!state.done.has("span")){
      state.done.add("span");state.score+=310;
    }
    if(!state.done.has("valves"))state.repairStep=0;
    // Keep completed older expeditions complete; unfinished saves get the new lock.
    if(state.done.has("cistern")){
      state.cisternSafetyPassed=true;
      if(state.releaseBasins[0]!==4)state.releaseBasins=[4,0];
    }else if(!state.done.has("span")||!state.cisternSafetyPassed){
      if(!state.done.has("span"))state.cisternSafetyPassed=false;
      state.releaseBasins=[0,0];state.releaseHint=false;
    }
  }
  function completeQuest(key,points){
    if(!state.active||state.finished||state.done.has(key))return;
    const index=questOrder.indexOf(key);
    if(index<0||questOrder.slice(0,index).some(previous=>!state.done.has(previous)))return;
    if(key==="cistern"&&(!state.cisternSafetyPassed||state.releaseBasins[0]!==4))return;
    state.done.add(key);state.score+=points;
    if(key!=="cistern")cue(key==="kit"?"collect":"reward");
    save();refreshUI();
    toast("✓ "+goals[key].title+" complete! +"+points+" impact");
  }
  function modal(tag,title,text,choices,extra){
    state.modal=true;state.keys.clear();state.path=[];refreshDifficulty=null;
    const owner=state,version=++state.modalVersion;
    refreshUI();
    save();
    $("canyonModalTag").textContent=tag;
    $("canyonModalTitle").textContent=title;
    $("canyonModalText").textContent=text;
    const content=$("canyonModalExtra");content.replaceChildren();
    if(extra)extra(content);
    const actions=$("canyonModalOptions");actions.replaceChildren();
    for(const item of choices){
      const b=document.createElement("button");
      b.type="button";b.textContent=item.text;
      if(item.primary)b.classList.add("primary");
      b.addEventListener("click",()=>{
        if(state===owner&&state.modal&&state.modalVersion===version)item.action();
      });actions.append(b);
    }
    $("canyonModalBackdrop").hidden=false;
    $("canyonModal").classList.toggle("is-victory",state.finished);
    $("canyonModal").scrollTop=0;
    $("canyonModal").focus({preventScroll:true});
    if(!state.finished)cue("interact");
  }
  function closeModal(){
    state.modal=false;refreshDifficulty=null;$("canyonModalBackdrop").hidden=true;
    refreshUI();
    (world?.dom||canvas).focus({preventScroll:true});
  }
  function interact(){
    if(!state.active||state.paused||state.modal)return;
    const key=closest();
    if(!key)return toast("Walk toward a glowing mission marker and press E.");
    state.path=[];
    if(key==="rest"){
      if(state.energy>=100)return toast("You are fully rested and ready for the next mission.");
      sound();
      const before=state.energy;
      state.energy=Math.min(100,state.energy+34);
      toast("Rested in the canyon shade · +"+(Math.round((state.energy-before)*10)/10)+" energy");save();refreshUI();
      return;
    }
    if(key==="surveyor"){
      modal("CHAPTER 02 · CANYON SURVEY", "The old aqueduct", 
        "Surveyor Nia explains: a flash flood destroyed the stone aqueduct. Recover sealing tools, balance the old valves, rebuild the span, and inspect the cistern. Finally, solve its two-chamber measuring lock to release the water.",
        [{text:state.done.has(key)?"Review the route":"Begin the canyon restoration (+90 impact)",primary:true,action:()=>{
          closeModal();completeQuest(key,90);
        }},{text:"Return to trail",action:closeModal}]);
      return;
    }
    if(!state.done.has("surveyor"))return toast("Talk with Surveyor Nia before starting repairs.");
    if(key==="kit"){
      modal("SUPPLY CACHE","Weathered repair shelter",
        "Among the crates you discover sealing compound, a torque key and reusable repair clamps.",
        [{text:state.done.has(key)?"Inspect the equipment again":"Collect the seal kit (+120 impact)",primary:true,action:()=>{
          closeModal();completeQuest(key,120);
        }},{text:"Return to trail",action:closeModal}]);return;
    }
    if(!state.done.has("kit"))return toast("Recover the seal kit first.");
    if(state.done.has(key))return toast("✓ "+goals[key].title+" is already complete. Follow the next mission marker.");
    if(key==="valves"){valveChallenge();return;}
    if(!state.done.has("valves"))return toast("Balance the pressure valves before repairing the crossing.");
    if(key==="span"){bridgeChallenge();return;}
    if(!state.done.has("span"))return toast("Finish the aqueduct span before testing the cistern.");
    if(key==="cistern"){cisternChallenge();return;}
  }
  function valveChallenge(){
    function redraw(root){
      root.replaceChildren();
      const minimum=mode().pressureMin??65,maximum=mode().pressureMax??73;
      const heading=document.createElement("div");heading.className="canyon-pressure-hint";
      heading.textContent="Adjust each valve from 0 to 3. Target: "+minimum+"–"+maximum+" kPa. Keep the regulator at 1 or higher; intake and return must differ by no more than one setting.";
      root.append(heading);
      for(let i=0;i<3;i++){
        const row=document.createElement("div");row.className="canyon-valve";
        const label=document.createElement("strong");label.textContent=["Intake · +16 kPa","Regulator · +13 kPa","Return · +11 kPa"][i];
        const owner=state,version=state.modalVersion;
        const adjust=amount=>{
          if(state!==owner||!state.modal||state.modalVersion!==version||state.done.has("valves"))return;
          state.valves[i]=clamp(state.valves[i]+amount,0,3);sound(430,.045);redraw(root);save();
        };
        const name=["intake","regulator","return"][i];
        const btn=document.createElement("button");btn.type="button";btn.textContent="+ OPEN "+state.valves[i]+" / 3";
        btn.disabled=state.valves[i]===3;btn.setAttribute("aria-label","Increase "+name+" valve · current setting "+state.valves[i]);
        btn.addEventListener("click",()=>adjust(1));
        const lower=document.createElement("button");lower.type="button";lower.textContent="−";
        lower.disabled=state.valves[i]===0;lower.setAttribute("aria-label","Decrease "+name+" valve · current setting "+state.valves[i]);
        lower.addEventListener("click",()=>adjust(-1));
        row.append(label,btn,lower);root.append(row);
      }
      const meter=document.createElement("div");meter.className="canyon-pressure-meter";
      meter.setAttribute("role","meter");meter.setAttribute("aria-label","System pressure in kPa");
      meter.setAttribute("aria-valuemin","0");meter.setAttribute("aria-valuemax","120");meter.setAttribute("aria-valuenow",String(currentPressure()));
      const fill=document.createElement("span");fill.style.width=clamp(currentPressure()/120*100,0,100)+"%";
      meter.append(fill);root.append(meter);
      const value=document.createElement("strong");value.textContent="System pressure: "+currentPressure()+" kPa";
      value.className="canyon-pressure-hint";root.append(value);
      const feedback=document.createElement("p");feedback.className="canyon-pressure-hint";
      feedback.setAttribute("role","status");
      const issues=[];
      if(currentPressure()<minimum)issues.push("Increase pressure to at least "+minimum+" kPa.");
      if(currentPressure()>maximum)issues.push("Reduce pressure to "+maximum+" kPa or less.");
      if(state.valves[1]<1)issues.push("Open the regulator.");
      if(Math.abs(state.valves[0]-state.valves[2])>1)issues.push("Bring intake and return within one setting.");
      feedback.textContent=issues.join(" ")||"✓ All operating conditions are safe. Test pressure to complete calibration.";
      root.append(feedback);
      if(state.failedValveTests.size>=2||mode().hints){
        const hint=document.createElement("p");hint.className="canyon-pressure-hint";
        hint.textContent="Nia’s field note: Intake 2 + Regulator 2 + Return 1 gives 69 kPa and balanced flow.";
        root.append(hint);
      }
    }
    modal("CONTROL STATION · PRESSURE PUZZLE","Balance the canyon valves",
      "Tune three valve settings. The pressure must be in the safe operating range, the regulator must be open, and intake/return flow must stay balanced.",
      [{text:"💧 Test pressure",primary:true,action:()=>{
        if(pressureSafe()){closeModal();completeQuest("valves",250);return;}
        const setting=state.valves.join(",");
        if(!state.failedValveTests.has(setting)){
          state.failedValveTests.add(setting);mistakeCost(4);
        }
        cue("mistake");
        toast("Unsafe configuration. Check the conditions shown below the pressure meter.");
        valveChallenge();save();
      }},{text:"↩ Continue exploring",action:()=>{save();closeModal();}}],
      el=>{const root=document.createElement("div");root.className="canyon-pressure";el.append(root);refreshDifficulty=()=>redraw(root);redraw(root);});
  }
  const repairOrder=["Anchor supports","Brace the span","Seat the pipe","Apply the seal"];
  function bridgeChallenge(){
    function draw(root){
      root.replaceChildren();const board=document.createElement("div");board.className="canyon-repair-tiles";
      for(let i=0;i<4;i++){
        const btn=document.createElement("button");btn.type="button";
        btn.className=i<state.repairStep?"selected":"";
        btn.disabled=i<state.repairStep;
        btn.textContent=["⚓","🪵","🔩","🧪"][i];
        const label=document.createElement("small");label.textContent=repairOrder[i];btn.append(label);
        btn.addEventListener("click",()=>{
          if(i===state.repairStep){
            state.repairStep++;cue("repair");
            if(state.repairStep===4){closeModal();completeQuest("span",310);return;}
            save();draw(root);
          }else{
            cue("mistake");
            const warning="Next: "+repairOrder[state.repairStep]+". Supports first, then braces, pipe, and seal. Completed work stays in place.";
            $("canyonModalText").textContent=warning;
            toast(warning);
          }
        });board.append(btn);
      }
      const label=document.createElement("p");label.className="canyon-pressure-hint";
      label.textContent=state.repairStep+"/4 repair steps complete · Next: "+(repairOrder[state.repairStep]||"Done");
      root.append(board,label);
    }
    modal("REPAIR THE CROSSING · BUILD CHALLENGE","Rebuild the aqueduct",
      "The crossing needs a stable, sealed water line. Choose the repair actions in the correct order; work stays saved if you leave.",
      [{text:"↩ Return to the canyon",action:()=>{save();closeModal();}}],
      root=>draw(root));
  }
  function cisternChallenge(){
    if(state.cisternSafetyPassed){releaseChallenge();return;}
    modal("FINAL INSPECTION","Is the repaired water safe?",
      (state.cisternMistake?"Clear water can still contain invisible contamination. ":"")+"Water is reaching the cistern. What must the team do before distributing it to households?",
      [{text:"Test water quality and follow local treatment and monitoring procedures",primary:true,action:()=>{
        state.cisternSafetyPassed=true;save();refreshUI();releaseChallenge();
      }},{text:"If the water looks clear, it must be safe",action:()=>{
        if(!state.cisternMistake)mistakeCost(5);
        state.cisternMistake=true;
        cue("mistake");
        toast("Appearance does not prove drinking-water safety. Test and treat the water before use.");
        cisternChallenge();save();
      }},{text:"Return to the canyon",action:closeModal}]);
  }
  function releaseChallenge(){
    if(!state.active||state.finished||!state.done.has("span")||!state.cisternSafetyPassed)return;
    const owner=state;
    let version=0,render=()=>{};
    const valid=()=>state===owner&&state.active&&state.modal&&state.modalVersion===version&&!state.finished;
    modal("SUNSTONE CISTERN · FINAL PUZZLE","Unlock the reservoir",
      "Use the 5-litre and 3-litre chambers to measure exactly 4 litres in the larger one. Then open the release gate to bring the water home.",
      [{text:"💧 Open the release gate",primary:true,action:()=>{
        if(state.releaseBasins[0]!==4){
          render("The gate is still locked. You need exactly 4 L in the larger chamber. Try filling and pouring, or ask Nia for a hint.");
          cue("warning");return;
        }
        closeModal();completeQuest("cistern",430);finish();
      }},{text:"Nia’s hint",action:()=>{
        state.releaseHint=true;save();render("Nia’s field note is open below the controls.");
      }},{text:"↩ Return to the canyon",action:()=>{save();closeModal();}}],root=>{
        version=state.modalVersion;
        const board=document.createElement("div");board.className="canyon-release-puzzle";
        const target=document.createElement("div");target.className="canyon-release-target";
        const targetLabel=document.createElement("span");targetLabel.textContent="RELEASE TARGET";
        const targetValue=document.createElement("strong");targetValue.textContent="4 L";
        const targetNote=document.createElement("small");targetNote.textContent="in the 5-litre chamber";
        target.append(targetLabel,targetValue,targetNote);board.append(target);
        const chambers=document.createElement("div");chambers.className="canyon-release-chambers";
        const meters=[],levels=[],values=[];
        for(const capacity of [5,3]){
          const card=document.createElement("div");card.className="canyon-release-chamber";
          const label=document.createElement("strong");label.textContent=capacity+"-LITRE CHAMBER";
          const meter=document.createElement("div");meter.className="canyon-release-meter";
          meter.setAttribute("role","meter");meter.setAttribute("aria-label",capacity+"-litre chamber water level");
          meter.setAttribute("aria-valuemin","0");meter.setAttribute("aria-valuemax",String(capacity));
          const level=document.createElement("span");level.className="canyon-release-water";
          meter.append(level);
          if(capacity===5){
            const mark=document.createElement("span");mark.className="canyon-release-mark";mark.textContent="4 L TARGET";
            mark.setAttribute("aria-hidden","true");meter.append(mark);
          }
          const value=document.createElement("strong");value.className="canyon-release-value";
          card.append(label,meter,value);chambers.append(card);
          meters.push(meter);levels.push(level);values.push(value);
        }
        board.append(chambers);
        const guide=document.createElement("p");guide.className="canyon-release-guide";
        guide.textContent="Fill a chamber, pour until the other is full or the source is empty, or empty it back to the supply. Experiment freely—there is no energy penalty.";
        board.append(guide);
        const controls=document.createElement("div");controls.className="canyon-release-controls";
        const buttons=[];
        const actions=[
          ["fill-large","Fill 5 L",()=>{state.releaseBasins[0]=5;}],
          ["fill-small","Fill 3 L",()=>{state.releaseBasins[1]=3;}],
          ["pour-large","Pour 5 L → 3 L",()=>{
            const amount=Math.min(state.releaseBasins[0],3-state.releaseBasins[1]);
            state.releaseBasins[0]-=amount;state.releaseBasins[1]+=amount;
          }],
          ["pour-small","Pour 3 L → 5 L",()=>{
            const amount=Math.min(state.releaseBasins[1],5-state.releaseBasins[0]);
            state.releaseBasins[1]-=amount;state.releaseBasins[0]+=amount;
          }],
          ["return-large","Empty 5 L → supply",()=>{state.releaseBasins[0]=0;}],
          ["return-small","Empty 3 L → supply",()=>{state.releaseBasins[1]=0;}],
          ["reset","Start this puzzle over",()=>{state.releaseBasins=[0,0];}]
        ];
        for(const [key,label,action] of actions){
          const button=document.createElement("button");button.type="button";button.textContent=label;
          button.dataset.releaseAction=key;
          button.addEventListener("click",()=>{
            if(!valid())return;
            action();sound(480,.05);save();render();
          });controls.append(button);buttons.push(button);
        }
        const status=document.createElement("p");status.className="canyon-release-status";
        status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.setAttribute("aria-atomic","true");
        const hint=document.createElement("p");hint.className="canyon-release-hint";
        hint.textContent="Nia’s note: Fill 5 L → pour into 3 L (2 L remain). Return the 3 L to supply → pour those 2 L into it. Fill 5 L again → pour into the smaller chamber until it is full. Exactly 4 L remain in the larger one!";
        board.append(controls,status,hint);root.append(board);
        render=message=>{
          const [a,b]=state.releaseBasins;
          for(let i=0;i<2;i++){
            const value=state.releaseBasins[i],capacity=[5,3][i];
            levels[i].style.height=value/capacity*100+"%";
            values[i].textContent=value+" / "+capacity+" L";
            meters[i].setAttribute("aria-valuenow",String(value));meters[i].setAttribute("aria-valuetext",value+" of "+capacity+" litres");
          }
          const disabled=[a===5,b===3,a===0||b===3,b===0||a===5,a===0,b===0,a===0&&b===0];
          buttons.forEach((button,i)=>{button.disabled=disabled[i];});
          hint.hidden=!state.releaseHint&&!mode().hints;
          board.classList.toggle("is-ready",a===4);
          status.textContent=message||(a===4?"✓ Exactly 4 L! Open the release gate to restore the canyon.":
            "5-litre chamber: "+a+" L · 3-litre chamber: "+b+" L. Target: 4 L in the larger chamber.");
        };
        refreshDifficulty=()=>render();render();
      });
  }
  function finish(){
    if(state.finished||questOrder.some(key=>!state.done.has(key)))return;
    state.finished=true;state.active=false;state.score+=Math.round(state.energy)*2;
    state.celebrationStart=performance.now();
    world?.recenterCamera?.();
    $("canyonToast").hidden=true;
    cue("victory");
    progress?.complete("canyon");refreshUI();
    showCelebration();
  }
  function showCelebration(){
    if(!state.finished)return;
    modal("✦ CHAPTER 02 COMPLETE · COAST UNLOCKED","You brought the water home!",
      "Clean water flows through Sunstone Canyon again. You rebuilt the aqueduct, passed the safety inspection, and unlocked the reservoir. The canyon is alive again! Total impact: "+
      state.score.toLocaleString()+" points.",
      [{text:"◈ Return to chapter selection",action:goHome},
       {text:"↻ Replay Forgotten Canyon",action:()=>{closeModal();launch(true);}},
       {text:"💧 Watch the water flow",action:()=>{
         closeModal();$("canyonViewResults").focus({preventScroll:true});
       }},{text:"🌊 Continue to Stormbreak Coast",primary:true,action:()=>{suspend();window.TrailCoast?.launch();}}],root=>{
         const scene=document.createElement("div");scene.className="canyon-victory-scene";
         scene.setAttribute("aria-hidden","true");
         for(const name of ["sun","cliff cliff-left","cliff cliff-right","cistern","spout","stream","pool","plant plant-left","plant plant-right"]){
           const part=document.createElement("span");part.className="victory-"+name;
           scene.append(part);
         }
         for(let i=0;i<14;i++){
           const spark=document.createElement("i");spark.className="victory-spark";
           spark.style.left=(5+i*37%90)+"%";spark.style.top=(8+i*23%65)+"%";
           spark.style.animationDelay=-(i*.31)+"s";scene.append(spark);
         }
         const caption=document.createElement("span");caption.className="victory-scene-caption";
         caption.textContent="RESTORED BY YOU";scene.append(caption);
         const note=document.createElement("small");note.className="canyon-victory-note";
         note.textContent="Fictional educational game · Not real-world drinking-water guidance";
         root.append(scene,note);
       });
  }
  function formatTime(t){const sec=Math.floor(t);return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");}
  function refreshUI(){
    $("canyonModeLabel").textContent=mode().label+" difficulty";
    const n=state.done.size,next=questOrder.find(key=>!state.done.has(key));
    $("canyonProgressLabel").textContent=n+" / 5 completed";
    $("canyonProgressFill").style.width=n/5*100+"%";
    $("canyonSubtitle").textContent=state.finished?"Canyon restored — chapter complete!":
      state.cisternSafetyPassed?"Final puzzle: measure 4 L at the cistern to release the water.":
      next?"Next mission: "+goals[next].title:"The canyon water system is restored.";
    $("canyonEnergy").textContent="⚡ "+Math.ceil(state.energy)+"% energy";
    $("canyonScore").textContent="✦ "+state.score.toLocaleString()+" impact";
    $("canyonTimer").textContent="◷ "+formatTime(state.elapsed);
    $("canyonCelebration").hidden=!state.finished||state.modal||$("canyonScreen").hidden;
    const quests=$("canyonQuestList"),dest=$("canyonDestinations");
    const questStamp=[...state.done].sort().join("|");
    if(state.questStamp!==questStamp){
      state.questStamp=questStamp;
      quests.replaceChildren();dest.replaceChildren();
    for(const [key,goal] of Object.entries(goals)){
      const item=document.createElement("div");item.className="canyon-quest"+(state.done.has(key)?" done":"");
      const icon=document.createElement("span");icon.className="canyon-quest-icon";icon.textContent=state.done.has(key)?"✓":goal.icon;
      const body=document.createElement("div");
      const title=document.createElement("strong");title.textContent=goal.title;
      const detail=document.createElement("small");detail.textContent=goal.detail;
      body.append(title,detail);item.append(icon,body);quests.append(item);
      const button=document.createElement("button");button.type="button";button.className="canyon-destination"+(state.done.has(key)?" done":"");
      button.textContent=(state.done.has(key)?"✓ ":"↗ ")+goal.title;
      button.addEventListener("click",()=>pathTo(goal));dest.append(button);
    }
    const restBtn=document.createElement("button");restBtn.type="button";restBtn.className="canyon-destination";
    restBtn.textContent="⛺ Shaded rest shelter · +34 energy";restBtn.addEventListener("click",()=>pathTo(rest));dest.append(restBtn);
    }
    const nearby=closest();state.nearby=nearby;
    $("canyonPrompt").hidden=!nearby||!state.active||state.paused||state.modal;
    if(nearby)$("canyonPromptText").textContent=nearby==="rest"?"Rest at shelter":goals[nearby].title;
  }
  function update(dt){
    if(!state.active||state.paused||state.modal)return;
    let dx=0,dy=0;
    if(state.keys.has("arrowleft")||state.keys.has("a"))dx--;
    if(state.keys.has("arrowright")||state.keys.has("d"))dx++;
    if(state.keys.has("arrowup")||state.keys.has("w"))dy--;
    if(state.keys.has("arrowdown")||state.keys.has("s"))dy++;
    const manual=dx!==0||dy!==0;
    if(manual)state.path=[];
    else if(state.path.length){
      let target=state.path[0];
      if(pointDistance(state,target)<2){state.path.shift();target=state.path[0];}
      if(target){dx=target.x-state.x;dy=target.y-state.y;}
    }
    const len=Math.hypot(dx,dy);
    if(len){
      const speed=state.keys.has("shift")?250:185;
      const step=Math.min(speed*dt,manual?speed*dt:Math.max(0,len));
      dx=dx/len*step;dy=dy/len*step;
      let nx=state.x+dx,ny=state.y+dy;
      if(!blocked(nx,state.y))state.x=nx;
      if(!blocked(state.x,ny))state.y=ny;
      spendEnergy(dt*(state.keys.has("shift")?.24:.12));
      if(state.energy<=12 && state.elapsed%20<dt)toast("Low energy · rest at the shelter.");
    }
    state.elapsed+=dt;
    if(state.elapsed-state.lastSave>7)save();
    if(state.toast&&performance.now()>state.toastUntil){$("canyonToast").hidden=true;state.toast="";}
    if(state.elapsed-(state.lastUI||0)>.28){
      state.lastUI=state.elapsed;refreshUI();
    }
  }
  function drawFallback(){
    const c=ctx;c.clearRect(0,0,W,H);
    const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,"#f0c68c");g.addColorStop(.6,"#bd785f");g.addColorStop(1,"#896262");c.fillStyle=g;c.fillRect(0,0,W,H);
    // Rock strata, shadowed gorge, winding river and cross-canyon walkway.
    for(let i=0;i<38;i++){
      const x=i*149%W,y=i*91%H,r=30+i%5*14;
      c.fillStyle=i%2?"#de9a6d45":"#824e5e45";c.beginPath();c.ellipse(x,y,r,r*.62,i*.2,0,Math.PI*2);c.fill();
    }
    c.fillStyle="#6b4a50";c.fillRect(456,0,110,H);
    c.fillStyle="#58bbbe";c.fillRect(477,0,65,H);
    for(let i=0;i<42;i++){c.fillStyle="#caecde9a";c.fillRect(489+i*31%39,i*47%H,3,17);}
    c.fillStyle="#855a42";c.fillRect(438,319,147,69);
    for(let x=447;x<581;x+=17){c.fillStyle="#daac76";c.fillRect(x,321,11,65);}
    c.strokeStyle="#f8d595";c.lineWidth=13;c.lineCap="round";
    const paths=[[[165,270],[305,455],[442,350]],[[390,165],[420,280],[440,350]],[[571,350],[700,365],[820,175]]];
    for(const pts of paths){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
    // A dry outlet becomes a flowing channel only after the safety inspection.
    const reveal=reducedMotion()?1:clamp(celebrationTime()/2,0,1);
    c.strokeStyle="#896758";c.lineWidth=21;c.beginPath();c.moveTo(830,193);c.lineTo(875,245);c.lineTo(890,302);c.stroke();
    c.beginPath();c.ellipse(890,320,44,30,0,0,Math.PI*2);c.fillStyle="#896758";c.fill();
    if(state.finished){
      c.save();c.strokeStyle="#67e5e1";c.lineWidth=13;
      c.setLineDash([170*reveal,170]);c.beginPath();c.moveTo(830,193);c.lineTo(875,245);c.lineTo(890,302);c.stroke();
      c.setLineDash([]);c.fillStyle="#49c8cc";
      c.beginPath();c.ellipse(890,320,40*Math.max(.02,reveal),26*Math.max(.02,reveal),0,0,Math.PI*2);c.fill();
      if(!reducedMotion()){
        c.strokeStyle="#e1fff1";c.lineWidth=3;c.setLineDash([6,17]);c.lineDashOffset=-celebrationTime()*25;
        c.beginPath();c.moveTo(830,193);c.lineTo(875,245);c.lineTo(890,302);c.stroke();
        c.setLineDash([]);c.beginPath();c.ellipse(890,320,12+celebrationTime()*9%26,7+celebrationTime()*5%15,0,0,Math.PI*2);c.stroke();
      }
      c.restore();
    }
    for(const [x,y] of [[851,278],[937,317],[853,353],[920,361]]){
      c.strokeStyle=state.finished?"#35896c":"#99805a";c.lineWidth=5;
      c.beginPath();c.moveTo(x,y);c.lineTo(x-7,y-15);c.moveTo(x,y);c.lineTo(x+9,y-20);c.stroke();
      if(state.finished){c.fillStyle="#74c482";c.beginPath();c.ellipse(x-9,y-16,7,4,.6,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(x+9,y-20,8,5,-.6,0,Math.PI*2);c.fill();}
    }
    for(const [key,o] of [...Object.entries(goals),["rest",rest]]){
      c.beginPath();c.arc(o.x,o.y,19,0,Math.PI*2);
      c.fillStyle=state.done.has(key)?"#75bf93":"#fce7a4";c.fill();
      c.strokeStyle="#283d42";c.lineWidth=3;c.stroke();
      c.font=`20px ${FONT_FAMILY}`;c.textAlign="center";c.fillStyle="#fff";c.fillText(o.icon,o.x,o.y+7);
      c.font=`800 13px ${FONT_FAMILY}`;c.fillStyle="#243a40";c.fillText(o.title,o.x,o.y-26);
    }
    // The lightweight fallback keeps the same dark-skinned, teal-clad explorer
    // and a single yellow jug on his back (above the torso in this top view).
    c.fillStyle="#f5c928";c.fillRect(state.x-9,state.y-17,18,17);
    c.beginPath();c.ellipse(state.x,state.y+2,12,13,0,0,Math.PI*2);c.fillStyle="#278e88";c.fill();
    c.beginPath();c.arc(state.x,state.y-7,8,0,Math.PI*2);c.fillStyle="#603820";c.fill();
    c.fillStyle="#191719";c.fillRect(state.x-7,state.y-15,14,5);
  }
  function buildRestoredWater(THREE,scene){
    // A visible outlet, stone channel and garden beside the final cistern.
    // This is part of the ending, so it stays visible with effects disabled.
    const group=new THREE.Group();scene.add(group);
    const stone=new THREE.MeshStandardMaterial({color:0xd9b68b,roughness:.95});
    const copper=new THREE.MeshStandardMaterial({color:0x9a9f82,metalness:.4,roughness:.5});
    const clean=new THREE.MeshStandardMaterial({color:0x63e1de,emissive:0x105c67,
      emissiveIntensity:.38,roughness:.22,metalness:.12,transparent:true,opacity:.9});
    clean.name="Canyon restored water";
    const foam=new THREE.MeshBasicMaterial({color:0xe4fff3,transparent:true,opacity:.8});
    const leaves=new THREE.MeshStandardMaterial({color:0x72bc7b,roughness:1,flatShading:true});
    const mesh=(geometry,material,x,y,z)=>{
      const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);group.add(o);return o;
    };
    const x=wX(820),z=wZ(175);
    const spout=mesh(new THREE.CylinderGeometry(.18,.18,.85,12),copper,x,.97,z+1.35);
    spout.rotation.x=Math.PI/2;
    mesh(new THREE.CylinderGeometry(.21,.21,.15,12),copper,x,.94,z+1.77).rotation.x=Math.PI/2;
    const start={x,z:z+1.80},end={x:x+2.8,z:z+5.4};
    const length=Math.hypot(end.x-start.x,end.z-start.z),angle=Math.atan2(end.x-start.x,end.z-start.z);
    const trough=new THREE.Group();trough.position.set(start.x,.07,start.z);trough.rotation.y=angle;group.add(trough);
    const troughPart=(material,dx,y,width,height)=>{
      const part=new THREE.Mesh(new THREE.BoxGeometry(width,height,length),material);
      part.position.set(dx,y,length/2);trough.add(part);return part;
    };
    troughPart(stone,0,0,.87,.11);
    for(const side of [-1,1])troughPart(stone,side*.43,.13,.12,.30);
    const channel=troughPart(clean,0,.13,.72,.055);
    const pool=mesh(new THREE.CylinderGeometry(1.35,1.45,.22,28),stone,end.x,.04,end.z+.55);
    const poolWater=mesh(new THREE.CircleGeometry(1.24,32),clean,end.x,.165,end.z+.55);
    poolWater.rotation.x=-Math.PI/2;
    const stream=mesh(new THREE.CylinderGeometry(.115,.17,.78,12),clean,x,.55,start.z);
    const ripples=[];
    for(let i=0;i<3;i++){
      const ring=mesh(new THREE.TorusGeometry(.29,.016,5,32),foam,end.x,.18+i*.002,end.z+.55);
      ring.rotation.x=-Math.PI/2;ripples.push(ring);
    }
    const glints=[];
    for(let i=0;i<7;i++){
      const glint=new THREE.Mesh(new THREE.BoxGeometry(.38,.012,.09),foam);
      trough.add(glint);glints.push(glint);
    }
    const plants=[];
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2,r=1.65+(i%2)*.3;
      const plant=new THREE.Group();plant.position.set(end.x+Math.cos(a)*r,.13,end.z+.55+Math.sin(a)*r);
      for(let j=0;j<3;j++){
        const leaf=new THREE.Mesh(new THREE.ConeGeometry(.18,.65,5),leaves);
        leaf.position.set((j-1)*.14,.22,0);leaf.rotation.z=(j-1)*-.36;plant.add(leaf);
      }
      group.add(plant);plants.push(plant);
    }
    const sparkles=[];
    for(let i=0;i<18;i++)sparkles.push(mesh(new THREE.OctahedronGeometry(.045,0),foam,0,0,0));
    return {
      update(){
        const restored=state.finished,reduced=reducedMotion(),t=celebrationTime();
        const fill=reduced?1:clamp((t-.35)/1.8,0,1);
        stream.visible=channel.visible=poolWater.visible=restored;
        stream.scale.setScalar(reduced?1:clamp(t/.45,0,1));
        channel.scale.z=Math.max(.001,fill);channel.position.z=length*fill/2;
        poolWater.scale.setScalar(reduced?1:Math.max(.001,clamp((t-1.4)/1.8,0,1)));
        for(let i=0;i<ripples.length;i++){
          const ring=ripples[i];ring.visible=restored;
          ring.scale.setScalar(reduced?1+i:1+((t*.65+i/3)%1)*3);
        }
        for(let i=0;i<glints.length;i++){
          const phase=(t*.32+i/7)%1;
          glints[i].visible=restored&&!reduced&&phase<fill;
          glints[i].position.set(Math.sin(i*2)*.12,.17,phase*length);
        }
        for(const plant of plants){
          plant.visible=restored;
          plant.scale.setScalar(reduced?1:clamp((t-1.8)/1.4,0,1));
        }
        for(let i=0;i<sparkles.length;i++){
          const spark=sparkles[i],phase=(t*.35+i/18)%1;
          spark.visible=restored&&!reduced&&t<7;
          spark.position.set(x+Math.sin(i*2.4)*2.4,.6+phase*3.5,start.z+Math.cos(i*2.4)*2.4);
          spark.rotation.z=t+i;
        }
      },
      dispose(){
        group.traverse(o=>o.geometry?.dispose());
        for(const material of [stone,copper,clean,foam,leaves])material.dispose();
        scene.remove(group);
      }
    };
  }
  async function buildWorld(){
    if(world||creating)return;
    creating=true;
    try{
      const THREE=await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
      await window.TrailTypography?.ready;
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x93b9c9);
      // Widen the entire traversable 3D valley without changing quest logic or save coordinates.
      const worldSpread=1.42;scene.scale.set(worldSpread,1,worldSpread);
      scene.fog=new THREE.FogExp2(0xe0b897,.0068);
      const camera=new THREE.PerspectiveCamera(47,1000/610,.1,300);
      camera.position.set(7.4,10.5,13.6);camera.lookAt(0,0,0);
      // Honor the player's saved Valley graphics profile in Canyon as well.
      let graphics={preset:"high",resolution:1.1,shadows:true,effects:true};
      try{graphics={...graphics,...(JSON.parse(localStorage.getItem("thirstTrailGraphics")||"null")||{})};}
      catch{/* use safe defaults when browser storage is disabled */}
      let graphicsQuality=["low","medium","high","ultra"].includes(graphics.preset)?
        graphics.preset:"high";
      const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:"high-performance"});
      const requestedScale=clamp(Number(graphics.resolution)||1,.65,1.5);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7)*requestedScale);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
      renderer.shadowMap.enabled=graphics.shadows!==false;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const cinematic=window.TrailCinematic?.create(THREE,{renderer,scene,camera,chapter:"canyon"});
      const surfaces=cinematic?.surfaces;
      const dom=renderer.domElement;dom.className="canyon-webgl";
      dom.style.cssText="display:block;width:100%;height:auto;aspect-ratio:1000/610;touch-action:none;outline:none";
      dom.tabIndex=0;
      const parent=canvas.parentElement;parent.insertBefore(dom,canvas.nextSibling);
      canvas.style.display="none";
      const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.87,metalness,flatShading:true});
      const rock=[mat(0xd58c68),mat(0xaa6454),mat(0xeeaf77),mat(0x86535a)];
      const sand=mat(0xd8aa76),path=mat(0xf1d2a0),timber=mat(0x86624b),iron=mat(0x768d90,.25),teal=mat(0x5a9e9b);
      const water=new THREE.MeshStandardMaterial({name:"Canyon river water",color:0x50b1b9,roughness:.31,metalness:.05,transparent:true,opacity:.91});
      const hemi=new THREE.HemisphereLight(0xdff3f5,0x8d6656,1.55);scene.add(hemi);
      const sun=new THREE.DirectionalLight(0xffd6a0,3.2);
      sun.position.set(-18,29,12);sun.castShadow=renderer.shadowMap.enabled;
      const shadowSize=graphicsQuality==="low"?512:graphicsQuality==="medium"?1024:
        graphicsQuality==="high"?1536:2048;
      sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.camera.left=-36;sun.shadow.camera.right=36;
      sun.shadow.camera.top=29;sun.shadow.camera.bottom=-29;sun.shadow.bias=-.0003;
      sun.shadow.normalBias=.025;sun.shadow.radius=2;
      scene.add(sun);const fill=new THREE.DirectionalLight(0xa9dadd,.65);fill.position.set(16,12,-9);scene.add(fill);
      const put=(geometry,material,x,y,z,shadow=true)=>{
        const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);
        o.castShadow=shadow;o.receiveShadow=true;scene.add(o);return o;
      };
      const box=(m,x,y,z,a,b,c)=>put(new THREE.BoxGeometry(a,b,c),m,x,y,z);
      // Two high plateaus border a sunken turquoise river, creating a true
      // playable canyon instead of a reskinned copy of Greenwater Valley.
      box(sand,-12.1,-.63,0,20.8,1.15,32.2);
      box(sand,12.2,-.63,0,20.8,1.15,32.2);
      box(rock[3],0,-2.10,0,5.3,3.9,33);
      box(water,0,-.22,0,3.5,.06,33);
      for(const side of [-1,1]){
        for(let i=0;i<32;i++){
          const z=-16+i*1.05,height=.95+(i*7%7)*.2;
          const cliff=box(rock[i%4],side*(2.60+(i%3)*.16),-.45-height/2,z,.58,height,1.13);
          cliff.rotation.y=(i%5-2)*.08;
          const ledge=box(rock[(i+1)%4],side*2.95,-.04,z,.71,.11,.97);
        }
      }
      // Terraced sandstone mesas and layered cliffs at the skyline.
      let seed=31415;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const skylineFallback=[];
      for(let i=0;i<44;i++){
        let x=(i%2?-1:1)*(10+rng()*24);const z=-24+rng()*52;
        const radius=1.1+rng()*2.5,height=2.5+rng()*7;
        // Skyline scenery belongs beyond the walkable floor. The former seeded
        // scatter placed a solid mesa directly over Surveyor Nia's mission.
        if(Math.abs(x)-radius<22.8)x=Math.sign(x)*(22.8+radius);
        const column=put(new THREE.CylinderGeometry(radius*.70,radius,height,7,1),rock[i%4],x,height/2-.20,z,false);
        column.rotation.y=rng()*6.28;
        skylineFallback.push(column);
        for(let layer=0;layer<3;layer++)
          skylineFallback.push(put(new THREE.CylinderGeometry(radius*(.82+layer*.065),radius*(.82+layer*.065),.15,7),
            rock[(i+layer+1)%4],x,layer*height/4+.2,z,false));
      }
      // Distinct winding desert roads.
      const roads=[
        [[165,270],[305,455],[438,350]],
        [[390,223],[420,280],[438,350]],
        [[579,350],[625,397],[700,397],[772,397],[820,235]]
      ];
      for(const stops of roads)for(let i=0;i<stops.length-1;i++){
        const a=stops[i],b=stops[i+1];
        const x=(wX(a[0])+wX(b[0]))/2,z=(wZ(a[1])+wZ(b[1]))/2;
        const len=Math.hypot(wX(a[0])-wX(b[0]),wZ(a[1])-wZ(b[1]));
        const p=box(path,x,-.035,z,.90,.04,len);
        p.rotation.y=Math.atan2(wX(b[0])-wX(a[0]),wZ(b[1])-wZ(a[1]));
      }
      // Cross-canyon bridge with guard rails.
      const bridgeZ=wZ(354);
      for(let i=0;i<18;i++){
        const plank=box(timber,-3.0+i*.36,.20,bridgeZ,.33,.18,3.2);
        plank.rotation.y=Math.sin(i*.65)*.015;
      }
      for(const [x,tilt] of [[-3.56,1],[3.68,-1]]){
        const ramp=box(timber,x,.115,bridgeZ,.85,.06,3.2);
        ramp.rotation.z=tilt*Math.atan2(.29,.8);
      }
      for(const edge of [-1,1])for(let i=0;i<10;i++){
        box(timber,-3.0+i*.7,.78,bridgeZ+edge*1.54,.12,1.15,.12);
      }
      for(const edge of [-1,1]){
        box(iron,0,1.29,bridgeZ+edge*1.54,6.5,.11,.11);
      }
      // Broken aqueduct and water tank (visually restored after repair).
      const aqueduct=new THREE.Group();scene.add(aqueduct);
      aqueduct.position.set(wX(700),0,wZ(365));
      for(let i=0;i<5;i++){
        const p=new THREE.Mesh(new THREE.BoxGeometry(.32,2.9,.34),rock[1]);
        p.position.set((i-2)*.75,1.05,-.35);p.castShadow=true;aqueduct.add(p);
      }
      const pipeMesh=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,3.85,12),iron);
      pipeMesh.rotation.z=Math.PI/2;pipeMesh.position.set(0,2.38,-.25);aqueduct.add(pipeMesh);
      const broken=new THREE.Mesh(new THREE.BoxGeometry(.36,.42,.62),rock[3]);
      broken.position.set(.52,2.38,-.25);aqueduct.add(broken);
      // Large reservoir tank with three pressure valve wheels.
      const valvesGroup=new THREE.Group();scene.add(valvesGroup);
      valvesGroup.position.set(wX(390),0,wZ(165));
      const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.25,2.7,16),teal);
      tank.position.y=1.4;tank.castShadow=true;valvesGroup.add(tank);
      for(let i=0;i<3;i++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.31,.075,6,14),iron);
        ring.position.set(-.7+i*.7,1.25,1.18);valvesGroup.add(ring);
      }
      // Cistern, shaded shelter and desert vegetation.
      put(new THREE.CylinderGeometry(1.18,1.32,2.5,18),teal,wX(820),1.27,wZ(175));
      put(new THREE.ConeGeometry(1.5,.75,9),rock[2],wX(820),2.9,wZ(175));
      for(const x of [wX(300),wX(280)])box(timber,x,1.1,wZ(510),.16,2.25,.16);
      box(rock[2],wX(290),2.23,wZ(510),2.2,.20,2.2);
      // Shrubs and cactus-like succulents scattered outside the travel path.
      const cactus=mat(0x4c8b65),leaves=mat(0x8c9959);
      for(let i=0;i<105;i++){
        const side=i%2?-1:1,x=side*(3.4+rng()*15.4),z=-13.4+rng()*27;
        if(isWaterGarden(x,z))continue;
        if(Math.hypot(x-wX(390),z-wZ(165))<2.7||Math.hypot(x-wX(820),z-wZ(175))<2.7)continue;
        const scale=.5+rng()*1.1;
        if(i%3===0){
          put(new THREE.CylinderGeometry(.12,.18,1.45*scale,6),cactus,x,.72*scale,z,false);
          put(new THREE.CylinderGeometry(.09,.11,.54*scale,6),cactus,x+.23*scale,.69*scale,z,false);
        }else{
          put(new THREE.IcosahedronGeometry(.34*scale,0),leaves,x,.20*scale,z,false);
        }
      }
      // Expanded-world detail pass: sunlit stone clusters, dry grass and historic trail posts.
      const grass=mat(0xaab47b),sandstone=mat(0xf1bf87);
      for(let i=0;i<175;i++){
        const side=i%2?-1:1;
        const x=side*(3.5+rng()*17.5),z=-14.5+rng()*29;
        if(isWaterGarden(x,z))continue;
        const stone=put(new THREE.DodecahedronGeometry(.12+rng()*.31,0),
          i%3===0?rock[1]:sandstone,x,.12,z,false);
        stone.rotation.y=rng()*Math.PI;stone.scale.y=.52+rng()*.85;
        if(i%2===0){
          for(let blade=0;blade<3;blade++){
            const tuft=put(new THREE.ConeGeometry(.05,.43+rng()*.34,4),grass,
              x+(blade-1)*.13,.25,z+.18,false);
            tuft.rotation.z=(blade-1)*.29;
          }
        }
      }
      // Landmark posts are visible from farther away, giving the longer trek a clear direction.
      for(const destination of Object.values(goals)){
        const x=wX(destination.x)+.9,z=wZ(destination.y)+.85;
        const post=box(timber,x,.85,z,.14,1.7,.15);
        post.castShadow=true;
        box(sandstone,x,1.67,z,.72,.34,.11);
      }
      // Real scenic geometry/material upgrades are kept separate from collisions.
      // A failed decorative pass must never prevent the playable 3D game from loading.
      let canyonArt=null;
      try{
        canyonArt=window.ThirstCanyonVisuals?.build(THREE,{
          scene,camera,worldSpread,getState:()=>state,isWaterGarden,surfaces,getGraphics:()=>graphics
        })||null;
      }catch(error){
        console.warn("Canyon advanced scenery unavailable; using safe original terrain.",error);
      }
      if(canyonArt)for(const mesh of skylineFallback)mesh.visible=false;
      const canyonScenery=window.TrailScenicAssets?.mount?.(THREE,{
        parent:scene,chapter:"canyon",wx:wX,wz:wZ,getGraphics:()=>graphics
      });
      surfaces?.apply(timber,"wood",[1,1],0xc1a080,.28);
      for(const m of rock)surfaces?.apply(m,"rock",[1,1],null,.28);
      const restoredWater=buildRestoredWater(THREE,scene);
      restoredWater.update();
      const canyonEffects=[];
      scene.traverse(o=>{
        if(o.isPoints||(o.isMesh&&o.geometry?.type==="IcosahedronGeometry"&&o.material?.transparent&&o.material.opacity<.4))
          canyonEffects.push(o);
      });
      function applyGraphicsSettings(next={}){
        graphics={...graphics,...next};
        graphicsQuality=["low","medium","high","ultra"].includes(graphics.preset)?graphics.preset:"medium";
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7)*clamp(Number(graphics.resolution)||1,.65,1.5));
        renderer.shadowMap.enabled=graphics.shadows!==false;sun.castShadow=renderer.shadowMap.enabled;
        const size=graphicsQuality==="low"?512:graphicsQuality==="medium"?1024:graphicsQuality==="high"?1536:2048;
        if(sun.shadow.mapSize.x!==size){
          sun.shadow.map?.dispose();sun.shadow.map=null;
          sun.shadow.mapSize.set(size,size);sun.shadow.needsUpdate=true;
        }
        for(const o of canyonEffects)o.visible=graphics.effects!==false;
        cinematic?.configure({...graphics,preset:graphicsQuality});
      }
      applyGraphicsSettings(graphics);
      // Floating, player-facing world mission labels.
      const marks=[];
      for(const [key,obj] of Object.entries(goals)){
        const group=new THREE.Group();group.position.set(wX(obj.x),.16,wZ(obj.y));scene.add(group);
        const gold=new THREE.MeshBasicMaterial({color:0xffd787,transparent:true,opacity:.75});
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.065,6,32),gold);
        ring.rotation.x=-Math.PI/2;ring.position.y=.09;group.add(ring);
        const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,1.4,8),gold);
        pillar.position.y=.90;group.add(pillar);
        // Canvas-backed nameplates remain readable in the distant canyon.
        const tag=document.createElement("canvas");tag.width=384;tag.height=72;
        const tc=tag.getContext("2d");
        if(tc){
          tc.fillStyle="#153d42e6";
          tc.beginPath();tc.roundRect(6,7,372,58,15);tc.fill();
          tc.strokeStyle="#ffe2a8";tc.lineWidth=3;tc.stroke();
          tc.fillStyle="#fff8df";tc.font=`bold 26px ${FONT_FAMILY}`;
          tc.textAlign="center";tc.textBaseline="middle";
          tc.fillText(obj.title,192,36,352);
          const texture=new THREE.CanvasTexture(tag);
          texture.colorSpace=THREE.SRGBColorSpace;
          const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
            map:texture,transparent:true,depthWrite:false,depthTest:false}));
          sprite.scale.set(3.9,.74,1);
          sprite.renderOrder=1000;sprite.position.y=2.65;group.add(sprite);
        }
        marks.push({key,group,ring,pillar});
      }
      // HTML mission tags stay legible above rock formations and aqueduct masonry.
      let missionLabels=null;
      try{
        missionLabels=window.TrailWorldLabels?.create?.(THREE,{camera,canvas:dom,
          labels:marks.map(mark=>({id:mark.key,title:goals[mark.key].title,anchor:mark.group,offset:[0,3.0,0]}))})||null;
      }catch(error){console.warn("Canyon mission label overlay unavailable; retaining sprites.",error);}
      // Character: local procedural fallback renders immediately.
      const player=new THREE.Group();scene.add(player);
      // Character remains human-sized while landscape and landmarks spread apart.
      player.scale.set(1/worldSpread,1,1/worldSpread);
      const jacket=mat(0x278e88),skin=mat(0x603820),hair=mat(0x191719),boots=mat(0x293b50);
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.31,.63,5,10),jacket);
      torso.position.y=1.2;torso.castShadow=true;player.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.29,12,9),skin);head.position.y=2.05;player.add(head);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.29,12,8),hair);cap.scale.y=.40;cap.position.y=2.27;player.add(cap);
      const limbs=[];
      for(const side of [-1,1]){
        const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.50,4,7),boots);
        leg.position.set(side*.19,.54,0);player.add(leg);limbs.push(leg);
        const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.48,5,9),jacket);
        arm.position.set(side*.44,1.24,.03);arm.rotation.z=side*.16;arm.castShadow=true;
        player.add(arm);limbs.push(arm);
        const hand=new THREE.Mesh(new THREE.SphereGeometry(.115,9,8),skin);
        hand.position.set(side*.49,.86,.05);player.add(hand);
      }
      const pack=new THREE.Mesh(new THREE.BoxGeometry(.60,.79,.34),mat(0xf5c928));
      pack.position.set(0,1.29,-.37);player.add(pack);
      // Readable face, goggles, jacket trim and backpack straps for the closer follow camera.
      const eyeMat=mat(0x1c2a33),strapMat=mat(0x40372b);
      for(const side of [-1,1]){
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.038,7,6),eyeMat);
        eye.position.set(side*.12,2.10,.258);player.add(eye);
        const strap=new THREE.Mesh(new THREE.BoxGeometry(.095,.55,.05),strapMat);
        strap.position.set(side*.22,1.32,.30);player.add(strap);
      }
      // Reuse the exact authored explorer asset and joint names used in Chapter 1.
      // The procedural version stays as a reliable offline/model-load fallback.
      const fallbackParts=[...player.children];
      let explorerRig=null,explorerDisposed=false;
      const explorerStatus={status:"fallback"};
      async function loadCanyonExplorer(){
        try{
          let asset;
          if(window.ThirstExplorer)asset={scene:window.ThirstExplorer.create(THREE)};
          else {
            const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
            if(explorerDisposed)return;
            asset=await new GLTFLoader().loadAsync("./assets/characters/explorer.gltf");
          }
          if(explorerDisposed)return;
          const source=asset?.scene?.getObjectByName("ExplorerCharacter");
          if(!source)throw Error("Authored explorer node was not found");
          const candidate=window.ThirstExplorer?source:source.clone(true);
          const names=[
            "ExplorerBody","ExplorerHead","ExplorerEyes","ExplorerArmLeft",
            "ExplorerArmRight","ExplorerElbowLeft","ExplorerElbowRight",
            "ExplorerLegLeft","ExplorerLegRight","ExplorerKneeLeft",
            "ExplorerKneeRight","ExplorerScarfTail","ExplorerPackFlap"
          ];
          const rig={};
          for(const name of names){
            const part=candidate.getObjectByName(name);
            if(!part)throw Error("Missing shared explorer joint: "+name);
            rig[name]=part;
          }
          let parts=0;
          candidate.traverse(o=>{
            if(o.isMesh){parts++;o.castShadow=true;o.receiveShadow=true;}
          });
          if(parts<6)throw Error("Explorer model has too few meshes");
          player.add(candidate);
          cinematic?.character(candidate);
          fallbackParts.forEach(part=>part.visible=false);
          explorerRig=rig;explorerRig.model=candidate;explorerStatus.status="ready";
          console.info("Forgotten Canyon: shared animated 3D explorer loaded.");
        }catch(error){
          explorerStatus.status="fallback";
          console.warn("Canyon explorer model unavailable; keeping playable character.",error);
        }
      }
      void loadCanyonExplorer();
      // Drag-to-explore is independent of character movement and mission progression.
      const pan=new THREE.Vector3(),drag={id:null,x:0,y:0,startX:0,startY:0,moved:false,suppress:false};
      let zoom=1;
      const recenterCamera=()=>{pan.set(0,0,0);zoom=1;};
      dom.style.cursor="grab";
      dom.addEventListener("pointerdown",event=>{
        if(event.button!==0||event.pointerType==="touch"||!state.active||state.modal||state.paused)return;
        drag.id=event.pointerId;drag.startX=drag.x=event.clientX;
        drag.startY=drag.y=event.clientY;drag.moved=false;drag.suppress=false;
        dom.setPointerCapture?.(event.pointerId);
      });
      dom.addEventListener("pointermove",event=>{
        if(event.pointerId!==drag.id||!state.active||state.modal||state.paused)return;
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        drag.x=event.clientX;drag.y=event.clientY;
        if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<7)return;
        drag.moved=true;event.preventDefault();dom.style.cursor="grabbing";
        const height=Math.max(1,dom.getBoundingClientRect().height);
        const scale=2*Math.tan(camera.fov*Math.PI/360)*Math.max(8,camera.position.distanceTo(cameraTarget))/height*1.35*clamp(Number(graphics.sensitivity)||1,.5,1.8);
        const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
        const forward=new THREE.Vector3(cameraTarget.x-camera.position.x,0,cameraTarget.z-camera.position.z).normalize();
        pan.addScaledVector(right,-dx*scale).addScaledVector(forward,dy*scale);
      });
      const finishDrag=event=>{
        if(drag.id!==event.pointerId)return;
        if(drag.moved)drag.suppress=true;
        drag.id=null;dom.style.cursor="grab";
        if(dom.hasPointerCapture?.(event.pointerId))dom.releasePointerCapture(event.pointerId);
      };
      dom.addEventListener("pointerup",finishDrag);
      dom.addEventListener("pointercancel",finishDrag);
      dom.addEventListener("lostpointercapture",event=>{if(drag.id===event.pointerId)finishDrag(event);});
      dom.addEventListener("contextmenu",event=>event.preventDefault());
      dom.addEventListener("wheel",event=>{
        if(!state.active||state.modal||state.paused)return;
        if(!event.altKey || event.ctrlKey || event.metaKey)return;
        event.preventDefault();zoom=clamp(zoom+(event.deltaY>0?.09:-.09),.72,1.85);
      },{passive:false});
      const cameraTarget=new THREE.Vector3();
      const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
      function select(event){
        if(drag.suppress){drag.suppress=false;return;}
        if(!state.active||state.modal||state.paused)return;
        const rect=dom.getBoundingClientRect();
        pointer.set((event.clientX-rect.left)/rect.width*2-1,
          -(event.clientY-rect.top)/rect.height*2+1);
        raycaster.setFromCamera(pointer,camera);
        const hit=new THREE.Vector3();
        if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit)){
          const p={x:hit.x/worldSpread*24+500,y:hit.z/worldSpread*24+305};
          let best=null,d=65;
          for(const item of [...Object.values(goals),rest]){
            const gap=pointDistance(p,item);if(gap<d){best=item;d=gap;}
          }
          pathTo(best||p);
        }
      }
      dom.addEventListener("click",select);
      if(!state.active&&!(state.finished&&!$("canyonScreen").hidden)){
        explorerDisposed=true;canyonScenery?.dispose();canyonArt?.dispose();restoredWater.dispose();
        cinematic?.dispose();
        renderer.dispose();dom.remove();canvas.style.display="";
        return;
      }
      // Smooth locomotion and heading for the shared rig (keyboard and click-to-walk).
      const characterVisibility=window.ThirstExplorer?.visibility(THREE,scene,player);
      const playerMotion={lastTime:0,lastX:state.x,lastY:state.y,blend:0};
      const reducedMotion=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const desiredCameraPosition=new THREE.Vector3();
      let renderWidth=0,renderHeight=0,cameraFirstFrame=true;
      world={
        dom,renderer,scene,camera,player,limbs,marks,broken,pipeMesh,water,
        recenterCamera,setGraphicsSettings:applyGraphicsSettings,
        resetForLaunch(){
          cameraFirstFrame=true;playerMotion.lastTime=0;
          playerMotion.lastX=state.x;playerMotion.lastY=state.y;playerMotion.blend=0;
        },
        draw(time){
          const width=dom.clientWidth||1000,height=dom.clientHeight||610;
          const targetWidth=Math.max(300,Math.floor(width)),targetHeight=Math.max(180,Math.floor(height));
          if(camera.aspect!==targetWidth/targetHeight){
            camera.aspect=targetWidth/targetHeight;camera.updateProjectionMatrix();
          }
          // CSS dimensions differ from the backing buffer on high-DPI screens.
          // Resize only when layout changes, not on every rendered frame.
          if(renderWidth!==targetWidth||renderHeight!==targetHeight){
            renderer.setSize(targetWidth,targetHeight,false);
            renderWidth=targetWidth;renderHeight=targetHeight;
          }
          const px=wX(state.x),pz=wZ(state.y);
          const delta=playerMotion.lastTime?
            clamp(time-playerMotion.lastTime,0,.05):.016;
          const dx=state.x-playerMotion.lastX,dy=state.y-playerMotion.lastY;
          const actuallyMoving=Math.hypot(dx,dy)>.01;
          playerMotion.lastTime=time;playerMotion.lastX=state.x;playerMotion.lastY=state.y;
          // Don't animate or rotate against an obstacle when keys are held.
          playerMotion.blend+=(Number(actuallyMoving)-playerMotion.blend)*
            (1-Math.exp(-delta*9));
          player.position.set(px,surfaceHeight(state.x,state.y),pz);
          if(actuallyMoving){
            const targetHeading=Math.atan2(dx,dy);
            const angle=((targetHeading-player.rotation.y+3*Math.PI)%(2*Math.PI))-Math.PI;
            player.rotation.y+=angle*(1-Math.exp(-delta*11));
          }
          const moving=actuallyMoving;
          const gait=Math.sin(time*9)*playerMotion.blend*.52;
          for(let i=0;i<limbs.length;i++)
            limbs[i].rotation.x=(i%2?-1:1)*Math.sin(time*9+Math.floor(i/2)*Math.PI)*(.35*playerMotion.blend+.025);
          if(explorerRig){
            const rig=explorerRig;
            rig.ExplorerLegLeft.rotation.x=gait;
            rig.ExplorerLegRight.rotation.x=-gait;
            rig.ExplorerArmLeft.rotation.x=-gait*.8;
            rig.ExplorerArmRight.rotation.x=gait*.8;
            rig.ExplorerKneeLeft.rotation.x=Math.max(0,gait)*-.35;
            rig.ExplorerKneeRight.rotation.x=Math.max(0,-gait)*-.35;
            rig.ExplorerElbowLeft.rotation.x=Math.max(0,-gait)*-.22;
            rig.ExplorerElbowRight.rotation.x=Math.max(0,gait)*-.22;
            rig.ExplorerBody.position.y=moving?Math.abs(Math.sin(time*9))*.06:Math.sin(time*1.4)*.012;
            rig.ExplorerBody.rotation.x=moving?-.035:0;
            rig.ExplorerScarfTail.rotation.z=-.24+Math.sin(time*(moving?9:1.4))*.07;
            rig.ExplorerPackFlap.rotation.x=moving?Math.sin(time*9)*.045:0;
            rig.ExplorerHead.rotation.y=Math.sin(time*.6)*.035;
            rig.ExplorerEyes.scale.y=time%5.3<.12?.15:1;
          }
          // Once travel resumes, follow the explorer so walking never appears frozen offscreen.
          if(explorerRig?.model?.userData.adventure)window.ThirstExplorer.animate(explorerRig.model,{
            time,dt:delta,distance:Math.hypot(dx,dy)*worldSpread/24,running:state.keys.has("shift"),
            interaction:!!state.modal,victory:state.finished,
            reduced:reducedMotion
          });
          if(state.path.length||state.keys.size)pan.set(0,0,0);
          // Clamp the free camera within the entire expanded canyon; player stays put.
          const baseX=px*worldSpread,baseZ=pz*worldSpread;
          if(state.finished){
            // Frame the cistern outlet and its garden after the final answer.
            cameraTarget.set((wX(820)+1.1)*worldSpread,.65,(wZ(175)+3.4)*worldSpread);
          }else{
            cameraTarget.set(clamp(baseX+pan.x,-31,31),.65,clamp(baseZ+pan.z,-23,23));
            pan.x=cameraTarget.x-baseX;pan.z=cameraTarget.z-baseZ;
          }
          desiredCameraPosition.set(cameraTarget.x+7.4*zoom,10.5*zoom,cameraTarget.z+13.6*zoom);
          if(cameraFirstFrame||(state.finished&&reducedMotion)){camera.position.copy(desiredCameraPosition);cameraFirstFrame=false;}
          else camera.position.lerp(desiredCameraPosition,1-Math.exp(-delta*5.65));
          camera.lookAt(cameraTarget);
          for(const m of marks){
            const done=state.done.has(m.key);
            m.group.visible=!state.finished;
            const next=questOrder.find(key=>!state.done.has(key));
            for(const child of m.group.children)if(child.isSprite)child.visible=!missionLabels&&!done&&(m.key===next||state.nearby===m.key);
            m.pillar.visible=!done;m.ring.material.color.set(done?0x70c5a4:0xffd787);
            m.ring.scale.setScalar(reducedMotion||graphics.effects===false?1:1+Math.sin(time*2.2)*.08);
          }
          missionLabels?.update({visible:!state.finished,completed:state.done,
            activeKey:questOrder.find(key=>!state.done.has(key))||null});
          broken.visible=!state.done.has("span");
          water.color.set(state.done.has("cistern")?0x55c4cb:0x50b1b9);
          restoredWater.update();
          canyonScenery?.update({preset:graphics.preset});
          // Keep valve/repair visuals current even when ambient motion is off.
          if(graphics.effects!==false)canyonArt?.update(time);
          else canyonArt?.update(0);
          if(state.finished)characterVisibility?.clear?.();else characterVisibility?.update(camera,delta);
          cinematic?.update(time,{reduced:reducedMotion,effects:graphics.effects!==false});
          if(cinematic)cinematic.render();else renderer.render(scene,camera);
        },
        getExplorerAssetStatus(){return {...explorerStatus};},
        getGraphicsStatus(){return cinematic?.status()||null;},
        dispose(){
          missionLabels?.dispose();
          characterVisibility?.dispose();
          cinematic?.dispose();
          explorerDisposed=true;
          canyonArt?.dispose();
          canyonScenery?.dispose();
          restoredWater.dispose();
          dom.remove();renderer.dispose();canvas.style.display="";
        }
      };
      if(!state.active)world.draw(performance.now()/1000);
    }catch(error){console.warn("Canyon WebGL unavailable, continuing with playable 2D.",error);canvas.style.display=""; }
    finally{creating=false;}
  }
  function frame(time){
    const dt=lastFrame?clamp((time-lastFrame)/1000,0,.05):0;lastFrame=time;
    if(state.active||(state.finished&&!$("canyonScreen").hidden)){
      if(state.active)update(dt);
      if(world){
        try{world.draw(time/1000);}
        catch(error){
          console.warn("Canyon graphics fallback:",error);
          try{world.dispose();}catch{/* renderer already unavailable */}
          world=null;
        }
      }else drawFallback();
    }
    raf=requestAnimationFrame(frame);
  }
  function launch(forceNew=false){
    if(!progress?.unlocked("canyon"))return;
    if(!raf)raf=requestAnimationFrame(frame);
    if(world){/* Reuse existing scene and renderer on replay. */}
    const saved=!forceNew?progress.saved("canyon"):null;
    if(forceNew)progress.clearSave("canyon");
    state=defaultState();state.active=true;
    lastFrame=0;
    world?.recenterCamera?.();
    if(saved)restore(saved);
    world?.resetForLaunch?.();
    $("startScreen").hidden=true;$("gameScreen").hidden=true;$("canyonScreen").hidden=false;
    closeModal();refreshUI();
    $("canyonToast").hidden=true;
    save();buildWorld();
    if(questOrder.every(key=>state.done.has(key))){finish();return;}
    if(saved)toast("Canyon checkpoint restored. Welcome back!");
    else toast("Chapter 2 · Reach the canyon surveyor to begin.");
    (world?.dom||canvas).focus({preventScroll:true});
    window.scrollTo?.(0,0);
  }
  function suspend(){
    if(state.active&&!state.finished)save();
    state.active=false;state.paused=false;state.keys.clear();state.path=[];
    $("canyonModalBackdrop").hidden=true;state.modal=false;refreshDifficulty=null;
    $("canyonCelebration").hidden=true;
  }
  function recenterCanyonCamera(){
    world?.recenterCamera?.();
    if(!state.finished)toast("Camera returned to your explorer.");
  }
  function goHome(){
    suspend();
    window.dispatchEvent(new Event("trail:home"));
  }
  function pause(){
    if(!state.active)return;
    state.paused=true;save();
    modal("REST IN THE SHADE","Expedition paused",
      "Your checkpoint is saved automatically. WASD / arrows to walk · E to interact · click a destination to travel · drag to look around · wheel to zoom · C to recenter. Resume when you are ready.",
      [{text:"▶ Resume canyon",primary:true,action:()=>{closeModal();state.paused=false;}},
       {text:"◈ Chapter selection",action:goHome}]);
  }
  function clickFallback(event){
    if(world||!state.active||state.modal||state.paused)return;
    const rect=canvas.getBoundingClientRect();
    const p={x:(event.clientX-rect.left)/rect.width*W,y:(event.clientY-rect.top)/rect.height*H};
    let closestPoint=null,d=62;
    for(const item of [...Object.values(goals),rest]){
      const gap=pointDistance(p,item);if(gap<d){closestPoint=item;d=gap;}
    }
    pathTo(closestPoint||p);
  }
  canvas.addEventListener("click",clickFallback);
  $("canyonInteract").addEventListener("click",interact);
  $("canyonTouchInteract").addEventListener("click",interact);
  $("canyonToChapters").addEventListener("click",goHome);
  $("canyonPause").addEventListener("click",pause);
  $("canyonCameraReset").addEventListener("click",recenterCanyonCamera);
  $("canyonViewResults").addEventListener("click",showCelebration);
  $("canyonNextCoast").addEventListener("click",()=>{if(state.finished){suspend();window.TrailCoast?.launch();}});
  for(const btn of document.querySelectorAll("[data-canyon-move]")){
    const key={up:"w",down:"s",left:"a",right:"d"}[btn.dataset.canyonMove];
    if(!key)continue;
    btn.addEventListener("pointerdown",e=>{e.preventDefault();state.keys.add(key);});
    for(const type of ["pointerup","pointercancel","pointerleave"])
      btn.addEventListener(type,()=>state.keys.delete(key));
  }
  window.addEventListener("keydown",event=>{
    if(!state.active)return;
    if(state.modal){if(event.key==="Escape"&&!state.finished){closeModal();state.paused=false;}return;}
    if(["INPUT","SELECT","TEXTAREA"].includes(event.target?.tagName))return;
    if(["BUTTON","A"].includes(event.target?.tagName)&&[" ","Enter"].includes(event.key))return;
    const key=event.key.toLowerCase();
    const canvasFocused=event.target===canvas||event.target===world?.dom;
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)&&!canvasFocused)return;
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key))event.preventDefault();
    if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key))state.keys.add(key);
    if((key==="e"||key===" ")&&!event.repeat)interact();
    if(key==="p"&&!event.repeat)pause();
    if(key==="c"&&!event.repeat)recenterCanyonCamera();
  });
  window.addEventListener("keyup",event=>state.keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur",()=>state.keys.clear());
  window.addEventListener("pagehide",()=>{if(state.active&&!state.finished)save();});
  document.addEventListener("visibilitychange",()=>{
    state.keys.clear();
    if(document.hidden&&state.active&&!state.modal)pause();
  });
  window.addEventListener("trail:graphics",event=>world?.setGraphicsSettings?.(event.detail));
  window.addEventListener("trail:mode",()=>{if(state.active||state.finished){refreshUI();refreshDifficulty?.();}});
  window.TrailCanyon=Object.freeze({
    launch,suspend,goHome,pause,snapshot:()=>({
      active:state.active,paused:state.paused,modal:state.modal,finished:state.finished,waterRestored:state.finished,
      x:state.x,y:state.y,energy:state.energy,score:state.score,
      done:[...state.done],pressure:currentPressure(),valves:[...state.valves],
      cisternSafetyPassed:state.cisternSafetyPassed,releaseBasins:[...state.releaseBasins],
      repairStep:state.repairStep,mode:mode().id,difficulty:mode().difficulty,renderer:world?"3d":"2d",graphics:world?.getGraphicsStatus?.()||null
    })
  });
})();
