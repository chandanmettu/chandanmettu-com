import * as THREE from "three";
import { Sheet, SERIF, HAND } from "./sheet.js?v=f251d2ad";
import { Post, Spill } from "./post.js?v=f251d2ad";
import { Sound } from "./sound.js?v=f251d2ad";
import { buildPlant, LAYOUT } from "./plant.js?v=f251d2ad";
import { CHAPTERS, finalizeChapters, DOC_ICON } from "./chapters.js?v=f251d2ad";
import { Reader } from "./reader.js?v=f251d2ad";
import * as M from "./model.js?v=f251d2ad";

const $ = (id) => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
export const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");

// ---------- renderer ----------
const canvas = $("c");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("no context");
} catch (e) {
  document.body.classList.add("nogl", "ready");
  throw e;
}
const TIERS = [{ dpr: 1, shadow: 1024, bloom: false, spill: false }, { dpr: 1.25, shadow: 2048, bloom: true, spill: true }, { dpr: 1.5, shadow: 4096, bloom: true, spill: true }];
let tier = Math.max(0, Math.min(2, Number(params.get("tier") ?? 2)));
// ?render: a clean frame for print: no UI, plain paper under the figures, larger labels
const RENDER = params.has("render");
const INK_SCALE = RENDER ? Number(params.get("ink") || 1) : 1; // a big frame drawn at 1x keeps its pen weight
if (RENDER) { TIERS[2].dpr = 1; document.body.classList.add("render"); document.documentElement.style.setProperty("--lbl-scale", String(INK_SCALE)); }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#a89c86");
const camera = new THREE.PerspectiveCamera(30, 1, 8, 12000);

// ---------- light: a window to the upper left, a soft fill ----------
scene.add(new THREE.HemisphereLight("#fffaf0", "#9d917a", 1.05));
const key = new THREE.DirectionalLight("#fff4e2", 2.3);
key.position.set(-700, 1150, 620);
key.target.position.set(0, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
Object.assign(key.shadow.camera, { left: -760, right: 760, top: 620, bottom: -620, near: 200, far: 3200 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.8;
key.shadow.radius = 4;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight("#e8eefc", 0.35);
fill.position.set(700, 400, 700);
scene.add(fill);
const KEY_DIR = key.position.clone().sub(key.target.position).normalize();

// ---------- the poster and its figures ----------
const spill = new Spill(renderer, { x0: -600, x1: 600, z0: -430, z1: 430, res: [420, 300], spread: 1.4 });
const spillU = { uSpill: { value: spill.texture }, uSpillRect: { value: spill.rect.clone() }, uSpillGain: { value: 1.3 } };
const plant = buildPlant({ spill: spillU });
finalizeChapters(plant);
const sheet = new Sheet({ renderer, spill: spillU, layout: LAYOUT });
scene.add(sheet.group);
for (const f of plant.list) scene.add(f.fig.group);
const post = new Post({ renderer, scene, camera });
if (RENDER) {
  scene.background = new THREE.Color("#f6f1e6");
  sheet.blank = true;
  sheet.group.children.forEach((m, i) => { if (i < 2) m.visible = false; }); // the desk and the mat
  post.mix.uniforms.uVig.value = 0;
}
post.enabled = TIERS[tier].bloom;

// ---------- state ----------
const sound = new Sound();
const stillMQ = matchMedia("(prefers-reduced-motion: reduce)");
const STORE = "durgapur-iron-3d:v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { saved = {}; }
if (params.has("fresh")) saved = {};
saved.stamps ||= {}; saved.predict ||= {}; saved.flaps ||= {};
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* storage off: the poster still works */ } };
sound.on = saved.sound !== false;
for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => sound.wake(), { capture: true });

const S = {
  ch: 0,
  still: stillMQ.matches || params.has("still"),
  orbit: { yaw: 0, pitch: 0 }, zoom: 1, pan: V3(0, 0, 0),
  cam: null,
  tour: { on: false, i: 0, t: 0 },
  clock: 0,
  // the plant's clocks: hours of the burden's journey, the cast cycle, the stoves' cycle
  hours: 0, hoursTo: null, play: true, rate: 0.42, // burden hours per real second
  castPhase: 0.15, stovePhase: 0.4,
  ui: {},
};
const ctx = { S, M, plant, saved, save, sound, fmt, $, earn, setCaption, camera, renderPanel, openDoc: (id) => reader.open(id) };

