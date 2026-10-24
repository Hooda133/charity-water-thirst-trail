#!/usr/bin/env node
// Validate the original, rig-ready Thirst Trail adventurer asset without dependencies.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const model=JSON.parse(readFileSync(resolve(root,"assets/characters/explorer.gltf"),"utf8"));
const script=readFileSync(resolve(root,"script.js"),"utf8");
const html=readFileSync(resolve(root,"index.html"),"utf8");
assert.equal(model.asset.version,"2.0");
assert.ok(model.buffers.length>=1,"Explorer needs at least one embedded geometry buffer");
const binaries=model.buffers.map((buffer,i)=>{
  assert.ok(buffer.uri?.startsWith("data:application/octet-stream;base64,"),
    `Non-embedded geometry buffer ${i}`);
  const bytes=Buffer.from(buffer.uri.split(",")[1],"base64");
  assert.equal(bytes.length,buffer.byteLength,`Buffer ${i} byte length mismatch`);
  return bytes;
});
const totalBytes=binaries.reduce((n,buffer)=>n+buffer.length,0);
assert.ok(totalBytes<2_000_000,"Character should remain portable on laptops");
const sizes={5123:2,5125:4,5126:4},dims={SCALAR:1,VEC3:3};
for(const [i,v] of model.bufferViews.entries()){
  assert.ok(binaries[v.buffer],`Missing binary buffer for view ${i}`);
  assert.equal((v.byteOffset||0)%4,0,`Unaligned buffer view ${i}`);
  assert.ok((v.byteOffset||0)+v.byteLength<=binaries[v.buffer].length,
    `Buffer view ${i} extends beyond its buffer`);
}
for(const [i,a] of model.accessors.entries()){
  const v=model.bufferViews[a.bufferView];
  const elementSize=sizes[a.componentType]*dims[a.type];
  assert.ok(v&&elementSize,`Bad accessor ${i}`);
  const stride=v.byteStride||elementSize;
  assert.ok((a.byteOffset||0)+(a.count-1)*stride+elementSize<=v.byteLength,
    `Accessor ${i} extends beyond view`);
  assert.equal((a.byteOffset||0)%sizes[a.componentType],0,
    `Accessor ${i} is misaligned`);
}
const required=[
  "ExplorerCharacter","ExplorerBody","ExplorerHead","ExplorerEyes","ExplorerScarfTail",
  "ExplorerArmLeft","ExplorerArmRight","ExplorerElbowLeft","ExplorerElbowRight",
  "ExplorerLegLeft","ExplorerLegRight","ExplorerKneeLeft","ExplorerKneeRight",
  "ExplorerPackFlap"
];
assert.equal(new Set(model.nodes.map(n=>n.name)).size,model.nodes.length,"Duplicated rig names");
const indexByName=new Map(model.nodes.map((n,i)=>[n.name,i]));
for(const name of required)assert.ok(indexByName.has(name),`Missing animated rig node: ${name}`);
const visited=new Set();
function visit(id){
  if(visited.has(id))return;
  assert.ok(model.nodes[id],`Invalid node index ${id}`);
  visited.add(id);for(const child of model.nodes[id].children||[])visit(child);
}
assert.equal(model.scenes[0].nodes.length,1);
assert.equal(model.nodes[model.scenes[0].nodes[0]].name,"ExplorerCharacter");
visit(model.scenes[0].nodes[0]);
assert.equal(visited.size,model.nodes.length,"Unreachable rig node");
for(const joint of ["ExplorerArmLeft","ExplorerArmRight","ExplorerLegLeft","ExplorerLegRight"]){
  const id=indexByName.get(joint),node=model.nodes[id];
  assert.ok(node.translation && node.translation.length===3,`No pivot for ${joint}`);
}
let triangles=0,meshGroups=0;
for(const [mi,mesh] of model.meshes.entries()){
  for(const primitive of mesh.primitives){
    assert.equal(primitive.mode,4);
    assert.ok(model.materials[primitive.material],`Mesh ${mi} has invalid material`);
    const p=model.accessors[primitive.attributes.POSITION];
    const n=model.accessors[primitive.attributes.NORMAL];
    const ix=model.accessors[primitive.indices];
    assert.ok(p&&n&&ix,`Mesh ${mi} references missing attribute`);
    assert.equal(p.count,n.count,`Mesh ${mi} missing normals`);
    assert.equal(ix.count%3,0);
    const v=model.bufferViews[ix.bufferView],stride=sizes[ix.componentType];
    const binary=binaries[v.buffer];
    for(let i=0;i<ix.count;i++){
      const at=(v.byteOffset||0)+(ix.byteOffset||0)+i*(v.byteStride||stride);
      const index=stride===2?binary.readUInt16LE(at):binary.readUInt32LE(at);
      assert.ok(index<p.count,`Mesh ${mi} invalid vertex index`);
    }
    triangles+=ix.count/3;meshGroups++;
  }
}
assert.ok(triangles>4000&&triangles<16000,"Unexpected character polygon budget");
assert.ok(meshGroups>=20,"Expected distinct materials and accessory geometry");
assert.ok(script.includes('import("three/addons/loaders/GLTFLoader.js")'),"Missing model loader");
assert.ok(script.includes("characterRig={"),"Missing animated joint rig");
assert.ok(script.includes("body.visible=false"),"Missing fallback transition");
assert.ok(script.includes("rig.eyes.scale.y="),"Missing eye-blink animation");
assert.ok(html.includes('"three/addons/"'),"Missing pinned Three.js import map");
new Function(script);
console.log(`✓ Original glTF explorer: ${model.nodes.length} rig nodes, ${triangles.toLocaleString()} triangles`);
console.log(`✓ ${totalBytes.toLocaleString()} bytes across ${binaries.length} embedded buffers; joints and mesh indices checked`);
console.log("✓ Runtime loader, procedural fallback, animation wiring and JavaScript syntax");
