"use strict";
/* Chapter 1's village water reward. Decorations never change routes or scores. */
(() => {
  const site={x:475,y:580};
  const clamp=value=>Math.max(0,Math.min(1,value));
  const restored=state=>!!state.done?.has("pump")&&state.screen!=="start";
  const age=(state,time,key)=>Number.isFinite(state[key])?Math.max(0,time-state[key]):0;
  function build(THREE,{scene,wx,wz}){
    const root=new THREE.Group();root.name="RestoredVillageWater";
    root.position.set(wx(site.x),0,wz(site.y));scene.add(root);
    const stone=new THREE.MeshStandardMaterial({color:0xd9cfab,roughness:.94});
    const rim=new THREE.MeshStandardMaterial({color:0xa5bca4,roughness:.9});
    const metal=new THREE.MeshStandardMaterial({color:0x8bb5ac,roughness:.45,metalness:.3});
    const water=new THREE.MeshStandardMaterial({color:0x5ddbd6,emissive:0x12515c,
      emissiveIntensity:.25,roughness:.2,metalness:.12,transparent:true,opacity:.92});
    const foam=new THREE.MeshBasicMaterial({color:0xe2fff1,transparent:true,opacity:.85});
    const leaf=new THREE.MeshStandardMaterial({color:0x71bb79,roughness:1,flatShading:true});
    const skin=new THREE.MeshStandardMaterial({color:0x955e3c,roughness:.9});
    const shirts=[0xf2c45d,0x54a59e,0xe79d87].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
    const dark=new THREE.MeshStandardMaterial({color:0x34535a,roughness:1});
    const add=(geometry,material,x,y,z,parent=root)=>{
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
      mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    const cylinder=(material,x,y,z,top,bottom,height,segments=20,parent=root)=>
      add(new THREE.CylinderGeometry(top,bottom,height,segments),material,x,y,z,parent);
    cylinder(stone,0,.08,0,1.62,1.72,.22,28);
    cylinder(rim,0,.28,0,1.35,1.45,.26,28);
    const basinWater=add(new THREE.CircleGeometry(1.25,32),water,0,.43,0);
    basinWater.rotation.x=-Math.PI/2;
    const basinRim=add(new THREE.TorusGeometry(1.33,.11,8,32),stone,0,.46,0);
    basinRim.rotation.x=-Math.PI/2;
    cylinder(stone,0,1.04,0,.19,.27,1.30,12);
    cylinder(stone,0,1.63,0,.58,.33,.26,20);
    const upperWater=add(new THREE.CircleGeometry(.48,24),water,0,1.78,0);
    upperWater.rotation.x=-Math.PI/2;
    cylinder(metal,0,1.87,0,.08,.12,.30,12);
    const jets=new THREE.Group();root.add(jets);
    // New repair stages leave visible evidence before the final release:
    // parts arrive, then the tested feed line holds water behind the valve.
    const feed=new THREE.Group();root.add(feed);
    const feedWindows=[];
    for(let i=0;i<3;i++){
      const casing=add(new THREE.CylinderGeometry(.12,.12,.68,10),metal,-2.8+i*.65,.18,-.35,feed);
      casing.rotation.z=Math.PI/2;
      const window=add(new THREE.BoxGeometry(.46,.035,.10),water,-2.8+i*.65,.30,-.35,feed);
      feedWindows.push(window);
    }
    const jet=add(new THREE.CylinderGeometry(.065,.085,.73,10),water,0,2.22,0,jets);
    const crown=add(new THREE.SphereGeometry(.12,10,6),foam,0,2.61,0,jets);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+.4,dx=Math.cos(a),dz=Math.sin(a);
      const curve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(dx*.2,1.80,dz*.2),new THREE.Vector3(dx*.62,1.6,dz*.62),
        new THREE.Vector3(dx*.93,1.0,dz*.93),new THREE.Vector3(dx*1.03,.45,dz*1.03)
      ]);
      add(new THREE.TubeGeometry(curve,12,.038,5,false),water,0,0,0,jets);
    }
    // The open trough carries visible water to a second collection basin.
    const start={x:.95,z:.6},end={x:3.35,z:2.3};
    const length=Math.hypot(end.x-start.x,end.z-start.z),angle=Math.atan2(end.x-start.x,end.z-start.z);
    const trough=new THREE.Group();trough.position.set(start.x,.2,start.z);trough.rotation.y=angle;root.add(trough);
    const troughPiece=(material,x,y,w,h)=>add(new THREE.BoxGeometry(w,h,length),material,x,y,length/2,trough);
    troughPiece(stone,0,.02,.65,.16);
    for(const side of [-1,1])troughPiece(rim,side*.34,.13,.10,.32);
    const channel=troughPiece(water,0,.14,.57,.035);
    cylinder(stone,end.x,.23,end.z+.25,.92,1.02,.34,24);
    const poolWater=add(new THREE.CircleGeometry(.84,28),water,end.x,.43,end.z+.25);
    poolWater.rotation.x=-Math.PI/2;
    const glints=[];
    for(let i=0;i<6;i++)glints.push(add(new THREE.BoxGeometry(.32,.012,.07),foam,0,0,0,trough));
    const ripples=[];
    for(let i=0;i<3;i++){
      const ring=add(new THREE.TorusGeometry(.28,.014,5,32),foam,0,.455+i*.002,0);
      ring.rotation.x=-Math.PI/2;ripples.push(ring);
    }
    const plants=[];
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2;
      const plant=new THREE.Group();plant.position.set(end.x+Math.cos(a)*1.3,.16,end.z+.25+Math.sin(a)*1.3);
      for(let j=0;j<3;j++){
        const blade=add(new THREE.ConeGeometry(.14,.54,5),leaf,(j-1)*.12,.23,0,plant);
        blade.rotation.z=(j-1)*-.35;
      }
      root.add(plant);plants.push(plant);
    }
    const villagers=[];
    for(const [i,x,z] of [[0,-2.1,1.5],[1,1.6,-1.8],[2,4.6,3.4]]){
      const person=new THREE.Group();person.position.set(x,.05,z);person.rotation.y=i===0?.7:-.4;
      cylinder(shirts[i],0,.63,0,.18,.23,.48,8,person);
      add(new THREE.SphereGeometry(.16,10,8),skin,0,1.04,0,person);
      for(const side of [-1,1]){
        cylinder(dark,side*.105,.22,0,.075,.07,.42,7,person);
        const arm=new THREE.Group();arm.position.set(side*.22,.82,0);person.add(arm);
        cylinder(shirts[i],0,-.16,0,.065,.07,.33,7,arm);
        add(new THREE.SphereGeometry(.07,8,6),skin,0,-.36,0,arm);
        arm.userData.side=side;villagers.push({arm,person,phase:i});
      }
      root.add(person);
    }
    const sparkles=[];
    for(let i=0;i<24;i++)sparkles.push(add(new THREE.OctahedronGeometry(.045,0),foam,0,0,0));
    return {
      update(state,time,{reduced=false,effects=true}={}){
        const active=restored(state),t=age(state,time,"villageWaterAt");
        feed.visible=state.screen!=="start"&&(active||state.done?.has("gasket")&&state.done?.has("toolkit"));
        for(let i=0;i<feedWindows.length;i++)feedWindows[i].visible=active||!!state.pipeReady;
        const fill=reduced?1:clamp(t/1.9),cheerAge=age(state,time,"villageCheerAt");
        const cheering=active&&(t<5||(Number(state.villageCheerAt)>0&&cheerAge<3));
        jets.visible=basinWater.visible=upperWater.visible=channel.visible=poolWater.visible=active;
        jets.scale.y=reduced?1:clamp(t/.75);
        basinWater.scale.setScalar(Math.max(.001,fill));
        upperWater.scale.setScalar(Math.max(.001,fill));
        channel.scale.z=Math.max(.001,fill);channel.position.z=length*fill/2;
        poolWater.scale.setScalar(reduced?1:Math.max(.001,clamp((t-.75)/1.5)));
        crown.scale.setScalar(reduced||!effects?1:1+Math.sin(time*8)*.10);
        jet.scale.x=jet.scale.z=reduced||!effects?1:1+Math.sin(time*6)*.05;
        for(let i=0;i<glints.length;i++){
          const p=(time*.28+i/6)%1;glints[i].visible=active&&!reduced&&effects&&p<fill;
          glints[i].position.set(Math.sin(i)*.10,.17,p*length);
        }
        for(let i=0;i<ripples.length;i++){
          ripples[i].visible=active;
          ripples[i].scale.setScalar(reduced||!effects?1+i:1+((time*.4+i/3)%1)*3.1);
        }
        for(const plant of plants){plant.visible=active;plant.scale.setScalar(reduced?1:clamp((t-.75)/1.5));}
        for(const {arm,person,phase} of villagers){
          person.visible=active;
          arm.rotation.z=active?arm.userData.side*(cheering?(reduced?2.2:2.2+Math.sin(time*5+phase)*.2):.08):0;
        }
        for(let i=0;i<sparkles.length;i++){
          const p=(time*.35+i/24)%1,spark=sparkles[i];
          spark.visible=cheering&&!reduced&&effects;
          spark.position.set(Math.sin(i*2.4)*2.7,.5+p*3.6,Math.cos(i*2.4)*2.5);
          spark.rotation.z=time+i;
        }
      },
      getFocus(){return {x:root.position.x+1.2,y:.9,z:root.position.z+.7};},
      dispose(){
        const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
        for(const geometry of geometries)geometry.dispose();
        for(const material of [stone,rim,metal,water,foam,leaf,skin,dark,...shirts])material.dispose();
        scene.remove(root);
      }
    };
  }
  function draw2D(ctx,state,time){
    const active=restored(state),reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t=age(state,time,"villageWaterAt"),fill=reduced?1:clamp(t/1.9);
    const x=site.x,y=site.y;
    ctx.save();ctx.lineCap="round";
    ctx.strokeStyle="#9b987d";ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(x+30,y+20);ctx.lineTo(x+135,y+92);ctx.stroke();
    ctx.fillStyle="#c7c6a5";ctx.beginPath();ctx.ellipse(x,y,59,39,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+135,y+102,39,27,0,0,Math.PI*2);ctx.fill();
    if(active){
      ctx.strokeStyle="#65e4dc";ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(x+30,y+20);ctx.lineTo(x+30+105*fill,y+20+72*fill);ctx.stroke();
      ctx.fillStyle="#4dcbd0";ctx.beginPath();ctx.ellipse(x,y,50*Math.max(.01,fill),31*Math.max(.01,fill),0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+135,y+102,31*Math.max(.01,fill),20*Math.max(.01,fill),0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#d3fff0";ctx.lineWidth=3;
      if(!reduced){ctx.setLineDash([7,13]);ctx.lineDashOffset=-time*22;ctx.beginPath();ctx.moveTo(x+30,y+20);ctx.lineTo(x+135,y+92);ctx.stroke();ctx.setLineDash([]);}
      ctx.beginPath();ctx.ellipse(x,y,18+(reduced?0:time*12%24),10+(reduced?0:time*7%14),0,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle="#9fb8a2";ctx.fillRect(x-8,y-53,16,55);
    ctx.beginPath();ctx.ellipse(x,y-52,24,13,0,0,Math.PI*2);ctx.fill();
    if(active){
      ctx.strokeStyle="#90f0e5";ctx.lineWidth=5;
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(x,y-55);ctx.quadraticCurveTo(x+side*37,y-53,x+side*37,y+1);ctx.stroke();
      }
      ctx.beginPath();ctx.moveTo(x,y-52);ctx.lineTo(x,y-82);ctx.stroke();
      for(const [px,py] of [[x+90,y+90],[x+178,y+113],[x+136,y+143]]){
        ctx.fillStyle="#65b778";ctx.beginPath();ctx.ellipse(px,py,8,15,-.4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(px+11,py-4,7,14,.4,0,Math.PI*2);ctx.fill();
      }
      const cheering=t<5||(Number(state.villageCheerAt)>0&&age(state,time,"villageCheerAt")<3);
      for(const [i,px,py] of [[0,x-79,y+40],[1,x+64,y-63],[2,x+190,y+130]]){
        ctx.fillStyle=["#f2c45d","#54a59e","#e79d87"][i];ctx.fillRect(px-7,py-10,14,20);
        ctx.fillStyle="#955e3c";ctx.beginPath();ctx.arc(px,py-18,7,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="#955e3c";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px-7,py-6);ctx.lineTo(px-16,py+(cheering?-22:3));ctx.moveTo(px+7,py-6);ctx.lineTo(px+16,py+(cheering?-22:3));ctx.stroke();
      }
    }
    ctx.restore();
  }
  window.TrailValleyRestoration=Object.freeze({build,draw2D});
})();
