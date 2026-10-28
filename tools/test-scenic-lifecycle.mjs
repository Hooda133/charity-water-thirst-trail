#!/usr/bin/env node
// Exercising the real GLB integration module with deferred fake downloads.
// This catches leaks when changing chapters while a model is still loading,
// and verifies cloned models free each shared GPU resource only once.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const raw=readFileSync(new URL("../scenic-assets.js",import.meta.url),"utf8");
const importCode='import("three/addons/loaders/GLTFLoader.js")';
assert.ok(raw.includes(importCode),"expected loader dependency in scenic-assets.js");
const source=raw.replace(importCode,"Promise.resolve({GLTFLoader:FakeGLTFLoader})");
new Function(source);

const pending=[],assets=[],requests=[];
class Resource {
  constructor(kind){this.kind=kind;this.disposals=0;}
  dispose(){this.disposals++;}
}
class FakeMesh {
  constructor(resources){this.isMesh=true;this.geometry=resources.geometry;this.material=resources.material;this.userData={};}
  traverse(fn){fn(this);}
}
class FakeGroup {
  constructor(){this.children=[];this.userData={};this.scale={setScalar(){}};this.rotation={y:0};this.position={set(){}};}
  add(child){child.parent=this;this.children.push(child);}
  removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
  clear(){this.children=[];}
  traverse(fn){fn(this);for(const child of this.children)child.traverse(fn);}
  clone(){const copy=new FakeGroup();copy.name=this.name;for(const child of this.children){
    if(child.isMesh)copy.add(new FakeMesh({geometry:child.geometry,material:child.material}));
  }return copy;}
}
class FakeVector3 {
  constructor(){this.x=0;this.y=0;this.z=0;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class FakeBox3 {
  constructor(){this.min={y:0};}
  setFromObject(){return this;}
  getSize(target){return target.set(2,2,2);}
  getCenter(target){return target.set(0,0,0);}
}
class FakeGLTFLoader {
  loadAsync(url){
    requests.push(url);
    const resources={
      geometry:new Resource("geometry"),
      texture:Object.assign(new Resource("texture"),{isTexture:true})
    };
    resources.material=Object.assign(new Resource("material"),{map:resources.texture});
    const scene=new FakeGroup();scene.add(new FakeMesh(resources));
    assets.push({url,resources});
    return new Promise(resolve=>pending.push(()=>resolve({scene})));
  }
}
const window={};
const THREE={Group:FakeGroup,Box3:FakeBox3,Vector3:FakeVector3};
runInNewContext(source,{window,FakeGLTFLoader,Promise,Map,Set,console});
const api=window.TrailScenicAssets,host=new FakeGroup();
const options={parent:host,chapter:"valley",wx:x=>x/40,wz:y=>y/40,
  getGraphics:()=>({preset:"low"})};
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};

// A fast navigation away happens before the dynamic loader import resolves.
const early=api.mount(THREE,options);
early.dispose();
await flush();
assert.equal(requests.length,0,"disposed chapter must not start a new GLB fetch after loader initialization");
assert.equal(api.status().length,0);

// A navigation away can also happen while the local GLB response is pending.
const deferred=api.mount(THREE,options);
await flush();
assert.ok(pending.length>=2,"low graphics requests multiple distinct decorations");
const oldCount=pending.length;
deferred.dispose();
const remoteBefore=requests.length;
for(const resolve of pending.splice(0))resolve();
await flush();
assert.equal(requests.length,remoteBefore,"pending loads must never start remote fallbacks after disposal");
assert.equal(api.status().length,0);
assert.equal(host.children.length,0);
for(const asset of assets.slice(0,oldCount)){
  const {geometry,material,texture}=asset.resources;
  assert.equal(geometry.disposals,1,"late geometry must be disposed");
  assert.equal(material.disposals,1,"late material must be disposed");
  assert.equal(texture.disposals,1,"late texture must be disposed");
}

// A successful active chapter shares assets between duplicate decorative rows,
// then disposes all source meshes and their display clones once.
const base=assets.length;
const active=api.mount(THREE,{...options,getGraphics:()=>({preset:"ultra"})});
await flush();
const allRequests=pending.length;
assert.ok(allRequests>=8,"ultra quality should request multiple distinct models");
for(const resolve of pending.splice(0))resolve();
await flush();
assert.ok(active.status().loaded>=9,"all ultra decorations should mount");
const loadedSources=assets.slice(base);
assert.equal(loadedSources.length,new Set(loadedSources.map(x=>x.url)).size,
  "duplicate tree placements share one decoded source per chapter");
active.dispose();
await flush();
assert.equal(host.children.length,0,"removing chapter removes the 3D root");
assert.equal(api.status().length,0,"no active mount leaks across replay");
for(const asset of loadedSources)for(const key of ["geometry","material","texture"]){
  assert.equal(asset.resources[key].disposals,1,
    "shared "+key+" must be freed exactly once after scene disposal");
}
assert.equal(new Set(requests).size,allRequests+oldCount,
  "each independently mounted chapter fetches only its own unique decorations");
console.log("PASS: no late requests after disposal, no leaked GLB resources, clean active mounts and exactly-once shared asset cleanup");
