import * as THREE from "three";
import { FRAMES } from "./plant.js?v=f9d0af7e";
import { FX, FZ, S as FS, Y0 } from "./figures/furnace.js?v=f9d0af7e";

// Every chapter: what the card says, what the panel controls and reads, where the camera goes,
// its tour, its prediction, its flap and its challenge. Site copy has no em dashes (his rule).

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const W = (id, x, y, z) => V3(FRAMES[id].x + x, y, FRAMES[id].z + z); // figure → world

function facts(rows) {
  return `<ul class="facts">${rows.map(([b, t, s]) => `<li><b>${b}</b><span>${t}</span>${s ? `<small>${s}</small>` : ""}</li>`).join("")}</ul>`;
}
function predictBlock(ctx, id, q, options, answer) {
  const got = ctx.saved.predict[id];
  const open = !!ctx.saved.flaps[id];
  return `<h2>Predict</h2><p>${q}</p><div class="predict">${options.map(([k, t]) => `<button type="button" data-predict="${k}" aria-pressed="${got === k}" class="${open && k === answer ? "right" : ""}">${t}</button>`).join("")}</div>`;
}
function flapBlock(ctx, id, title, body) {
  const seen = !!ctx.saved.flaps[id];
  return `<div class="flap${seen ? " open" : ""}"><button type="button" aria-expanded="${seen}"><span>${title}</span><span>lift the flap</span></button><div class="under">${body}</div></div>`;
}
function challengeBlock(ctx, id, title, body, stampText) {
  const done = !!ctx.saved.stamps[id];
  return `<div class="challenge${done ? " done" : ""}"><span class="stamp">${stampText}</span><h3>Challenge${done ? " · done" : ""}</h3><p>${title} ${body}</p></div>`;
}
const set = (ctx, id, v) => { const el = ctx.S.ui[id]; if (el && el.textContent !== v) el.textContent = v; };
// the two documents: the case study the poster grew from, and the poster itself
const DOC_ICON = {
  case: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8.2L18.6 7v14.2H6z"/><path d="M14 2.8V7h4.6M8.8 11h7M8.8 14h7M8.8 17h4.6"/></svg>`,
  poster: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="5" width="18.8" height="13.6" rx="1"/><path d="M5.6 15.6l3.6-4.4 2.8 3 2.2-2.4 4 3.8M15.6 8.6h2.6"/></svg>`,
};
export { DOC_ICON };
function docButtons() {
  return `<p>The 20-page case study this poster grew from, and the A0 poster itself, open right here.</p>
    <button class="go" data-act="read-case">Read the case study</button><button class="go soft" data-act="read-poster">See the poster</button>`;
}

// ============================================================ 0 · the poster
const poster = {
  id: "poster", short: "Poster", kicker: "The poster", figures: [],
  view: () => ({ target: V3(0, 0, 18), yaw: 0, pitch: 62, dist: 1500, width: 1260 }),
  caption: (ctx) => (ctx.plant.list.some((f) => f.fig.phase === "print") ? "Tap a figure to open its chapter, or stand them all up." : "Drag to look round. Tap a figure to go to it."),
  card: (ctx) => `
    <h1>How Durgapur makes iron</h1>
    <p class="lede">A poster whose figures stand up. Heat is the only colour on it; the gas is the only other.</p>
    <p>Durgapur Steel Plant is one of SAIL's five integrated plants, on the Damodar river in West Bengal. It was built with British help and its first blast furnace was lit on 29 December 1959.</p>
    <p>This poster follows its <b>iron zone</b>: everything up to the liquid iron (hot metal) that leaves the blast furnace. Four units, each feeding the next:</p>
    ${facts([["1", "Raw materials handling blends ore, flux and coal."], ["2", "Coke ovens bake coal into coke."], ["3", "Sinter machines fuse ore fines into lumps."], ["4", "Blast furnaces smelt them into hot metal and slag."]])}
    <button class="go" data-act="stand">Stand it all up</button><button class="go soft" data-go="1">Start with raw materials →</button>
    <h2>The research behind it</h2>
    ${docButtons()}
    <p class="small" style="margin-top:10px">Drag to look round, right-drag or shift-drag to pan, scroll to zoom. Arrow keys change chapter. ≡ opens the whole poster as text.</p>`,
  act: (ctx, a) => {
    if (a === "stand") document.getElementById("bPlay").click();
    if (a === "read-case") ctx.openDoc("case");
    if (a === "read-poster") ctx.openDoc("poster");
  },
  panelKicker: "Durgapur in numbers",
  panel: (ctx) => {
    const w = ctx.M.worked();
    return `
    <div class="big"><b>${ctx.fmt(w.total)}</b><span>t of hot metal a day, from the published figures</span></div>
    <table class="calc"><thead><tr><th>Furnace</th><th>Working m³</th><th>t/m³·day</th><th>t/day</th></tr></thead><tbody>
    ${w.furnaces.map((f) => `<tr><td>${f.name}</td><td>${ctx.fmt(f.working)}</td><td>${f.prod.toFixed(2)}</td><td>${ctx.fmt(f.daily)}</td></tr>`).join("")}
    <tr class="sum"><td>All three</td><td>${ctx.fmt(w.furnaces.reduce((s, f) => s + f.working, 0))}</td><td></td><td>${ctx.fmt(w.total)}</td></tr></tbody></table>
    <p class="note">Daily output = productivity × working volume. × 365 = ${(w.annual / 1e6).toFixed(2)} Mt a year, close to the 2.40 Mt rating.</p>
    <dl class="readings">
      <dt>Best July, 2026</dt><dd>${ctx.fmt(ctx.M.PLANT.julyRecord.hotMetal)} t</dd>
      <dt>That is, per day</dt><dd>${ctx.fmt(w.july)} t (+${(w.julyVsRated * 100).toFixed(0)} %)</dd>
      <dt>Hot metal, 2017-24</dt><dd>17.05 Mt</dd>
      <dt>Against its MoU target</dt><dd class="key">105 %, best in SAIL</dd>
      <dt>Sinter per tonne of iron</dt><dd>${w.sinterPerThm.toFixed(2)} t</dd>
      <dt>Slag per tonne of iron</dt><dd>≈ ${ctx.fmt(ctx.M.AUDIT.slag2017to24 / ctx.M.AUDIT.hotMetal2017to24 * 1000)} kg</dd>
    </dl>
    <p class="src">Volumes and productivity: SAIL. 2017-24 totals, slag: CAG Report 38 of 2025. July: Suchnaji. Capacities differ by source: CAG gives 2.45 Mt hot metal, 3.01 Mt sinter, 1.66 Mt coke.</p>`;
  },
  text: (ctx) => {
    const w = ctx.M.worked();
    return `<h1>How Durgapur makes iron</h1><p>A 3D poster of the iron zone of SAIL's Durgapur Steel Plant, West Bengal: raw materials handling, coke ovens, sinter and the blast furnaces. Its first blast furnace was lit on 29 December 1959; three furnaces work today, BF-2, BF-3 and BF-4, with 4,600 m³ of useful volume between them.</p>
    <h2>Durgapur in numbers</h2><table><tr><th>Furnace</th><th>Useful m³</th><th>Working m³</th><th>t/m³·day</th><th>t/day</th></tr>${w.furnaces.map((f) => `<tr><td>${f.name}</td><td>${ctx.fmt(f.useful)}</td><td>${ctx.fmt(f.working)}</td><td>${f.prod}</td><td>${ctx.fmt(f.daily)}</td></tr>`).join("")}</table>
    <p>The case study this poster grew from: <a href="./docs/case-study.pdf">case-study.pdf</a> (20 pages). The A0 poster: <a href="./docs/poster.pdf">poster.pdf</a>.</p><p>All three together make about ${ctx.fmt(w.total)} t a day, ${(w.annual / 1e6).toFixed(2)} Mt a year, against a rated 2.40 Mt (CAG gives 2.45 Mt). In July 2026 the plant made ${ctx.fmt(ctx.M.PLANT.julyRecord.hotMetal)} t of hot metal, its best July. From 2017 to 2024 it made 17.05 Mt, 105 % of its MoU target, the best record in SAIL (CAG Report 38 of 2025).</p>`;
  },
};

// ============================================================ 4 · the blast furnace
const FUR = (x, y, z) => W("furnace", x, y, z);
// a point on the furnace's cut face from model metres (r from the axis, y above the taphole)
const FACE = (r, y) => FUR(FX + r * FS, Y0 + y * FS, FZ + 1);
const furnaceFig = (ctx) => ctx.plant.byId.furnace.fig;
function radiusAtFig(L, y) { return y <= L.yBelly ? L.rB : L.rB + (L.rT - L.rB) * Math.min(1, (y - L.yBelly) / L.hStack); }

// where a reaction stop sits on the cut face, in model metres (r < 0 is the left half)
function stopPoint(ctx, i) {
  const f = furnaceFig(ctx), L = f.L, cz = f.cz, M = ctx.M, s = M.STOPS[i], p = s.pos, sg = Math.sign(p.r) || 1;
  if (p.at === "top") return { r: p.r * L.rT, y: L.yStock - M.DIP * (1 - Math.abs(p.r)) - 0.8 };
  if (p.at === "cz") return { r: p.r * L.rB, y: cz.lower(Math.abs(p.r) * L.rB) + 0.5 * cz.thick };
  if (p.at === "drip") return { r: p.r * L.rB, y: L.yBosh + 0.4 };
  if (p.at === "race") return { r: sg * (L.rH - 1.0), y: L.yT + 0.1 };
  if (p.at === "hearth") return { r: p.r * L.rH, y: f.secU.uIron.value + 0.05 };
  const y = M.heightAtT(L, Math.abs(p.r), p.T);
  return { r: p.r * M.radiusAt(L, y), y };
}
const STOP_DY = [-22, -18, -10, 20, -12, 4, -14, 4, 12, 12];

function furnaceLabels(ctx) {
  const f = furnaceFig(ctx);
  if (f.phase !== "live" || f.knife.d > 0.5) return [];
  const L = f.L, cz = f.cz, u = f.secU, M = ctx.M, J = f.journey, mode = ctx.S.fMode || "react";
  const lump = { text: "Your lump", show: J ? `Your lump · ${ctx.fmt(J.T)} °C` : "Your lump", pos: J ? FACE(-J.r, J.y) : null, dx: -70, dy: 36 };
  if (mode === "react") {
    return [...M.STOPS.map((s, i) => {
      const p = stopPoint(ctx, i), on = i === ctx.S.fStop;
      return { text: `stop:${s.id}`, show: `${i + 1} · ${s.tag}`, pos: FACE(p.r, p.y), dx: p.r < 0 ? -140 : 140, dy: STOP_DY[i], on, gas: on && s.gas, heat: on && !s.gas };
    }), lump];
  }
  if (mode === "heat") {
    const iso = (T, rf, dx, dy, text) => { const y = M.heightAtT(L, rf, T); return { text, pos: FACE(rf * M.radiusAt(L, y), y), dx, dy, heat: T >= 800 }; };
    const r0 = 0.5 * L.rB;
    return [
      { text: "Top gas out, about 120 to 370 °C", pos: FACE(0.3 * L.rT, L.yStock + 1.2), dx: 130, dy: -26, gas: true },
      iso(400, 0.5, 130, -6, "400 °C"),
      iso(800, 0.5, 130, 4, "800 °C"),
      iso(950, -0.62, -130, -4, "Thermal reserve zone: near 950 °C"),
      { text: "1,200 °C: ore starts to soften", pos: FACE(r0, cz.upper(r0)), dx: 140, dy: -6, heat: true },
      { text: "1,400 °C: melted", pos: FACE(-r0, cz.lower(r0)), dx: -130, dy: 10, heat: true },
      { text: "Raceway, about 2,000 °C", pos: FACE(L.rH - 1.0, L.yT + 0.1), dx: 120, dy: 6, heat: true },
      { text: "Hot blast in: 898 °C (BF-3, 2023-24)", pos: FACE(L.rH + 0.2, L.yT), dx: 120, dy: 34, heat: true },
      { text: "Hot metal, about 1,450 to 1,500 °C", pos: FACE(-0.45 * L.rH, Math.max(-1.4, u.uIron.value - 0.45)), dx: -110, dy: 20, heat: true },
      lump,
    ];
  }
  const trz = cz.upper(0.75 * L.rB) + 0.38 * (L.yStock - cz.upper(0.75 * L.rB));
  return [
    { text: "Stockline: ore and coke in layers", pos: FACE(0.55 * L.rT, L.yStock - 1.2), dx: 120, dy: -18 },
    { text: "Thermal reserve zone, about 900 to 1,000 °C", pos: FACE(0.78 * radiusAtFig(L, trz), trz), dx: 110, dy: -30, heat: true },
    { text: "Cohesive zone: ore softens and melts", pos: FACE(0.6 * L.rB, cz.lower(0.6 * L.rB) + 0.5 * cz.thick), dx: 130, dy: 22, heat: true },
    { text: "Dripping zone: coke and liquid", pos: FACE(-0.5 * L.rB, L.yBosh + 0.5), dx: -110, dy: 10 },
    { text: "Raceway, about 2,000 °C", pos: FACE(L.rH - 1.0, L.yT + 0.1), dx: 120, dy: 6, heat: true },
    { text: "Deadman: a bed of coke", pos: FACE(-0.2 * L.rH, L.yT + 0.6), dx: -120, dy: -24 },
    { text: "Slag", pos: FACE(-0.62 * L.rH, (u.uIron.value + u.uSlag.value) / 2), dx: -90, dy: 4, heat: true },
    { text: "Hot metal", pos: FACE(-0.45 * L.rH, Math.max(-1.4, u.uIron.value - 0.45)), dx: -90, dy: 22, heat: true },
    lump,
  ];
}

// the three ways to look at the cut, and the reaction stops
function setMode(ctx, mode, { stop = null, follow = null, zoom = false } = {}) {
  const S = ctx.S, f = furnaceFig(ctx);
  S.fMode = mode;
  if (follow != null) S.fFollow = follow;
  if (stop != null) S.fStop = stop;
  S.viewOverride = null;
  if (mode === "react" && stop != null && !S.fFollow) goStop(ctx, stop, { zoom, render: false });
  if (mode === "react" && S.fFollow && f.journey) S.fStop = ctx.M.stopOf(f.journey);
  if (mode === "react" && S.fFollow) S.play = true;
  f.setChem(mode, mode === "react" ? S.fStop : -1);
  ctx.renderPanel();
  if (!S.tour.on) ctx.setCaption(furnace.caption(ctx));
}
function goStop(ctx, i, { zoom = true, render = true } = {}) {
  const S = ctx.S, f = furnaceFig(ctx), M = ctx.M;
  i = Math.max(0, Math.min(M.STOPS.length - 1, i));
  S.fStop = i; S.fFollow = false; S.play = false;
  S.hoursTo = M.hoursOfStop(f.L, f.path, i);
  f.setChem("react", i);
  if (zoom) {
    const p = stopPoint(ctx, i);
    S.orbit.yaw = S.orbit.pitch = 0; S.zoom = 1; S.pan.set(0, 0, 0);
    S.viewOverride = { target: FACE(0, p.y), yaw: 8, pitch: 8, dist: 330, width: 175 };
  }
  ctx.sound.tick();
  if (render) { syncF(ctx); updateRx(ctx); }
  if (!S.tour.on) ctx.setCaption(furnace.caption(ctx));
}
function heatText(s) {
  if (s.dH == null) return "–";
  return `${s.dH < 0 ? "gives" : "takes"} ${Math.abs(s.dH)} kJ`;
}
function updateRx(ctx) {
  const S = ctx.S, M = ctx.M, ui = S.ui;
  if (!ui.rxEq) return;
  const i = S.fStop ?? 0, s = M.STOPS[i];
  set(ctx, "rxN", `${i + 1} of ${M.STOPS.length}`);
  set(ctx, "fZone", s.name);
  set(ctx, "rxEq", s.eq);
  set(ctx, "rxPlain", s.plain);
  set(ctx, "rxHeat", heatText(s));
  set(ctx, "rxT", s.Tshort);
  set(ctx, "rxWhy", s.why);
  ui.rxUp.disabled = i === 0; ui.rxDown.disabled = i === M.STOPS.length - 1;
  ui.rxFollow.setAttribute("aria-pressed", String(!!S.fFollow));
  ui.rxFollow.textContent = S.fFollow ? "Following your lump" : "Follow my lump";
}

// the furnace's two temperatures against height (a Reichardt diagram) at 55 % of the radius,
// the radius the lump rides; zones as bands; typical shapes from the model
const CH = { x0: 44, x1: 258, y0: 10, y1: 262, tMax: 2200 };
function chartGeom(ctx) {
  const f = furnaceFig(ctx), L = f.L, top = L.yStock, bot = -1.6;
  return { L, top, bot, X: (T) => CH.x0 + (Math.min(T, CH.tMax) / CH.tMax) * (CH.x1 - CH.x0), Y: (y) => CH.y0 + ((top - y) / (top - bot)) * (CH.y1 - CH.y0) };
}
function reichardtSVG(ctx) {
  const M = ctx.M, f = furnaceFig(ctx), { L, top, bot, X, Y } = chartGeom(ctx);
  const rf = 0.55, solid = [], gas = [];
  for (let k = 0; k <= 140; k++) {
    const y = top - (top - L.yT) * (k / 140);
    solid.push(`${X(M.temperatureAt(L, rf * M.radiusAt(L, y), y)).toFixed(1)},${Y(y).toFixed(1)}`);
    gas.push(`${X(M.gasAt(L, y, rf).T).toFixed(1)},${Y(y).toFixed(1)}`);
  }
  const r0 = rf * L.rB, lo = f.cz.lower(r0), hi = lo + f.cz.thick;
  const trzTop = M.heightAtT(L, rf, 880), trzBot = M.heightAtT(L, rf, 1000);
  const band = (y1, y2, cls, text) => `<rect class="${cls}" x="${CH.x0}" y="${Y(y1).toFixed(1)}" width="${CH.x1 - CH.x0}" height="${(Y(y2) - Y(y1)).toFixed(1)}"/>` + (text ? `<text class="zt" x="${CH.x1 - 4}" y="${((Y(y1) + Y(y2)) / 2 + 3).toFixed(1)}">${text}</text>` : "");
  const ticks = [0, 500, 1000, 1500, 2000].map((t) => `<line class="grid" x1="${X(t)}" y1="${CH.y0}" x2="${X(t)}" y2="${CH.y1}"/><text class="tk" x="${X(t)}" y="${CH.y1 + 13}">${t.toLocaleString("en-IN")}</text>`).join("");
  const side = [["stockline", top], ["tuyeres", L.yT], ["taphole", 0]].map(([t, y]) => `<text class="sd" x="${CH.x0 - 5}" y="${(Y(y) + 3).toFixed(1)}">${t}</text><line class="sdl" x1="${CH.x0 - 3}" y1="${Y(y).toFixed(1)}" x2="${CH.x0}" y2="${Y(y).toFixed(1)}"/>`).join("");
  return `<svg class="chart" viewBox="0 0 268 290" role="img" aria-label="Temperature of the burden and of the gas against height in BF-3, typical shapes">
    ${band(top, trzTop, "z0", "upper stack")}${band(trzTop, trzBot, "z1", "thermal reserve")}${band(trzBot, hi, "z0", "lower stack")}${band(hi, lo, "z2", "cohesive")}${band(lo, L.yT + 0.6, "z0", "dripping")}${band(L.yT + 0.6, L.yT - 0.6, "z3", "raceway")}${band(L.yT - 0.6, bot, "z4", "hearth")}
    ${ticks}${side}
    <line class="liq" x1="${X(1450)}" y1="${Y(L.yT - 0.6)}" x2="${X(1450)}" y2="${Y(bot)}"/><line class="liq" x1="${X(1500)}" y1="${Y(L.yT - 0.6)}" x2="${X(1500)}" y2="${Y(bot)}"/>
    <polyline class="cg" points="${gas.join(" ")}"/>
    <polyline class="cs" points="${solid.join(" ")}"/>
    <line id="fLvl" class="lvl" x1="${CH.x0}" x2="${CH.x1}" y1="0" y2="0"/>
    <circle id="fGdot" class="gd" r="4" cx="0" cy="0"/>
    <circle id="fDot" class="sdot" r="5" cx="0" cy="0"/>
    <text class="ax" x="${(CH.x0 + CH.x1) / 2}" y="${CH.y1 + 26}">temperature, °C</text>
  </svg>`;
}
function updateChart(ctx) {
  const ui = ctx.S.ui, f = furnaceFig(ctx), J = f.journey;
  if (!ui.fDot || !J) return;
  const { X, Y, L } = chartGeom(ctx);
  const y = Y(J.y);
  ui.fDot.setAttribute("cx", X(J.T).toFixed(1)); ui.fDot.setAttribute("cy", y.toFixed(1));
  ui.fLvl.setAttribute("y1", y.toFixed(1)); ui.fLvl.setAttribute("y2", y.toFixed(1));
  const inGas = J.y > L.yT - 0.2;
  const g = ctx.M.gasAt(L, Math.max(J.y, L.yT), 0.55);
  ui.fGdot.setAttribute("cx", X(g.T).toFixed(1)); ui.fGdot.setAttribute("cy", y.toFixed(1)); ui.fGdot.style.opacity = inGas ? 1 : 0;
  set(ctx, "fGasT", inGas ? `${ctx.fmt(g.T)} °C` : "no gas: liquids");
  set(ctx, "fSolT", `${ctx.fmt(J.T)} °C`);
  set(ctx, "fEta", inGas ? `${Math.round(g.eta * 100)} %` : "–");
  const bar = ui.fGas;
  if (bar) {
    const parts = inGas ? [g.CO, g.CO2, g.H2, g.N2] : [0, 0, 0, 0];
    [...bar.children].forEach((c, k) => { c.style.flexBasis = `${parts[k].toFixed(1)}%`; c.textContent = parts[k] >= 6 ? `${Math.round(parts[k])}` : ""; });
  }
}

function keyBlock() {
  return `<h2>How to read the cut</h2><ul class="key">
    <li><i class="k-ore"></i>Ore and sinter layer</li><li><i class="k-coke"></i>Coke layer</li>
    <li><i class="k-soft"></i>Ore softening (cohesive zone)</li><li><i class="k-drip"></i>Hot coke, iron dripping</li>
    <li><i class="k-dead"></i>Deadman: coke that stays</li><li><i class="k-race"></i>Raceway: coke burning</li>
    <li><i class="k-slag"></i>Slag, floating</li><li><i class="k-iron"></i>Hot metal</li>
    <li><i class="k-gas"></i>Gas going up (cools on the way)</li><li><i class="k-heat"></i>Heat: the hotter, the brighter</li></ul>`;
}

const furnace = {
  id: "furnace", short: "Blast furnace", kicker: "4 · The blast furnace", figures: ["furnace"], stamp: true,
  view: () => ({ target: FUR(300, 160, -92), yaw: 16, pitch: 14, dist: 820, width: 380 }),
  labels: furnaceLabels,
  enter: (ctx) => {
    const S = ctx.S;
    S.wantCut = true; S.cutOnce = false; S.play = true; S.fArmed = false;
    S.fMode ||= "react"; S.fFollow = true; S.viewOverride = null;
    const f = furnaceFig(ctx);
    S.fStop = f.journey ? ctx.M.stopOf(f.journey) : 0;
    f.setChem(S.fMode, S.fStop);
  },
  tourEnd: (ctx) => { const f = furnaceFig(ctx); if (ctx.S.wantCut && f.phase === "live" && f.knife.to > 50) f.setKnife(0); },
  leave: (ctx) => { ctx.S.wantCut = false; ctx.S.viewOverride = null; furnaceFig(ctx).setChem("ride"); },
  act: (ctx, a) => { if (a === "react" || a === "heat" || a === "ride") setMode(ctx, a, { follow: a === "react" ? true : null }); },
  key: (ctx, k, e) => {
    if (ctx.S.fMode !== "react") return;
    if (k === "ArrowUp") { goStop(ctx, (ctx.S.fStop ?? 0) - 1); e.preventDefault(); }
    if (k === "ArrowDown") { goStop(ctx, (ctx.S.fStop ?? 0) + 1); e.preventDefault(); }
  },
  caption: (ctx) => {
    const S = ctx.S, M = ctx.M;
    if (!ctx.saved.predict.furnace) return "Predict on the card first: how long does a lump take to come down?";
    if (S.fMode === "react") { const i = S.fStop ?? 0; return `Reaction ${i + 1} of ${M.STOPS.length}: ${M.STOPS[i].name.toLowerCase()}. ${S.fFollow ? "It follows your lump down." : "↑ ↓ for the next one."}`; }
    if (S.fMode === "heat") return "The gas cools from about 2,000 °C to a few hundred; the burden heats from the top down.";
    if (!ctx.saved.flaps.furnace) return "Drag the clock on the right to ride your lump down, then lift the flap.";
    if (!ctx.saved.stamps.furnace) return "Challenge: stop your lump where wüstite turns to iron by gas.";
    return "Stamp earned. Try the tour again, or close the knife to see the furnace whole.";
  },
  shots: [
    { cap: "BF-3, drawn from its published volumes: 1,400 m³ useful, 1,204 m³ working.", dur: 5, view: () => ({ target: FUR(300, 170, -92), yaw: 28, pitch: 12, dist: 900, width: 400 }), act: (ctx) => { furnaceFig(ctx).setKnife(99); } },
    { cap: "Cut it along its axis. Solid burden comes down; hot gas goes up through it.", dur: 5.5, view: () => ({ target: FUR(300, 160, -92), yaw: 8, pitch: 10, dist: 700, width: 330 }), act: (ctx) => { furnaceFig(ctx).setKnife(0); } },
    { cap: "At the top a rotating chute lays ore and coke in alternate layers (BF-3 has a bell-less top).", dur: 6, view: () => ({ target: FUR(300, 220, -92), yaw: 18, pitch: 22, dist: 300, width: 130 }) },
    { cap: "Lower down the ore softens and melts in an inverted V: the cohesive zone. Only the coke stays open.", dur: 6.5, view: () => ({ target: FUR(300, 112, -92), yaw: 4, pitch: 6, dist: 320, width: 150 }) },
    { cap: "Hot blast at the tuyeres burns coke to CO at about 2,000 °C: the raceway. Iron drips into the hearth under its slag.", dur: 6.5, view: () => ({ target: FUR(300, 76, -92), yaw: -6, pitch: 8, dist: 250, width: 120 }) },
    { cap: "The gas does the chemistry on its way up. Here, at 900 to 1,000 °C, CO takes the last oxygen from wüstite: FeO + CO → Fe + CO₂.", dur: 7, view: () => ({ target: FUR(300, 150, -92), yaw: 6, pitch: 8, dist: 360, width: 175 }), act: (ctx) => setMode(ctx, "react", { stop: 4, follow: false }) },
    { cap: "Hotter than about 1,000 °C the coke turns CO₂ back into CO. That takes heat: CO₂ + C → 2CO.", dur: 6, view: () => ({ target: FUR(300, 120, -92), yaw: 6, pitch: 8, dist: 340, width: 170 }), act: (ctx) => setMode(ctx, "react", { stop: 5, follow: false }) },
    { cap: "Heat and gas: the burden heats from the top down while the gas cools from about 2,000 °C to a few hundred.", dur: 6, view: () => ({ target: FUR(300, 150, -92), yaw: 12, pitch: 10, dist: 560, width: 260 }), act: (ctx) => setMode(ctx, "heat") },
    { cap: "Your turn: follow your lump through all ten reactions, or step them with ↑ ↓.", dur: 4.5, view: () => ({ target: FUR(300, 150, -92), yaw: 12, pitch: 10, dist: 560, width: 260 }), act: (ctx) => setMode(ctx, "react", { follow: true }) },
  ],
  card: (ctx) => `
    <h1>Inside the blast furnace</h1>
    <p class="lede">A counter-current reactor: the burden comes down for hours, the gas goes up in seconds, and on the way the gas turns ore into iron.</p>
    ${predictBlock(ctx, "furnace", "A lump of sinter is charged at the top. About how long does it take to reach the hearth?", [["a", "About 7 seconds"], ["b", "About 7 minutes"], ["c", "About 7 hours"], ["d", "About 7 days"]], "c")}
    <p>Watch the marked lump on the cut face. Three ways to look, on the right: <b class="gas">Reactions</b> lights each reaction where it runs, ten stops from the stockline to the hearth; <b class="heat">Heat and gas</b> plots both temperatures and the gas; <b>Ride the burden</b> names the zones.</p>
    <div class="row"><button class="go" data-act="react">Show the reactions</button><button class="go soft" data-act="heat">Heat and gas</button></div>
    ${flapBlock(ctx, "furnace", "Why counter-current?", `
      <p>The burden takes <b>6 to 8 hours</b> to come down; the gas rises in about <b>6 to 12 seconds</b>. On the way the gas gives its heat to the solids and takes their oxygen.</p>
      <p>High up, CO strips oxygen in steps: Fe₂O₃ → Fe₃O₄ → FeO. Near 900 to 1,000 °C (the thermal reserve zone) <b>FeO + CO → Fe + CO₂</b>. This <i>indirect</i> reduction is cheap. Hotter than about 1,000 °C any CO₂ meets coke and turns back into CO (<b>CO₂ + C → 2CO</b>, which takes 172 kJ a mole), so what is reduced there costs coke: <i>direct</i> reduction.</p>
      <p>Coke never melts. In the cohesive zone the ore layers soften and close, and the gas gets through only by the coke slits between them. An inverted V is the shape operators want.</p>`)}
    ${keyBlock()}
    ${challengeBlock(ctx, "furnace", "Stop your lump in the thermal reserve zone,", "where wüstite turns to iron by gas. Pause the clock there and hold it for two seconds.", "Gas<br>reducer")}
    <p class="src">Volumes, productivity: SAIL. Bell-less top on BF-3: SAIL. Hot blast and oxygen: CAG Report 38 of 2025. Times: Ricketts (Ispat Inland); Techniques de l'Ingénieur. Reactions and where they run: ispatguru and standard texts (typical). ΔH: standard heats of formation at 25 °C, our arithmetic. Zone temperatures and the gas profile: typical shapes, not Durgapur measurements. Shape: a typical profile scaled to the published volumes (Durgapur does not publish its furnace lines).</p>`,
  panelKicker: "Inside BF-3",
  panel: (ctx) => {
    const S = ctx.S, M = ctx.M, mode = S.fMode || "react";
    const modes = [["react", "Reactions", "10 stops"], ["heat", "Heat and gas", "the profile"], ["ride", "Ride", "the zones"]];
    const head = `
    <div class="seg" role="radiogroup" aria-label="What the cut shows" id="fModes">${modes.map(([k, t, s]) => `<button type="button" role="radio" data-mode="${k}" aria-checked="${mode === k}">${t}<small>${s}</small></button>`).join("")}</div>
    <div class="big"><b id="fT">–</b><span id="fZone">–</span></div>
    <label class="slider"><span>Hours since your lump was charged</span><output id="fHours">0.0 h</output><input id="fClock" type="range" min="0" max="${(M.RESIDENCE + 0.5).toFixed(1)}" step="0.01" value="0"></label>
    <div class="actions"><button type="button" id="fPlay" aria-pressed="true">Pause</button><button type="button" id="fCut" aria-pressed="true">Close the furnace</button><button type="button" id="fRestart">Charge a new lump</button></div>`;
    if (mode === "react") return head + `
    <p class="reaction"><b id="rxEq">–</b><br><span id="rxPlain">–</span></p>
    <div class="actions"><button type="button" id="rxUp" aria-label="Previous reaction, higher up">↑ Up</button><button type="button" id="rxDown" aria-label="Next reaction, lower down">Down ↓</button><button type="button" id="rxFollow" aria-pressed="true">Following your lump</button></div>
    <dl class="readings">
      <dt>Reaction</dt><dd id="rxN">–</dd>
      <dt>Heat, per mole (25 °C)</dt><dd id="rxHeat" class="key">–</dd>
      <dt>Where it runs</dt><dd id="rxT">–</dd>
    </dl>
    <p class="note" id="rxWhy"></p>
    <div class="legend"><span><i class="g"></i>the gas at work</span><span><i class="h"></i>heat</span></div>`;
    if (mode === "heat") return head + `
    <div class="legend chartkey"><span><i class="h"></i>the burden</span><span><i class="g"></i>the gas</span><span><i class="d"></i>your lump</span></div>
    ${reichardtSVG(ctx)}
    <h4 class="gash">The gas at your lump's height</h4>
    <div class="gasbar" id="fGas" aria-label="Gas make-up at your lump's height"><i class="co"></i><i class="co2"></i><i class="h2"></i><i class="n2"></i></div>
    <div class="gaslegend"><span><i class="co"></i>CO</span><span><i class="co2"></i>CO₂</span><span><i class="h2"></i>H₂</span><span><i class="n2"></i>N₂ (from the air)</span></div>
    <dl class="readings">
      <dt>Gas here</dt><dd id="fGasT">–</dd>
      <dt>Burden here</dt><dd id="fSolT">–</dd>
      <dt>CO₂ ÷ (CO + CO₂): the gas's work done</dt><dd id="fEta" class="key">–</dd>
    </dl>
    <p class="note">At 55 % of the radius, the path your lump rides. Typical shapes: the gas leaves the raceway at about 39 % CO (898 °C blast with 3.69 % oxygen, CAG; our arithmetic) and the top inside published ranges (CO + CO₂ 37 to 53 %, CO/CO₂ 1.25 to 2.5, ispatguru). Not Durgapur measurements.</p>`;
    return head + `
    <div class="oxides" id="fOx"><i>Fe₂O₃</i><i>Fe₃O₄</i><i>FeO</i><i>Fe</i></div>
    <div class="oxlegend"><span>hematite</span><span>magnetite</span><span>wüstite</span><span>iron</span></div>
    <p class="reaction" id="fReact">–</p>
    <dl class="readings">
      <dt>Depth below the stockline</dt><dd id="fDepth">–</dd>
      <dt>The gas over the same path</dt><dd>6 to 12 s</dd>
      <dt>BF-3 useful / working volume</dt><dd>1,400 / 1,204 m³</dd>
      <dt>Hearth below the tuyeres</dt><dd>${1400 - 1204} m³</dd>
      <dt>Output at 1.82 t/m³·day</dt><dd class="key">${ctx.fmt(1.82 * 1204)} t/day</dd>
      <dt>Hot blast, 2023-24</dt><dd>898 °C (wanted 1,000)</dd>
    </dl>
    <div class="legend"><span><i class="h"></i>heat</span><span><i class="g"></i>gas (CO-rich)</span></div>
    <p class="note">The burden clock runs about ${Math.round(3600 * S.rate)} times real time; the gas beads are slowed for the eye.</p>`;
  },
  wire: (ctx, el) => {
    const S = ctx.S;
    el.querySelectorAll("#fModes [data-mode]").forEach((b) => b.addEventListener("click", () => { setMode(ctx, b.dataset.mode, { follow: b.dataset.mode === "react" ? true : null }); ctx.sound.tick(); }));
    el.querySelector("#fClock").addEventListener("input", (e) => { S.play = false; S.hoursTo = null; S.hours = Number(e.target.value); if (S.fMode === "react") { S.fFollow = true; S.viewOverride = null; } syncF(ctx); });
    el.querySelector("#fPlay").addEventListener("click", () => { S.play = !S.play; if (S.play && S.fMode === "react" && !S.fFollow) { S.fFollow = true; S.viewOverride = null; updateRx(ctx); } syncF(ctx); });
    el.querySelector("#fCut").addEventListener("click", () => { const f = furnaceFig(ctx); f.setKnife(f.knife.to < 50 ? 99 : 0); S.wantCut = f.knife.to < 50; syncF(ctx); });
    el.querySelector("#fRestart").addEventListener("click", () => { S.hours = 0; S.hoursTo = null; S.play = true; if (S.fMode === "react") { S.fFollow = true; S.viewOverride = null; } syncF(ctx); });
    if (S.ui.rxUp) {
      S.ui.rxUp.addEventListener("click", () => goStop(ctx, (S.fStop ?? 0) - 1));
      S.ui.rxDown.addEventListener("click", () => goStop(ctx, (S.fStop ?? 0) + 1));
      S.ui.rxFollow.addEventListener("click", () => { S.fFollow = true; S.play = true; S.hoursTo = null; S.viewOverride = null; const f = furnaceFig(ctx); if (f.journey) S.fStop = ctx.M.stopOf(f.journey); f.setChem("react", S.fStop); syncF(ctx); updateRx(ctx); ctx.setCaption(furnace.caption(ctx)); });
      updateRx(ctx);
    }
    syncF(ctx);
  },
  tick: (ctx, dt) => {
    const f = furnaceFig(ctx), S = ctx.S;
    if (S.wantCut && f.phase === "live" && !S.tour.on && f.knife.to > 50 && !S.cutOnce) { S.cutOnce = true; f.setKnife(0); }
    const J = f.journey;
    if (!J) return;
    // the reactions follow the lump down
    if (S.fMode === "react" && S.fFollow) {
      const k = ctx.M.stopOf(J);
      if (k !== S.fStop) { S.fStop = k; f.setChem("react", k); updateRx(ctx); if (!S.tour.on) ctx.setCaption(furnace.caption(ctx)); }
    }
    // the challenge: armed once the lump has been above the zone; paused inside it for 2 s
    if (J.zone === "Upper stack" || J.zone === "Stack") S.fArmed = true;
    if (S.fArmed && !S.play && !S.tour.on && J.zone === "Thermal reserve zone") { S.fHold = (S.fHold || 0) + dt; if (S.fHold > 2) ctx.earn("furnace", "Stamp: you stopped the lump where gas turns wüstite to iron."); } else S.fHold = 0;
  },
  readouts: (ctx) => {
    const J = furnaceFig(ctx).journey;
    if (!J) return;
    set(ctx, "fT", `${ctx.fmt(J.T)} °C`);
    set(ctx, "fZone", ctx.S.fMode === "react" ? ctx.M.STOPS[ctx.S.fStop ?? 0].name : J.zone);
    set(ctx, "fHours", `${J.hours.toFixed(1)} h`);
    set(ctx, "fDepth", `${J.depth.toFixed(1)} m`);
    set(ctx, "fReact", J.reaction);
    const ox = ctx.S.ui.fOx;
    if (ox) [...ox.children].forEach((c, i) => { const v = J.phase === "solid" ? J.mix[i] : i === 3 ? 1 : 0; c.style.flexBasis = `${(v * 100).toFixed(1)}%`; c.style.flexGrow = "0"; });
    const sl = ctx.S.ui.fClock;
    if (sl && document.activeElement !== sl) sl.value = String(ctx.S.hours);
    updateChart(ctx);
  },
  text: (ctx) => `<h2>4 · Inside the blast furnace</h2><p>A blast furnace is a counter-current shaft: sinter, lump ore and coke are charged at the top in layers and come down over 6 to 8 hours, while gas made at the tuyeres rises through them in 6 to 12 seconds. The gas heats the burden and strips its oxygen. In the cohesive zone, an inverted V, the ore softens and melts at about 1,200 to 1,400 °C; only coke stays solid, holding the column open for the gas. Liquid iron and slag drip into the hearth.</p>
    <h3>The reactions, top to bottom (typical; ΔH per mole as written at 25 °C)</h3><ol>${ctx.M.STOPS.map((s) => `<li><b>${s.name}</b> (${s.zone.toLowerCase()}, ${s.T}): ${s.eq}${s.dH == null ? "" : `, ΔH ${s.dH < 0 ? "−" : "+"}${Math.abs(s.dH)} kJ${s.dHnote ? ` ${s.dHnote}` : ""}`}. ${s.plain}</li>`).join("")}</ol>
    <p>The gas leaves the raceway at about 2,000 °C with no CO₂ and roughly 39 % CO (for BF-3's 898 °C blast with 3.69 % oxygen enrichment, CAG; our arithmetic). It stays near the burden's temperature through the thermal reserve zone and leaves the top at a few hundred degrees with some of its CO turned to CO₂ (top gas ranges: CO + CO₂ 37 to 53 %, CO/CO₂ 1.25 to 2.5, ispatguru).</p>
    <p>BF-3 has 1,400 m³ of useful volume (taphole to stockline) and 1,204 m³ of working volume (tuyeres to stockline), so 196 m³ of hearth sits below the tuyeres. At 1.82 t per m³ of working volume a day it makes about ${Math.round(1.82 * 1204).toLocaleString("en-IN")} t a day. Its hot blast averaged 898 °C in 2023-24 against a wanted 1,000 °C (CAG).</p>`,
};
function syncF(ctx) {
  const S = ctx.S, f = furnaceFig(ctx);
  const p = S.ui.fPlay; if (p) { p.textContent = S.play ? "Pause" : "Play"; p.setAttribute("aria-pressed", String(S.play)); }
  const c = S.ui.fCut; if (c) { const open = f.knife.to < 50; c.textContent = open ? "Close the furnace" : "Cut it open"; c.setAttribute("aria-pressed", String(open)); }
}

