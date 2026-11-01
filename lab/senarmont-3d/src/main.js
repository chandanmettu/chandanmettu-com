import * as THREE from "three";
import { Book, BOOK, OPTIONS, SERIF, HAND, pageToWorld } from "./book.js?v=325f87e0";
import { Rig, HEAT_COLOR, CX, CZ, PY, DRAW, SET_RANGE } from "./rig.js?v=325f87e0";
import { Post, Spill, GLOW_LAYER } from "./post.js?v=325f87e0";
import { createModel, MATERIALS, labTensor, frontsOf, AIR, WAX, PLATE } from "./model.js?v=325f87e0";
import { Sound } from "./sound.js?v=325f87e0";

const $ = (id) => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
const DEG = Math.PI / 180;
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
const TIERS = [{ dpr: 1, shadow: 1024, bloom: false, spill: false, steps: 24 }, { dpr: 1.25, shadow: 1024, bloom: true, spill: true, steps: 34 }, { dpr: 1.5, shadow: 2048, bloom: true, spill: true, steps: 44 }];
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

// ---------- the plate's model, the figure and the book ----------
const model = createModel({ N: 121, span: 41e-3 });
const FRAME = new THREE.Matrix4().makeTranslation(14, BOOK.Y, 40); // hinge line 40 mm below the page centre
const HINGE_MY = 40 + BOOK.D / 2;
const rig = new Rig({ frame: FRAME, model });
const spillU = { uSpill: rig.surf.uSpill, uSpillRect: rig.surf.uSpillRect, uSpillGain: { value: 1.25 } };
const book = new Book({ renderer, spill: spillU });
scene.add(book.group, rig.group);
const spill = new Spill(renderer, { x0: 8, x1: 178, z0: -60, z1: 45 });
rig.surf.uSpillTop.value = BOOK.Y + 24; // light from the plate fades on parts high above it
rig.surf.uSpill.value = spill.texture;
rig.surf.uSpillRect.value.copy(spill.rect);
rig.group.traverse((o) => { if (o.userData.glow) o.layers.enable(GLOW_LAYER); });
const post = new Post({ renderer, scene, camera });
const inkMats = [rig.inkMain, rig.inkFine, rig.inkBold, rig.sil.material];
inkMats.forEach((m) => (m.userData.basePx = m.uniforms.uWidthPx.value));
const F = (x, y, z) => V3(14 + x, BOOK.Y + y, 40 + z); // figure → world

// pick targets: the stage (drag to turn it) and the stylus (tap to lift or lower it)
const stageHit = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ visible: false }));
stageHit.rotation.x = -Math.PI / 2;
stageHit.position.set(CX, PY + 0.2, CZ);
rig.group.add(stageHit);
const heaterHit = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 34, 16), new THREE.MeshBasicMaterial({ visible: false }));
heaterHit.position.set(CX, PY + 27, CZ);
rig.heater.add(heaterHit);

// ---------- state ----------
const sound = new Sound();
const still = matchMedia("(prefers-reduced-motion: reduce)");
const STORE = "senarmont-plate-3d:v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { saved = {}; }
if (params.has("fresh")) saved = {};
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* storage off: the lesson still works */ } };

const SPEED = { fused: 3, zcut: 5, ycut: 5, custom: 5 }; // simulated seconds per real second, as on the figure page
const S = {
  phase: "print", t: 0, clock: 0,
  view: "spread",
  tour: { on: false, i: 0, t: 0 },
  key: "ycut", k1: MATERIALS.ycut.k1, k2: MATERIALS.ycut.k2,
  theta: 30 * DEG, thetaTo: 30 * DEG,
  lift: 0, liftTo: 0, set: 220, speed: 0,
  still: still.matches || params.has("still"),
  orbit: { yaw: 0, pitch: 0 }, zoom: 1,
  cam: null,
  challengeT: 0, armed: false, seenEllipse: false,
  surf: 0, lift3: 1, copy: 1, stand: 1,
};
book.state.predict = saved.predict ?? null;
book.state.flapSeen = !!saved.flap;
sound.on = saved.sound !== false;
for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => sound.wake(), { capture: true });
book.state.stamp = !!saved.stamp;
if (book.state.stamp) book.stampPress = 1;

