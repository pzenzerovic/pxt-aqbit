// Analysis of new batch: 770909xxx (4×3×3), 726198xxx (2×2×2), 166059xxx (3×3×3)

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

// Current isCutReadable
function isCutReadable(solid) {
  const {w,d,h}=solid;
  const missing=[];
  for (let x=0;x<w;x++) for (let y=0;y<d;y++) for (let z=0;z<h;z++)
    if (!solid.has(x,y,z)) missing.push([x,y,z]);
  if (missing.length===0) return {pass:true,fails:[]};
  const fails=[];
  if (missing.length > w*d*h*0.25) fails.push('D');
  const missingSet=new Set(missing.map(([x,y,z])=>x+","+y+","+z));
  const visited=new Set();
  const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const [sx,sy,sz] of missing) {
    const key=sx+","+sy+","+sz;
    if (visited.has(key)) continue;
    const comp=[]; const stack=[[sx,sy,sz]]; visited.add(key);
    while (stack.length) {
      const [x,y,z]=stack.pop(); comp.push([x,y,z]);
      for (const [dx,dy,dz] of dirs) {
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
    if (!readable) fails.push('A');
  }
  let anyPx=false,anyPy=false;
  for (const [x,y,z] of missing) {
    if (!anyPx){let ok=true; for(let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){ok=false;break;} if(ok) anyPx=true;}
    if (!anyPy){let ok=true; for(let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){ok=false;break;} if(ok) anyPy=true;}
    if (anyPx&&anyPy) break;
  }
  if (!anyPx&&!anyPy) fails.push('C');
  return {pass:fails.length===0, fails:[...new Set(fails)]};
}

function getMissing(solid) {
  const m=[]; for(let x=0;x<solid.w;x++) for(let y=0;y<solid.d;y++) for(let z=0;z<solid.h;z++) if(!solid.has(x,y,z)) m.push([x,y,z]); return m;
}
function getExposure(solid,x,y,z) {
  let px=true,py=true,pz=true;
  for(let xx=x+1;xx<solid.w;xx++) if(solid.has(xx,y,z)){px=false;break;}
  for(let yy=y+1;yy<solid.d;yy++) if(solid.has(x,yy,z)){py=false;break;}
  for(let zz=z+1;zz<solid.h;zz++) if(solid.has(x,y,zz)){pz=false;break;}
  return {px,py,pz};
}
function getComponents(missing) {
  const set=new Set(missing.map(([x,y,z])=>x+","+y+","+z));
  const vis=new Set(); const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]; const comps=[];
  for(const [sx,sy,sz] of missing){
    if(vis.has(sx+","+sy+","+sz)) continue;
    const comp=[]; const stack=[[sx,sy,sz]]; vis.add(sx+","+sy+","+sz);
    while(stack.length){const [x,y,z]=stack.pop(); comp.push([x,y,z]); for(const [dx,dy,dz] of dirs){const k=(x+dx)+","+(y+dy)+","+(z+dz); if(set.has(k)&&!vis.has(k)){vis.add(k);stack.push([x+dx,y+dy,z+dz]);}}}
    comps.push(comp);
  }
  return comps;
}
function printLayers(solid) {
  const {w,d,h}=solid;
  for(let z=h-1;z>=0;z--){
    let row=`  z=${z}: `;
    for(let y=0;y<d;y++){for(let x=0;x<w;x++) row+=(solid.has(x,y,z)?'█':'·'); if(y<d-1) row+=' ';}
    console.log(row);
  }
}
function describe(solid) {
  const missing=getMissing(solid);
  const vol=solid.w*solid.d*solid.h;
  const comps=getComponents(missing);
  let anyPx=false,anyPy=false,anyPz=false;
  const compInfo=comps.map(comp=>{
    const dirs=comp.map(([x,y,z])=>getExposure(solid,x,y,z));
    const maxN=Math.max(...dirs.map(d=>(d.px?1:0)+(d.py?1:0)+(d.pz?1:0)));
    const hasPx=dirs.some(d=>d.px); const hasPy=dirs.some(d=>d.py); const hasPz=dirs.some(d=>d.pz);
    if(hasPx) anyPx=true; if(hasPy) anyPy=true; if(hasPz) anyPz=true;
    const readable=dirs.some(d=>(d.px?1:0)+(d.py?1:0)+(d.pz?1:0)>=2);
    return {size:comp.length,maxN,hasPx,hasPy,hasPz,readable};
  });
  const allCompsReadable=compInfo.every(c=>c.readable);
  return {missing:missing.length,vol,pct:missing.length/vol,comps:comps.length,anyPx,anyPy,anyPz,allCompsReadable,compInfo};
}