// ============================================================ 5 · tapping
const cast = {
  id: "cast", short: "Tapping", kicker: "5 · Tapping the hearth", figures: ["furnace"], stamp: true,
  view: () => ({ target: FUR(380, 62, -70), yaw: 34, pitch: 24, dist: 420, width: 230 }),
  enter: (ctx) => { const f = ctx.plant.byId.furnace.fig; f.setKnife(0); },
  labels: (ctx) => {
    const f = ctx.plant.byId.furnace.fig;
    if (f.phase !== "live") return [];
    return [
      { text: "Taphole", pos: FUR(f.tap.x, 58, FZ), dx: -30, dy: -50, heat: true },
      { text: "Skimmer: slag one way, iron the other", pos: FUR(FX + 81, 62, FZ), dx: 20, dy: -60 },
      { text: "Rocking runner", pos: FUR(FX + 126, 54, FZ), dx: 40, dy: -40 },
      { text: "Torpedo ladles, two tracks", pos: FUR(f.trackX[1], 30, FZ - 30), dx: 40, dy: 10 },
      { text: "Slag granulation", pos: FUR(FX + 75, 18, -14), dx: -40, dy: 40 },
      { text: "Second taphole and its mud gun", pos: FUR(FX - 92, 64, FZ - 16), dx: -40, dy: -40 },
    ];
  },
  caption: (ctx) => (ctx.saved.stamps.cast ? "Stamp earned. Watch the rocking runner swap torpedoes on the next cast." : "Watch the hearth fill, then open the taphole before it is too full."),
  shots: [
    { cap: "Iron and slag collect in the hearth. Slag is lighter, so it floats on the iron.", dur: 5.5, view: () => ({ target: FUR(300, 62, -92), yaw: 4, pitch: 8, dist: 260, width: 130 }) },
    { cap: "BF-3 has twin tapholes: one casts while the other is plugged with clay and made ready.", dur: 5.5, view: () => ({ target: FUR(300, 60, -80), yaw: 0, pitch: 30, dist: 520, width: 280 }) },
    { cap: "In the trough a skimmer holds the floating slag back; the iron runs under it.", dur: 5.5, view: () => ({ target: FUR(372, 58, -86), yaw: 40, pitch: 34, dist: 220, width: 110 }), act: (ctx) => { ctx.S.castPhase = Math.floor(ctx.S.castPhase) + 0.72; } },
    { cap: "A rocking runner tips the iron into one torpedo ladle, then the other (PIB, BF-3's 2002 rebuild).", dur: 6, view: () => ({ target: FUR(440, 40, -86), yaw: 30, pitch: 22, dist: 300, width: 150 }) },
    { cap: "Slag runs off to be granulated with water and sold to cement makers.", dur: 5, view: () => ({ target: FUR(370, 30, -20), yaw: 20, pitch: 30, dist: 260, width: 130 }) },
  ],
  card: (ctx) => `
    <h1>Tapping the hearth</h1>
    <p class="lede">Every few hours the furnace is drained of iron and slag.</p>
    ${predictBlock(ctx, "cast", "Liquid iron and liquid slag sit together in the hearth. Which is on top?", [["a", "Iron, because it is hotter"], ["b", "Slag, because it is lighter"], ["c", "They are mixed"]], "b")}
    ${flapBlock(ctx, "cast", "Why it separates", `<p>Slag (lime, silica, alumina, magnesia) is about a third as dense as iron, so it floats. In the trough a <b>skimmer</b> plate dips into the stream: the iron flows under it, the slag is turned aside.</p><p>Hot metal leaves at about 1,450 to 1,500 °C with 4 to 4.5 % carbon (typical). It goes to the steel shop in torpedo ladles; a little is cast into pig iron (368,334 t in 2017-24, CAG).</p>`)}
    ${facts([["≈350 kg", "of slag with each tonne of iron at Durgapur", "5.93 Mt slag ÷ 17.05 Mt iron, 2017-24 (CAG); our arithmetic"], ["1.31 Mt", "of slag sold molten, 2017-24", "Durgapur is the only SAIL plant that does this (CAG)"], ["2", "tapholes on BF-3, with rocking runners on both sides", "added in its 2002 rebuild (PIB)"]])}
    ${challengeBlock(ctx, "cast", "Open the taphole", "once the hearth is more than 80 % full, before the slag climbs toward the tuyeres.", "Cast<br>house")}
    <p class="src">Slag chemistry and hot metal analysis: typical values for Indian furnaces. The cast cycle on screen is illustrative, not plant data.</p>`,
  panelKicker: "The cast house",
  panel: () => `
    <div class="big"><b id="cLevel">–</b><span>of the hearth full</span></div>
    <div class="actions"><button type="button" id="cTap">Open the taphole</button></div>
    <dl class="readings">
      <dt>State</dt><dd id="cState">–</dd>
      <dt>Torpedo filling</dt><dd id="cWhich">–</dd>
      <dt>Hot metal, typical</dt><dd>4.0–4.5 % C, 0.4–0.8 % Si</dd>
      <dt>Hot metal temperature</dt><dd>1,450–1,500 °C</dd>
      <dt>Slag basicity CaO/SiO₂</dt><dd>about 1.0–1.1</dd>
      <dt>Al₂O₃ in Indian slag</dt><dd>17–22 % (high)</dd>
    </dl>
    <p class="note">Indian ores carry a lot of alumina, so Indian slags are high in Al₂O₃ and run at higher slag volumes.</p>`,
  wire: (ctx, el) => {
    el.querySelector("#cTap").addEventListener("click", () => {
      const S = ctx.S, p = S.castPhase % 1;
      const lvl = ctx.M.hearthLevel(S.castPhase);
      if (p < 0.7) { if (lvl > 0.8) ctx.earn("cast", "Stamp: you tapped the hearth in time."); S.castPhase = Math.floor(S.castPhase) + 0.7; ctx.sound.tick(); }
    });
  },
  readouts: (ctx) => {
    const S = ctx.S, p = S.castPhase % 1, lvl = ctx.M.hearthLevel(S.castPhase);
    set(ctx, "cLevel", `${Math.round(lvl * 100)} %`);
    set(ctx, "cState", p < 0.7 ? "filling: tapholes plugged" : "casting: taphole open");
    set(ctx, "cWhich", p < 0.7 ? "none" : `track ${1 + (Math.floor(S.castPhase) % 2)}`);
  },
  text: () => `<h2>5 · Tapping the hearth</h2><p>Liquid iron collects in the hearth under a layer of slag, which is lighter. Through a taphole the furnace is cast every few hours; in the trough a skimmer holds the slag back while the iron runs under it to a rocking runner that fills one torpedo ladle, then the other. BF-3 got twin tapholes and rocking runners in its 2002 rebuild (PIB). Durgapur makes about 350 kg of slag per tonne of iron (5.93 Mt of slag with 17.05 Mt of iron in 2017-24, CAG; our arithmetic); most is granulated with water for cement, and Durgapur is the only SAIL plant that also sells slag molten (1.31 Mt in 2017-24).</p>`,
};