function applyMaterial() {
  const m = MATERIALS[S.key];
  model.setMaterial({ k1: S.k1, k2: S.k2, rho: m.rho, cp: m.cp });
}
function choose(key) {
  S.key = key; S.k1 = MATERIALS[key].k1; S.k2 = MATERIALS[key].k2;
  applyMaterial(); model.reset(); syncControls();
}
applyMaterial();
model.stylus = S.set;

// ---------- views and the tour ----------
const VIEWS = {
  spread: { target: V3(0, BOOK.Y, 4), yaw: 0, pitch: 58, dist: 700, width: 440 },
  figure: { target: F(78, 22, -50), yaw: -16, pitch: 34, dist: 360, width: 180 },
  page: { target: V3(-100, BOOK.Y, 6), yaw: 0, pitch: 66, dist: 420, width: 214 },
};
const SHOTS = [
  { cap: "The stylus holds the centre of a waxed plate at its set temperature, 220 °C.", target: F(CX, 30, CZ), yaw: -26, pitch: 22, dist: 150, dur: 5.5, act: { plate: "fused" } },
  { cap: "Glass: heat spreads the same way in every direction, so the wax melts in a circle.", target: F(CX, 17, CZ + 9), yaw: 16, pitch: 42, dist: 165, dur: 8 },
  { cap: "Quartz cut along its c axis: the melt stretches into an ellipse, longest along c.", target: F(CX, 17, CZ + 9), yaw: 26, pitch: 44, dist: 165, dur: 9, act: { plate: "ycut" } },
  { cap: "Turn the stage: the ellipse turns with the crystal, not with the room.", target: F(CX, 16, CZ + 4), yaw: -10, pitch: 50, dist: 180, dur: 7, act: { theta: [30, 120] } },
  { cap: "The dial reads the tip, the tags read the melt. Your turn: drag the stage’s grip.", target: null, dur: 3.5 },
];

function goal() {
  let g;
  const aspect = camera.aspect;
  if (S.tour.on) {
    const shot = SHOTS[S.tour.i];
    g = shot.target ? { target: shot.target, yaw: shot.yaw, pitch: shot.pitch, dist: shot.dist, width: shot.dist * 0.42 } : VIEWS.figure;
  } else g = S.view === "spread" && aspect < 0.85 ? VIEWS.page : VIEWS[S.view];
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
  if (p === "print") { S.lift3 = 1; S.surf = 0; S.copy = 1; S.stand = 1; }
  if (p === "live") { S.surf = 1; S.copy = 0; S.stand = 1; }
  if (p === "peel") { S.copy = 1; S.stand = 1; S.lift3 = 1; S.surf = 0; }
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
  if (S.phase === "print") u.uClock.value = 0;
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
    S.lift3 = 1 - s;
    const r = smooth((s - 0.78) / 0.22);
    S.copy = r; S.stand = 1 - r;
    if (S.t >= 0.62) { setPhase("print"); setCaption(lessonCaption()); }
  }
  u.uLift.value = S.lift3;
  u.uCopyAll.value = S.phase === "peel" ? 0 : 1;
  u.uStandAlpha.value = S.stand;
  u.uCopyAlpha.value = S.copy;
  const showCopy = S.phase !== "live" && S.phase !== "shade";
  for (const set of [...rig.sets, rig.sil]) set.flat.visible = showCopy && !set.noPrint;
  rig.surf.uSurfAlpha.value = S.surf;
  rig.surf.uLiftSurf.value = S.phase === "undraw" ? S.lift3 : 1;
  if (rig.shadowDepth) rig.shadowDepth.opacity = S.surf;
  const cast = S.surf > 0.01;
  for (const m of rig.surfaces) m.castShadow = cast && m.userData.cast !== false;
}