// ── Data ─────────────────────────────────────────────────────────────────────
const BAD = [
  {seed:770909192,w:4,d:3,h:3,carves:2},{seed:770909189,w:4,d:3,h:3,carves:2},
  {seed:770909188,w:4,d:3,h:3,carves:2},{seed:770909187,w:4,d:3,h:3,carves:2},
  {seed:770909186,w:4,d:3,h:3,carves:2},{seed:770909185,w:4,d:3,h:3,carves:2},
  {seed:770909180,w:4,d:3,h:3,carves:2},{seed:770909178,w:4,d:3,h:3,carves:2},
  {seed:770909177,w:4,d:3,h:3,carves:2},{seed:770909176,w:4,d:3,h:3,carves:2},
  {seed:770909175,w:4,d:3,h:3,carves:2},{seed:770909173,w:4,d:3,h:3,carves:2},
  {seed:770909172,w:4,d:3,h:3,carves:2},{seed:770909171,w:4,d:3,h:3,carves:2},
  {seed:770909170,w:4,d:3,h:3,carves:2},{seed:770909169,w:4,d:3,h:3,carves:2},
  {seed:770909168,w:4,d:3,h:3,carves:2},{seed:770909167,w:4,d:3,h:3,carves:2},
  {seed:770909166,w:4,d:3,h:3,carves:2},{seed:770909165,w:4,d:3,h:3,carves:2},
  {seed:770909164,w:4,d:3,h:3,carves:2},{seed:770909162,w:4,d:3,h:3,carves:2},
  {seed:770909161,w:4,d:3,h:3,carves:2},
  {seed:726198186,w:2,d:2,h:2,carves:2},{seed:726198185,w:2,d:2,h:2,carves:2},
  {seed:726198182,w:2,d:2,h:2,carves:2},{seed:726198181,w:2,d:2,h:2,carves:2},
  {seed:726198179,w:2,d:2,h:2,carves:2},{seed:726198177,w:2,d:2,h:2,carves:2},
  {seed:726198176,w:2,d:2,h:2,carves:2},{seed:726198175,w:2,d:2,h:2,carves:2},
  {seed:726198174,w:2,d:2,h:2,carves:2},{seed:726198173,w:2,d:2,h:2,carves:2},
  {seed:726198171,w:2,d:2,h:2,carves:2},{seed:726198163,w:2,d:2,h:2,carves:2},
  {seed:726198161,w:2,d:2,h:2,carves:2},{seed:726198160,w:2,d:2,h:2,carves:2},
  {seed:726198159,w:2,d:2,h:2,carves:2},{seed:726198157,w:2,d:2,h:2,carves:2},
  {seed:166059345,w:3,d:3,h:3,carves:2},{seed:166059344,w:3,d:3,h:3,carves:2},
  {seed:166059343,w:3,d:3,h:3,carves:2},{seed:166059342,w:3,d:3,h:3,carves:2},
  {seed:166059341,w:3,d:3,h:3,carves:2},{seed:166059340,w:3,d:3,h:3,carves:2},
  {seed:166059337,w:3,d:3,h:3,carves:2},{seed:166059335,w:3,d:3,h:3,carves:2},
  {seed:166059330,w:3,d:3,h:3,carves:2},{seed:166059329,w:3,d:3,h:3,carves:2},
  {seed:166059328,w:3,d:3,h:3,carves:2},{seed:166059327,w:3,d:3,h:3,carves:2},
  {seed:166059326,w:3,d:3,h:3,carves:2},{seed:166059324,w:3,d:3,h:3,carves:2},
  {seed:166059323,w:3,d:3,h:3,carves:2},{seed:166059322,w:3,d:3,h:3,carves:2},
  {seed:166059321,w:3,d:3,h:3,carves:2},{seed:166059320,w:3,d:3,h:3,carves:2},
  {seed:166059318,w:3,d:3,h:3,carves:2},{seed:166059317,w:3,d:3,h:3,carves:2},
];
const OK = [
  {seed:770909193,w:4,d:3,h:3,carves:2},{seed:770909191,w:4,d:3,h:3,carves:2},
  {seed:770909190,w:4,d:3,h:3,carves:2},{seed:770909184,w:4,d:3,h:3,carves:2},
  {seed:770909183,w:4,d:3,h:3,carves:2},{seed:770909182,w:4,d:3,h:3,carves:2},
  {seed:770909181,w:4,d:3,h:3,carves:2},{seed:770909179,w:4,d:3,h:3,carves:2},
  {seed:770909174,w:4,d:3,h:3,carves:2},{seed:770909163,w:4,d:3,h:3,carves:2},
  {seed:770909160,w:4,d:3,h:3,carves:2},
  {seed:726198187,w:2,d:2,h:2,carves:2},{seed:726198184,w:2,d:2,h:2,carves:2},
  {seed:726198183,w:2,d:2,h:2,carves:2},{seed:726198180,w:2,d:2,h:2,carves:2},
  {seed:726198178,w:2,d:2,h:2,carves:2},{seed:726198172,w:2,d:2,h:2,carves:2},
  {seed:726198170,w:2,d:2,h:2,carves:2},{seed:726198169,w:2,d:2,h:2,carves:2},
  {seed:726198168,w:2,d:2,h:2,carves:2},{seed:726198167,w:2,d:2,h:2,carves:2},
  {seed:726198166,w:2,d:2,h:2,carves:2},{seed:726198165,w:2,d:2,h:2,carves:2},
  {seed:726198164,w:2,d:2,h:2,carves:2},{seed:726198162,w:2,d:2,h:2,carves:2},
  {seed:726198158,w:2,d:2,h:2,carves:2},
  {seed:166059339,w:3,d:3,h:3,carves:2},{seed:166059338,w:3,d:3,h:3,carves:2},
  {seed:166059336,w:3,d:3,h:3,carves:2},{seed:166059334,w:3,d:3,h:3,carves:2},
  {seed:166059333,w:3,d:3,h:3,carves:2},{seed:166059332,w:3,d:3,h:3,carves:2},
  {seed:166059331,w:3,d:3,h:3,carves:2},{seed:166059325,w:3,d:3,h:3,carves:2},
  {seed:166059319,w:3,d:3,h:3,carves:2},
];

