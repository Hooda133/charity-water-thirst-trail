"use strict";
/* Forgotten Canyon's authored visual pass. Purely decorative: world/quest coordinates,
   collision, saved progress, renderer ownership and 2D fallback remain in canyon.js. */
(() => {
  function build(THREE, {scene, camera, worldSpread, getState}) {
    let seed=782331;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const props=[];
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
      const colors=kind==="rock"?["#e0aa83","#cb8c70","#b77a64","#f1bf91"]:
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
    // A panoramic, vertex-colored sky dome with a cyan horizon and warm sunset.
    const skyGeo=new THREE.SphereGeometry(142,36,20);
    const skyPositions=skyGeo.getAttribute("position"),skyColors=new Float32Array(skyPositions.count*3);
    const horizon=new THREE.Color(0xe6b98e),upper=new THREE.Color(0x6ca9c5),
      overhead=new THREE.Color(0x426e98),paint=new THREE.Color();
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
      const mesh=add(geometry,new THREE.MeshStandardMaterial({
        map:terrainMap,vertexColors:true,roughness:1,side:THREE.DoubleSide
      }),cx,-.048,0);
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
      const cliff=add(g,new THREE.MeshStandardMaterial({
        vertexColors:true,roughness:.99,side:THREE.DoubleSide,flatShading:true
      }));cliff.receiveShadow=true;
    }
    // Irregular layered buttes beyond walkable land give both horizons proper scale.
    function butte(x,z,rad,height){
      const verts=[],cols=[],inds=[],sides=11,levels=9;
      const bands=["#ad715f","#d4936f","#f0b587","#bd7f68","#e9ab7f","#8f6259"]
        .map(c=>new THREE.Color(c));
      for(let k=0;k<=levels;k++){
        const t=k/levels,y=height*t-.03;
        const taper=1-t*.39+Math.sin(k*2.1)*.044;
        const tint=bands[Math.min(bands.length-1,Math.floor(t*bands.length))];
        for(let j=0;j<=sides;j++){
          const a=j/sides*Math.PI*2;
          const rough=.90+.12*Math.sin(a*3.7+k*1.8)+.07*Math.cos(a*6.1-k*2);
          verts.push(Math.cos(a)*rad*taper*rough,y,Math.sin(a)*rad*.88*taper*rough);
          cols.push(tint.r,tint.g,tint.b);
        }
      }
      for(let k=0;k<levels;k++)for(let j=0;j<sides;j++){
        const a=k*(sides+1)+j,b=a+sides+1;
        inds.push(a,b,a+1,b,b+1,a+1);
      }
      const g=new THREE.BufferGeometry();
      g.setIndex(inds);g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();
      const o=add(g,new THREE.MeshStandardMaterial({
        vertexColors:true,side:THREE.DoubleSide,roughness:1,flatShading:true
      }),x,0,z);o.rotation.y=rand()*Math.PI*2;return o;
    }
    for(let i=0;i<36;i++){
      const side=i%2?-1:1,x=side*(22.5+rand()*22);
      const z=-24+rand()*48;
      butte(x,z,1.35+rand()*2.7,3.4+rand()*9.5);
    }
    // Huge middle-distance silhouettes frame the far canyon but never the path.
    for(let i=0;i<8;i++){
      const sign=i%2?-1:1;
      butte(sign*(17+rand()*7),-23-rand()*9,2.3+rand()*2.4,6+rand()*7);
    }
    const geoRock=new THREE.IcosahedronGeometry(1,0);
    const rocks=new THREE.InstancedMesh(geoRock,deepStone,310);
    const temp=new THREE.Object3D();
    for(let i=0;i<310;i++){
      const side=i%2?-1:1,x=side*(3.9+rand()*18),z=-15+rand()*30;
      const sz=.075+rand()*.27;
      temp.position.set(x,-.005+sz*.35,z);
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
      const scale=.4+rand()*.9;temp.scale.set(scale,scale,scale);
      temp.updateMatrix();scrub.setMatrixAt(i,temp.matrix);
    }
    scrub.instanceMatrix.needsUpdate=true;scene.add(scrub);props.push(scrub);
    const block=(material,x,y,z,w,h,d,shadow=true)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z,shadow);
    const world=(x,y)=>[(x-500)/24,(y-305)/24];
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
      for(let i=0;i<9;i++)brick(-2+i*.50,2.68,-.04,.43,.22,.18,stoneMat);
      const ringGeo=new THREE.TorusGeometry(.24,.065,8,16);
      for(const cx of [-1.5,-.35,.85,1.55]){
        const clamp=new THREE.Mesh(ringGeo,metal);
        clamp.position.set(cx,2.35,-.22);clamp.rotation.y=Math.PI/2;
        clamp.castShadow=true;group.add(clamp);
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
        const wheel=mesh(new THREE.TorusGeometry(.33,.068,9,20),copper,cx,1.32,1.25);
        for(let a=0;a<4;a++){
          const p=a*Math.PI/2;
          const spoke=mesh(new THREE.BoxGeometry(.08,.48,.08),metal,cx+Math.sin(p)*.12,1.32+Math.cos(p)*.1,1.27);
          spoke.rotation.z=p;
        }
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
    const dust=new THREE.Points(sprayGeo,new THREE.PointsMaterial({
      color:0xffe2ba,size:.085,transparent:true,opacity:.32,
      depthWrite:false,depthTest:true,sizeAttenuation:true
    }));scene.add(dust);props.push(dust);
    const reduced=typeof window.matchMedia==="function"&&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finiteTime=t=>Number.isFinite(t)?t:0;
    return {
      update(time){
        const t=finiteTime(time);
        if(waterMap&&!reduced)waterMap.offset.y=-(t*.018%1);
        const completed=getState().done.has("span");
        brine.color.setHex(completed?0x8fe5d8:0x73cbd0);
        riverMesh.material.opacity=completed?.92:.76;
        if(!reduced){
          const xyz=sprayGeo.getAttribute("position");
          for(let i=0;i<155;i++){
            let x=xyz.getX(i)+Math.sin(t*.31+i)*.002;
            let y=xyz.getY(i)+.0006;
            if(y>4.48)y=.20;
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
        for(const g of geometries)g.dispose();
        for(const m of materials)m.dispose();
        for(const map of [terrainMap,stoneMap,blockMap,waterMap])map?.dispose();
        for(const object of props)if(object.parent)object.parent.remove(object);
      }
    };
  }
  window.ThirstCanyonVisuals=Object.freeze({build});
})();
