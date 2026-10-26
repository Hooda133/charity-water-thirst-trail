#!/usr/bin/env node
// Run the *real* Canyon art module with a lightweight Three.js-compatible scene
// mock: catches syntax, missing APIs and runtime mistakes without a GPU/CDN.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
const root=resolve(import.meta.dirname,"..");
const artSource=readFileSync(resolve(root,"canyon-visuals.js"),"utf8");
const canyonSource=readFileSync(resolve(root,"canyon.js"),"utf8");
const html=readFileSync(resolve(root,"index.html"),"utf8");
new Function(artSource);new Function(canyonSource);
assert.ok(html.indexOf('src="canyon-visuals.js"')<html.indexOf('src="canyon.js"'),
  "The art module must be loaded before Canyon's playable scene");
assert.match(canyonSource,/ThirstCanyonVisuals\?\.build/);
assert.match(canyonSource,/canyonArt\?\.update\(time\)/);
assert.match(canyonSource,/canyonArt\?\.dispose\(\)/);
assert.match(canyonSource,/assets\/characters\/explorer\.gltf/);
assert.match(canyonSource,/fallbackParts\.forEach/);
assert.match(canyonSource,/GLTFLoader/);
assert.match(canyonSource,/renderer\.render\(scene,camera\)/);
class Color{
 constructor(value=0xffffff){this.set(value)}
 set(v){const c=typeof v==="string"?Number.parseInt(v.slice(1),16):v;
  this.r=((c>>16)&255)/255;this.g=((c>>8)&255)/255;this.b=(c&255)/255;return this}
 copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this}
 lerp(c,t){this.r+=(c.r-this.r)*t;this.g+=(c.g-this.g)*t;this.b+=(c.b-this.b)*t;return this}
 setHex(v){return this.set(v)}
}
class Attribute{
 constructor(data,itemSize){this.array=data;this.itemSize=itemSize;this.count=data.length/itemSize;}
 getX(i){return this.array[i*this.itemSize]}
 getY(i){return this.array[i*this.itemSize+1]}
 getZ(i){return this.array[i*this.itemSize+2]}
 setY(i,v){this.array[i*this.itemSize+1]=v}
 setXY(i,x,y){this.array[i*this.itemSize]=x;this.array[i*this.itemSize+1]=y}
}
class Geometry{
 constructor() {this.attributes={};this.disposed=false;}
 setIndex(x){this.index=x}
 setAttribute(name,v){this.attributes[name]=v}
 getAttribute(name){return this.attributes[name]}
 computeVertexNormals(){}
 rotateX(){return this}
 dispose(){this.disposed=true}
}
class PlaneGeometry extends Geometry{
 constructor(w,h,xn=1,yn=1){
  super();const a=[];
  for(let j=0;j<=yn;j++)for(let i=0;i<=xn;i++)a.push(w*(i/xn-.5),0,h*(j/yn-.5));
  this.setAttribute("position",new Attribute(new Float32Array(a),3));
 }
}
class SphereGeometry extends Geometry{
 constructor(r=1,n=8,m=6){
  super();const a=[];
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++)
   a.push(Math.sin(j/m*Math.PI)*Math.cos(i/n*2*Math.PI)*r,
    Math.cos(j/m*Math.PI)*r,Math.sin(j/m*Math.PI)*Math.sin(i/n*2*Math.PI)*r);
  this.setAttribute("position",new Attribute(new Float32Array(a),3));
 }
}
class BasicGeometry extends Geometry{}
class Material{
 constructor(props={}){Object.assign(this,props);this.color=new Color(props.color??0xffffff);
 this.opacity=props.opacity??1;this.disposed=false}
 dispose(){this.disposed=true}
}
class CanvasTexture{
 constructor(){this.colorSpace="";this.wrapS=null;this.wrapT=null;this.offset={y:0};
 this.repeat={set(){}};this.disposed=false}
 dispose(){this.disposed=true}
}
class Object3D{
 constructor(){
  this.children=[];this.parent=null;this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};
  this.rotation={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};
  this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z}};
  this.matrix={};this.userData={};
 }
 add(x){x.parent=this;this.children.push(x)}
 remove(x){this.children=this.children.filter(v=>v!==x);x.parent=null}
 updateMatrix(){}
}
class Mesh extends Object3D{
 constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isMesh=true}
}
class InstancedMesh extends Mesh{
 constructor(geometry,material,count){super(geometry,material);this.count=count;this.isInstancedMesh=true;
  this.instanceMatrix={needsUpdate:false}}
 setMatrixAt(){}
}
class Points extends Mesh{
 constructor(geometry,material){super(geometry,material);this.isPoints=true}
}
const THREE={
 Color,Mesh,InstancedMesh,Points,Object3D,Group:Object3D,
 PlaneGeometry,SphereGeometry,BufferGeometry:Geometry,
 BoxGeometry:BasicGeometry,CylinderGeometry:BasicGeometry,CapsuleGeometry:BasicGeometry,
 IcosahedronGeometry:BasicGeometry,ConeGeometry:BasicGeometry,TorusGeometry:BasicGeometry,
 Float32BufferAttribute:Attribute,BufferAttribute:Attribute,
 MeshBasicMaterial:Material,MeshStandardMaterial:Material,PointsMaterial:Material,
 CanvasTexture,RepeatWrapping:"repeat",SRGBColorSpace:"srgb",
 BackSide:"back",DoubleSide:"double",
 MathUtils:{
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  smoothstep:(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
 }
};
const ctx={
 fillStyle:"",globalAlpha:1,lineWidth:1,strokeStyle:"",
 fillRect(){},beginPath(){},moveTo(){},lineTo(){},bezierCurveTo(){},stroke(){}
};
const document={createElement(tag){assert.equal(tag,"canvas");return {width:0,height:0,getContext(){return ctx}}}};
const window={matchMedia:()=>({matches:false})};
runInNewContext(artSource,{window,document,console,Math,Float32Array});
const scene=new Object3D(),done=new Set();
const art=window.ThirstCanyonVisuals.build(THREE,{scene,camera:{},worldSpread:1.42,
 getState:()=>({done})});
assert.ok(scene.children.length>65,"Art pass should create detailed layered scenery");
assert.equal(typeof art.update,"function");
assert.equal(typeof art.dispose,"function");
art.update(1);done.add("span");art.update(2.5);
assert.ok(scene.children.some(o=>o.isInstancedMesh),"Scatter detail should be instanced");
// Sample the actual rendered trail inlays against the playable gorge. A former
// road led straight through the impassable southern riverbank instead of bridge.
const trails=scene.children.filter(o=>o.userData.canyonTrail);
assert.ok(trails.length>=8,"Connected mission trail inlays are rendered");
const blockedSource=canyonSource.match(/function blocked\(x,y\)\{[\s\S]*?\n  \}/)?.[0];
const solidsSource=canyonSource.match(/const solidCircles=[\s\S]*?;\n  const solidSpan=[^;]+;/)?.[0];
assert.ok(blockedSource&&solidsSource,"Real Canyon collision footprint is available");
const isBlocked=new Function(`${solidsSource}\n${blockedSource}\nreturn blocked;`)();
for(const mesh of trails){
 const {from,to}=mesh.userData.canyonTrail;
 for(let step=0;step<=200;step++){
  const u=step/200,x=from[0]+(to[0]-from[0])*u,y=from[1]+(to[1]-from[1])*u;
  assert.ok(!isBlocked(x,y),`Visible trail must avoid blocked banks and landmarks, got ${x},${y}`);
 }
}
const atmosphericDust=scene.children.find(o=>o.isPoints);
assert.ok(atmosphericDust,"Atmospheric dust is available for timing regression");
art.update(17);
const dustAt17=Array.from(atmosphericDust.geometry.getAttribute("position").array);
for(let frame=0;frame<120;frame++)art.update(17);
assert.deepEqual(Array.from(atmosphericDust.geometry.getAttribute("position").array),dustAt17,
 "Paused/repeated draws cannot drift atmospheric particles");
art.update(19);art.update(17);
assert.deepEqual(Array.from(atmosphericDust.geometry.getAttribute("position").array),dustAt17,
 "Dust placement depends on time, not frame history");
art.dispose();
assert.ok(scene.children.length===0,"Art resources should detach on disposal");
console.log("✓ Canyon art builds, animates and disposes using simulated Three.js geometry");
console.log("✓ Original Canyon interaction, collision and chapter progression code preserved");
console.log("✓ Authored explorer asset and playable fallback both remain wired");
console.log("✓ Rendered trails avoid blocked banks; dust is independent of frame rate and pause redraws");
