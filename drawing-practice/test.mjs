// Brzi test logike (Node ESM): generiranje + render bez DOM-a.
import { Solid } from "./src/voxels.js";
import { generateSet, generateSolid } from "./src/generator.js";
import { renderIso, renderView, viewDims } from "./src/renderer.js";

let fail = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); fail++; }
}

// 1) Generiranje seta
const set = generateSet(12345, 3);
assert(set.length === 9, "set ima 9 zadataka, dobiveno " + set.length);

for (const ex of set) {
  const s = ex.solid;
  assert(s.size >= 2, `zadatak ${ex.index}: barem 2 kocke`);
  assert(s.isConnected(), `zadatak ${ex.index}: povezano`);
  assert(s.w <= 5 && s.d <= 5 && s.h <= 5, `zadatak ${ex.index}: u 5x5x5`);
  // render ne smije baciti i mora dati neprazan SVG
  const iso = renderIso(s);
  assert(iso.includes("<svg") && iso.includes("polygon"), `zadatak ${ex.index}: iso svg`);
  for (const v of ["nacrt", "tlocrt", "bokocrt"]) {
    const empty = renderView(s, v, { solution: false });
    const sol = renderView(s, v, { solution: true });
    assert(empty.includes("<svg"), `zadatak ${ex.index} ${v}: prazni svg`);
    assert(sol.includes("<svg"), `zadatak ${ex.index} ${v}: rješenje svg`);
  }
}

// 2) Determinizam — isti seed = isti oblik
const a = generateSolid(2, 999), b = generateSolid(2, 999);
assert(a.size === b.size && [...a.cells].sort().join("|") === [...b.cells].sort().join("|"),
  "determinizam: isti seed daje isti oblik");

// 3) Razine težine rastu po složenosti (gruba provjera dimenzija)
let l1 = 0, l3 = 0;
for (let i = 0; i < 30; i++) {
  l1 += generateSolid(1, 1000 + i).size;
  l3 += generateSolid(3, 2000 + i).size;
}
assert(l3 > l1, `razina 3 prosječno veća (${l3}) od razine 1 (${l1})`);

// 4) Provjera projekcije na poznatom obliku: L-oblik u XZ ravnini, dubina 1.
//    Kocke: stupac visine 2 na x=0, te baza na x=1 (visina 1). Dubina y=0..1.
const L = new Solid();
for (let y = 0; y < 2; y++) {
  L.add(0, y, 0); L.add(0, y, 1); // lijevi stup, visina 2
  L.add(1, y, 0);                 // desna baza, visina 1
}
L.normalize();
assert(L.w === 2 && L.d === 2 && L.h === 2, `L dims 2x2x2, dobiveno ${L.w}x${L.d}x${L.h}`);
const dims = viewDims(L);
assert(dims.nacrt.cols === 2 && dims.nacrt.rows === 2, "L nacrt 2x2");
const nacrt = renderView(L, "nacrt", { solution: true });
// Nacrt L-oblika treba imati i pune i (moguće) bridove; bar nekoliko linija s debljinom 2.
const solidEdges = (nacrt.match(/stroke-width="2"/g) || []).length;
assert(solidEdges > 0, "L nacrt ima bridove tijela");

// 5) Skriveni brid: kvadar 2x2x2 s urezom straga (na y=1) koji je nevidljiv sprijeda.
const H = Solid.box(2, 2, 2);
H.remove(0, 1, 1); // ukloni jednu stražnju gornju kocku
H.normalize();
const nacrtH = renderView(H, "nacrt", { solution: true });
const hasDash = nacrtH.includes('stroke-dasharray');
assert(hasDash, "urez straga daje isprekidani (skriveni) brid u nacrtu");

console.log(fail === 0 ? "\nSVE PROŠLO ✅" : `\n${fail} GREŠAKA ❌`);
process.exit(fail === 0 ? 0 : 1);
