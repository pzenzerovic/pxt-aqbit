// renderer3d.js — izometrijski SVG prikaz voksela putem Three.js SVGRenderer.
// SVGRenderer radi pravo rezanje poligona (HSR) pa su udubljenosti ispravne.
//
// Koordinate: naš x=širina, y=dubina, z=visina (z-gore).
// Three.js koristi y-gore, pa mapiramo: naš(x,y,z) → Three(x, z, y).

import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';

// Preslikavanje koordinatnog sustava.
const T = (x, y, z) => [x, z, y];

// Kamera je u smjeru (1,1,1). Lagano pomičemo bridove prema kameri
// (Δ=0.003 po osi) da se sigurno crtaju iznad ploha.
const EDGE_BIAS = 0.003;
const B = ([x, y, z]) => [x + EDGE_BIAS, y + EDGE_BIAS, z + EDGE_BIAS];

function makeQuadGeo(a, b, c, d) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    ...a, ...b, ...c,
    ...a, ...c, ...d,
  ]), 3));
  return geo;
}

// ---- Klasifikacija bridova identična rendereru.js ----
function buildEdgeMap(solid) {
  const map = new Map();

  function addEdge(a, b, type) {
    const ka = a.map(v => v.toFixed(3)).join(',');
    const kb = b.map(v => v.toFixed(3)).join(',');
    const key = ka <= kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!map.has(key)) map.set(key, { a, b, top: 0, rx: 0, ly: 0 });
    map.get(key)[type]++;
  }

  function faceEdges(verts, type) {
    for (let i = 0; i < verts.length; i++)
      addEdge(verts[i], verts[(i + 1) % verts.length], type);
  }

  solid.forEach((x, y, z) => {
    if (!solid.has(x, y, z + 1))
      faceEdges([T(x,y,z+1), T(x+1,y,z+1), T(x+1,y+1,z+1), T(x,y+1,z+1)], 'top');
    if (!solid.has(x + 1, y, z))
      faceEdges([T(x+1,y,z), T(x+1,y+1,z), T(x+1,y+1,z+1), T(x+1,y,z+1)], 'rx');
    if (!solid.has(x, y + 1, z))
      faceEdges([T(x,y+1,z), T(x+1,y+1,z), T(x+1,y+1,z+1), T(x,y+1,z+1)], 'ly');
  });

  return map;
}

