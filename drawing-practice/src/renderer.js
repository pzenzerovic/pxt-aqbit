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

// Ključ za brid: 3D koordinate (integer) — izbjegava lažna podudaranja zbog izometričke projekcije
// gdje različite 3D točke mogu dati isti 2D piksel (npr. iso(2,0,0) == iso(3,1,1)).
function edgeKey3d(a, b) {
  const s1 = a.join(","), s2 = b.join(",");
  return s1 <= s2 ? s1 + "|" + s2 : s2 + "|" + s1;
}

// Dodaj sve bridove poligona u mapu. pts3d su 3D vrhovi, pts2d su projecirane 2D točke.
function collectEdges(map, pts3d, pts2d, type, faceIdx) {
  for (let i = 0; i < pts3d.length; i++) {
    const p3d1 = pts3d[i], p3d2 = pts3d[(i + 1) % pts3d.length];
    const p2d1 = pts2d[i], p2d2 = pts2d[(i + 1) % pts2d.length];
    const key = edgeKey3d(p3d1, p3d2);
    if (!map.has(key)) map.set(key, { p1: p2d1, p2: p2d2, top: 0, rx: 0, ly: 0, faceIdxs: [] });
    const e = map.get(key);
    e[type]++;
    e.faceIdxs.push(faceIdx);
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

export function renderIso(solid, opts = {}) {
  const s = opts.scale || 30;

  // --- Bounding box koordinate za viewBox ---
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function trackPt(p) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }

  const W = solid.w, D = solid.d;

  // --- Pod (ground grid) ---
  const groundParts = [];
  const gcorners = [
    isoProject(0, 0, 0, s), isoProject(W, 0, 0, s),
    isoProject(W, D, 0, s), isoProject(0, D, 0, s),
  ];
  gcorners.forEach(trackPt);
  const gpts = gcorners.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  groundParts.push(`<polygon points="${gpts}" fill="#eef2f6"/>`);
  for (let i = 0; i <= W; i++) {
    const p1 = isoProject(i, 0, 0, s), p2 = isoProject(i, D, 0, s);
    trackPt(p1); trackPt(p2);
    groundParts.push(svgLine(p1, p2, "#a0b0be", 0.7, "4,4"));
  }
  for (let j = 0; j <= D; j++) {
    const p1 = isoProject(0, j, 0, s), p2 = isoProject(W, j, 0, s);
    trackPt(p1); trackPt(p2);
    groundParts.push(svgLine(p1, p2, "#a0b0be", 0.7, "4,4"));
  }

  // --- Prikupljanje ploha i bridova ---
  // Svaka ploha se prikuplja samostalno s dubinom svog centra (x+y+z tipa plohe)
  // i tipom plohe (rx=0 < ly=1 < top=2). Sortiramo sve plohe po dubini, a kod
  // jednakih dubina gornje plohe crtamo ZADNJE — tako uvijek pokrivaju bočne
  // plohe susjednih voksela i eliminirano je "krvarenje" kod udubljenosti.
  const TOP_COLOR = "#dde6ef";
  const RX_COLOR  = "#728199";
  const LY_COLOR  = "#9fb3c8";

  const allFaces = []; // { pts, fill, depth, typeOrder, edgeParts: [] }
  const edgeMap  = new Map();

  solid.forEach((x, y, z) => {
    const base = x + y + z + 2; // centar svake plohe voksela ima istu ukupnu dubinu
    // Gornja ploha (+z) — typeOrder 2 (crta se zadnja kod iste dubine).
    if (!solid.has(x, y, z + 1)) {
      const c3d = [[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      const fi = allFaces.length;
      allFaces.push({ pts, fill: TOP_COLOR, depth: base, typeOrder: 2, edgeParts: [] });
      collectEdges(edgeMap, c3d, pts, "top", fi);
    }
    // Desna ploha (+x) — typeOrder 0.
    if (!solid.has(x + 1, y, z)) {
      const c3d = [[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      const fi = allFaces.length;
      allFaces.push({ pts, fill: RX_COLOR, depth: base, typeOrder: 0, edgeParts: [] });
      collectEdges(edgeMap, c3d, pts, "rx", fi);
    }
    // Lijeva ploha (+y) — typeOrder 1.
    if (!solid.has(x, y + 1, z)) {
      const c3d = [[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]];
      const pts = c3d.map(([px,py,pz]) => isoProject(px,py,pz,s));
      pts.forEach(trackPt);
      const fi = allFaces.length;
      allFaces.push({ pts, fill: LY_COLOR, depth: base, typeOrder: 1, edgeParts: [] });
      collectEdges(edgeMap, c3d, pts, "ly", fi);
    }
  });

  // --- Klasifikacija bridova i dodjela licem (3 razine) ---
  // Svaki brid se dodjeljuje plohi s najvećom dubinom (crtanom zadnjom) koja ga sadrži.
  // Time se brid automatski skriva ako ga neka bliža ploha prekrije u 2D projekciji.
  // silhouettes: kinds==1, count==1  → pravi vanjski rub tijela
  // foldLines:   kinds>1             → prijelaz između vrsta ploha — kutovi, stepenice
  // gridLines:   kinds==1, count>=2  → ravna ploha se nastavlja, mreža (crtkano)
  for (const { p1, p2, top, rx, ly, faceIdxs } of edgeMap.values()) {
    const kinds = (top > 0 ? 1 : 0) + (rx > 0 ? 1 : 0) + (ly > 0 ? 1 : 0);
    const count = top + rx + ly;

    let stroke, sw, dash;
    if (kinds > 1 || count === 1) {
      stroke = "#1a2a38"; sw = 2.0; dash = null; // foldLine ili silhouette
    } else {
      stroke = "#7e96a8"; sw = 0.7; dash = "4,4"; // gridLine
    }

    // Pronađi plohу s najvećom (depth, typeOrder) — ona će biti nacrtana zadnja.
    let bestIdx = faceIdxs[0];
    for (const fi of faceIdxs) {
      const a = allFaces[bestIdx], b = allFaces[fi];
      if (b.depth > a.depth || (b.depth === a.depth && b.typeOrder > a.typeOrder))
        bestIdx = fi;
    }
    allFaces[bestIdx].edgeParts.push(svgLine(p1, p2, stroke, sw, dash));
  }

  // Slikarski algoritam po plohi: dalje plohe prvo, kod iste dubine rx→ly→top.
  // Bridovi se crtaju odmah nakon plohe kojoj su dodijeljeni — bliže plohe ih prekrivaju.
  allFaces.sort((a, b) => a.depth - b.depth || a.typeOrder - b.typeOrder);

  const parts = [...groundParts];
  for (const face of allFaces) {
    parts.push(svgPoly(face.pts, face.fill));
    for (const ep of face.edgeParts) parts.push(ep);
  }

  const pad = 16;
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
