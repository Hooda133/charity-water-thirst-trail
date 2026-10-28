#!/usr/bin/env node
// Safety checks for the optional, license-aware 3D environment upgrades.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";

const root=resolve(import.meta.dirname,"..");
const read=name=>readFileSync(resolve(root,name),"utf8");
const scenic=read("scenic-assets.js");
new Function(scenic);
const browser={};
runInNewContext(scenic,{window:browser,console,Set,Map,Promise});
const api=browser.TrailScenicAssets;
assert.ok(api,"shared scenic loader exists");
const chapters=["valley","canyon","coast","village"];
const known=new Map([
  ["kenney","Hidencod/tge-assets"],
  ["quaternius","anshaneja5/skyline-run"]
]);
let total=0;
for(const chapter of chapters){
  const placements=api.placements(chapter);
  assert.ok(placements.length>=8,chapter+" should have substantial new art");
  assert.equal(api.mount({}, {chapter,parent:null}),null,"invalid renderer should fail safely");
  for(const asset of placements){
    assert.ok(/^(kenney|quaternius)\/[a-z0-9-]+\/[a-z0-9-]+\.glb$/.test(asset.asset),
      "asset must be an explicitly curated glb: "+asset.asset);
    assert.ok(["low","medium","high","ultra"].includes(asset.minQuality));
    assert.ok(Number.isFinite(asset.x)&&Number.isFinite(asset.y));
    assert.ok(known.has(asset.asset.split("/")[0]));
    assert.ok(asset.asset.split("/").every(part=>part!==".."));
    total++;
  }
}
assert.ok(total>=35,"all four scenes need a meaningful visual pass");
assert.equal(api.placements("nonexistent").length,0);
assert.ok(scenic.includes("assets/upgraded_graphics/"));
assert.match(scenic,/gltfLoader\.loadAsync\(remote\(key\)\)/,"pinned remote fallback");
assert.match(scenic,/model\.traverse\(/);
assert.match(scenic,/obj\.userData\.cameraOccluder=false/);
assert.match(scenic,/quality>=row\.min/);
assert.match(scenic,/if\(disposed\) return/);
const index=read("index.html");
assert.ok(index.indexOf('src="scenic-assets.js"')>=0);
for(const name of ["village-life.js","script.js","canyon.js","coast.js"]){
  const at=index.indexOf('src="'+name+'"');
  assert.ok(at>index.indexOf('src="scenic-assets.js"'),name+" must load after shared art module");
  const src=read(name);new Function(src);
  assert.match(src,/TrailScenicAssets\?\.mount/,"missing integration in "+name);
  assert.match(src,/(?:valleyScenery|communityScenery|canyonScenery|coastScenery)\?\.dispose/,
    "missing lifecycle cleanup in "+name);
}
const importer=read("tools/import_cc0_assets.py");
for(const item of chapters.flatMap(api.placements)){
  assert.ok(importer.includes('"'+item.asset.split("/").at(-1)+'"'),
    "model not listed in automatic vendor importer: "+item.asset);
}
assert.ok(!scenic.includes("localStorage.setItem"),"art system must not alter saves");
assert.ok(!scenic.includes("blocked("),"art must not alter collision rules");
assert.equal(api.status().length,0,"no scene mount should leak during module initialization");
console.log("PASS: "+total+" licensed model placements across all 4 worlds; lazy GLB loading, quality and cleanup wired");
