import * as THREE from "three";
import { Book, BOOK, LEFT, OPTIONS, ANSWER, SERIF, HAND, pageToWorld } from "./book.js?v=39d479d9";
import { Rig, SCALE, DYE_COLOR } from "./rig.js?v=39d479d9";
import { Post, Spill, GLOW_LAYER } from "./post.js?v=39d479d9";
import { createFlow, U_MAX, stillnessAfter, settledFor, RIG } from "./model.js?v=39d479d9";
import { Sound } from "./sound.js?v=39d479d9";

const $ = (id) => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
const params = new URLSearchParams(location.search);

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
const TIERS = [{ dpr: 1, shadow: 1024, bloom: false, spill: false }, { dpr: 1.25, shadow: 1024, bloom: true, spill: true }, { dpr: 1.5, shadow: 2048, bloom: true, spill: true }];
let tier = Math.max(0, Math.min(2, Number(params.get("tier") ?? 2)));
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b9ae9b");
const camera = new THREE.PerspectiveCamera(30, 1, 5, 6000);

// ---------- light: a window to the upper left, a soft fill ----------
scene.add(new THREE.HemisphereLight("#fffaf0", "#a3977f", 1.05));
const key = new THREE.DirectionalLight("#fff4e2", 2.3);
key.position.set(-300, 470, 230);
key.target.position.set(40, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
Object.assign(key.shadow.camera, { left: -300, right: 300, top: 260, bottom: -260, near: 50, far: 1400 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.6;
key.shadow.radius = 4;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight("#e8eefc", 0.35);
fill.position.set(320, 180, 300);
scene.add(fill);
const KEY_DIR = key.position.clone().sub(key.target.position).normalize();

// ---------- the figure and the book ----------
const FRAME = new THREE.Matrix4().makeTranslation(22, BOOK.Y, 40); // hinge line 40 mm below the page centre
const HINGE_MY = 40 + BOOK.D / 2;
const rig = new Rig({ frame: FRAME });
const spillU = { uSpill: rig.surf.uSpill, uSpillRect: rig.surf.uSpillRect, uSpillGain: { value: 1.25 } };
const book = new Book({ renderer, spill: spillU });
scene.add(book.group, rig.group);
const spill = new Spill(renderer, { x0: 0, x1: 215, z0: -40, z1: 70 });
rig.surf.uSpill.value = spill.texture;
rig.surf.uSpillRect.value.copy(spill.rect);
rig.group.traverse((o) => { if (o.userData.glow) o.layers.enable(GLOW_LAYER); });
rig.dye.mesh.layers.enable(GLOW_LAYER);
const post = new Post({ renderer, scene, camera });
const inkMats = [rig.inkMain, rig.inkFine, rig.inkBold, rig.sil.material];
inkMats.forEach((m) => (m.userData.basePx = m.uniforms.uWidthPx.value));
const F = (x, y, z) => V3(22 + x, BOOK.Y + y, 40 + z); // figure → world

// ---------- the bench model ----------
const flow = createFlow({ cells: 128 });
const sound = new Sound();
const still = matchMedia("(prefers-reduced-motion: reduce)");
const STORE = "reynolds-pipe-3d:v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { saved = {}; }
if (params.has("fresh")) saved = {}; // a classroom link that always opens the book new
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* storage off: the lesson still works */ } };

const S = {
  phase: "print", t: 0, clock: 0,
  lesson: "predict",
  view: "spread",
  tour: { on: false, i: 0, t: 0 },
  uTo: 0.3, u: 0.3, T: 20, stillSet: 0.5, stirredAt: -1e9,
  still: still.matches || params.has("still"),
  orbit: { yaw: 0, pitch: 0 }, zoom: 1,
  cam: null,
  challengeT: 0, seenTurb: false,
  surf: 0, lift: 1, copy: 1, stand: 1,
};
flow.u = S.u; flow.T = S.T; flow.still = S.stillSet;
book.state.predict = saved.predict ?? null;
book.state.flapSeen = !!saved.flap;
sound.on = saved.sound !== false;
for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => sound.wake(), { capture: true });
book.state.stamp = !!saved.stamp;
if (book.state.stamp) book.stampPress = 1;

