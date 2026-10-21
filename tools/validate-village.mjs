#!/usr/bin/env node
// Offline validator for the original village glTF pack and its scene integration.
// Run from the repository root: node tools/validate-village.mjs
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";

const root=resolve(import.meta.dirname,"..");
const modelPath=resolve(root,"assets/village/village-kit.gltf");
const model=JSON.parse(readFileSync(modelPath,"utf8"));
const html=readFileSync(resolve(root,"index.html"),"utf8");
const script=readFileSync(resolve(root,"script.js"),"utf8");

assert.equal(model.asset.version,"2.0");
assert.equal(model.buffers.length,1);
assert.ok(model.buffers[0].uri.startsWith("data:application/octet-stream;base64,"));
const data=Buffer.from(model.buffers[0].uri.split(",")[1],"base64");
assert.equal(data.length,model.buffers[0].byteLength);
assert.ok(data.length<3_000_000,"Asset should stay practical for laptops");

const componentSize={5123:2,5125:4,5126:4};
const arity={SCALAR:1,VEC3:3};
for(const [index,view] of model.bufferViews.entries()){
  assert.equal(view.byteOffset%4,0,`bufferView ${index} not aligned`);
  assert.ok(view.byteOffset+view.byteLength<=data.length,`bufferView ${index} overruns buffer`);
}
for(const [index,accessor] of model.accessors.entries()){
  const view=model.bufferViews[accessor.bufferView];
  assert.ok(view,`accessor ${index} missing bufferView`);
  const itemSize=componentSize[accessor.componentType]*arity[accessor.type];
  assert.ok(itemSize,`accessor ${index} unsupported component format`);
  assert.ok(accessor.count*itemSize<=view.byteLength,`accessor ${index} overruns bufferView`);
}
const names=["ElderHall","UpperCottage","LowerCottage","Workshop"];
let triangles=0;
for(const name of names){
  const node=model.nodes.find(n=>n.name===name);
  assert.ok(node,`missing node ${name}`);
  const mesh=model.meshes[node.mesh];
  assert.ok(mesh && mesh.primitives.length>=8,`model ${name} is missing material details`);
  for(const primitive of mesh.primitives){
    assert.equal(primitive.mode,4,"Expected triangulated geometry");
    assert.ok(model.materials[primitive.material],"invalid primitive material");
    const pos=model.accessors[primitive.attributes.POSITION];
    const normal=model.accessors[primitive.attributes.NORMAL];
    const index=model.accessors[primitive.indices];
    assert.equal(pos.count,normal.count,"Normals must cover every vertex");
    assert.equal(index.count%3,0,"Triangles must have three indices");
    const view=model.bufferViews[index.bufferView];
    for(let i=0;i<index.count;i++){
      const at=view.byteOffset+i*(index.componentType===5125?4:2);
      const value=index.componentType===5125?data.readUInt32LE(at):data.readUInt16LE(at);
      assert.ok(value<pos.count,`Invalid index in ${name}`);
    }
    triangles+=index.count/3;
  }
}
assert.ok(triangles>7000 && triangles<30000,"Unexpected triangle budget");
assert.ok(html.includes('"three/addons/"'),"Missing addon import map");
assert.ok(html.includes('"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"'),
  "Three.js versions must match");
assert.ok(script.includes('import("three/addons/loaders/GLTFLoader.js")'),"Missing model loader");
assert.ok(script.includes("villageFallbacks[i].visible=false"),"Fallback swap missing");
new Function(script); // Syntax check without executing the browser application
const ids=new Set([...html.matchAll(/\\bid=["']([^"']+)["']/g)].map(match=>match[1]));
const missing=[...new Set([...script.matchAll(/\\$\\("([^"]+)"\\)/g)].map(match=>match[1]))]
  .filter(id=>!ids.has(id));
assert.deepEqual(missing,[],"Missing game UI elements");
console.log(`✓ glTF 2.0: ${names.length} original building models; ${Math.round(triangles).toLocaleString()} triangles`);
console.log(`✓ Embedded binary: ${data.length.toLocaleString()} bytes; aligned accessors and valid indices`);
console.log("✓ Import map, loader, fallbacks, JavaScript syntax, and UI references");
