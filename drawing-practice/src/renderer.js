// renderer.js — pretvara model tijela u SVG: izometrijski prikaz i NTB projekcije.

import { Solid } from "./voxels.js";

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6); // = 0.5

// ---------------------------------------------------------------------------
// IZOMETRIJA
// ---------------------------------------------------------------------------

// Projekcija točke iz prostora kocaka u 2D (ekran: +y prema dolje).
function iso(cx, cy, cz, s) {
  return [
    (cx - cy) * COS30 * s,
    (cx + cy) * SIN30 * s - cz * s,
  ];
}

// Sakupljač točaka radi izračuna viewBox-a.
function bounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  return {
    add(p) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    },
    get() {
      return { minX, minY, maxX, maxY };
    },
  };
}

function poly(points, fill, stroke, sw) {
  const pts = points.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

function line(p1, p2, stroke, sw, dash) {
  const d = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" stroke="${stroke}" stroke-width="${sw}"${d}/>`;
}

export function renderIso(solid, opts = {}) {
  const s = opts.scale || 30;
  const b = bounds();
  const body = [];
  const floorLines = [];

  const W = solid.w, D = solid.d;

  // Pod (grid) na z=0 — predočuje mjerilo (1 kocka = 10 cm).
  // Svijetla podloga.
  const fc = [
    iso(0, 0, 0, s), iso(W, 0, 0, s), iso(W, D, 0, s), iso(0, D, 0, s),
  ];
  fc.forEach((p) => b.add(p));
  floorLines.push(poly(fc, "#f4f6f8", "none", 0));

  for (let i = 0; i <= W; i++) {
    const p1 = iso(i, 0, 0, s), p2 = iso(i, D, 0, s);
    b.add(p1); b.add(p2);
    floorLines.push(line(p1, p2, "#c4ccd6", 1));
  }
  for (let j = 0; j <= D; j++) {
    const p1 = iso(0, j, 0, s), p2 = iso(W, j, 0, s);
    b.add(p1); b.add(p2);
    floorLines.push(line(p1, p2, "#c4ccd6", 1));
  }

  // Vidljive plohe svakog voksela, crtano straga-prema-naprijed (slikarski algoritam).
  const cells = [];
  solid.forEach((x, y, z) => cells.push([x, y, z]));
  cells.sort((a, b2) => (a[0] + a[1] + a[2]) - (b2[0] + b2[1] + b2[2]));

  const TOP = "#dde6ef", LEFT = "#9fb3c8", RIGHT = "#728199";
  const EDGE = "#2b3a4a", EW = 1.1;

  for (const [x, y, z] of cells) {
    // GORNJA ploha (+z): vidljiva ako nema voksela iznad.
    if (!solid.has(x, y, z + 1)) {
      const p = [
        iso(x, y, z + 1, s), iso(x + 1, y, z + 1, s),
        iso(x + 1, y + 1, z + 1, s), iso(x, y + 1, z + 1, s),
      ];
      p.forEach((q) => b.add(q));
      body.push(poly(p, TOP, EDGE, EW));
    }
    // DESNA ploha (+x).
    if (!solid.has(x + 1, y, z)) {
      const p = [
        iso(x + 1, y, z, s), iso(x + 1, y + 1, z, s),
        iso(x + 1, y + 1, z + 1, s), iso(x + 1, y, z + 1, s),
      ];
      p.forEach((q) => b.add(q));
      body.push(poly(p, RIGHT, EDGE, EW));
    }
    // LIJEVA ploha (+y).
    if (!solid.has(x, y + 1, z)) {
      const p = [
        iso(x, y + 1, z, s), iso(x + 1, y + 1, z, s),
        iso(x + 1, y + 1, z + 1, s), iso(x, y + 1, z + 1, s),
      ];
      p.forEach((q) => b.add(q));
      body.push(poly(p, LEFT, EDGE, EW));
    }
  }

  const pad = 14;
  const { minX, minY, maxX, maxY } = b.get();
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;
  const vb = `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;

  return `<svg class="iso" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${floorLines.join("\n")}
    ${body.join("\n")}
  </svg>`;
}

// ---------------------------------------------------------------------------
// NTB PROJEKCIJE (Nacrt / Tlocrt / Bokocrt) — Mongeova projekcija, 1. kvadrant
// ---------------------------------------------------------------------------
//
// Za svaki pogled gradimo 2D mrežu (cols × rows), gdje red 0 = VRH nacrtane mreže.
// Za svaku ćeliju imamo "profil" = skup dubina na kojima je tijelo popunjeno.
// Bridove crtamo na linijama mreže: pun brid = vidljiv, isprekidan = skriven.

// Sagradi opis pogleda: occupancy + profil + funkciju "prednje" dubine.
function buildView(solid, kind) {
  const W = solid.w, D = solid.d, H = solid.h;
  let cols, rows, profileAt, frontIsMin;

  if (kind === "nacrt") {
    // Pogled sprijeda (prema +y). col=x, row=(H-1-z). dubina=y, prednje=min y.
    cols = W; rows = H; frontIsMin = true;
    profileAt = (c, r) => {
      const x = c, z = H - 1 - r, set = [];
      for (let y = 0; y < D; y++) if (solid.has(x, y, z)) set.push(y);
      return set;
    };
  } else if (kind === "tlocrt") {
    // Pogled odozgo (prema -z). col=x, row=y. dubina=z, prednje=max z.
    cols = W; rows = D; frontIsMin = false;
    profileAt = (c, r) => {
      const x = c, y = r, set = [];
      for (let z = 0; z < H; z++) if (solid.has(x, y, z)) set.push(z);
      return set;
    };
  } else {
    // Bokocrt — pogled slijeva (prema +x). col=y, row=(H-1-z). dubina=x, prednje=min x.
    cols = D; rows = H; frontIsMin = true;
    profileAt = (c, r) => {
      const y = c, z = H - 1 - r, set = [];
      for (let x = 0; x < W; x++) if (solid.has(x, y, z)) set.push(x);
      return set;
    };
  }
  return { cols, rows, profileAt, frontIsMin };
}

function frontDepth(profile, frontIsMin) {
  if (profile.length === 0) return null;
  return frontIsMin ? Math.min(...profile) : Math.max(...profile);
}

function sameProfile(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// Klasificiraj brid mreže između dvije susjedne ćelije.
// Vrati: "solid" | "dashed" | null
function classifyEdge(pa, pb, frontIsMin) {
  const occA = pa.length > 0, occB = pb.length > 0;
  if (!occA && !occB) return null;            // prazno s obje strane
  if (occA !== occB) return "solid";          // rub silhuete (obris)
  // Obje popunjene:
  const fa = frontDepth(pa, frontIsMin), fb = frontDepth(pb, frontIsMin);
  if (fa !== fb) return "solid";              // vidljiva stepenica na prednjoj plohi
  if (!sameProfile(pa, pb)) return "dashed";  // razlika je iza → skriveni brid
  return null;                                // ploha se nastavlja glatko
}

// Renderiraj jedan pogled. opts.solution = true crta tijelo; inače prazna mreža.
export function renderView(solid, kind, opts = {}) {
  const cs = opts.cell || 26;
  const view = buildView(solid, kind);
  const { cols, rows, profileAt, frontIsMin } = view;
  const w = cols * cs, h = rows * cs;
  const pad = 6;
  const parts = [];

  // Profili svih ćelija (predračun).
  const prof = [];
  for (let r = 0; r < rows; r++) {
    prof[r] = [];
    for (let c = 0; c < cols; c++) prof[r][c] = profileAt(c, r);
  }

  // Pomoćna mreža (uvijek vidljiva, svijetla).
  for (let c = 0; c <= cols; c++)
    parts.push(line([c * cs, 0], [c * cs, h], "#dfe3e8", 1));
  for (let r = 0; r <= rows; r++)
    parts.push(line([0, r * cs], [w, r * cs], "#dfe3e8", 1));

  if (opts.solution) {
    // Svijetlo ispuni popunjene ćelije (pomaže čitljivosti).
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (prof[r][c].length > 0)
          parts.push(`<rect x="${c * cs}" y="${r * cs}" width="${cs}" height="${cs}" fill="#eef2f6"/>`);

    const SOLID = "#1f2d3d", DASH = "#1f2d3d", SW = 2;

    // Vertikalni bridovi (granica između stupca c-1 i c, za sve redove).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const pa = c - 1 >= 0 ? prof[r][c - 1] : [];
        const pb = c < cols ? prof[r][c] : [];
        const cls = classifyEdge(pa, pb, frontIsMin);
        if (cls) {
          parts.push(line([c * cs, r * cs], [c * cs, (r + 1) * cs],
            SOLID, SW, cls === "dashed" ? "4,3" : null));
        }
      }
    }
    // Horizontalni bridovi (granica između reda r-1 i r, za sve stupce).
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r <= rows; r++) {
        const pa = r - 1 >= 0 ? prof[r - 1][c] : [];
        const pb = r < rows ? prof[r][c] : [];
        const cls = classifyEdge(pa, pb, frontIsMin);
        if (cls) {
          parts.push(line([c * cs, r * cs], [(c + 1) * cs, r * cs],
            SOLID, SW, cls === "dashed" ? "4,3" : null));
        }
      }
    }
  }

  const vb = `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`;
  return `<svg class="view" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join("")}</svg>`;
}

// Vrati dimenzije pogleda u ćelijama (za naslove/raspored).
export function viewDims(solid) {
  return {
    nacrt: { cols: solid.w, rows: solid.h },
    tlocrt: { cols: solid.w, rows: solid.d },
    bokocrt: { cols: solid.d, rows: solid.h },
  };
}