// ---------- the lesson loop ----------
const aligned = () => { const d = ((S.theta % Math.PI) + Math.PI) % Math.PI; return Math.min(d, Math.PI - d) / DEG; };
function lessonCaption() {
  if (S.phase === "print") return book.state.predict ? "Lift the drawing off the page." : "1 · Predict: tick what you expect on the left page, then lift the drawing.";
  if (book.state.stamp) return "Stamp earned. Now try a custom crystal: set k₁ four times k₂ and the melt runs twice as long as it is wide.";
  if (!S.seenEllipse) return "2 · Try: pick Quartz, Y-cut on the bench card and watch the melt grow.";
  if (!book.state.flapSeen) return "An ellipse. Now lift the flap on the left page to see why (⧉ shows the page).";
  return "3 · Challenge: on the Y-cut plate, line the melt’s long axis up with the arrow on the base.";
}
let captionHold = 0;
function setCaption(t, hold = 0) { $("caption").textContent = t; captionHold = hold; }
function startTourIfFirst() {
  if (!saved.toured && !S.still) startTour();
  else setCaption(lessonCaption());
}
function startTour() { S.tour.on = true; S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; gotoShot(0); syncPlay(); }
function stopTour() { if (!S.tour.on) return; S.tour.on = false; drawDots(); syncPlay(); setCaption(lessonCaption()); }
function tourStep(dt) {
  if (!S.tour.on) return;
  S.tour.t += dt;
  const shot = SHOTS[S.tour.i];
  if (shot.act && shot.act.theta) {
    const k = smooth((S.tour.t - 0.8) / Math.max(1, shot.dur - 2));
    setTheta((shot.act.theta[0] + (shot.act.theta[1] - shot.act.theta[0]) * k) * DEG, false);
  }
  if (S.tour.t >= shot.dur) gotoShot(S.tour.i + 1);
}
function gotoShot(i) {
  if (i >= SHOTS.length) { S.tour.on = false; saved.toured = true; save(); S.view = "figure"; drawDots(); syncPlay(); setCaption(lessonCaption()); return; }
  S.tour.i = Math.max(0, i); S.tour.t = 0;
  const shot = SHOTS[S.tour.i];
  if (shot.act && shot.act.plate) { choose(shot.act.plate); S.liftTo = 0; setTheta(30 * DEG, false); }
  setCaption(shot.cap);
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
  $("a11yLive").textContent = "Stamp earned: the melt's long axis lines up with the bench's x axis.";
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
  g.font = `600 ${lines.size || 7.4}px ${HAND}`; g.fillStyle = lines.color || "#1c2433";
  g.fillText(lines.big, 2.8, 12.6);
  g.font = `italic 400 2.3px ${SERIF}`; g.fillStyle = "#4c5466";
  g.fillText(lines.note, 2.8, tag.h - 2.6);
  tag.tex.needsUpdate = true;
}

