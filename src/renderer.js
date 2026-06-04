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

// Ključ za brid: zaokruži koordinate i sortiraj krajnje točke abecedno.
function edgeKey(p1, p2) {
  const s1 = p1[0].toFixed(2) + "," + p1[1].toFixed(2);
  const s2 = p2[0].toFixed(2) + "," + p2[1].toFixed(2);
  return s1 <= s2 ? s1 + "|" + s2 : s2 + "|" + s1;
}

// Dodaj sve bridove poligona u mapu, grupirano po tipu plohe.
function collectEdges(map, points, type) {
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const key = edgeKey(p1, p2);
    if (!map.has(key)) map.set(key, { p1, p2, top: 0, rx: 0, ly: 0 });
    map.get(key)[type]++;
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
    groundParts.push(svgLine(p1, p2, "#c4ccd6", 0.7));
  }
  for (let j = 0; j <= D; j++) {
    const p1 = isoProject(0, j, 0, s), p2 = isoProject(W, j, 0, s);
    trackPt(p1); trackPt(p2);
    groundParts.push(svgLine(p1, p2, "#c4ccd6", 0.7));
  }

  // --- Prikupljanje ploha i bridova ---
  const cells = [];
  solid.forEach((x, y, z) => cells.push([x, y, z]));
  // Slikarski algoritam: crtaj od dalekih prema bliskim (manji x+y+z = dalje).
  cells.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));

  const TOP_COLOR = "#dde6ef";
  const RX_COLOR  = "#728199"; // desna ploha (+x)
  const LY_COLOR  = "#9fb3c8"; // lijeva ploha (+y)

  const faceParts = [];
  const edgeMap   = new Map();

  for (const [x, y, z] of cells) {
    // Gornja ploha (+z).
    if (!solid.has(x, y, z + 1)) {
      const pts = [
        isoProject(x,   y,   z+1, s),
        isoProject(x+1, y,   z+1, s),
        isoProject(x+1, y+1, z+1, s),
        isoProject(x,   y+1, z+1, s),
      ];
      pts.forEach(trackPt);
      faceParts.push(svgPoly(pts, TOP_COLOR));
      collectEdges(edgeMap, pts, "top");
    }
    // Desna ploha (+x).
    if (!solid.has(x + 1, y, z)) {
      const pts = [
        isoProject(x+1, y,   z,   s),
        isoProject(x+1, y+1, z,   s),
        isoProject(x+1, y+1, z+1, s),
        isoProject(x+1, y,   z+1, s),
      ];
      pts.forEach(trackPt);
      faceParts.push(svgPoly(pts, RX_COLOR));
      collectEdges(edgeMap, pts, "rx");
    }
    // Lijeva ploha (+y).
    if (!solid.has(x, y + 1, z)) {
      const pts = [
        isoProject(x,   y+1, z,   s),
        isoProject(x+1, y+1, z,   s),
        isoProject(x+1, y+1, z+1, s),
        isoProject(x,   y+1, z+1, s),
      ];
      pts.forEach(trackPt);
      faceParts.push(svgPoly(pts, LY_COLOR));
      collectEdges(edgeMap, pts, "ly");
    }
  }

  // --- Klasifikacija bridova (3 razine) ---
  // silhouettes: kinds==1, count==1  → pravi vanjski rub tijela (debelo)
  // foldLines:   kinds>1             → prijelaz između vrsta ploha — vanjski kutovi
  //                                    i unutarnje stepenice na udubljenima (srednje)
  // gridLines:   kinds==1, count>=2  → ravna ploha se nastavlja, samo mreža (tanko)
  const gridLines   = [];
  const foldLines   = [];
  const silhouettes = [];

  for (const { p1, p2, top, rx, ly } of edgeMap.values()) {
    const kinds = (top > 0 ? 1 : 0) + (rx > 0 ? 1 : 0) + (ly > 0 ? 1 : 0);
    if (kinds > 1) {
      foldLines.push([p1, p2]);
    } else {
      const count = top + rx + ly;
      if (count >= 2) gridLines.push([p1, p2]);
      else silhouettes.push([p1, p2]);
    }
  }

  const parts = [
    ...groundParts,
    ...faceParts,
    // Mreža iste plohe (najlakše).
    ...gridLines.map(([p1, p2]) =>
      svgLine(p1, p2, "rgba(43,58,74,0.18)", 0.5)),
    // Prijelaz između vrsta ploha — kutovi i stepenice (srednje).
    ...foldLines.map(([p1, p2]) =>
      svgLine(p1, p2, "rgba(43,58,74,0.65)", 1.0)),
    // Pravi vanjski rub tijela (najteže).
    ...silhouettes.map(([p1, p2]) =>
      svgLine(p1, p2, "#2b3a4a", 1.8)),
  ];

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
    // Pogled sprijeda: promatrač na min-y, gleda prema +y. Prikaz: x→, z↑.
    cols = W; rows = H; frontIsMin = true;
    profileAt = (c, r) => {
      const x = c, z = H - 1 - r;
      const arr = [];
      for (let y = 0; y < D; y++) if (solid.has(x, y, z)) arr.push(y);
      return arr;
    };
  } else if (kind === "tlocrt") {
    // Pogled odozgo: promatrač na max-z, gleda prema -z. Prikaz: x→, y↓.
    cols = W; rows = D; frontIsMin = false;
    profileAt = (c, r) => {
      const x = c, y = r;
      const arr = [];
      for (let z = 0; z < H; z++) if (solid.has(x, y, z)) arr.push(z);
      return arr;
    };
  } else {
    // Bokocrt lijevi: promatrač na min-x, gleda prema +x. Prikaz: y→, z↑.
    // U 1. kvadrantu: smješta se DESNO od nacrta.
    cols = D; rows = H; frontIsMin = true;
    profileAt = (c, r) => {
      const y = c, z = H - 1 - r;
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
