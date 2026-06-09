// Final verification: test proposed new isCutReadable against all known seeds.

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
  const rx=randInt(rng,1,Math.min(maxExtent,w-1)); const ry=randInt(rng,1,Math.min(maxExtent,d-1)); const rz=randInt(rng,1,Math.min(maxExtent,h-1));
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
  const rng=makeRng(seed); const maxE=Math.max(1,Math.ceil(Math.min(w,d,h)/2));
  for (let attempt=0;attempt<20;attempt++) {
    const solid=Solid.box(w,d,h);
    for (let i=0;i<carves;i++) carveCorner(solid,w,d,h,rng,maxE);
    solid.normalize(); fillHidden(solid);
    if (solid.size>0&&solid.isConnected()) return solid;
  }
  return Solid.box(w,d,h);
}

// ── New isCutReadable ────────────────────────────────────────────────────────
function isCutReadable_new(solid) {
  const {w,d,h}=solid;
  const missing=[];
  for (let x=0;x<w;x++) for (let y=0;y<d;y++) for (let z=0;z<h;z++)
    if (!solid.has(x,y,z)) missing.push([x,y,z]);
  if (missing.length===0) return true;

  // Rule D: max 25% of bounding volume missing
  if (missing.length > w*d*h*0.25) return false;

  // Rule A (new): every connected component must have a voxel visible from 2+ directions
  const missingSet=new Set(missing.map(([x,y,z])=>x+","+y+","+z));
  const visited=new Set();
  const dirs6=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const [sx,sy,sz] of missing) {
    const key=sx+","+sy+","+sz;
    if (visited.has(key)) continue;
    const comp=[]; const stack=[[sx,sy,sz]]; visited.add(key);
    while (stack.length) {
      const [x,y,z]=stack.pop(); comp.push([x,y,z]);
      for (const [dx,dy,dz] of dirs6) {
        const k=(x+dx)+","+(y+dy)+","+(z+dz);
        if (missingSet.has(k)&&!visited.has(k)){visited.add(k);stack.push([x+dx,y+dy,z+dz]);}
      }
    }
    const readable=comp.some(([x,y,z])=>{
      let px=true,py=true,pz=true;
      for (let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){px=false;break;}
      for (let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){py=false;break;}
      for (let zz=z+1;zz<h;zz++) if(solid.has(x,y,zz)){pz=false;break;}
      return (px?1:0)+(py?1:0)+(pz?1:0)>=2;
    });
    if (!readable) return false;
  }

  // Rule C (relaxed): at least one lateral face (+x OR +y) represented
  let anyPx=false,anyPy=false;
  for (const [x,y,z] of missing) {
    if (!anyPx){let ok=true; for(let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){ok=false;break;} if(ok) anyPx=true;}
    if (!anyPy){let ok=true; for(let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){ok=false;break;} if(ok) anyPy=true;}
    if (anyPx&&anyPy) break;
  }
  if (!anyPx&&!anyPy) return false;

  return true;
}

