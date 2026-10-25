/* Original Thirst Trail character and visibility system. No downloaded assets. */
(function(){
  'use strict';
  function create(THREE){
    const root=new THREE.Group();root.name='ExplorerCharacter';
    const joints={};
    function joint(name,parent,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);joints[name]=g;return g;}
    const material=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
    const skin=material(0x603820,.64),lip=material(0x42271f),hair=material(0x191719),white=material(0xffedda,.48),iris=material(0x241b17,.35),shirt=material(0x278e88),trim=material(0x89c8b9),pants=material(0x304d65),seam=material(0x56738a),shoe=material(0x35332f),sole=material(0xaca58b),strap=material(0x40372b),yellow=material(0xf5c928,.42),cap=material(0xb48617,.5);
    function mesh(geo,mat,parent,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    const sphere=new THREE.SphereGeometry(1,16,12),cube=new THREE.BoxGeometry(1,1,1);
    const ell=(p,m,x,y,z,a,b,c)=>mesh(sphere,m,p,x,y,z,a,b,c);
    const box=(p,m,x,y,z,a,b,c)=>mesh(cube,m,p,x,y,z,a,b,c);
    const capsule=(p,m,x,y,z,r,len)=>mesh(new THREE.CapsuleGeometry(r,len,4,10),m,p,x,y,z);
    const body=joint('ExplorerBody',root);
    const torso=ell(body,shirt,0,1.35,0,.37,.49,.245);
    ell(body,pants,0,.98,0,.31,.17,.22);
    capsule(body,skin,0,1.85,0,.115,.12);
    const head=joint('ExplorerHead',body,0,2.04,0);
    ell(head,skin,0,.06,.015,.285,.345,.26);
    ell(head,skin,0,-.13,.10,.205,.14,.17);
    for(const side of [-1,1]){
      ell(head,skin,side*.275,.045,0,.065,.10,.055);
      ell(head,lip,side*.294,.045,.018,.026,.052,.025);
      ell(head,skin,side*.16,-.035,.21,.10,.075,.07);
    }
    const eyes=joint('ExplorerEyes',head);
    for(const side of [-1,1]){
      ell(eyes,white,side*.108,.10,.238,.065,.044,.027);
      ell(eyes,iris,side*.105,.10,.26,.028,.032,.014);
      ell(eyes,white,side*.10+.008,.112,.273,.009,.009,.006);
      const brow=ell(head,hair,side*.11,.175,.238,.075,.020,.025);brow.rotation.z=-side*.09;
    }
    ell(head,skin,0,.005,.275,.067,.073,.055);
    ell(head,lip,0,-.11,.247,.085,.018,.016);
    ell(head,skin,0,-.136,.242,.080,.018,.015);
    // Close cropped curls and a clean hairline leave the face unobstructed.
    ell(head,hair,0,.30,-.035,.278,.14,.25);
    for(let row=0;row<3;row++)for(let i=0;i<9;i++){
      const angle=i*Math.PI*2/9+row*.21,r=.23*Math.sin((row+1)*.45);
      ell(head,hair,Math.cos(angle)*r,.34+row*.022,Math.sin(angle)*r-.03,.062,.052,.061);
    }
    // A fitted overshirt, stitched pockets, collar and rolled sleeve cuffs.
    box(body,trim,0,1.40,.239,.025,.66,.018);
    for(const side of [-1,1]){
      const collar=box(body,trim,side*.09,1.76,.18,.14,.14,.035);collar.rotation.z=side*.3;
      box(body,shirt,side*.19,1.46,.219,.19,.20,.065);
      box(body,trim,side*.19,1.55,.255,.19,.025,.025);
      for(const y of [1.22,1.39,1.64])ell(body,sole,0,y,.255,.017,.017,.011);
    }
    // One recognizable yellow water can on the back (the face looks along +Z).
    // A broad, beveled body reads clearly at the gameplay camera's distance.
    const jug=joint('ExplorerPackFlap',body,0,1.40,-.35);
    const canOutline=new THREE.Shape();
    canOutline.moveTo(-.26,-.37);canOutline.lineTo(.26,-.37);
    canOutline.quadraticCurveTo(.33,-.37,.33,-.30);canOutline.lineTo(.33,.27);
    canOutline.quadraticCurveTo(.33,.36,.24,.36);canOutline.lineTo(-.24,.36);
    canOutline.quadraticCurveTo(-.33,.36,-.33,.27);canOutline.lineTo(-.33,-.30);
    canOutline.quadraticCurveTo(-.33,-.37,-.26,-.37);
    const canGeometry=new THREE.ExtrudeGeometry(canOutline,{
      depth:.30,steps:1,bevelEnabled:true,bevelThickness:.025,
      bevelSize:.025,bevelSegments:2,curveSegments:4
    });
    const can=mesh(canGeometry,yellow,jug,0,0,-.27);
    can.name='ExplorerWaterJug';
    // Open carrying handle and screw cap belong to the can, never to a hand.
    box(jug,yellow,-.205,.425,-.12,.055,.16,.10);
    box(jug,yellow,.035,.425,-.12,.055,.16,.10);
    box(jug,yellow,-.085,.505,-.12,.295,.055,.10);
    const lid=mesh(new THREE.CylinderGeometry(.073,.073,.075,12),cap,jug,.215,.40,-.12);
    lid.name='ExplorerWaterJugCap';
    // Molded X ribs reinforce the broad rear face rather than resembling a pack.
    for(const side of [-1,1]){
      const rib=box(jug,cap,0,-.035,-.306,.028,.48,.018);
      rib.rotation.z=side*.63;
    }
    for(const side of [-1,1]){
      const points=[new THREE.Vector3(side*.255,1.10,-.34),new THREE.Vector3(side*.27,1.65,-.30),new THREE.Vector3(side*.25,1.73,0),new THREE.Vector3(side*.235,1.58,.225),new THREE.Vector3(side*.255,1.10,.18),new THREE.Vector3(side*.255,1.10,-.34)];
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.035,5,false),strap,body,0,0,0);
      box(body,sole,side*.24,1.25,.247,.078,.10,.025);
    }
    joint('ExplorerScarfTail',body); // Legacy rig contract; no scarf accessory.
    const feet=[];
    for(const [i,side] of [-1,1].entries()){
      const suffix=i?'Right':'Left';
      const arm=joint('ExplorerArm'+suffix,body,side*.395,1.66,0);
      capsule(arm,shirt,0,-.14,0,.125,.24);
      capsule(arm,trim,0,-.285,0,.128,.025);
      const elbow=joint('ExplorerElbow'+suffix,arm,0,-.31,0);
      capsule(elbow,skin,0,-.145,0,.085,.22);
      ell(elbow,skin,0,-.33,.014,.09,.12,.065);
      ell(elbow,skin,-side*.075,-.30,.045,.038,.073,.04);
      for(let f=0;f<3;f++)capsule(elbow,skin,(f-1)*.038,-.405,.014,.021,.055);
      const leg=joint('ExplorerLeg'+suffix,body,side*.18,.87,0);
      capsule(leg,pants,0,-.20,0,.14,.28);
      const knee=joint('ExplorerKnee'+suffix,leg,0,-.43,0);
      capsule(knee,pants,0,-.19,0,.115,.28);
      box(knee,seam,side*.111,-.16,0,.014,.28,.045);
      const foot=joint('ExplorerFoot'+suffix,knee,0,-.43,0);feet.push(foot);
      ell(foot,shoe,0,.013,.07,.135,.10,.225);
      box(foot,sole,0,-.055,.065,.27,.05,.40);
      for(const z of [.06,.11,.16])box(foot,trim,0,.095,z,.15,.014,.02);
    }
    root.userData.adventure={joints,feet,torso,phase:0,move:0,run:0,action:0,last:null};
    return root;
  }
  function animate(root,{time,dt,distance=0,running=false,interaction=false,victory=false,reduced=false}){
    const a=root.userData.adventure;if(!a)return;
    const j=a.joints,blend=1-Math.exp(-dt*12);
    const moving=distance>.0001&&distance<2;
    a.move+=(Number(moving)-a.move)*blend;a.run+=(Number(running&&moving)-a.run)*blend;
    a.action+=((victory?2:interaction?1:0)-a.action)*blend;
    // Advance by actual world distance, so collision stops and different frame rates do not skate.
    const strideLength=.24+a.run*.09;
    if(moving)a.phase+=distance*Math.PI/(2*strideLength);
    const phase=a.phase,weight=a.move;
    j.ExplorerBody.position.y=0;j.ExplorerBody.rotation.set(0,0,0);
    a.torso.scale.y=.49*(1+(reduced?0:Math.sin(time*2)*.009));
    for(let i=0;i<2;i++){
      const s=i?'Right':'Left',p=phase+i*Math.PI;
      const lift=Math.max(0,Math.sin(p))*(.13+a.run*.08)*weight;
      const cycle=((p%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
      // Swing returns forward; stance travels backward at the exact ground speed.
      const z=(cycle<Math.PI?-Math.cos(cycle):3-2*cycle/Math.PI)*strideLength*weight;
      const down=.79-lift;
      const knee=Math.acos(Math.max(-1,Math.min(1,(down*down+z*z-2*.43*.43)/(2*.43*.43))));
      const hip=Math.atan2(-z,down)-knee*.5;
      j['ExplorerLeg'+s].rotation.x=hip;j['ExplorerKnee'+s].rotation.x=knee;
      a.feet[i].rotation.x=-hip-knee;
      const arm=j['ExplorerArm'+s],elbow=j['ExplorerElbow'+s];
      arm.rotation.set(-Math.cos(p)*weight*(.38+a.run*.2),0,(i?1:-1)*.08);
      elbow.rotation.x=-.16-a.run*.35;
      const v=Math.max(0,a.action-1),g=Math.min(1,a.action)*(1-v);
      arm.rotation.z+=(i?1:-1)*v*2.15;
      if(i){arm.rotation.x-=g*.75;elbow.rotation.x-=g*.7;}
    }
    j.ExplorerHead.rotation.set(victory?-.1:0,reduced?0:Math.sin(time*.65)*.035,0);
    j.ExplorerEyes.scale.y=!reduced&&time%5.1<.12?.12:1;
    j.ExplorerPackFlap.rotation.x=reduced?0:Math.sin(phase*2)*weight*.018;
  }
  function visibility(THREE,scene,player){
    const ray=new THREE.Raycaster(),target=new THREE.Vector3(),direction=new THREE.Vector3(),faded=new Map();let elapsed=1;
    function restore(mesh,entry){mesh.material=entry.original;entry.copies.forEach(m=>m.dispose());}
    return {update(camera,dt){
      elapsed+=dt;if(elapsed<.065)return;const step=Math.min(elapsed,.15);elapsed=0;
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);ray.camera=camera;
      const blocked=new Set();
      // Head and torso rays catch narrow scenery crossing the silhouette.
      for(const height of [.8,1.85]){
        player.getWorldPosition(target);target.y+=height;direction.subVectors(target,camera.position);
        ray.set(camera.position,direction.clone().normalize());ray.far=direction.length()-.35;
        for(const hit of ray.intersectObjects(scene.children,true)){
          const m=hit.object;let parent=m,ours=false,hidden=false;while(parent){if(parent===player)ours=true;if(!parent.visible)hidden=true;parent=parent.parent;}
          if(ours||hidden||!m.isMesh||!m.visible||hit.point.y<target.y-height+.22)continue;
          const original=faded.get(m)?.original||m.material;
          const materials=Array.isArray(original)?original:[original];
          if(materials.some(mat=>!mat.depthTest||mat.opacity<.5))continue;
          blocked.add(m);
          if(!faded.has(m)){
            const copies=materials.map(mat=>{const c=mat.clone();c.transparent=true;c.depthWrite=false;return c;});
            faded.set(m,{original:m.material,copies,opacity:1});m.material=Array.isArray(m.material)?copies:copies[0];
          }
        }
      }
      for(const [m,e] of faded){e.opacity+=((blocked.has(m)?.19:1)-e.opacity)*(1-Math.exp(-step*12));
        e.copies.forEach((mat,i)=>{const original=Array.isArray(e.original)?e.original[i]:e.original;mat.opacity=original.opacity*e.opacity;});
        if(!blocked.has(m)&&e.opacity>.995){restore(m,e);faded.delete(m);}
      }
    },dispose(){for(const [m,e] of faded)restore(m,e);faded.clear();}};
  }
  window.ThirstExplorer={create,animate,visibility};
})();
