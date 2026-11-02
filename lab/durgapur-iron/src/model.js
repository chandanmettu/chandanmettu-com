// The one source of truth. Every Durgapur number carries a source key (see SOURCES); every
// textbook range is marked "typical". The figures, tags, cards and challenges all read from here,
// so nothing on screen can disagree with anything else.

export const SOURCES = {
  sail: "SAIL, Durgapur Steel Plant facilities pages (raw materials, coke ovens, sinter, blast furnaces)",
  gem: "Global Energy Monitor, Durgapur Steel Plant tracker (furnace dates, relines, production, 2025 EIA summary)",
  suchnaji: "Suchnaji, Durgapur July 2026 production records",
  bharat: "Bharat Online, Durgapur Steel Plant history and raw materials (older figures)",
  pib: "SAIL and PIB, Bhilai BF-8 (Mahamaya) figures",
  text: "Standard ironmaking texts (typical ranges, not Durgapur measurements)",
  calc: "Our own arithmetic on the published figures",
};

// ---------- the plant ----------
export const PLANT = {
  name: "Durgapur Steel Plant",
  owner: "Steel Authority of India Ltd (SAIL)",
  river: "Damodar",
  started: 1959,
  hotMetalCapacity: 2.40e6, // t a year (sail)
  crudeSteelCapacity: 2.2e6, // about (sail)
  sinterCapacity: 3.30e6, // t a year (sail)
  cokeCapacity: 1.7e6, // t a year (gem)
  julyRecord: { hotMetal: 227400, crudeSteel: 201200, days: 31, plan: 1.05 }, // July 2026 (suchnaji)
};

// hot metal and crude steel, million tonnes (gem, via the case study's chart and text)
export const PRODUCTION = [
  { year: 2020, hm: 1.84 },
  { year: 2022, hm: 2.56 },
  { year: 2023, hm: 2.57 },
  { year: 2024, hm: 2.50, cs: 2.26 },
];

// ---------- raw materials ----------
export const RAW = {
  tipplers: 3, // wagon tipplers (sail)
  reclaimers: 3, // blender-cum-reclaimers (sail)
  oreIn: 2.9e6, coalIn: 1.84e6, totalIn: 7.4e6, // older published estimate (bharat)
  ore: ["Bolani (Odisha)", "Gua, Kiriburu, Meghahatuburu (Jharkhand)", "Barsua, Taldih, Kalta (Odisha)"],
  coal: "Jharia-Raniganj belt (BCCL Chasnala, CCL), plus imported low-ash coking coal",
};

// ---------- coke ovens ----------
export const COKE = {
  batteries: 5, working: 4, ovens: 78, ovenHeight: 4.45, // m (sail)
  capacity: 1.7e6, // t a year (gem)
  carbonise: [1000, 1100], // °C, typical (text)
  byproducts: ["naphthalene oil", "heavy creosote oil", "light oil", "crude tar", "benzene", "toluene", "solvent naphtha", "Raja fertiliser"],
};

// The coking cycle as one number p from 0 (just charged) to 1 (ready to push). Heat comes in from
// both walls, so a plastic layer forms at each wall and the two creep inward and meet in the middle
// (the tar seam). Behind each layer is coke; in front, coal still drying and heating.
export function coking(p) {
  const q = Math.min(1, Math.max(0, p));
  const front = q; // share of the half-width each plastic layer has crossed
  const centre = 100 + (1050 - 100) * Math.pow(q, 2.2); // °C at the centre: wet until late, then fast (shape typical)
  let state;
  if (q < 0.05) state = "Coal charged: the walls start heating it";
  else if (q < 0.97) state = "Plastic layers creep in from both walls";
  else state = "The layers have met: coke is ready to push";
  return { p: q, front, centre, state, done: q >= 0.97 };
}

// ---------- sinter ----------
export const SINTER = {
  machines: [{ name: "Machine 1", area: 142.7 }, { name: "Machine 2", area: 142.7 }, { name: "Machine 3", area: 198 }], // m² (sail)
  capacity: 3.30e6, // t a year (sail)
  flame: 1300, // °C at the flame front, about (case study, typical)
};

// The strand as a belt of time: the bed rides from the ignition hood to the discharge end while the
// flame front burns down through it. Where the front reaches the grate is the burn-through point.
// Inputs are shares, so no strand dimension is invented: speed 1 = design speed.
export function burnThrough(speed) {
  const s = Math.max(0.2, speed);
  const btp = 0.93 * s; // at design speed the front reaches the grate at 93 % of the strand (target band typical)
  return { btp, ok: btp >= 0.86 && btp <= 0.97, under: btp > 1 };
}

