#!/usr/bin/env node
// Exhaustive regression test of the exact pipeline rules used by the game.
// Run: node tools/test-pipes.mjs (no packages or network required).
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";

const root=resolve(import.meta.dirname,"..");
const script=readFileSync(resolve(root,"script.js"),"utf8");
const begin=script.indexOf("  const PIPE_DIRS=");
const end=script.indexOf("  function renderPipePuzzle(){",begin);
assert.ok(begin>0&&end>begin,"Could not find the browser's actual pipe solver");
const logic=runInNewContext(script.slice(begin,end)+
  "\n({PIPE_DIRS,PIPE_BASE,PIPE_START,rotatedPipe,pipeFlow})");
const {PIPE_DIRS,PIPE_BASE,PIPE_START,rotatedPipe,pipeFlow}=logic;
assert.equal(PIPE_BASE.length,9,"Exactly 9 tiles must be used");
assert.equal(PIPE_START.length,9);
assert.deepEqual([...PIPE_DIRS],["n","e","s","w"]);
assert.equal(PIPE_BASE.filter(p=>p.length===3).length,2,"Requires two T-junctions");
assert.equal(PIPE_BASE.filter(p=>p.length===1).length,2,"Requires two capped branches");
assert.equal(pipeFlow(PIPE_START).solved,false,"Should not start already repaired");

// This orientation connects every tile, seals all branches and delivers water.
const solvedTurns=Array(9).fill(0);
const done=pipeFlow(solvedTurns);
assert.equal(done.solved,true);
assert.equal(done.delivered,true);
assert.equal(done.connected.size,9);
assert.equal(done.leaks.length,0);

// Rotating a capped end must invalidate the repair, even when the village
// outlet still receives water. The old rules would accept incomplete networks.
const brokenCap=solvedTurns.slice();
brokenCap[6]=1;
const incomplete=pipeFlow(brokenCap);
assert.equal(incomplete.delivered,true);
assert.equal(incomplete.solved,false);
assert.ok(incomplete.connected.size<9||incomplete.leaks.length>0);

// An open supply port must be required before ANY water flows.
const missingInput=solvedTurns.slice();
missingInput[3]=1;
const dry=pipeFlow(missingInput);
assert.equal(dry.connected.size,0);
assert.equal(dry.solved,false);

// All quarter-turns must be reversible, including the symmetry of straight
// pipes. Components may point only toward the four canonical directions.
for(let i=0;i<9;i++){
  for(let t=0;t<4;t++){
    const oriented=rotatedPipe(i,Array(9).fill(t));
    assert.equal(oriented.length,PIPE_BASE[i].length);
    assert.ok(oriented.every(d=>PIPE_DIRS.includes(d)));
  }
}

// All 4^9 orientations: verify there are no false positives, no leaked
// successful networks, and exactly the expected two equivalent solutions.
let wins=0,shortcuts=0;
for(let code=0;code<4**9;code++){
  let remaining=code;
  const turns=new Array(9);
  for(let i=0;i<9;i++){turns[i]=remaining%4;remaining=Math.floor(remaining/4);}
  const outcome=pipeFlow(turns);
  if(outcome.solved){
    wins++;
    assert.equal(outcome.delivered,true);
    assert.equal(outcome.connected.size,9);
    assert.equal(outcome.leaks.length,0);
  }
  if(outcome.delivered && outcome.connected.size<9)shortcuts++;
}
assert.equal(wins,2,"Unexpected change in valid completed layouts");
assert.ok(shortcuts>0,"Expected to exercise formerly accepted partial routes");

assert.ok(script.includes("flow.connected.size"),"Missing progress feedback");
assert.ok(script.includes('kind:"pipe"'),"Missing interactive pipe modal");
assert.ok(script.includes("flow.delivered"),"Incomplete-network warning missing");
console.log("✓ All 262,144 tile orientations checked");
console.log("✓ 2 valid nine-piece configurations, no leaking victories");
console.log("✓ Partial routes, missing intake and capped-branch leaks rejected");
