"use strict";
/* Thirst Trail 2.0 — standalone second chapter with a distinct 3D world.
   Falls back to a playable 2D canyon if WebGL / CDN loading fails. */
(() => {
  const $=id=>document.getElementById(id),progress=window.TrailProgress;
  const canvas=$("canyonCanvas"),ctx=canvas?.getContext("2d");
  if(!canvas||!ctx)return;
  const W=1000,H=610;
  const goals={
    surveyor:{x:165,y:270,title:"Meet the canyon surveyor",icon:"🧭",detail:"Learn what damaged the aqueduct"},
    kit:{x:305,y:455,title:"Recover the seal kit",icon:"🎒",detail:"Search the weathered supply shelter"},
    valves:{x:390,y:165,title:"Balance the pressure valves",icon:"🎛️",detail:"Regulate flow through three control valves"},
    span:{x:700,y:365,title:"Rebuild the aqueduct",icon:"🛠️",detail:"Repair the broken crossing in order"},
    cistern:{x:820,y:175,title:"Test the village cistern",icon:"💧",detail:"Complete the water-safety inspection"}
  };
  const questOrder=Object.keys(goals);
  const rest={x:290,y:520,title:"Shaded rest shelter",icon:"⛺"};
  const defaultState=()=>({
    active:false,paused:false,finished:false,x:170,y:425,
    energy:100,score:0,elapsed:0,done:new Set(),keys:new Set(),
    path:[],nearby:null,modal:false,valves:[0,0,0],repairStep:0,
    lastSave:0,toastUntil:0,toast:""
  });
  let state=defaultState(),world=null,creating=false,lastFrame=0,raf=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const wX=x=>(x-500)/24,wZ=y=>(y-305)/24;
  const leftSide=x=>x<480,rightSide=x=>x>550;
  function blocked(x,y){
    if(x<39||x>961||y<43||y>567)return true;
    return x>459&&x<558&&(y<316||y>392);
  }
  function pathTo(point){
    if(!state.active||state.paused||state.modal)return;
    if(blocked(point.x,point.y))return toast("The canyon gorge blocks this route. Use the bridge.");
    const p=[];
    if((leftSide(state.x)&&rightSide(point.x))||(rightSide(state.x)&&leftSide(point.x))){
      p.push({x:state.x<520?447:569,y:350});
      p.push({x:state.x<520?569:447,y:350});
    }
    p.push({x:point.x,y:point.y});state.path=p;
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
  function pressureSafe(){
    const [a,b,c]=state.valves,p=currentPressure();
    return p>=65&&p<=73&&b>=1&&Math.abs(a-c)<=1;
  }
  function save(){
    if(!state.active||state.finished||!progress)return;
    progress.save("canyon",{
      x:Math.round(state.x),y:Math.round(state.y),
      energy:Math.round(state.energy*10)/10,score:state.score,
      elapsed:Math.round(state.elapsed),
      done:[...state.done],valves:[...state.valves],repairStep:state.repairStep
    });
    $("canyonSaveStatus").textContent="✓ Checkpoint saved in this browser";
    state.lastSave=state.elapsed;
  }
  function restore(saved){
    if(!saved||typeof saved!=="object")return;
    state.x=clamp(Number(saved.x)||170,45,955);
    state.y=clamp(Number(saved.y)||425,45,565);
    if(blocked(state.x,state.y)){state.x=170;state.y=425;}
    state.energy=clamp(Number(saved.energy)||100,1,100);
    state.score=Math.max(0,Number(saved.score)||0);
    state.elapsed=Math.max(0,Number(saved.elapsed)||0);
    state.done=new Set((saved.done||[]).filter(key=>goals[key]));
    if(Array.isArray(saved.valves)&&saved.valves.length===3)
      state.valves=saved.valves.map(x=>clamp(Math.trunc(Number(x)||0),0,3));
    state.repairStep=clamp(Math.trunc(Number(saved.repairStep)||0),0,4);
  }
  function completeQuest(key,points){
    if(state.done.has(key))return;
    state.done.add(key);state.score+=points;
    save();refreshUI();
    toast("✓ "+goals[key].title+" complete! +"+points+" impact");
  }
  function modal(tag,title,text,choices,extra){
    state.modal=true;state.keys.clear();state.path=[];
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
      b.addEventListener("click",item.action);actions.append(b);
    }
    $("canyonModalBackdrop").hidden=false;
    $("canyonModal").scrollTop=0;
    $("canyonModal").focus({preventScroll:true});
  }
  function closeModal(){
    state.modal=false;$("canyonModalBackdrop").hidden=true;
    canvas.focus({preventScroll:true});
  }
  function interact(){
    if(!state.active||state.paused||state.modal)return;
    const key=closest();
    if(!key)return toast("Walk toward a glowing mission marker and press E.");
    state.path=[];
    if(key==="rest"){
      state.energy=Math.min(100,state.energy+34);
      toast("Rested in the canyon shade · +34 energy");save();refreshUI();
      return;
    }
    if(key==="surveyor"){
      modal("CHAPTER 02 · CANYON SURVEY", "The old aqueduct", 
        "Surveyor Nia explains: a flash flood destroyed the stone aqueduct. Recover sealing tools, balance the old valves, rebuild the span, and inspect the cistern before anyone uses the water.",
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
    if(key==="valves"){valveChallenge();return;}
    if(!state.done.has("valves"))return toast("Balance the pressure valves before repairing the crossing.");
    if(key==="span"){bridgeChallenge();return;}
    if(!state.done.has("span"))return toast("Finish the aqueduct span before testing the cistern.");
    if(key==="cistern"){cisternChallenge();return;}
  }
  function valveChallenge(){
    function redraw(root){
      root.replaceChildren();
      const heading=document.createElement("div");heading.className="canyon-pressure-hint";
      heading.textContent="Adjust each valve from 0 to 3. Target: 65–73 kPa. Intake and return valves must differ by no more than one setting.";
      root.append(heading);
      for(let i=0;i<3;i++){
        const row=document.createElement("div");row.className="canyon-valve";
        const label=document.createElement("strong");label.textContent=["Intake · +16 kPa","Regulator · +13 kPa","Return · +11 kPa"][i];
        const btn=document.createElement("button");btn.type="button";btn.textContent="OPEN "+state.valves[i]+" / 3";
        btn.addEventListener("click",()=>{state.valves[i]=(state.valves[i]+1)%4;redraw(root);save();});
        row.append(label,btn);root.append(row);
      }
      const meter=document.createElement("div");meter.className="canyon-pressure-meter";
      const fill=document.createElement("span");fill.style.width=clamp(currentPressure()/100*100,0,100)+"%";
      meter.append(fill);root.append(meter);
      const value=document.createElement("strong");value.textContent="System pressure: "+currentPressure()+" kPa";
      value.className="canyon-pressure-hint";root.append(value);
    }
    modal("CONTROL STATION · PRESSURE PUZZLE","Balance the canyon valves",
      "Tune three valve settings. The pressure must be in the safe operating range, the regulator must be open, and intake/return flow must stay balanced.",
      [{text:"💧 Test pressure",primary:true,action:()=>{
        if(pressureSafe()){closeModal();completeQuest("valves",250);return;}
        state.energy=Math.max(15,state.energy-4);
        toast("Pressure outside safe range or unbalanced · −4 energy");
        valveChallenge();save();
      }},{text:"↩ Continue exploring",action:()=>{save();closeModal();}}],
      el=>{const root=document.createElement("div");root.className="canyon-pressure";el.append(root);redraw(root);});
  }
  const repairOrder=["Anchor supports","Brace the span","Seat the pipe","Apply the seal"];
  function bridgeChallenge(){
    function draw(root){
      root.replaceChildren();const board=document.createElement("div");board.className="canyon-repair-tiles";
      for(let i=0;i<4;i++){
        const btn=document.createElement("button");btn.type="button";
        btn.className=i<state.repairStep?"selected":"";
        btn.textContent=["⚓","🪵","🔩","🧪"][i];
        const label=document.createElement("small");label.textContent=repairOrder[i];btn.append(label);
        btn.addEventListener("click",()=>{
          if(i===state.repairStep){
            state.repairStep++;save();
            if(state.repairStep===4){closeModal();completeQuest("span",310);return;}
            draw(root);
          }else{
            toast("Secure the components in a safe construction order.");
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
    modal("FINAL INSPECTION","Is the repaired water safe?",
      "Water is reaching the cistern. What must the team do before distributing it to households?",
      [{text:"Test water quality and follow local treatment and monitoring procedures",primary:true,action:()=>{
        closeModal();completeQuest("cistern",430);finish();
      }},{text:"If the water looks clear, it must be safe",action:()=>{
        state.energy=Math.max(15,state.energy-5);
        toast("Appearance does not prove drinking-water safety. −5 energy");
        cisternChallenge();
      }},{text:"Return to the canyon",action:closeModal}]);
  }
  function finish(){
    if(state.finished)return;
    state.finished=true;state.active=false;state.score+=Math.round(state.energy)*2;
    progress?.complete("canyon");refreshUI();
    modal("✦ CHAPTER COMPLETE","The aqueduct flows again!",
      "You brought the canyon system back into service and verified the water-safety steps. The Forgotten Canyon is complete! Total impact: "+
      state.score.toLocaleString()+" points. This is a fictional training scenario, not drinking-water guidance.",
      [{text:"◈ Return to chapter selection",primary:true,action:goHome},
       {text:"↻ Replay Forgotten Canyon",action:()=>{closeModal();launch(true);}}]);
  }
  function formatTime(t){const sec=Math.floor(t);return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");}
  function refreshUI(){
    const n=state.done.size,next=questOrder.find(key=>!state.done.has(key));
    $("canyonProgressLabel").textContent=n+" / 5 completed";
    $("canyonProgressFill").style.width=n/5*100+"%";
    $("canyonSubtitle").textContent=state.finished?"Canyon restored — chapter complete!":
      next?"Next mission: "+goals[next].title:"The canyon water system is restored.";
    $("canyonEnergy").textContent="⚡ "+Math.ceil(state.energy)+"% energy";
    $("canyonScore").textContent="✦ "+state.score.toLocaleString()+" impact";
    $("canyonTimer").textContent="◷ "+formatTime(state.elapsed);
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
    $("canyonPrompt").hidden=!nearby||!state.active||state.paused;
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
      if(pointDistance(state,target)<9){state.path.shift();target=state.path[0];}
      if(target){dx=target.x-state.x;dy=target.y-state.y;}
    }
    const len=Math.hypot(dx,dy);
    if(len){
      const step=Math.min(185*dt,manual?185*dt:Math.max(0,len));
      dx=dx/len*step;dy=dy/len*step;
      let nx=state.x+dx,ny=state.y+dy;
      if(!blocked(nx,state.y))state.x=nx;
      if(!blocked(state.x,ny))state.y=ny;
      state.energy=Math.max(7,state.energy-dt*.12);
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
    for(const [key,o] of [...Object.entries(goals),["rest",rest]]){
      c.beginPath();c.arc(o.x,o.y,19,0,Math.PI*2);
      c.fillStyle=state.done.has(key)?"#75bf93":"#fce7a4";c.fill();
      c.strokeStyle="#283d42";c.lineWidth=3;c.stroke();
      c.font="20px system-ui";c.textAlign="center";c.fillStyle="#fff";c.fillText(o.icon,o.x,o.y+7);
      c.font="800 13px system-ui";c.fillStyle="#243a40";c.fillText(o.title,o.x,o.y-26);
    }
    c.beginPath();c.arc(state.x,state.y,16,0,Math.PI*2);c.fillStyle="#173d51";c.fill();c.lineWidth=3;c.strokeStyle="#f2da89";c.stroke();
    c.fillStyle="#fff7da";c.font="900 21px system-ui";c.textAlign="center";c.fillText("◉",state.x,state.y+7);
  }
  async function buildWorld(){
    if(world||creating)return;
    creating=true;
    try{
      const THREE=await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
      const scene=new THREE.Scene();scene.background=new THREE.Color(0xcba992);
      // Widen the entire traversable 3D valley without changing quest logic or save coordinates.
      const worldSpread=1.42;scene.scale.set(worldSpread,1,worldSpread);
      scene.fog=new THREE.FogExp2(0xd8bca4,.009);
      const camera=new THREE.PerspectiveCamera(47,1000/610,.1,300);
      camera.position.set(7.4,10.5,13.6);camera.lookAt(0,0,0);
      const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const dom=renderer.domElement;dom.className="canyon-webgl";
      dom.style.cssText="display:block;width:100%;height:auto;aspect-ratio:1000/610;touch-action:none;outline:none";
      dom.tabIndex=0;
      const parent=canvas.parentElement;parent.insertBefore(dom,canvas.nextSibling);
      canvas.style.display="none";
      const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.87,metalness,flatShading:true});
      const rock=[mat(0xd58c68),mat(0xaa6454),mat(0xeeaf77),mat(0x86535a)];
      const sand=mat(0xd8aa76),path=mat(0xf1d2a0),timber=mat(0x86624b),iron=mat(0x768d90,.25),teal=mat(0x5a9e9b);
      const water=new THREE.MeshStandardMaterial({color:0x50b1b9,roughness:.31,metalness:.05,transparent:true,opacity:.91});
      const hemi=new THREE.HemisphereLight(0xdff3f5,0x8d6656,1.55);scene.add(hemi);
      const sun=new THREE.DirectionalLight(0xffd6a0,3.2);sun.position.set(-18,29,12);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;
      sun.shadow.camera.top=29;sun.shadow.camera.bottom=-29;sun.shadow.bias=-.0003;
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
      for(let i=0;i<44;i++){
        const x=(i%2?-1:1)*(10+rng()*24),z=-24+rng()*52;
        const radius=1.1+rng()*2.5,height=2.5+rng()*7;
        const column=put(new THREE.CylinderGeometry(radius*.70,radius,height,7,1),rock[i%4],x,height/2-.20,z,false);
        column.rotation.y=rng()*6.28;
        for(let layer=0;layer<3;layer++)
          put(new THREE.CylinderGeometry(radius*(.82+layer*.065),radius*(.82+layer*.065),.15,7),
            rock[(i+layer+1)%4],x,layer*height/4+.2,z,false);
      }
      // Distinct winding desert roads.
      const roads=[
        [[165,270],[305,455],[442,350]],
        [[390,165],[420,280],[445,350]],
        [[570,350],[700,365],[820,175]]
      ];
      for(const stops of roads)for(let i=0;i<stops.length-1;i++){
        const a=stops[i],b=stops[i+1];
        const x=(wX(a[0])+wX(b[0]))/2,z=(wZ(a[1])+wZ(b[1]))/2;
        const len=Math.hypot(wX(a[0])-wX(b[0]),wZ(a[1])-wZ(b[1]));
        const p=box(path,x,-.035,z,.90,.04,len);
        p.rotation.y=Math.atan2(wX(b[0])-wX(a[0]),wZ(b[1])-wZ(a[1]));
      }
      // Cross-canyon bridge with guard rails.
      const bridgeZ=wZ(350);
      for(let i=0;i<18;i++){
        const plank=box(timber,-3.0+i*.36,.20,bridgeZ,.33,.18,2.55);
        plank.rotation.y=Math.sin(i*.65)*.015;
      }
      for(const edge of [-1,1])for(let i=0;i<10;i++){
        box(timber,-3.0+i*.7,.78,bridgeZ+edge*1.25,.12,1.15,.12);
      }
      for(const edge of [-1,1]){
        box(iron,0,1.29,bridgeZ+edge*1.25,6.5,.11,.11);
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
          tc.fillStyle="#fff8df";tc.font="bold 26px sans-serif";
          tc.textAlign="center";tc.textBaseline="middle";
          tc.fillText(obj.title,192,36,352);
          const texture=new THREE.CanvasTexture(tag);
          texture.colorSpace=THREE.SRGBColorSpace;
          const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
            map:texture,transparent:true,depthWrite:false}));
          sprite.scale.set(3.9,.74,1);
          sprite.position.y=2.65;group.add(sprite);
        }
        marks.push({key,ring,pillar});
      }
      // Character: local procedural fallback renders immediately.
      const player=new THREE.Group();scene.add(player);
      // Character remains human-sized while landscape and landmarks spread apart.
      player.scale.set(1/worldSpread,1,1/worldSpread);
      const jacket=mat(0x1c8d8a),skin=mat(0xe0a87d),hat=mat(0xf4c776),boots=mat(0x293b50);
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.31,.63,5,10),jacket);
      torso.position.y=1.2;torso.castShadow=true;player.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.29,12,9),skin);head.position.y=2.05;player.add(head);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.4,.43,.21,13),hat);cap.position.y=2.39;player.add(cap);
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
      const pack=new THREE.Mesh(new THREE.BoxGeometry(.60,.79,.34),rock[1]);
      pack.position.set(0,1.29,-.37);player.add(pack);
      // Readable face, goggles, jacket trim and backpack straps for the closer follow camera.
      const eyeMat=mat(0x1c2a33),strapMat=mat(0xc7a675);
      for(const side of [-1,1]){
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.038,7,6),eyeMat);
        eye.position.set(side*.12,2.10,.258);player.add(eye);
        const strap=new THREE.Mesh(new THREE.BoxGeometry(.095,.55,.05),strapMat);
        strap.position.set(side*.22,1.32,.30);player.add(strap);
      }
      const brim=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.045,16),hat);
      brim.position.y=2.31;player.add(brim);
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
        const scale=2*Math.tan(camera.fov*Math.PI/360)*Math.max(8,camera.position.distanceTo(cameraTarget))/height*1.35;
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
      if(!state.active){
        renderer.dispose();dom.remove();canvas.style.display="";
        return;
      }
      world={
        dom,renderer,scene,camera,player,limbs,marks,broken,pipeMesh,water,
        recenterCamera,
        draw(time){
          const width=dom.clientWidth||1000,height=dom.clientHeight||610;
          const targetWidth=Math.max(300,Math.floor(width)),targetHeight=Math.max(180,Math.floor(height));
          if(camera.aspect!==targetWidth/targetHeight){
            camera.aspect=targetWidth/targetHeight;camera.updateProjectionMatrix();
          }
          if(dom.width!==targetWidth||dom.height!==targetHeight)
            renderer.setSize(targetWidth,targetHeight,false);
          const px=wX(state.x),pz=wZ(state.y);
          player.position.set(px,.07+Math.sin(time*9)*.035,pz);
          if(state.path.length){
            const p=state.path[0];player.rotation.y=Math.atan2(wX(p.x)-px,wZ(p.y)-pz);
          }
          for(let i=0;i<limbs.length;i++)limbs[i].rotation.x=Math.sin(time*9+Math.floor(i/2)*Math.PI+(i%2)*Math.PI)*(state.path.length||state.keys.size ? .35 : .07);
          // Once travel resumes, follow the explorer so walking never appears frozen offscreen.
          if(state.path.length||state.keys.size)pan.set(0,0,0);
          // Clamp the free camera within the entire expanded canyon; player stays put.
          const baseX=px*worldSpread,baseZ=pz*worldSpread;
          cameraTarget.set(clamp(baseX+pan.x,-31,31),0,clamp(baseZ+pan.z,-23,23));
          pan.x=cameraTarget.x-baseX;pan.z=cameraTarget.z-baseZ;
          camera.position.lerp(new THREE.Vector3(cameraTarget.x+7.4*zoom,10.5*zoom,cameraTarget.z+13.6*zoom),.09);
          camera.lookAt(cameraTarget);
          for(const m of marks){
            const done=state.done.has(m.key);
            m.pillar.visible=!done;m.ring.material.color.set(done?0x70c5a4:0xffd787);
            m.ring.scale.setScalar(1+Math.sin(time*2.2)*.12);
          }
          broken.visible=!state.done.has("span");
          water.color.set(state.done.has("cistern")?0x55c4cb:0x50b1b9);
          renderer.render(scene,camera);
        },
        dispose(){dom.remove();renderer.dispose();canvas.style.display="";}
      };
      if(!state.active)world.draw(performance.now()/1000);
    }catch(error){console.warn("Canyon WebGL unavailable, continuing with playable 2D.",error);canvas.style.display=""; }
    finally{creating=false;}
  }
  function frame(time){
    const dt=lastFrame?clamp((time-lastFrame)/1000,0,.05):0;lastFrame=time;
    if(state.active){
      update(dt);
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
    world?.recenterCamera?.();
    if(saved)restore(saved);
    $("startScreen").hidden=true;$("gameScreen").hidden=true;$("canyonScreen").hidden=false;
    closeModal();refreshUI();
    $("canyonToast").hidden=true;
    save();buildWorld();
    if(saved)toast("Canyon checkpoint restored. Welcome back!");
    else toast("Chapter 2 · Reach the canyon surveyor to begin.");
    canvas.focus({preventScroll:true});
    window.scrollTo?.(0,0);
  }
  function suspend(){
    if(state.active&&!state.finished)save();
    state.active=false;state.paused=false;state.keys.clear();state.path=[];
    $("canyonModalBackdrop").hidden=true;state.modal=false;
  }
  function recenterCanyonCamera(){
    world?.recenterCamera?.();
    toast("Camera returned to your explorer.");
  }
  function goHome(){
    suspend();
    window.dispatchEvent(new Event("trail:home"));
  }
  function pause(){
    if(!state.active)return;
    state.paused=true;save();
    modal("REST IN THE SHADE","Expedition paused",
      "Your checkpoint is saved automatically. Resume when you are ready, or return to the chapter selector.",
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
    const key=event.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key))event.preventDefault();
    if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(key))state.keys.add(key);
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
  window.TrailCanyon=Object.freeze({
    launch,suspend,goHome,snapshot:()=>({
      active:state.active,paused:state.paused,finished:state.finished,
      x:state.x,y:state.y,energy:state.energy,score:state.score,
      done:[...state.done],pressure:currentPressure(),valves:[...state.valves],
      repairStep:state.repairStep,renderer:world?"3d":"2d"
    })
  });
})();