// ============================================================ 6 · stoves and gas
const stoves = {
  id: "stoves", short: "Hot blast", kicker: "6 · Hot blast and the gas loop", figures: ["furnace"],
  view: () => ({ target: FUR(260, 140, -170), yaw: -28, pitch: 20, dist: 900, width: 560 }),
  labels: (ctx) => {
    const f = ctx.plant.byId.furnace.fig;
    if (f.phase !== "live") return [];
    const st = f.stoveState || { onBlast: 0 };
    return [
      ...f.stovesAt.map((p, i) => ({ text: `Stove ${i + 1}`, show: `Stove ${i + 1} · ${i === st.onBlast ? "on blast" : "on gas"}`, pos: FUR(p.x, 228, p.z), dx: [-70, -30, 10][i], dy: [-20, -62, -104][i], heat: i === st.onBlast })),
      { text: "Hot blast main", pos: FUR(200, 82, -120), dx: 10, dy: 50, heat: true },
      { text: "Bustle pipe and tuyeres", pos: FUR(f.tap.x + 14, f.bustle.y, FZ + 30), dx: 60, dy: 30, heat: true },
      { text: "Downcomer", pos: FUR(FX + 70, 330, -180), dx: 40, dy: -30, gas: true },
      { text: "Dust catcher", pos: FUR(FX + 150, 160, -218), dx: 40, dy: -10 },
      { text: "Scrubber", pos: FUR(FX + 232, 150, -196), dx: 40, dy: 0 },
      { text: "Clean gas main, back to the stoves", pos: FUR(240, 188, -250), dx: 40, dy: -70, gas: true },
    ];
  },
  caption: () => "The furnace's own top gas, cleaned, heats the air it is blown with.",
  shots: [
    { cap: "The gas leaving the top still holds CO. Uptakes and a downcomer take it to the dust catcher.", dur: 5.5, view: () => ({ target: FUR(380, 240, -170), yaw: 20, pitch: 18, dist: 560, width: 300 }) },
    { cap: "A scrubber cleans it, and the clean gas main carries it back to the stoves as fuel.", dur: 5.5, view: () => ({ target: FUR(300, 150, -220), yaw: -10, pitch: 30, dist: 820, width: 520 }) },
    { cap: "A stove on gas burns it and stores the heat in its checker bricks.", dur: 5.5, view: () => ({ target: FUR(144, 110, -150), yaw: 38, pitch: 12, dist: 400, width: 160 }) },
    { cap: "On blast, cold air is pushed up through the hot checkers and leaves as hot blast for the bustle pipe.", dur: 6, view: () => ({ target: FUR(220, 100, -130), yaw: 20, pitch: 22, dist: 520, width: 280 }) },
  ],
  card: (ctx) => `
    <h1>Hot blast and the gas loop</h1>
    <p class="lede">The furnace heats its own air with its own gas.</p>
    ${predictBlock(ctx, "stoves", "What fuel heats the stoves that heat the blast?", [["a", "Imported coal"], ["b", "The furnace's own top gas, cleaned"], ["c", "Electric heaters"]], "b")}
    ${flapBlock(ctx, "stoves", "Regenerative stoves", `<p>Each stove takes turns: <b>on gas</b> it burns cleaned top gas and stores heat in its checker bricks; <b>on blast</b> cold air goes up through the hot bricks and leaves as hot blast. With three or four stoves per furnace, one is always on blast.</p><p>Hotter blast means less coke: SAIL's rule of thumb is 2 to 3 % more coke for every 100 °C lost (CAG). Durgapur's furnaces ran at 898 to 934 °C in 2023-24 against wanted 950 to 1,000 °C, partly because of ageing stoves. BF-4's fourth stove, due in July 2022, was finished in August 2025.</p>`)}
    ${facts([["898–934 °C", "Durgapur's hot blast, 2023-24", "SAIL's new big furnaces: 1,137 to 1,155 °C (CAG Table 11)"], ["1.44–1.66", "kg/cm² blast pressure, 2023-24", "new big furnaces: about 4 (CAG Table 13)"], ["116–135", "thousand Nm³ an hour of blast", "new big furnaces: 341 to 353 (CAG Table 13)"]])}
    <p class="src">Stove cycle and checker heat on screen are illustrative. Three stoves are drawn; Durgapur's furnaces have three or four.</p>`,
  panelKicker: "Stoves",
  panel: () => `
    <div class="big"><b id="sState">–</b><span>the cut stove</span></div>
    <div class="actions"><button type="button" id="sSwap">Change over the stoves</button></div>
    <dl class="readings">
      <dt>Stove on blast</dt><dd id="sOn">–</dd>
      <dt>Checker heat, cut stove</dt><dd id="sLevel">–</dd>
      <dt>Hot blast wanted, BF-3</dt><dd>1,000 °C</dd>
      <dt>Hot blast actual, 2023-24</dt><dd class="key">898 °C</dd>
      <dt>Coke cost of 100 °C less</dt><dd>+2 to 3 %</dd>
      <dt>Oxygen enrichment, BF-3</dt><dd>3.69 % (wanted 3.5)</dd>
    </dl>
    <div class="legend"><span><i class="h"></i>hot blast</span><span><i class="g"></i>top gas, then clean gas</span></div>`,
  wire: (ctx, el) => { el.querySelector("#sSwap").addEventListener("click", () => { ctx.S.stovePhase = Math.floor(ctx.S.stovePhase) + 1.02; ctx.sound.tick(); }); },
  readouts: (ctx) => {
    const st = ctx.plant.byId.furnace.fig.stoveState;
    if (!st) return;
    set(ctx, "sState", st.cutState === "blast" ? "on blast" : "on gas");
    set(ctx, "sOn", `stove ${st.onBlast + 1} of 3`);
    set(ctx, "sLevel", `${Math.round(st.level * 100)} %`);
  },
  text: () => `<h2>6 · Hot blast and the gas loop</h2><p>The gas leaving the top of the furnace still holds CO. Uptakes and a downcomer take it to a dust catcher and a scrubber; the clean gas is burned in regenerative stoves, which store the heat in checker bricks and give it back to the cold blast. Durgapur's hot blast ran at 898 to 934 °C in 2023-24 against wanted 950 to 1,000 °C, with blast pressure of 1.44 to 1.66 kg/cm²; SAIL's new large furnaces run at 1,137 to 1,155 °C and about 4 kg/cm² (CAG Report 38 of 2025). Every 100 °C less hot blast costs 2 to 3 % more coke. BF-4's fourth stove was finished in August 2025.</p>`,
};


