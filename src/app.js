// app.js — sastavljanje radne bilježnice: generiranje seta, prikaz i navigacija.

import { generateSet } from "./generator.js";
import { renderIso, renderView } from "./renderer.js";

const LEVEL_NAMES = { 1: "Lako", 2: "Srednje", 3: "Teško" };

// ISO 5456-2, prvo kutno projiciranje (1. kvadrant / europska metoda):
//   Nacrt   | Bokocrt (lijevi, desno od nacrta)
//   Tlocrt  |
// Symbol 1. kvadranta (krnji stožac, pogled s desna→lijevo) prikazan u footeru.
function ntbBlock(solid, solution) {
  const opts = { solution };
  return `
    <div class="ntb">
      <div class="cell nacrt">
        <span class="vlabel">Nacrt</span>
        ${renderView(solid, "nacrt", opts)}
      </div>
      <div class="cell bokocrt">
        <span class="vlabel">Bokocrt</span>
        ${renderView(solid, "bokocrt", opts)}
      </div>
      <div class="cell tlocrt">
        <span class="vlabel">Tlocrt</span>
        ${renderView(solid, "tlocrt", opts)}
      </div>
      <div class="cell spacer">
        ${solution ? firstAngleSymbol() : ""}
      </div>
    </div>`;
}

// SVG simbol prvog kutnog projiciranja (ISO, krnji stožac).
function firstAngleSymbol() {
  return `<svg class="angle-symbol" viewBox="0 0 52 30" xmlns="http://www.w3.org/2000/svg" title="Prvo kutno projiciranje (ISO 5456-2)">
    <ellipse cx="10" cy="15" rx="8" ry="12" fill="none" stroke="#6b7886" stroke-width="1.5"/>
    <path d="M18 3 L42 3 L42 27 L18 27" fill="none" stroke="#6b7886" stroke-width="1.5"/>
    <ellipse cx="42" cy="15" rx="3.5" ry="12" fill="none" stroke="#6b7886" stroke-width="1.5"/>
  </svg>`;
}

function exerciseCard(ex) {
  const { index, level, solid } = ex;
  return `
    <article class="card" data-level="${level}">
      <header class="card-head">
        <span class="num">Zadatak ${index}</span>
        <span class="badge lvl-${level}">${LEVEL_NAMES[level]}</span>
      </header>
      <div class="card-body">
        <div class="iso-wrap">
          <div class="iso-title">Zadano tijelo (izometrija)</div>
          ${renderIso(solid)}
          <div class="scale-note">1 kocka = 10 × 10 × 10 cm</div>
        </div>
        <div class="ntb-wrap">
          <div class="ntb-title">Nacrtaj projekcije</div>
          ${ntbBlock(solid, false)}
        </div>
      </div>
      <div class="solution" hidden>
        <div class="ntb-title">Rješenje</div>
        ${ntbBlock(solid, true)}
      </div>
      <footer class="card-foot">
        <button class="toggle-sol" type="button">Pokaži rješenje</button>
      </footer>
    </article>`;
}

function render(state) {
  const root = document.getElementById("exercises");
  root.innerHTML = state.exercises.map(exerciseCard).join("");

  root.querySelectorAll(".toggle-sol").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const sol = card.querySelector(".solution");
      const show = sol.hasAttribute("hidden");
      if (show) {
        sol.removeAttribute("hidden");
        btn.textContent = "Sakrij rješenje";
      } else {
        sol.setAttribute("hidden", "");
        btn.textContent = "Pokaži rješenje";
      }
    });
  });
}

function buildState(seed, perLevel) {
  return { seed, perLevel, exercises: generateSet(seed, perLevel) };
}

function init() {
  const params = new URLSearchParams(location.search);
  let seed = parseInt(params.get("seed"), 10);
  if (!Number.isFinite(seed)) seed = (Math.random() * 1e9) | 0;
  let perLevel = parseInt(params.get("perLevel"), 10);
  if (!Number.isFinite(perLevel) || perLevel < 1) perLevel = 3;

  let state = buildState(seed, perLevel);
  render(state);
  syncSeedLabel(state.seed);

  document.getElementById("new-set").addEventListener("click", () => {
    state = buildState((Math.random() * 1e9) | 0, state.perLevel);
    render(state);
    syncSeedLabel(state.seed);
    updateUrl(state);
  });

  document.getElementById("per-level").addEventListener("change", (e) => {
    const v = parseInt(e.target.value, 10) || 3;
    state = buildState(state.seed, v);
    render(state);
    updateUrl(state);
  });

  document.getElementById("print").addEventListener("click", () => window.print());

  document.getElementById("reveal-all").addEventListener("click", () => {
    const showing = document.body.classList.toggle("show-all-solutions");
    document.querySelectorAll(".solution").forEach((s) => {
      if (showing) s.removeAttribute("hidden"); else s.setAttribute("hidden", "");
    });
    document.querySelectorAll(".toggle-sol").forEach((b) => {
      b.textContent = showing ? "Sakrij rješenje" : "Pokaži rješenje";
    });
  });
}

function syncSeedLabel(seed) {
  const el = document.getElementById("seed-label");
  if (el) el.textContent = "Seed: " + seed;
}

function updateUrl(state) {
  const p = new URLSearchParams();
  p.set("seed", state.seed);
  p.set("perLevel", state.perLevel);
  history.replaceState(null, "", "?" + p.toString());
}

document.addEventListener("DOMContentLoaded", init);
