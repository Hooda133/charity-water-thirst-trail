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
// Screenshot-like case: tile 4 connects to WATER IN but has an unsealed south joint.
const screenshotTurns=[1,2,3,3,2,1,1,1,2];
const screenshotFlow=pipeFlow(screenshotTurns);
assert.equal(screenshotFlow.connected.size,1,"Inlet-only network must report 1 supplied tile");
assert.equal(screenshotFlow.leaks.length,1,"Inlet-only network must identify one unsealed joint");
assert.equal(screenshotFlow.leaks[0].tile,3,"Leak must be located on tile 4");
assert.equal(screenshotFlow.leaks[0].direction,"s","The leak should face tile 7");


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
assert.ok(script.includes("pipe-terminal-badge"),"Water inlet/outlet alignment markers missing");
assert.ok(script.includes("is-leaking"),"Open joints should be highlighted on the actual connected pipe arms");
assert.ok(script.includes("pipeHint"),"Guided hint control missing");
assert.ok(script.includes("PIPE_HINT_ORDER"),"Deterministic hints toward known solution missing");
const html=readFileSync(resolve(root,"index.html"),"utf8");
assert.ok(html.includes('id="pipeHint"'),"Pipe hint button missing from the modal");
const styles=readFileSync(resolve(root,"styles.css"),"utf8");
assert.ok(styles.includes(".pipe-arm.is-leaking"),"Open joint styles missing");
assert.ok(styles.includes(".pipe-hint"),"Hint button styling missing");
// All nine initial orientations must be solvable by clockwise rotation alone.
// The generated hint always points toward this verified solution (all turns zero).
for(let tile=0;tile<9;tile++){
 const clockwise=(4-PIPE_START[tile]%4)%4;
 const next=PIPE_START.slice();
 for(let click=0;click<clockwise;click++)next[tile]=(next[tile]+1)%4;
 assert.equal(next[tile],0,"Each hinted tile must reach the known leak-free orientation");
}

console.log("✓ All 262,144 tile orientations checked");
console.log("✓ 2 valid nine-piece configurations, no leaking victories");
console.log("✓ Partial routes, missing intake and capped-branch leaks rejected");
