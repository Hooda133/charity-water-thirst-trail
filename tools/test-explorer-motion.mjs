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
const jug=model.getObjectByName('ExplorerWaterJug');
assert.ok(jug,'One recognizable water jug is attached to the playable character');
assert.equal(jug.material.color.getHex(),0xf5c928,'The water jug is yellow');
jug.geometry.computeBoundingBox();
function checkJugOnBack(){
  model.updateMatrixWorld(true);
  const toBody=new THREE.Matrix4().copy(a.joints.ExplorerBody.matrixWorld).invert().multiply(jug.matrixWorld);
  const bounds=jug.geometry.boundingBox.clone().applyMatrix4(toBody);
  assert.ok(bounds.max.z<-.245,'Entire jug stays behind the torso, never on the chest');
}
let triangles=0,meshes=0;model.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});
assert.ok(triangles<50000);assert.ok(meshes<160);
for(let frame=0;frame<480;frame++){
  window.ThirstExplorer.animate(model,{time:frame/60,dt:1/60,distance:frame<360?.035:0,running:frame>180&&frame<360});
  model.updateMatrixWorld(true);
  checkJugOnBack();
  const soles=a.feet.map(f=>f.localToWorld(new THREE.Vector3(0,-.08,0)).y);
  assert.ok(Math.min(...soles)>-.001,'No foot penetrates the floor');
  assert.ok(Math.abs(Math.min(...soles))<.001,'Stance foot stays planted');
}
assert.ok(a.joints.ExplorerKneeLeft.rotation.x<.32,'Idle posture has softly relaxed, not crouched knees');
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
checkJugOnBack();
// Releasing victory must return directly to idle, without passing through a greeting pose.
for(let f=0;f<120;f++){
 window.ThirstExplorer.animate(model,{time:10+f/60,dt:1/60});
 assert.ok(Math.abs(a.joints.ExplorerArmRight.rotation.x)<.02,'No unintended wave while victory fades');
}
// The two short settling steps always keep one support foot planted.
for(let f=0;f<30;f++)window.ThirstExplorer.animate(model,{time:f/60,dt:1/60,distance:.03,interaction:true});
assert.ok(a.interaction<.01,'Interaction reach is suppressed while travelling');
let previousStop=[];
for(let f=0;f<30;f++){
 window.ThirstExplorer.animate(model,{time:1+f/60,dt:1/60});model.updateMatrixWorld(true);
 const feet=a.feet.map(foot=>foot.localToWorld(new THREE.Vector3(0,-.08,0)));
 assert.ok(Math.abs(Math.min(...feet.map(foot=>foot.y)))<.001,'Stopping retains a support foot');
 if(previousStop.length)for(let i=0;i<2;i++){
   if(feet[i].y<1e-6&&previousStop[i].y<1e-6)
     assert.ok(Math.abs(feet[i].z-previousStop[i].z)<.0001,'Grounded foot does not slide during stopping');
 }
 previousStop=feet;
}
// Shared materials must restore by identity, including with a scaled chapter scene.
for(const scale of [1,1.42]){
 const scene=new THREE.Scene();scene.scale.set(scale,1,scale);scene.add(model);model.position.set(2,0,0);
 const original=new THREE.MeshStandardMaterial({color:0x996644});
 const rock=new THREE.Mesh(new THREE.BoxGeometry(3,4,1),original);rock.position.set(2,1,3);scene.add(rock);
 const camera=new THREE.PerspectiveCamera();camera.position.set(2*scale,2,8*scale);camera.lookAt(2*scale,1,0);
 const fade=window.ThirstExplorer.visibility(THREE,scene,model);
 fade.update(camera,.07);
 const firstFade=rock.material.opacity;fade.update(camera,.01);
 assert.ok(rock.material.opacity<firstFade,'Fade blends between throttled ray queries');
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.notEqual(rock.material,original);assert.ok(rock.material.opacity<.1,'Blocker fades deeply enough to preserve character contrast');
 rock.position.x+=20;
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.equal(rock.material,original,'Original scenery material restored');
 fade.dispose();scene.remove(model);
}
// A narrow shelf can obscure the chest while both waist and face rays miss it.
{
 const scene=new THREE.Scene();scene.add(model);model.position.set(2,0,0);
 const original=new THREE.MeshStandardMaterial({color:0xa66a48});
 const shelf=new THREE.Mesh(new THREE.BoxGeometry(.6,.12,.3),original);
 shelf.position.set(2,1.55,3);scene.add(shelf);
 const camera=new THREE.PerspectiveCamera();camera.position.set(2,1.55,8);camera.lookAt(2,1.55,0);
 const fade=window.ThirstExplorer.visibility(THREE,scene,model);
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.notEqual(shelf.material,original,'Chest-only sandstone shelf is detected');
 assert.ok(shelf.material.opacity<.1,'Chest blocker fades deeply');
 shelf.position.x=20;
 for(let f=0;f<40;f++)fade.update(camera,.07);
 assert.equal(shelf.material,original,'Chest shelf restores its exact original material');
 fade.dispose();scene.remove(model);
}
console.log(`✓ Shared explorer: ${meshes} meshes, ${triangles} triangles`);
console.log('✓ Walk/run/stop feet remain grounded; victory pose and attached jug');
console.log('✓ Rocks fade and restore original materials in both chapter scales');

// Check the actual rendered ramp triangles against the foot-height plane. In particular,
// adding world and local Z must not round an inner corner outside the bridge boundary.
const valleySource=readFileSync(new URL('../script.js',import.meta.url),'utf8');
const terrainFunction=valleySource.match(/function terrainElevation\(x,z\)\{[\s\S]*?\n    \}/)[0];
const bridgeFunction=valleySource.match(/function bridgeGroundHeight\(x,z\)\{[\s\S]*?\n    \}/)[0];
const bridgeHalfDepth=1.365,bridgeX=(850+44*Math.sin(583.5/195+.35)-900)/40,bridgeZ=(583.5-550)/40;
const bridgeHeight=new Function('bridgeX','bridgeZ','bridgeHalfDepth',
 `${terrainFunction}\n${bridgeFunction}\nreturn bridgeGroundHeight;`)(bridgeX,bridgeZ,bridgeHalfDepth);
for(const side of [-1,1]){
 const vertices=[];
 for(const [x,z] of [[side*3.18,-bridgeHalfDepth],[side*3.18,bridgeHalfDepth],
   [side*4,-bridgeHalfDepth],[side*4,bridgeHalfDepth]])
   vertices.push(x,bridgeHeight(bridgeX+x,bridgeZ+z),z);
 assert.ok(Math.abs(vertices[1]-.57)<1e-6&&Math.abs(vertices[4]-.57)<1e-6,'Both inner ramp corners join the deck');
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(side>0?[0,1,2,2,1,3]:[0,2,1,2,3,1]);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const ramp=new THREE.Mesh(geometry,material);ramp.position.set(bridgeX,0,bridgeZ);ramp.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,20);
 for(let i=1;i<100;i++)for(let k=1;k<100;k++){
   const x=bridgeX+side*(3.18+.82*i/100),z=bridgeZ-bridgeHalfDepth+2*bridgeHalfDepth*k/100;
   ray.ray.origin.set(x,10,z);const hit=ray.intersectObject(ramp)[0];
   assert.ok(hit&&Math.abs(bridgeHeight(x,z)-hit.point.y)<1e-5,'Foot plane follows the ramp mesh without floating or clipping');
 }
 geometry.dispose();material.dispose();
}
console.log('✓ Bridge foot heights match 19,602 real ramp raycasts and both deck-edge corners');
