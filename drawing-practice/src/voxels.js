// voxels.js — model tijela sastavljenog od jediničnih kocaka (voksela).
// Koordinatni sustav:
//   x = širina  (u izometriji ide desno-dolje)
//   y = dubina  (u izometriji ide lijevo-dolje)
//   z = visina  (u izometriji ide ravno gore)
// Jedna jedinica = jedna kocka = 10×10×10 cm.

export class Solid {
  constructor() {
    this.cells = new Set(); // ključevi "x,y,z"
    this.w = 0; // dimenzija po x
    this.d = 0; // dimenzija po y
    this.h = 0; // dimenzija po z
  }

  static key(x, y, z) {
    return x + "," + y + "," + z;
  }

  add(x, y, z) {
    this.cells.add(Solid.key(x, y, z));
  }

  remove(x, y, z) {
    this.cells.delete(Solid.key(x, y, z));
  }

  has(x, y, z) {
    return this.cells.has(Solid.key(x, y, z));
  }

  get size() {
    return this.cells.size;
  }

  forEach(fn) {
    for (const k of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      fn(x, y, z);
    }
  }

  // Vrati popunjeni kvadar zadanih dimenzija.
  static box(w, d, h) {
    const s = new Solid();
    for (let x = 0; x < w; x++)
      for (let y = 0; y < d; y++)
        for (let z = 0; z < h; z++) s.add(x, y, z);
    s.w = w;
    s.d = d;
    s.h = h;
    return s;
  }

  // Pomakni tijelo tako da mu je najmanji kut u ishodištu i izračunaj dimenzije.
  normalize() {
    if (this.cells.size === 0) {
      this.w = this.d = this.h = 0;
      return this;
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    this.forEach((x, y, z) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    });
    const shifted = new Set();
    this.forEach((x, y, z) => {
      shifted.add(Solid.key(x - minX, y - minY, z - minZ));
    });
    this.cells = shifted;
    this.w = maxX - minX + 1;
    this.d = maxY - minY + 1;
    this.h = maxZ - minZ + 1;
    return this;
  }

  // Provjeri je li tijelo povezano (6-susjedstvo).
  isConnected() {
    if (this.cells.size === 0) return false;
    const start = this.cells.values().next().value;
    const seen = new Set([start]);
    const stack = [start];
    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];
    while (stack.length) {
      const [x, y, z] = stack.pop().split(",").map(Number);
      for (const [dx, dy, dz] of dirs) {
        const k = Solid.key(x + dx, y + dy, z + dz);
        if (this.cells.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    return seen.size === this.cells.size;
  }
}
