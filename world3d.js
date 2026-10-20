/* Thirst Trail - real-time, stylized Three.js world.
   Original quest, energy and interaction logic remains in script.js.
   Three.js is loaded at runtime; if unavailable, the original 2D game remains playable. */
export async function createWorld(originalCanvas, options = {}) {
  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
  } catch (primaryError) {
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
    ["spring",1460,265,"Hill Spring",0x75edff]
  ];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb5dcd6);
  scene.fog = new THREE.FogExp2(0xb5dcd6, .018);
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 180);
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const view = renderer.domElement;
  view.id = "world3dCanvas";
  view.tabIndex = 0;
  view.setAttribute("aria-label","Three-dimensional Thirst Trail adventure world. Use WASD to walk, E to interact, or click the landscape.");
  view.style.touchAction = "manipulation";
  view.style.display = "block";
  const host = originalCanvas.parentElement;
  const hero = document.querySelector(".hero-scene");

  scene.add(new THREE.HemisphereLight(0xe6faff, 0x557d51, 2.2));
  const sun = new THREE.DirectionalLight(0xffe7b1, 3.3);
  sun.position.set(-19, 32, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -.00015;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x8ae5eb, .8);
  fill.position.set(18,12,8); scene.add(fill);
  const makeMat = (color, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
  const mats = {
    grass:makeMat(0x87b96a), grass2:makeMat(0x6ea45d), grass3:makeMat(0xa4cb74),
    trunks:makeMat(0x80533b), leaf1:makeMat(0x3d985f), leaf2:makeMat(0x6cbb68),
    leaf3:makeMat(0x237b60), leaf4:makeMat(0x9dcb76), wood:makeMat(0x95603b),
    lightWood:makeMat(0xc79056), rock:makeMat(0x8c9c86), rock2:makeMat(0xbac0a1),
    sand:makeMat(0xe9bf7d), dark:makeMat(0x2a4650), gold:makeMat(0xffd76f),
    roof:makeMat(0xb9634e), wall:makeMat(0xf0d5a3), door:makeMat(0x94623e)
  };
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
  const terrainGeometry=new THREE.PlaneGeometry(52,33,68,42);
  terrainGeometry.rotateX(-Math.PI/2);
  const positions=terrainGeometry.getAttribute("position");
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i);
    const edge=Math.max(0,(Math.abs(x)-19)/7,(Math.abs(z)-11)/6);
    positions.setY(i,-.19+Math.sin(x*.43)*.07+Math.cos(z*.67)*.06+edge*edge*1.4);
  }
  terrainGeometry.computeVertexNormals();
  mesh(terrainGeometry,mats.grass,scene,false);
  for(let i=0;i<34;i++){
    const x=(rng()-.5)*43,z=(rng()-.5)*26;
    const patch=mesh(new THREE.CircleGeometry(1,22),i%3===0?mats.grass3:mats.grass2,scene,false);
    patch.rotation.x=-Math.PI/2;patch.position.set(x,-.07,z);patch.scale.set(.8+rng()*2.8,.4+rng()*1.7,1);
  }
  const riverPoints=[];
  for(let i=0;i<=80;i++){const py=-80+i*16;riverPoints.push([wx(riverCenter(py)),wz(py)]);}
  ribbon(riverPoints,5.3,-.015,makeMat(0xd7c49a));
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x19a9c4,metalness:.18,roughness:.13,transparent:true,opacity:.94,clearcoat:1,clearcoatRoughness:.11,side:THREE.DoubleSide});
  ribbon(riverPoints,4.55,.038,waterMat);
  const ripples=[];
  const rippleMat=new THREE.MeshBasicMaterial({color:0xc5ffff,transparent:true,opacity:.55,depthWrite:false});
  for(let i=0;i<42;i++){
    const z=-15+(i/42)*30,x=wx(riverCenter(z*SCALE+550))+(rng()-.5)*2.8;
    const wave=mesh(new THREE.TorusGeometry(.12+rng()*.21,.015,5,18,Math.PI),rippleMat,scene,false);
    wave.rotation.x=-Math.PI/2;wave.position.set(x,.064,z);wave.rotation.z=rng()*6;
    ripples.push(wave);
  }
  // Paths are curves integrated into the meadow rather than straight flat UI lines.
  function road(raw,width=.95){
    const curve=new THREE.CatmullRomCurve3(raw.map(p=>new THREE.Vector3(wx(p[0]),.075,wz(p[1]))));
    const pts=curve.getPoints(85).map(p=>[p.x,p.z]);
    ribbon(pts,width,.077,mats.sand);
    ribbon(pts,width*.74,.083,makeMat(0xd4a971),scene);
  }
  road([[285,490],[370,630],[455,765],[610,708],[730,580],[970,580],[1180,825],[1540,690]]);
  road([[280,490],[420,435],[540,350]],.65);
  road([[970,580],[1170,415],[1460,265]],.65);
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

  // Richly grouped trees: roots, tapered bark, several shaded foliage crowns.
  const treeMaterials=[mats.leaf1,mats.leaf2,mats.leaf3,mats.leaf4];
  function tree(x,z,s=1){
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);
    cyl(g,mats.trunks,0,.76,0,.22,.33,1.57);
    ball(g,mats.trunks,-.22,.14,.12,.36,.17,.34);
    const offsets=[[0,2.2,0,.95],[-.65,1.86,.15,.73],[.58,2.08,.25,.79],[.16,2.58,-.41,.83],[-.25,2.47,.43,.65]];
    for(let j=0;j<offsets.length;j++){const v=offsets[j];ball(g,treeMaterials[j%4],v[0],v[1],v[2],v[3],v[3]*.89,v[3]);}
    return g;
  }
  const objectivePositions=spots.map(p=>[wx(p[1]),wz(p[2])]);
  for(let i=0;i<115;i++){
    const x=(rng()-.5)*45,z=(rng()-.5)*27;
    const screenY=z*SCALE+550;
    if(Math.abs(x-wx(riverCenter(screenY)))<3.4)continue;
    if(objectivePositions.some(p=>Math.hypot(x-p[0],z-p[1])<2.2))continue;
    if(Math.abs(x+13)<3.2 && z> -5 && z<8)continue;
    tree(x,z,.52+rng()*.66);
  }
  // Pastel mountains, boulders and distant vegetation.
  const mtMat=[makeMat(0x779f8e),makeMat(0x91b39c),makeMat(0x719791)];
  for(let i=0;i<24;i++){
    const ang=i/24*Math.PI*2,rx=Math.cos(ang)*31,rz=Math.sin(ang)*22;
    const h=3+rng()*7;
    const m=mesh(new THREE.ConeGeometry(2.7+rng()*2.5,h,5),mtMat[i%3],scene);
    m.position.set(rx,h/2-.4,rz);
    if(i%3===0)ball(scene,makeMat(0xdae2d0),rx,h*.92-.4,rz,1.25,.45,1.22);
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

  // Village cottages use wall volumes, roof geometry, windows, chimney and door.
  function cottage(px,py,size=1,tint=0xf0d5a3){
    const g=new THREE.Group();g.position.set(wx(px),0,wz(py));g.scale.setScalar(size);scene.add(g);
    const wall=makeMat(tint);
    box(g,wall,0,1.25,0,3.2,2.5,2.7);
    box(g,mats.door,0,.83,1.36,.78,1.65,.12);
    ball(g,mats.gold,.26,.92,1.47,.06);
    for(const x of [-1.1,1.1]){
      box(g,mats.dark,x,1.67,1.38,.61,.72,.07);
      box(g,makeMat(0xa5e8e7),x,1.67,1.43,.44,.55,.05);
      box(g,mats.wall,x,1.66,1.49,.065,.65,.055);
      box(g,mats.wall,x,1.66,1.49,.50,.065,.055);
    }
    const roof=mesh(new THREE.ConeGeometry(2.48,1.8,4),mats.roof,g);
    roof.position.set(0,3.16,0);roof.rotation.y=Math.PI/4;roof.scale.z=.83;
    box(g,mats.rock2,-.9,3.25,-.35,.38,1.1,.38);
    for(const x of [-1.47,1.47])box(g,mats.wood,x,.3,0,.17,.6,2.8);
    return g;
  }
  cottage(150,400,1.15);cottage(345,270,.86,0xeac7a3);cottage(270,830,.75,0xf8d2b4);
  cottage(460,760,.87,0xe0bc8c);
  // Supply station with recognizable crates and banner.
  const supply=new THREE.Group();supply.position.set(wx(1190),0,wz(825));scene.add(supply);
  for(let i=0;i<4;i++){
    const x=(i%2)*.98-.5,z=Math.floor(i/2)*.92-.4;
    box(supply,mats.wood,x,.39,z,.9,.78,.86);
    box(supply,mats.lightWood,x,.81,z,.93,.09,.91);
    box(supply,mats.dark,x,.39,z,.08,.75,.9);
  }
  // Campsite: pitched tent, logs and warm firelight.
  const camp=new THREE.Group();camp.position.set(wx(540),0,wz(350));scene.add(camp);
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
  cyl(pump,makeMat(0x2899a7,.18),0,.47,1.45,.68,.68,.035,14);
  // Alternative mountain spring.
  const spring=new THREE.Group();spring.position.set(wx(1460),0,wz(265));scene.add(spring);
  for(let i=0;i<7;i++){
    const a=i/7*Math.PI*2;
    ball(spring,mats.rock2,Math.cos(a)*1.3,.25,Math.sin(a)*.95,.6,.37,.48);
  }
  const pond=mesh(new THREE.CylinderGeometry(1.18,1.18,.09,32),waterMat,spring,false);
  pond.position.y=.20;

  // Mission markers and billboard labels that stay legible as the camera moves.
  function labelTexture(title){
    const cn=document.createElement("canvas");cn.width=512;cn.height=128;
    const c=cn.getContext("2d");
    c.fillStyle="#123c46";c.beginPath();c.roundRect(10,8,492,109,28);c.fill();
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
    const badge=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(name),transparent:true,depthTest:false}));
    badge.position.set(0,3.25,0);badge.scale.set(3.15,.79,1);g.add(badge);
    const dot=ball(g,new THREE.MeshBasicMaterial({color}),0,1.72,0,.23,.23,.23,false);
    markers[key]={group:g,ring,beacon,dot,mat};
  }
  // Low-poly backpacker: independent articulated legs and arms for real walking.
  const explorer=new THREE.Group();scene.add(explorer);
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
  for(const x of [-.13,.13])ball(body,mats.dark,x,2.18,.335,.04,.05,.03);
  box(body,bag,0,1.45,-.47,.78,.94,.36);
  box(body,mats.lightWood,0,1.5,-.67,.46,.07,.05);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.48,1.75,0);body.add(arm);
    const sleeve=cyl(arm,shirt,0,-.17,0,.18,.15,.36);
    cyl(arm,skin,0,-.54,0,.13,.11,.38);
    arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.22,.9,0);body.add(leg);
    cyl(leg,pants,0,-.27,0,.19,.16,.59);
    box(leg,boots,0,-.59,.10,.35,.25,.53);
    legs.push(leg);
  }
  explorer.position.set(wx(310),0,wz(620));
  // Soft clouds have volume instead of a CSS illustration.
  const cloudMat=new THREE.MeshStandardMaterial({color:0xf5f5e6,transparent:true,opacity:.66,roughness:1,depthWrite:false});
  const clouds=[];
  for(let i=0;i<10;i++){
    const g=new THREE.Group();g.position.set((rng()-.5)*50,10+rng()*6,(rng()-.5)*31);
    for(let j=0;j<4;j++)ball(g,cloudMat,(j-1.5)*1.35,Math.sin(j)*.27,0,1.1+rng()*.5,.55+rng()*.25,.8,false);
    scene.add(g);clouds.push(g);
  }
  const camTarget=new THREE.Vector3(),camPos=new THREE.Vector3(),look=new THREE.Vector3();
  const raycaster=new THREE.Raycaster();
  const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const pointer=new THREE.Vector2(),hit=new THREE.Vector3();
  view.addEventListener("click",event=>{
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
  });
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
    const rect=parent===hero?hero.getBoundingClientRect():originalCanvas.getBoundingClientRect();
    const width=Math.max(200,Math.floor(rect.width||1000));
    const height=parent===hero?Math.max(240,Math.floor(rect.height||550)):Math.max(100,Math.floor(width*.61));
    if(lastWidth!==width||lastHeight!==height){
      renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      lastWidth=width;lastHeight=height;
    }
    const playerX=wx(state.x),playerZ=wz(state.y);
    const crossing=state.y>530&&state.y<635&&state.x>735&&state.x<967;
    const playerY=crossing?.58:0;
    explorer.position.set(playerX,playerY,playerZ);
    const isMoving=!!state.moving&&state.screen==="playing";
    const pace=isMoving?Math.sin(time*11)*.57:0;
    legs[0].rotation.x=pace;legs[1].rotation.x=-pace;
    arms[0].rotation.x=-pace*.75;arms[1].rotation.x=pace*.75;
    body.position.y=isMoving?Math.abs(Math.sin(time*11))*.065:Math.sin(time*1.9)*.025;
    if(isMoving){
      const dx=playerX-explorer.userData.lastX, dz=playerZ-explorer.userData.lastZ;
      if(Number.isFinite(dx)&&Number.isFinite(dz)&&Math.hypot(dx,dz)>.003){
        const heading=Math.atan2(dx,dz);
        let diff=((heading-explorer.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
        explorer.rotation.y+=diff*.2;
      }
    }
    explorer.userData.lastX=playerX;explorer.userData.lastZ=playerZ;
    for(let i=0;i<ripples.length;i++){ripples[i].position.z+=.012;if(ripples[i].position.z>15.2)ripples[i].position.z=-15.2;}
    for(let i=0;i<clouds.length;i++){clouds[i].position.x+=.0014;if(clouds[i].position.x>28)clouds[i].position.x=-28;}
    for(const [key,m] of Object.entries(markers)){
      const done=(state.done&&state.done.has(key))||(key==="river"&&state.inventory&&state.inventory.has("testKit"));
      m.mat.color.setHex(done?0x69edaa:(key==="camp"?0x8af9bf:(key==="river"||key==="spring"?0x75edff:0xffd45b)));
      m.ring.scale.setScalar(1+Math.sin(time*3+spots.findIndex(s=>s[0]===key))*.08);
      m.dot.position.y=1.73+Math.sin(time*2.2)*.17;
      m.beacon.visible=!done;
    }
    fire.scale.y=.84+Math.sin(time*13)*.15;
    fireLight.intensity=11+Math.sin(time*9)*3;
    let aim;
    if(playing){
      aim=new THREE.Vector3(playerX,.8,playerZ);
      camPos.copy(aim).add(new THREE.Vector3(10.4,16.8,21));
    } else {
      aim=new THREE.Vector3(-4,0,-1);
      camPos.copy(aim).add(new THREE.Vector3(16,22,27));
    }
    if(firstFrame){
      camera.position.copy(camPos);camTarget.copy(aim);firstFrame=false;
    }else{
      camera.position.lerp(camPos,.055);
      camTarget.lerp(aim,.075);
    }
    camera.lookAt(camTarget);
    renderer.render(scene,camera);
  }
  return {
    render,
    focus(){view.focus({preventScroll:true});},
    dispose(){renderer.dispose();view.remove();hero?.classList.remove("is-3d");originalCanvas.style.display="";},
    getCanvas(){return view;}
  };
}