// ============================================================ 1 · raw materials
const RAWW = (x, y, z) => W("raw", x, y, z);
const raw = {
  id: "raw", short: "Raw materials", kicker: "1 · Raw materials", figures: ["raw"], stamp: true,
  view: () => ({ target: RAWW(130, 12, -40), yaw: 22, pitch: 26, dist: 440, width: 280 }),
  enter: (ctx) => { ctx.S.rArmed = false; },
  caption: (ctx) => (ctx.saved.stamps.raw ? "Stamp earned. Next: the coke ovens." : "Set how many layers build the bed, then reclaim a slice from its end."),
  shots: [
    { cap: "Ore, flux and coal arrive by rail. A wagon tippler rolls each wagon over into a pit.", dur: 5, view: () => ({ target: RAWW(32, 14, -42), yaw: 30, pitch: 24, dist: 240, width: 110 }) },
    { cap: "A stacker runs up and down the bed, laying a thin layer on every pass.", dur: 5.5, view: () => ({ target: RAWW(140, 16, -30), yaw: 10, pitch: 22, dist: 320, width: 200 }) },
    { cap: "Seen end on, the layers lie like nested chevrons, each from a different lot of ore.", dur: 5.5, view: () => ({ target: RAWW(214, 10, -40), yaw: 72, pitch: 14, dist: 220, width: 90 }) },
    { cap: "The reclaimer rakes across the whole end, so every slice it takes holds every layer.", dur: 5, view: () => ({ target: RAWW(214, 12, -40), yaw: 52, pitch: 20, dist: 260, width: 120 }), act: (ctx) => ctx.plant.byId.raw.fig.startReclaim() },
  ],
  labels: (ctx) => {
    const f = ctx.plant.byId.raw.fig;
    if (f.phase !== "live") return [];
    return [
      { text: "Wagon tippler", pos: RAWW(32, 31, -42), dx: -40, dy: -40 },
      { text: "Blending bed, in chevron layers", pos: RAWW(150, 18, -40), dx: 30, dy: -60 },
      { text: "Stacker", pos: RAWW(f.stacker.position.x, 14, -5), dx: -40, dy: 44 },
      { text: "Bridge reclaimer", pos: RAWW(224, 30, -40), dx: 50, dy: -40 },
    ];
  },
  card: (ctx) => `
    <h1>Raw materials: blend first</h1>
    <p class="lede">A furnace runs steadily only on a steady burden.</p>
    <p>Three wagon tipplers unload ore, flux and coal from rail wagons. Three blender-cum-reclaimers lay the ore and flux in long beds and take them back across their ends. Lump ore and flux go straight on to the furnaces; coal goes to the coal handling plant for the ovens.</p>
    ${predictBlock(ctx, "raw", "The stacker lays the bed in many thin layers along its length, and the reclaimer cuts across its end. Why?", [["a", "So that trucks can reach the pile"], ["b", "So every slice holds a little of every layer, and its chemistry averages out"], ["c", "To let the ore dry in the sun"]], "b")}
    ${flapBlock(ctx, "raw", "Bedding and blending", `<p>Each train of ore is a little different in iron, silica and alumina. Laid in thin layers along the whole bed and then cut across, the differences average out, so the sinter plant gets an even mix and the furnace an even burden.</p><p>More layers make a better blend: try 6, then 40, and look at the end of the bed.</p>`)}
    ${facts([["Bolani", "SAIL's own mines in Odisha and Jharkhand supply the ore", "also Gua, Kiriburu, Meghahatuburu, Barsua, Taldih, Kalta"], ["Jharia", "the coking coal belt is next door to Durgapur", "blended with imported low-ash coal, because Indian coal is high in ash"], ["493 kg", "of lump ore per tonne of iron, 2023-24", "norm 515 kg (CAG Table 3)"]])}
    ${challengeBlock(ctx, "raw", "Build a bed of at least 30 layers,", "then reclaim a slice from its end.", "Well<br>blended")}
    <p class="src">Plant facilities: SAIL. Mines and coal: Global Energy Monitor. Lump ore rate: CAG Report 38 of 2025. The figure is shortened: real beds are hundreds of metres long.</p>`,
  panelKicker: "The blending bed",
  panel: (ctx) => `
    <div class="big"><b id="rN">–</b><span>layers in the bed</span></div>
    <label class="slider"><span>Passes of the stacker</span><output id="rNo">–</output><input id="rSlide" type="range" min="2" max="40" step="1" value="${Math.round(ctx.plant.byId.raw.fig.layers)}"></label>
    <div class="actions"><button type="button" id="rRec">Reclaim a slice</button></div>
    <dl class="readings">
      <dt>Wagon tipplers</dt><dd>3</dd><dt>Blender-cum-reclaimers</dt><dd>3</dd>
      <dt>Ore in, a year (older estimate)</dt><dd>~2.9 Mt</dd><dt>Coal in, a year (older estimate)</dt><dd>~1.84 Mt</dd>
      <dt>All raw materials (older estimate)</dt><dd>~7.4 Mt</dd>
    </dl>
    <p class="note">The yearly tonnages are from an older description of the plant, shown for scale.</p>`,
  wire: (ctx, el) => {
    const f = ctx.plant.byId.raw.fig;
    el.querySelector("#rSlide").addEventListener("input", (e) => { f.layers = Number(e.target.value); });
    el.querySelector("#rRec").addEventListener("click", () => { if (f.startReclaim()) { ctx.sound.tick(); if (f.layers >= 30) setTimeout(() => ctx.earn("raw", "Stamp: a well-blended bed, reclaimed across every layer."), 2200); } });
  },
  readouts: (ctx) => { const f = ctx.plant.byId.raw.fig; set(ctx, "rN", `${Math.round(f.layers)}`); set(ctx, "rNo", `${Math.round(f.layers)}`); },
  text: () => `<h2>1 · Raw materials</h2><p>Three wagon tipplers unload ore, flux and coal from rail wagons; three blender-cum-reclaimers lay ore and flux in long beds in thin chevron layers and reclaim them across the end, so each slice holds every layer and the chemistry evens out (bedding and blending). Ore comes from SAIL's own mines (Bolani in Odisha; Gua, Kiriburu and Meghahatuburu in Jharkhand; Barsua, Taldih and Kalta in Odisha). Coking coal comes from the Jharia-Raniganj belt next door, blended with imported low-ash coal. In 2023-24 the furnaces used 493 kg of lump ore per tonne of iron (CAG).</p>`,
};

