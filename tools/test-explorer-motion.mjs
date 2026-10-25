// Actual Three.js transform / raycasting regression; optional offline module path argument.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
const url='https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const THREE=await import(process.argv[2]?pathToFileURL(resolve(process.argv[2])).href:
  'data:text/javascript;base64,'+Buffer.from(await (await fetch(url)).text()).toString('base64'));
const window={};runInNewContext(readFileSync(new URL('../explorer.js',import.meta.url),'utf8'),{window});
const model=window.ThirstExplorer.create(THREE),a=model.userData.adventure;
let triangles=0,meshes=0;model.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});
assert.ok(triangles<50000);assert.ok(meshes<160);
for(let frame=0;frame<480;frame++){
  window.ThirstExplorer.animate(model,{time:frame/60,dt:1/60,distance:frame<360?.035:0,running:frame>180&&frame<360});
  model.updateMatrixWorld(true);
  const soles=a.feet.map(f=>f.localToWorld(new THREE.Vector3(0,-.08,0)).y);
  assert.ok(Math.min(...soles)>-.001,'No foot penetrates the floor');
  assert.ok(Math.abs(Math.min(...soles))<.001,'Stance foot stays planted');
}
// Verify world-space contact during steady, straight travel, not only vertical grounding.
let previous=[];
for(let frame=0;frame<180;frame++){
 model.position.z+=.01;
 window.ThirstExplorer.animate(model,{time:frame/60,dt:1/60,distance:.01});model.updateMatrixWorld(true);
 const current=a.feet.map(f=>f.localToWorld(new THREE.Vector3(0,-.08,0)));
 if(frame>100)for(let i=0;i<2;i++){
   if(current[i].y<1e-6&&previous[i].y<1e-6)
     assert.ok(Math.abs(current[i].z-previous[i].z)<.0001,'Stance foot does not slide');
 }
 previous=current;
}
model.position.z=0;
for(let f=0;f<120;f++)window.ThirstExplorer.animate(model,{time:8+f/60,dt:1/60,victory:true});
assert.ok(a.joints.ExplorerArmRight.rotation.z>2,'Victory raises both arms');
assert.ok(a.joints.ExplorerArmLeft.rotation.z< -2);
assert.equal(a.joints.ExplorerPackFlap.parent,a.joints.ExplorerBody,'Jug stays on the torso');
// Shared materials must restore by identity, including with a scaled chapter scene.
for(const scale of [1,1.42]){
 const scene=new THREE.Scene();scene.scale.set(scale,1,scale);scene.add(model);model.position.set(2,0,0);
 const original=new THREE.MeshStandardMaterial({color:0x996644});
 const rock=new THREE.Mesh(new THREE.BoxGeometry(3,4,1),original);rock.position.set(2,1,3);scene.add(rock);
 const camera=new THREE.PerspectiveCamera();camera.position.set(2*scale,2,8*scale);camera.lookAt(2*scale,1,0);
 const fade=window.ThirstExplorer.visibility(THREE,scene,model);
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.notEqual(rock.material,original);assert.ok(rock.material.opacity<.22,'Blocker fades without flickering');
 rock.position.x+=20;
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.equal(rock.material,original,'Original scenery material restored');
 fade.dispose();scene.remove(model);
}
console.log(`✓ Shared explorer: ${meshes} meshes, ${triangles} triangles`);
console.log('✓ Walk/run/stop feet remain grounded; victory pose and attached jug');
console.log('✓ Rocks fade and restore original materials in both chapter scales');