// ---------- the documents: the case study and the poster, read in the page ----------
// While the reader is open the 3D scene stops ticking and drawing (it is hidden behind it anyway).
const reader = new Reader({ sound, onOpen: () => { S.reading = true; if (S.tour.on) stopTour(false); }, onClose: () => { S.reading = false; last = performance.now(); } });
{
  const dock = document.createElement("div");
  dock.id = "docs"; dock.className = "glass"; dock.setAttribute("role", "group"); dock.setAttribute("aria-label", "Documents");
  dock.innerHTML = `<button type="button" data-doc="case" title="Read the case study">${DOC_ICON.case}<span>Case study</span></button><button type="button" data-doc="poster" title="See the poster">${DOC_ICON.poster}<span>Poster</span></button>`;
  dock.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () => reader.open(b.dataset.doc)));
  $("ui").appendChild(dock);
  const cap = document.createElement("button");
  cap.id = "bDocs"; cap.className = "ic"; cap.type = "button"; cap.title = "The case study and the poster"; cap.setAttribute("aria-label", "Read the case study and the poster");
  cap.innerHTML = DOC_ICON.case;
  cap.addEventListener("click", () => reader.open("case"));
  $("bText").after(cap);
}

// ---------- camera ----------
function chapterView() {
  const ch = CHAPTERS[S.ch];
  const v = ch.view(ctx);
  return v;
}
function goal() {
  let g;
  const aspect = camera.aspect;
  if (S.tour.on) {
    const shot = CHAPTERS[S.ch].shots[S.tour.i];
    g = shot.view ? shot.view(ctx) : chapterView();
  } else g = chapterView();
  if (S.viewOverride) g = S.viewOverride;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  // fit the subject into the clear middle between the cards, not the whole canvas
  const clear = innerWidth < 860 ? 1 : Math.max(0.42, 1 - cardsWidth() / Math.max(1, canvas.clientWidth));
  const need = (g.width / 2) / Math.tan(hfov / 2) * 1.04 / clear;
  const dist = Math.max(g.dist, need);
  const target = g.target.clone().add(S.pan);
  return { target, yaw: g.yaw + S.orbit.yaw, pitch: Math.min(82, Math.max(4, g.pitch + S.orbit.pitch)), dist: dist * S.zoom };
}
function placeCamera(c) {
  const y = THREE.MathUtils.degToRad(c.yaw), p = THREE.MathUtils.degToRad(c.pitch);
  camera.position.set(c.target.x + c.dist * Math.sin(y) * Math.cos(p), c.target.y + c.dist * Math.sin(p), c.target.z + c.dist * Math.cos(y) * Math.cos(p));
  camera.lookAt(c.target);
  camera.updateMatrixWorld();
}
function easeCamera(dt) {
  const g = goal();
  if (!S.cam || S.still) S.cam = { target: g.target.clone(), yaw: g.yaw, pitch: g.pitch, dist: g.dist };
  else {
    const k = 1 - Math.exp(-dt * 2.2);
    S.cam.target.lerp(g.target, k);
    S.cam.yaw += (g.yaw - S.cam.yaw) * k;
    S.cam.pitch += (g.pitch - S.cam.pitch) * k;
    S.cam.dist += (g.dist - S.cam.dist) * k;
  }
  placeCamera(S.cam);
}
// the cards cover the sides: shift the picture so the subject sits in the clear middle
function cardsWidth() {
  const a = document.getElementById("card"), b = document.getElementById("panel");
  return (a.classList.contains("closed") ? 0 : a.getBoundingClientRect().width + 16) + (b.classList.contains("closed") ? 0 : b.getBoundingClientRect().width + 16);
}
function viewShiftGoal() {
  if (innerWidth < 860) return { x: 0, y: document.body.dataset.sheet === "none" ? 0 : innerHeight * 0.2 };
  const a = $("card"), b = $("panel");
  const l = a.classList.contains("closed") ? 0 : a.getBoundingClientRect().width + 16;
  const r = b.classList.contains("closed") ? 0 : b.getBoundingClientRect().width + 16;
  return { x: (r - l) / 2, y: 0 };
}
S.shift = { x: 0, y: 0 };
function applyShift(dt) {
  const g = viewShiftGoal();
  const k = S.still ? 1 : 1 - Math.exp(-dt * 6);
  S.shift.x += (g.x - S.shift.x) * k; S.shift.y += (g.y - S.shift.y) * k;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (Math.abs(S.shift.x) < 0.5 && Math.abs(S.shift.y) < 0.5) camera.clearViewOffset(); else camera.setViewOffset(w, h, S.shift.x, S.shift.y, w, h);
  camera.updateProjectionMatrix();
}

