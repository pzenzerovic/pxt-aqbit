// Print shapes for FPs + borderline OK seeds for visual comparison.

class Solid {
  constructor() { this.cells = new Set(); this.w = this.d = this.h = 0; }
  static key(x,y,z) { return x+","+y+","+z; }
  add(x,y,z)    { this.cells.add(Solid.key(x,y,z)); }
  remove(x,y,z) { this.cells.delete(Solid.key(x,y,z)); }
  has(x,y,z)    { return this.cells.has(Solid.key(x,y,z)); }
  get size()    { return this.cells.size; }
  forEach(fn)   { for (const k of this.cells) { const [x,y,z]=k.split(",").map(Number); fn(x,y,z); } }
  static box(w,d,h) {
    const s=new Solid(); for(let x=0;x<w;x++) for(let y=0;y<d;y++) for(let z=0;z<h;z++) s.add(x,y,z); s.w=w;s.d=d;s.h=h; return s;
  }
  normalize() {
    if(!this.cells.size){this.w=this.d=this.h=0;return this;}
    let mnX=Infinity,mnY=Infinity,mnZ=Infinity,mxX=-Infinity,mxY=-Infinity,mxZ=-Infinity;
    this.forEach((x,y,z)=>{if(x<mnX)mnX=x;if(y<mnY)mnY=y;if(z<mnZ)mnZ=z;if(x>mxX)mxX=x;if(y>mxY)mxY=y;if(z>mxZ)mxZ=z;});
    const s2=new Set(); this.forEach((x,y,z)=>s2.add(Solid.key(x-mnX,y-mnY,z-mnZ)));
    this.cells=s2;this.w=mxX-mnX+1;this.d=mxY-mnY+1;this.h=mxZ-mnZ+1;return this;
  }
  isConnected() {
    if(!this.cells.size) return false;
    const start=this.cells.values().next().value; const seen=new Set([start]); const stack=[start];
    const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    while(stack.length){const [x,y,z]=stack.pop().split(",").map(Number);
      for(const[dx,dy,dz]of dirs){const k=Solid.key(x+dx,y+dy,z+dz);if(this.cells.has(k)&&!seen.has(k)){seen.add(k);stack.push(k);}}}
    return seen.size===this.cells.size;
  }
}
function makeRng(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function randInt(rng,lo,hi){return lo+Math.floor(rng()*(hi-lo+1));}
function carveCorner(solid,w,d,h,rng,maxExtent){
  let fromMaxX,fromMaxY,fromMaxZ;
  for(let t=0;t<6;t++){fromMaxX=rng()<0.5;fromMaxY=rng()<0.5;fromMaxZ=rng()<0.5;if(fromMaxX||fromMaxY)break;}
  const rx=randInt(rng,1,Math.min(maxExtent,w-1)),ry=randInt(rng,1,Math.min(maxExtent,d-1)),rz=randInt(rng,1,Math.min(maxExtent,h-1));
  const x0=fromMaxX?w-rx:0,y0=fromMaxY?d-ry:0,z0=fromMaxZ?h-rz:0;
  for(let x=x0;x<x0+rx;x++) for(let y=y0;y<y0+ry;y++) for(let z=z0;z<z0+rz;z++) solid.remove(x,y,z);
}
function fillHidden(solid){
  const{w,d,h}=solid;const toFill=[];
  for(let x=0;x<w;x++) for(let y=0;y<d;y++) for(let z=0;z<h;z++){
    if(solid.has(x,y,z)) continue;
    let ex=true;for(let xx=x+1;xx<w;xx++) if(solid.has(xx,y,z)){ex=false;break;}
    let ey=true;for(let yy=y+1;yy<d;yy++) if(solid.has(x,yy,z)){ey=false;break;}
    let ez=true;for(let zz=z+1;zz<h;zz++) if(solid.has(x,y,zz)){ez=false;break;}
    if(!ex&&!ey&&!ez) toFill.push([x,y,z]);
  }
  for(const[x,y,z]of toFill) solid.add(x,y,z);
}
function buildSolid({w,d,h,carves,seed}){
  const rng=makeRng(seed);const maxE=Math.max(1,Math.ceil(Math.min(w,d,h)/2));
  for(let attempt=0;attempt<20;attempt++){
    const solid=Solid.box(w,d,h);
    for(let i=0;i<carves;i++) carveCorner(solid,w,d,h,rng,maxE);
    solid.normalize();fillHidden(solid);
    if(solid.size>0&&solid.isConnected()) return solid;
  }
  return Solid.box(w,d,h);
}
function getMissing(s){const m=[];for(let x=0;x<s.w;x++) for(let y=0;y<s.d;y++) for(let z=0;z<s.h;z++) if(!s.has(x,y,z)) m.push([x,y,z]);return m;}
function getExp(s,x,y,z){let px=true,py=true,pz=true;for(let xx=x+1;xx<s.w;xx++) if(s.has(xx,y,z)){px=false;break;}for(let yy=y+1;yy<s.d;yy++) if(s.has(x,yy,z)){py=false;break;}for(let zz=z+1;zz<s.h;zz++) if(s.has(x,y,zz)){pz=false;break;}return{px,py,pz};}
function getComps(missing){
  const set=new Set(missing.map(([x,y,z])=>x+","+y+","+z));const vis=new Set();const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];const comps=[];
  for(const[sx,sy,sz]of missing){if(vis.has(sx+","+sy+","+sz))continue;const comp=[];const stack=[[sx,sy,sz]];vis.add(sx+","+sy+","+sz);
    while(stack.length){const[x,y,z]=stack.pop();comp.push([x,y,z]);for(const[dx,dy,dz]of dirs){const k=(x+dx)+","+(y+dy)+","+(z+dz);if(set.has(k)&&!vis.has(k)){vis.add(k);stack.push([x+dx,y+dy,z+dz]);}}}
    comps.push(comp);}
  return comps;
}
function printShape(label, p) {
  const solid=buildSolid(p); const missing=getMissing(solid); const {w,d,h}=solid;
  const comps=getComps(missing);
  const compInfo=comps.map(comp=>{
    const exps=comp.map(([x,y,z])=>getExp(solid,x,y,z));
    return{size:comp.length,px:exps.some(e=>e.px),py:exps.some(e=>e.py),pz:exps.some(e=>e.pz),
      minDirs:Math.min(...exps.map(e=>(e.px?1:0)+(e.py?1:0)+(e.pz?1:0)))};
  });
  const anyPx=missing.some(([x,y,z])=>getExp(solid,x,y,z).px);
  const anyPy=missing.some(([x,y,z])=>getExp(solid,x,y,z).py);
  const anyPz=missing.some(([x,y,z])=>getExp(solid,x,y,z).pz);
  console.log(`${label} seed:${p.seed} ${w}×${d}×${h} miss:${missing.length}/${w*d*h} comps:${comps.length} px:${anyPx?1:0} py:${anyPy?1:0} pz:${anyPz?1:0}`);
  for(let i=0;i<comps.length;i++) console.log(`  comp${i}: size=${compInfo[i].size} px:${compInfo[i].px?1:0} py:${compInfo[i].py?1:0} pz:${compInfo[i].pz?1:0} minDirs:${compInfo[i].minDirs}`);
  for(let z=h-1;z>=0;z--){let row=`  z=${z}: `;for(let y=0;y<d;y++){for(let x=0;x<w;x++) row+=(solid.has(x,y,z)?'█':'·');if(y<d-1)row+=' ';}console.log(row);}
  console.log();
}