// ---------- the bench card and the text version ----------
function setTheta(rad, fromUser = true) {
  S.thetaTo = rad;
  if (fromUser) stopTour();
  const deg = ((Math.round(rad / DEG) % 360) + 360) % 360;
  $("theta").value = String(deg);
  $("theta-out").textContent = `${deg}°`;
}
function syncControls() {
  $("k1-out").textContent = S.k1.toFixed(2);
  $("k2-out").textContent = S.k2.toFixed(2);
  $("ts-out").textContent = `${S.set} °C`;
  $("ts").value = String(S.set);
  const custom = S.key === "custom";
  for (const id of ["k1", "k2"]) { $(id).disabled = !custom; $(id).value = String(id === "k1" ? S.k1 : S.k2); }
  document.querySelectorAll("[data-plate]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.plate === S.key)));
  $("plate-note").textContent = MATERIALS[S.key].note;
  $("lift").textContent = S.liftTo ? "Lower the stylus" : "Lift the stylus";
  $("lift").setAttribute("aria-pressed", String(!!S.liftTo));
}
function syncA11y() {
  const box = $("a11yPredict");
  box.innerHTML = OPTIONS.map((o) => `<button type="button" data-id="${o.id}" aria-pressed="${book.state.predict === o.id}">${o.id}. ${o.text}</button>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => predict(b.dataset.id)));
}
const RISE = WAX.Tm - AIR.T0;
function readings() {
  const { a, b } = frontsOf(model);
  const melted = a > 0 && b > 0;
  const front = [];
  if (melted) for (let i = 0; i < 72; i++) front.push(model.frontAt((i / 72) * Math.PI * 2));
  return { a: melted ? a : 0, b: melted ? b : 0, front: melted ? front : null, k1: S.k1, k2: S.k2, label: MATERIALS[S.key].label, on: model.on, tip: model.tip() + AIR.T0, power: model.on ? model.power : 0 };
}
let lastSay = "";
function readouts(R) {
  const set = (id, v) => { const el = $(id); if (el && el.textContent !== v) el.textContent = v; };
  set("r-time", `${fmt(model.time, 0)} s`);
  set("r-speed", `×${fmt(S.speed, 1)}`);
  set("r-power", model.on ? `${fmt(model.power, 2)} W` : "0 W · lifted");
  set("r-tip", `${fmt(R.tip, 0)} °C`);
  set("r-front", R.a > 0 ? `${fmt(R.a * 1e3, 1)} × ${fmt(R.b * 1e3, 1)} mm` : "no melt yet");
  set("r-ratio", R.a > 0 ? fmt(R.a / R.b, 3) : "–");
  set("r-sqrt", fmt(Math.sqrt(S.k1 / S.k2), 3));
  const K = labTensor(S.k1, S.k2, S.theta);
  set("r-kxx", fmt(K.xx, 2)); set("r-kxy", fmt(K.xy, 2)); set("r-kyx", fmt(K.xy, 2)); set("r-kyy", fmt(K.yy, 2));
  set("r-theta", `${((Math.round(S.theta / DEG) % 360) + 360) % 360}°`);
  set("r-big", R.a > 0 ? fmt(R.a / R.b, 2) : "–");
  set("r-bigsub", R.a > 0 ? `a / b · √(k₁/k₂) ${fmt(Math.sqrt(S.k1 / S.k2), 2)}` : model.on ? "warming, no melt yet" : "stylus lifted");
  const say = R.a > 0 ? `Melt ${fmt(R.a * 1e3, 1)} by ${fmt(R.b * 1e3, 1)} mm, a over b ${fmt(R.a / R.b, 2)}.` : "No melt yet.";
  if (say !== lastSay && Math.round(model.time) % 5 === 0) { lastSay = say; $("a11yLive").textContent = say; }
}

document.querySelectorAll("[data-plate]").forEach((b) => b.addEventListener("click", () => { stopTour(); choose(b.dataset.plate); }));
$("k1").addEventListener("input", (e) => { S.k1 = Number(e.target.value); applyMaterial(); syncControls(); });
$("k2").addEventListener("input", (e) => { S.k2 = Number(e.target.value); applyMaterial(); syncControls(); });
$("ts").addEventListener("input", (e) => { S.set = Math.round(Number(e.target.value) / 5) * 5; syncControls(); });
$("theta").addEventListener("input", (e) => setTheta(Number(e.target.value) * DEG));
$("lift").addEventListener("click", () => { S.liftTo = S.liftTo ? 0 : 1; syncControls(); });
$("fresh").addEventListener("click", () => { model.reset(); });
$("restart").addEventListener("click", () => {
  try { localStorage.removeItem(STORE); } catch { /* nothing saved */ }
  try { if (saved.sound === false) localStorage.setItem(STORE, JSON.stringify({ sound: false })); } catch { /* fine */ }
  location.reload();
});
$("bFull").addEventListener("click", () => {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
});
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $("bFull").hidden = true;
if (/\/lab\/[^/]+\/?$/.test(location.pathname)) $("bLab").hidden = false;
$("benchToggle").addEventListener("click", () => { const b = $("bench"); b.classList.toggle("closed"); $("benchToggle").setAttribute("aria-expanded", String(!b.classList.contains("closed"))); });
if (innerWidth < 1100) { $("bench").classList.add("closed"); $("benchToggle").setAttribute("aria-expanded", "false"); }
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

// ---------- pointer: the stage, the stylus, the printed page, orbiting ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [book.meshes.left, book.meshes.right, book.flapMesh];
  if (S.phase === "live") targets.unshift(heaterHit, stageHit);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) return null;
  if (hit.object === stageHit) return { kind: "stage" };
  if (hit.object === heaterHit) return { kind: "stylus" };
  if (hit.object === book.flapMesh) return { kind: "flap" };
  const side = hit.object.userData.page;
  if (side && hit.uv) return book.hitAt(side, hit.uv.x * BOOK.W, (1 - hit.uv.y) * BOOK.D);
  return null;
}
// the angle of the pointer about the stage axis, on the plate's plane, in the bench's frame
const plane = new THREE.Plane();
function stageAngle(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const c = F(CX, PY, CZ);
  plane.setFromNormalAndCoplanarPoint(V3(0, 1, 0), c);
  const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
  if (!p) return null;
  return Math.atan2(-(p.z - c.z), p.x - c.x);
}
canvas.addEventListener("pointerdown", (e) => {
  const p = pick(e);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
  if (p && p.kind === "stage") { stopTour(); drag = { kind: "stage", a: stageAngle(e), moved: 0 }; canvas.style.cursor = "grabbing"; return; }
  drag = { kind: "orbit", x: e.clientX, y: e.clientY, moved: 0, target: p };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) {
    const p = pick(e);
    canvas.style.cursor = p ? (p.kind === "stage" ? "grab" : "pointer") : "default";
    return;
  }
  if (drag.kind === "stage") {
    const a = stageAngle(e);
    if (a == null || drag.a == null) { drag.a = a; return; }
    let d = a - drag.a;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    drag.a = a;
    setTheta(S.thetaTo + d);
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
canvas.addEventListener("pointerup", () => {
  if (drag && drag.kind === "orbit" && drag.moved <= 6 && drag.target) {
    if (drag.target.kind === "predict") predict(drag.target.id);
    if (drag.target.kind === "flap") toggleFlap();
    if (drag.target.kind === "stylus") { S.liftTo = S.liftTo ? 0 : 1; syncControls(); sound.tick(); }
  }
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); S.zoom = Math.max(0.55, Math.min(1.6, S.zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  const k = e.key, big = e.shiftKey ? 15 : 5;
  if (k === "ArrowLeft") { setTheta(S.thetaTo + big * DEG); e.preventDefault(); }
  else if (k === "ArrowRight") { setTheta(S.thetaTo - big * DEG); e.preventDefault(); }
  else if (k === "ArrowUp") { S.set = Math.min(SET_RANGE[1], S.set + 10); syncControls(); e.preventDefault(); }
  else if (k === "ArrowDown") { S.set = Math.max(SET_RANGE[0], S.set - 10); syncControls(); e.preventDefault(); }
  else if (k === "l" || k === "L") $("lift").click();
  else if (k === "r" || k === "R") $("fresh").click();
  else if (["1", "2", "3", "4"].includes(k)) { stopTour(); choose(["fused", "zcut", "ycut", "custom"][Number(k) - 1]); }
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
  if (w < 2 || h < 2) return;
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
  book.drawRight(14, HINGE_MY);
  book.drawFlap();
  book.drawFlapBack();
  book.drawStamp();
  book.drawChart(null);
  rig.update({ theta: S.theta, lift: 0, tip: AIR.T0, set: S.set, power: 0, on: true });
  rig.computePrintVisibility();
  syncControls();
  setTheta(S.thetaTo, false);
  syncA11y();
  resize();
  setPhase("print");
  setCaption(lessonCaption());
  S.view = "spread";
  easeCamera(0);
  requestAnimationFrame(loop);
  const wait = S.still ? 200 : Math.max(0, 2600 - performance.now());
  setTimeout(() => document.body.classList.add("ready"), wait);
  if (params.has("live")) setTimeout(() => lift(), 50);
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
  // the bench: the stage and the stylus ease to where they were sent
  const calm = S.still;
  const ease = (from, to, tau) => (calm ? to : from + (to - from) * (1 - Math.exp(-dt / tau)));
  S.theta = ease(S.theta, S.thetaTo, 0.35);
  S.lift = ease(S.lift, S.liftTo, 0.22);
  if (Math.abs(S.theta - S.thetaTo) < 1e-4) S.theta = S.thetaTo;
  if (Math.abs(S.lift - S.liftTo) < 1e-3) S.lift = S.liftTo;
  model.on = S.liftTo === 0 && S.lift < 0.03;
  model.stylus = S.set;
  // the plate: simulated time runs faster than real time, capped so a frame stays cheap
  const want = dt * SPEED[S.key] * (calm ? 4 : 1);
  const sim = Math.min(want, model.stableDt() * TIERS[tier].steps);
  if (S.phase !== "print" || S.tour.on) model.step(sim);
  S.speed = dt > 0 ? sim / dt : 0;
  const R = readings();
  if (S.key !== "fused" && S.key !== "zcut" && R.a > 0 && R.a / R.b > 1.15 && !S.seenEllipse) { S.seenEllipse = true; if (!S.tour.on) setCaption(lessonCaption()); }
  // the challenge: start crooked, then bring the Y-cut melt's long axis onto the bench's x axis
  const dev = aligned();
  if (S.key !== "ycut") { S.armed = false; S.challengeT = 0; }
  else if (dev > 15) S.armed = true;
  if (S.phase === "live" && !S.tour.on && S.armed && S.key === "ycut" && R.a > 0.004 && dev <= 4) { S.challengeT += dt; if (S.challengeT > 1.2) earnStamp(); } else S.challengeT = 0;

  tourStep(dt);
  stepPhase(dt);
  applyShift(dt);
  easeCamera(dt);
  rig.update({ theta: S.theta, lift: S.lift, tip: R.tip, set: S.set, power: R.power, on: model.on });
  if (S.phase !== "print") rig.updateSilhouettes(camera);
  rig.surf.uKeyView.value.copy(KEY_DIR).transformDirection(camera.matrixWorldInverse);
  book.update(dt);

  uiClock += dt; chartClock += dt; tagClock += dt;
  if (uiClock > 0.12) { uiClock = 0; readouts(R); }
  if (chartClock > 0.15) { chartClock = 0; book.drawChart(R); }
  if (tagClock > 0.15) {
    tagClock = 0;
    drawTag(rig.tags.front, R.a > 0
      ? { title: "Melt front, a × b", big: `${fmt(R.a * 1e3, 1)} × ${fmt(R.b * 1e3, 1)} mm`, size: 6.2, color: R.a / R.b > 1.03 ? "#c4520c" : "#1c2433", note: `a/b ${fmt(R.a / R.b, 2)} · √(k₁/k₂) ${fmt(Math.sqrt(S.k1 / S.k2), 2)}` }
      : { title: "Melt front, a × b", big: model.on ? "warming…" : "lifted", size: 6.2, note: `wax melts at ${WAX.Tm} °C` });
    drawTag(rig.tags.stylus, { title: "Stylus tip", big: `${fmt(R.tip, 0)} °C`, size: 6.6, note: model.on ? `${fmt(R.power, 2)} W · clock ×${fmt(S.speed, 1)}` : `lifted · clock ×${fmt(S.speed, 1)}` });
  }
  if (captionHold > 0) { captionHold -= dt; if (captionHold <= 0) setCaption(S.tour.on ? SHOTS[S.tour.i].cap : lessonCaption()); }
  S.spillDue = (S.spillDue || 0) + 1;
  sound.update({ heat: model.on ? Math.min(1, R.power / 1.2) : 0, drawing: S.phase === "peel" && S.t < rig.drawEnd });
}

function render() {
  if (TIERS[tier].spill && S.surf > 0.01 && S.spillDue >= 2) { S.spillDue = 0; spill.render(scene); }
  post.render();
}

function advance(seconds, fps = 60) {
  const n = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < n; i++) tick(1 / fps);
  S.spillDue = 2;
  render();
  const R = readings();
  return { phase: S.phase, t: +model.time.toFixed(1), a: +(R.a * 1e3).toFixed(2), b: +(R.b * 1e3).toFixed(2), theta: +(S.theta / DEG).toFixed(1), shot: S.tour.on ? S.tour.i : null };
}

start();
function screenOf(side, mx, my) {
  const p = pageToWorld(side, mx, my).project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
}
function screenOfFig(x, y, z) {
  const p = F(x, y, z).project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
}
function tapPage(side, mx, my) {
  const { x, y } = screenOf(side, mx, my);
  for (const type of ["pointerdown", "pointerup"]) canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, isPrimary: true }));
  return { x: Math.round(x), y: Math.round(y) };
}
window.__sp = { pick: (x, y) => pick({ clientX: x, clientY: y }), stageAngleAt: (x, y) => stageAngle({ clientX: x, clientY: y }), S, model, rig, book, camera, renderer, post, sound, lift, fold, startTour, stopTour, advance, choose, setTheta, screenOf, screenOfFig, tapPage, hideLoader: () => { $("loader").style.display = "none"; }, setTier: (t) => { tier = t; post.enabled = TIERS[t].bloom; resize(); }, PLATE, DRAW };
