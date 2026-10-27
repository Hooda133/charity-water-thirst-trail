"use strict";
/* Forgotten Canyon's authored visual pass. Purely decorative: world/quest coordinates,
   collision, saved progress, renderer ownership and 2D fallback remain in canyon.js. */
(() => {
  function build(THREE, {scene, camera, worldSpread, getState, isWaterGarden=()=>false, surfaces=null}) {
    let seed=782331;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const props=[],extraMaps=[],valveWheels=[],oasis=[];
    const pbr=(material,kind,repeat=[1,1],tint=null,strength=.35)=>{
      surfaces?.apply?.(material,kind,repeat,tint,strength);
      return material;
    };
    const add=(geometry,material,x=0,y=0,z=0,shadow=false)=>{
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;
      scene.add(mesh);props.push(mesh);return mesh;
    };
    function texture(kind,repeatX=1,repeatY=1){
      const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
      const g=canvas.getContext("2d");
      if(!g)return null;
      const w=256,h=256;
      // Tileable base color and subtle grains. The warm canyon palette matches
      // the textured, illustrated PBR look used by Greenwater Valley.
      const colors=kind==="water"?["#72c9c6","#9ce5d4","#51acb8","#a3e4d7"]:
        kind==="rock"?["#e0aa83","#cb8c70","#b77a64","#f1bf91"]:
        kind==="sand"?["#e7bf8b","#d2a676","#f0d1a2","#c89669"]:
        kind==="masonry"?["#cdb190","#a78970","#e1c29b","#b79579"]:
        ["#c0a48b","#e2b491","#ac8a74","#d1a185"];
      g.fillStyle=colors[0];g.fillRect(0,0,w,h);
      for(let n=0;n<7200;n++){
        g.fillStyle=colors[Math.floor(rand()*colors.length)];
        g.globalAlpha=.03+rand()*.18;
        const x=rand()*w,y=rand()*h;
        g.fillRect(x,y,.7+rand()*4,.5+rand()*2.8);
      }
      g.globalAlpha=1;
      if(kind==="rock"||kind==="masonry"){
        for(let y=3;y<h;y+=9+Math.floor(rand()*12)){
          g.strokeStyle=rand()>.4?"rgba(104,65,54,.20)":"rgba(255,224,177,.34)";
          g.lineWidth=1+rand()*3;g.beginPath();
          g.moveTo(0,y);g.bezierCurveTo(68,y-2,163,y+3,256,y-1);g.stroke();
        }
      }
      if(kind==="masonry"){
        g.lineWidth=2;g.strokeStyle="rgba(86,70,56,.29)";
        for(let row=0;row<8;row++){
          const y=row*32;g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();
          for(let x=(row%2)*30;x<256;x+=64){
            g.beginPath();g.moveTo(x,y);g.lineTo(x,y+32);g.stroke();
          }
        }
      }
      const map=new THREE.CanvasTexture(canvas);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.repeat.set(repeatX,repeatY);
      map.anisotropy=2;map.colorSpace=THREE.SRGBColorSpace;
      return map;
    }
    const terrainMap=texture("sand",5,6),stoneMap=texture("rock",2,3),
      blockMap=texture("masonry",2,2),waterMap=texture("water",1,5);
    const sandMat=new THREE.MeshStandardMaterial({
      color:0xf1d5b6,map:terrainMap,roughness:.96,metalness:0
    });
    const stoneMat=new THREE.MeshStandardMaterial({
      color:0xe3ad82,map:stoneMap,roughness:.95,flatShading:true
    });
    const accentMat=new THREE.MeshStandardMaterial({
      color:0xf4d6aa,map:blockMap,roughness:.94,flatShading:true
    });
    const deepStone=new THREE.MeshStandardMaterial({
      color:0xa97765,map:stoneMap,roughness:.99,flatShading:true
    });
    const wood=new THREE.MeshStandardMaterial({color:0x936647,roughness:.89});
    const metal=new THREE.MeshStandardMaterial({color:0x718f8c,metalness:.54,roughness:.49});
    const copper=new THREE.MeshStandardMaterial({color:0xc1a075,metalness:.47,roughness:.53});
    const grass=new THREE.MeshStandardMaterial({color:0x889976,roughness:1,flatShading:true});
    const brine=new THREE.MeshStandardMaterial({
      color:0x73cbd0,map:waterMap,roughness:.31,metalness:.08,
      transparent:true,opacity:.83,side:THREE.DoubleSide,depthWrite:false
    });
    sandMat.name="Canyon fine sandstone";stoneMat.name="Canyon stratified rock";
    accentMat.name="Canyon cut masonry";deepStone.name="Canyon shaded sandstone";
    wood.name="Canyon weathered timber";brine.name="Canyon water";
    pbr(sandMat,"sand",[5,6],0xf4dfc3,.22);
    pbr(stoneMat,"rock",[1.2,1.8],0xf0b895,.38);
    pbr(accentMat,"rock",[.8,1],0xf0d5b0,.28);
    pbr(deepStone,"rock",[1.2,1.8],0xb47f70,.4);
    pbr(wood,"wood",[1,2],0xc29c78,.32);
    // A panoramic, vertex-colored sky dome with a cyan horizon and warm sunset.
    const skyGeo=new THREE.SphereGeometry(142,36,20);
    const skyPositions=skyGeo.getAttribute("position"),skyColors=new Float32Array(skyPositions.count*3);
    const horizon=new THREE.Color(0xf0cda7),upper=new THREE.Color(0x87b4c7),
      overhead=new THREE.Color(0x4f779b),paint=new THREE.Color();
    for(let i=0;i<skyPositions.count;i++){
      const ny=skyPositions.getY(i)/142;
      paint.copy(horizon).lerp(upper,THREE.MathUtils.smoothstep(ny,-.19,.28));
      paint.lerp(overhead,THREE.MathUtils.smoothstep(ny,.25,.95)*.70);
      skyColors.set([paint.r,paint.g,paint.b],i*3);
    }
    skyGeo.setAttribute("color",new THREE.BufferAttribute(skyColors,3));
    const sky=add(skyGeo,new THREE.MeshBasicMaterial({
      vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false
    }));
    sky.renderOrder=-20;
    const sunDisc=add(new THREE.SphereGeometry(4,24,12),
      new THREE.MeshBasicMaterial({color:0xffe1a5,fog:false,depthWrite:false}),-44,59,-92);
    const sunGlow=add(new THREE.SphereGeometry(6.5,24,12),
      new THREE.MeshBasicMaterial({
        color:0xffd79e,fog:false,depthWrite:false,transparent:true,opacity:.15
      }),-44,59,-92);
    sky.frustumCulled=false;
    // Soft high cirrus gives the skyline depth without foreground white blobs.
    const cloudCanvas=document.createElement("canvas"),cloudContext=cloudCanvas.getContext("2d");
    if(cloudContext&&typeof cloudContext.createRadialGradient==="function"){
      cloudCanvas.width=512;cloudCanvas.height=128;
      for(let i=0;i<9;i++){
        const x=50+i*52,y=58+Math.sin(i*1.9)*9;
        const fade=cloudContext.createRadialGradient(x,y,2,x,y,54);
        fade.addColorStop(0,"rgba(255,241,218,.22)");fade.addColorStop(1,"rgba(255,241,218,0)");
        cloudContext.fillStyle=fade;cloudContext.fillRect(x-54,y-54,108,108);
      }
      const cloudMap=new THREE.CanvasTexture(cloudCanvas);extraMaps.push(cloudMap);
      const cloudMaterial=new THREE.MeshBasicMaterial({map:cloudMap,transparent:true,opacity:.46,depthWrite:false,fog:false});
      for(const [x,y,z,w,tilt] of [[-34,34,-72,31,.04],[26,42,-94,38,-.04],[59,28,-65,25,.03]]){
        const cloud=add(new THREE.PlaneGeometry(w,6),cloudMaterial,x,y,z);
        cloud.rotation.z=tilt;cloud.renderOrder=-10;
      }
    }
    // The playable shelves sit inside a continuous landscape. Broad, low-cost
    // aprons support the distant mesas instead of ending the world at a box edge.
    // Inside the playable rectangle they remain safely below its original floor;
    // outside it the sand rises gently enough to bed every outer butte in soil.
    const apronMaterial=pbr(new THREE.MeshStandardMaterial({
      map:terrainMap,vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide
    }),"sand",[36,50],0xffffff,.14);
    apronMaterial.name="Canyon continuous distant sand";
    for(const side of [-1,1]){
      const cx=side*76.74,geometry=new THREE.PlaneGeometry(150,220,32,44);
      geometry.rotateX(-Math.PI/2);
      const position=geometry.getAttribute("position"),colors=new Float32Array(position.count*3);
      const warm=new THREE.Color(0xf1ce9f),shade=new THREE.Color(0xc79975);
      for(let i=0;i<position.count;i++){
        const x=position.getX(i)+cx,z=position.getZ(i)-20;
        const distant=Math.max(THREE.MathUtils.smoothstep(Math.abs(x),22.4,25),THREE.MathUtils.smoothstep(Math.abs(z),16,19));
        const ripple=.5+.5*Math.sin(x*.14+z*.07)*Math.cos(z*.11-x*.04);
        position.setY(i,-.18+distant*(.22+ripple*.13));
        paint.copy(shade).lerp(warm,.43+.16*Math.sin(x*.12+z*.08)+ripple*.16);
        colors.set([paint.r,paint.g,paint.b],i*3);
      }
      geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
      const apron=add(geometry,apronMaterial,cx,0,-20);apron.name="Canyon distant terrain apron";
    }
    // Continue the watercourse to the horizon through the aprons' central gap.
    // The original detailed river and sculpted gorge remain above this extension.
    const distantRiver=add(new THREE.PlaneGeometry(3.48,220,1,22),brine,0,-.19,-20);
    distantRiver.rotation.x=-Math.PI/2;distantRiver.name="Canyon distant river";
    const gorgeBed=add(new THREE.PlaneGeometry(3.52,220),deepStone,0,-2.45,-20);
    gorgeBed.rotation.x=-Math.PI/2;gorgeBed.name="Canyon distant gorge bed";
    // Terrain is modeled as a subtly uneven surface above the original collision-safe
    // plates. Existing quest paths and walking rules remain perfectly flat.
    for(const side of [-1,1]){
      const cx=side*12.1;
      const geometry=new THREE.PlaneGeometry(20.7,32,52,68);
      geometry.rotateX(-Math.PI/2);
      const pos=geometry.getAttribute("position");
      const colors=new Float32Array(pos.count*3);
      const light=new THREE.Color(0xf6d2a1),dark=new THREE.Color(0xc38c68);
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i)+cx,z=pos.getZ(i);
        // Small, non-colliding desert undulations; the main route stays at y=0.
        const edge=Math.min(1,Math.max(0,(Math.abs(x)-3)/13));
        const relief=(Math.sin(z*.89+x*.47)+Math.cos(x*.67-z*.36))*.013*edge;
        pos.setY(i,relief);
        const shade=THREE.MathUtils.clamp(.47+.16*Math.sin(x*.7+z*.33)+
          .15*Math.cos(z*.9-x*.25),0,1);
        paint.copy(dark).lerp(light,shade);
        colors.set([paint.r,paint.g,paint.b],i*3);
      }
      geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
      geometry.computeVertexNormals();
      const groundMaterial=pbr(new THREE.MeshStandardMaterial({
        map:terrainMap,vertexColors:true,roughness:1,side:THREE.DoubleSide
      }),"sand",[5.2,8],0xffffff,.2);
      groundMaterial.name="Canyon textured desert floor";
      const mesh=add(geometry,groundMaterial,cx,-.048,0);
      mesh.receiveShadow=true;
    }
    // Deeply sculpted wall faces replace the featureless, repeating river gorge.
    // Leave the bridge gap open so the crossing is never visually obstructed.
    for(const side of [-1,1])for(const interval of [[-16,1.2],[2.4,16]]){
      const segments=58,layers=7;
      const positions=[],colorData=[],indices=[];
      const bands=["#e9b082","#d28d70","#ba745f","#efbe94","#a96558","#d79778","#765261"]
        .map(x=>new THREE.Color(x));
      const span=interval[1]-interval[0];
      for(let j=0;j<=segments;j++){
        const z=interval[0]+span*j/segments;
        const ledge=2.60+.13*Math.sin(z*1.4)+.09*Math.sin(z*3.7);
        for(let k=0;k<=layers;k++){
          const t=k/layers;
          const x=side*(ledge+.23*Math.sin(z*2.3+k*1.9)+.17*(1-t));
          const y=-2.40+2.43*t+.065*Math.sin(z*1.65+k*2.4);
          positions.push(x,y,z);
          const color=bands[Math.min(bands.length-1,Math.floor(t*bands.length))];
          const intensity=.91+.06*Math.sin(z*1.83+k);
          colorData.push(color.r*intensity,color.g*intensity,color.b*intensity);
        }
      }
      for(let j=0;j<segments;j++)for(let k=0;k<layers;k++){
        const a=j*(layers+1)+k,b=a+layers+1;
        if(side<0)indices.push(a,a+1,b,b,a+1,b+1);
        else indices.push(a,b,a+1,b,b+1,a+1);
      }
      const g=new THREE.BufferGeometry();
      g.setIndex(indices);g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      g.setAttribute("color",new THREE.Float32BufferAttribute(colorData,3));
      g.computeVertexNormals();
      surfaces?.projectUV?.(g,.36);
      const cliff=add(g,pbr(new THREE.MeshStandardMaterial({
        vertexColors:true,roughness:.99,side:THREE.DoubleSide,flatShading:true
      }),"rock",[1,1],0xffffff,.36));cliff.receiveShadow=true;
    }
    // Irregular layered buttes beyond walkable land give both horizons proper scale.
    function butte(x,z,rad,height){
      const verts=[],cols=[],inds=[],sides=13,levels=12;
      const bands=["#a97466","#cc9678","#e7b991","#bc8774","#deb089","#936a65"]
        .map(c=>new THREE.Color(c));
      for(let k=0;k<=levels;k++){
        const t=k/levels,y=height*t-.03;
        const taper=1-t*.39+Math.sin(k*2.1)*.044;
        const tint=bands[Math.min(bands.length-1,Math.floor(t*bands.length))];
        for(let j=0;j<=sides;j++){
          const a=j/sides*Math.PI*2;
          const rough=.90+.12*Math.sin(a*3.7+k*1.8)+.07*Math.cos(a*6.1-k*2);
          verts.push(Math.cos(a)*rad*taper*rough,y,Math.sin(a)*rad*.88*taper*rough);
          const weather=.95+.045*Math.cos(a*2.4)+.025*Math.sin(k*2.3+a*4);
          cols.push(tint.r*weather,tint.g*weather,tint.b*weather);
        }
      }
      for(let k=0;k<levels;k++)for(let j=0;j<sides;j++){
        const a=k*(sides+1)+j,b=a+sides+1;
        inds.push(a,b,a+1,b,b+1,a+1);
      }
      // Real capped tops prevent the panoramic camera seeing hollow mesas.
      const cap=verts.length/3;verts.push(0,height-.03,0);
      cols.push(bands[5].r,bands[5].g,bands[5].b);
      for(let j=0;j<sides;j++)inds.push(cap,levels*(sides+1)+j+1,levels*(sides+1)+j);
      const g=new THREE.BufferGeometry();
      g.setIndex(inds);g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();
      surfaces?.projectUV?.(g,.42);
      const o=add(g,pbr(new THREE.MeshStandardMaterial({
        vertexColors:true,side:THREE.DoubleSide,roughness:1,flatShading:true
      }),"rock",[1,1],0xffffff,.32),x,0,z);o.rotation.y=rand()*Math.PI*2;return o;
    }
    for(let i=0;i<36;i++){
      const side=i%2?-1:1,x=side*(26+rand()*20);
      const z=-24+rand()*48;
      butte(x,z,1.35+rand()*2.7,3.4+rand()*9.5);
    }
    // Huge middle-distance silhouettes frame the far canyon but never the path.
    for(let i=0;i<8;i++){
      const sign=i%2?-1:1;
      butte(sign*(17+rand()*7),-23-rand()*9,2.3+rand()*2.4,6+rand()*7);
    }
    // Narrow wind-cut fins complete the outer rim without blocking any trail.
    for(let i=0;i<12;i++){
      const side=i%2?-1:1;
      const fin=butte(side*(26.8+rand()*3),-18+i*3.1,.9+rand()*.7,4.2+rand()*4.7);
      fin.scale.set(.64,1,1.65);
    }
    const geoRock=new THREE.IcosahedronGeometry(1,0);
    const rocks=new THREE.InstancedMesh(geoRock,deepStone,310);
    const temp=new THREE.Object3D();
    for(let i=0;i<310;i++){
      const side=i%2?-1:1,x=side*(3.9+rand()*18),z=-15+rand()*30;
      const sz=.075+rand()*.27;
      temp.position.set(x,-.005+sz*.35,z);
      if(isWaterGarden(x,z))temp.position.x=-x;
      temp.rotation.set(rand()*.25,rand()*Math.PI*2,rand()*.4);
      temp.scale.set(sz*(1.2+rand()),sz*.43,sz*(.8+rand()));
      temp.updateMatrix();rocks.setMatrixAt(i,temp.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;rocks.castShadow=false;rocks.receiveShadow=true;
    scene.add(rocks);props.push(rocks);
    const scrubGeometry=new THREE.ConeGeometry(.12,.51,5);
    const scrub=new THREE.InstancedMesh(scrubGeometry,grass,170);
    for(let i=0;i<170;i++){
      const side=i%2?-1:1,x=side*(4.8+rand()*16),z=-15+rand()*30;
      temp.position.set(x,.12,z);temp.rotation.set(0,rand()*6.28,(rand()-.5)*.25);
      if(isWaterGarden(x,z))temp.position.x=-x;
      const scale=.4+rand()*.9;temp.scale.set(scale,scale,scale);
      temp.updateMatrix();scrub.setMatrixAt(i,temp.matrix);
    }
    scrub.instanceMatrix.needsUpdate=true;scene.add(scrub);props.push(scrub);
    const block=(material,x,y,z,w,h,d,shadow=true)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z,shadow);
    const world=(x,y)=>[(x-500)/24,(y-305)/24];
    // Broad trail inlays make the original collision-safe route read as a
    // connected expedition path instead of an untextured floor.
    const trailMat=pbr(new THREE.MeshStandardMaterial({map:terrainMap,color:0xb88769,roughness:.98}),"sand",[.5,2],0xc49d7d,.12);
    const trailEdgeMat=new THREE.MeshStandardMaterial({color:0x8f6258,roughness:1,flatShading:true});
    const trailRoutes=[
      [[165,270],[250,315],[305,455],[390,365],[390,223]],
      [[305,455],[430,410],[438,350],[579,350],[625,397],[700,397],[772,397],[820,235]],
      [[390,365],[438,350]],
      [[305,455],[290,520]]
    ];
    const trailDust=[];
    for(const route of trailRoutes){
      for(let i=0;i<route.length-1;i++){
        const [ax,az]=world(route[i][0],route[i][1]);
        const [bx,bz]=world(route[i+1][0],route[i+1][1]);
        const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        const angle=Math.atan2(dx,dz),midX=(ax+bx)/2,midZ=(az+bz)/2;
        const path=add(new THREE.PlaneGeometry(1.22,length,1,8),trailMat,midX,-.015,midZ);
        path.rotation.x=-Math.PI/2;path.rotation.z=angle;
        path.userData.canyonTrail={from:[...route[i]],to:[...route[i+1]]};
        for(const side of [-1,1]){
          const edge=add(new THREE.BoxGeometry(.055,length,.055),trailEdgeMat,
            midX+Math.cos(angle)*side*.63,-.005,midZ+Math.sin(angle)*side*.63);
          edge.rotation.y=angle;
        }
        for(let j=0;j<3;j++){
          const mote=add(new THREE.IcosahedronGeometry(.035,0),
            new THREE.MeshBasicMaterial({color:0xe7c39b,transparent:true,opacity:.22,depthWrite:false}),
            midX+(rand()-.5)*.8,.08+rand()*.18,midZ+(rand()-.5)*length*.7);
          trailDust.push({mesh:mote,material:mote.material,baseX:mote.position.x,baseY:mote.position.y,
            baseZ:mote.position.z,phase:rand()*6.28});
        }
      }
    }
    // Foreground shelves and eroded pillars improve depth and landmark scale
    // while remaining outside the established walkable corridor.
    const shelfMat=pbr(new THREE.MeshStandardMaterial({color:0xc28168,map:stoneMap,roughness:1,flatShading:true}),"rock",[.8,.5],0xd2a187,.36);
    for(let i=0;i<18;i++){
      const side=i%2?-1:1,z=-20+i*2.25+(rand()-.5)*.5;
      const shelf=add(new THREE.BoxGeometry(1.2+rand()*2.2,.10+rand()*.22,.62+rand()*.55),
        shelfMat,side*(4.35+rand()*1.6),.12,z,true);
      shelf.rotation.y=(rand()-.5)*.35;
    }
    const ruinMat=pbr(new THREE.MeshStandardMaterial({color:0xb98970,map:blockMap,roughness:.97,flatShading:true}),"rock",[1,2],0xcfa58a,.3);
    for(let i=0;i<10;i++){
      const side=i%2?-1:1,z=-17+i*3.9+(rand()-.5)*.7;
      const height=1.4+rand()*2.5,x=side*(5.1+rand()*2);
      add(new THREE.CylinderGeometry(.25+rand()*.2,.42+rand()*.25,height,7),
        ruinMat,x,.65+height*.5,z,true);
      add(new THREE.CylinderGeometry(.48+rand()*.18,.38,.18,7),
        deepStone,x,.65+height+.16,z,true);
    }
    // Art-directed aqueduct masonry: voussoir arch stones, capstones, lateral
    // beam, aging buttresses and rusted mechanical clamps around original pipe.
    {
      const [x,z]=world(700,365);
      const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);props.push(group);
      const brick=(gx,gy,gz,w,h,d,m=accentMat)=>{
        const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
        b.position.set(gx,gy,gz);b.castShadow=true;b.receiveShadow=true;group.add(b);return b;
      };
      for(const col of [-1.9,-.95,0,.95,1.9]){
        brick(col,1.05,-.62,.37,2.1,.43);
        brick(col,2.25,-.62,.65,.32,.6,stoneMat);
        brick(col,.14,-.58,.65,.29,.69,deepStone);
      }
      for(const cx of [-1.43,-.48,.48,1.43]){
        const arch=new THREE.Mesh(
          new THREE.TorusGeometry(.44,.16,7,18,Math.PI),accentMat);
        arch.position.set(cx,1.70,-.61);arch.rotation.z=0;
        arch.castShadow=true;group.add(arch);
      }
      brick(0,2.64,-.57,4.65,.27,.89);
      brick(0,2.94,-.53,4.85,.17,.78,deepStone);
      brick(0,3.08,-.53,5.02,.11,.93,stoneMat);
      for(let i=0;i<9;i++)brick(-2+i*.50,2.68,-.04,.43,.22,.18,stoneMat);
      for(const col of [-1.9,-.95,0,.95,1.9]){
        brick(col,.31,-.17,.51,.11,.23,stoneMat);
        brick(col,2.48,-.17,.50,.10,.24,deepStone);
      }
      const ringGeo=new THREE.TorusGeometry(.24,.065,8,16);
      for(const cx of [-1.5,-.35,.85,1.55]){
        const clamp=new THREE.Mesh(ringGeo,metal);
        clamp.position.set(cx,2.35,-.22);clamp.rotation.y=Math.PI/2;
        clamp.castShadow=true;group.add(clamp);
        for(const sy of [-1,1]){
          const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.08,6),copper);
          bolt.rotation.x=Math.PI/2;bolt.position.set(cx,2.35+sy*.18,.005);group.add(bolt);
        }
      }
    }
    // Better valve station: concrete plinths, copper bands, gauges and pipe run.
    {
      const [x,z]=world(390,165);
      const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);props.push(group);
      const mesh=(geo,m,x,y,z)=>{
        const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;group.add(o);return o;
      };
      mesh(new THREE.CylinderGeometry(1.55,1.65,.32,24),accentMat,0,.1,0);
      for(const y of [.35,1.2,2.18]){
        mesh(new THREE.TorusGeometry(1.16,.10,8,32),copper,0,y,0).rotation.x=Math.PI/2;
      }
      mesh(new THREE.CylinderGeometry(1.25,1.25,.23,24),deepStone,0,2.82,0);
      for(let i=0;i<3;i++){
        const cx=-.69+i*.70;
        const wheel=new THREE.Group();wheel.position.set(cx,1.32,1.25);group.add(wheel);valveWheels.push(wheel);
        const rim=new THREE.Mesh(new THREE.TorusGeometry(.33,.068,9,20),copper);wheel.add(rim);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.17,12),metal);hub.rotation.x=Math.PI/2;wheel.add(hub);
        for(let a=0;a<4;a++){
          const p=a*Math.PI/2;
          const spoke=new THREE.Mesh(new THREE.BoxGeometry(.065,.50,.065),metal);
          spoke.position.set(Math.sin(p)*.10,Math.cos(p)*.10,.025);spoke.rotation.z=p;wheel.add(spoke);
        }
      }
      for(const cx of [-.72,0,.72]){
        mesh(new THREE.CylinderGeometry(.052,.052,.11,6),copper,cx,.73,1.16).rotation.x=Math.PI/2;
        mesh(new THREE.BoxGeometry(.43,.10,.05),deepStone,cx,1.88,1.19);
      }
      mesh(new THREE.CylinderGeometry(.16,.16,3.3,10),metal,1.80,.44,0).rotation.z=Math.PI/2;
      mesh(new THREE.CylinderGeometry(.28,.28,.13,18),copper,0,2.04,1.24).rotation.x=Math.PI/2;
      mesh(new THREE.CylinderGeometry(.20,.20,.15,18),new THREE.MeshStandardMaterial({
        color:0xf9dfb3,roughness:.65
      }),0,2.04,1.32).rotation.x=Math.PI/2;
    }
    // Cistern facade: stone-ring pedestal, service steps, copper bands and pipe.
    {
      const [x,z]=world(820,175);
      const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);props.push(group);
      const item=(geo,mat,x,y,z)=>{
        const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;
      };
      item(new THREE.CylinderGeometry(1.58,1.72,.34,24),accentMat,0,.12,0);
      for(const y of [.42,1.33,2.22])
        item(new THREE.TorusGeometry(1.22,.10,8,28),copper,0,y,0).rotation.x=Math.PI/2;
      item(new THREE.CylinderGeometry(1.45,1.45,.16,20),deepStone,0,2.55,0);
      for(let i=0;i<3;i++)item(new THREE.BoxGeometry(.73,.20,.52),stoneMat,.7,.1+i*.17,1.9-i*.37);
      item(new THREE.CylinderGeometry(.16,.16,2.6,10),metal,-1.9,.54,-.3).rotation.z=Math.PI/2;
      item(new THREE.BoxGeometry(.65,.72,.065),deepStone,0,1.46,1.26);
      item(new THREE.BoxGeometry(.53,.59,.075),metal,0,1.46,1.30);
      item(new THREE.TorusGeometry(.11,.025,6,16),copper,0,1.43,1.37);
      for(const sx of [-1,1])for(const sy of [-1,1])
        item(new THREE.CylinderGeometry(.035,.035,.07,6),copper,sx*.24,1.46+sy*.25,1.36).rotation.x=Math.PI/2;
      for(const cx of [1.27,1.59])item(new THREE.CylinderGeometry(.026,.026,2.4,8),metal,cx,1.39,.19);
      for(let i=0;i<8;i++)item(new THREE.BoxGeometry(.36,.045,.06),copper,1.43,.34+i*.29,.19);
    }
    // Complete repair shelter with fabric shade canopy, stacked crates and ropes.
    {
      const [x,z]=world(290,520);
      const canvasMat=new THREE.MeshStandardMaterial({
        color:0xe0bd8b,roughness:1,side:THREE.DoubleSide
      });
      const canopy=add(new THREE.ConeGeometry(1.65,.53,4),canvasMat,x,2.43,z,true);
      canopy.rotation.y=Math.PI/4;
      for(let j=0;j<4;j++){
        const a=j*Math.PI/2;
        block(wood,x+Math.cos(a)*1.13,.90,z+Math.sin(a)*1.13,.10,1.8,.10);
      }
      for(let i=0;i<5;i++){
        const cx=x-1.2+(i%3)*.42,cz=z+.57+Math.floor(i/3)*.46;
        block(wood,cx,.27+(i%2)*.19,cz,.38,.42,.35);
        block(copper,cx,.48+(i%2)*.19,cz,.40,.035,.37,false);
      }
    }
    // Surveyor camp beacon; NPC model is decorative, never a second collision.
    {
      const [x,z]=world(165,270);
      const clothing=new THREE.MeshStandardMaterial({color:0x417e83,roughness:.94});
      const skin=new THREE.MeshStandardMaterial({color:0xc18e6e,roughness:.92});
      const npc=new THREE.Group();npc.position.set(x+.8,0,z-.7);scene.add(npc);props.push(npc);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,9),skin);
      head.position.y=1.85;npc.add(head);
      const torso=new THREE.Mesh(new THREE.CylinderGeometry(.26,.39,.95,9),clothing);
      torso.position.y=1.17;npc.add(torso);
      for(const side of [-1,1]){
        const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.36,5,8),clothing);
        arm.position.set(side*.36,1.29,0);arm.rotation.z=side*.2;npc.add(arm);
      }
      const hat=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.085,12),copper);
      hat.position.y=2.14;npc.add(hat);
      const paper=new THREE.Mesh(new THREE.BoxGeometry(.39,.025,.48),accentMat);
      paper.position.set(.05,1.18,.37);paper.rotation.x=-.25;npc.add(paper);
      block(wood,x+.8,.8,z+.05,.11,1.6,.11);
      block(accentMat,x+.8,1.7,z+.05,1.3,.34,.13);
    }
    // Three light, open-canopy palms frame the restored cistern. Their trunks
    // and fronds stay away from approaches and the outlet's garden footprint.
    const palmLeaf=new THREE.MeshStandardMaterial({color:0x69a982,roughness:.9,side:THREE.DoubleSide});
    for(const [px,py,height,rotation] of [[890,110,2.6,.2],[905,145,2.25,-.3],[770,90,2.85,.6]]){
      const [x,z]=world(px,py);if(isWaterGarden(x,z))continue;
      const palm=new THREE.Group();palm.position.set(x,0,z);palm.rotation.y=rotation;scene.add(palm);props.push(palm);oasis.push(palm);
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.075,.15,height,9),wood);
      trunk.position.y=height/2;trunk.castShadow=true;palm.add(trunk);
      for(let i=0;i<6;i++){
        const vertices=[],indices=[];
        for(let j=0;j<=6;j++){
          const t=j/6,w=Math.sin(t*Math.PI)*.15,yy=Math.sin(t*Math.PI)*.14-.52*t*t;
          vertices.push(-w,yy,t*1.38,w,yy,t*1.38);
          if(j){const a=j*2;indices.push(a-2,a-1,a,a-1,a+1,a);}
        }
        const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
        geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
        const frond=new THREE.Mesh(geometry,palmLeaf);frond.position.y=height;
        frond.rotation.y=i*Math.PI/3;frond.castShadow=true;palm.add(frond);
      }
      for(let i=0;i<5;i++){
        const tuft=new THREE.Mesh(new THREE.ConeGeometry(.12,.43,5),palmLeaf);
        const a=i*Math.PI*2/5;tuft.position.set(Math.cos(a)*.42,.18,Math.sin(a)*.42);tuft.rotation.z=Math.sin(a)*.3;palm.add(tuft);
      }
      palm.visible=false;
    }
    // Animated surface: patterned river moves along the gorge after restoration.
    const riverMesh=add(new THREE.PlaneGeometry(3.42,32.6,4,20),brine,0,-.155,0);
    riverMesh.rotation.x=-Math.PI/2;riverMesh.renderOrder=1;
    const bankGlow=new THREE.MeshBasicMaterial({
      color:0xa3e7d3,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide
    });
    for(const x of [-1.67,1.67]){
      const edge=add(new THREE.PlaneGeometry(.20,32.6),bankGlow,x,-.142,0);
      edge.rotation.x=-Math.PI/2;edge.renderOrder=2;
    }
    const sprayGeo=new THREE.BufferGeometry();
    const particles=new Float32Array(155*3);
    for(let i=0;i<155;i++){
      const side=i%2?-1:1;
      particles[i*3]=side*(2.8+rand()*16);
      particles[i*3+1]=.28+rand()*4.2;
      particles[i*3+2]=-15+rand()*30;
    }
    sprayGeo.setAttribute("position",new THREE.BufferAttribute(particles,3));
    const dustOrigins=particles.slice();
    const dust=new THREE.Points(sprayGeo,new THREE.PointsMaterial({
      color:0xffe2ba,size:.085,transparent:true,opacity:.32,
      depthWrite:false,depthTest:true,sizeAttenuation:true
    }));scene.add(dust);props.push(dust);
    const dustMotes=[];
    for(let i=0;i<38;i++){
      const mote=add(new THREE.IcosahedronGeometry(.035+rand()*.035,0),
        new THREE.MeshBasicMaterial({color:0xf0c89e,transparent:true,opacity:.18,depthWrite:false}),
        (rand()-.5)*18,.5+rand()*3.2,-15+rand()*30);
      dustMotes.push({mesh:mote,material:mote.material,phase:rand()*6.28,baseX:mote.position.x,
        baseY:mote.position.y,baseZ:mote.position.z});
    }
    const reduced=typeof window.matchMedia==="function"&&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finiteTime=t=>Number.isFinite(t)?t:0;
    return {
      update(time){
        const t=finiteTime(time);
        const state=getState(),restored=!!state.finished||state.done.has("cistern");
        for(let i=0;i<valveWheels.length;i++)valveWheels[i].rotation.z=-(Number(state.valves?.[i])||0)*.72;
        const age=Math.max(0,t-(Number(state.celebrationStart)||0)/1000);
        for(const palm of oasis){
          palm.visible=restored;const growth=reduced?1:Math.min(1,.18+age/2.6);palm.scale.set(growth,growth,growth);
        }
        if(waterMap&&!reduced)waterMap.offset.y=-(t*.018%1);
        const completed=getState().done.has("span");
        brine.color.setHex(completed?0x8fe5d8:0x73cbd0);
        riverMesh.material.opacity=completed?.92:.76;
        if(!reduced){
          const xyz=sprayGeo.getAttribute("position");
          for(let i=0;i<155;i++){
            // Derive positions from time and immutable origins. Repeated draws
            // while paused and different refresh rates must not accumulate drift.
            const x=dustOrigins[i*3]+Math.sin(t*.31+i)*.12;
            const y=.20+((dustOrigins[i*3+1]-.20+t*.036)%4.28);
            xyz.setXY(i,x,y);
          }
          xyz.needsUpdate=true;
          for(const mote of trailDust.concat(dustMotes)){
            const drift=(t*.16+mote.phase)%1;
            mote.mesh.position.x=mote.baseX+Math.sin(t*.32+mote.phase)*.12+drift*.22;
            mote.mesh.position.y=mote.baseY+Math.sin(t*.8+mote.phase)*.06;
            mote.mesh.position.z=mote.baseZ+Math.cos(t*.27+mote.phase)*.16;
            if(mote.material)mote.material.opacity=.10+.12*(.5+.5*Math.sin(t*.7+mote.phase));
          }
        }
      },
      dispose(){
        // Descend through authored structure groups too; otherwise geometry
        // in masonry arches, canopy and NPCs survives when WebGL is recreated.
        const geometries=new Set(),materials=new Set();
        const collect=object=>{
          if(object.geometry)geometries.add(object.geometry);
          for(const m of (Array.isArray(object.material)?object.material:
            object.material?[object.material]:[]))materials.add(m);
          for(const child of object.children||[])collect(child);
        };
        for(const object of props)collect(object);
        for(const g of geometries)g.dispose?.();
        for(const m of materials)m.dispose?.();
        for(const map of [terrainMap,stoneMap,blockMap,waterMap,...extraMaps])map?.dispose();
        for(const object of props)if(object.parent)object.parent.remove(object);
      }
    };
  }
  window.ThirstCanyonVisuals=Object.freeze({build});
})();