// ============================================================ 2 · coke ovens
const COKW = (x, y, z) => W("coke", x, y, z);
const coke = {
  id: "coke", short: "Coke ovens", kicker: "2 · Coke ovens", figures: ["coke"], stamp: true,
  view: () => ({ target: COKW(168, 30, -36), yaw: 14, pitch: 18, dist: 470, width: 310 }),
  enter: (ctx) => { ctx.plant.byId.coke.fig.auto = true; },
  caption: (ctx) => (ctx.saved.stamps.coke ? "Stamp earned. Next: the sinter plant." : "Watch the middle oven drawn large. Push it only when its two plastic layers meet."),
  shots: [
    { cap: "A battery of 78 narrow ovens side by side, each 4.45 m tall. Durgapur has five such batteries.", dur: 5.5, view: () => ({ target: COKW(120, 20, -46), yaw: 6, pitch: 22, dist: 420, width: 250 }) },
    { cap: "Drawn large: three ovens and the four heating walls between them, where gas burns in the flues.", dur: 5.5, view: () => ({ target: COKW(275, 34, -14), yaw: -4, pitch: 8, dist: 210, width: 100 }) },
    { cap: "Heat comes from both walls, so a plastic layer forms at each wall and the two creep inward.", dur: 6, view: () => ({ target: COKW(275, 34, -14), yaw: 8, pitch: 6, dist: 150, width: 70 }) },
    { cap: "When they meet in the middle the coke is done. The pusher ram shoves it out into the quench car.", dur: 6, view: () => ({ target: COKW(150, 16, -20), yaw: 24, pitch: 26, dist: 300, width: 170 }), act: (ctx) => { const f = ctx.plant.byId.coke.fig; f.p = 1; f.pushNow(); } },
  ],
  labels: (ctx) => {
    const f = ctx.plant.byId.coke.fig;
    if (f.phase !== "live") return [];
    const ov = f.ovens[1], C = ctx.M.coking(f.p), half = (ov.b - ov.a) / 2;
    return [
      { text: "Coal tower", pos: COKW(12, 70, -48), dx: -20, dy: -30 },
      { text: "Pusher machine", pos: COKW(f.pusher.position.x, 18, -70), dx: -60, dy: -44 },
      { text: "Gas collecting main", pos: COKW(70, 29, -37), dx: -30, dy: -60, gas: true },
      { text: "Quench car", pos: COKW(f.car.position.x, 8, -16), dx: -70, dy: 40 },
      { text: "Quench tower", pos: COKW(230, 50, -5), dx: 30, dy: -50 },
      { text: "Heating wall", pos: COKW(ov.a - 3.2, 40, -6), dx: -70, dy: -20, heat: true },
      { text: "Plastic layer", pos: COKW(ov.a + C.front * half, 30, -6), dx: 60, dy: -50, heat: true },
      { text: "Coal, still heating", pos: COKW((ov.a + ov.b) / 2, 18, -6), dx: 70, dy: 30 },
    ];
  },
  card: (ctx) => `
    <h1>Coke: the furnace's skeleton</h1>
    <p class="lede">Coke is the fuel, the reducing agent and the support of the burden.</p>
    <p>It burns at the tuyeres for heat; its carbon makes the CO that strips oxygen from the ore; and its strong lumps keep the burden open for the gas even where everything else has melted. No other material can do that third job.</p>
    ${predictBlock(ctx, "coke", "Coal is heated from both side walls of a narrow oven. Where does it turn to coke last?", [["a", "Next to the walls"], ["b", "In the middle of the oven"], ["c", "Everywhere at once"]], "b")}
    ${flapBlock(ctx, "coke", "Two layers meet", `<p>Heated without air to about 1,000 to 1,100 °C (typical), coal softens into a plastic layer that gives off its gas and sets behind as coke. A layer starts at each hot wall and moves inward; the two meet in the middle, where a seam forms. Push before they meet and the centre is still half-cooked coal ("green" coke).</p><p>The gas goes up the ascension pipes to the by-product plant: tar, benzene, toluene, naphthalene oil, solvent naphtha and fertiliser are recovered, and the cleaned gas is fuel for the plant.</p>`)}
    ${facts([["5 × 78", "ovens, 4.45 m tall (one battery under cold repair)", "Battery 2 was rebuilt in 2013"], ["300–350", "kg of coke per tonne of iron at the world's best furnaces", "Indian furnaces 450 to 550 (NITI Aayog); SAIL averaged 419 in FY2025-26"], ["1.7 Mt", "of coke a year", "CAG gives 1.66 Mt, judged enough for the furnaces"]])}
    ${challengeBlock(ctx, "coke", "Push the middle oven", "only once its two plastic layers have met in the middle.", "Cooked<br>through")}
    <p class="src">Ovens and by-products: SAIL. Battery 2: Infrastructure Today and SteelOrbis (2013). Coke rates: NITI Aayog; SAIL Board's Report FY2025-26. The ovens drawn large are wider than life against their walls, so their insides read. Coking temperatures are typical; the time scale on screen is not plant data.</p>`,
  panelKicker: "The middle oven",
  panel: () => `
    <div class="big"><b id="kT">–</b><span>at the oven's centre</span></div>
    <label class="slider"><span>Coking cycle</span><output id="kP">–</output><input id="kSlide" type="range" min="0" max="1" step="0.005" value="0.3"></label>
    <div class="actions"><button type="button" id="kAuto" aria-pressed="true">Pause</button><button type="button" id="kPush">Push the oven</button></div>
    <p class="reaction" id="kState">–</p>
    <dl class="readings">
      <dt>Batteries</dt><dd>5 (4 working)</dd><dt>Ovens per battery</dt><dd>78</dd><dt>Oven height</dt><dd>4.45 m</dd>
      <dt>Carbonisation, typical</dt><dd>1,000–1,100 °C</dd><dt>Coke capacity</dt><dd>1.7 Mt a year</dd>
    </dl>
    <div class="legend"><span><i class="h"></i>heat</span><span><i class="g"></i>coke oven gas</span></div>`,
  wire: (ctx, el) => {
    const f = ctx.plant.byId.coke.fig;
    el.querySelector("#kSlide").addEventListener("input", (e) => { f.auto = false; f.p = Number(e.target.value); syncK(ctx); });
    el.querySelector("#kAuto").addEventListener("click", () => { f.auto = !f.auto; syncK(ctx); });
    el.querySelector("#kPush").addEventListener("click", () => {
      const ok = f.pushNow();
      if (ok === null) return;
      ctx.sound.tick();
      if (ok) ctx.earn("coke", "Stamp: cooked through before it was pushed.");
      else ctx.setCaption("Too early: the middle was still coal. That is green coke. Wait for the layers to meet.", 4);
    });
    syncK(ctx);
  },
  readouts: (ctx) => {
    const f = ctx.plant.byId.coke.fig, C = ctx.M.coking(f.p);
    set(ctx, "kT", `${ctx.fmt(C.centre)} °C`); set(ctx, "kP", `${Math.round(f.p * 100)} %`); set(ctx, "kState", f.push ? "Pushing: the ram shoves the glowing cake into the quench car." : C.state);
    const sl = ctx.S.ui.kSlide; if (sl && document.activeElement !== sl) sl.value = String(f.p);
  },
  text: () => `<h2>2 · Coke ovens</h2><p>Durgapur makes its own coke in five batteries of 78 ovens each (4.45 m tall; one battery under cold repair; Battery 2 rebuilt in 2013). Coal is heated without air to about 1,000 to 1,100 °C; a plastic layer forms at each heated wall and moves inward until the two meet in the middle, and the oven is pushed. Coke is the furnace's fuel, its reducing agent and the solid support that keeps the burden open for the gas. The world's best furnaces use 300 to 350 kg of coke per tonne of iron, Indian furnaces 450 to 550 (NITI Aayog); SAIL averaged 419 in FY2025-26.</p>`,
};
function syncK(ctx) { const f = ctx.plant.byId.coke.fig, b = ctx.S.ui.kAuto; if (b) { b.textContent = f.auto ? "Pause" : "Play"; b.setAttribute("aria-pressed", String(f.auto)); } }

