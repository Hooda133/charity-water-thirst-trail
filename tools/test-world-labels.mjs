#!/usr/bin/env node
// Verify projected mission labels with a light DOM/Three.js mock.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
const root=resolve(import.meta.dirname,".."),read=p=>readFileSync(resolve(root,p),"utf8");
const src=read("world-labels.js");
new Function(src);
for(const path of ["script.js","canyon.js","coast.js"]){
 const code=read(path);new Function(code);
 assert.match(code,/TrailWorldLabels\?\.create/,path+" must create mission overlay");
 assert.match(code,/missionLabels\?\.update/,path+" must update projection");
 assert.match(code,/missionLabels\?\.dispose/,path+" must clean up overlay");
}
assert.match(read("index.html"),/src="world-labels\.js"/);
assert.match(read("canyon.js"),/getGraphics:\(\)=>graphics/);
assert.match(read("coast.js"),/getGraphics:\(\)=>graphics/);
class Vector3{
 constructor(x=0,y=0,z=0){this.set(x,y,z)}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
 distanceToSquared(p){return (this.x-p.x)**2+(this.y-p.y)**2+(this.z-p.z)**2}
 project(){this.x/=20;this.y/=20;this.z=0;return this}
}
function element(){
 const classes=new Set();
 return {style:{},dataset:{},hidden:false,children:[],offsetWidth:105,offsetHeight:26,
 classList:{toggle(k,on){on?classes.add(k):classes.delete(k)},contains(k){return classes.has(k)}},
 append(child){this.children.push(child);child.parentElement=this},
 remove(){this.removed=true},setAttribute(k,v){this[k]=v},
 getBoundingClientRect(){return {left:40,top:20}},clientLeft:0,clientTop:0};
}
const host=element(),canvas=element(),w={TrailTypography:{ready:Promise.resolve()}};
let canvasLeft=40,canvasTop=20;
canvas.getBoundingClientRect=()=>({left:canvasLeft,top:canvasTop});
canvas.isConnected=true;canvas.clientWidth=800;canvas.clientHeight=500;canvas.parentElement=host;
runInNewContext(src,{window:w,document:{createElement:element},Promise,Set,console});
const anchors=[-8,0,8].map(x=>({updateWorldMatrix(){},localToWorld(p){p.x+=x;return p}}));
const overlay=w.TrailWorldLabels.create({Vector3},{
 camera:{updateMatrixWorld(){},getWorldPosition(p){p.set(0,0,10)}},
 canvas,labels:anchors.map((anchor,i)=>({id:"goal"+i,title:"Mission "+i,anchor}))
});
overlay.update({completed:new Set(["goal0"]),activeKey:"goal1"});
assert.equal(overlay.status().visible,3,"projected markers should appear");
assert.equal(host.children.length,1,"overlay should attach beside canvas");
// An expanding sidebar can shift the canvas without changing its dimensions.
// Projected labels must follow its new offset on the very next update.
canvasLeft=73;canvasTop=51;overlay.update();
assert.equal(host.children[0].style.left,"33px","follow horizontal canvas layout shifts");
assert.equal(host.children[0].style.top,"31px","follow vertical canvas layout shifts");
const [first,second]=host.children[0].children;
assert.ok(first.classList.contains("is-complete"));
assert.ok(second.classList.contains("is-active"));
canvas.clientWidth=480;overlay.update({activeKey:"goal2"});
assert.ok(overlay.status().visible>0,"narrow layout displays missions");
overlay.update({visible:false});
assert.equal(overlay.status().visible,0);
assert.equal(host.children[0].hidden,true);
overlay.dispose();assert.ok(host.children[0].removed,"cleanup removes overlay");
console.log("Projected labels, 3 chapters, responsive layout and lifecycle: PASS");
