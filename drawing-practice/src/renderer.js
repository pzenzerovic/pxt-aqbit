// renderer.js — pretvara model tijela u SVG: izometrijski prikaz i NTB projekcije.
// Standard: ISO 5456-2, prvo kutno projiciranje (europska metoda, 1. kvadrant).

// ---------------------------------------------------------------------------
// IZOMETRIJA — matematička projekcija, koordinatni sustav:
//   x = širina  (u iso ide desno-dolje na ekranu)
//   y = dubina  (u iso ide lijevo-dolje na ekranu)
//   z = visina  (u iso ide ravno gore)
// Gledište: (+∞, +∞, +∞) — vidljive plohe su +z (gore), +x (desno), +y (lijevo).
// ---------------------------------------------------------------------------

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

function isoProject(x, y, z, s) {
  return [
    (x - y) * COS30 * s,
    (x + y) * SIN30 * s - z * s,
  ];
}

// --- Uklanjanje skrivenih linija (hidden-line removal) ---
// Kamera je u (+∞,+∞,+∞); točka je vidljiva ako između nje i kamere (smjer +1,+1,+1)
// nema pune kocke. Inače je zaklonjena (npr. brid na dnu udubljenja iza višeg zida).
// Koristi se točan obilazak voksela (3D DDA) — provjerava SVAKU kocku kroz koju
// zraka prolazi, pa ne preskače tanke zaklone (fiksni korak bi ih mogao preskočiti).
function occluded(solid, P) {
  const { w, d, h } = solid;
  let x = Math.floor(P[0] + 1e-9), y = Math.floor(P[1] + 1e-9), z = Math.floor(P[2] + 1e-9);
  // Smjer zrake = (+1,+1,+1). tMax = udaljenost do sljedeće cjelobrojne ravnine po osi.
  let tMaxX = 1 - (P[0] - Math.floor(P[0])); if (tMaxX <= 1e-9) tMaxX = 1;
  let tMaxY = 1 - (P[1] - Math.floor(P[1])); if (tMaxY <= 1e-9) tMaxY = 1;
  let tMaxZ = 1 - (P[2] - Math.floor(P[2])); if (tMaxZ <= 1e-9) tMaxZ = 1;
  const maxIter = 3 * (w + d + h) + 6;
  for (let i = 0; i < maxIter; i++) {
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) { x++; tMaxX += 1; }
    else if (tMaxY <= tMaxZ) { y++; tMaxY += 1; }
    else { z++; tMaxZ += 1; }
    if (x >= w || y >= d || z >= h || x < 0 || y < 0 || z < 0) return false; // izašli prema kameri
    if (solid.has(x, y, z)) return true;
  }
  return false;
}

// Vrati vidljive dijelove brida A→B kao niz 2D segmenata [p1,p2].
// Brid se uzorkuje po dužini; nevidljivi dijelovi (zaklonjeni tijelom) se izostave.
// Time se rješava "krvarenje" — bridovi sa stražnje/skrivene strane konkavnih tijela
// više se ne crtaju preko prednjih ploha.
function visibleSegments(solid, A, B, s, N = 24) {
  const runs = [];
  let runStart = null;
  for (let i = 0; i < N; i++) {
    const um = (i + 0.5) / N;
    const P = [A[0] + (B[0]-A[0])*um, A[1] + (B[1]-A[1])*um, A[2] + (B[2]-A[2])*um];
    const vis = !occluded(solid, P);
    if (vis) { if (runStart === null) runStart = i / N; }
    else if (runStart !== null) { runs.push([runStart, i / N]); runStart = null; }
  }
  if (runStart !== null) runs.push([runStart, 1]);
  return runs.map(([u0, u1]) => {
    const P0 = [A[0]+(B[0]-A[0])*u0, A[1]+(B[1]-A[1])*u0, A[2]+(B[2]-A[2])*u0];
    const P1 = [A[0]+(B[0]-A[0])*u1, A[1]+(B[1]-A[1])*u1, A[2]+(B[2]-A[2])*u1];
    return [isoProject(P0[0],P0[1],P0[2],s), isoProject(P1[0],P1[1],P1[2],s)];
  });
}

