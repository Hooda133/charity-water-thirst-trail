"use strict";
/* Stormbreak Coast: procedural scenery only. Routes, puzzles and saves live in coast.js. */
(() => {
  function build(THREE,{scene,getState,wx=x=>(x-500)/24,wz=y=>(y-305)/24}){
    const root=new THREE.Group();root.name="StormbreakCoastScenery";scene.add(root);
    let seed=732061;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
    const mats={sand:material(0xe7d3a0),edge:material(0xc6ba94),rock:material(0x849b97),
      grass:material(0x9cbf93),wood:material(0x94735b),paleWood:material(0xd3b98c),
      white:material(0xf2ead4),coral:material(0xca836b),teal:material(0x4f999b),
      metal:material(0x738e8c,{metalness:.35,roughness:.5}),gold:material(0xd9ba6b,{metalness:.25}),
      dark:material(0x34545d),leaf:material(0x66a77c),skin:material(0xa06d49),
      sea:material(0x398eaa,{roughness:.35,metalness:.08}),
      water:material(0x68e0d8,{roughness:.22,metalness:.12,emissive:0x145b67,emissiveIntensity:.22,transparent:true,opacity:.91}),
      foam:new THREE.MeshBasicMaterial({color:0xd4f2e8,transparent:true,opacity:.65,depthWrite:false}),
      lamp:new THREE.MeshStandardMaterial({color:0xffe6a0,emissive:0xe8b85e,emissiveIntensity:.3,roughness:.6})};
    const add=(geometry,mat,x=0,y=0,z=0,parent=root,shadow=true)=>{
      const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;
      parent.add(mesh);return mesh;
    };
    const box=(mat,x,y,z,w,h,d,parent=root,shadow=true)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent,shadow);
    const cylinder=(mat,x,y,z,top,bottom,height,n=16,parent=root)=>add(new THREE.CylinderGeometry(top,bottom,height,n),mat,x,y,z,parent);
    const ball=(mat,x,y,z,r,parent=root)=>add(new THREE.IcosahedronGeometry(r,1),mat,x,y,z,parent);
    const groupAt=(x,y)=>{const g=new THREE.Group();g.position.set(wx(x),0,wz(y));root.add(g);return g;};
    const done=key=>!!getState()?.done?.has(key);
    const clamp=value=>Math.max(0,Math.min(1,value));

    // Two low coastal shelves border the tidal inlet. Walkable tops are at y=0.
    box(mats.sea,0,-1.18,1,125,.12,104,root,false);
    box(mats.sand,wx(255),-.51,wz(325),430/24,1,470/24);
    box(mats.sand,wx(765),-.51,wz(325),390/24,1,470/24);
    box(mats.grass,wx(250),.008,wz(235),15,.025,9,root,false);
    box(mats.grass,wx(765),.008,wz(230),13.6,.025,8.6,root,false);
    const beachEdges=[];
    for(const side of [0,1]){
      const cx=side?wx(765):wx(255),width=side?390/24:430/24;
      const slope=box(mats.edge,cx,-.48,wz(572),width+.15,.22,1.30,root,false);slope.rotation.x=-.24;
      beachEdges.push(slope);
      for(let i=0;i<15;i++){
        const x=cx-width/2+.45+i*(width-.9)/14;
        const rock=ball(i%3?mats.rock:mats.edge,x,-.34,wz(583)+rand()*.2,.25+rand()*.32);
        rock.scale.set(1.25,.55,1);
      }
    }
    // Stone inlet retaining edges preserve the exact bridge crossing corridor.
    for(const logicalX of [468,572])for(const logicalY of [105,150,195,240,285,440,485,530]){
      const stone=box(mats.rock,wx(logicalX),-.28,wz(logicalY),.35,.56,1.55);
      stone.rotation.y=(rand()-.5)*.08;
    }
    // Raised distant headland, safely beyond the gameplay boundary.
    for(let i=0;i<12;i++){
      const x=-23+i*4.2,z=wz(54)-(i%3)*.6;
      const rock=add(new THREE.CylinderGeometry(1.1,1.65,1.2+rand()*1.3,7),i%2?mats.rock:mats.edge,x,.15,z);
      rock.rotation.y=rand()*Math.PI;
    }
    const waves=[];
    for(let row=0;row<7;row++){
      const wave=box(mats.foam,-17+row*5,-.99,wz(615)+row*.85,3.8+rand()*3,.018,.065,root,false);
      waves.push({mesh:wave,z:wave.position.z,phase:row*.8});
    }
    // Footpaths connect all landmark approaches without crossing the closed inlet.
    const path=(a,b,width=.78)=>{
      const ax=wx(a[0]),az=wz(a[1]),bx=wx(b[0]),bz=wz(b[1]);
      const length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);
      const strip=box(mats.paleWood,(ax+bx)/2,.012,(az+bz)/2,width,.025,length,root,false);
      strip.rotation.y=angle;
    };
    for(const [a,b] of [ [[165,370],[260,355]],[[260,355],[340,242]],[[260,355],[445,365]],
      [[595,365],[690,330]],[[690,330],[740,245]],[[690,330],[850,390]],[[850,390],[865,485]] ])path(a,b);

    // The lighthouse is a coastal silhouette outside the playable upper boundary.
    const lighthouse=groupAt(90,58);
    cylinder(mats.rock,0,.14,0,1.7,1.9,.38,20,lighthouse);
    cylinder(mats.white,0,2.1,0,.66,1.0,4.2,20,lighthouse);
    for(const y of [1.2,2.5])cylinder(mats.teal,0,y,0,.88-y*.045,.90-y*.045,.46,20,lighthouse);
    cylinder(mats.dark,0,4.25,0,1.06,1.06,.18,20,lighthouse);
    cylinder(mats.lamp,0,4.68,0,.59,.59,.72,16,lighthouse);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;box(mats.metal,Math.cos(a)*.63,4.68,Math.sin(a)*.63,.07,.90,.07,lighthouse);
    }
    const lightRoof=add(new THREE.ConeGeometry(.93,.7,12),mats.coral,0,5.40,0,lighthouse);
    const beacon=add(new THREE.ConeGeometry(1.4,5.3,16,1,true),new THREE.MeshBasicMaterial({color:0xffedaf,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}),0,4.68,2.6,lighthouse,false);
    beacon.rotation.x=Math.PI/2;

    // Backup power station: visible breaker lamps and a working turbine rotor.
    const station=groupAt(340,180);
    box(mats.rock,0,.12,0,3.3,.26,2.7,station);
    box(mats.white,0,1.23,0,2.6,2.2,1.9,station);
    box(mats.teal,0,2.43,0,2.92,.25,2.17,station);
    box(mats.dark,0,1.28,1.0,1.8,1.2,.1,station);
    const lamps=[];
    for(let i=0;i<4;i++){
      const lampMat=material(0x6b817b,{emissive:0x000000,emissiveIntensity:.6});
      lamps.push(add(new THREE.SphereGeometry(.105,10,8),lampMat,-.57+i*.38,1.52,1.09,station));
      box(mats.gold,-.57+i*.38,1.05,1.08,.19,.28,.10,station);
    }
    const rotor=new THREE.Group();rotor.position.set(-1.7,1.5,-.1);station.add(rotor);
    cylinder(mats.metal,-1.7,.77,-.1,.09,.13,1.7,10,station);
    for(let i=0;i<3;i++){
      const blade=box(mats.teal,0,.55,0,.17,1.2,.07,rotor);blade.rotation.z=i*Math.PI*2/3;
      blade.position.set(Math.sin(i*Math.PI*2/3)*.45,Math.cos(i*Math.PI*2/3)*.45,0);
    }
    ball(mats.gold,0,0,.05,.16,rotor);

    // Cargo bridge and its real counterweight silhouette straddle the inlet.
    const bridge=groupAt(520,365),deck=new THREE.Group();bridge.add(deck);
    for(let i=0;i<18;i++)box(i%2?mats.wood:mats.paleWood,-2.52+i*.30,-.08,0,.285,.16,2.7,deck);
    for(const side of [-1,1]){
      box(mats.dark,0,.84,side*1.46,5.7,.09,.09,deck);
      for(const x of [-2.55,-1.25,0,1.25,2.55])box(mats.wood,x,.42,side*1.46,.11,.94,.11,deck);
      for(const x of [-2.8,2.8]){
        box(mats.metal,x,1.35,side*1.95,.15,2.7,.17,bridge);
        const pulley=add(new THREE.TorusGeometry(.22,.06,7,16),mats.gold,x,2.70,side*1.95,bridge);
        pulley.rotation.y=Math.PI/2;
      }
      box(mats.metal,0,2.68,side*1.95,5.8,.10,.10,bridge);
    }
    const weightBlocks=[];
    for(let i=0;i<3;i++){
      const weight=box(mats.dark,-1.5+i*1.4,.5,-2.0,.52,.44,.52,bridge);weightBlocks.push(weight);
      box(mats.metal,-1.5+i*1.4,1.6,-2.0,.035,2.0,.035,bridge);
    }

    // Storage tank: three patches replace storm damage progressively.
    const tank=groupAt(740,180);
    cylinder(mats.rock,0,.10,0,1.6,1.7,.25,24,tank);
    cylinder(mats.teal,0,1.55,0,1.25,1.34,2.8,24,tank);
    for(const y of [.35,1.5,2.65]){
      const band=add(new THREE.TorusGeometry(1.29,.07,7,28),mats.metal,0,y,0,tank);band.rotation.x=Math.PI/2;
    }
    cylinder(mats.white,0,3.02,0,1.42,1.3,.20,24,tank);
    const patches=[];
    for(let i=0;i<3;i++){
      const patch=box(mats.gold,-.56+i*.56,.77+i*.48,1.23,.40,.40,.10,tank);
      patches.push(patch);
      for(const side of [-1,1])ball(mats.dark,-.56+i*.56+side*.13,.77+i*.48+.12,1.30,.035,tank);
    }
    const pipe=cylinder(mats.metal,1.5,.95,0,.14,.14,1.2,10,tank);pipe.rotation.z=Math.PI/2;
    const tankLevel=box(mats.dark,-.72,1.6,1.28,.15,1.7,.05,tank);
    const levelWater=box(mats.water,-.72,1.6,1.32,.09,1.55,.015,tank);

    // Three controllable sluices lead to a communal distribution fountain.
    const controls=groupAt(835,375),gateWheels=[];
    box(mats.rock,0,.12,0,1.7,.3,1.15,controls);
    for(let i=0;i<3;i++){
      const wheel=add(new THREE.TorusGeometry(.20,.045,7,18),mats.gold,-.5+i*.5,.85,0,controls);
      gateWheels.push(wheel);cylinder(mats.metal,-.5+i*.5,.43,0,.05,.05,.8,8,controls);
    }
    const waterRuns=[],flowMarks=[];
    function channel(a,b){
      const ax=wx(a[0]),az=wz(a[1]),bx=wx(b[0]),bz=wz(b[1]);
      const length=Math.hypot(bx-ax,bz-az),g=new THREE.Group();g.position.set(ax,.08,az);g.rotation.y=Math.atan2(bx-ax,bz-az);root.add(g);
      box(mats.edge,0,.02,length/2,.76,.13,length,g);
      for(const side of [-1,1])box(mats.white,side*.38,.14,length/2,.10,.28,length,g);
      const water=box(mats.water,0,.15,length/2,.64,.04,length,g);
      waterRuns.push({mesh:water,length});
      for(let i=0;i<5;i++)flowMarks.push({mesh:box(mats.foam,0,.18,0,.35,.015,.08,g,false),length,phase:i/5});
    }
    channel([778,180],[930,250]);channel([930,250],[930,440]);channel([930,440],[897,440]);
    const fountain=groupAt(870,440);
    cylinder(mats.edge,0,.15,0,1.30,1.42,.34,28,fountain);
    cylinder(mats.white,0,.34,0,1.17,1.26,.22,28,fountain);
    const pool=add(new THREE.CircleGeometry(1.12,28),mats.water,0,.47,0,fountain);pool.rotation.x=-Math.PI/2;
    cylinder(mats.white,0,.91,0,.15,.22,1.2,12,fountain);
    cylinder(mats.gold,0,1.56,0,.43,.26,.22,18,fountain);
    const jet=add(new THREE.CylinderGeometry(.065,.09,.78,10),mats.water,0,1.93,0,fountain);
    const fall=new THREE.Group();fountain.add(fall);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a)*.18,1.6,Math.sin(a)*.18),new THREE.Vector3(Math.cos(a)*.64,1.40,Math.sin(a)*.64),new THREE.Vector3(Math.cos(a)*.9,.47,Math.sin(a)*.9)]);
      add(new THREE.TubeGeometry(curve,10,.028,5,false),mats.water,0,0,0,fall);
    }
    const rings=[];
    for(let i=0;i<3;i++){
      const ring=add(new THREE.TorusGeometry(.27,.012,5,28),mats.foam,0,.49+i*.002,0,fountain,false);ring.rotation.x=-Math.PI/2;rings.push(ring);
    }
    const plants=[];
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,g=new THREE.Group();g.position.set(Math.cos(angle)*1.62,.18,Math.sin(angle)*1.62);fountain.add(g);
      for(let blade=0;blade<3;blade++){
        const leaf=add(new THREE.ConeGeometry(.13,.55,5),mats.leaf,(blade-1)*.13,.22,0,g);leaf.rotation.z=(blade-1)*-.35;
      }plants.push(g);
    }

    // Whitewashed cottages, coral roofs and a clearly marked coastal clinic.
    function cottage(x,y,roofMat=mats.coral,clinic=false){
      const g=groupAt(x,y);box(mats.edge,0,.1,0,2.6,.22,2.2,g);
      box(mats.white,0,.95,0,2.2,1.7,1.8,g);
      const roof=add(new THREE.ConeGeometry(1.8,1.02,4),roofMat,0,2.23,0,g);roof.rotation.y=Math.PI/4;
      box(mats.wood,0,.70,1,.48,1.16,.08,g);
      for(const side of [-1,1])box(mats.teal,side*.75,1.14,.94,.4,.48,.05,g);
      if(clinic){box(mats.coral,0,1.55,1.01,.62,.16,.05,g);box(mats.coral,0,1.55,1.02,.16,.62,.05,g);}
      else box(mats.paleWood,0,.28,1.35,1.15,.17,.58,g);
    }
    cottage(790,515);cottage(920,505,mats.teal);cottage(815,445,mats.teal,true);

    // Dock, skiffs and buoys sit in the sea, away from the playable coast.
    const dock=new THREE.Group();dock.position.set(wx(210),-.35,wz(585));root.add(dock);
    for(let i=0;i<9;i++)box(mats.wood,0,.02,i*.38,1.45,.13,.34,dock);
    for(const side of [-1,1])for(const z of [0,1.5,3.0])cylinder(mats.paleWood,side*.78,-.22,z,.06,.08,.9,8,dock);
    for(const [x,z,color] of [[wx(300),wz(660),mats.coral],[wx(770),wz(650),mats.teal]]){
      const boat=new THREE.Group();boat.position.set(x,-.85,z);boat.rotation.y=-.4;root.add(boat);
      const hull=add(new THREE.SphereGeometry(1,12,8),color,0,0,0,boat);hull.scale.set(.6,.25,1.5);
      box(mats.paleWood,0,.18,0,.72,.07,1.65,boat);cylinder(mats.wood,0,.6,0,.035,.035,1.1,8,boat);
    }
    for(let i=0;i<8;i++){
      const buoy=ball(i%2?mats.coral:mats.white,-17+i*5,-.67,wz(640)+(i%3)*1.3,.16);buoy.scale.y=1.4;
    }
    // A few storm-tossed panels disappear as the corresponding repair finishes.
    const debris=[];
    for(const [key,x,y] of [["power",280,145],["power",385,160],["tank",700,150],["tank",785,220],["bridge",430,300],["bridge",595,425]]){
      const plank=box(mats.wood,wx(x),.11,wz(y),.9,.12,.32);plank.rotation.y=rand()*Math.PI;
      debris.push({key,mesh:plank});
    }
    // Named story characters and two residents visibly share the final reward.
    const people=[];
    function person(x,y,shirt,scale=1){
      const g=groupAt(x,y);g.scale.setScalar(scale);
      cylinder(shirt,0,.66,0,.18,.22,.48,9,g);ball(mats.skin,0,1.06,0,.17,g);
      for(const side of [-1,1]){
        cylinder(mats.dark,side*.1,.23,0,.07,.075,.43,7,g);
        const arm=new THREE.Group();arm.position.set(side*.23,.86,0);g.add(arm);
        cylinder(shirt,0,-.16,0,.065,.07,.34,7,arm);ball(mats.skin,0,-.37,0,.065,arm);
        people.push({arm,side,phase:x*.01});
      }
      return g;
    }
    const mara=person(150,350,mats.gold);box(mats.white,0,1.25,0,.40,.1,.35,mara);
    person(843,485,mats.coral);person(905,462,mats.teal,.78);
    const sparks=[];
    for(let i=0;i<24;i++)sparks.push(add(new THREE.OctahedronGeometry(.045,0),mats.foam,0,0,0,fountain,false));

    return {
      update(time,{reduced=false,effects=true}={}){
        const state=getState()||{},finished=!!state.finished;
        const t=Number.isFinite(time)?time:0;
        const since=Number.isFinite(state.waterAt)?Math.max(0,t-state.waterAt):0;
        const fill=reduced?1:clamp(since/2.4);
        deck.rotation.z=done("bridge")?0:-.14;
        for(let i=0;i<weightBlocks.length;i++)weightBlocks[i].scale.y=.7+(Number(state.weights?.[i])||0)*.24;
        for(let i=0;i<lamps.length;i++){
          const lit=done("power")||!!state.power?.[i];
          lamps[i].material.color.setHex(lit?0x92e4b7:0x7a7269);lamps[i].material.emissive.setHex(lit?0x3d845f:0x000000);
        }
        if(done("power")&&!reduced&&effects)rotor.rotation.z=t*.9;
        else rotor.rotation.z=0;
        mats.lamp.emissiveIntensity=done("power")?1.0:.20;
        beacon.visible=done("power")&&effects;
        beacon.rotation.z=reduced?0:Math.sin(t*.35)*.28;
        for(let i=0;i<patches.length;i++)patches[i].visible=done("tank")||Number(state.tankStep)>i;
        levelWater.visible=done("tank");
        for(let i=0;i<gateWheels.length;i++)gateWheels[i].rotation.z=-(Number(state.gates?.[i])||0)*.6;
        for(const item of debris)item.mesh.visible=!done(item.key);
        pool.visible=jet.visible=fall.visible=finished;
        pool.scale.setScalar(Math.max(.001,fill));jet.scale.y=reduced?1:clamp(since/.8);
        for(const run of waterRuns){
          run.mesh.visible=finished;run.mesh.scale.z=Math.max(.001,fill);run.mesh.position.z=run.length*fill/2;
        }
        for(const mark of flowMarks){
          const p=(t*.25+mark.phase)%1;mark.mesh.visible=finished&&!reduced&&effects&&p<fill;mark.mesh.position.z=mark.length*p;
        }
        for(let i=0;i<rings.length;i++){
          rings[i].visible=finished;rings[i].scale.setScalar(reduced||!effects?1+i:1+((t*.38+i/3)%1)*2.8);
        }
        for(const plant of plants){plant.visible=finished;plant.scale.setScalar(reduced?1:clamp((since-.6)/1.5));}
        const cheerAge=Number.isFinite(state.cheerAt)?Math.max(0,t-state.cheerAt):since;
        const cheering=finished&&(since<5||cheerAge<3);
        for(const p of people)p.arm.rotation.z=p.side*(cheering?(reduced?2.1:2.1+Math.sin(t*5+p.phase)*.18):.12);
        for(let i=0;i<sparks.length;i++){
          const phase=(t*.34+i/24)%1,spark=sparks[i];spark.visible=cheering&&!reduced&&effects;
          spark.position.set(Math.sin(i*2.4)*2.2,.6+phase*3.2,Math.cos(i*2.4)*2.2);spark.rotation.z=t+i;
        }
        for(const wave of waves)wave.mesh.position.z=wave.z+(reduced||!effects?0:Math.sin(t*.6+wave.phase)*.22);
      },
      getFocus(){return {x:wx(855),y:.85,z:wz(430)};},
      dispose(){
        const geometries=new Set(),materials=new Set();
        root.traverse(object=>{
          if(object.geometry)geometries.add(object.geometry);
          for(const m of (Array.isArray(object.material)?object.material:object.material?[object.material]:[]))materials.add(m);
        });
        for(const geometry of geometries)geometry.dispose();
        for(const mat of materials)mat.dispose();scene.remove(root);
      }
    };
  }
  window.TrailCoastVisuals=Object.freeze({build});
})();