// ---------- chapters ----------
function renderNav() {
  const nav = $("chapters");
  nav.innerHTML = CHAPTERS.map((c, i) => `<button type="button" data-i="${i}" aria-current="${i === S.ch}"><span class="n">${i}</span>${c.short}${c.stamp ? `<span class="st${saved.stamps[c.id] ? " got" : ""}" aria-label="${saved.stamps[c.id] ? "stamp earned" : "no stamp yet"}"></span>` : ""}</button>`).join("");
  nav.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => goChapter(Number(b.dataset.i))));
}
function goChapter(i, { tour = true } = {}) {
  i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
  const prev = CHAPTERS[S.ch];
  if (prev && prev.leave) prev.leave(ctx);
  S.ch = i;
  S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; S.pan.set(0, 0, 0);
  stopTour(false);
  const ch = CHAPTERS[i];
  location.hash !== `#${ch.id}` && history.replaceState(null, "", `#${ch.id}`);
  renderNav();
  renderCard();
  renderPanel();
  // stand up the chapter's figures and fold the rest back into print, so nothing stands in the
  // way (the poster chapter keeps whatever is standing)
  if (ch.id !== "poster") for (const f of plant.list) if (!(ch.figures || []).includes(f.id)) f.fig.foldDown(S.still);
  for (const id of ch.figures || []) plant.byId[id].fig.liftUp(S.still);
  if (RENDER) for (const f of plant.list) f.fig.group.visible = ch.id === "poster" || (ch.figures || []).includes(f.id);
  if (ch.enter) ch.enter(ctx);
  S.pendingTour = tour && ch.shots && ch.shots.length && !S.still && !RENDER;
  setCaption(ch.caption(ctx));
  syncPlay();
  sound.paper();
}
function renderCard() {
  const ch = CHAPTERS[S.ch];
  $("cardKicker").textContent = ch.kicker;
  $("cardBody").innerHTML = ch.card(ctx);
  wireCard();
}
function wireCard() {
  const ch = CHAPTERS[S.ch];
  const body = $("cardBody");
  body.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    saved.predict[ch.id] = b.dataset.predict; save(); sound.tick();
    renderCard();
    setCaption(ch.caption(ctx));
  }));
  body.querySelectorAll(".flap > button").forEach((b) => b.addEventListener("click", () => {
    const f = b.parentElement;
    f.classList.toggle("open");
    b.setAttribute("aria-expanded", String(f.classList.contains("open")));
    if (f.classList.contains("open") && !saved.flaps[ch.id]) { saved.flaps[ch.id] = true; save(); renderCard(); body.querySelector(".flap")?.classList.add("open"); }
    sound.paper();
    setCaption(ch.caption(ctx));
  }));
  body.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => goChapter(Number(b.dataset.go))));
  body.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => ch.act && ch.act(ctx, b.dataset.act, b)));
}
function renderPanel() {
  const ch = CHAPTERS[S.ch];
  $("panelKicker").textContent = ch.panelKicker || "Readings";
  $("panelBody").innerHTML = ch.panel(ctx);
  S.ui = {};
  $("panelBody").querySelectorAll("[id]").forEach((el) => (S.ui[el.id] = el));
  if (ch.wire) ch.wire(ctx, $("panelBody"));
}
function earn(id, text) {
  if (saved.stamps[id]) return;
  saved.stamps[id] = Date.now(); save();
  setTimeout(() => sound.stamp(), 80);
  const t = $("stampToast");
  t.textContent = text; t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 3200);
  renderNav(); renderCard();
}