// Ključ za brid: 3D koordinate (integer) — izbjegava lažna podudaranja zbog izometričke projekcije
// gdje različite 3D točke mogu dati isti 2D piksel (npr. iso(2,0,0) == iso(3,1,1)).
function edgeKey3d(a, b) {
  const s1 = a.join(","), s2 = b.join(",");
  return s1 <= s2 ? s1 + "|" + s2 : s2 + "|" + s1;
}

// Dodaj sve bridove poligona u mapu. pts3d su 3D vrhovi, pts2d su projecirane 2D točke.
function collectEdges(map, pts3d, pts2d, type) {
  for (let i = 0; i < pts3d.length; i++) {
    const p3d1 = pts3d[i], p3d2 = pts3d[(i + 1) % pts3d.length];
    const p2d1 = pts2d[i], p2d2 = pts2d[(i + 1) % pts2d.length];
    const key = edgeKey3d(p3d1, p3d2);
    if (!map.has(key)) map.set(key, { key, a: p3d1, b: p3d2, p1: p2d1, p2: p2d2, top: 0, rx: 0, ly: 0 });
    const e = map.get(key);
    e[type]++;
  }
}

function svgPoly(points, fill) {
  const pts = points.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

function svgLine(p1, p2, stroke, sw, dash) {
  const d = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" stroke="${stroke}" stroke-width="${sw}"${d} stroke-linecap="round"/>`;
}

// Provjeri je li brid "unutarnji" — rub stepenice/utora ili konkavni spoj — umjesto
// pravog vanjskog ruba. Vrijedi i za count=1 bridove i za foldLine bridove (kinds=2).
//
// Logika po vrsti brida (x0/y0/z0 = min koordinate, jer redoslijed a/b ovisi o poligonu):
//
//   Vertikalni (z varira):
//     LY → postoji li voksel s vanjske (+y) strane?
//     RX → postoji li voksel s vanjske (+x) strane?
//     LY+RX prijelaz → popunjava li voksel kut (x0,y0,z0)?
//
//   Horizontalni u x (y i z konstantni):
//     LY → postoji li voksel s vanjske strane (+y)?
//     TOP count=1 → je li susjedni voksel iste visine na "outward" strani?
//            (odredi stranu po tome koji voksel iznad bridom blokira gornju plohu)
//     TOP+LY prijelaz → popunjava li voksel (x0,y0,z0)?
//
//   Horizontalni u y (x i z konstantni):
//     RX → postoji li voksel s vanjske strane (+x)?
//     TOP count=1 → kao gore, ali za x-smjer
//     TOP+RX prijelaz → popunjava li voksel (x0,y0,z0)?
function isInnerStepEdge(solid, e) {
  const [ax, ay, az] = e.a;
  const [bx, by, bz] = e.b;
  const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), z0 = Math.min(az, bz);

  if (az !== bz) {
    // Vertikalni brid (z varira)
    if (e.ly && !e.rx)  return solid.has(x0-1, y0, z0) || solid.has(x0, y0, z0);
    if (e.rx && !e.ly)  return solid.has(x0, y0-1, z0) || solid.has(x0, y0, z0);
    return solid.has(x0, y0, z0);  // LY+RX prijelaz: provjeri kutni voksel
  }

  if (ax !== bx) {
    // Horizontalni brid u x
    if (e.ly && !e.top) return solid.has(x0, y0, z0-1) || solid.has(x0, y0, z0);
    if (e.top && !e.ly) {
      // Čista TOP ploha: utvrdi koja je strana "outward" po tome koji voksel iznad blokira
      if (solid.has(x0, y0-1, z0)) return solid.has(x0, y0-1, z0-1);
      if (solid.has(x0, y0,   z0)) return solid.has(x0, y0,   z0-1);
      return false;
    }
    return solid.has(x0, y0, z0);  // TOP+LY prijelaz
  }

  // Horizontalni brid u y
  if (e.rx && !e.top) return solid.has(x0, y0, z0-1) || solid.has(x0, y0, z0);
  if (e.top && !e.rx) {
    if (solid.has(x0-1, y0, z0)) return solid.has(x0-1, y0, z0-1);
    if (solid.has(x0,   y0, z0)) return solid.has(x0,   y0, z0-1);
    return false;
  }
  return solid.has(x0, y0, z0);  // TOP+RX prijelaz
}

