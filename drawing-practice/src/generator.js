// generator.js — proceduralno generiranje tijela ("lego" pristup).
// Postupak: popuni kvadar → ureži nekoliko kutova → provjeri valjanost.

import { Solid } from "./voxels.js";

// Seedabilni RNG (mulberry32) — isti seed daje isti zadatak (dijeljenje preko URL-a).
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// Parametri po razini težine.
const LEVELS = {
  1: { dim: [2, 3], carves: [1, 1], maxCarve: 1 },
  2: { dim: [2, 4], carves: [1, 2], maxCarve: 2 },
  3: { dim: [3, 5], carves: [2, 3], maxCarve: 3 },
};

// Ureži kvadar iz jednog od 7 vidljivih kutova tijela.
// Kut (minX, minY, minZ) je uvijek skriven od izometrijskog gledišta (+X+Y+Z smjer)
// pa ga nikad ne urežemo — korisnik bi vidio puni blok ali ne i urez.
function carveCorner(solid, w, d, h, rng, maxExtent) {
  let fromMaxX, fromMaxY, fromMaxZ;
  // Odbaci jedinu skrivenu kombinaciju (sve tri min) — pokušaj do 6 puta.
  for (let t = 0; t < 6; t++) {
    fromMaxX = rng() < 0.5;
    fromMaxY = rng() < 0.5;
    fromMaxZ = rng() < 0.5;
    if (fromMaxX || fromMaxY || fromMaxZ) break;
  }

  // Veličina ureza po svakoj osi: barem 1, najviše dim-1 (da ostane materijala).
  const rx = randInt(rng, 1, Math.min(maxExtent, w - 1));
  const ry = randInt(rng, 1, Math.min(maxExtent, d - 1));
  const rz = randInt(rng, 1, Math.min(maxExtent, h - 1));

  const x0 = fromMaxX ? w - rx : 0;
  const y0 = fromMaxY ? d - ry : 0;
  const z0 = fromMaxZ ? h - rz : 0;

  for (let x = x0; x < x0 + rx; x++)
    for (let y = y0; y < y0 + ry; y++)
      for (let z = z0; z < z0 + rz; z++) solid.remove(x, y, z);
}

// Provjeri je li izrezani dio metodički smislen za vježbu projekcija.
// D: odrezano smije biti najviše 25 % volumena (složeniji urezi su neodredivi).
// A: svaka povezana komponenta praznih ćelija mora imati barem jednu ćeliju
//    vidljivu iz ≥2 smjera — osigurava čitljivost svakog ureza zasebno.
// C: barem jedna bočna ploha (+x ili +y) mora biti zastupljena u izloženosti.
function isCutReadable(solid) {
  const { w, d, h } = solid;
  const missing = [];
  for (let x = 0; x < w; x++)
    for (let y = 0; y < d; y++)
      for (let z = 0; z < h; z++)
        if (!solid.has(x, y, z)) missing.push([x, y, z]);

  if (missing.length === 0) return true;

  // Rule D: complexity limit — max 25% of bounding volume
  if (missing.length > w * d * h * 0.25) return false;

  // Rule A: every connected component has a voxel visible from 2+ directions
  const missingSet = new Set(missing.map(([x, y, z]) => x + "," + y + "," + z));
  const visited = new Set();
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const [sx, sy, sz] of missing) {
    const key = sx + "," + sy + "," + sz;
    if (visited.has(key)) continue;
    const comp = [];
    const stack = [[sx, sy, sz]];
    visited.add(key);
    while (stack.length) {
      const [x, y, z] = stack.pop();
      comp.push([x, y, z]);
      for (const [dx, dy, dz] of dirs) {
        const k = (x + dx) + "," + (y + dy) + "," + (z + dz);
        if (missingSet.has(k) && !visited.has(k)) { visited.add(k); stack.push([x + dx, y + dy, z + dz]); }
      }
    }
    const readable = comp.some(([x, y, z]) => {
      let px = true, py = true, pz = true;
      for (let xx = x + 1; xx < w; xx++) if (solid.has(xx, y, z)) { px = false; break; }
      for (let yy = y + 1; yy < d; yy++) if (solid.has(x, yy, z)) { py = false; break; }
      for (let zz = z + 1; zz < h; zz++) if (solid.has(x, y, zz)) { pz = false; break; }
      return (px ? 1 : 0) + (py ? 1 : 0) + (pz ? 1 : 0) >= 2;
    });
    if (!readable) return false;
  }

  // Rule C: at least one lateral face (+x or +y) represented
  let anyPx = false, anyPy = false;
  for (const [x, y, z] of missing) {
    if (!anyPx) { let ok = true; for (let xx = x + 1; xx < w; xx++) if (solid.has(xx, y, z)) { ok = false; break; } if (ok) anyPx = true; }
    if (!anyPy) { let ok = true; for (let yy = y + 1; yy < d; yy++) if (solid.has(x, yy, z)) { ok = false; break; } if (ok) anyPy = true; }
    if (anyPx && anyPy) break;
  }
  if (!anyPx && !anyPy) return false;

  return true;
}

