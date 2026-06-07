# ISONTBgenerator

A browser-based generator of technical drawing practice exercises (Croatian: *nacrt / tlocrt / bokocrt*). Given a 3D voxel solid shown in isometric view, students draw the three standard orthographic projections on a grid. Clicking "Pokaži rješenje" reveals the correct solution.

**Live app:** served from the repository root via GitHub Pages.

```
?seed=12345&perLevel=3     reproducible set (share with students)
?seed=12345&perLevel=5     5 exercises per difficulty level
```

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Coordinate System & ISO Conventions](#coordinate-system--iso-conventions)
4. [Architecture Overview](#architecture-overview)
5. [Module Reference](#module-reference)
   - [voxels.js — Solid](#voxelsjs--solid)
   - [generator.js — Shape Generation](#generatorjs--shape-generation)
   - [renderer.js — SVG Rendering](#rendererjs--svg-rendering)
   - [renderer3d.js — Three.js Renderer (alternative)](#renderer3djs--threejs-renderer-alternative)
   - [app.js — UI Controller](#appjs--ui-controller)
6. [Generator Algorithm Detail](#generator-algorithm-detail)
   - [Difficulty Levels](#difficulty-levels)
   - [carveCorner](#carvecorner)
   - [fillHidden](#fillhidden)
   - [isCutReadable — Filter Rules](#iscutreadable--filter-rules)
7. [Renderer Detail](#renderer-detail)
   - [Isometric projection math](#isometric-projection-math)
   - [Edge classification](#edge-classification)
   - [Hidden-line removal](#hidden-line-removal)
   - [Orthographic views (NTB)](#orthographic-views-ntb)
   - [Edge visibility (solid vs dashed)](#edge-visibility-solid-vs-dashed)
8. [Analysis & Debug Tools](#analysis--debug-tools)
   - [edge-tool.html](#edge-toolhtml)
   - [scripts/ — batch analysis](#scripts--batch-analysis)
9. [Running Tests](#running-tests)
10. [Extending the Generator](#extending-the-generator)

---

## Quick Start

No build step. Serve the directory over HTTP (ES modules require HTTP, not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

Run the automated test suite:

```bash
node test.mjs
```

---

## Project Structure

```
ISONTBgenerator/
├── index.html          Main app entry point
├── style.css           Layout and theming
├── edge-tool.html      Interactive edge-classification debugger
├── package.json        { "type": "module" } — Node ESM for test.mjs
├── test.mjs            Automated test suite (Node.js, no DOM)
│
├── src/
│   ├── voxels.js       Solid data structure (voxel set + connectivity)
│   ├── generator.js    Procedural shape generation + validation rules
│   ├── renderer.js     SVG renderer: isometric + orthographic projections
│   ├── renderer3d.js   Alternative Three.js SVG renderer (not used by default)
│   └── app.js          Web UI: state management, exercise cards, event handlers
│
└── scripts/            Diagnostic Node.js scripts (not used at runtime)
    ├── analyze_rules.mjs       Rule variant testing against known seeds
    ├── analyze_rules2.mjs      Deep-dive shape visualization
    ├── analyze_rules3.mjs      Final verification test suite
    ├── analyze_bad.mjs         Dump structure of rejected shapes
    ├── analyze_batch2.mjs      Batch analysis of specific seed ranges
    └── analyze_compare.mjs     Side-by-side FP vs OK comparison
```

---

## Coordinate System & ISO Conventions

### Voxel coordinate axes

```
         z  (height — straight up)
         │
         │
         └────── x  (width — right-down in ISO view)
        ╱
       y  (depth — left-down in ISO view)
```

- One unit = one voxel = 10 × 10 × 10 cm.
- The origin `(0,0,0)` is the **back-bottom-left** corner of the solid (hidden in ISO).
- After `normalize()` the minimum occupied voxel is always at the origin.

### ISO camera position

Camera is at **(+∞, +∞, +∞)**. The three **visible faces** are:

| Face | Condition | ISO color |
|------|-----------|-----------|
| Top  | `z = h-1` (max z) | light blue `#dde6ef` |
| Right (+x) | `x = w-1` (max x) | dark blue-grey `#728199` |
| Left-front (+y) | `y = d-1` (max y) | medium blue-grey `#9fb3c8` |

The **hidden corner** is at `(0,0,0)` — never carved (it would be invisible from ISO).

### First-angle (European) orthographic layout

```
  Nacrt  (front)  │  Bokocrt (left side)
  ─────────────────┼──────────────────────
  Tlocrt (top)     │  [1st-angle symbol]
```

- **Nacrt** (front view): observer at max-y, looking –y. Columns = x (0→w), rows = z (h→0, top is row 0).
- **Tlocrt** (top view): observer at max-z, looking –z. Columns = x (0→w), rows = y (0→d).
- **Bokocrt** (left side view): observer at max-x, looking –x. Columns = y (d-1→0, reversed so it aligns with nacrt), rows = z (h→0).
- Visible edge → **solid line**; hidden edge → **dashed line**.

---

## Architecture Overview

```
generateSet(seed, perLevel)
        │
        ▼
  generateSolid(level, seed)         ← generator.js
        │  carveCorner × n
        │  fillHidden
        │  isCutReadable (filter)
        ▼
      Solid                           ← voxels.js
        │
        ├──▶ renderIso(solid, opts)   ← renderer.js  → SVG string
        │
        └──▶ renderView(solid, kind, opts)            → SVG string
                  nacrt / tlocrt / bokocrt
```

`app.js` calls `generateSet` once per "Generate new set" click, wraps each exercise's SVG output in HTML cards, and injects them into `<main id="exercises">`.

---

## Module Reference

### voxels.js — Solid

**`class Solid`**

Stores occupied voxels as a `Set` of `"x,y,z"` string keys.

| Property/Method | Description |
|---|---|
| `cells: Set<string>` | Internal set of `"x,y,z"` keys |
| `w, d, h: number` | Bounding-box dimensions (set by `box()` and `normalize()`) |
| `static key(x,y,z)` | Returns `"x,y,z"` string |
| `add(x,y,z)` | Mark voxel as occupied |
| `remove(x,y,z)` | Mark voxel as empty |
| `has(x,y,z): bool` | Query occupancy |
| `get size: number` | Count of occupied voxels |
| `forEach(fn)` | Iterate — calls `fn(x, y, z)` for each occupied voxel |
| `static box(w,d,h): Solid` | Create a fully-filled rectangular block |
| `normalize(): this` | Translate min-corner to origin; update `w,d,h` |
| `isConnected(): bool` | 6-neighbor flood-fill connectivity check |

`normalize()` must be called after any carving before reading `w/d/h` or rendering.

---

### generator.js — Shape Generation

**Exports:** `makeRng`, `generateSolid`, `generateSolidCustom`, `generateSet`, `isCutReadable`

#### `makeRng(seed: number): () => number`

Mulberry32 seedable PRNG. Returns a function that yields floats in [0, 1). Same seed → identical sequence → reproducible exercises. Used by both `generateSolid` and `carveCorner`.

```js
const rng = makeRng(12345);
rng(); // 0.something
```

#### `generateSolid(level: 1|2|3, seed: number): Solid`

Main entry point. Up to 80 attempts; returns fallback `Solid.box(2,2,2)` if all fail.

```js
const solid = generateSolid(2, 42);
```

Algorithm per attempt:
1. Pick random `w, d, h` in range for the level.
2. Create `Solid.box(w,d,h)`.
3. Call `carveCorner` `nCarves` times.
4. `solid.normalize()`.
5. `fillHidden(solid)`.
6. Validate — reject if: size=0, not connected, any dim > 5, size < 2, level>1 and still a full box, or `!isCutReadable(solid)`.

#### `generateSolidCustom({ w, d, h, carves, seed }): Solid`

Same algorithm but with explicit dimensions instead of level-based random dims. Used by the edge-tool and analysis scripts.

#### `generateSet(baseSeed: number, perLevel = 3): Exercise[]`

Generates `perLevel` exercises at each of the 3 difficulty levels (9 total by default), sorted easy→hard.

```js
const exercises = generateSet(12345, 3);
// exercises[i] = { index, level, seed, solid }
```

Seeds are derived as: `(baseSeed + n * 2654435761) >>> 0`.

#### `isCutReadable(solid: Solid): bool`

Validation filter applied to every generated shape. Returns `false` (reject) if any rule fails.

See [isCutReadable — Filter Rules](#iscutreadable--filter-rules) for full detail.

---

### renderer.js — SVG Rendering

**Exports:** `isoModel`, `renderIso`, `renderView`, `viewDims`

#### `isoModel(solid, opts = {}): IsoModel`

Builds the full geometric model for the isometric view. Used by both `renderIso` and `edge-tool.html` (single source of truth for edge classification).

Options: `{ scale: number }` — pixels per voxel unit, default 30.

Returns:
```js
{
  faces: [{ pts: [2D,…], fill: string, depth: number, typeOrder }],
  edges: [{ key, a: [x,y,z], b: [x,y,z], p1: [px,py], p2: [px,py],
            cls: "thick"|"thin", top, rx, ly,
            segments: [[p1,p2],…]  // visible sub-segments after HLR
          }],
  ground: { corners: [2D,…], lines: [[p1,p2],…] },
  bbox: { minX, minY, maxX, maxY },
  scale: number
}
```

#### `renderIso(solid, opts = {}): string`

Returns a complete `<svg>` string for the isometric view.

Options: `{ scale: number, showGrid: bool }`

`showGrid: true` draws a dashed bounding-box cage on all three visible planes, useful for helping students count units.

#### `renderView(solid, kind, opts = {}): string`

Returns a `<svg>` string for one orthographic projection.

- `kind`: `"nacrt"` | `"tlocrt"` | `"bokocrt"`
- Options: `{ cell: number, solution: bool }` — cell size in pixels (default 26); `solution: true` fills occupied cells and draws edges.

In blank mode (`solution: false`) only the helper grid is drawn.

#### `viewDims(solid): { nacrt, tlocrt, bokocrt }`

Returns grid dimensions for all three views:
```js
{ nacrt:   { cols: solid.w, rows: solid.h },
  tlocrt:  { cols: solid.w, rows: solid.d },
  bokocrt: { cols: solid.d, rows: solid.h } }
```

---

### renderer3d.js — Three.js Renderer (alternative)

Not used in production. Requires Three.js (imported via CDN import-map in index.html).

Provides `renderIso(solid, opts)` with the same signature as renderer.js, but uses Three.js `SVGRenderer` for exact hidden-surface removal. The coordinate mapping is `(x,y,z) → Three(x, z, y)` (Three.js is Y-up).

To switch the app to the 3D renderer, change the import in `app.js`:
```js
// import { renderIso, renderView } from "./renderer.js";
import { renderIso } from "./renderer3d.js";
import { renderView } from "./renderer.js";
```

---

### app.js — UI Controller

No exports — self-contained module that runs on `DOMContentLoaded`.

**Key functions (internal):**

| Function | Description |
|---|---|
| `buildState(seed, perLevel, showGrid)` | Returns immutable `{ seed, perLevel, showGrid, exercises }` |
| `render(state)` | Re-renders all exercise cards into `#exercises` |
| `exerciseCard(ex, showGrid)` | HTML for one card: ISO view + blank NTB + hidden solution NTB |
| `ntbBlock(solid, solution)` | 2×2 NTB grid (nacrt, bokocrt, tlocrt, 1st-angle symbol) |
| `firstAngleSymbol()` | SVG of the truncated-cone ISO 5456-2 symbol |
| `syncSeedLabel(seed)` | Updates `#seed-label` in the toolbar |
| `updateUrl(state)` | `history.replaceState` with `?seed=…&perLevel=…` |

**URL parameters parsed on load:**
- `seed` — integer; random if absent
- `perLevel` — integer (1–5); default 3

---

## Generator Algorithm Detail

### Difficulty Levels

```js
const LEVELS = {
  1: { dim: [2, 3], carves: [1, 1], maxCarve: 1 },
  2: { dim: [2, 4], carves: [1, 2], maxCarve: 2 },
  3: { dim: [3, 5], carves: [2, 3], maxCarve: 3 },
};
```

- `dim: [lo, hi]` — each of w, d, h is sampled in `[lo, hi]`
- `carves: [lo, hi]` — number of corner carves sampled in `[lo, hi]`
- `maxCarve` — maximum carve extent per axis (capped at `⌈min(w,d,h)/2⌉`)

### carveCorner

Removes a rectangular block from one of the **7 visible corners** of the bounding box. The hidden corner `(minX, minY, minZ)` — i.e. `(fromMaxX=false, fromMaxY=false, fromMaxZ=false)` — is never chosen, as the ISO camera cannot see cuts there.

```
fromMaxX  fromMaxY  → ISO-visible corner?
false     false     → HIDDEN (never carved)
false     true      ✓ left-front
true      false     ✓ right-back
true      true      ✓ right-front
(any fromMaxZ)      → also controls top vs bottom carve
```

The retry loop runs up to 6 times to avoid picking the hidden corner.

Carve extents per axis: `rx ∈ [1, min(maxExtent, w-1)]` (same for ry, rz).

### fillHidden

After carving, some voxels may be in interior cavities invisible from the ISO camera direction `(+x,+y,+z)`. A voxel at `(x,y,z)` is **exposed** in direction `+x` if `solid.has(x+1..w-1, y, z)` is all false (nothing blocks the line of sight). Similarly for `+y` and `+z`.

If a voxel is empty **and not exposed from any of the three visible directions**, it is refilled. The student cannot see such a cavity from the ISO view and could not know it exists — so the shape must be presented as if it were solid there.

### isCutReadable — Filter Rules

Applied after `fillHidden`. All four rules must pass:

#### Rule D — Complexity limit
```
missing.length  ≤  w × d × h × 0.25
```
At most 25% of the bounding volume may be carved away. Prevents shapes that are more hole than solid, which become ambiguous and hard to draw.

#### Rule E — Outer-face constraint *(most important)*
```
∀ missing voxel (x,y,z):  x == w-1  OR  y == d-1  OR  z == h-1
```
Every empty voxel must lie on at least one **outer visible face** (right face, front face, or top face). A voxel that satisfies none of these conditions is occluded behind solid material in all three ISO projection directions — the student cannot see it and cannot deduce its shape. This rule eliminates the largest class of false positives (interior cuts at hidden corners).

Derivation: the ISO camera at `(+∞,+∞,+∞)` sees a voxel's empty space only if there is a line of sight along `+x`, `+y`, or `+z`. Lying on `x=w-1` guarantees px exposure; `y=d-1` guarantees py; `z=h-1` guarantees pz.

#### Rule A — Component readability
For every connected component of empty voxels, at least one voxel must be **visible from ≥ 2 directions** (px+py, px+pz, or py+pz). This ensures each distinct cut is unambiguously locatable in the projections — a cut visible from only one direction appears in only one orthographic view and cannot be triangulated.

Exposure check: `px` = no solid at `x+1 .. w-1` for same `(y,z)`, etc.

#### Rule C — Lateral face requirement
```
anyPx  OR  anyPy  must be true
```
At least one missing voxel must be visible from the right face (+x) or front face (+y). Rejects cuts that only appear in the top view (tlocrt), which produce degenerate exercises where only the top projection changes.

---

## Renderer Detail

### Isometric projection math

Camera at `(+∞, +∞, +∞)`, standard 30° isometric:

```js
function isoProject(x, y, z, scale) {
  return [
    (x - y) * cos(30°) * scale,
    (x + y) * sin(30°) * scale - z * scale,
  ];
}
```

All face geometry is built in 3D integer coordinates and projected to 2D for SVG output. Edge keys are stored as 3D coordinate pairs (not 2D) to avoid aliasing — two different 3D edges can project to the same 2D line.

### Edge classification

Edges are collected from face polygons. Each edge accumulates counts of which face types contribute it:

- `top` — contributed by a top face (z-constant)
- `rx` — contributed by a right-x face (x-constant)
- `ly` — contributed by a left-y face (y-constant)

Classification logic (`classifyIsoEdge`):

```
kinds = number of distinct face types that share this edge (1..3)
count = total face count sharing this edge

if kinds == 1 and count >= 2:  "thin"  (grid line — plane continues, no fold)
else if kinds > 1 or count == 1:
    isInnerStepEdge? → "thin"   (concave fold or step interior)
    otherwise        → "thick"  (silhouette or convex fold)
```

`isInnerStepEdge` distinguishes concave from convex transitions by checking whether a neighboring voxel fills the inside of the angle. The logic varies by edge orientation (vertical, horizontal-x, horizontal-y) and by which face types are involved.

**Line weights in SVG:**
- Thick (`"thick"`): stroke `#1a2a38`, width 2.0
- Thin (`"thin"`): stroke `#7e96a8`, width 0.7, dasharray `4,4`

### Hidden-line removal

`occluded(solid, P)` — 3D DDA ray traversal from point `P` in direction `(+1,+1,+1)`. Returns `true` if any solid voxel is encountered before leaving the bounding box. Exact voxel traversal (never skips a thin slab).

`visibleSegments(solid, A, B, s, N=24)` — samples edge `A→B` at `N` midpoints; groups consecutive visible samples into sub-segments. Each sub-segment is projected and drawn independently. This eliminates "bleed" of rear edges through front faces in concave shapes.

### Orthographic views (NTB)

`buildView(solid, kind)` computes a `profileAt(col, row)` closure that returns the **depth profile** of each grid cell — an array of depth coordinates for every occupied voxel along the projection axis:

| View | Cols | Rows | Projection axis | `profileAt` returns |
|------|------|------|-----------------|-------------------|
| nacrt | x (0→w) | z (h→0) | y | all y values where `solid.has(x,y,z)` |
| tlocrt | x (0→w) | y (0→d) | z | all z values where `solid.has(x,y,z)` |
| bokocrt | y (d-1→0) | z (h→0) | x | all x values where `solid.has(x,y,z)` |

Note: bokocrt columns run **right-to-left** in y (column 0 = y=d-1) so the view's left edge aligns with nacrt's left edge in the standard first-angle layout.

### Edge visibility (solid vs dashed)

`classifyEdge(profileA, profileB, frontIsMin)` — compares profiles of two adjacent cells:

| Condition | Result |
|-----------|--------|
| Both empty | `null` (no line) |
| One occupied, one empty | `"solid"` (outline) |
| Both occupied, different front depth | `"solid"` (visible step between layers) |
| Both occupied, same front depth, different full profiles | `"dashed"` (hidden step behind front layer) |
| Both occupied, identical profiles | `null` (no visible boundary) |

`frontIsMin = false` for all three views (observer is at *max* coordinate). Front depth = `Math.max(...profile)` (the voxel closest to the observer along the projection axis).

---

## Analysis & Debug Tools

### edge-tool.html

Interactive browser tool for manually validating edge classification. Use it when you suspect `classifyIsoEdge` or `isInnerStepEdge` is mis-classifying edges for a particular shape.

**Workflow:**
1. Set dimensions (Š/D/V inputs) and toggle voxels ON/OFF by clicking cells in the layer grid.
2. Or load a pre-generated exercise by seed (generates 9 exercises; pick one from the dropdown).
3. The ISO view renders with current algorithm classification.
4. Click any edge to cycle its override: `(algorithm)` → `should be THICK` (green) → `should be THIN` (orange) → `(algorithm)`.
5. Click "Izvezi za Claude" to export a structured text report of all disagreements for analysis.

### scripts/ — batch analysis

All scripts are standalone Node.js ESM modules. Run with `node scripts/<name>.mjs`.

| Script | Purpose |
|--------|---------|
| `analyze_compare.mjs` | Print shape ASCII art for a set of FP (user-labeled BAD) and OK borderline seeds side-by-side. Entry point for investigating new batches of false-positives. |
| `analyze_batch2.mjs` | Analyze a specific batch of seeds across 4×3×3, 2×2×2, 3×3×3 shapes. Prints per-shape stats: `miss`, `comps`, `px/py/pz` exposure flags. |
| `analyze_rules.mjs` | Test a candidate set of `isCutReadable` rule variants against a curated list of known-good and known-bad seeds. Outputs precision/recall stats. |
| `analyze_rules2.mjs` | Deep-dive visualization — renders full shape grids with component breakdown and exposure vectors. Used when `analyze_rules.mjs` shows disagreements. |
| `analyze_rules3.mjs` | Final verification pass — runs the current `isCutReadable` against all accumulated known seeds and asserts no regressions. |
| `analyze_bad.mjs` | Dumps detailed structure of shapes that the current filter incorrectly passes (false positives): bounding dimensions, per-component exposure, ASCII z-layers. |

**Adding a new batch for analysis:**

1. Collect seeds and params `{ seed, w, d, h, carves }` from user feedback.
2. Add them to the `FP` (user says BAD) or `OK_BORDER` (borderline) arrays in `analyze_compare.mjs`.
3. Run `node scripts/analyze_compare.mjs` to see shape geometry.
4. Identify which structural property separates the FP shapes from OK shapes.
5. Implement candidate rule in a copy of `isCutReadable` in `analyze_rules.mjs` and test it.
6. Once the rule passes all seeds, add it to `src/generator.js:isCutReadable`.
7. Run `node test.mjs` to confirm no regressions.

---

## Running Tests

```bash
node test.mjs
```

Tests cover:

1. **Set generation** — `generateSet(12345, 3)` returns 9 exercises.
2. **Per-exercise constraints** — each solid: ≥2 voxels, connected, within 5×5×5, renders without error.
3. **Determinism** — `generateSolid(2, 999)` called twice gives identical voxel sets.
4. **Difficulty progression** — level-3 average size > level-1 average over 30 samples.
5. **L-shape projection** — a known L-shaped solid's nacrt has the expected solid edges.
6. **Hidden edge rendering** — a 2×2×2 box with one rear voxel removed shows a dashed edge in nacrt.

---

## Extending the Generator

### Adding a new difficulty level

Add an entry to `LEVELS` in `generator.js`:

```js
const LEVELS = {
  // …
  4: { dim: [4, 6], carves: [3, 4], maxCarve: 3 },
};
```

Update `generateSet` if it uses a hardcoded `level <= 3` bound.

### Adding a new validation rule

Add inside `isCutReadable` after the existing rules. Rules should be fast (they run inside the 80-attempt loop). If the rule is expensive, consider caching intermediate data.

Keep `analyze_compare.mjs` up to date with new FP seeds for regression testing.

### Changing the ISO color scheme

Colors are defined as constants at the top of `renderer.js`:

```js
const TOP_COLOR = "#dde6ef";
const RX_COLOR  = "#728199";
const LY_COLOR  = "#9fb3c8";
```

### Changing the NTB cell size

Pass `cell` option to `renderView`:

```js
renderView(solid, "nacrt", { cell: 32, solution: true })
```

Default is 26 px.

### Adding a fourth orthographic view

`buildView` currently supports `"nacrt"`, `"tlocrt"`, `"bokocrt"`. Add a new branch for e.g. `"bokocrt-desni"` (right-side view, observer at x=0, looking +x — columns = y 0→d-1, rows = z h→0).

### URL sharing

Any call to `updateUrl(state)` encodes `seed` and `perLevel` in the URL. Students can share a specific exercise set by copying the URL. The seed fully determines the shape sequence.

---

## Dependencies

| Dependency | Where | Purpose |
|---|---|---|
| Three.js 0.163.0 | CDN import-map | `renderer3d.js` only (not used by default) |
| Node.js ≥ 18 | dev only | `test.mjs` and `scripts/*.mjs` |

No bundler, no build step, no npm install required for the browser app.
