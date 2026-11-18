// Lipase at the interface: one page, six chapters, every atom from PDB 1DT3 and 1GT6.
// Round 2 (19 Nov 2026): no transparency sorting decides what is in front (see protein.js), cards that move and
// hide, a reaction player that animates every step both ways, and conditions that apply to the 3D scene.
// The tour plays the chapters in order; any click, drag, wheel or key hands control over, 25 s of quiet hands it
// back (only if the tour was playing). window.__lip carries the hooks the headless checks and the deck stills use.
import * as THREE from "three";
import { createStage } from "./stage.js?v=3be210fe";
import { createProtein } from "./protein.js?v=3be210fe";
import { createWorld, IFACE_Y } from "./world.js?v=3be210fe";
import { createReaction, STEPS, STEP_RANGE, STEP_DUR, STEP_SHORT } from "./chem.js?v=3be210fe";
import { createScale } from "./scale.js?v=3be210fe";
import { createConditions } from "./conditions.js?v=3be210fe";
import { CHAPTERS } from "./chapters.js?v=3be210fe";
import { createSlider } from "./slider.js?v=3be210fe";
import { makeCard, hideAll, uiHidden } from "./ui.js?v=3be210fe";
import * as Mo from "./model.js?v=3be210fe";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const canvas = $("c");
const isPhone = () => innerWidth < 760;
const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

let stage;
try { stage = createStage(canvas); } catch (e) { document.body.classList.add("nogl"); throw e; }
const { scene, camera } = stage;
const sceneFog = scene.fog;

const data = await (await fetch("./data/tll.json?v=3be210fe")).json();
const protein = createProtein(data);
const rig = new THREE.Group();            // positions and orients the enzyme; the lid side faces down (-y)
rig.quaternion.setFromUnitVectors(protein.face, new THREE.Vector3(0, -1, 0));
const spinner = new THREE.Group();
spinner.add(rig);
rig.add(protein.group);
scene.add(spinner);
const world = createWorld(scene);
const reaction = createReaction(protein);
protein.group.add(reaction.group);
reaction.group.visible = false;
const levels = createScale(scene, protein);
const cond3d = createConditions(scene, protein, IFACE_Y);

// measurements from the coordinates (printed in the cards and the text version)
const m = (() => {
  protein.lid = 0; protein.update(0);
  const trpSer = protein.distance([89, "CZ2"], [146, "OG"]);
  const serHis = protein.distance([146, "OG"], [258, "NE2"]);
  const hisAsp = Math.min(protein.distance([258, "ND1"], [201, "OD1"]), protein.distance([258, "ND1"], [201, "OD2"]));
  const mv = data.meta.movedOver3A;
  const c = protein.cur, box = new THREE.Box3();
  for (let i = 0; i < c.length; i += 3) box.expandByPoint(new THREE.Vector3(c[i], c[i + 1], c[i + 2]));
  const mx = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  return { nRes: data.meta.nRes, trpSer, serHis, hisAsp, glu87: mv["87"], gly91: mv["91"], rmsd: data.meta.coreRmsd, size: `${(mx / 10).toFixed(1)} nm` };
})();

// ---------------------------------------------------------------- state
const S = {
  ch: 0, st: 0, t: 0,
  cam: { tx: 0, ty: 60, tz: 0, az: 200, el: 12, d: 160, sx: 0, sy: 0 }, goal: null,
  orbit: { az: 0, el: 0 }, zoom: 1,
  lidGoal: 0, y: 70, yGoal: 70, spin: 0, worldGoal: 0, worldNow: 0, glass: 1, glassGoal: 1, sticks: 0, sticksGoal: 0,
  surface: false, surfaceUser: null, surfNow: 0,
  level: null,
  labels: true, tour: { on: false, t: 0, idle: 0, wasOn: false, done: 0 }, still: params.has("still"),
  cond: { ...Mo.DEFAULTS }, condTour: -1, big: 100, grey: 0, tintAmt: 0,
  mode: "methanol", picks: {},
};

// ---------------------------------------------------------------- reaction player (a clock over the 8 steps)
const T0 = [0]; STEP_DUR.forEach((d, i) => T0.push(T0[i] + d));
const TT = T0[T0.length - 1];
const ease = (f) => (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2);
const PL = { tau: 0, target: null, playing: false, speed: 1, shown: -1 };
const stepAt = (tau) => { for (let k = 0; k < 8; k++) if (tau <= T0[k + 1] + 1e-6) return k; return 7; };
const sOf = (tau) => {
  const t = Math.max(0, Math.min(TT, tau));
  const k = Math.min(7, T0.findIndex((v, i) => i > 0 && t <= v + 1e-9) - 1);
  const kk = k < 0 ? 0 : k, [a, b] = STEP_RANGE[kk];
  return a + (b - a) * ease((t - T0[kk]) / STEP_DUR[kk]);
};
const player = {
  play() { if (PL.tau >= TT - 1e-3) PL.tau = 0; PL.playing = true; PL.target = null; paintPlayer(); },
  pause() { PL.playing = false; paintPlayer(); },
  toggle() { PL.playing ? player.pause() : player.play(); },
  forward() { PL.playing = false; const k = stepAt(PL.tau); const end = T0[k + 1]; PL.target = PL.tau < end - 1e-3 ? end : Math.min(TT, T0[Math.min(8, k + 2)]); paintPlayer(); },
  back() { PL.playing = false; const k = stepAt(PL.tau); const start = T0[k]; PL.target = PL.tau > start + 1e-3 ? start : T0[Math.max(0, k - 1)]; paintPlayer(); },
  goTo(k) {
    PL.playing = false;
    const cur = stepAt(PL.tau);
    if (!(k === cur + 1 && Math.abs(PL.tau - T0[k]) < 0.05)) PL.tau = T0[k];
    PL.target = T0[k + 1]; paintPlayer();
  },
  scrubTo(f) { PL.playing = false; PL.target = null; PL.tau = Math.max(0, Math.min(TT, f * TT)); paintPlayer(); },
  update(dt) {
    if (PL.playing) { PL.tau += dt * PL.speed; if (PL.tau >= TT) { PL.tau = TT; PL.playing = false; paintPlayer(); } }
    else if (PL.target !== null) {
      const d = PL.target - PL.tau, step = dt * PL.speed;
      if (Math.abs(d) <= step) { PL.tau = PL.target; PL.target = null; } else PL.tau += Math.sign(d) * step;
    }
  },
};