// ---------- views and the tour ----------
const VIEWS = {
  spread: { target: V3(0, BOOK.Y, 4), yaw: 0, pitch: 58, dist: 700, width: 440 },
  figure: { target: F(88, 24, -28), yaw: -14, pitch: 27, dist: 360, width: 200 },
  // on a phone held upright the spread is too small to read: frame the left page instead
  page: { target: V3(-100, BOOK.Y, 6), yaw: 0, pitch: 66, dist: 420, width: 214 },
};
const TURNS = 3.5; // the handwheel turns three and a half times from shut to open
const SHOTS = [
  { cap: "The tank: still water, and a fine needle feeding dye into the mouth of the glass tube.", target: F(27, 32, -33), yaw: -30, pitch: 15, dist: 150, dur: 5.5, valve: [0.3, 0.3] },
  { cap: "Slow flow: the dye runs down the tube as one straight thread.", target: F(80, 24, -33), yaw: 9, pitch: 12, dist: 175, dur: 5, valve: [0.3, 0.3] },
  { cap: "Open the valve. Past the critical Reynolds number the thread wavers, tears and fills the tube.", target: F(112, 24, -33), yaw: 24, pitch: 14, dist: 165, dur: 8, valve: [0.3, 0.64] },
  { cap: "The piezometers: once the flow is turbulent, the head falls faster along the tube.", target: F(90, 40, -33), yaw: -5, pitch: 9, dist: 215, dur: 6, valve: [0.64, 0.64] },
  { cap: "Your turn. Drag the handwheel, or use the bench.", target: null, dur: 3, valve: [0.64, 0.3] },
];

function goal() {
  let g;
  const aspect = camera.aspect;
  if (S.tour.on) {
    const shot = SHOTS[S.tour.i];
    g = shot.target ? { target: shot.target, yaw: shot.yaw, pitch: shot.pitch, dist: shot.dist, width: shot.dist * 0.42 } : VIEWS.figure;
  } else g = S.view === "spread" && aspect < 0.85 ? VIEWS.page : VIEWS[S.view];
  // keep the view's width on screen however narrow the window is
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const need = (g.width / 2) / Math.tan(hfov / 2) * 1.04;
  const dist = Math.max(g.dist, need);
  const tilt = aspect < 0.85 && S.view === "figure" && !S.tour.on ? 8 : 0;
  return { target: g.target, yaw: g.yaw + S.orbit.yaw, pitch: Math.min(80, Math.max(6, g.pitch + tilt + S.orbit.pitch)), dist: dist * S.zoom };
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
    const k = 1 - Math.exp(-dt * 2.4);
    S.cam.target.lerp(g.target, k);
    S.cam.yaw += (g.yaw - S.cam.yaw) * k;
    S.cam.pitch += (g.pitch - S.cam.pitch) * k;
    S.cam.dist += (g.dist - S.cam.dist) * k;
  }
  placeCamera(S.cam);
}

// ---------- the lift: print → peel → shade → live, and back ----------
function setPhase(p) {
  S.phase = p; S.t = 0;
  if (p === "print") { S.clock0 = 0; S.lift = 1; S.surf = 0; S.copy = 1; S.stand = 1; }
  if (p === "live") { S.surf = 1; S.copy = 0; S.stand = 1; }
  if (p === "peel") { S.copy = 1; S.stand = 1; S.lift = 1; S.surf = 0; }
  syncPlay();
}
function lift() {
  if (S.phase !== "print") return;
  S.view = "figure"; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1;
  if (S.still) { setPhase("live"); startTourIfFirst(); return; }
  setPhase("peel");
  setCaption("Watch the drawing lift off the page.");
}
function fold() {
  if (S.phase === "live") { stopTour(); setPhase("undraw"); S.view = "spread"; }
  else if (S.phase === "print") lift();
}
function stepPhase(dt) {
  S.t += dt;
  const u = rig.pen;
  if (S.phase === "print") { u.uClock.value = 0; }
  if (S.phase === "peel") {
    u.uClock.value = S.t;
    S.copy = 1;
    if (S.t >= rig.drawEnd) setPhase("shade");
  }
  if (S.phase === "shade") {
    u.uClock.value = 1e5;
    S.surf = smooth(S.t / 0.5);
    if (S.t >= 0.5) { setPhase("live"); startTourIfFirst(); }
  }
  if (S.phase === "live") u.uClock.value = 1e5;
  if (S.phase === "undraw") {
    u.uClock.value = 1e5;
    S.surf = 1 - smooth(S.t / 0.15);
    const s = smooth((S.t - 0.15) / 0.45);
    S.lift = 1 - s;
    const r = smooth((s - 0.78) / 0.22);
    S.copy = r; S.stand = 1 - r;
    if (S.t >= 0.62) { setPhase("print"); setCaption(lessonCaption()); }
  }
  u.uLift.value = S.lift;
  u.uCopyAll.value = S.phase === "peel" ? 0 : 1;
  u.uStandAlpha.value = S.stand;
  u.uCopyAlpha.value = S.copy;
  // the print copy shows whenever the figure is not fully standing
  const showCopy = S.phase !== "live" && S.phase !== "shade";
  for (const set of [...rig.sets, rig.sil]) set.flat.visible = showCopy && !set.noPrint;
  rig.surf.uSurfAlpha.value = S.surf;
  rig.surf.uLiftSurf.value = S.phase === "undraw" ? S.lift : 1;
  rig.dye.material.uniforms.uAlpha.value = S.surf;
  if (rig.shadowDepth) rig.shadowDepth.opacity = S.surf;
  const cast = S.surf > 0.01;
  for (const m of rig.surfaces) m.castShadow = cast && m.userData.cast !== false;
}