// Popuni svaku skrivenu šupljinu — što korisnik ne vidi iz izometrije,
// mora biti puno (jer ne može pretpostaviti drugačije).
// Prazna ćelija je "vidljiva" ako je nezaklonjena gledano niz +x, +y ili +z
// (tri plohe vidljive u izometriji). Ako nije izložena nijednoj od njih,
// to je skrivena šupljina sa stražnje strane → popuni je.
function fillHidden(solid) {
  const { w, d, h } = solid;
  const toFill = [];
  for (let x = 0; x < w; x++)
    for (let y = 0; y < d; y++)
      for (let z = 0; z < h; z++) {
        if (solid.has(x, y, z)) continue;
        let ex = true;
        for (let xx = x + 1; xx < w; xx++) if (solid.has(xx, y, z)) { ex = false; break; }
        let ey = true;
        for (let yy = y + 1; yy < d; yy++) if (solid.has(x, yy, z)) { ey = false; break; }
        let ez = true;
        for (let zz = z + 1; zz < h; zz++) if (solid.has(x, y, zz)) { ez = false; break; }
        if (!ex && !ey && !ez) toFill.push([x, y, z]);
      }
  for (const [x, y, z] of toFill) solid.add(x, y, z);
}

export function generateSolid(level, seed) {
  const cfg = LEVELS[level] || LEVELS[1];
  const rng = makeRng(seed);

  for (let attempt = 0; attempt < 80; attempt++) {
    const w = randInt(rng, cfg.dim[0], cfg.dim[1]);
    const d = randInt(rng, cfg.dim[0], cfg.dim[1]);
    const h = randInt(rng, cfg.dim[0], cfg.dim[1]);

    const solid = Solid.box(w, d, h);

    const nCarves = randInt(rng, cfg.carves[0], cfg.carves[1]);
    for (let i = 0; i < nCarves; i++) {
      carveCorner(solid, w, d, h, rng, cfg.maxCarve);
    }

    solid.normalize();

    // Popuni skrivene šupljine (stražnja strana mora biti puna).
    fillHidden(solid);

    // Uvjeti valjanosti.
    if (solid.size === 0) continue;
    if (!solid.isConnected()) continue;
    if (solid.w > 5 || solid.d > 5 || solid.h > 5) continue;
    if (solid.size < 2) continue;
    if (level > 1 && solid.size === solid.w * solid.d * solid.h) continue;
    // Rez mora biti metodički čitljiv: vidljiv odozgo i kao jedna cjelovita regija.
    if (!isCutReadable(solid)) continue;

    return solid;
  }

  // Fallback: jednostavan kvadar ako algoritam ne uspije.
  return Solid.box(2, 2, 2);
}

// Generiraj cijeli set zadataka: po `perLevel` zadataka za svaku razinu, sortirano lako→teško.
export function generateSet(baseSeed, perLevel = 3) {
  const exercises = [];
  let n = 1;
  for (let level = 1; level <= 3; level++) {
    for (let i = 0; i < perLevel; i++) {
      const seed = (baseSeed + n * 2654435761) >>> 0;
      exercises.push({
        index: n,
        level,
        seed,
        solid: generateSolid(level, seed),
      });
      n++;
    }
  }
  return exercises;
}