// ---------- blast furnaces ----------
// started and re-commissioned: CAG Report 38 of 2025, Table 2 (BF-1, from 1959, is phased out).
// Hot blast and oxygen, 2023-24 actuals: CAG Tables 11 and 12. GEM also lists a BF-3 reline in
// March 2025; no SAIL or press report confirms it, so it is shown as unconfirmed.
export const FURNACES = [
  { id: "bf2", name: "BF-2", useful: 1400, working: 1207, prod: 1.71, started: "1961", recommissioned: "1993", blast: 923, blastWant: 1000, o2: 2.69, top: null, note: "listed by GEM as operating pre-retirement" },
  { id: "bf3", name: "BF-3", useful: 1400, working: 1204, prod: 1.82, started: "1962", recommissioned: "2002", blast: 898, blastWant: 1000, o2: 3.69, top: "bell-less", note: "2002 rebuild: twin taphole, rocking runners, stave coolers (PIB)" },
  { id: "bf4", name: "BF-4", useful: 1800, working: 1539, prod: 1.69, started: "1967", recommissioned: "1996", blast: 934, blastWant: 950, o2: 3.65, top: null, note: "the largest; its 4th hot blast stove was finished in Aug 2025 (CAG)" },
];
// SAIL's new large furnaces, for contrast (CAG Tables 11 and 13, 2023-24)
export const NEW_FURNACES = { blast: [1137, 1155], pressure: 4.0, volume: [341, 353] };
export const DSP_BLAST = { pressure: [1.44, 1.66], pressureWant: [1.65, 1.70], volume: [116, 135], volumeWant: [125, 140] }; // kg/cm², ×10³ Nm³/h (CAG Table 13)
// planned vs actual productivity, t/m³ of working volume a day (CAG Table 6)
export const PRODUCTIVITY = [
  { fy: "2017-18", plan: 1.72, actual: 1.76 }, { fy: "2018-19", plan: 1.92, actual: 1.78 }, { fy: "2019-20", plan: 1.92, actual: 1.75 },
  { fy: "2020-21", plan: 1.75, actual: 1.76 }, { fy: "2021-22", plan: 1.86, actual: 1.75 }, { fy: "2022-23", plan: 1.88, actual: 1.87 },
  { fy: "2023-24", plan: 1.92, actual: 1.86 },
];
export const AUDIT = {
  hotMetal2017to24: 17.05e6, mouShare: 1.05, planShare: 0.97, // CAG Table 5
  slag2017to24: 5.93e6, slagMolten: 1.31e6, slagDryPit: 0.61e6, // CAG p.51: DSP alone in SAIL sells molten slag
  pig2017to24: 368334, // t of hot metal to the pig casting machine (CAG Table 15)
  capacity: { hotMetal: 2.45e6, sinter: 3.01e6, coke: 1.66e6 }, // CAG Table 14 (other sources differ)
  cokeBest: [300, 350], cokeIndia: [450, 550], sailCoke: 419, sailFuel: 553, // kg/thm: NITI Aayog; SAIL FY2025-26
};
export const BF5 = { id: "bf5", name: "BF-5", useful: 3000, annual: 2.36e6, start: "around 2030", planned: true };
export const BHILAI8 = { id: "bsp8", name: "Bhilai BF-8", useful: 4060, daily: 8030 };

export const dailyOf = (f) => (f.prod ? f.prod * f.working : f.daily ?? (f.annual ? f.annual / 365 : 0));
export const hearthOf = (f) => (f.working ? f.useful - f.working : null);
export const totalDaily = () => FURNACES.reduce((s, f) => s + dailyOf(f), 0);

// The furnace's lines. Durgapur does not publish its furnaces' profiles, so the shape here is a
// typical one (bosh about 80°, stack about 85°) scaled to the published volumes: the hearth below
// the tuyeres holds exactly (useful − working) volume and the shaft above holds exactly the
// working volume. For furnaces with no published working volume, BF-4's ratio is assumed.
export function linesOf(f) {
  const U = f.useful;
  const W = f.working ?? U * (1539 / 1800);
  const k = Math.cbrt(U / 1400);
  const hH = 3.5 * k; // taphole to tuyeres (typical)
  const rH = Math.sqrt((U - W) / (Math.PI * hH));
  const rB = rH * 1.14, rT = rB * 0.70;
  const hBosh = 3.3 * k, hBelly = 2.0 * k, hThroat = 1.8 * k;
  const vBosh = (Math.PI * hBosh / 3) * (rH * rH + rH * rB + rB * rB);
  const vBelly = Math.PI * rB * rB * hBelly;
  const vThroat = Math.PI * rT * rT * hThroat;
  const hStack = (W - vBosh - vBelly - vThroat) / ((Math.PI / 3) * (rB * rB + rB * rT + rT * rT));
  const yT = hH, yBosh = yT + hBosh, yBelly = yBosh + hBelly, yStack = yBelly + hStack, yStock = yStack + hThroat;
  return { U, W, rH, rB, rT, hH, hBosh, hBelly, hStack, hThroat, yT, yBosh, yBelly, yStack, yStock, assumedW: !f.working };
}
// the inner radius at a height above the taphole, m
export function radiusAt(L, y) {
  if (y <= L.yT) return L.rH;
  if (y <= L.yBosh) return L.rH + (L.rB - L.rH) * ((y - L.yT) / L.hBosh);
  if (y <= L.yBelly) return L.rB;
  if (y <= L.yStack) return L.rB + (L.rT - L.rB) * ((y - L.yBelly) / L.hStack);
  return L.rT;
}

