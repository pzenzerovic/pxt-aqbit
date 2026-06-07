// Rule variant analysis: tests proposed isCutReadable changes against known bad/ok seeds.

// ── Solid (inline) ──────────────────────────────────────────────────────────
class Solid {
  constructor() { this.cells = new Set(); this.w = this.d = this.h = 0; }
  static key(x,y,z) { return x+","+y+","+z; }
  add(x,y,z)    { this.cells.add(Solid.key(x,y,z)); }
  remove(x,y,z) { this.cells.delete(Solid.key(x,y,z)); }
  has(x,y,z)    { return this.cells.has(Solid.key(x,y,z)); }
  get size()    { return this.cells.size; }
  forEach(fn)   { for (const k of this.cells) { const [x,y,z]=k.split(",").map(Number); fn(x,y,z); } }
  static box(w,d,h) {
    const s = new Solid();
    for (let x=0;x<w;x++) for (let y=0;y<d;y++) for (let z=0;z<h;z++) s.add(x,y,z);
    s.w=w; s.d=d; s.h=h; return s;
  }
  normalize() {
    if (!this.cells.size) { this.w=this.d=this.h=0; return this; }
    let mnX=Infinity,mnY=Infinity,mnZ=Infinity,mxX=-Infinity,mxY=-Infinity,mxZ=-Infinity;
    this.forEach((x,y,z)=>{if(x<mnX)mnX=x;if(y<mnY)mnY=y;if(z<mnZ)mnZ=z;if(x>mxX)mxX=x;if(y>mxY)mxY=y;if(z>mxZ)mxZ=z;});
    const s2=new Set(); this.forEach((x,y,z)=>s2.add(Solid.key(x-mnX,y-mnY,z-mnZ)));
    this.cells=s2; this.w=mxX-mnX+1; this.d=mxY-mnY+1; this.h=mxZ-mnZ+1; return this;
  }
  isConnected() {
    if (!this.cells.size) return false;
    const start=this.cells.values().next().value; const seen=new Set([start]); const stack=[start];
    const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    while (stack.length) { const [x,y,z]=stack.pop().split(",").map(Number);
      for (const [dx,dy,dz] of dirs) { const k=Solid.key(x+dx,y+dy,z+dz); if(this.cells.has(k)&&!seen.has(k)){seen.add(k);stack.push(k);} } }
    return seen.size===this.cells.size;
  }
}

