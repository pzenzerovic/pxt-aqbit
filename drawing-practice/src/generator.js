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

// Ureži kvadar iz jednog od 8 kutova zadanog tijela.
function carveCorner(solid, w, d, h, rng, maxExtent) {
  const fromMaxX = rng() < 0.5;
  const fromMaxY = rng() < 0.5;
  const fromMaxZ = rng() < 0.5;

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

export function generateSolid(level, seed) {
  const cfg = LEVELS[level] || LEVELS[1];
  const rng = makeRng(seed);

  for (let attempt = 0; attempt < 80; attempt++) {
    const w = randInt(rng, cfg.dim[0], cfg.dim[1]);
    const d = randInt(rng, cfg.dim[0], cfg.dim[1]);
    const h = randInt(rng, cfg.dim[0], cfg.dim[1]);

    const solid = Solid.box(w, d, h);
    const fullCount = w * d * h;

    const nCarves = randInt(rng, cfg.carves[0], cfg.carves[1]);
    for (let i = 0; i < nCarves; i++) {
      carveCorner(solid, w, d, h, rng, cfg.maxCarve);
    }

    solid.normalize();

    // Uvjeti valjanosti.
    if (solid.size === 0) continue;
    if (!solid.isConnected()) continue;
    if (solid.w > 5 || solid.d > 5 || solid.h > 5) continue;
    // Za razine > 1 traži da nešto bude izrezano (da nije puni kvadar).
    if (level > 1 && solid.size === fullCount) continue;
    // Izbjegni predegenerirane (premale) oblike.
    if (solid.size < 2) continue;

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