function buildScene(solid) {
  const scene = new THREE.Scene();
  const W = solid.w, D = solid.d;

  // --- Pod ---
  // Obrnuti redoslijed za CCW winding gledano iz gornjeg kuta (kamera +y).
  const matGnd = new THREE.MeshBasicMaterial({ color: 0xeef2f6, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(
    makeQuadGeo(T(0,D,0), T(W,D,0), T(W,0,0), T(0,0,0)), matGnd
  ));

  // Mreža poda (bridovi).
  const gPts = [];
  for (let i = 0; i <= W; i++) { gPts.push(...B(T(i,0,0)), ...B(T(i,D,0))); }
  for (let j = 0; j <= D; j++) { gPts.push(...B(T(0,j,0)), ...B(T(W,j,0))); }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gPts), 3));
  scene.add(new THREE.LineSegments(gGeo, new THREE.LineDashedMaterial(
    { color: 0x8fa0b0, linewidth: 0.9, dashSize: 4, gapSize: 4 })));

  // --- Vidljive plohe voksela ---
  const matTop = new THREE.MeshBasicMaterial({ color: 0xdde6ef, side: THREE.DoubleSide });
  const matRx  = new THREE.MeshBasicMaterial({ color: 0x728199, side: THREE.DoubleSide });
  const matLy  = new THREE.MeshBasicMaterial({ color: 0x9fb3c8, side: THREE.DoubleSide });

  solid.forEach((x, y, z) => {
    if (!solid.has(x, y, z + 1))
      scene.add(new THREE.Mesh(makeQuadGeo(
        T(x,y,z+1), T(x+1,y,z+1), T(x+1,y+1,z+1), T(x,y+1,z+1)
      ), matTop));
    if (!solid.has(x + 1, y, z))
      scene.add(new THREE.Mesh(makeQuadGeo(
        T(x+1,y,z), T(x+1,y+1,z), T(x+1,y+1,z+1), T(x+1,y,z+1)
      ), matRx));
    if (!solid.has(x, y + 1, z))
      scene.add(new THREE.Mesh(makeQuadGeo(
        T(x,y+1,z), T(x+1,y+1,z), T(x+1,y+1,z+1), T(x,y+1,z+1)
      ), matLy));
  });

  // --- Bridovi (3 razine debljine + pomak prema kameri) ---
  const silPts = [], foldPts = [], gridPts = [];
  for (const { a, b, top, rx, ly } of buildEdgeMap(solid).values()) {
    const kinds = (top > 0 ? 1 : 0) + (rx > 0 ? 1 : 0) + (ly > 0 ? 1 : 0);
    const count = top + rx + ly;
    if (kinds > 1)       foldPts.push(...B(a), ...B(b));
    else if (count >= 2) gridPts.push(...B(a), ...B(b));
    else                 silPts.push(...B(a), ...B(b));
  }

  function addLines(pts, color, linewidth, dash) {
    if (!pts.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const mat = dash
      ? new THREE.LineDashedMaterial({ color, linewidth, dashSize: dash, gapSize: dash })
      : new THREE.LineBasicMaterial({ color, linewidth });
    scene.add(new THREE.LineSegments(geo, mat));
  }
  // Grid linije (podjele ploha) — crtkano, da se "očitavaju" veličine.
  // Debljine i crtice su u pikselima (vector-effect: non-scaling-stroke u CSS-u).
  addLines(gridPts, 0x8fa0b0, 0.9, 4);
  // Stvarni bridovi tijela — pune, deblje crte.
  addLines(foldPts, 0x2a3a48, 1.7);
  addLines(silPts,  0x14222e, 2.9);

  return scene;
}

// ---- Renderer (singleton) ----
let _r = null;
function getRenderer() {
  if (!_r) _r = new SVGRenderer();
  return _r;
}

export function renderIso(solid) {
  const W = solid.w, D = solid.d, H = solid.h;

  // Analitički izračun frustuma: kamera gleda iz smjera (1,1,1).
  // Horizontalna os kamere: (0.707, 0, -0.707) → raspon = 0.354*(W+D)
  // Vertikalna os kamere: (-0.408, 0.816, -0.408) → raspon = 0.204*(W+D) + 0.408*H
  const viewX = 0.354 * (W + D);
  const viewY = 0.204 * (W + D) + 0.408 * H;
  const frustum = Math.max(viewX, viewY) * 1.3;

  // Centar tijela u Three.js koordinatama (naš x→x, y→z, z→y).
  const cx = W / 2, cy = H / 2, cz = D / 2;
  const dist = 100;

  const camera = new THREE.OrthographicCamera(
    -frustum, frustum, frustum, -frustum, 0.01, 300
  );
  camera.position.set(cx + dist, cy + dist, cz + dist);
  camera.lookAt(cx, cy, cz);
  camera.updateProjectionMatrix();

  const PX = 400;
  const renderer = getRenderer();
  renderer.setSize(PX, PX);

  renderer.render(buildScene(solid), camera);

  // Kloniraj SVG i prilagodi atribute za inline ugradnju.
  // Three.js SVGRenderer centrira putanje na (0,0) bez pomaka,
  // pa viewBox mora pokrivati [-PX/2, PX/2] raspon.
  const clone = renderer.domElement.cloneNode(true);
  clone.setAttribute('class', 'iso');
  clone.setAttribute('viewBox', `-${PX / 2} -${PX / 2} ${PX} ${PX}`);
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  if (clone.style) clone.style.cssText = '';

  return clone.outerHTML;
}