// ── Generator (inline) ──────────────────────────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return function() {
    a|=0; a=(a+0x6d2b79f5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function randInt(rng,lo,hi) { return lo+Math.floor(rng()*(hi-lo+1)); }
function carveCorner(solid,w,d,h,rng,maxExtent) {
  let fromMaxX,fromMaxY,fromMaxZ;
  for (let t=0;t<6;t++) {
    fromMaxX=rng()<0.5; fromMaxY=rng()<0.5; fromMaxZ=rng()<0.5;
    if (fromMaxX||fromMaxY) break;
  }
  const rx=randInt(rng,1,Math.min(maxExtent,w-1));
  const ry=randInt(rng,1,Math.min(maxExtent,d-1));
  const rz=randInt(rng,1,Math.min(maxExtent,h-1));
  const x0=fromMaxX?w-rx:0, y0=fromMaxY?d-ry:0, z0=fromMaxZ?h-rz:0;
  for (let x=x0;x<x0+rx;x++) for (let y=y0;y<y0+ry;y++) for (let z=z0;z<z0+rz;z++) solid.remove(x,y,z);
}
function fillHidden(solid) {
  const {w,d,h}=solid; const toFill=[];
  for (let x=0;x<w;x++) for (let y=0;y<d;y++) for (let z=0;z<h;z++) {
    if (solid.has(x,y,z)) continue;
    let ex=true; for (let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){ex=false;break;}
    let ey=true; for (let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){ey=false;break;}
    let ez=true; for (let zz=z+1;zz<h;zz++) if(solid.has(x,y,zz)){ez=false;break;}
    if (!ex&&!ey&&!ez) toFill.push([x,y,z]);
  }
  for (const [x,y,z] of toFill) solid.add(x,y,z);
}
function buildSolid({w,d,h,carves,seed}) {
  const rng=makeRng(seed);
  const maxE=Math.max(1,Math.ceil(Math.min(w,d,h)/2));
  for (let attempt=0;attempt<20;attempt++) {
    const solid=Solid.box(w,d,h);
    for (let i=0;i<carves;i++) carveCorner(solid,w,d,h,rng,maxE);
    solid.normalize(); fillHidden(solid);
    if (solid.size>0&&solid.isConnected()) return solid;
  }
  return Solid.box(w,d,h);
}

// ── Rule evaluation helpers ──────────────────────────────────────────────────
function getMissing(solid) {
  const {w,d,h}=solid; const missing=[];
  for (let x=0;x<w;x++) for (let y=0;y<d;y++) for (let z=0;z<h;z++)
    if (!solid.has(x,y,z)) missing.push([x,y,z]);
  return missing;
}

function getExposure(solid, x, y, z) {
  const {w,d,h}=solid;
  let px=true,py=true,pz=true;
  for (let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){px=false;break;}
  for (let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){py=false;break;}
  for (let zz=z+1;zz<h;zz++) if(solid.has(x,y,zz)){pz=false;break;}
  return {px,py,pz};
}

function missingConnected(missing) {
  if (missing.length === 0) return true;
  const missingSet = new Set(missing.map(([x,y,z])=>x+","+y+","+z));
  const seen = new Set([missing[0].join(",")]);
  const stack = [missing[0]];
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  while (stack.length) {
    const [x,y,z]=stack.pop();
    for (const [dx,dy,dz] of dirs) {
      const k=(x+dx)+","+(y+dy)+","+(z+dz);
      if (missingSet.has(k)&&!seen.has(k)){seen.add(k);stack.push([x+dx,y+dy,z+dz]);}
    }
  }
  return seen.size===missing.length;
}

// Current rules
function isCutReadable_current(solid) {
  const {w,d,h}=solid;
  const missing=getMissing(solid);
  if (missing.length===0) return {pass:true};

  const fails=[];

  // Rule A: at least one missing voxel with pz AND (px OR py)
  const rA=missing.some(([x,y,z])=>{
    const {px,py,pz}=getExposure(solid,x,y,z);
    return pz&&(px||py);
  });
  if (!rA) fails.push('A');

  // Rule C: both lateral faces represented
  let anyPx=false,anyPy=false;
  for (const [x,y,z] of missing) {
    const {px,py}=getExposure(solid,x,y,z);
    if (px) anyPx=true;
    if (py) anyPy=true;
    if (anyPx&&anyPy) break;
  }
  if (!anyPx||!anyPy) fails.push('C');

  // Rule B: connected missing region
  if (!missingConnected(missing)) fails.push('B');

  return {pass:fails.length===0, fails};
}

// NEW rules variant
function isCutReadable_new(solid) {
  const {w,d,h}=solid;
  const missing=getMissing(solid);
  if (missing.length===0) return {pass:true};

  const fails=[];
  const totalVol=w*d*h;

  // New Rule D: complexity — missing > 50% of bounding volume
  if (missing.length > totalVol*0.5) fails.push('D');

  // New Rule A: at least one missing voxel visible from 2+ directions (any combo)
  const rA=missing.some(([x,y,z])=>{
    const {px,py,pz}=getExposure(solid,x,y,z);
    const n=(px?1:0)+(py?1:0)+(pz?1:0);
    return n>=2;
  });
  if (!rA) fails.push('A');

  // New Rule C: at least ONE lateral face represented (anyPx OR anyPy)
  let anyPx=false,anyPy=false;
  for (const [x,y,z] of missing) {
    const {px,py}=getExposure(solid,x,y,z);
    if (px) anyPx=true;
    if (py) anyPy=true;
    if (anyPx&&anyPy) break;
  }
  if (!anyPx&&!anyPy) fails.push('C');

  // Rule B: REMOVED — disconnected cuts accepted

  return {pass:fails.length===0, fails};
}

// ── Test data ────────────────────────────────────────────────────────────────
const ORIG_BAD = [
  {seed:781714169,w:3,d:3,h:3,carves:2},
  {seed:781714166,w:3,d:3,h:3,carves:2},
  {seed:781714164,w:3,d:3,h:3,carves:2},
  {seed:781714162,w:3,d:3,h:3,carves:2},
  {seed:781714160,w:3,d:3,h:3,carves:2},
  {seed:327254525,w:3,d:3,h:3,carves:2},
  {seed:327254524,w:3,d:3,h:3,carves:2},
  {seed:327254523,w:3,d:3,h:3,carves:2},
  {seed:327254519,w:3,d:3,h:3,carves:2},
  {seed:327254518,w:3,d:3,h:3,carves:2},
  {seed:327254517,w:3,d:3,h:3,carves:2},
  {seed:327254513,w:3,d:3,h:3,carves:2},
  {seed:327254512,w:3,d:3,h:3,carves:2},
  {seed:327254510,w:3,d:3,h:3,carves:2},
  {seed:327254508,w:3,d:3,h:3,carves:2},
  {seed:327254507,w:3,d:3,h:3,carves:2},
  {seed:327254504,w:3,d:3,h:3,carves:2},
  {seed:327254496,w:3,d:3,h:3,carves:2},
  {seed:327254495,w:3,d:3,h:3,carves:2},
  {seed:327254494,w:3,d:3,h:3,carves:2},
  {seed:327254493,w:3,d:3,h:3,carves:2},
  {seed:327254489,w:3,d:3,h:3,carves:2},
  {seed:327254488,w:3,d:3,h:3,carves:2},
  {seed:327254486,w:3,d:3,h:3,carves:2},
  {seed:327254484,w:3,d:3,h:3,carves:2},
  {seed:327254481,w:3,d:3,h:3,carves:2},
];

// From new batch: these filter PASSES but user said BAD (false positives)
const NEW_FP = [
  {seed:465358741,w:3,d:3,h:3,carves:2},
  {seed:465358722,w:3,d:3,h:3,carves:2},
  {seed:465358699,w:3,d:3,h:3,carves:2},
];

// From new batch: these filter FAILS but user said OK (false negatives)
const NEW_FN = [
  {seed:465358752,w:3,d:3,h:3,carves:2},
  {seed:465358747,w:3,d:3,h:3,carves:2},
  {seed:465358739,w:3,d:3,h:3,carves:2},
  {seed:465358732,w:3,d:3,h:3,carves:2},
  {seed:465358728,w:3,d:3,h:3,carves:2},
  {seed:465358725,w:3,d:3,h:3,carves:2},
  {seed:465358723,w:3,d:3,h:3,carves:2},
  {seed:465358720,w:3,d:3,h:3,carves:2},
  {seed:465358714,w:3,d:3,h:3,carves:2},
  {seed:465358711,w:3,d:3,h:3,carves:2},
  {seed:465358710,w:3,d:3,h:3,carves:2},
  {seed:465358709,w:3,d:3,h:3,carves:2},
];

function printLayers(solid) {
  const {w,d,h}=solid;
  for (let z=h-1;z>=0;z--) {
    let row=`  z=${z}: `;
    for (let y=0;y<d;y++) {
      for (let x=0;x<w;x++) row+=(solid.has(x,y,z)?'█':'·');
      if (y<d-1) row+=' ';
    }
    console.log(row);
  }
}

// ── Run analysis ─────────────────────────────────────────────────────────────
console.log("=== ORIGINAL 26 BAD SEEDS: current vs new rules ===\n");
let origBadCurrentFails=0, origBadNewPasses=0;
for (const p of ORIG_BAD) {
  const solid=buildSolid(p);
  const cur=isCutReadable_current(solid);
  const nw=isCutReadable_new(solid);
  const missing=getMissing(solid);
  const totalVol=solid.w*solid.d*solid.h;
  origBadCurrentFails += cur.pass ? 0 : 1;
  if (!cur.pass && nw.pass) {
    origBadNewPasses++;
    console.log(`REINTRODUCED seed:${p.seed}  ${solid.w}×${solid.d}×${solid.h}  missing:${missing.length}/${totalVol}`);
    console.log(`  cur_fails:[${cur.fails}]  new_fails:[${nw.fails}]`);
    printLayers(solid);
  }
}
console.log(`\nOriginal bad: ${origBadCurrentFails}/26 filtered by current rules`);
console.log(`Re-introduced by new rules: ${origBadNewPasses}`);

console.log("\n=== NEW BATCH FALSE POSITIVES (user BAD, filter PASS): new rules ===\n");
let fpFixed=0;
for (const p of NEW_FP) {
  const solid=buildSolid(p);
  const cur=isCutReadable_current(solid);
  const nw=isCutReadable_new(solid);
  const missing=getMissing(solid);
  const totalVol=solid.w*solid.d*solid.h;
  if (!nw.pass) fpFixed++;
  console.log(`seed:${p.seed}  missing:${missing.length}/${totalVol}  cur:${cur.pass?'PASS':'FAIL'}  new:${nw.pass?'PASS':'FAIL'}  new_fails:[${nw.fails}]`);
}
console.log(`\nFalse positives fixed by new rules: ${fpFixed}/3`);

console.log("\n=== NEW BATCH FALSE NEGATIVES (user OK, filter FAIL): new rules ===\n");
let fnFixed=0;
for (const p of NEW_FN) {
  const solid=buildSolid(p);
  const cur=isCutReadable_current(solid);
  const nw=isCutReadable_new(solid);
  const missing=getMissing(solid);
  const totalVol=solid.w*solid.d*solid.h;
  if (nw.pass) fnFixed++;
  console.log(`seed:${p.seed}  missing:${missing.length}/${totalVol}  cur_fails:[${cur.fails}]  new:${nw.pass?'PASS':'FAIL'}  new_fails:[${nw.fails}]`);
}
console.log(`\nFalse negatives fixed by new rules: ${fnFixed}/12`);

// Show details of any still-failing false negatives
console.log("\n=== DETAILS: still-failing false negatives ===\n");
for (const p of NEW_FN) {
  const solid=buildSolid(p);
  const nw=isCutReadable_new(solid);
  if (!nw.pass) {
    const missing=getMissing(solid);
    console.log(`seed:${p.seed} fails:[${nw.fails}] missing:${missing.length}`);
    for (const [x,y,z] of missing) {
      const {px,py,pz}=getExposure(solid,x,y,z);
      const dirs=(px?1:0)+(py?1:0)+(pz?1:0);
      console.log(`  (${x},${y},${z}) px:${px?1:0} py:${py?1:0} pz:${pz?1:0} dirs:${dirs}`);
    }
    printLayers(solid);
  }
}

// Show details of original bad seeds re-introduced (if any)
console.log("\n=== DETAILS: original bad seeds re-introduced by new rules ===\n");
for (const p of ORIG_BAD) {
  const solid=buildSolid(p);
  const cur=isCutReadable_current(solid);
  const nw=isCutReadable_new(solid);
  if (!cur.pass && nw.pass) {
    const missing=getMissing(solid);
    console.log(`seed:${p.seed} missing:${missing.length}`);
    for (const [x,y,z] of missing) {
      const {px,py,pz}=getExposure(solid,x,y,z);
      console.log(`  (${x},${y},${z}) px:${px?1:0} py:${py?1:0} pz:${pz?1:0}`);
    }
    printLayers(solid);
  }
}