// The cohesive zone: where ore softens and melts. Drawn as the classic inverted V, with its apex
// up the centre and its roots on the wall at the bosh (shape typical). Heights in m above the taphole.
export function cohesiveOf(L) {
  const apex = L.yBelly + 0.42 * L.hStack, root = L.yT + 0.55 * L.hBosh, thick = 1.6 * Math.cbrt(L.U / 1400);
  const lower = (r) => apex - (apex - root) * Math.pow(Math.min(1, r / L.rB), 1.15);
  return { apex, root, thick, lower, upper: (r) => lower(r) + thick };
}

// Temperature of the burden at a point (typical textbook ranges, as in the case study's zone figure):
// about 200 °C at the stockline, 800 to 1,000 °C through the thermal reserve zone, 1,200 to 1,400 °C
// in the cohesive zone, about 2,000 °C in the raceway, and 1,450 to 1,500 °C for the hot metal.
export function temperatureAt(L, r, y) {
  const cz = cohesiveOf(L);
  const lo = cz.lower(r), hi = lo + cz.thick;
  if (y >= hi) {
    const s = (y - hi) / Math.max(0.1, L.yStock - hi); // 0 at the top of the cohesive zone, 1 at the stockline
    if (s < 0.14) return 1200 - 200 * (s / 0.14);
    if (s < 0.62) return 1000 - 120 * ((s - 0.14) / 0.48);
    return 880 - 680 * Math.pow((s - 0.62) / 0.38, 0.8);
  }
  if (y >= lo) return 1200 + 200 * (1 - (y - lo) / cz.thick);
  // below the cohesive zone: hotter toward the tuyeres
  const d = Math.max(0, (lo - y) / Math.max(0.5, lo - L.yT));
  return 1400 + 380 * Math.min(1, d);
}