// ---------- tours ----------
function startTour() {
  const ch = CHAPTERS[S.ch];
  if (!ch.shots || !ch.shots.length) return;
  S.tour.on = true; S.viewOverride = null; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; S.pan.set(0, 0, 0);
  gotoShot(0); syncPlay();
}
function stopTour(done = true) {
  if (!S.tour.on) return;
  S.tour.on = false; drawDots(); syncPlay();
  if (CHAPTERS[S.ch].tourEnd) CHAPTERS[S.ch].tourEnd(ctx);
  if (done) { saved.toured ||= {}; saved.toured[CHAPTERS[S.ch].id] = true; save(); }
  setCaption(CHAPTERS[S.ch].caption(ctx));
}
function gotoShot(i) {
  const ch = CHAPTERS[S.ch];
  if (i >= ch.shots.length) { stopTour(true); return; }
  S.tour.i = Math.max(0, i); S.tour.t = 0;
  const shot = ch.shots[S.tour.i];
  if (shot.act) shot.act(ctx);
  setCaption(shot.cap);
  drawDots();
}
function tourStep(dt) {
  if (!S.tour.on) return;
  S.tour.t += dt;
  const shot = CHAPTERS[S.ch].shots[S.tour.i];
  if (shot.during) shot.during(ctx, S.tour.t);
  if (S.tour.t >= shot.dur) gotoShot(S.tour.i + 1);
}
function drawDots() {
  const ch = CHAPTERS[S.ch];
  $("dots").innerHTML = S.tour.on ? ch.shots.map((_, i) => `<i class="${i === S.tour.i ? "on" : ""}"></i>`).join("") : "";
}
function syncPlay() {
  const b = $("bPlay");
  const ch = CHAPTERS[S.ch];
  const figs = (ch.figures || []).map((id) => plant.byId[id].fig);
  const anyFlat = plant.list.some((f) => f.fig.phase === "print");
  if (S.ch === 0) { b.hidden = false; b.textContent = anyFlat ? "Stand it all up" : "Fold it flat"; }
  else if (S.tour.on) { b.hidden = false; b.textContent = "Skip tour"; }
  else if (figs.length && figs.every((f) => f.phase === "live") && ch.shots?.length) { b.hidden = false; b.textContent = "Replay tour"; }
  else b.hidden = true;
}
let captionHold = 0;
function setCaption(t, hold = 0) { $("caption").textContent = t; captionHold = hold; }

// ---------- controls ----------
$("bPlay").addEventListener("click", () => {
  if (S.ch === 0) {
    const anyFlat = plant.list.some((f) => f.fig.phase === "print");
    if (anyFlat) standAll(); else for (const f of plant.list) f.fig.foldDown(S.still);
    setTimeout(syncPlay, 50);
    return;
  }
  if (S.tour.on) stopTour(true); else startTour();
});
function standAll() {
  plant.list.forEach((f, i) => setTimeout(() => f.fig.liftUp(S.still), S.still ? 0 : i * 650));
}
$("bPrev").addEventListener("click", () => goChapter(S.ch - 1));
$("bNext").addEventListener("click", () => goChapter(S.ch + 1));
$("bFold").addEventListener("click", () => { for (const f of plant.list) f.fig.foldDown(S.still); stopTour(false); });
$("bStill").addEventListener("click", () => { S.still = !S.still; $("bStill").setAttribute("aria-pressed", String(S.still)); document.body.classList.toggle("still", S.still); if (S.still) stopTour(false); });
$("bStill").setAttribute("aria-pressed", String(S.still));
document.body.classList.toggle("still", S.still);
function syncSound() { $("bSound").setAttribute("aria-pressed", String(sound.on)); $("bSound").title = sound.on ? "Sound on" : "Sound off"; }
$("bSound").addEventListener("click", () => { sound.setOn(!sound.on); saved.sound = sound.on; save(); syncSound(); });
syncSound();
$("bText").addEventListener("click", () => openText());
function openText() { const a = $("a11y"); a.classList.toggle("open"); if (a.classList.contains("open")) a.focus(); }
$("bFull").addEventListener("click", () => {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
});
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $("bFull").hidden = true;
if (/\/lab\/[^/]+\/?$/.test(location.pathname)) $("bLab").hidden = false;
for (const [btn, card] of [["cardToggle", "card"], ["panelToggle", "panel"]]) {
  $(btn).addEventListener("click", () => {
    if (innerWidth < 860) { document.body.dataset.sheet = card === "card" ? "panel" : "none"; return; }
    const c = $(card); c.classList.toggle("closed"); $(btn).setAttribute("aria-expanded", String(!c.classList.contains("closed")));
  });
}
if (innerWidth < 860) document.body.dataset.sheet = "card";
const sheetBtn = document.createElement("button");
sheetBtn.id = "sheetBtn"; sheetBtn.className = "glass"; sheetBtn.type = "button"; sheetBtn.textContent = "Show the card";
sheetBtn.addEventListener("click", () => { document.body.dataset.sheet = "card"; });
$("ui").appendChild(sheetBtn);