// FPs — user BAD, filter PASS
console.log("=== FALSE POSITIVES (user BAD, filter PASS) ===\n");
const FP=[
  {seed:770909187,w:4,d:3,h:3,carves:2},{seed:770909186,w:4,d:3,h:3,carves:2},
  {seed:770909177,w:4,d:3,h:3,carves:2},{seed:770909176,w:4,d:3,h:3,carves:2},
  {seed:770909170,w:4,d:3,h:3,carves:2},{seed:770909168,w:4,d:3,h:3,carves:2},
  {seed:770909162,w:4,d:3,h:3,carves:2},{seed:726198175,w:2,d:2,h:2,carves:2},
  {seed:166059341,w:3,d:3,h:3,carves:2},{seed:166059327,w:3,d:3,h:3,carves:2},
  {seed:166059321,w:3,d:3,h:3,carves:2},
];
for(const p of FP) printShape('FP', p);

// Borderline OK seeds: px=0 or py=0 or disconnected or pz=0
console.log("=== BORDERLINE OK seeds (missing one direction or disconnected) ===\n");
const OK_BORDER=[
  // 4×3×3 OK with pz=0 or disconnected
  {seed:770909191,w:4,d:3,h:3,carves:2},
  {seed:770909190,w:4,d:3,h:3,carves:2},
  {seed:770909183,w:4,d:3,h:3,carves:2},
  {seed:770909182,w:4,d:3,h:3,carves:2},
  {seed:770909181,w:4,d:3,h:3,carves:2},
  // 2×2×2 OK with py=0 or px=0
  {seed:726198184,w:2,d:2,h:2,carves:2},
  {seed:726198183,w:2,d:2,h:2,carves:2},
  {seed:726198180,w:2,d:2,h:2,carves:2},
  {seed:726198178,w:2,d:2,h:2,carves:2},
  {seed:726198172,w:2,d:2,h:2,carves:2},
  {seed:726198170,w:2,d:2,h:2,carves:2},
  {seed:726198168,w:2,d:2,h:2,carves:2},
  {seed:726198165,w:2,d:2,h:2,carves:2},
  {seed:726198164,w:2,d:2,h:2,carves:2},
  {seed:726198162,w:2,d:2,h:2,carves:2},
  {seed:726198158,w:2,d:2,h:2,carves:2},
  // 3×3×3 OK with px=0 or py=0 or disconnected
  {seed:166059339,w:3,d:3,h:3,carves:2},
  {seed:166059338,w:3,d:3,h:3,carves:2},
  {seed:166059334,w:3,d:3,h:3,carves:2},
  {seed:166059332,w:3,d:3,h:3,carves:2},
  {seed:166059331,w:3,d:3,h:3,carves:2},
  {seed:166059325,w:3,d:3,h:3,carves:2},
  {seed:166059319,w:3,d:3,h:3,carves:2},
];
for(const p of OK_BORDER) printShape('OK', p);