// ---------------------------------------------------------------- labels
const LABELS = {
  lid: { t: "Lid · residues 82–96", at: () => protein.pos(88, "CA", new THREE.Vector3()) },
  ser: { t: "Ser146", at: () => protein.pos(146, "OG", new THREE.Vector3()), k: "ser" },
  his: { t: "His258", at: () => protein.pos(258, "CE1", new THREE.Vector3()), k: "his" },
  asp: { t: "Asp201", at: () => protein.pos(201, "CG", new THREE.Vector3()), k: "asp" },
  dSH: { t: () => `${m.serHis.toFixed(1)} Å`, at: () => protein.pos(146, "OG", new THREE.Vector3()).lerp(protein.pos(258, "NE2", new THREE.Vector3()), 0.5), small: true },
  dHA: { t: () => `${m.hisAsp.toFixed(1)} Å`, at: () => protein.pos(258, "ND1", new THREE.Vector3()).lerp(protein.pos(201, "OD1", new THREE.Vector3()), 0.5), small: true },
  oxL: { t: "Leu147 N–H", at: () => protein.hOf(147) },
  oxS: { t: "Ser83 N–H", at: () => protein.hOf(83) },
  c: { t: "C=O of the ester", at: () => reaction.anchors.C().clone() },
  ox: { t: "Oxyanion O⁻", at: () => reaction.anchors.Ox().clone(), k: "ox" },
  dg: { t: "Diglyceride leaving", at: () => reaction.anchors.Og().clone(), k: "oil" },
  meoh: { t: () => (S.mode === "water" ? "Water" : "Methanol"), at: () => reaction.anchors.Om().clone() },
  prod: { t: () => (S.mode === "water" ? "Free fatty acid" : "Methyl ester · biodiesel"), at: () => reaction.anchors.prod().clone(), k: "prod" },
  oil: { t: "Used cooking oil", world: () => new THREE.Vector3(60, IFACE_Y - 6, 30), k: "oil" },
  patch: { t: "Water-avoiding face", at: () => protein.pos(90, "CA", new THREE.Vector3()), k: "oil" },
  // conditions (chapter 5): shown when they apply
  cHis: { t: () => `His258 + H⁺ · triad off (${Math.round(Mo.readings(S.cond).hisH * 100)} %)`, at: () => protein.pos(258, "NE2", new THREE.Vector3()), k: "his" },
  cIon: { t: () => { const R = Mo.readings(S.cond); return `${R.ion.sym} on the surface · ${R.ion.v} %`; }, world: () => cond3d.ionAnchor() },
  cHot: { t: "Lid and loops loosening · illustrative", at: () => protein.pos(87, "CA", new THREE.Vector3()) },
  cMeoh: { t: "Inactivated by methanol", at: () => protein.pos(40, "CA", new THREE.Vector3()) },
  cProd: { t: "Biodiesel leaving", world: () => cond3d.prodAnchor(), k: "prod" },
  rFeed: { t: "Used cooking oil + methanol", world: () => new THREE.Vector3(-12, 9.5, 0), k: "oil" },
  rBed: { t: "Packed bed of immobilised lipase", world: () => new THREE.Vector3(2.6, 20, 0), k: "enz" },
  rFame: { t: "Biodiesel (methyl esters)", world: () => new THREE.Vector3(14, 12, 2), k: "prod" },
  rGly: { t: "Glycerol, denser, sinks", world: () => new THREE.Vector3(14, 3.5, 2) },
  bOil: { t: "Oil and methanol soak in", world: () => new THREE.Vector3(150, 200, 60), k: "oil" },
  bPore: { t: "Pores lined with lipase", world: () => new THREE.Vector3(-120, 60, 210), k: "enz" },
  cEnz: { t: "Lipase, lid open, on the carrier", world: () => new THREE.Vector3(60, 40, 120), k: "enz" },
  cCar: { t: "Water-avoiding carrier surface", world: () => new THREE.Vector3(-90, -12, 230) },
};
const labelEls = new Map();
function labelEl(id) {
  if (labelEls.has(id)) return labelEls.get(id);
  const el = document.createElement("span");
  el.className = "lab" + (LABELS[id].small ? " small" : "") + (LABELS[id].k ? " " + LABELS[id].k : "");
  $("labels").appendChild(el);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  $("labels").querySelector("svg").appendChild(line);
  const o = { el, line, w: 0, txt: "" };
  labelEls.set(id, o);
  return o;
}
function worldOf(id) { const L = LABELS[id]; return L.world ? L.world() : protein.group.localToWorld(L.at()); }
const OBST = ["card", "bench", "player", "dock", "top"];
function drawLabels(active) {
  const list = S.labels && !uiHidden() ? active : [];
  const rects = OBST.map((id) => $(id)).filter((e) => e && !e.hidden && e.offsetParent !== null).map((e) => e.getBoundingClientRect());
  const blocked = (x0, x1, y) => rects.some((r) => x0 < r.right + 6 && x1 > r.left - 6 && y + 14 > r.top - 4 && y - 14 < r.bottom + 4);
  for (const [id, o] of labelEls) if (!list.includes(id)) { o.el.style.opacity = 0; o.line.style.opacity = 0; }
  const placed = [];
  for (const id of list) {
    if (!LABELS[id]) continue;
    const o = labelEl(id), L = LABELS[id];
    const p = stage.project(worldOf(id));
    if (!p) { o.el.style.opacity = 0; o.line.style.opacity = 0; continue; }
    const txt = typeof L.t === "function" ? L.t() : L.t;
    if (o.txt !== txt) { o.el.textContent = txt; o.txt = txt; o.w = o.el.offsetWidth || txt.length * 7.5 + 24; }
    const x = p[0], y = p[1];
    if (L.small) { o.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; o.line.style.opacity = 0; o.el.style.opacity = 1; continue; }
    const wEl = o.w;
    let right = x > stage.size.w * 0.55;
    let lx = x + (right ? 46 : -46), ly = y - 46;
    if (!right && lx - wEl < 8) { right = true; lx = x + 46; }
    if (right && lx + wEl > stage.size.w - 8) { right = false; lx = x - 46; }
    lx = right ? Math.min(lx, stage.size.w - 8 - wEl) : Math.max(lx, 8 + wEl);
    const free = (rt, lxx, lyy) => { const x0 = rt ? lxx : lxx - wEl; return !placed.some((q) => x0 < q[1] && x0 + wEl > q[0] && Math.abs(q[2] - lyy) < 28) && !blocked(x0, x0 + wEl, lyy); };
    let ok = false;
    for (const side of [right, !right]) {
      let tx = x + (side ? 46 : -46);
      tx = side ? Math.min(tx, stage.size.w - 8 - wEl) : Math.max(tx, 8 + wEl);
      for (const dy of [-46, -76, -16, -106, 14, -136, 44]) { if (free(side, tx, y + dy)) { right = side; lx = tx; ly = y + dy; ok = true; break; } }
      if (ok) break;
    }
    if (!ok) { o.el.style.opacity = 0; o.line.style.opacity = 0; continue; }
    placed.push([right ? lx : lx - wEl, right ? lx + wEl : lx, ly]);
    o.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(${right ? "0" : "-100%"}, -50%)`;
    o.el.style.opacity = 1;
    o.line.setAttribute("x1", x.toFixed(1)); o.line.setAttribute("y1", y.toFixed(1)); o.line.setAttribute("x2", lx.toFixed(1)); o.line.setAttribute("y2", ly.toFixed(1));
    o.line.style.opacity = 0.9;
  }
}

// ---------------------------------------------------------------- cards
const capCard = makeCard($("card"), "caption");
const plCard = makeCard($("player"), "player");
const benchCard = makeCard($("bench"), "bench");

// ---------------------------------------------------------------- chapters and steps
const step = () => CHAPTERS[S.ch].steps[S.st];
function renderNav() {
  $("chapters").innerHTML = CHAPTERS.map((c, i) => `<button type="button" data-i="${i}" aria-current="${i === S.ch}"><span class="n">0${i + 1}</span><span class="s">${c.short}</span></button>`).join("");
  $("chapters").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { handOver(); go(Number(b.dataset.i), 0); }));
}
function renderCard(swap = false) {
  const c = CHAPTERS[S.ch], s = step();
  $("kicker").textContent = c.kicker;
  $("pillK").textContent = c.kicker.split("·")[0].trim();
  $("pillT").textContent = s.title;
  $("title").textContent = s.title;
  const pick = S.picks[`${S.ch}-${S.st}`];
  $("body").innerHTML = s.body({ m, S }) + (s.predict ? `<div class="predict"><p class="q">${s.predict.q}</p><div class="opts">${s.predict.options.map(([k, t]) => `<button type="button" data-pk="${k}" class="${pick ? (k === s.predict.answer ? "right" : k === pick ? "wrong" : "") : ""}" aria-pressed="${pick === k}">${t}</button>`).join("")}</div>${pick ? `<p class="small" style="margin-top:8px">${pick === s.predict.answer ? "Right." : "Not quite."} ${s.predict.why}</p>` : ""}</div>` : "");
  $("body").querySelectorAll("[data-pk]").forEach((b) => b.addEventListener("click", () => { handOver(); S.picks[`${S.ch}-${S.st}`] = b.dataset.pk; renderCard(); }));
  if (swap) { const b = $("card").querySelector(".card-body"); b.classList.remove("fade-swap"); void b.offsetWidth; b.classList.add("fade-swap"); }
  const rail = $("rail");
  if (c.steps.length > 1 && !c.player) {
    rail.hidden = false;
    rail.innerHTML = `<div class="rail-bars">${c.steps.map((x, i) => `<button type="button" data-s="${i}" class="${i < S.st ? "done" : ""}" aria-current="${i === S.st}" title="${x.title}" aria-label="Step ${i + 1}: ${x.title}"></button>`).join("")}</div><div class="rail-cap"><span>Step <b>${S.st + 1}</b> of ${c.steps.length}</span><span>${S.st < c.steps.length - 1 ? "Next: " + c.steps[S.st + 1].title : ""}</span></div>`;
    rail.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { handOver(); go(S.ch, Number(b.dataset.s)); }));
  } else { rail.hidden = true; rail.innerHTML = ""; }
}
function go(ch, st = 0) {
  const prevCh = S.ch;
  S.ch = Math.max(0, Math.min(CHAPTERS.length - 1, ch));
  S.st = Math.max(0, Math.min(CHAPTERS[S.ch].steps.length - 1, st));
  const c = CHAPTERS[S.ch], s = step();
  S.orbit.az = S.orbit.el = 0; S.zoom = 1;
  S.lidGoal = s.lid ?? S.lidGoal;
  if (s.y !== undefined) S.yGoal = s.y;
  S.spin = s.spin || 0;
  S.worldGoal = s.world ?? 0;
  S.glassGoal = s.glass ?? 1;
  S.sticksGoal = s.sticks || 0;
  if (S.surfaceUser === null) setSurface(!!s.surface);
  setLevel(s.level || null);
  if (!s.level) S.goal = { ...camFor(s) };
  S.t = 0;
  history.replaceState(null, "", `#${c.id}-${S.st + 1}`);
  // the reaction chapter is driven by its player
  $("player").hidden = !c.player;
  document.body.classList.toggle("player-on", !!c.player);
  if (c.player) { if (prevCh !== S.ch && !S.tour.on) { PL.tau = 0; PL.target = null; } player.goTo(S.st); PL.shown = S.st; }
  else { PL.playing = false; PL.target = null; }
  $("bench").hidden = !s.bench;
  document.body.classList.toggle("bench-on", !!s.bench);
  if (s.bench) buildBench();
  renderNav(); renderCard(prevCh === S.ch);
}
function camFor(s) {
  const c = s.cam || {};
  if (c.focus === "site") {
    rig.position.y = S.y; spinner.updateMatrixWorld(true);
    const p = protein.group.localToWorld(protein.pos(146, "OG", new THREE.Vector3()).lerp(protein.pos(258, "NE2", new THREE.Vector3()), 0.5));
    p.y += (S.yGoal - S.y);
    return { tx: p.x, ty: p.y, tz: p.z, az: c.az, el: c.el, d: c.d, sx: 0, sy: 0 };
  }
  return { tx: 0, ty: (c.ty ?? (s.y ?? 0)), tz: 0, az: c.az ?? 200, el: c.el ?? 10, d: c.d ?? 140, sx: 0, sy: 0 };
}
function next() {
  const c = CHAPTERS[S.ch];
  if (c.player && stepAt(PL.tau) < 7) { player.forward(); return; }
  if (S.st < c.steps.length - 1) go(S.ch, S.st + 1); else if (S.ch < CHAPTERS.length - 1) go(S.ch + 1, 0);
}
function prev() {
  const c = CHAPTERS[S.ch];
  if (c.player && PL.tau > 1e-3) { player.back(); return; }
  if (S.st > 0) go(S.ch, S.st - 1); else if (S.ch > 0) go(S.ch - 1, CHAPTERS[S.ch - 1].steps.length - 1);
}

// ---------------------------------------------------------------- surface view
let surfReady = false, surfLid = -1;
function setSurface(on) {
  S.surface = on;
  $("bView").setAttribute("aria-pressed", String(on));
  $("bView").textContent = on ? "Ribbon" : "Surface";
  if (on) ensureSurface();
}
function ensureSurface() {
  const l = Math.round(protein.lid * 10) / 10;
  if (!surfReady || Math.abs(l - surfLid) > 0.05) { protein.buildSurface(isPhone() ? 1.1 : 0.85); surfReady = true; surfLid = l; }
}

// ---------------------------------------------------------------- powers of ten
const dip = $("dip");
let levelSwitch = null;
function setLevel(name) {
  if (name === S.level) { if (name) S.goal = { ...levels[name].cam }; return; }
  const apply = () => {
    for (const k in levels) levels[k].group.visible = k === name;
    S.level = name;
    scene.fog = name ? null : sceneFog;
    spinner.visible = !name; world.group.visible = !name;
    if (name) { const c = levels[name].cam; S.cam = { ...c, d: c.d * 0.55 }; S.goal = { ...c }; }
    else { const c = camFor(step()); S.cam = { ...c, d: c.d * 1.6 }; }
  };
  if (S.still || levelSwitch === "instant") { apply(); return; }
  dip.classList.add("on");
  setTimeout(() => { apply(); dip.classList.remove("on"); }, 320);
}

// ---------------------------------------------------------------- the reaction player's UI
const ticks = $("ticks");
ticks.innerHTML = STEP_SHORT.map((n, i) => `<span style="left:${((T0[i + 1]) / TT) * 100}%" data-k="${i}">${n}</span>`).join("");
function paintPlayer() {
  const k = stepAt(PL.tau);
  $("plStep").textContent = String(k + 1);
  $("plPlay").classList.toggle("on", PL.playing);
  $("plLabel").textContent = PL.playing ? "Pause" : PL.tau >= TT - 1e-3 ? "Play again" : "Play reaction";
  $("plPill").textContent = `${k + 1} · ${STEPS[k].t}`;
  const f = PL.tau / TT;
  $("player").querySelector(".scrub-fill").style.width = `${(f * 100).toFixed(2)}%`;
  $("player").querySelector(".scrub-head").style.left = `${(f * 100).toFixed(2)}%`;
  $("scrub").setAttribute("aria-valuenow", String(Math.round(f * 100)));
  $("scrub").setAttribute("aria-valuetext", `Step ${k + 1}: ${STEPS[k].t}`);
  ticks.querySelectorAll("span").forEach((e) => e.classList.toggle("on", Number(e.dataset.k) === k));
}
$("plPlay").addEventListener("click", () => { handOver(); player.toggle(); });
$("plFwd").addEventListener("click", () => { handOver(); player.forward(); });
$("plBack").addEventListener("click", () => { handOver(); player.back(); });
$("player").querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
  handOver(); PL.speed = Number(b.dataset.speed);
  $("player").querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
$("player").querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  handOver(); S.mode = b.dataset.mode; reaction.state.mode = S.mode;
  $("player").querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
{
  const sc = $("scrub");
  let drag = false;
  const at = (e) => { const r = sc.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  sc.addEventListener("pointerdown", (e) => { handOver(); drag = true; sc.setPointerCapture(e.pointerId); player.scrubTo(at(e)); e.preventDefault(); });
  sc.addEventListener("pointermove", (e) => { if (drag) player.scrubTo(at(e)); });
  sc.addEventListener("pointerup", () => (drag = false));
  sc.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { player.forward(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "ArrowLeft") { player.back(); e.preventDefault(); e.stopPropagation(); }
  });
}

// ---------------------------------------------------------------- the conditions panel (built once, never rebuilt while used)
let bench = null;
function buildBench() {
  if (bench) { syncBench(); return; }
  const body = $("benchBody");
  body.innerHTML = `
    <div class="big"><span class="n" id="bigN">100</span><span class="u">%</span></div>
    <p class="big-note" id="bigNote"></p>
    <div class="presets" role="group" aria-label="Cases">${Mo.PRESETS.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="false">${p.name}</button>`).join("")}</div>
    <div class="ctrl" id="cPH"></div>
    <div class="ctrl" id="cT"></div>
    <div class="ctrl"><div class="sl-head"><span class="sl-name">Metal ion, 10 mM</span><span class="sl-val" id="vIon"></span></div>
      <div class="ions" role="group" aria-label="Metal ion">${Mo.IONS.list.map((i) => `<button type="button" data-ion="${i.id}" aria-pressed="false" title="${i.name}: ${i.v} %"><span class="s">${i.sym}</span><span class="v">${Math.round(i.v)}</span></button>`).join("")}</div>
      <p class="note">SCNL lipase (Zhao 2021), Table 3, exact. EDTA strips metal ions out.</p></div>
    <div class="ctrl" id="cRpm"></div>
    <div class="ctrl" id="cMe"><label class="chk"><input type="checkbox" id="sStep"> Add methanol in three 1-equivalent steps</label><p class="note" id="meNote"></p></div>`;
  const onIn = (key) => (v) => { handOver(); S.cond[key] = v; markPreset(); syncNumbers(); };
  const sliders = {
    pH: createSlider({ name: "pH", min: 3, max: 12, step: 0.1, value: S.cond.pH, format: (v) => v.toFixed(1), curve: Mo.PH, optimum: Mo.PH.opt, foot: "SCNL lipase (Zhao 2021), Fig 5C, read off the graph", onInput: onIn("pH"), id: "sPH" }),
    T: createSlider({ name: "Temperature", min: 10, max: 60, step: 1, value: S.cond.T, format: (v) => `${v.toFixed(0)} °C`, curve: Mo.TEMP, optimum: Mo.TEMP.opt, foot: "SCNL lipase (Zhao 2021), Fig 5A, read off the graph", onInput: onIn("T"), id: "sT" }),
    rpm: createSlider({ name: "Mixing", min: 100, max: 300, step: 5, value: S.cond.rpm, format: (v) => `${v.toFixed(0)} rpm`, curve: Mo.STIR, optimum: Mo.STIR.opt, foot: "Biodiesel yield from used cooking oil, 24 h (Ben Bacha 2022)", onInput: onIn("rpm"), id: "sRpm" }),
    meoh: createSlider({ name: "Methanol added at once", min: 0.5, max: 3, step: 0.1, value: S.cond.meoh, format: (v) => `${v.toFixed(1)} eq`, optimum: null, foot: "", onInput: onIn("meoh"), id: "sMe" }),
  };
  $("cPH").appendChild(sliders.pH.el); $("cT").appendChild(sliders.T.el); $("cRpm").appendChild(sliders.rpm.el);
  $("cMe").prepend(sliders.meoh.el);
  // a limit tick at 1.5 eq on the methanol track
  sliders.meoh.el.querySelector(".sl-track").insertAdjacentHTML("beforeend", `<i class="sl-opt" style="left:${((1.5 - 0.5) / 2.5) * 100}%;background:var(--red)"></i>`);
  const lim = sliders.meoh.el.querySelectorAll(".sl-opt"); lim[lim.length - 1].classList.add("lim");
  body.querySelectorAll("[data-ion]").forEach((b) => b.addEventListener("click", () => { handOver(); S.cond.ion = b.dataset.ion; markPreset(); syncNumbers(); }));
  body.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { handOver(); applyPreset(b.dataset.preset); }));
  $("sStep").addEventListener("change", (e) => { handOver(); S.cond.stepwise = e.target.checked; markPreset(); syncNumbers(); });
  bench = { sliders };
  syncBench();
}
function applyPreset(id) {
  const p = Mo.PRESETS.find((x) => x.id === id);
  if (!p) return;
  Object.assign(S.cond, p.set);
  syncBench();
}
function markPreset() {
  const id = Mo.PRESETS.find((p) => Object.entries(p.set).every(([k, v]) => S.cond[k] === v))?.id;
  $("benchBody").querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
}
function syncBench() {
  if (!bench) return;
  for (const k of ["pH", "T", "rpm", "meoh"]) if (!bench.sliders[k].dragging) bench.sliders[k].set(S.cond[k]);
  $("sStep").checked = S.cond.stepwise;
  markPreset(); syncNumbers();
}
function syncNumbers() {
  if (!bench) return;
  const R = Mo.readings(S.cond);
  $("benchBody").querySelectorAll("[data-ion]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ion === S.cond.ion)));
  $("vIon").textContent = `${R.ion.sym} · ${R.ion.v} %`;
  bench.sliders.meoh.disable(S.cond.stepwise);
  $("meNote").innerHTML = R.inactivated ? `<span class="warn" style="color:var(--red)">More than 1.5 molar equivalents at once inactivated Novozym 435.</span> (Shimada et al. 1999)`
    : S.cond.stepwise ? "Three 1-equivalent steps: 98.4 % methyl esters in 48 h, over 95 % kept for 50 cycles (Shimada et al. 1999)." : "Up to 1.5 equivalents at once is tolerated (Shimada et al. 1999). The red tick marks the limit.";
  $("bigNote").innerHTML = R.inactivated ? `<b class="warn" style="color:var(--red)">Enzyme inactivated by methanol.</b> No biodiesel leaves it.`
    : `pH ${R.fpH.toFixed(0)} % × temperature ${R.fT.toFixed(0)} % × ion ${R.fIon.toFixed(0)} % of control · <b>${R.yieldStir.toFixed(0)} %</b> yield at ${S.cond.rpm} rpm`;
}

// ---------------------------------------------------------------- tour and hand-over
const tourLabel = () => (isPhone() ? "Tour" : "Play the tour");
function play() {
  S.tour.on = true; S.tour.t = 0; S.tour.done = 0;
  $("bPlay").querySelector(".lbl").textContent = "Pause tour"; $("bPlay").classList.add("on");
  if (S.ch === CHAPTERS.length - 1 && S.st === CHAPTERS[S.ch].steps.length - 1) go(0, 0);
  if (CHAPTERS[S.ch].player) player.play();
}
function stopTour() { S.tour.on = false; $("bPlay").querySelector(".lbl").textContent = tourLabel(); $("bPlay").classList.remove("on"); }
function handOver() { if (S.tour.on) { S.tour.wasOn = true; stopTour(); } S.tour.idle = 0; }
$("bPlay").addEventListener("click", () => (S.tour.on ? (stopTour(), (S.tour.wasOn = false)) : play()));
$("bNext").addEventListener("click", () => { handOver(); next(); });
$("bPrev").addEventListener("click", () => { handOver(); prev(); });
$("bView").addEventListener("click", () => { handOver(); S.surfaceUser = !S.surface; setSurface(!S.surface); });
$("bLabels").addEventListener("click", () => { S.labels = !S.labels; $("bLabels").setAttribute("aria-pressed", String(S.labels)); });
$("bFull").addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()));
$("bText").addEventListener("click", () => toggleText());
$("bHide").addEventListener("click", () => hideAll(true));
$("showui").addEventListener("click", () => hideAll(false));
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, select, [role=slider]") && /^Arrow|^Page|^Home$|^End$/.test(e.key)) return;
  const k = e.key;
  if (k === " ") { e.preventDefault(); if (CHAPTERS[S.ch].player && !S.tour.on) { handOver(); player.toggle(); } else S.tour.on ? (stopTour(), (S.tour.wasOn = false)) : play(); return; }
  if (k === "ArrowRight") { handOver(); next(); } else if (k === "ArrowLeft") { handOver(); prev(); }
  else if (k === "." && CHAPTERS[S.ch].player) { handOver(); player.forward(); }
  else if (k === "," && CHAPTERS[S.ch].player) { handOver(); player.back(); }
  else if (k === "f" || k === "F") $("bFull").click();
  else if (k === "t" || k === "T") toggleText();
  else if (k === "v" || k === "V") $("bView").click();
  else if (k === "l" || k === "L") $("bLabels").click();
  else if (k === "h" || k === "H") hideAll(!uiHidden());
  else if (k === "p" || k === "P") { if (!S.tour.on) play(); }
  else if (k === "Escape") { if (!$("text").hidden) toggleText(); else if (uiHidden()) hideAll(false); }
  else if (/^[1-6]$/.test(k)) { handOver(); go(Number(k) - 1, 0); }
});
// orbit and zoom
let drag = null;
canvas.addEventListener("pointerdown", (e) => { handOver(); drag = { x: e.clientX, y: e.clientY, az: S.orbit.az, el: S.orbit.el }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => { if (!drag) return; S.orbit.az = drag.az - (e.clientX - drag.x) * 0.25; S.orbit.el = Math.max(-60, Math.min(60, drag.el + (e.clientY - drag.y) * 0.2)); });
canvas.addEventListener("pointerup", () => (drag = null));
canvas.addEventListener("wheel", (e) => { e.preventDefault(); handOver(); S.zoom = Math.max(0.35, Math.min(2.5, S.zoom * Math.exp(e.deltaY * 0.001))); }, { passive: false });

// ---------------------------------------------------------------- text version
function toggleText() {
  const t = $("text");
  if (t.hidden) {
    const R = Mo.readings(S.cond);
    const ctx = { m, S };
    t.innerHTML = `<button class="close" id="tClose">Close (Esc)</button><h1>Lipase at the interface</h1>
      <p><i>Thermomyces lanuginosus</i> lipase (TLL) in 3D, from two crystal structures: lid closed, PDB 1DT3 chain A (2.6 Å); lid open, PDB 1GT6 chain A (2.2 Å, an S146A mutant crystallised with oleic acid; residue 146 is drawn as the wild-type serine from 1DT3). The open structure was superposed on the closed one by the core: ${data.meta.coreN} C-alpha atoms, RMSD ${m.rmsd} Å.</p>
      ${CHAPTERS.map((c) => `<h2>${c.kicker}</h2>${c.steps.map((s) => `<h3>${s.title}</h3>${s.body(ctx)}`).join("")}`).join("")}
      <h2>Measured from the coordinates</h2><ul>
      <li>Molecule: ${m.nRes} residues, largest extent ${m.size} between atom centres.</li>
      <li>Closed lid: Trp89 ring (CZ2) to Ser146 Oγ ${m.trpSer.toFixed(1)} Å.</li>
      <li>Ser146 Oγ to His258 Nε2 ${m.serHis.toFixed(1)} Å; His258 Nδ1 to Asp201 carboxylate ${m.hisAsp.toFixed(1)} Å.</li>
      <li>Oxyanion hole: in 1GT6 the oleic acid's O1 sits 2.6 Å from Ser83 N and 3.0 Å from Leu147 N.</li>
      <li>C-alpha atoms moving more than 3 Å between closed and open, after core superposition: ${Object.entries(data.meta.movedOver3A).map(([k, v]) => `${k}: ${v} Å`).join(", ")}.</li></ul>
      <h2>Conditions (chapter 5): datasets</h2><ul>
      <li>pH: ${Mo.PH.who}; ${Mo.PH.note}. ${Mo.PH.x.map((x, i) => `pH ${x} ${Mo.PH.y[i]} %`).join(", ")}.</li>
      <li>Temperature: ${Mo.TEMP.who}; ${Mo.TEMP.note}. ${Mo.TEMP.x.map((x, i) => `${x} °C ${Mo.TEMP.y[i]} %`).join(", ")}.</li>
      <li>Metal ions: ${Mo.IONS.who}; ${Mo.IONS.note}. ${Mo.IONS.list.map((i) => `${i.sym} ${i.v} %`).join(", ")}.</li>
      <li>Mixing: ${Mo.STIR.who}; ${Mo.STIR.note}. ${Mo.STIR.x.map((x, i) => `${x} rpm ${Mo.STIR.y[i]} %`).join(", ")}.</li>
      <li>Methanol: ${Mo.METHANOL.who}: more than ${Mo.METHANOL.limit} molar equivalents added at once inactivated it; three 1-equivalent additions gave 98.4 % conversion in 48 h and kept over 95 % for 50 cycles.</li>
      <li>Histidine side chains titrate around pH ${Mo.HIS_PKA} (Pace et al. 2009); the page shows the protonated fraction of His258 from that pKa.</li>
      <li>Current settings: pH ${S.cond.pH}, ${S.cond.T} °C, ${R.ion.name}, ${S.cond.rpm} rpm → ${R.inactivated ? "inactivated by methanol" : R.combined.toFixed(0) + " % (illustrative product of the three factors)"}; mixing yield ${R.yieldStir.toFixed(0)} %.</li></ul>
      <h2>Sources</h2><ol>${Object.values(Mo.SOURCES).map((s) => `<li>${s.cite} <a href="https://doi.org/${s.doi}">doi:${s.doi}</a></li>`).join("")}<li>RCSB Protein Data Bank entries 1DT3 and 1GT6, rcsb.org.</li></ol>
      <h2>Honest limits</h2><ul>
      <li>The lid opening is a straight-line morph between the two crystal structures, not a simulation of the path.</li>
      <li>The reaction's atoms are placed from the oleic acid in 1GT6 and standard bond lengths; the diglyceride's other two chains, the glycerol, methanol and the moving protons are drawn, not crystallised. Hydrogens are shown only where they move.</li>
      <li>Chapter 5's effects on the enzyme (speed of biodiesel leaving, thermal shaking and loosening, the proton on His258, ions settling, the grey of an inactivated enzyme, ripples) are visual cues driven by the datasets, not simulations. The curves are from other lipases (named), not TLL; the combined number assumes independent effects.</li>
      <li>The oil droplet is drawn about 180 nm across; real droplets are micrometres. Carrier, bead and column are illustrative; beads in the column are drawn about six times larger than life.</li></ul>`;
    t.hidden = false; t.focus();
    $("tClose").addEventListener("click", toggleText);
  } else { t.hidden = true; canvas.focus(); }
}

// ---------------------------------------------------------------- sizing (pixel ratio fixed per size: no automatic tiers to oscillate)
function resize() {
  const pr = Math.min(devicePixelRatio || 1, isPhone() ? 2 : 1.75);
  stage.resize(innerWidth, innerHeight, pr);
  stage.bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  if (!S.tour.on) $("bPlay").querySelector(".lbl").textContent = tourLabel();
}
addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------- the loop
const D = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
function frame(dt, draw = true) {
  S.t += dt;
  const c = CHAPTERS[S.ch];
  let s = step();
  const condOn = !!s.bench;
  // the tour
  if (S.tour.on) {
    if (c.player) {
      if (!PL.playing && PL.tau >= TT - 1e-3) { S.tour.done += dt; if (S.tour.done > 1.4) { S.tour.done = 0; next(); } }
      else if (!PL.playing && PL.target === null) player.play();
    } else {
      S.tour.t += dt;
      if (s.bench && s.tour) {
        const k = Math.min(s.tour.length - 1, Math.floor(S.tour.t / (s.dur / s.tour.length)));
        if (k !== S.condTour) { S.condTour = k; applyPreset(s.tour[k]); }
      }
      if (S.tour.t > s.dur) { S.tour.t = 0; S.condTour = -1; if (S.ch === CHAPTERS.length - 1 && S.st === CHAPTERS[S.ch].steps.length - 1) stopTour(); else next(); }
    }
  } else if (S.tour.wasOn) {
    S.tour.idle += dt;
    if (S.tour.idle > 25) { S.tour.wasOn = false; play(); }
  }
  // the reaction clock drives the step shown, its caption and its camera
  if (c.player) {
    player.update(dt);
    const k = stepAt(PL.tau);
    if (k !== PL.shown) { PL.shown = k; S.st = k; renderCard(true); S.goal = { ...camFor(step()) }; history.replaceState(null, "", `#${c.id}-${k + 1}`); }
    paintPlayer();
    s = step();
  }
  // the enzyme
  S.y = D(S.y, S.yGoal, 1.6, dt);
  rig.position.y = S.y;
  spinner.rotation.y += S.spin * dt;
  if (!S.spin) spinner.rotation.y = D(spinner.rotation.y, 0, 2.5, dt);
  const R = Mo.readings(S.cond);
  protein.lid = D(protein.lid, S.lidGoal, 1.4, dt);
  protein.setJitter(condOn ? R.jitter : 0);
  protein.setLoose(condOn ? R.loose : 0);
  protein.setHisProton(condOn ? R.hisH : 0);
  protein.triadOff(condOn ? Math.min(1, R.hisH * 1.4) : 0);
  S.grey = D(S.grey, condOn ? R.grey : 0, 3, dt);
  protein.grey.value = S.grey;
  const tintOn = condOn && R.ion.col && R.ion.v < 100;
  if (tintOn) protein.tint.value.set(R.ion.col);
  S.tintAmt = D(S.tintAmt, tintOn ? ((100 - R.ion.v) / 100) * 0.6 : 0, 2, dt);
  protein.tintAmt.value = S.tintAmt;
  protein.update(dt);
  S.glass = D(S.glass, S.glassGoal, 3, dt);
  protein.setGlass(Math.abs(S.glass - S.glassGoal) < 0.004 ? S.glassGoal : S.glass);
  { const dd = S.cam.d * S.zoom; protein.nearFade.value.set(dd * 0.62, dd * 0.3); }
  S.sticks = D(S.sticks, S.sticksGoal, 3, dt);
  protein.sticksScale(Math.abs(S.sticks - S.sticksGoal) < 0.004 ? S.sticksGoal : S.sticks);
  // surface: opaque when fully shown, transparent only while fading
  S.surfNow = D(S.surfNow, S.surface ? 1 : 0, 4, dt);
  const sOn = S.surfNow > 0.995 ? 1 : S.surfNow;
  protein.surface.visible = sOn > 0.02;
  protein.surfMat.opacity = sOn;
  protein.surfMat.transparent = sOn < 1;
  protein.surfMat.depthWrite = true;
  if (S.surface && Math.abs(protein.lid - surfLid) > 0.08 && S.t % 0.2 < dt) ensureSurface();
  // world
  S.worldNow = D(S.worldNow, S.worldGoal, 2, dt);
  world.fade(S.level ? 0 : (Math.abs(S.worldNow - S.worldGoal) < 0.004 ? S.worldGoal : S.worldNow));
  world.methanol.visible = condOn;
  world.setMixing(S.cond.rpm, condOn);
  world.update(dt, S.t);
  if (condOn) world.updateDrops(S.t);
  cond3d.update(dt, R, condOn && !S.level);
  // reaction
  reaction.group.visible = !!c.player;
  if (c.player) { reaction.state.mode = S.mode; reaction.set(sOf(PL.tau), S.t); }
  // levels
  if (S.level && levels[S.level].update) levels[S.level].update(dt);
  // the big number tweens toward the model
  if (condOn && bench) {
    const target = R.inactivated ? 0 : R.combined;
    S.big = D(S.big, target, 6, dt);
    const txt = R.inactivated && S.big < 0.5 ? "0" : S.big.toFixed(0);
    if ($("bigN").textContent !== txt) { $("bigN").textContent = txt; $("benchPill").textContent = `${txt} %`; }
  }
  // camera
  if (S.goal) for (const k of ["tx", "ty", "tz", "az", "el", "d", "sx", "sy"]) S.cam[k] = D(S.cam[k] ?? 0, S.goal[k] ?? 0, 2.2, dt);
  const shift = isPhone() ? { sx: 0, sy: -0.12 } : { sx: condOn ? -0.02 : 0.06, sy: c.player ? -0.06 : 0 };
  stage.place({ ...S.cam, ref: S.goal?.d ?? S.cam.d, az: S.cam.az + S.orbit.az + (S.still ? 0 : Math.sin(S.t * 0.15) * 2), el: Math.max(-80, Math.min(80, S.cam.el + S.orbit.el)), d: S.cam.d * S.zoom * (isPhone() ? 1.35 : 1), sx: shift.sx, sy: shift.sy });
  if (!draw) return;
  drawScale(s);
  let labs = Array.isArray(s.labels) ? [...s.labels] : [];
  if (condOn) {
    if (R.rate > 0.2) labs.push("cProd");
    if (R.hisH > 0.3) labs.push("cHis");
    if (R.ion.col) labs.push("cIon");
    if (R.loose > 0.15) labs.push("cHot");
    if (R.inactivated) labs.push("cMeoh");
  }
  drawLabels(labs);
  stage.render();
}
function drawScale(s) {
  const el = $("scale");
  let len = 0, unit = "";
  if (S.level) { const b = levels[S.level].bar; len = b.worldLen; unit = b.unit; }
  else if (s.bar) { len = s.bar; unit = `${s.bar / 10} nm`; }
  else if (CHAPTERS[S.ch].id === "site" || CHAPTERS[S.ch].id === "react") { len = 5; unit = "5 Å"; }
  else { len = 20; unit = "2 nm"; }
  const t = new THREE.Vector3(S.cam.tx, S.cam.ty, S.cam.tz);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const a = stage.project(t), b = stage.project(t.clone().addScaledVector(right, len));
  if (!a || !b) { el.style.opacity = 0; return; }
  el.style.opacity = 1;
  el.querySelector("i").style.width = `${Math.abs(b[0] - a[0]).toFixed(1)}px`;
  el.querySelector("span").textContent = unit;
}