// ---------- the lesson loop ----------
function lessonCaption() {
  if (S.phase === "print") return book.state.predict ? "Lift the drawing off the page." : "1 · Predict: tick what you expect on the left page, then lift the drawing.";
  if (book.state.stamp) return "Stamp earned. Now warm the water: ν halves between 20 and 50 °C, so the same valve gives about twice the Re.";
  if (!S.seenTurb) return "2 · Try: open the valve slowly. Watch the thread, the Re tag and the two water columns.";
  if (!book.state.flapSeen) return "You made it turbulent. Now lift the flap on the left page to see why (⧉ shows the page).";
  return "3 · Challenge: make the thread break up while Re is still below 3,000.";
}
let captionHold = 0;
function setCaption(t, hold = 0) { $("caption").textContent = t; captionHold = hold; }
function startTourIfFirst() {
  if (!saved.toured && !S.still) startTour();
  else setCaption(lessonCaption());
}
function startTour() { S.tour.on = true; S.tour.i = 0; S.tour.t = 0; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; setCaption(SHOTS[0].cap); drawDots(); syncPlay(); }
function stopTour() { if (!S.tour.on) return; S.tour.on = false; drawDots(); syncPlay(); setCaption(lessonCaption()); }
function tourStep(dt) {
  if (!S.tour.on) return;
  S.tour.t += dt;
  const shot = SHOTS[S.tour.i];
  const k = smooth((S.tour.t - 0.8) / Math.max(1, shot.dur - 1.6));
  S.uTo = shot.valve[0] + (shot.valve[1] - shot.valve[0]) * k;
  if (S.tour.t >= shot.dur) gotoShot(S.tour.i + 1);
}
function gotoShot(i) {
  if (i >= SHOTS.length) { S.tour.on = false; saved.toured = true; save(); S.view = "figure"; drawDots(); syncPlay(); setCaption(lessonCaption()); return; }
  S.tour.i = Math.max(0, i); S.tour.t = 0;
  setCaption(SHOTS[S.tour.i].cap);
  drawDots();
}
function drawDots() {
  const d = $("dots");
  d.innerHTML = S.tour.on ? SHOTS.map((_, i) => `<i class="${i === S.tour.i ? "on" : ""}"></i>`).join("") : "";
}
function syncPlay() {
  const b = $("bPlay");
  if (S.phase === "print") { b.hidden = false; b.textContent = "Lift the drawing"; }
  else if (S.tour.on) { b.hidden = false; b.textContent = "Skip tour"; }
  else if (S.phase === "live") { b.hidden = false; b.textContent = "Replay tour"; }
  else b.hidden = true;
}
function predict(id) {
  book.state.predict = id;
  saved.predict = id; save();
  sound.tick();
  book.drawLeft();
  syncA11y();
  if (S.phase === "print") { setCaption("Good. Now watch the drawing lift off the page."); setTimeout(lift, 700); }
}
function toggleFlap() {
  book.state.flapOpen = !book.state.flapOpen;
  sound.paper();
  if (book.state.flapOpen && !book.state.flapSeen) {
    book.state.flapSeen = true; saved.flap = true; save();
    book.drawLeft();
    setCaption(lessonCaption());
  }
}
function earnStamp() {
  if (book.state.stamp) return;
  book.state.stamp = true; saved.stamp = Date.now(); save();
  book.stampPress = 0;
  setTimeout(() => sound.stamp(), 120);
  setCaption(lessonCaption());
  $("a11yLive").textContent = "Stamp earned: you tripped the flow below Re 3,000.";
}