// ── Test data ────────────────────────────────────────────────────────────────
const ORIG_BAD = [
  {seed:781714169,w:3,d:3,h:3,carves:2},{seed:781714166,w:3,d:3,h:3,carves:2},
  {seed:781714164,w:3,d:3,h:3,carves:2},{seed:781714162,w:3,d:3,h:3,carves:2},
  {seed:781714160,w:3,d:3,h:3,carves:2},{seed:327254525,w:3,d:3,h:3,carves:2},
  {seed:327254524,w:3,d:3,h:3,carves:2},{seed:327254523,w:3,d:3,h:3,carves:2},
  {seed:327254519,w:3,d:3,h:3,carves:2},{seed:327254518,w:3,d:3,h:3,carves:2},
  {seed:327254517,w:3,d:3,h:3,carves:2},{seed:327254513,w:3,d:3,h:3,carves:2},
  {seed:327254512,w:3,d:3,h:3,carves:2},{seed:327254510,w:3,d:3,h:3,carves:2},
  {seed:327254508,w:3,d:3,h:3,carves:2},{seed:327254507,w:3,d:3,h:3,carves:2},
  {seed:327254504,w:3,d:3,h:3,carves:2},{seed:327254496,w:3,d:3,h:3,carves:2},
  {seed:327254495,w:3,d:3,h:3,carves:2},{seed:327254494,w:3,d:3,h:3,carves:2},
  {seed:327254493,w:3,d:3,h:3,carves:2},{seed:327254489,w:3,d:3,h:3,carves:2},
  {seed:327254488,w:3,d:3,h:3,carves:2},{seed:327254486,w:3,d:3,h:3,carves:2},
  {seed:327254484,w:3,d:3,h:3,carves:2},{seed:327254481,w:3,d:3,h:3,carves:2},
];
const NEW_FP = [
  {seed:465358741,w:3,d:3,h:3,carves:2},
  {seed:465358722,w:3,d:3,h:3,carves:2},
  {seed:465358699,w:3,d:3,h:3,carves:2},
];
const NEW_FN = [
  {seed:465358752,w:3,d:3,h:3,carves:2},{seed:465358747,w:3,d:3,h:3,carves:2},
  {seed:465358739,w:3,d:3,h:3,carves:2},{seed:465358732,w:3,d:3,h:3,carves:2},
  {seed:465358728,w:3,d:3,h:3,carves:2},{seed:465358725,w:3,d:3,h:3,carves:2},
  {seed:465358723,w:3,d:3,h:3,carves:2},{seed:465358720,w:3,d:3,h:3,carves:2},
  {seed:465358714,w:3,d:3,h:3,carves:2},{seed:465358711,w:3,d:3,h:3,carves:2},
  {seed:465358710,w:3,d:3,h:3,carves:2},{seed:465358709,w:3,d:3,h:3,carves:2},
];

function getMissing(s){ const m=[]; for(let x=0;x<s.w;x++) for(let y=0;y<s.d;y++) for(let z=0;z<s.h;z++) if(!s.has(x,y,z)) m.push([x,y,z]); return m; }

console.log("=== ORIGINAL 26 BAD SEEDS (all should FAIL) ===\n");
let badPassed=0;
for (const p of ORIG_BAD) {
  const solid=buildSolid(p); const m=getMissing(solid);
  const r=isCutReadable_new(solid);
  if (r.pass!==false && r!==false) badPassed++;
  const pass=isCutReadable_new(solid);
  if (pass) { badPassed++; console.log(`PASS (should fail): seed:${p.seed}  missing:${m.length}/${solid.w*solid.d*solid.h}`); }
}
// Recount properly
badPassed=0;
for (const p of ORIG_BAD) {
  const solid=buildSolid(p);
  if (isCutReadable_new(solid)) { badPassed++; console.log(`RE-INTRODUCED: seed:${p.seed}  missing:${getMissing(solid).length}/${solid.w*solid.d*solid.h}`); }
}
console.log(`\nBad seeds passing new rules (re-introduced): ${badPassed}/26`);

console.log("\n=== NEW BATCH FALSE POSITIVES (should FAIL) ===\n");
let fpFiltered=0;
for (const p of NEW_FP) {
  const solid=buildSolid(p); const m=getMissing(solid);
  const pass=isCutReadable_new(solid);
  if (!pass) fpFiltered++;
  console.log(`seed:${p.seed} missing:${m.length}/${solid.w*solid.d*solid.h} → ${pass?'PASS (still FP!)':'FAIL (fixed!)'}`);
}
console.log(`\nFalse positives correctly filtered: ${fpFiltered}/3`);

console.log("\n=== NEW BATCH FALSE NEGATIVES (should PASS) ===\n");
let fnFixed=0;
for (const p of NEW_FN) {
  const solid=buildSolid(p); const m=getMissing(solid);
  const pass=isCutReadable_new(solid);
  if (pass) fnFixed++;
  console.log(`seed:${p.seed} missing:${m.length}/${solid.w*solid.d*solid.h} → ${pass?'PASS (fixed!)':'FAIL (still FN!)'}`);
}
console.log(`\nFalse negatives correctly passing: ${fnFixed}/12`);