let last = performance.now(), manual = false;
function loop(now) {
  if (!manual) { const dt = Math.min(0.05, (now - last) / 1000); frame(S.still ? 0.016 : dt); }
  last = now;
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- stills for the deck (transparent PNG)
function still({ w = 1600, h = 1600, transparent = true, ch, st, setup } = {}) {
  manual = true;
  if (ch !== undefined) { levelSwitch = "instant"; go(ch, st || 0); levelSwitch = null; }
  if (setup) setup({ S, protein, world, reaction, levels, setSurface, ensureSurface, rig, spinner, stage, PL });
  for (let i = 0; i < 240; i++) frame(1 / 30, false);
  const { renderer } = stage;
  const prevBg = scene.background, prevFog = scene.fog;
  const oldSize = { w: stage.size.w, h: stage.size.h, pr: renderer.getPixelRatio() };
  stage.resize(w, h, 1);
  const L0 = { h: stage.hemi.intensity, r: stage.rim.intensity, k: stage.key.intensity, e: renderer.toneMappingExposure };
  if (transparent) { scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0); stage.hemi.intensity = 1.35; stage.rim.intensity = 0.35; stage.key.intensity = 2.8; renderer.toneMappingExposure = 1.12; }
  stage.place({ ...S.cam, az: S.cam.az + S.orbit.az, el: S.cam.el + S.orbit.el, d: S.cam.d * S.zoom, sx: 0, sy: 0 });
  $("labels").style.display = "none";
  if (transparent) renderer.render(scene, camera); else stage.render();
  const url = canvas.toDataURL("image/png");
  scene.background = prevBg; scene.fog = prevFog;
  stage.hemi.intensity = L0.h; stage.rim.intensity = L0.r; stage.key.intensity = L0.k; renderer.toneMappingExposure = L0.e;
  stage.resize(oldSize.w, oldSize.h, oldSize.pr);
  $("labels").style.display = "";
  manual = false;
  return url;
}

window.__lip = {
  ready: true, S, m, PL, player, protein, world, reaction, levels, go, next, prev,
  advance(sec = 0.5) { manual = true; const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) frame(1 / 30, i === n - 1); manual = false; return S.t; },
  still,
  setCond(c) { Object.assign(S.cond, c); syncBench(); },
  hideAll,
};

// ---------------------------------------------------------------- start
renderNav();
const hash = location.hash.slice(1).split("-");
const ci = CHAPTERS.findIndex((c) => c.id === hash[0]);
levelSwitch = "instant";
go(ci >= 0 ? ci : 0, ci >= 0 ? Math.max(0, Number(hash[1] || 1) - 1) : 0);
levelSwitch = null;
S.cam = { ...S.goal, d: S.goal.d * 1.5 };
$("loader").classList.add("gone");
requestAnimationFrame(loop);
if (params.has("tour")) play();
if (/\/lab\/[^/]+\/?$/.test(location.pathname)) $("bLab").hidden = false;