// The life of one lump of sinter, from the stockline to the hearth. One input: hours since charging.
// The burden moves down at one volume per time, so a lump slows where the furnace is wide and speeds
// where it is narrow. RESIDENCE is how long the solids take to reach the cohesive zone (typical).
export const RESIDENCE = 7; // h: the burden takes 6 to 8 h to come down (Ricketts, typical)
export const GAS_SECONDS = [6, 12]; // s: the gas rises in about 6 to 12 s (Ricketts; Techniques de l'Ingénieur)
export const DIP = 1.0; // m: the charged layers sit lower at the centre than at the wall (shape typical)
// The lump keeps its share of the radius as it comes down. Its layer is a surface of equal volume
// above it, so the path is tabulated in "wall-equivalent" height y_eq = y + DIP·(1 − rFrac).
export function journeyPath(L, rFrac = 0.55) {
  const cz = cohesiveOf(L);
  const c = DIP * (1 - rFrac);
  const pts = [];
  const N = 240;
  let vol = 0;
  const vols = [0];
  const yEnd = cz.lower(rFrac * L.rB) + cz.thick * 0.5;
  for (let i = 0; i <= N; i++) {
    const yq = L.yStock + (yEnd + c - L.yStock) * (i / N);
    const R = radiusAt(L, yq);
    pts.push({ y: yq - c, r: rFrac * radiusAt(L, yq - c), R });
    if (i) {
      const dy = Math.abs(yq - (L.yStock + (yEnd + c - L.yStock) * ((i - 1) / N)));
      vol += Math.PI * ((R + pts[i - 1].R) / 2) ** 2 * dy;
      vols.push(vol);
    }
  }
  return { pts, vols, total: vol, yEnd, rFrac };
}
const OXIDES = [
  { key: "Fe₂O₃", name: "hematite" },
  { key: "Fe₃O₄", name: "magnetite" },
  { key: "FeO", name: "wüstite" },
  { key: "Fe", name: "iron" },
];
// iron oxide state from temperature (typical sequence): hematite → magnetite below about 600 °C,
// magnetite → wüstite up to about 900 °C, wüstite → iron by CO near 900 to 1,000 °C (indirect), the
// rest by carbon above about 1,000 °C (direct)
export function oxideMix(T) {
  const s = (a, b) => Math.min(1, Math.max(0, (T - a) / (b - a)));
  const h2m = s(420, 600), m2w = s(620, 900), w2i = s(880, 1000) * 0.72 + s(1000, 1250) * 0.28;
  const hem = 1 - h2m;
  const mag = h2m * (1 - m2w);
  const wus = h2m * m2w * (1 - w2i);
  const fe = h2m * m2w * w2i;
  return [hem, mag, wus, fe];
}
export function journeyAt(L, path, hours) {
  const h = Math.max(0, hours);
  const solid = Math.min(1, h / RESIDENCE);
  const target = solid * path.total;
  let i = 1;
  while (i < path.vols.length - 1 && path.vols[i] < target) i++;
  const f = (target - path.vols[i - 1]) / Math.max(1e-9, path.vols[i] - path.vols[i - 1]);
  const a = path.pts[i - 1], b = path.pts[i];
  let y = a.y + (b.y - a.y) * f, r = a.r + (b.r - a.r) * f;
  let T = temperatureAt(L, r, y);
  let phase = "solid";
  // after the cohesive zone the iron is liquid: it trickles through the coke to the hearth in minutes
  const drip = Math.max(0, h - RESIDENCE) / 0.25;
  if (drip > 0) {
    const k = Math.min(1, drip);
    const yHearth = L.yT * 0.45;
    y = path.yEnd + (yHearth - path.yEnd) * k;
    r = r * (1 - 0.35 * k);
    T = 1450 + 50 * k;
    phase = k >= 1 ? "hearth" : "dripping";
  }
  const mix = oxideMix(phase === "solid" ? T : 2000);
  const depth = L.yStock - y;
  let zone, reaction;
  if (phase === "hearth") { zone = "Hearth"; reaction = "Liquid iron collects under the lighter slag, about 4 to 4.5 % carbon, until the next cast."; }
  else if (phase === "dripping") { zone = "Dripping zone"; reaction = "Molten iron trickles down through the coke and picks up carbon, which lowers its melting point."; }
  else if (T < 600) { zone = "Upper stack"; reaction = "3Fe₂O₃ + CO → 2Fe₃O₄ + CO₂ : hematite gives up its first oxygen to the rising CO."; }
  else if (T < 880) { zone = "Stack"; reaction = "Fe₃O₄ + CO → 3FeO + CO₂ : magnetite turns to wüstite."; }
  else if (T < 1000 && y > cohesiveOf(L).upper(r)) { zone = "Thermal reserve zone"; reaction = "FeO + CO → Fe + CO₂ : indirect reduction by gas, the cheap way to make iron."; }
  else if (y > cohesiveOf(L).upper(r)) { zone = "Lower stack"; reaction = "FeO + C → Fe + CO : what is left is reduced by carbon itself (direct), which costs heat."; }
  else { zone = "Cohesive zone"; reaction = "The ore softens and melts at about 1,200 to 1,400 °C; only the coke layers stay open for the gas."; }
  return { hours: h, y, r, T, depth, phase, zone, reaction, mix, oxides: OXIDES, solid };
}

// tapping: the hearth fills between casts; a cast drains it (illustrative clock, not plant data)
export function hearthLevel(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.7) return 0.35 + 0.55 * (p / 0.7); // filling
  return 0.9 - 0.55 * ((p - 0.7) / 0.3); // casting
}

// ---------- worked calculations (the case study's, live) ----------
export function worked() {
  const d = FURNACES.map((f) => ({ name: f.name, daily: dailyOf(f), useful: f.useful, working: f.working, prod: f.prod, hearth: hearthOf(f) }));
  const total = d.reduce((s, x) => s + x.daily, 0);
  const july = PLANT.julyRecord.hotMetal / PLANT.julyRecord.days;
  return {
    furnaces: d,
    total,
    annual: total * 365,
    july,
    julyVsRated: july / total - 1,
    usefulProd: dailyOf(FURNACES[1]) / FURNACES[1].useful,
    sinterPerThm: PLANT.sinterCapacity / PLANT.hotMetalCapacity,
    bhilaiVsAll: BHILAI8.daily / total,
    bf5Daily: BF5.annual / 365,
    bf5UsefulProd: BF5.annual / 365 / BF5.useful,
    afterExpansion: 3.42e6 / PLANT.hotMetalCapacity - 1,
  };
}