// Klasifikacija jednog brida:
//   gridLine:     kinds==1, count>=2  → ravnina se nastavlja (crtkano)
//   silhouette:   count==1 i NIJE unutarnji → pravi vanjski rub (debelo)
//   foldLine:     kinds>1  i NIJE konkavni  → konveksni prijelaz (debelo)
//   stepEdge/concaveFold: unutarnji rub stepenice ili konkavni kut → tanko
function classifyIsoEdge(e, solid) {
  const kinds = (e.top > 0 ? 1 : 0) + (e.rx > 0 ? 1 : 0) + (e.ly > 0 ? 1 : 0);
  const count = e.top + e.rx + e.ly;
  if (kinds > 1 || count === 1) return isInnerStepEdge(solid, e) ? "thin" : "thick";
  return "thin";
}

// isoModel — gradi strukturirani model izometrije: plohe, bridovi (s 3D ključem
// i klasifikacijom) i granični okvir. Koristi ga i renderIso i alat za označavanje
// bridova (edge-tool) — JEDAN izvor istine za klasifikaciju.
export function isoModel(solid, opts = {}) {
  const s = opts.scale || 30;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function trackPt(p) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }

  const W = solid.w, D = solid.d;

  // --- Pod (ground grid) ---
  const ground = { corners: [], lines: [] };
  const gcorners = [
    isoProject(0, 0, 0, s), isoProject(W, 0, 0, s),
    isoProject(W, D, 0, s), isoProject(0, D, 0, s),
  ];
  gcorners.forEach(trackPt);
  ground.corners = gcorners;
  for (let i = 0; i <= W; i++) {
    const p1 = isoProject(i, 0, 0, s), p2 = isoProject(i, D, 0, s);
    trackPt(p1); trackPt(p2);
    ground.lines.push([p1, p2]);
  }
  for (let j = 0; j <= D; j++) {
    const p1 = isoProject(0, j, 0, s), p2 = isoProject(W, j, 0, s);
    trackPt(p1); trackPt(p2);
    ground.lines.push([p1, p2]);
  }

  // --- Prikupljanje ploha i bridova ---
  const TOP_COLOR = "#dde6ef";
  const RX_COLOR  = "#728199";
  const LY_COLOR  = "#9fb3c8";

  const faces = []; // { pts, fill, depth, typeOrder }
  const edgeMap = new Map();

  solid.forEach((x, y, z) => {
    const base = x + y + z + 2;
    if (!solid.has(x, y, z + 1)) {
      const c3d = [[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      faces.push({ pts, fill: TOP_COLOR, depth: base, typeOrder: 2 });
      collectEdges(edgeMap, c3d, pts, "top");
    }
    if (!solid.has(x + 1, y, z)) {
      const c3d = [[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      faces.push({ pts, fill: RX_COLOR, depth: base, typeOrder: 0 });
      collectEdges(edgeMap, c3d, pts, "rx");
    }
    if (!solid.has(x, y + 1, z)) {
      const c3d = [[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      faces.push({ pts, fill: LY_COLOR, depth: base, typeOrder: 1 });
      collectEdges(edgeMap, c3d, pts, "ly");
    }
  });

  faces.sort((a, b) => a.depth - b.depth || a.typeOrder - b.typeOrder);

  const edges = [];
  for (const e of edgeMap.values()) {
    edges.push({ key: e.key, a: e.a, b: e.b, p1: e.p1, p2: e.p2, cls: classifyIsoEdge(e, solid),
                 top: e.top, rx: e.rx, ly: e.ly,
                 segments: visibleSegments(solid, e.a, e.b, s) });
  }

  return { faces, edges, ground, bbox: { minX, minY, maxX, maxY }, scale: s };
}

// Crtkana mreža bounding-boxa na sve tri vidljive ravnine (vrh, desno, lijevo).
// Crta se IZA ploha — vidi se samo tamo gdje nema voxela (u urezima/rupama).
function fullGridLines(solid, s) {
  const W = solid.w, D = solid.d, H = solid.h;
  const lines = [];
  const col = "#e00000", sw = 1.0, dash = "2,4";
  // Gornja ravnina (z=H)
  for (let x = 0; x <= W; x++) lines.push([isoProject(x,0,H,s), isoProject(x,D,H,s), col, sw, dash]);
  for (let y = 0; y <= D; y++) lines.push([isoProject(0,y,H,s), isoProject(W,y,H,s), col, sw, dash]);
  // Desna ravnina (x=W)
  for (let y = 0; y <= D; y++) lines.push([isoProject(W,y,0,s), isoProject(W,y,H,s), col, sw, dash]);
  for (let z = 0; z <= H; z++) lines.push([isoProject(W,0,z,s), isoProject(W,D,z,s), col, sw, dash]);
  // Lijeva ravnina (y=D)
  for (let x = 0; x <= W; x++) lines.push([isoProject(x,D,0,s), isoProject(x,D,H,s), col, sw, dash]);
  for (let z = 0; z <= H; z++) lines.push([isoProject(0,D,z,s), isoProject(W,D,z,s), col, sw, dash]);
  return lines;
}

export function renderIso(solid, opts = {}) {
  const { faces, edges, ground, bbox, scale: s } = isoModel(solid, opts);

  const groundParts = [];
  const gpts = ground.corners.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  groundParts.push(`<polygon points="${gpts}" fill="#eef2f6"/>`);
  for (const [p1, p2] of ground.lines)
    groundParts.push(svgLine(p1, p2, "#a0b0be", 0.7, "4,4"));

  const gridParts = [];
  if (opts.showGrid) {
    for (const [p1, p2, col, sw, dash] of fullGridLines(solid, s))
      gridParts.push(svgLine(p1, p2, col, sw, dash));
  }

  // Plohe se crtaju prve, zatim VIDLJIVI dijelovi bridova (tanki pa debeli).
  // Skriveni dijelovi bridova su uklonjeni (hidden-line removal) pa nema krvarenja.
  const thinEdges = [], thickEdges = [];
  for (const e of edges) {
    for (const [q1, q2] of e.segments) {
      if (e.cls === "thick") thickEdges.push(svgLine(q1, q2, "#1a2a38", 2.0, null));
      else thinEdges.push(svgLine(q1, q2, "#7e96a8", 0.7, "4,4"));
    }
  }

  const parts = [
    ...groundParts,
    ...faces.map(f => svgPoly(f.pts, f.fill)),
    ...gridParts,
    ...thinEdges,
    ...thickEdges,
  ];

  const pad = 16;
  const { minX, minY, maxX, maxY } = bbox;
  const vb = `${(minX-pad).toFixed(2)} ${(minY-pad).toFixed(2)} ${(maxX-minX+pad*2).toFixed(2)} ${(maxY-minY+pad*2).toFixed(2)}`;
  return `<svg class="iso" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join("")}</svg>`;
}

// ---------------------------------------------------------------------------
// NTB PROJEKCIJE — ISO 5456-2, prvo kutno projiciranje (1. kvadrant)
//
// Layout (pogled odozgo):
//   Nacrt  (sprijeda, prema +y)  — centar
//   Tlocrt (odozgo,  prema -z)  — ISPOD nacrta
//   Bokocrt lijevi (s lijeva, prema +x) — DESNO od nacrta
// ---------------------------------------------------------------------------

function buildView(solid, kind) {
  const W = solid.w, D = solid.d, H = solid.h;
  let cols, rows, profileAt, frontIsMin;

  if (kind === "nacrt") {
    // Nacrt: promatrač na max-y (ploha vidljiva u izometriji), gleda prema -y.
    // Prikaz: x→ (lijevo=0, desno=W), z↑ (dno=0, vrh=H).
    cols = W; rows = H; frontIsMin = false;
    profileAt = (c, r) => {
      const x = c, z = H - 1 - r;
      const arr = [];
      for (let y = 0; y < D; y++) if (solid.has(x, y, z)) arr.push(y);
      return arr;
    };
  } else if (kind === "tlocrt") {
    // Tlocrt: promatrač na max-z, gleda prema -z. Prikaz: x→, y↓ (vrh=y=0, dno=y=D-1).
    cols = W; rows = D; frontIsMin = false;
    profileAt = (c, r) => {
      const x = c, y = r;
      const arr = [];
      for (let z = 0; z < H; z++) if (solid.has(x, y, z)) arr.push(z);
      return arr;
    };
  } else {
    // Bokocrt: promatrač na max-x (ploha vidljiva u izometriji), gleda prema -x.
    // Prikaz: y→ obrnut (lijevo=D-1 susjedi nacrtu, desno=0), z↑.
    cols = D; rows = H; frontIsMin = false;
    profileAt = (c, r) => {
      const y = D - 1 - c, z = H - 1 - r;
      const arr = [];
      for (let x = 0; x < W; x++) if (solid.has(x, y, z)) arr.push(x);
      return arr;
    };
  }
  return { cols, rows, profileAt, frontIsMin };
}

function classifyEdge(pa, pb, frontIsMin) {
  const occA = pa.length > 0, occB = pb.length > 0;
  if (!occA && !occB) return null;
  if (occA !== occB) return "solid";
  const fa = frontIsMin ? Math.min(...pa) : Math.max(...pa);
  const fb = frontIsMin ? Math.min(...pb) : Math.max(...pb);
  if (fa !== fb) return "solid";
  const sa = [...pa].sort((a, b) => a - b).join(",");
  const sb = [...pb].sort((a, b) => a - b).join(",");
  if (sa !== sb) return "dashed";
  return null;
}

export function renderView(solid, kind, opts = {}) {
  const cs = opts.cell || 26;
  const { cols, rows, profileAt, frontIsMin } = buildView(solid, kind);
  const w = cols * cs, h = rows * cs;
  const pad = 6;
  const parts = [];

  const prof = [];
  for (let r = 0; r < rows; r++) {
    prof[r] = [];
    for (let c = 0; c < cols; c++) prof[r][c] = profileAt(c, r);
  }

  // Pomoćna mreža.
  for (let c = 0; c <= cols; c++)
    parts.push(svgLine([c*cs, 0], [c*cs, h], "#dfe3e8", 0.8));
  for (let r = 0; r <= rows; r++)
    parts.push(svgLine([0, r*cs], [w, r*cs], "#dfe3e8", 0.8));

  if (opts.solution) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (prof[r][c].length > 0)
          parts.push(`<rect x="${c*cs}" y="${r*cs}" width="${cs}" height="${cs}" fill="#eef2f6"/>`);

    const SW = 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const pa = c > 0 ? prof[r][c-1] : [];
        const pb = c < cols ? prof[r][c] : [];
        const cls = classifyEdge(pa, pb, frontIsMin);
        if (cls) parts.push(svgLine([c*cs, r*cs], [c*cs, (r+1)*cs],
          "#1f2d3d", SW, cls === "dashed" ? "5,3" : null));
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r <= rows; r++) {
        const pa = r > 0 ? prof[r-1][c] : [];
        const pb = r < rows ? prof[r][c] : [];
        const cls = classifyEdge(pa, pb, frontIsMin);
        if (cls) parts.push(svgLine([c*cs, r*cs], [(c+1)*cs, r*cs],
          "#1f2d3d", SW, cls === "dashed" ? "5,3" : null));
      }
    }
  }

  const vb = `${-pad} ${-pad} ${w+pad*2} ${h+pad*2}`;
  return `<svg class="view" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join("")}</svg>`;
}

export function viewDims(solid) {
  return {
    nacrt:   { cols: solid.w, rows: solid.h },
    tlocrt:  { cols: solid.w, rows: solid.d },
    bokocrt: { cols: solid.d, rows: solid.h },
  };
}