// ---------- pointer: orbit, zoom, and taps on figures ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function pickFigure(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // printed figures are hit on their footprint on the sheet; standing ones on their boxes
  const p = ray.ray.intersectPlane(new THREE.Plane(V3(0, 1, 0), 0), new THREE.Vector3());
  let best = null;
  for (const f of plant.list) {
    const hit = f.fig.standing ? ray.ray.intersectBox(f.box, new THREE.Vector3()) : (p && f.print.containsPoint(V3(p.x, 0, p.z)) ? p : null);
    if (hit) { const d = hit.distanceTo(camera.position); if (!best || d < best.d) best = { f, d }; }
  }
  return best ? best.f : null;
}
canvas.addEventListener("pointerdown", (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button, shift: e.shiftKey };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) {
    const f = S.ch === 0 ? pickFigure(e) : null;
    canvas.style.cursor = f ? "pointer" : "grab";
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.moved > 6) {
    if (S.tour.on) stopTour(false);
    canvas.style.cursor = "grabbing";
    if (drag.button === 2 || drag.shift) {
      const k = S.cam ? S.cam.dist / 1200 : 1;
      const yaw = THREE.MathUtils.degToRad(S.cam ? S.cam.yaw : 0);
      S.pan.x -= (dx * Math.cos(yaw)) * k; S.pan.z -= (-dx * Math.sin(yaw)) * k;
      S.pan.y += dy * k * 0.6;
    } else {
      S.orbit.yaw = Math.max(-75, Math.min(75, S.orbit.yaw - dx * 0.2));
      S.orbit.pitch = Math.max(-35, Math.min(40, S.orbit.pitch + dy * 0.15));
    }
  }
});
canvas.addEventListener("pointerup", (e) => {
  if (drag && drag.moved <= 6) {
    const f = pickFigure(e);
    if (f) {
      const ci = CHAPTERS.findIndex((c) => c.id === f.chapter);
      if (S.ch === 0 && ci > 0) goChapter(ci);
      else if (CHAPTERS[S.ch].tap) CHAPTERS[S.ch].tap(ctx, f, e);
    }
  }
  drag = null;
  canvas.style.cursor = "grab";
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => { e.preventDefault(); if (S.tour.on) stopTour(false); S.zoom = Math.max(0.3, Math.min(2.2, S.zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
addEventListener("keydown", (e) => {
  if (S.reading) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  const k = e.key;
  if (k === "ArrowRight" || k === "PageDown") { goChapter(S.ch + 1); e.preventDefault(); }
  else if (k === "ArrowLeft" || k === "PageUp") { goChapter(S.ch - 1); e.preventDefault(); }
  else if (k === "t" || k === "T") openText();
  else if (k === " ") { e.preventDefault(); $("bPlay").click(); }
  else if (k === "Escape") { stopTour(false); S.viewOverride = null; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; S.pan.set(0, 0, 0); $("a11y").classList.remove("open"); }
  else if (/^[0-9]$/.test(k) && Number(k) < CHAPTERS.length) goChapter(Number(k));
  else if (CHAPTERS[S.ch].key) CHAPTERS[S.ch].key(ctx, k, e);
});
addEventListener("hashchange", () => { const i = CHAPTERS.findIndex((c) => `#${c.id}` === location.hash); if (i >= 0 && i !== S.ch) goChapter(i); });

// ---------- size and quality ----------
const size = new THREE.Vector2();
let resizedAt = 0;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  resizedAt = performance.now();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(size);
  const dpr = renderer.getPixelRatio();
  post.setSize(w, h, dpr);
  for (const f of plant.list) f.fig.setRes(size, dpr * INK_SCALE);
}
new ResizeObserver(resize).observe(canvas);
let samples = [], slowWindows = 0;
function sampleFrame(ms) {
  if (params.has("tier") || document.hidden || performance.now() - resizedAt < 1500) return;
  samples.push(ms);
  if (samples.length < 90) return;
  samples.sort((a, b) => a - b);
  const mean = samples.slice(5, -5).reduce((a, b) => a + b, 0) / (samples.length - 10);
  samples = [];
  slowWindows = mean > 26 ? slowWindows + 1 : 0;
  if (slowWindows >= 2 && tier > 0) { slowWindows = 0; setTier(tier - 1); }
}
function setTier(t) {
  tier = t;
  key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
  key.shadow.map?.dispose(); key.shadow.map = null;
  post.enabled = TIERS[tier].bloom;
  for (const f of plant.list) f.fig.surf.uHatchQ.value = tier === 0 ? 0 : 1;
  resize();
}

// ---------- labels: names pinned to the parts, projected every frame ----------
const labelLayer = document.createElement("div");
labelLayer.id = "labels";
labelLayer.innerHTML = `<svg id="leaders" aria-hidden="true"></svg>`;
$("ui").prepend(labelLayer);
const leaders = labelLayer.querySelector("svg");
const labelEls = new Map();
S.labelsOn = saved.labels !== false;
const tmp = new THREE.Vector3();
function updateLabels() {
  const ch = CHAPTERS[S.ch];
  const covered = innerWidth < 860 && document.body.dataset.sheet !== "none";
  const list = S.labelsOn && ch.labels && !S.tour.on && !covered ? ch.labels(ctx) || [] : [];
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const seen = new Set();
  let svg = "";
  // labels keep out from under the card and the panel, where those stand
  const box = (id) => { const e = $(id); if (!e || innerWidth < 860) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  const cr = list.length ? box("card") : null, pr = list.length ? box("panel") : null;
  for (const L of list) {
    if (!L.pos) continue;
    tmp.copy(L.pos).project(camera);
    if (tmp.z > 1 || tmp.z < -1) continue;
    const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
    if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;
    const k = (w < 620 ? 0.45 : 1) * INK_SCALE;
    const dx = (L.dx ?? 60) * k, dy = (L.dy ?? -30) * k;
    let el = labelEls.get(L.text);
    if (!el) { el = document.createElement("span"); el.className = "lbl"; labelLayer.appendChild(el); labelEls.set(L.text, el); }
    if (el.textContent !== (L.show ?? L.text)) el.textContent = L.show ?? L.text;
    el.classList.toggle("heat", !!L.heat); el.classList.toggle("gas", !!L.gas); el.classList.toggle("on", !!L.on);
    // keep the label on screen: slide it along, the leader still finds the part
    const lw = el.offsetWidth || 80;
    let lx = x + dx;
    if (!L.center) {
      const ly = y + dy;
      let lo = 6, hi = w - 6;
      if (cr && ly > cr.top - 12 && ly < cr.bottom + 12) lo = Math.max(lo, cr.right + 8);
      if (pr && ly > pr.top - 12 && ly < pr.bottom + 12) hi = Math.min(hi, pr.left - 8);
      lx = dx < 0 ? Math.max(lx, lo + lw) : Math.min(lx, hi - lw);
    }
    el.style.transform = L.center ? `translate(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px) translate(-50%, -100%)` : `translate(${lx.toFixed(1)}px, ${(y + dy).toFixed(1)}px) translate(${dx < 0 ? "-100%" : "0"}, -50%)`;
    el.hidden = false;
    seen.add(L.text);
    const ex = L.center ? x : lx + (dx < 0 ? 2 : -2), ey = L.center ? y + dy + 2 : y + dy;
    svg += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.6 * INK_SCALE).toFixed(1)}"/>`;
  }
  for (const [k, el] of labelEls) if (!seen.has(k)) el.hidden = true;
  leaders.innerHTML = svg;
}

// ---------- the text version ----------
const SOURCE_LIST = [
  "SAIL, Durgapur Steel Plant facilities and About DSP pages (raw materials, coke ovens, sinter, blast furnaces, steel shop).",
  "Comptroller and Auditor General of India, Report No. 38 of 2025: performance audit of SAIL's blast furnaces, 2017-18 to 2023-24 (furnace years, hot blast, oxygen, blast pressure and volume, productivity, slag, pig iron, capacities).",
  "PIB, 9 July 2002 (DSP's first blast furnace, 29 December 1959) and 23 October 2002 (BF-3 rebuild: twin taphole, rocking runners, stave coolers).",
  "Global Energy Monitor, SAIL Durgapur steel plant (production, relines, ore and coal sources, the 2025 environmental impact report summary). Its March 2025 BF-3 reline is not confirmed by SAIL or the press.",
  "Suchnaji, Durgapur's July 2026 production records. Bharat Online, older raw material figures.",
  "SAIL Board's Report FY2025-26 (SAIL coke rate 419 kg/thm, fuel rate 553, Durgapur expansion packages). NITI Aayog (coke rate benchmarks).",
  "Infrastructure Today and SteelOrbis (coke oven Battery 2, rebuilt 2013).",
  "J. A. Ricketts, The Blast Furnace (Ispat Inland); Techniques de l'Ingénieur M7403 (burden 6 to 8 h, gas 6 to 12 s). ISIJ International 61(6), 2021, and Tetsu-to-Hagane 68(15), 1982 (cohesive zone shapes).",
  "Standard ironmaking texts for typical temperatures, hot metal and slag analyses (marked typical). Furnace profiles: a typical shape scaled to Durgapur's published useful and working volumes; Durgapur does not publish its furnace lines.",
];
function renderText() {
  $("a11y").innerHTML = `<button class="close" type="button" onclick="this.parentElement.classList.remove('open')">Close</button>` + CHAPTERS.map((c) => c.text ? c.text(ctx) : "").join("") +
    `<h2>Sources</h2><ol>${SOURCE_LIST.map((x) => `<li>${x}</li>`).join("")}</ol><p>Made by Chandan Mettu with Claude for an Iron Making course at IIT Hyderabad. The pop-up ink style follows “Every Joule” by Techartist.</p>`;
}

// ---------- start ----------
async function start() {
  try { await Promise.all([document.fonts.load(`600 20px ${SERIF}`), document.fonts.load(`italic 400 20px ${SERIF}`), document.fonts.load(`600 20px ${HAND}`)]); } catch { /* fallback fonts */ }
  sheet.draw();
  for (const f of plant.list) { f.fig.update(0, frameState(0)); }
  const t0 = performance.now();
  for (const f of plant.list) f.fig.computePrintVisibility();
  S.visMs = Math.round(performance.now() - t0);
  resize();
  renderText();
  const fromHash = CHAPTERS.findIndex((c) => `#${c.id}` === location.hash);
  goChapter(fromHash >= 0 ? fromHash : 0, { tour: true });
  easeCamera(0);
  requestAnimationFrame(loop);
  const wait = S.still ? 200 : Math.max(0, 2400 - performance.now());
  setTimeout(() => document.body.classList.add("ready"), wait);
  if (params.has("live")) setTimeout(() => standAll(), 60);
}

function frameState(dt) {
  return { hours: S.hours, castPhase: S.castPhase, stovePhase: S.stovePhase, live: true, still: S.still, clockHours: S.clock / 3, dt };
}

let last = performance.now(), uiClock = 0, frameNo = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const raw = now - last;
  last = now;
  frameNo++;
  if (S.reading) return;
  if (frameNo > 30) sampleFrame(raw);
  tick(Math.min(0.05, raw / 1000));
  render();
}

function tick(dt) {
  S.clock += dt;
  const ch = CHAPTERS[S.ch];
  // the plant's clocks
  if (S.hoursTo != null) { S.hours += (S.hoursTo - S.hours) * (S.still ? 1 : 1 - Math.exp(-dt * 5)); if (Math.abs(S.hours - S.hoursTo) < 0.002) { S.hours = S.hoursTo; S.hoursTo = null; } }
  else if (S.play) { S.hours += dt * S.rate; if (S.hours > M.RESIDENCE + 0.6) S.hours = 0; }
  S.castPhase += dt * 0.045;
  S.stovePhase += dt * 0.06;
  // a tour waits until the chapter's figures stand
  if (S.pendingTour) {
    const figs = (ch.figures || []).map((id) => plant.byId[id].fig);
    if (figs.every((f) => f.phase === "live")) { S.pendingTour = false; if (!(saved.toured && saved.toured[ch.id])) startTour(); else setCaption(ch.caption(ctx)); syncPlay(); }
  }
  tourStep(dt);
  for (const f of plant.list) {
    const was = f.fig.phase;
    f.fig.step(dt);
    if (was !== f.fig.phase) syncPlay();
  }
  applyShift(dt);
  easeCamera(dt);
  updateLabels();
  const st = frameState(dt);
  for (const f of plant.list) {
    f.fig.update(dt, st);
    if (f.fig.phase !== "print") f.fig.updateSilhouettes(camera);
    f.fig.surf.uKeyView.value.copy(KEY_DIR).transformDirection(camera.matrixWorldInverse);
  }
  if (ch.tick) ch.tick(ctx, dt);
  uiClock += dt;
  if (uiClock > 0.1) { uiClock = 0; if (ch.readouts) ch.readouts(ctx); for (const f of plant.list) f.drawTags && f.drawTags(ctx); }
  if (captionHold > 0) { captionHold -= dt; if (captionHold <= 0) setCaption(S.tour.on ? ch.shots[S.tour.i].cap : ch.caption(ctx)); }
  S.spillDue = (S.spillDue || 0) + 1;
  sound.update({ heat: 0, drawing: plant.list.some((f) => f.fig.drawing) });
}

function render() {
  const anyLit = plant.list.some((f) => f.fig.surfA > 0.01);
  if (TIERS[tier].spill && anyLit && S.spillDue >= 2) { S.spillDue = 0; spill.render(scene); }
  post.render();
}

function advance(seconds, fps = 60) {
  const n = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < n; i++) tick(1 / fps);
  S.spillDue = 2;
  render();
  return { ch: CHAPTERS[S.ch].id, phases: plant.list.map((f) => `${f.id}:${f.fig.phase}`).join(" "), hours: +S.hours.toFixed(2), tour: S.tour.on ? S.tour.i : null };
}

// for the printed poster: draw one frame and hand back the canvas, plus where each label points
function grab(type = "image/png") {
  S.spillDue = 2; render();
  const url = canvas.toDataURL(type, 0.92);
  const ch = CHAPTERS[S.ch], w = canvas.clientWidth, h = canvas.clientHeight;
  const labels = (ch.labels ? ch.labels(ctx) || [] : []).filter((L) => L.pos).map((L) => {
    const p = L.pos.clone().project(camera);
    return { text: L.show ?? L.text, x: (p.x * 0.5 + 0.5) / 1, y: (-p.y * 0.5 + 0.5) / 1, dx: (L.dx ?? 60) / w, dy: (L.dy ?? -30) / h, heat: !!L.heat, gas: !!L.gas, center: !!L.center };
  });
  return { url, w, h, labels };
}

start();
window.__di = { reader, grab, S, plant, camera, renderer, post, scene, sheet, M, CHAPTERS, goChapter, advance, standAll, startTour, stopTour, setTier, earn, hideLoader: () => { $("loader").style.display = "none"; } };
