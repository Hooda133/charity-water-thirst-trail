"use strict";
/* Decorative CC0 model integration for all Thirst Trail 3D locations.
 * Models are optional: collisions, quest coordinates, character animation,
 * progress saving and every 2D fallback stay owned by the original chapters.
 * License and file provenance: assets/upgraded_graphics/manifest.json.
 */
(() => {
  const SOURCE = Object.freeze({
    kenney: {
      owner: "Hidencod/tge-assets",
      sha: "e26d410c77163293bcf3c07614e024552a308c69",
      directory: "packs"
    },
    quaternius: {
      owner: "anshaneja5/skyline-run",
      sha: "0c41526d8d4130c37c15e219c2c3737fa8cb4ad8",
      directory: "public/assets/models"
    }
  });
  const N = "kenney/nature-kit/";
  const C = "kenney/city-kit-suburban/";
  const P = "kenney/pirate-kit/";
  const Q = "quaternius/nature/";
  const B = "quaternius/buildings/";
  // Positions are decorative, deliberately offset from mission markers,
  // bridge corridors, player spawn points, and named puzzle controls.
  // Height is in Three.js scene units; imported GLBs auto-normalize.
  const PLACEMENTS = Object.freeze({
    valley: [
      [N+"tree-oak.glb", 200,610,3.4,"low",.2],
      [N+"tree-default.glb", 350,890,3.1,"medium",1.0],
      [Q+"tree1.glb", 550,185,3.7,"high",2.1],
      [N+"tree-palmdetailedtall.glb", 1505,380,3.4,"medium",.4],
      [N+"rock-largea.glb", 820,970,1.3,"low",.8],
      [C+"building-type-a.glb", 385,615,3.4,"high",.5],
      [N+"flower-yellowa.glb", 1225,775,.55,"medium",.2],
      [N+"flower-purplea.glb", 1155,920,.5,"high",1.7],
      [N+"fence-simple.glb", 480,615,1.1,"high",0],
      [N+"tree-oak.glb", 1080,175,3.3,"ultra",.8],
      [C+"planter.glb", 530,760,.85,"ultra",0],
      [Q+"tree3.glb", 1625,860,3.4,"ultra",.5]
    ],
    canyon: [
      [N+"cactus-tall.glb", 238,145,2.2,"low",.3],
      [N+"rock-largea.glb", 148,485,1.8,"medium",1.1],
      [N+"cactus-short.glb", 302,545,1.25,"high",.9],
      [N+"rock-smalla.glb", 585,510,1.1,"medium",.2],
      [P+"barrel.glb", 300,477,1.0,"medium",1.8],
      [N+"cactus-tall.glb", 895,487,2.25,"high",1.8],
      [N+"rock-largea.glb", 867,95,2.4,"high",.7],
      [N+"bridge-wood.glb", 760,435,1.3,"ultra",1.1],
      [Q+"bush.glb", 890,245,1.1,"ultra",.4]
    ],
    coast: [
      [P+"palm-detailed-straight.glb", 175,480,3.6,"low",.1],
      [N+"tree-palmdetailedtall.glb", 942,485,3.4,"medium",.5],
      [P+"boat-row-small.glb", 260,585,1.3,"medium",1.4],
      [P+"structure-platform-dock-small.glb", 195,565,.9,"high",.3],
      [P+"barrel.glb", 260,310,1.0,"medium",.3],
      [N+"rock-largea.glb", 107,535,1.4,"high",.8],
      [N+"fence-gate.glb", 610,505,1.6,"high",.5],
      [C+"building-type-c.glb", 945,335,3.0,"ultra",.4],
      [P+"palm-detailed-straight.glb", 680,535,3.0,"ultra",2.6]
    ],
    village: [
      [C+"building-type-a.glb", 260,610,3.0,"medium",.25],
      [C+"building-type-c.glb", 730,740,3.1,"high",1.1],
      [C+"planter.glb", 620,485,.9,"low",.4],
      [N+"flower-yellowa.glb", 663,475,.6,"medium",.8],
      [N+"tree-oak.glb", 360,735,2.7,"medium",.4],
      [Q+"bush.glb", 475,535,1.1,"high",1.4],
      [N+"fence-simple.glb", 695,565,1.2,"high",.7],
      [C+"tree-small.glb", 805,585,2.4,"ultra",1.1],
      [N+"flower-purplea.glb", 635,675,.55,"ultra",.6]
    ]
  });
  const QUALITY = Object.freeze({low:0,medium:1,high:2,ultra:3});
  const activeMounts = new Set();
  const remote = key => {
    const parts = key.split("/");
    if(parts[0] === "kenney") {
      return "https://raw.githubusercontent.com/"+SOURCE.kenney.owner+"/"+SOURCE.kenney.sha+
        "/"+SOURCE.kenney.directory+"/"+parts.slice(1).join("/");
    }
    if(parts[0] === "quaternius") {
      return "https://raw.githubusercontent.com/"+SOURCE.quaternius.owner+"/"+SOURCE.quaternius.sha+
        "/"+SOURCE.quaternius.directory+"/"+parts[parts.length-1];
    }
    throw Error("Unapproved scenic asset: "+key);
  };
  const qualityRank = name => QUALITY[name] ?? QUALITY.high;
  const message = (...args) => { if(typeof console !== "undefined") console.warn(...args); };

  function mount(THREE,{parent,chapter,wx,wz,getGraphics=()=>({preset:"high"})}) {
    if(!THREE?.Group || !parent?.add || typeof wx!=="function" || typeof wz!=="function" ||
      !Object.prototype.hasOwnProperty.call(PLACEMENTS,chapter)) return null;
    const root = new THREE.Group();
    root.name = "Licensed CC0 scenery: "+chapter;
    root.userData.decorative = true;
    root.userData.noCollision = true;
    parent.add(root);
    let disposed=false,loaderPromise=null;
    const cache=new Map(),sources=new Set(),rows=[],failure=new Set();
    let requested=0,shown=0;
    function loader() {
      if(!loaderPromise) loaderPromise=import("three/addons/loaders/GLTFLoader.js")
        .then(({GLTFLoader}) => new GLTFLoader());
      return loaderPromise;
    }
    // A decoded GLB source and its display clones share geometries and
    // materials. Dispose each distinct resource exactly once when the chapter
    // exits, including a download that finishes after its mount was removed.
    function releaseResources(roots) {
      const geometries=new Set(),materials=new Set(),textures=new Set();
      for(const scene of roots)scene?.traverse?.(object => {
        if(!object.isMesh)return;
        if(object.geometry)geometries.add(object.geometry);
        const mats=Array.isArray(object.material)?object.material:[object.material];
        for(const mat of mats)if(mat){
          materials.add(mat);
          for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
        }
      });
      for(const geometry of geometries)geometry.dispose?.();
      for(const material of materials)material.dispose?.();
      for(const texture of textures)texture.dispose?.();
    }
    async function sourceModel(key) {
      if(cache.has(key)) return cache.get(key);
      const promise=(async () => {
        const gltfLoader=await loader();
        if(disposed)return null;
        // Prefer checked-in assets. Do not fetch a remote fallback if a
        // player switched chapters while the local file was loading.
        let scene;
        try { scene=(await gltfLoader.loadAsync("./assets/upgraded_graphics/"+key)).scene; }
        catch(localError) {
          if(disposed)return null;
          scene=(await gltfLoader.loadAsync(remote(key))).scene;
        }
        if(disposed){releaseResources([scene]);return null;}
        sources.add(scene);
        return scene;
      })();
      cache.set(key,promise);
      return promise;
    }
    function setModelPosition(model,row) {
      const bounds=new THREE.Box3().setFromObject(model);
      const size=bounds.getSize(new THREE.Vector3());
      const height=Math.max(.001,size.y);
      // Uniform scaling retains the author's geometry and embedded textures.
      const scale=row[3]/height;
      model.scale.setScalar(scale);
      model.rotation.y=row[5]||0;
      const scaled=new THREE.Box3().setFromObject(model);
      const center=scaled.getCenter(new THREE.Vector3());
      model.position.set(wx(row[1])-center.x,-scaled.min.y,wz(row[2])-center.z);
    }
    function queue(row) {
      if(row.requested||disposed) return;
      row.requested=true;requested++;
      sourceModel(row.asset).then(scene => {
        if(disposed||!scene) return;
        const model=scene.clone(true);
        setModelPosition(model,row.original);
        model.name="CC0 "+row.asset;
        model.userData.decorative=true;
        model.traverse(obj => {
          if(obj.isMesh) {
            obj.castShadow=false; // keep mobile shadows economical
            obj.receiveShadow=true;
            obj.userData.cameraOccluder=false;
            obj.userData.decorative=true;
          }
        });
        row.model=model;
        model.visible=row.enabled;
        root.add(model);
        shown++;
      }).catch(err => {
        if(!disposed) {
          failure.add(row.asset);
          message("Optional CC0 model unavailable; keeping procedural scenery:",row.asset,err);
        }
      });
    }
    for(const entry of PLACEMENTS[chapter]) {
      rows.push({original:entry,asset:entry[0],min:qualityRank(entry[4]),
        requested:false,enabled:false,model:null});
    }
    function update(next={}) {
      if(disposed)return;
      const graphics=next.preset?next:getGraphics()||{};
      const quality=qualityRank(graphics.preset);
      for(const row of rows) {
        row.enabled=quality>=row.min;
        if(row.model) row.model.visible=row.enabled;
        if(row.enabled) queue(row);
      }
    }
    function dispose() {
      if(disposed)return;
      disposed=true;
      activeMounts.delete(controller);
      root.removeFromParent();
      releaseResources([root,...sources]);
      root.clear();
      sources.clear();
      cache.clear();
    }
    const controller={update,dispose,status:()=>({chapter,total:rows.length,loaded:shown,
      requested,failed:failure.size,quality:getGraphics()?.preset||"high",localPath:"assets/upgraded_graphics"})};
    activeMounts.add(controller);
    update();
    return controller;
  }
  window.TrailScenicAssets=Object.freeze({
    mount,
    placements: chapter => (PLACEMENTS[chapter]||[]).map(row=>({asset:row[0],x:row[1],y:row[2],minQuality:row[4]})),
    status:()=>[...activeMounts].map(m=>m.status())
  });
})();