// ---------- tags on the easels ----------
function drawTag(tag, lines) {
  const key = JSON.stringify(lines);
  if (tag.last === key) return;
  tag.last = key;
  const c = tag.canvas, g = c.getContext("2d"), s = c.width / tag.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, c.width, c.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  g.textBaseline = "alphabetic";
  g.font = `600 2.4px ${SERIF}`; g.fillStyle = "#1c2433";
  g.fillText(lines.title, 2.8, 4.4);
  g.font = `600 7.4px ${HAND}`; g.fillStyle = "#1c2433";
  g.fillText(lines.big, 2.8, 12.6);
  if (lines.word) { g.font = `600 4.4px ${HAND}`; g.fillStyle = lines.wordColor || "#1c2433"; g.textAlign = "right"; g.fillText(lines.word, tag.w - 2.8, 12.4); g.textAlign = "left"; }
  g.font = `italic 400 2.3px ${SERIF}`; g.fillStyle = "#4c5466";
  g.fillText(lines.note, 2.8, tag.h - 2.6);
  // a little thread icon: straight when laminar, torn when turbulent
  if (lines.icon != null) {
    g.strokeStyle = DYE_COLOR; g.lineWidth = 0.42; g.lineCap = "round";
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = tag.w - 12.4 + i * 0.4, y = 3.5 + Math.sin(i * 1.3) * lines.icon * 1.1 * (i / 24);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  tag.tex.needsUpdate = true;
}

// ---------- the bench card and the text version ----------
function syncControls() {
  $("valve").value = String(Math.round((S.uTo / U_MAX) * 100));
  $("valve-out").textContent = `${Math.round((S.uTo / U_MAX) * 100)} %`;
  $("temp-out").textContent = `${S.T} °C`;
  $("still-out").textContent = settledFor(S.stillSet);
  $("dye").setAttribute("aria-pressed", String(flow.dye));
  $("dye").textContent = flow.dye ? "Dye on" : "Dye off";
}
function syncA11y() {
  const box = $("a11yPredict");
  box.innerHTML = OPTIONS.map((o) => `<button type="button" data-id="${o.id}" aria-pressed="${book.state.predict === o.id}">${o.id}. ${o.text}</button>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => predict(b.dataset.id)));
}
let lastRegime = "";
function readouts(R) {
  if (document.activeElement !== $("valve")) syncControls();
  $("r-re").textContent = fmt(R.Re);
  $("r-regime").textContent = R.regime;
  $("r-v").textContent = `${fmt(R.V, 3)} m/s`;
  $("r-q").textContent = `${fmt(R.Q * 1e6, 1)} mL/s`;
  $("r-nu").textContent = `${fmt(R.nu * 1e6, 3)} mm²/s`;
  $("r-dh").textContent = `${fmt(R.dh * 1000, 1)} mm`;
  $("r-f").textContent = `${fmt(R.fMeasured, 4)} / ${fmt(R.fLam, 4)} / ${fmt(R.fBlasius, 4)}`;
  $("r-onset").textContent = fmt(R.onset);
  $("r-gamma").textContent = `${fmt(R.gamma * 100)} %`;
  if (R.regime !== lastRegime) { lastRegime = R.regime; $("a11yLive").textContent = `Re ${fmt(R.Re)}: ${R.regime}.`; }
}

$("valve").addEventListener("input", (e) => { stopTour(); S.uTo = (Number(e.target.value) / 100) * U_MAX; syncControls(); });
$("temp").addEventListener("input", (e) => { S.T = Number(e.target.value); syncControls(); });
$("still").addEventListener("input", (e) => { S.stillSet = Number(e.target.value) / 100; S.stirredAt = -1e9; syncControls(); });
$("stir").addEventListener("click", () => { S.stirredAt = S.clock; setCaption("Tank stirred: it will take a minute or so to settle again.", 3); });
$("dye").addEventListener("click", () => { flow.dye = !flow.dye; syncControls(); });
$("flush").addEventListener("click", () => { flow.reset(); flow.collected = 0; });
// for the next class: forget the prediction, flap, stamp and tour, and open the book again
$("restart").addEventListener("click", () => {
  try { localStorage.removeItem(STORE); } catch { /* nothing saved */ }
  const keep = saved.sound === false ? { sound: false } : {};
  try { if (keep.sound === false) localStorage.setItem(STORE, JSON.stringify(keep)); } catch { /* fine */ }
  location.reload();
});
$("bFull").addEventListener("click", () => {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
});
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $("bFull").hidden = true;
// inside the website's lab gallery, offer the way back to it
if (/\/lab\/[^/]+\/?$/.test(location.pathname)) $("bLab").hidden = false;
$("benchToggle").addEventListener("click", () => { const b = $("bench"); b.classList.toggle("closed"); $("benchToggle").setAttribute("aria-expanded", String(!b.classList.contains("closed"))); });
if (innerWidth < 1100) { $("bench").classList.add("closed"); $("benchToggle").setAttribute("aria-expanded", "false"); }
// with the bench open beside the figure, shift the picture so the figure sits in the free space
function viewShiftGoal() {
  const b = $("bench");
  if (b.classList.contains("closed") || innerWidth < 860) return 0;
  return (b.getBoundingClientRect().width + 16) / 2;
}
S.shift = viewShiftGoal();
function applyShift(dt) {
  const goal = viewShiftGoal();
  S.shift += (goal - S.shift) * (S.still ? 1 : 1 - Math.exp(-dt * 6));
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (Math.abs(S.shift) < 0.5) camera.clearViewOffset(); else camera.setViewOffset(w, h, S.shift, 0, w, h);
  camera.updateProjectionMatrix();
}
$("bPlay").addEventListener("click", () => { if (S.phase === "print") lift(); else if (S.tour.on) { stopTour(); saved.toured = true; save(); } else if (S.phase === "live") startTour(); });
$("bPrev").addEventListener("click", () => { if (S.tour.on) gotoShot(S.tour.i - 1); });
$("bNext").addEventListener("click", () => { if (S.tour.on) gotoShot(S.tour.i + 1); else if (S.phase === "print") lift(); });
$("bView").addEventListener("click", () => { stopTour(); S.view = S.view === "spread" ? "figure" : "spread"; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; });
$("bFold").addEventListener("click", fold);
$("bStill").addEventListener("click", () => { S.still = !S.still; $("bStill").setAttribute("aria-pressed", String(S.still)); document.body.classList.toggle("still", S.still); if (S.still) stopTour(); });
$("bText").addEventListener("click", () => { const a = $("a11y"); a.classList.toggle("open"); if (a.classList.contains("open")) a.focus(); });
$("bStill").setAttribute("aria-pressed", String(S.still));
function syncSound() { $("bSound").setAttribute("aria-pressed", String(sound.on)); $("bSound").title = sound.on ? "Sound on" : "Sound off"; }
$("bSound").addEventListener("click", () => { sound.setOn(!sound.on); saved.sound = sound.on; save(); syncSound(); });
syncSound();

// ---------- pointer: the handwheel, the printed page, orbiting ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [book.meshes.left, book.meshes.right, book.flapMesh];
  if (S.phase === "live") targets.unshift(rig.wheelHit);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) return null;
  if (hit.object === rig.wheelHit) return { kind: "wheel" };
  if (hit.object === book.flapMesh) return { kind: "flap" };
  const side = hit.object.userData.page;
  if (side && hit.uv) return book.hitAt(side, hit.uv.x * BOOK.W, (1 - hit.uv.y) * BOOK.D);
  return null;
}
function wheelAngle(e) {
  const c = rig.wheel.getWorldPosition(new THREE.Vector3()).project(camera);
  const r = canvas.getBoundingClientRect();
  const cx = r.left + (c.x * 0.5 + 0.5) * r.width, cy = r.top + (-c.y * 0.5 + 0.5) * r.height;
  return Math.atan2(-(e.clientY - cy), e.clientX - cx);
}
canvas.addEventListener("pointerdown", (e) => {
  const p = pick(e);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
  if (p && p.kind === "wheel") { stopTour(); drag = { kind: "wheel", a: wheelAngle(e) }; canvas.style.cursor = "grabbing"; return; }
  drag = { kind: "orbit", x: e.clientX, y: e.clientY, moved: 0, target: p };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) {
    const p = pick(e);
    canvas.style.cursor = p ? (p.kind === "wheel" ? "grab" : "pointer") : "default";
    return;
  }
  if (drag.kind === "wheel") {
    const a = wheelAngle(e);
    let d = a - drag.a;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    drag.a = a;
    S.uTo = Math.min(U_MAX, Math.max(0, S.uTo + (d / (Math.PI * 2)) / TURNS * U_MAX));
    syncControls();
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.moved > 6 && S.phase !== "peel") {
    if (S.tour.on) stopTour();
    S.orbit.yaw = Math.max(-40, Math.min(40, S.orbit.yaw - dx * 0.18));
    S.orbit.pitch = Math.max(-25, Math.min(30, S.orbit.pitch + dy * 0.14));
  }
});
canvas.addEventListener("pointerup", (e) => {
  if (drag && drag.kind === "orbit" && drag.moved <= 6 && drag.target) {
    if (drag.target.kind === "predict") predict(drag.target.id);
    if (drag.target.kind === "flap") toggleFlap();
  }
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); S.zoom = Math.max(0.55, Math.min(1.6, S.zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  const k = e.key;
  if (k === "ArrowRight" || k === "ArrowUp") { stopTour(); S.uTo = Math.min(U_MAX, S.uTo + 0.02 * U_MAX); syncControls(); e.preventDefault(); }
  else if (k === "ArrowLeft" || k === "ArrowDown") { stopTour(); S.uTo = Math.max(0, S.uTo - 0.02 * U_MAX); syncControls(); e.preventDefault(); }
  else if (k === "s" || k === "S") $("stir").click();
  else if (k === "d" || k === "D") $("dye").click();
  else if (k === "f" || k === "F") $("flush").click();
  else if (k === "v" || k === "V") $("bView").click();
  else if (k === "t" || k === "T") $("bText").click();
  else if (k === " ") { e.preventDefault(); $("bPlay").click(); }
  else if (k === "Escape") { stopTour(); S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; }
});

// ---------- size and quality ----------
const size = new THREE.Vector2();
let resizedAt = 0;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 2 || h < 2) return; // a zero-size frame while the window changes: keep the last size
  resizedAt = performance.now();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(size);
  const dpr = renderer.getPixelRatio();
  post.setSize(w, h, dpr);
  rig.pen.uRes.value.copy(size);
  inkMats.forEach((m) => (m.uniforms.uWidthPx.value = m.userData.basePx * dpr));
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
  slowWindows = mean > 24 ? slowWindows + 1 : 0;
  if (slowWindows >= 2 && tier > 0) {
    slowWindows = 0;
    tier--;
    key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
    key.shadow.map?.dispose(); key.shadow.map = null;
    post.enabled = TIERS[tier].bloom;
    rig.surf.uHatchQ.value = tier === 0 ? 0 : 1;
    resize();
  }
}

// ---------- start ----------
async function start() {
  try { await Promise.all([document.fonts.load(`600 20px ${SERIF}`), document.fonts.load(`italic 400 20px ${SERIF}`), document.fonts.load(`600 20px ${HAND}`)]); } catch { /* fallback fonts */ }
  book.drawLeft();
  book.drawRight(22, HINGE_MY);
  book.drawFlap();
  book.drawFlapBack();
  book.drawStamp();
  book.drawChart(null);
  rig.computePrintVisibility();
  syncControls();
  syncA11y();
  resize();
  setPhase("print");
  setCaption(lessonCaption());
  S.view = "spread";
  easeCamera(0);
  requestAnimationFrame(loop);
  const wait = S.still ? 200 : Math.max(0, 2600 - performance.now());
  setTimeout(() => document.body.classList.add("ready"), wait);
  if (params.has("live")) { setTimeout(() => { lift(); }, 50); }
}

let last = performance.now(), uiClock = 0, chartClock = 0, tagClock = 0, frameNo = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const raw = now - last;
  last = now;
  frameNo++;
  if (frameNo > 30) sampleFrame(raw);
  tick(Math.min(0.05, raw / 1000));
  render();
}

function tick(dt) {
  S.clock += dt;
  // the bench
  S.u += (S.uTo - S.u) * (1 - Math.exp(-dt / 0.25));
  flow.u = S.u; flow.T = S.T;
  flow.still = stillnessAfter(S.stillSet, S.clock - S.stirredAt);
  let rem = dt;
  while (rem > 1e-6) { const h = Math.min(rem, 1 / 90); flow.step(h); rem -= h; }
  const R = flow.readings();
  if (R.gamma > 0.3 && !S.seenTurb) { S.seenTurb = true; if (!S.tour.on) setCaption(lessonCaption()); }
  // the challenge: a straight thread below 3,000 that then breaks without the valve passing 3,000
  if (R.Re >= 3000) { S.armed = false; S.challengeT = 0; }
  else if (R.gamma < 0.02) S.armed = true;
  if (S.phase === "live" && !S.tour.on && S.armed && R.Re < 3000 && R.gamma > 0.08) { S.challengeT += dt; if (S.challengeT > 1.2) earnStamp(); } else S.challengeT = 0;

  tourStep(dt);
  stepPhase(dt);
  applyShift(dt);
  easeCamera(dt);
  rig.update(flow, R, dt, camera, { valveTurns: (S.u / U_MAX) * TURNS });
  if (S.phase !== "print") rig.updateSilhouettes(camera);
  rig.surf.uKeyView.value.copy(KEY_DIR).transformDirection(camera.matrixWorldInverse);
  book.update(dt);

  uiClock += dt; chartClock += dt; tagClock += dt;
  if (uiClock > 0.12) { uiClock = 0; readouts(R); }
  if (chartClock > 0.1) { chartClock = 0; book.drawChart(R); }
  if (tagClock > 0.15) {
    tagClock = 0;
    const word = R.regime === "turbulent" ? "turbulent" : R.regime === "transitional" ? "tearing" : "laminar";
    drawTag(rig.tags.re, { title: "Reynolds number", big: fmt(Math.round(R.Re / 10) * 10), word, wordColor: R.gamma > 0.04 ? DYE_COLOR : "#1c2433", note: `ρVD/μ · water at ${S.T} °C`, icon: Math.min(1, R.gamma * 1.6) });
    drawTag(rig.tags.dh, { title: "Head drop between taps", big: `${fmt(R.dh * 1000, 1)} mm`, note: `taps 0.9 m apart · f ${fmt(R.fMeasured, 3)}` });
  }
  if (captionHold > 0) { captionHold -= dt; if (captionHold <= 0) setCaption(S.tour.on ? SHOTS[S.tour.i].cap : lessonCaption()); }
  S.spillDue = (S.spillDue || 0) + 1;
  sound.update({ Qml: R.Q * 1e6, gamma: R.gamma, drawing: S.phase === "peel" && S.t < rig.drawEnd });
}

function render() {
  if (TIERS[tier].spill && S.surf > 0.01 && S.spillDue >= 2) { S.spillDue = 0; spill.render(scene); }
  post.render();
}

// for checks without a visible window: step the bench and the figure, then draw one frame
function advance(seconds, fps = 60) {
  const n = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < n; i++) tick(1 / fps);
  S.spillDue = 2;
  render();
  return { phase: S.phase, Re: Math.round(flow.Re), gamma: +flow.gamma.toFixed(2), shot: S.tour.on ? S.tour.i : null };
}

start();
// where a printed page point is on screen (for tests that click the page)
function screenOf(side, mx, my) {
  const p = pageToWorld(side, mx, my).project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
}
function tapPage(side, mx, my) {
  const { x, y } = screenOf(side, mx, my);
  for (const type of ["pointerdown", "pointerup"]) canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, isPrimary: true }));
  return { x: Math.round(x), y: Math.round(y) };
}
window.__rp = { S, flow, rig, book, camera, renderer, post, sound, lift, fold, startTour, advance, screenOf, tapPage, hideLoader: () => { $("loader").style.display = "none"; }, setTier: (t) => { tier = t; post.enabled = TIERS[t].bloom; resize(); } };
