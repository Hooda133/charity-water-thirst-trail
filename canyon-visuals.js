"use strict";
/* Forgotten Canyon's authored visual pass. Purely decorative: world/quest coordinates,
   collision, saved progress, renderer ownership and 2D fallback remain in canyon.js. */
(() => {
  function build(THREE, {scene, camera, worldSpread, getState, isWaterGarden=()=>false, surfaces=null,
    getGraphics=()=>({preset:"high",effects:true})}) {
    let seed=782331;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const props=[],extraMaps=[],valveWheels=[],oasis=[],contacts=[],cloth=[];
    const world=(x,y)=>[(x-500)/24,(y-305)/24];
    const trailRoutes=[
      [[165,270],[250,315],[305,455],[390,365],[390,223]],
      [[305,455],[430,410],[438,350],[579,350],[625,397],[700,397],[772,397],[820,235]],
      [[390,365],[438,350]],[[305,455],[290,520]]
    ];
    const nearTrail=(x,z,clearance=1.25)=>trailRoutes.some(route=>route.some((point,i)=>{
      if(!i)return false;
      const [ax,az]=world(...route[i-1]),[bx,bz]=world(...point),dx=bx-ax,dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-ax-dx*t,z-az-dz*t)<clearance;
    }));
    const pbr=(material,kind,repeat=[1,1],tint=null,strength=.35)=>{
      surfaces?.apply?.(material,kind,repeat,tint,strength);
      return material;
    };
    const add=(geometry,material,x=0,y=0,z=0,shadow=false)=>{
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;
      mesh.userData.cameraOccluder=shadow;
      scene.add(mesh);props.push(mesh);return mesh;
    };
    // Static masonry/props share a unit box, preserving per-landmark fading
    // while avoiding a draw call for every individual stone and timber joint.
    function boxes(parent,placements){
      const groups=new Map(),dummy=new THREE.Object3D();
      for(const item of placements){
        if(!groups.has(item.material))groups.set(item.material,[]);
        groups.get(item.material).push(item);
      }
      for(const [material,items] of groups){
        const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,items.length);
        for(let i=0;i<items.length;i++){
          const item=items[i];dummy.position.set(item.x,item.y,item.z);
          dummy.scale.set(item.w,item.h,item.d);dummy.rotation.set(0,item.rotation||0,0);
          dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
        }
        batch.instanceMatrix.needsUpdate=true;batch.castShadow=true;batch.receiveShadow=true;
        batch.userData.cameraOccluder=true;parent.add(batch);
      }
    }
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
    const grass=new THREE.MeshStandardMaterial({color:0x71876a,roughness:1,flatShading:true});
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
      const light=new THREE.Color(0xe8cfb1),dark=new THREE.Color(0xb79178);
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
    // Eroded, capped silhouettes share a geological profile and palette. Nearby
    // formations remain independent so visibility fading affects only the blocker;
    // the distant skyline is one instanced draw rather than dozens of materials.
    const butteMaterial=pbr(new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.98,flatShading:true
    }),"rock",[1,1],0xf2d1ba,.25);
    butteMaterial.name="Canyon weathered strata";
    function butteGeometry(rad=1,height=1){
      const verts=[],cols=[],inds=[],sides=13,levels=12;
      const bands=["#9c7468","#b98d78","#d2a88a","#b68a79","#d9b798","#92776f"]
        .map(c=>new THREE.Color(c));
      const terraces=[1.05,1.0,.97,1.015,.92,.935,.84,.86,.77,.78,.68,.70,.62];
      for(let k=0;k<=levels;k++){
        const t=k/levels,tint=bands[Math.min(bands.length-1,Math.floor(t*bands.length))];
        for(let j=0;j<=sides;j++){
          const a=j/sides*Math.PI*2;
          // Persistent erosion channels, broken ledges and weathered crown edges
          // read as connected stone instead of stacked regular cylinders.
          const channel=.94+.075*Math.sin(a*4.0)+.04*Math.cos(a*7.0+k*.38);
          const y=height*t-.03+Math.sin(a*3.0+k*.8)*height*.009*Math.sin(t*Math.PI);
          verts.push(Math.cos(a)*rad*terraces[k]*channel,y,
            Math.sin(a)*rad*.86*terraces[k]*channel);
          const patina=.93+.055*Math.cos(a*2.4)+.025*Math.sin(k*2.3+a*4);
          cols.push(tint.r*patina,tint.g*patina,tint.b*patina);
        }
      }
      for(let k=0;k<levels;k++)for(let j=0;j<sides;j++){
        const a=k*(sides+1)+j,b=a+sides+1;inds.push(a,b,a+1,b,b+1,a+1);
      }
      const cap=verts.length/3;verts.push(0,height-.03,0);
      cols.push(bands[4].r,bands[4].g,bands[4].b);
      for(let j=0;j<sides;j++)inds.push(cap,levels*(sides+1)+j+1,levels*(sides+1)+j);
      const geometry=new THREE.BufferGeometry();geometry.setIndex(inds);
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      geometry.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));geometry.computeVertexNormals();
      surfaces?.projectUV?.(geometry,.42);return geometry;
    }
    const temp=new THREE.Object3D(),skylinePlacements=[];
    for(let i=0;i<36;i++){
      const side=i%2?-1:1;
      skylinePlacements.push({x:side*(26+rand()*20),z:-24+rand()*48,
        radius:1.35+rand()*2.7,height:3.4+rand()*9.5,depth:1});
    }
    for(let i=0;i<12;i++){
      const side=i%2?-1:1;
      skylinePlacements.push({x:side*(26.8+rand()*3),z:-18+i*3.1,
        radius:(.9+rand()*.7)*.64,height:4.2+rand()*4.7,depth:2.58});
    }
    const skyline=new THREE.InstancedMesh(butteGeometry(),butteMaterial,skylinePlacements.length);
    skyline.name="Canyon distant eroded skyline";skyline.userData.cameraOccluder=false;
    for(let i=0;i<skylinePlacements.length;i++){
      const item=skylinePlacements[i];temp.position.set(item.x,0,item.z);
      temp.rotation.set(0,rand()*Math.PI*2,0);
      temp.scale.set(item.radius,item.height,item.radius*item.depth);temp.updateMatrix();
      skyline.setMatrixAt(i,temp.matrix);
    }
    skyline.instanceMatrix.needsUpdate=true;scene.add(skyline);props.push(skyline);
    // Middle-distance masses frame the route. No geometry enters the traversable
    // mission corridor, and their soft contact beds ground them in the sand.
    for(let i=0;i<8;i++){
      const sign=i%2?-1:1,x=sign*(17+rand()*7),z=-23-rand()*9;
      const radius=2.3+rand()*2.4,height=6+rand()*7;
      const formation=add(butteGeometry(radius,height),butteMaterial,x,0,z);
      formation.rotation.y=rand()*Math.PI*2;formation.userData.cameraOccluder=true;
      contacts.push({x,z,y:.013,width:radius*2.65,depth:radius*2.15,rotation:formation.rotation.y});
    }
    const geoRock=new THREE.IcosahedronGeometry(1,0);
    const rocks=new THREE.InstancedMesh(geoRock,deepStone,220);
    for(let i=0;i<220;i++){
      const side=i%2?-1:1,x=side*(3.9+rand()*18),z=-15+rand()*30;
      const sz=.075+rand()*.27;
      temp.position.set(x,-.005+sz*.35,z);
      if(isWaterGarden(x,z)||nearTrail(x,z,.95))temp.position.x=side*(17.5+rand()*3);
      temp.rotation.set(rand()*.25,rand()*Math.PI*2,rand()*.4);
      temp.scale.set(sz*(1.2+rand()),sz*.43,sz*(.8+rand()));
      temp.updateMatrix();rocks.setMatrixAt(i,temp.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;rocks.castShadow=false;rocks.receiveShadow=true;
    rocks.userData.cameraOccluder=false;rocks.name="Canyon weathered stone scatter";
    scene.add(rocks);props.push(rocks);
    const scrubGeometry=new THREE.ConeGeometry(.12,.51,5);
    const scrub=new THREE.InstancedMesh(scrubGeometry,grass,110);
    for(let i=0;i<110;i++){
      const side=i%2?-1:1,x=side*(4.8+rand()*16),z=-15+rand()*30;
      temp.position.set(x,.12,z);temp.rotation.set(0,rand()*6.28,(rand()-.5)*.25);
      if(isWaterGarden(x,z)||nearTrail(x,z,1.1))temp.position.x=side*(17.5+rand()*3);
      const scale=.4+rand()*.9;temp.scale.set(scale,scale,scale);
      temp.updateMatrix();scrub.setMatrixAt(i,temp.matrix);
    }
    scrub.instanceMatrix.needsUpdate=true;scrub.userData.cameraOccluder=false;
    scrub.name="Canyon sparse sage scrub";scene.add(scrub);props.push(scrub);
    const block=(material,x,y,z,w,h,d,shadow=true)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z,shadow);
    // A feathered dirt ribbon makes the safe route continuous without hard
    // rectangular slabs or vertical rail-like trim. Route metadata stays exact.
    const trailCanvas=document.createElement("canvas");trailCanvas.width=128;trailCanvas.height=8;
    const trailContext=trailCanvas.getContext("2d");let trailAlpha=null;
    if(trailContext&&typeof trailContext.createLinearGradient==="function"){
      const gradient=trailContext.createLinearGradient(0,0,128,0);
      for(const [stop,value] of [[0,0],[.15,.65],[.30,1],[.70,1],[.85,.65],[1,0]]){
        const gray=Math.round(value*255);gradient.addColorStop(stop,`rgb(${gray},${gray},${gray})`);
      }
      trailContext.fillStyle=gradient;trailContext.fillRect(0,0,128,8);
      trailAlpha=new THREE.CanvasTexture(trailCanvas);extraMaps.push(trailAlpha);
    }
    const trailMat=pbr(new THREE.MeshStandardMaterial({map:terrainMap,color:0xb4997b,
      roughness:1,alphaMap:trailAlpha,transparent:!!trailAlpha,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide}),"sand",[.7,2],0xc1a78c,.10);
    trailMat.name="Canyon worn expedition trail";
    const edging=[];
    for(const route of trailRoutes)for(let i=0;i<route.length-1;i++){
      const [ax,az]=world(...route[i]),[bx,bz]=world(...route[i+1]);
      const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
      const segments=Math.max(3,Math.ceil(length*3)),vertices=[],uv=[],indices=[];
      for(let j=0;j<=segments;j++){
        const t=j/segments,half=.76+Math.sin(j*1.81+i)*.065;
        for(const side of [-1,1]){
          vertices.push(ax+dx*t+nx*half*side,-.011,az+dz*t+nz*half*side);
          uv.push((side+1)/2,t*length*.55);
        }
        if(j){const a=j*2;indices.push(a-2,a-1,a,a-1,a+1,a);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
      const path=add(geometry,trailMat);path.name="Canyon continuous worn trail";
      path.userData.canyonTrail={from:[...route[i]],to:[...route[i+1]]};
      // Sparse, low edging stones reinforce the direction; there are no tall
      // decorative edge boxes to accidentally conceal the player or camera.
      for(let j=0;j<Math.ceil(length*2.1);j++)for(const side of [-1,1]){
        const t=(j+.3+rand()*.35)/(Math.ceil(length*2.1)+.1),r=.04+rand()*.035;
        edging.push({x:ax+dx*t+nx*side*(.67+rand()*.12),z:az+dz*t+nz*side*(.67+rand()*.12),r});
      }
    }
    const trailStones=new THREE.InstancedMesh(geoRock,deepStone,edging.length);
    for(let i=0;i<edging.length;i++){
      const item=edging[i];temp.position.set(item.x,.008,item.z);temp.rotation.set(0,rand()*6.28,0);
      temp.scale.set(item.r*1.5,item.r*.38,item.r);temp.updateMatrix();trailStones.setMatrixAt(i,temp.matrix);
    }
    trailStones.name="Canyon low trail edging";trailStones.instanceMatrix.needsUpdate=true;
    trailStones.userData.cameraOccluder=false;trailStones.receiveShadow=true;
    scene.add(trailStones);props.push(trailStones);
    // Foreground shelves and eroded pillars improve depth and landmark scale
    // while remaining outside the established walkable corridor.
    const shelfMat=pbr(new THREE.MeshStandardMaterial({color:0xc28168,map:stoneMap,roughness:1,flatShading:true}),"rock",[.8,.5],0xd2a187,.36);
    for(let i=0;i<18;i++){
      const side=i%2?-1:1,z=-20+i*2.25+(rand()-.5)*.5;
      let x=side*(4.35+rand()*1.6);
      if(nearTrail(x,z,2.3))x=side*(18.3+rand()*1.7);
      const shelf=add(new THREE.BoxGeometry(1.2+rand()*2.2,.10+rand()*.22,.62+rand()*.55),
        shelfMat,x,.12,z,true);
      shelf.rotation.y=(rand()-.5)*.35;
    }
    const ruinMat=pbr(new THREE.MeshStandardMaterial({color:0xb98970,map:blockMap,roughness:.97,flatShading:true}),"rock",[1,2],0xcfa58a,.3);
    for(let i=0;i<10;i++){
      const side=i%2?-1:1,z=-17+i*3.9+(rand()-.5)*.7;
      const height=1.4+rand()*2.5;let x=side*(5.1+rand()*2);
      if(nearTrail(x,z,2.0))x=side*(18.5+rand()*1.8);
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
      const masonry=[];
      const brick=(gx,gy,gz,w,h,d,m=accentMat)=>masonry.push({material:m,x:gx,y:gy,z:gz,w,h,d});
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
      boxes(group,masonry);
      contacts.push({x,z:z-.45,y:.012,width:5.8,depth:2.9});
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
      contacts.push({x,z,y:.012,width:4.1,depth:3.7});
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
      contacts.push({x,z,y:.012,width:4.3,depth:4.1});
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
    // Small, purposeful field-camp details tell the repair story without adding
    // new obstacles across the walking route: survey notes, seal rings and tools.
    const canvasCloth=new THREE.MeshStandardMaterial({color:0x547f79,roughness:1,side:THREE.DoubleSide});
    const darkRubber=new THREE.MeshStandardMaterial({color:0x334a49,roughness:.93});
    for(const [px,py,kit] of [[165,270,false],[305,455,true]]){
      const [x,z]=world(px,py),group=new THREE.Group();
      group.position.set(x+(kit?1.35:-1.15),0,z-.92);scene.add(group);props.push(group);
      const furnishings=[
        {material:wood,x:0,y:.66,z:0,w:1.12,h:.10,d:.65},
        {material:wood,x:-.43,y:.30,z:-.22,w:.09,h:.62,d:.09},
        {material:wood,x:.43,y:.30,z:-.22,w:.09,h:.62,d:.09},
        {material:wood,x:-.43,y:.30,z:.22,w:.09,h:.62,d:.09},
        {material:wood,x:.43,y:.30,z:.22,w:.09,h:.62,d:.09},
        {material:accentMat,x:-.21,y:.73,z:.06,w:.40,h:.025,d:.39,rotation:.16},
        {material:metal,x:.24,y:.75,z:-.05,w:.32,h:.055,d:.06,rotation:-.26},
        {material:wood,x:.22,y:.20,z:.06,w:.44,h:.37,d:.34},
        {material:copper,x:.22,y:.39,z:.06,w:.46,h:.025,d:.36}
      ];
      boxes(group,furnishings);
      contacts.push({x:group.position.x,z:group.position.z,y:.012,width:1.75,depth:1.3,opacity:.18});
      for(let i=0;i<(kit?3:1);i++){
        const seal=new THREE.Mesh(new THREE.TorusGeometry(.10,.026,7,14),darkRubber);
        seal.position.set(.15+i*.16,.735,.13);seal.rotation.x=-Math.PI/2;
        seal.userData.cameraOccluder=false;group.add(seal);
      }
      if(!kit){
        const post=block(wood,x-1.71,.80,z-1.25,.06,1.65,.06,false);
        post.userData.cameraOccluder=false;
        const geometry=new THREE.BufferGeometry();geometry.setIndex([0,1,2]);
        geometry.setAttribute("position",new THREE.Float32BufferAttribute([0,0,0,.53,-.10,0,0,-.29,0],3));
        geometry.computeVertexNormals();
        const pennant=add(geometry,canvasCloth,x-1.68,1.50,z-1.25);
        cloth.push(pennant);pennant.userData.cameraOccluder=false;
      }
    }
    // Three light, open-canopy palms frame the restored cistern. Their trunks
    // and fronds stay away from approaches and the outlet's garden footprint.
    const palmLeaf=new THREE.MeshStandardMaterial({color:0x548b71,roughness:.94,side:THREE.DoubleSide});
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
      contacts.push({x,z,y:.012,width:1.9,depth:1.65,opacity:.13});
    }
    // Animated surface: patterned river moves along the gorge after restoration.
    const riverMesh=add(new THREE.PlaneGeometry(3.42,32.6,4,20),brine,0,-.155,0);
    riverMesh.rotation.x=-Math.PI/2;riverMesh.renderOrder=1;
    const bankGlow=new THREE.MeshBasicMaterial({
      color:0x96beb0,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide
    });
    for(const x of [-1.67,1.67]){
      const edge=add(new THREE.PlaneGeometry(.20,32.6),bankGlow,x,-.142,0);
      edge.rotation.x=-Math.PI/2;edge.renderOrder=2;
    }
    // All atmospheric detail is one bounded particle draw. Former individual
    // dust-mesh clouds created dozens of draw calls and distracting pale flecks.
    const sprayGeo=new THREE.BufferGeometry(),particleCount=208;
    const particles=new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){
      const side=i%2?-1:1;
      particles[i*3]=side*(4.8+rand()*15.2);
      particles[i*3+1]=.16+rand()*2.7;
      particles[i*3+2]=-15+rand()*30;
    }
    sprayGeo.setAttribute("position",new THREE.BufferAttribute(particles,3));
    const dustOrigins=particles.slice();
    const dust=new THREE.Points(sprayGeo,new THREE.PointsMaterial({
      color:0xd9c6aa,size:.035,transparent:true,opacity:.16,
      depthWrite:false,depthTest:true,sizeAttenuation:true
    }));dust.name="Canyon suspended dust";dust.userData.cameraOccluder=false;
    scene.add(dust);props.push(dust);
    surfaces?.contactShadows?.(scene,contacts);
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
        if(waterMap&&!reduced&&getGraphics()?.effects!==false)waterMap.offset.y=-(t*.014%1);
        const completed=getState().done.has("span");
        brine.color.setHex(completed?0x8fe5d8:0x73cbd0);
        riverMesh.material.opacity=completed?.92:.76;
        const graphics=getGraphics()||{},quality=graphics.preset||"high";
        const fraction={low:.43,medium:.70,high:1,ultra:1}[quality]||1;
        rocks.count=Math.floor(220*fraction);scrub.count=Math.floor(110*fraction);
        skyline.count=quality==="low"?34:48;
        const animate=!reduced&&graphics.effects!==false;
        dust.visible=animate;sunGlow.visible=graphics.effects!==false;
        for(let i=0;i<cloth.length;i++)cloth[i].rotation.y=animate?Math.sin(t*.85+i)*.055:0;
        if(animate){
          const xyz=sprayGeo.getAttribute("position");
          const count=quality==="low"?52:quality==="medium"?112:particleCount;
          sprayGeo.setDrawRange?.(0,count);
          for(let i=0;i<count;i++){
            const x=dustOrigins[i*3]+Math.sin(t*.23+i)*.10;
            const y=.12+((dustOrigins[i*3+1]-.12+t*.025)%2.75);
            xyz.setXY(i,x,y);
          }
          xyz.needsUpdate=true;
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