// ============================================================ 3 · sinter
const SINW = (x, y, z) => W("sinter", x, y, z);
const sinter = {
  id: "sinter", short: "Sinter", kicker: "3 · The sinter plant", figures: ["sinter"], stamp: true,
  view: () => ({ target: SINW(140, 28, -34), yaw: 16, pitch: 18, dist: 460, width: 300 }),
  enter: (ctx) => { ctx.S.sArmed = false; ctx.S.sHold = 0; },
  caption: (ctx) => (ctx.saved.stamps.sinter ? "Stamp earned. Next: the blast furnace." : "Speed the strand up until the flame cannot reach the grate, then bring it back into the band."),
  shots: [
    { cap: "Ore fines, limestone, coke breeze and returned fines are mixed with water into little balls.", dur: 5, view: () => ({ target: SINW(40, 40, -30), yaw: 24, pitch: 24, dist: 230, width: 110 }) },
    { cap: "Under the ignition hood the top of the bed catches. Fans pull air down through it.", dur: 5.5, view: () => ({ target: SINW(56, 34, -20), yaw: 12, pitch: 14, dist: 190, width: 90 }) },
    { cap: "The flame front, about 1,300 °C, burns downward while the bed rides along. Side wall cut away, depth drawn ×3.", dur: 6.5, view: () => ({ target: SINW(130, 34, -18), yaw: 4, pitch: 10, dist: 300, width: 190 }) },
    { cap: "It should reach the grate just before the end: the burn-through point. Then the cake breaks off and cools.", dur: 6, view: () => ({ target: SINW(200, 30, -30), yaw: 26, pitch: 20, dist: 260, width: 140 }) },
  ],
  labels: (ctx) => {
    const f = ctx.plant.byId.sinter.fig;
    if (f.phase !== "live") return [];
    const btpX = f.faceU.uBtp.value;
    return [
      { text: "Ignition hood", pos: SINW(52, 52, -30), dx: -30, dy: -40, heat: true },
      { text: "Flame front, about 1,300 °C", pos: SINW((56 + btpX) / 2, 35, -18), dx: 20, dy: 50, heat: true },
      { text: "Burn-through point", pos: SINW(Math.min(205, btpX), 30, -18), dx: 40, dy: 44 },
      { text: "Wind boxes pull air down", pos: SINW(110, 14, -32), dx: -60, dy: 40, gas: true },
      { text: "Circular cooler", pos: SINW(246, 15, -44), dx: 40, dy: -30 },
      { text: "Chimney", pos: SINW(84, 112, -86), dx: 30, dy: -10 },
    ];
  },
  card: (ctx) => `
    <h1>Sinter: fines into lumps</h1>
    <p class="lede">Most of the furnace's iron arrives as sinter.</p>
    <p>Mining and crushing make a lot of ore fines too small to charge: they would choke the gas flow. Sintering fuses them, with limestone and coke breeze, into strong porous lumps. Sinter is already partly fluxed, it reduces quickly because gas gets inside it, and it uses fines that would otherwise be waste.</p>
    ${predictBlock(ctx, "sinter", "The strand is speeded up. Where does the flame front now reach the grate?", [["a", "Earlier along the strand"], ["b", "Later along the strand"], ["c", "At the same place"]], "b")}
    ${flapBlock(ctx, "sinter", "The burn-through point", `<p>The flame needs a fixed time to burn down through the bed, whatever the strand does. Run the strand faster and the bed travels further in that time, so the front meets the grate later. Too fast and unsintered mix leaves the end and comes back as returns; too slow and the strand is wasted at the end. Operators aim to burn through just before the discharge.</p>`)}
    ${facts([["3", "sinter machines: 142.7, 142.7 and 198 m²", "SAIL"], ["1.38 t", "of sinter per tonne of hot metal", "3.30 Mt ÷ 2.40 Mt (case study); on CAG's 3.01 and 2.45 Mt it is 1.23 t"], ["53–54 %", "iron in SAIL's sinter", "returned fines norm at Durgapur: 18 % (CAG)"]])}
    ${challengeBlock(ctx, "sinter", "Push the strand too fast,", "then bring the burn-through point back between 86 and 97 % of the way and hold it there.", "Burnt<br>through")}
    <p class="src">Machines and capacity: SAIL (CAG gives 3.01 Mt). Fe and returns: CAG Report 38 of 2025. The strand is shortened and its bed drawn three times deeper; the speed-to-burn-through relation on screen is illustrative, with no Durgapur strand data used.</p>`,
  panelKicker: "The strand",
  panel: () => `
    <div class="big"><b id="sB">–</b><span>of the way to the discharge</span></div>
    <label class="slider"><span>Strand speed, share of design</span><output id="sV">–</output><input id="sSlide" type="range" min="0.7" max="1.25" step="0.01" value="1"></label>
    <p class="reaction" id="sNote">–</p>
    <dl class="readings"><dt>Flame front, about</dt><dd>1,300 °C</dd><dt>Sinter capacity</dt><dd>3.30 Mt a year</dd><dt>Target band (typical)</dt><dd>86–97 %</dd></dl>
    <div class="legend"><span><i class="h"></i>heat</span><span><i class="g"></i>air pulled through</span></div>`,
  wire: (ctx, el) => { const f = ctx.plant.byId.sinter.fig; el.querySelector("#sSlide").addEventListener("input", (e) => { f.speed = Number(e.target.value); }); },
  tick: (ctx, dt) => {
    const B = ctx.plant.byId.sinter.fig.btp, S = ctx.S;
    if (!B) return;
    if (B.under || B.btp > 0.99) S.sArmed = true;
    if (S.sArmed && B.ok) { S.sHold += dt; if (S.sHold > 1.5) ctx.earn("sinter", "Stamp: burnt through just before the discharge."); } else S.sHold = 0;
  },
  readouts: (ctx) => {
    const f = ctx.plant.byId.sinter.fig, B = f.btp;
    if (!B) return;
    set(ctx, "sB", B.under ? "past the end" : `${Math.round(B.btp * 100)} %`);
    set(ctx, "sV", `×${f.speed.toFixed(2)}`);
    set(ctx, "sNote", B.under ? "Too fast: raw mix leaves the strand and must come back as returns." : B.ok ? "In the band: the bed is sintered right down to the grate before the end." : B.btp < 0.86 ? "Too slow: the bed burns through early and the end of the strand does nothing." : "Close: almost no strand left to spare.");
  },
  text: () => `<h2>3 · Sinter</h2><p>Ore fines, limestone, coke breeze and returned fines are mixed with water into small balls, spread on a moving strand of pallets and ignited under a hood. Fans pull air down through the bed and the flame front, about 1,300 °C, burns downward while the bed travels; it should reach the grate just before the discharge end (the burn-through point). Durgapur has three machines (142.7, 142.7 and 198 m²) rated at 3.30 Mt a year (CAG: 3.01 Mt), about 1.38 t of sinter per tonne of hot metal. SAIL's sinter carries 53 to 54 % iron.</p>`,
};

