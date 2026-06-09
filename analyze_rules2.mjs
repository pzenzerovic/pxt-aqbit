// Deep-dive: visualize all disagreement cases and test per-component readability rule.

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

// Get connected components of missing region
function getComponents(missing) {
  const missingSet = new Set(missing.map(([x,y,z])=>x+","+y+","+z));
  const visited = new Set();
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const components = [];
  for (const [sx,sy,sz] of missing) {
    const key=sx+","+sy+","+sz;
    if (visited.has(key)) continue;
    const comp=[];
    const stack=[[sx,sy,sz]];
    visited.add(key);
    while (stack.length) {
      const [x,y,z]=stack.pop();
      comp.push([x,y,z]);
      for (const [dx,dy,dz] of dirs) {
        const k=(x+dx)+","+(y+dy)+","+(z+dz);
        if (missingSet.has(k)&&!visited.has(k)){visited.add(k);stack.push([x+dx,y+dy,z+dz]);}
      }
    }
    components.push(comp);
  }
  return components;
}

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

function describeShape(solid) {
  const missing=getMissing(solid);
  const totalVol=solid.w*solid.d*solid.h;
  const comps=getComponents(missing);

  let anyPz=false, anyPx=false, anyPy=false;
  let maxDirVoxel=0;
  for (const [x,y,z] of missing) {
    const {px,py,pz}=getExposure(solid,x,y,z);
    if (pz) anyPz=true;
    if (px) anyPx=true;
    if (py) anyPy=true;
    const dirs=(px?1:0)+(py?1:0)+(pz?1:0);
    if (dirs>maxDirVoxel) maxDirVoxel=dirs;
  }

  // Per-component: does each component have a voxel with 2+ dirs?
  const compReadable = comps.map(comp=>{
    return comp.some(([x,y,z])=>{
      const {px,py,pz}=getExposure(solid,x,y,z);
      return (px?1:0)+(py?1:0)+(pz?1:0)>=2;
    });
  });

  // Describe each component
  const compDescs=comps.map((comp,i)=>{
    const readable=compReadable[i];
    const dirs=comp.map(([x,y,z])=>{
      const {px,py,pz}=getExposure(solid,x,y,z);
      return {x,y,z,px,py,pz,n:(px?1:0)+(py?1:0)+(pz?1:0)};
    });
    const maxN=Math.max(...dirs.map(d=>d.n));
    const dirFlags={px:dirs.some(d=>d.px),py:dirs.some(d=>d.py),pz:dirs.some(d=>d.pz)};
    return `    comp${i}: size=${comp.length} maxDirs=${maxN} px=${dirFlags.px?1:0} py=${dirFlags.py?1:0} pz=${dirFlags.pz?1:0} readable=${readable}`;
  });

  return {
    missing:missing.length,totalVol,comps:comps.length,anyPz,anyPx,anyPy,maxDirVoxel,
    allCompsReadable:compReadable.every(Boolean),
    compDescs
  };
}

// ── Print all false negatives (user-OK, currently filtered) ─────────────────
console.log("=== USER-OK FALSE NEGATIVES (need to PASS) ===\n");

const FN = [
  // Fail Rule A only (no pz anywhere)
  {seed:465358711,w:3,d:3,h:3,carves:2,tag:'A'},
  {seed:465358710,w:3,d:3,h:3,carves:2,tag:'A'},
  {seed:465358709,w:3,d:3,h:3,carves:2,tag:'A'},
  // Fail Rule B only (disconnected)
  {seed:465358752,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:465358739,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:465358732,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:465358728,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:465358725,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:465358714,w:3,d:3,h:3,carves:2,tag:'B'},
  // Fail Rule C only (missing anyPy)
  {seed:465358747,w:3,d:3,h:3,carves:2,tag:'C'},
  {seed:465358723,w:3,d:3,h:3,carves:2,tag:'C'},
  {seed:465358720,w:3,d:3,h:3,carves:2,tag:'C'},
];

for (const p of FN) {
  const solid=buildSolid(p);
  const info=describeShape(solid);
  console.log(`seed:${p.seed} fails:${p.tag} missing:${info.missing}/${info.totalVol} comps:${info.comps} allCompsReadable:${info.allCompsReadable} anyPx:${info.anyPx?1:0} anyPy:${info.anyPy?1:0} anyPz:${info.anyPz?1:0}`);
  for (const d of info.compDescs) console.log(d);
  printLayers(solid);
  console.log();
}

// ── Print re-introduced bad seeds ───────────────────────────────────────────
console.log("=== ORIGINAL BAD RE-INTRODUCED BY NEW RULES (need to FAIL) ===\n");

// Specific seeds that get re-introduced:
const REINTRODUCED = [
  {seed:781714169,w:3,d:3,h:3,carves:2,tag:'A,B'},
  {seed:781714166,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:781714162,w:3,d:3,h:3,carves:2,tag:'C'},
  {seed:781714160,w:3,d:3,h:3,carves:2,tag:'A'},
  {seed:327254525,w:3,d:3,h:3,carves:2,tag:'C,B'},
  {seed:327254524,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254517,w:3,d:3,h:3,carves:2,tag:'A,B'},
  {seed:327254513,w:3,d:3,h:3,carves:2,tag:'C'},
  {seed:327254504,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254495,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254494,w:3,d:3,h:3,carves:2,tag:'C,B'},
  {seed:327254493,w:3,d:3,h:3,carves:2,tag:'A,B'},
  {seed:327254489,w:3,d:3,h:3,carves:2,tag:'C,B'},
  {seed:327254488,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254486,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254484,w:3,d:3,h:3,carves:2,tag:'B'},
  {seed:327254481,w:3,d:3,h:3,carves:2,tag:'A'},
];

for (const p of REINTRODUCED) {
  const solid=buildSolid(p);
  const info=describeShape(solid);
  console.log(`seed:${p.seed} origFails:${p.tag} missing:${info.missing}/${info.totalVol} comps:${info.comps} allCompsReadable:${info.allCompsReadable} anyPx:${info.anyPx?1:0} anyPy:${info.anyPy?1:0} anyPz:${info.anyPz?1:0}`);
  for (const d of info.compDescs) console.log(d);
  printLayers(solid);
  console.log();
}