// ── Run ───────────────────────────────────────────────────────────────────────
console.log("=== FILTER RESULTS ON ALL SEEDS ===\n");

// Track filter vs user judgment
let badPasses=0, okFails=0;
const fp=[], fn_=[];

console.log("BAD seeds (should fail):");
for(const p of BAD){
  const solid=buildSolid(p); const r=isCutReadable(solid); const d=describe(solid);
  const pctStr=(d.pct*100).toFixed(0)+"%";
  if(r.pass) { badPasses++; fp.push(p); }
  console.log(`  seed:${p.seed} ${solid.w}×${solid.d}×${solid.h} missing:${d.missing}/${d.vol}(${pctStr}) comps:${d.comps} allCompRd:${d.allCompsReadable} px:${d.anyPx?1:0} py:${d.anyPy?1:0} pz:${d.anyPz?1:0} → ${r.pass?'PASS(FP!)':'FAIL'} fails:[${r.fails}]`);
}
console.log(`\nOK seeds (should pass):`);
for(const p of OK){
  const solid=buildSolid(p); const r=isCutReadable(solid); const d=describe(solid);
  const pctStr=(d.pct*100).toFixed(0)+"%";
  if(!r.pass) { okFails++; fn_.push(p); }
  console.log(`  seed:${p.seed} ${solid.w}×${solid.d}×${solid.h} missing:${d.missing}/${d.vol}(${pctStr}) comps:${d.comps} allCompRd:${d.allCompsReadable} px:${d.anyPx?1:0} py:${d.anyPy?1:0} pz:${d.anyPz?1:0} → ${r.pass?'PASS':'FAIL(FN!)'} fails:[${r.fails}]`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`False positives (BAD but filter passes): ${badPasses}/${BAD.length}`);
console.log(`False negatives (OK but filter fails):   ${okFails}/${OK.length}`);

// ── Deep-dive disagreements ───────────────────────────────────────────────────
if(fp.length>0){
  console.log("\n=== FALSE POSITIVES (user BAD, filter PASS) — details ===\n");
  for(const p of fp){
    const solid=buildSolid(p); const d=describe(solid); const missing=getMissing(solid);
    console.log(`seed:${p.seed} ${solid.w}×${solid.d}×${solid.h} missing:${d.missing}/${d.vol}(${(d.pct*100).toFixed(0)}%) comps:${d.comps}`);
    for(let i=0;i<d.compInfo.length;i++){
      const c=d.compInfo[i];
      console.log(`  comp${i}: size=${c.size} maxDirs=${c.maxN} px:${c.hasPx?1:0} py:${c.hasPy?1:0} pz:${c.hasPz?1:0} readable:${c.readable}`);
    }
    for(const [x,y,z] of missing){
      const e=getExposure(solid,x,y,z);
      console.log(`  (${x},${y},${z}) px:${e.px?1:0} py:${e.py?1:0} pz:${e.pz?1:0} dirs:${(e.px?1:0)+(e.py?1:0)+(e.pz?1:0)}`);
    }
    printLayers(solid);
    console.log();
  }
}
if(fn_.length>0){
  console.log("\n=== FALSE NEGATIVES (user OK, filter FAIL) — details ===\n");
  for(const p of fn_){
    const solid=buildSolid(p); const d=describe(solid); const missing=getMissing(solid);
    const r=isCutReadable(solid);
    console.log(`seed:${p.seed} ${solid.w}×${solid.d}×${solid.h} missing:${d.missing}/${d.vol}(${(d.pct*100).toFixed(0)}%) fails:[${r.fails}] comps:${d.comps}`);
    for(let i=0;i<d.compInfo.length;i++){
      const c=d.compInfo[i];
      console.log(`  comp${i}: size=${c.size} maxDirs=${c.maxN} px:${c.hasPx?1:0} py:${c.hasPy?1:0} pz:${c.hasPz?1:0} readable:${c.readable}`);
    }
    for(const [x,y,z] of missing){
      const e=getExposure(solid,x,y,z);
      console.log(`  (${x},${y},${z}) px:${e.px?1:0} py:${e.py?1:0} pz:${e.pz?1:0} dirs:${(e.px?1:0)+(e.py?1:0)+(e.pz?1:0)}`);
    }
    printLayers(solid);
    console.log();
  }
}