// ============================================================ 7 · BF-5 and the future
const LINW = (x, y, z) => W("lineup", x, y, z);
const future = {
  id: "future", short: "BF-5", kicker: "7 · What BF-5 changes", figures: ["lineup"],
  view: () => ({ target: LINW(124, 46, -22), yaw: 0, pitch: 12, dist: 520, width: 280 }),
  caption: () => "Same profile, same scale: Durgapur's three furnaces, the planned BF-5 and Bhilai's BF-8.",
  shots: [],
  labels: (ctx) => {
    const f = ctx.plant.byId.lineup.fig;
    if (f.phase !== "live") return [];
    return f.tops.map((t, i) => ({ text: `${t.f.name}${t.planned ? " (planned)" : ""}`, show: `${t.f.name}${t.planned ? " (planned)" : ""} · ${t.f.useful.toLocaleString("en-IN")} m³`, pos: LINW(t.top.x, t.top.y + 2, t.top.z), center: true, dy: i % 2 ? -18 : -52 }));
  },
  card: (ctx) => {
    const w = ctx.M.worked();
    return `
    <h1>BF-5: one big furnace</h1>
    <p class="lede">Why the plan is one large furnace, not more small ones.</p>
    ${predictBlock(ctx, "future", "BF-5 (3,000 m³) has a little over twice BF-3's useful volume. About how much more iron a day will it make?", [["a", "The same as BF-3"], ["b", "About twice as much"], ["c", "About three times as much"]], "c")}
    ${flapBlock(ctx, "future", "Bigger is better per cubic metre", `<p>BF-5 is planned at 2.36 Mt a year, about ${ctx.fmt(w.bf5Daily)} t a day: ${(w.bf5Daily / (1.82 * 1204)).toFixed(1)} times BF-3, from ${(3000 / 1400).toFixed(1)} times the volume. On useful volume that is ${w.bf5UsefulProd.toFixed(2)} t per m³ a day against BF-3's ${w.usefulProd.toFixed(2)}.</p><p>A large furnace loses less heat per tonne through its walls, needs less coke and labour per tonne, and is built for hotter, higher-pressure blast: SAIL's new big furnaces blow 1,137 to 1,155 °C at about 4 kg/cm², where Durgapur's manage 898 to 934 °C at 1.44 to 1.66.</p>`)}
    ${facts([["3.42 Mt", "of iron a year after the expansion", `+${(w.afterExpansion * 100).toFixed(0)} %, though BF-2 retires and BF-4 goes on standby`], ["2.5 Mt", "pellet plant, so the plant can use fine ore that sintering cannot", "planned with BF-5"], ["~2030", "planned start", "Stage-I approved; 6 packages awarded (SAIL Board's Report FY2025-26)"], ["1.17×", "Bhilai BF-8 alone, against all three Durgapur furnaces", `${ctx.fmt(8030)} t/day vs ${ctx.fmt(w.total)}`]])}
    <p class="src">Expansion: the 2025 environmental impact report as summarised by Global Energy Monitor; earlier announcements quoted other totals. BF-5's working volume is not published, so its shell assumes BF-4's working-to-useful ratio. Bhilai BF-8: SAIL and PIB.</p>`;
  },
  panelKicker: "To one scale",
  panel: (ctx) => {
    const rows = [...ctx.M.FURNACES, ctx.M.BF5, ctx.M.BHILAI8].map((f) => ({ n: f.name, u: f.useful, d: ctx.M.dailyOf(f) }));
    return `<table class="calc"><thead><tr><th>Furnace</th><th>Useful m³</th><th>t/day</th><th>t/m³·day*</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.n}</td><td>${ctx.fmt(r.u)}</td><td>${ctx.fmt(r.d)}</td><td>${(r.d / r.u).toFixed(2)}</td></tr>`).join("")}</tbody></table>
    <p class="note">* on useful volume, so all five compare; SAIL quotes Durgapur's productivity on working volume (1.69 to 1.82). BF-5 from 2.36 Mt a year ÷ 365.</p>`;
  },
  text: (ctx) => { const w = ctx.M.worked(); return `<h2>7 · What BF-5 changes</h2><p>The expansion plan (2025 environmental impact report, via Global Energy Monitor) adds BF-5, about 3,000 m³ and 2.36 Mt a year (about ${ctx.fmt(w.bf5Daily)} t a day), and a 2.5 Mt pellet plant around 2030; BF-2 is decommissioned and BF-4 put on standby, for 3.42 Mt of iron a year, ${(w.afterExpansion * 100).toFixed(0)} % more than today's 2.40 Mt rating. One modern furnace makes nearly as much as all three of today's: Bhilai's BF-8 (4,060 m³) is rated at 8,030 t a day, 1.17 times Durgapur's three together.</p>`; },
};

export const ALL = [poster, raw, coke, sinter, furnace, cast, stoves, future];
export const CHAPTERS = [];
export function registerChapter(index, ch) { ALL[index] = ch; }
export function finalizeChapters(plant) {
  CHAPTERS.length = 0;
  for (const c of ALL) if (c && (c.figures || []).every((id) => plant.byId[id])) CHAPTERS.push(c);
  return CHAPTERS;
}
