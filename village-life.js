"use strict";
/* Playable post-restoration village activities; independent of chapter rewards. */
(() => {
  const FONT_FAMILY = window.TrailTypography?.family || "sans-serif";
  const $=id=>document.getElementById(id),capacity=8;
  const fountain={id:"fountain",x:475,y:660,name:"Village fountain",icon:"💧"};
  const residents=[
    {id:"home",x:310,y:560,name:"Amina’s home",person:"Amina",role:"Village elder",icon:"🏡",before:"The fountain is running, but some neighbours still need a hand carrying water home.",after:"Thank you. My family can spend this afternoon together instead of walking for water."},
    {id:"school",x:345,y:360,name:"Leila’s school",person:"Leila",role:"Teacher",icon:"📚",before:"The children planted flowers for the first day our school had a reliable water supply.",after:"The water is here! The children have time for lessons and tending their little garden."},
    {id:"garden",x:610,y:460,name:"Idris’s garden",person:"Idris",role:"Community gardener",icon:"🌱",before:"A little water will help these seedlings take root. An irrigation project would help even more.",after:"Look at those seedlings! We are growing food and looking after the water system together."}
  ];
  const leaks=[
    {id:"school-joint",x:420,y:420,name:"Damp trail by the school",icon:"🔎",tool:"gasket",clue:"A ring of droplets surrounds a worn seal between two pipe flanges.",steps:["Lift out the worn seal","Seat the new gasket","Secure the flange"]},
    {id:"home-pipe",x:350,y:660,name:"Wet patch by the homes",icon:"🔎",tool:"clamp",clue:"A straight section of pipe has a narrow split. Water beads along the crack.",steps:["Seat the repair clamp","Tighten the left bolt","Tighten the right bolt"]},
    {id:"garden-coupling",x:650,y:510,name:"Dripping garden connection",icon:"🔎",tool:"torque",clue:"The connector is intact, but its threaded coupling turns loosely in your hand.",steps:["Brace the connector","Turn the torque key","Test the tightened joint"]}
  ];
  const projects=[
    {id:"station",name:"Drinking-water station",cost:3,icon:"🚰",detail:"Build a second jug refill point beside the fountain.",x:430,y:520},
    {id:"irrigation",name:"Garden irrigation",cost:4,icon:"🌿",detail:"Bring a neat water channel to Idris’s vegetable beds.",x:610,y:460},
    {id:"shade",name:"Shaded gathering place",cost:4,icon:"⛱️",detail:"Add a canopy and benches where neighbours can meet.",x:365,y:610}
  ];
  const tools={clamp:"Repair clamp",gasket:"Replacement gasket",torque:"Torque key"};
  const blank=()=>({version:1,jug:0,materials:0,round:1,served:[],delivered:{home:0,school:0,garden:0},found:[],fixed:[],upgrades:[],repair:null,bonus:false});
  let data=blank(),active=false,initialized=false,tab="deliveries",panel=null,revision=0,lastNearby="",message="Fill your 8-litre jug, then help neighbours and look after the village.";
  let callbacks={navigate(){},getPlayer:()=>({x:NaN,y:NaN}),notify(){},onChange(){}};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const number=(v,max=999)=>Number.isInteger(v)&&v>=0?Math.min(max,v):0;
  const validIds=(values,items)=>Array.isArray(values)?[...new Set(values.filter(v=>items.some(item=>item.id===v)))]:[];
  function restore(value){
    data=blank();if(!value||typeof value!=="object"||Array.isArray(value))return;
    data.jug=number(value.jug,capacity);data.materials=number(value.materials,99);data.round=Math.max(1,number(value.round));
    data.served=validIds(value.served,residents);data.found=validIds(value.found,leaks);data.fixed=validIds(value.fixed,leaks);
    for(const id of data.fixed)if(!data.found.includes(id))data.found.push(id);
    data.upgrades=validIds(value.upgrades,projects);
    for(const person of residents)data.delivered[person.id]=number(value.delivered?.[person.id]);
    const repair=value.repair,leak=leaks.find(item=>item.id===repair?.id);
    if(leak&&!data.fixed.includes(leak.id)&&repair.tool===leak.tool&&Number.isInteger(repair.step)&&repair.step>=0&&repair.step<3)
      data.repair={id:leak.id,tool:repair.tool,step:repair.step};
    data.bonus=value.bonus===true;
  }
  const pointDistance=point=>{const p=callbacks.getPlayer?.()||{};return Number.isFinite(p.x)&&Number.isFinite(p.y)?Math.hypot(p.x-point.x,p.y-point.y):Infinity;};
  const near=point=>pointDistance(point)<=70;
  const mode=()=>window.TrailMode?.get?.()||"explorer";
  const difficulty=()=>window.TrailMode?.profile?.().difficulty||(mode()==="challenge"?"hard":mode()==="normal"?"normal":"easy");
  const request=()=>window.TrailMode?.profile?.().deliveryRequest===6||(!window.TrailMode?.profile&&mode()==="challenge")?6:4;
  function snapshot(){return {...clone(data),active,tab,jugCapacity:capacity,deliveryRequest:request(),roundComplete:data.served.length===residents.length,
    completedProjects:data.upgrades.length,foundLeaks:data.found.length,fixedLeaks:data.fixed.length,mode:mode(),difficulty:difficulty()};}
  function announce(text){message=text;callbacks.notify?.(text);render();}
  function save(){
    if(mode()==="challenge"&&!data.bonus&&data.fixed.length===3&&residents.every(p=>data.delivered[p.id]>0)){
      data.bonus=true;message="✦ Caretaker badge earned! You delivered to every neighbour and repaired all three leaks.";
    }
    const saved=window.TrailProgress?.saveCommunity?.(data);
    if(saved===false)message+=" Your progress is available for this session; browser saving is unavailable.";
    callbacks.onChange?.(snapshot());render();
  }
  function requireNear(point){if(near(point))return true;announce("Walk to "+point.name+" first. Choose Go to follow the trail.");return false;}
  function fill(point=fountain){
    if(!active||!requireNear(point))return;
    if(data.jug===capacity)return announce("Your jug is already full: 8 / 8 litres.");
    data.jug=capacity;
    const litres=request(),deliveries=Math.floor(capacity/litres);
    message="Jug filled: 8 / 8 litres. "+(deliveries===1?"Each delivery uses "+litres+" litres; refill before visiting the next neighbour.":"You can make "+deliveries+" deliveries of "+litres+" litres.");
    window.ThirstAudio?.play?.("water");save();
  }
  function deliver(person){
    if(!active||!requireNear(person))return;
    if(data.served.includes(person.id))return announce(person.person+" has water for this round. Visit the other neighbours before starting another round.");
    const litres=request();
    if(data.jug<litres)return announce("This delivery needs "+litres+" litres. Refill at the village fountain or drinking-water station first.");
    const first=data.delivered[person.id]===0;
    data.jug-=litres;data.served.push(person.id);data.delivered[person.id]++;
    if(first)data.materials+=2;
    message=person.person+": “"+person.after+"”"+(first?" +2 building materials.":" Thank you for another delivery.");
    window.ThirstAudio?.play?.("deliver");save();
  }
  function discover(leak){
    if(!active||!requireNear(leak))return;
    tab="leaks";
    if(data.fixed.includes(leak.id))return announce("This joint is dry and secure. Your repair is holding.");
    if(!data.found.includes(leak.id)){data.found.push(leak.id);message="Leak found! "+leak.clue;save();}
    else announce(leak.clue);
  }
  function chooseTool(leak,tool){
    if(!active||!requireNear(leak)||!data.found.includes(leak.id)||data.fixed.includes(leak.id))return;
    if(tool!==leak.tool)return announce("That tool does not match this fault. "+leak.clue+" Try another tool; there is no penalty.");
    if(data.repair?.id!==leak.id)data.repair={id:leak.id,tool,step:0};
    message="Correct tool: "+tools[tool]+". Next: "+leak.steps[data.repair.step]+".";save();
  }
  function repairStep(leak,index){
    if(!active||!requireNear(leak)||data.fixed.includes(leak.id)||data.repair?.id!==leak.id)return;
    if(index!==data.repair.step)return announce("Work stays in place. Next: "+leak.steps[data.repair.step]+".");
    data.repair.step++;
    if(data.repair.step===3){data.fixed.push(leak.id);data.materials+=3;data.repair=null;message="✓ Leak repaired. The wet patch is drying. +3 building materials.";}
    else message="✓ Step complete. Next: "+leak.steps[data.repair.step]+".";
    window.ThirstAudio?.play?.(data.repair?"repair":"reward");save();
  }
  function buildProject(project){
    if(!active||data.upgrades.includes(project.id))return;
    if(data.materials<project.cost)return announce("You need "+project.cost+" materials. First deliveries earn 2 each; each repaired leak earns 3.");
    data.materials-=project.cost;data.upgrades.push(project.id);message="✓ "+project.name+" built! Visit it in the village to see your work.";
    window.ThirstAudio?.play?.("build");save();
  }
  function nextRound(){
    if(!active||data.served.length!==3)return;
    data.served=[];data.round++;message="A new delivery round is ready. Your first-delivery materials and completed projects stay earned.";save();
  }
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function action(label,id,fn,disabled=false){
    const button=element("button","village-life-button",label);button.type="button";button.dataset.villageAction=id;button.disabled=disabled;
    const owner=revision;button.addEventListener("click",()=>{if(active&&revision===owner)fn();});return button;
  }
  function goButton(point){
    return action("↗ Go", "go-"+point.id,()=>{callbacks.navigate?.({x:point.x,y:point.y,name:point.name});message="Following the trail to "+point.name+". Press E or use the activity button when you arrive.";render();});
  }
  function card(point){
    const item=element("article","village-life-card");const top=element("div","village-life-card-top");
    top.append(element("strong","",point.icon+" "+point.name),goButton(point));item.append(top);return item;
  }
  function render(){
    if(!panel)return;
    panel.hidden=!active;if(!active)return;
    // Rebuilding the card grid must not strand keyboard and screen-reader
    // users on <body>. Preserve the focused action when it still exists; for
    // consumed/disabled actions, return focus to the active activity tab.
    const focused=document.activeElement;
    const focusAction=focused&&panel.contains?.(focused)?focused.dataset?.villageAction:null;
    revision++;
    panel.replaceChildren();panel.className="village-life-panel";
    const header=element("div","village-life-header");
    const title=element("div","");title.append(element("span","village-life-eyebrow","YOUR LIVING VILLAGE"),element("h3","","Every delivery changes a day."));
    header.append(title,action("Hide activities","close",close));panel.append(header);
    const resources=element("div","village-life-resources");
    const jug=element("div","village-life-jug");const jugIcon=element("span","village-life-jug-icon");jugIcon.setAttribute("aria-hidden","true");
    const fillLevel=element("i","village-life-jug-water");fillLevel.style.height=data.jug/capacity*100+"%";jugIcon.append(fillLevel);
    const jugCopy=element("div","");jugCopy.append(element("strong","",data.jug+" / 8 L"),element("small","","Yellow delivery jug"));jug.append(jugIcon,jugCopy);
    resources.append(jug,element("strong","village-life-materials","🧱 "+data.materials+" materials"),element("small","","Round "+data.round+" · "+data.served.length+" / 3 neighbours served"));panel.append(resources);
    const tabs=element("div","village-life-tabs");tabs.setAttribute("role","group");tabs.setAttribute("aria-label","Village activities");
    for(const [id,label] of [["deliveries","💧 Deliver"],["leaks","🔎 Repair"],["projects","🌿 Build"],["stories","💬 Stories"]]){
      const button=action(label,"tab-"+id,()=>{tab=id;render();});button.setAttribute("aria-pressed",String(tab===id));tabs.append(button);
    }panel.append(tabs);
    const body=element("div","village-life-body");
    if(tab==="deliveries"){
      const litres=request();
      const source=card(fountain);source.append(element("p","","Fill the 8-litre jug here. Each neighbour needs "+litres+" litres."),action(near(fountain)?"💧 Fill jug":"Walk here to fill","fill",()=>fill(),!near(fountain)||data.jug===capacity));body.append(source);
      if(data.upgrades.includes("station")){
        const station={...projects[0],name:"New drinking-water station"};const row=card(station);
        row.append(element("p","","Refill the 8-litre jug here. Each delivery uses "+litres+" litres."),action("Refill at the new station","fill-station",()=>fill(station),!near(station)||data.jug===capacity));body.append(row);
      }
      for(const person of residents){
        const row=card(person),served=data.served.includes(person.id);
        row.append(element("p","",person.person+" · "+(served?person.after:person.before)),action(served?"✓ Water delivered":"Deliver "+litres+" L"+(data.delivered[person.id]===0?" · +2 materials":""),"deliver-"+person.id,()=>deliver(person),served||!near(person)||data.jug<litres));body.append(row);
      }
      if(data.served.length===3)body.append(action("Start another delivery round","next-round",nextRound));
      body.append(element("p","village-life-note","Materials are awarded once for each first delivery. Further rounds keep the community supplied without repeating those rewards."));
    }else if(tab==="leaks"){
      body.append(element("p","village-life-note","Follow a wet patch and listen for a short dripping cue. Inspect nearby joints, choose the matching tool, then complete its three repair steps."));
      for(const leak of leaks){
        const row=card(leak),found=data.found.includes(leak.id),fixed=data.fixed.includes(leak.id);
        row.append(element("p","",fixed?"✓ Dry and secure. Your repair is holding.":found?leak.clue:"Look for a damp patch beside this trail."));
        if(!fixed&&!found)row.append(action("Inspect wet patch","inspect-"+leak.id,()=>discover(leak),!near(leak)));
        if(found&&!fixed){
          const group=element("div","village-life-tool-row");
          for(const [id,label] of Object.entries(tools))group.append(action(label,"tool-"+leak.id+"-"+id,()=>chooseTool(leak,id),!near(leak)));
          row.append(group);
          if(data.repair?.id===leak.id){
            const steps=element("div","village-life-repair-steps");
            leak.steps.forEach((label,i)=>steps.append(action((i<data.repair.step?"✓ ":(i+1)+". ")+label,"repair-"+leak.id+"-"+i,()=>repairStep(leak,i),!near(leak)||i<data.repair.step)));
            row.append(steps);
          }
        }body.append(row);
      }
      if(mode()==="challenge")body.append(element("p","village-life-note",data.bonus?"✦ Caretaker badge earned.":"Hard bonus: serve all three neighbours and repair all three leaks to earn the Caretaker badge."));
    }else if(tab==="projects"){
      body.append(element("p","village-life-note","Choose which improvement to build first. First deliveries and leak repairs provide enough materials for all three projects."));
      for(const project of projects){
        const row=card(project),built=data.upgrades.includes(project.id);
        row.append(element("p","",project.detail),action(built?"✓ Project complete":"Build · "+project.cost+" materials","build-"+project.id,()=>buildProject(project),built||data.materials<project.cost));body.append(row);
      }
    }else{
      for(const person of residents){const row=card(person);row.append(element("small","village-life-eyebrow",person.role),element("p","",person.person+": “"+(data.delivered[person.id]>0?person.after:person.before)+"”"));body.append(row);}
      body.append(element("p","village-life-note",data.upgrades.length===3?"The village has a water station, an irrigated garden and a shaded place to gather. This is what your repairs made possible.":"Neighbour stories change after deliveries. Village projects appear in the world as you build them."));
    }
    panel.append(body);
    const status=element("p","village-life-status",message);status.setAttribute("role","status");status.setAttribute("aria-live","polite");panel.append(status);
    const persist=element("small","village-life-save","Village activities save independently of chapter replays in this browser.");panel.append(persist);
    if(focusAction){
      const actions=[...(panel.querySelectorAll?.("[data-village-action]")||[])];
      // When a tab changed, do not refocus the formerly selected tab simply
      // because that control still exists in the newly rendered tab bar.
      const preferred=focusAction.startsWith("tab-")?"tab-"+tab:focusAction;
      const next=actions.find(button=>button.dataset.villageAction===preferred&&!button.disabled)
        ||actions.find(button=>button.dataset.villageAction==="tab-"+tab&&!button.disabled);
      next?.focus?.({preventScroll:true});
    }
  }
  function init(options={}){
    callbacks={...callbacks,...options};panel=$("villageLifePanel");
    if(!initialized){restore(window.TrailProgress?.community?.());initialized=true;}
    render();return snapshot();
  }
  function open(){
    if(window.TrailProgress?.snapshot&&!window.TrailProgress.snapshot().completed?.includes("valley")){
      callbacks.notify?.("Restore the village pump before starting community activities.");return false;
    }
    if(!initialized)init();active=true;lastNearby="";
    $("villageOpenActivities")?.setAttribute?.("aria-expanded","true");
    render();return true;
  }
  function close(){
    const manual=panel?.contains?.(document.activeElement)
      &&document.activeElement?.dataset?.villageAction==="close";
    active=false;revision++;if(panel)panel.hidden=true;
    $("villageOpenActivities")?.setAttribute?.("aria-expanded","false");
    if(manual)$("villageOpenActivities")?.focus?.({preventScroll:true});
  }
  function getDestinations(){return [fountain,...residents,...leaks,...(data.upgrades.includes("station")?[{...projects[0],name:"New drinking-water station"}]:[])].map(clone);}
  function closest(){let point=null,distance=70;for(const item of getDestinations()){const d=pointDistance(item);if(d<distance){point=item;distance=d;}}return point;}
  function interactNear(){
    if(!active)return false;const point=closest();if(!point)return false;
    if(point.id==="fountain")fill();
    else if(point.id==="station")fill(point);
    else if(residents.some(person=>person.id===point.id))deliver(residents.find(person=>person.id===point.id));
    else discover(leaks.find(leak=>leak.id===point.id));
    return true;
  }
  function update(){
    if(!active)return;const point=closest(),key=point?.id||"";
    if(key===lastNearby)return;lastNearby=key;
    if(point&&leaks.some(leak=>leak.id===point.id)&&!data.fixed.includes(point.id)){
      message="You hear a drip near "+point.name+". Press E to investigate.";callbacks.notify?.(message);window.ThirstAudio?.tone?.(350,.045);
    }render();
  }
  function draw2D(ctx,time,visible=active){
    if(!visible)return;const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ctx.save();
    for(const person of residents){
      const delivered=data.served.includes(person.id);
      ctx.fillStyle=delivered?"#78d49b":"#f6d683";ctx.beginPath();ctx.arc(person.x,person.y-29,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#173e40";ctx.font=`bold 12px ${FONT_FAMILY}`;ctx.textAlign="center";ctx.fillText(delivered?"✓":request()+"L",person.x,person.y-25);
    }
    for(const leak of leaks){
      const fixed=data.fixed.includes(leak.id);ctx.fillStyle=fixed?"#86b579":"#55c9d8aa";
      ctx.beginPath();ctx.ellipse(leak.x,leak.y,24,fixed?6:12,0,0,Math.PI*2);ctx.fill();
      if(!fixed&&!reduced){ctx.strokeStyle="#c2fff2";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(leak.x,leak.y,8+(time*9%14),4+(time*4%7),0,0,Math.PI*2);ctx.stroke();}
      if(data.found.includes(leak.id)){ctx.fillStyle="#15424b";ctx.font=`bold 12px ${FONT_FAMILY}`;ctx.textAlign="center";ctx.fillText(fixed?"✓ SEALED":"LEAK",leak.x,leak.y+27);}
    }
    if(data.upgrades.includes("station")){
      ctx.fillStyle="#e5ca6f";ctx.fillRect(410,493,40,45);ctx.fillStyle="#50c9cb";ctx.fillRect(417,510,26,22);ctx.fillStyle="#296867";ctx.fillRect(425,538,10,13);
    }
    const gardenLevel=(data.delivered.garden>0?1:0)+(data.upgrades.includes("irrigation")?2:0);
    if(gardenLevel){
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const x=585+col*18,y=470+row*17;ctx.fillStyle="#946b42";ctx.fillRect(x-5,y-3,13,10);
        ctx.fillStyle=gardenLevel>1?"#4fa969":"#8ec67c";ctx.beginPath();ctx.ellipse(x,y-5,4,7,-.4,0,Math.PI*2);ctx.fill();
      }
      if(gardenLevel>1){ctx.strokeStyle="#75e0d3";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(570,465);ctx.lineTo(570,520);ctx.lineTo(655,520);ctx.stroke();}
    }
    if(data.upgrades.includes("shade")){
      ctx.fillStyle="#77553d";ctx.fillRect(335,592,5,47);ctx.fillRect(390,592,5,47);ctx.fillStyle="#edce84";ctx.beginPath();ctx.moveTo(322,600);ctx.lineTo(365,572);ctx.lineTo(407,600);ctx.closePath();ctx.fill();ctx.fillStyle="#9b704e";ctx.fillRect(346,623,40,8);
    }
    if(data.delivered.school>0){for(let i=0;i<6;i++){ctx.fillStyle=i%2?"#f8d474":"#eab6bc";ctx.beginPath();ctx.arc(313+i*12,385+(i%2)*7,4,0,Math.PI*2);ctx.fill();}}
    const player=callbacks.getPlayer?.();
    if(player&&Number.isFinite(player.x)&&Number.isFinite(player.y)){
      ctx.fillStyle="#17383cde";ctx.fillRect(player.x-24,player.y-66,48,18);ctx.fillStyle="#f8e398";ctx.textAlign="center";ctx.font=`bold 11px ${FONT_FAMILY}`;ctx.fillText(data.jug+" / 8 L",player.x,player.y-53);
    }
    ctx.restore();
  }
  function build3D(THREE,{scene,wx,wz}){
    const root=new THREE.Group();root.name="VillageCommunityProjects";scene.add(root);
    const materials=[],geometries=[];
    const mat=(color,props={})=>{const material=new THREE.MeshStandardMaterial({color,roughness:.85,...props});materials.push(material);return material;};
    const wood=mat(0x95704c),yellow=mat(0xe8cb76),stone=mat(0xbec5a0),green=mat(0x65ac70),blue=mat(0x55d0d3,{transparent:true,opacity:.78}),skin=mat(0x996443),shirt=mat(0x65a6a0),pink=mat(0xe7af9b);
    const metal=mat(0x819a94,{metalness:.48,roughness:.42}),shadeCloth=mat(0xf4e4b7,{side:THREE.DoubleSide}),gardenSoil=mat(0x6d6047);
    const mesh=(geometry,material,x,y,z,parent=root)=>{geometries.push(geometry);const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);object.receiveShadow=true;parent.add(object);return object;};
    const projectGroups={};
    for(const project of projects){const group=new THREE.Group();group.position.set(wx(project.x),0,wz(project.y));root.add(group);projectGroups[project.id]=group;}
    const station=projectGroups.station;
    mesh(new THREE.BoxGeometry(.9,1.1,.7),yellow,0,.65,0,station);mesh(new THREE.BoxGeometry(.65,.6,.04),blue,0,.65,.37,station);
    mesh(new THREE.CylinderGeometry(.07,.07,.4,8),stone,.32,.85,.5,station).rotation.x=Math.PI/2;
    mesh(new THREE.BoxGeometry(1.3,.12,1.05),wood,0,1.4,0,station);
    // Distinct basin, splash guard and brass tap for the drinking-water station.
    mesh(new THREE.CylinderGeometry(.58,.62,.14,18),stone,0,.14,.55,station);
    const stationBasin=mesh(new THREE.CircleGeometry(.48,20),blue,0,.225,.56,station);
    stationBasin.rotation.x=-Math.PI/2;
    mesh(new THREE.CylinderGeometry(.045,.045,.38,10),metal,.32,.85,.52,station).rotation.x=Math.PI/2;
    mesh(new THREE.CylinderGeometry(.085,.085,.06,12),yellow,.32,1.02,.55,station);
    mesh(new THREE.TorusGeometry(.20,.035,6,18),metal,0,.95,.375,station);
    mesh(new THREE.SphereGeometry(.075,9,7),blue,.32,.64,.72,station);
    const shade=projectGroups.shade;
    for(const x of [-.7,.7])for(const z of [-.5,.5])mesh(new THREE.CylinderGeometry(.055,.055,1.6,6),wood,x,.8,z,shade);
    mesh(new THREE.ConeGeometry(1.1,.45,4),yellow,0,1.8,0,shade).rotation.y=Math.PI/4;
    mesh(new THREE.BoxGeometry(1.15,.12,.3),wood,0,.42,.25,shade);
    // Fabric, seating and planters help the gathering place read as a community hub.
    for(const side of [-1,1]){
      const panel=mesh(new THREE.BoxGeometry(.78,.045,1.28),shadeCloth,side*.40,1.67,0,shade);
      panel.rotation.z=side*.18;
      mesh(new THREE.BoxGeometry(1.08,.12,.26),wood,side*.50,.40,-.37,shade);
      for(const x of [-.45,.45])mesh(new THREE.BoxGeometry(.09,.36,.12),stone,side*.50+x,.20,-.37,shade);
      mesh(new THREE.CylinderGeometry(.19,.23,.22,9),stone,side*1.06,.14,.2,shade);
      for(let petal=0;petal<3;petal++){
        const leaf=mesh(new THREE.ConeGeometry(.10,.36,5),green,side*1.06+(petal-1)*.10,.40,.2,shade);
        leaf.rotation.z=(petal-1)*.22;
      }
    }
    const irrigation=projectGroups.irrigation;
    mesh(new THREE.BoxGeometry(.12,.12,1.7),blue,-1,.12,.25,irrigation);mesh(new THREE.BoxGeometry(2,.12,.12),blue,0,.12,1.1,irrigation);
    // Bordered channels and a working-style handwheel mark the irrigation upgrade.
    for(const side of [-1,1]){
      mesh(new THREE.BoxGeometry(.08,.23,1.8),stone,-1+side*.12,.13,.25,irrigation);
      mesh(new THREE.BoxGeometry(2.15,.20,.075),stone,0,.13,1.1+side*.12,irrigation);
    }
    mesh(new THREE.CylinderGeometry(.24,.28,.16,12),gardenSoil,-.98,.12,-.55,irrigation);
    const handle=mesh(new THREE.TorusGeometry(.19,.035,7,18),metal,-.98,.45,-.55,irrigation);
    handle.rotation.x=Math.PI/2;
    const gardens=new THREE.Group();gardens.position.set(wx(610),0,wz(480));root.add(gardens);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      mesh(new THREE.BoxGeometry(.31,.08,.24),wood,(col-1.5)*.42,.08,row*.38,gardens);
      const leaf=mesh(new THREE.ConeGeometry(.12,.34,5),green,(col-1.5)*.42,.27,row*.38,gardens);leaf.rotation.z=(col%2?1:-1)*.2;
    }
    const leakMeshes=[];
    for(const leak of leaks){
      const group=new THREE.Group();group.position.set(wx(leak.x),.065,wz(leak.y));root.add(group);
      const puddle=mesh(new THREE.CircleGeometry(.5,20),blue,0,0,0,group);puddle.rotation.x=-Math.PI/2;
      const pipe=mesh(new THREE.CylinderGeometry(.10,.10,.65,8),stone,0,.08,0,group);pipe.rotation.z=Math.PI/2;
      const drop=mesh(new THREE.SphereGeometry(.06,8,6),blue,0,.5,0,group);leakMeshes.push({id:leak.id,puddle,drop});
    }
    const people=[];
    for(const [i,person] of residents.entries()){
      const group=new THREE.Group();group.position.set(wx(person.x)-.55,0,wz(person.y)-.2);root.add(group);
      mesh(new THREE.CylinderGeometry(.16,.20,.42,8),i===1?pink:shirt,0,.55,0,group);mesh(new THREE.SphereGeometry(.15,10,8),skin,0,.94,0,group);
      for(const side of [-1,1])mesh(new THREE.CylinderGeometry(.06,.06,.36,6),wood,side*.09,.18,0,group);
      const arm=mesh(new THREE.CylinderGeometry(.055,.055,.36,6),i===1?pink:shirt,.22,.64,0,group);people.push({id:person.id,arm,group});
    }
    const jug=new THREE.Group();root.add(jug);
    mesh(new THREE.BoxGeometry(.36,.48,.23),yellow,0,.24,0,jug);const jugWater=mesh(new THREE.BoxGeometry(.25,.34,.025),blue,0,.23,.13,jug);
    const jugHandle=mesh(new THREE.TorusGeometry(.11,.025,5,12,Math.PI),yellow,0,.54,0,jug);
    const communityScenery=window.TrailScenicAssets?.mount?.(THREE,{
      parent:root,chapter:"village",wx,wz,
      getGraphics:()=>{
        try{return JSON.parse(localStorage.getItem("thirstTrailGraphics")||"null")||{preset:"high"};}
        catch{return {preset:"high"};}
      }
    });
    return {update(time,visible=active){
      root.visible=!!visible;if(!visible)return;
      communityScenery?.update();
      const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      for(const [id,group] of Object.entries(projectGroups))group.visible=data.upgrades.includes(id);
      gardens.visible=data.delivered.garden>0||data.upgrades.includes("irrigation");
      gardens.scale.y=data.upgrades.includes("irrigation")?1.35:1;
      for(const item of leakMeshes){const fixed=data.fixed.includes(item.id);item.puddle.visible=item.drop.visible=!fixed;item.drop.position.y=reduced?.25:.15+((time*.6)%1)*.6;}
      for(const person of people){person.arm.rotation.z=data.delivered[person.id]>0?2.2+(reduced?0:Math.sin(time*3)*.12):.1;}
      const player=callbacks.getPlayer?.();jug.visible=active&&!!player&&Number.isFinite(player.x)&&Number.isFinite(player.y);
      if(jug.visible){jug.position.set(wx(player.x)+.42,.1,wz(player.y));jugWater.scale.y=Math.max(.02,data.jug/8);jugWater.position.y=.06+.17*(data.jug/8);}
    },dispose(){communityScenery?.dispose();for(const geometry of new Set(geometries))geometry.dispose();for(const material of materials)material.dispose();scene.remove(root);}};
  }
  window.addEventListener("trail:mode",()=>{
    message="Difficulty set to "+(window.TrailMode?.profile?.().label||difficulty())+". Deliver "+request()+" litres per neighbour; your jug, completed work and repair steps are kept.";
    callbacks.onChange?.(snapshot());render();
  });
  window.TrailVillageLife=Object.freeze({init,open,close,interactNear,update,snapshot,draw2D,build3D,getDestinations});
})();
