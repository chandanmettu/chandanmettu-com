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
  cag: "CAG Report No. 38 of 2025, performance audit of SAIL's blast furnaces, 2017-18 to 2023-24",
  ispat: "ispatguru: Chemistry of the ironmaking by blast furnace process, and Blast furnace gas generation and usage (reactions, where they run, top gas ranges)",
  thermo: "Standard heats of formation at 25 °C (CRC Handbook); each ΔH is our arithmetic, per mole as written",
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
  else if (y > cohesiveOf(L).upper(r)) { zone = "Lower stack"; reaction = "CO₂ + C → 2CO, then FeO + CO → Fe + CO₂ : above about 1,000 °C the coke turns CO₂ back into CO, so in effect FeO + C → Fe + CO (direct reduction), which costs heat."; }
  else { zone = "Cohesive zone"; reaction = "The ore softens and melts at about 1,200 to 1,400 °C; only the coke layers stay open for the gas."; }
  return { hours: h, y, r, T, depth, phase, zone, reaction, mix, oxides: OXIDES, solid };
}

// ---------- the chemistry inside ----------
// Where each reaction runs, top to bottom, with its heat. ΔH is per mole as written at 25 °C from
// standard heats of formation (thermo); a minus sign gives heat to the furnace, a plus sign takes
// it. The temperatures are the typical ones (ispat, text); none of this is a Durgapur measurement.
// `band` is the burden temperature range the stop lights on the cut face; `regs` are the kinds of
// region it lights (5 ore, 6 coke, 7 softening ore, 8 dripping coke, 9 raceway, 11 slag, 12 iron);
// `gas` says whether the stop is the gas doing the work (gas colour) or heat (heat colour).
export const STOPS = [
  { id: "dry", Tshort: "120 to 370 °C (gas)", tag: "Drying: H₂O → steam", zone: "Top of the burden", name: "Drying and warming", eq: "H₂O (liquid) → H₂O (steam)", dH: 44, T: "the top gas leaves at about 120 to 370 °C",
    band: [0, 420], regs: [5, 6], gas: true, pos: { r: 0.45, at: "top" },
    plain: "Fresh ore, sinter and coke land on the stockline from the chute. The gas that has come up through the whole furnace is still warm, so the first thing it does is dry the burden and warm it.",
    why: "The gas leaves the top cooled and loaded with CO₂ and steam: the heat it carried is now in the burden.", src: "ispat" },
  { id: "hem", Tshort: "400 to 600 °C", tag: "3Fe₂O₃ + CO → 2Fe₃O₄ + CO₂", zone: "Upper stack", name: "Hematite gives up its first oxygen", eq: "3Fe₂O₃ + CO → 2Fe₃O₄ + CO₂", dH: -47, T: "from about 400 to 600 °C",
    band: [400, 600], regs: [5], gas: true, pos: { r: -0.62, T: 450 },
    plain: "Rising CO takes one oxygen in nine from hematite (Fe₂O₃), leaving magnetite (Fe₃O₄). It is quick and gives out a little heat.",
    why: "The easiest oxygen goes first; each step down the furnace needs hotter, richer gas.", src: "ispat" },
  { id: "mag", Tshort: "600 to 900 °C", tag: "Fe₃O₄ + CO → 3FeO + CO₂", zone: "Stack", name: "Magnetite turns to wüstite", eq: "Fe₃O₄ + CO → 3FeO + CO₂", dH: 19, T: "from about 600 to 900 °C",
    band: [600, 880], regs: [5], gas: true, pos: { r: 0.66, T: 700 },
    plain: "More CO takes more oxygen: magnetite becomes wüstite (FeO), the last oxide before iron. This one takes a little heat.",
    why: "By the bottom of the stack nearly all the ore is wüstite, waiting for the hardest step.", src: "ispat" },
  { id: "calc", Tshort: "about 800 °C", tag: "CaCO₃ → CaO + CO₂", zone: "Stack", name: "Limestone gives off its CO₂", eq: "CaCO₃ → CaO + CO₂", dH: 178, T: "at about 800 °C (dolomite 50 to 100 °C lower)",
    band: [760, 900], regs: [5], gas: true, pos: { r: -0.34, T: 820 },
    plain: "Any raw flux charged with the burden breaks down to lime (CaO) and CO₂. The lime will become slag; the CO₂ joins the gas.",
    why: "It costs heat and adds CO₂ that the coke may later turn back into CO, which is why most flux now goes in through the sinter.", src: "ispat" },
  { id: "trz", Tshort: "900 to 1,000 °C", tag: "FeO + CO → Fe + CO₂", zone: "Thermal reserve zone", name: "Wüstite to iron, by gas", eq: "FeO + CO → Fe + CO₂", dH: -11, T: "about 900 to 1,000 °C",
    band: [880, 1000], regs: [5, 6], gas: true, pos: { r: 0.78, T: 950 },
    plain: "Here gas and burden are at nearly the same temperature for several metres. CO pulls the last oxygen out of wüstite and leaves metallic iron, still solid. This is indirect reduction, and it gives a little heat.",
    why: "The gas can only do this while it holds more than about 2.3 CO for every CO₂; the longer the lump stays here, the less coke the furnace needs.", src: "ispat" },
  { id: "boud", Tshort: "above 1,000 °C", tag: "CO₂ + C → 2CO", zone: "Lower stack", name: "Solution loss: coke turns CO₂ back to CO", eq: "CO₂ + C → 2CO", dH: 172, T: "considerable above about 1,000 °C",
    band: [1000, 1250], regs: [6, 5], gas: false, pos: { r: -0.86, T: 1080 },
    plain: "Hotter than about 1,000 °C, any CO₂ meets coke and is turned back into CO (the Boudouard reaction). Added to FeO + CO → Fe + CO₂ it comes to FeO + C → Fe + CO: direct reduction.",
    why: "It takes a lot of heat and burns coke that is not at the tuyeres. Iron reduced here costs more coke than iron reduced by gas higher up.", src: "ispat" },
  { id: "cz", Tshort: "1,200 to 1,400 °C", tag: "Ore softens and melts", zone: "Cohesive zone", name: "The ore softens and melts", eq: "iron + FeO + gangue + flux → liquid iron + first slag", dH: null, T: "about 1,200 to 1,400 °C",
    band: [1150, 1450], regs: [7], gas: false, pos: { r: -0.18, at: "cz" },
    plain: "The ore layers soften, stick together and melt; the first slag forms from what is left of the FeO, the gangue (silica, alumina) and the lime. Coke never melts, so its layers stay open as slits for the gas.",
    why: "The shape of this zone (an inverted V here) decides where the gas goes, and so how well the whole furnace works.", src: "text" },
  { id: "drip", Tshort: "1,400 to 1,600 °C", tag: "Iron takes up C and Si", zone: "Dripping zone", name: "Iron picks up carbon and silicon", eq: "Fe + C → Fe–C (about 4 to 4.5 % C) · SiO (gas) + C → Si + CO", dH: null, T: "about 1,400 to 1,600 °C",
    band: [1350, 1800], regs: [8], gas: false, pos: { r: 0.52, at: "drip" },
    plain: "Drops of iron and slag trickle down through the hot coke. The iron dissolves carbon, which lowers its melting point, and picks up silicon carried up as SiO gas from near the tuyeres. All the phosphorus ends up in the iron (P₂O₅ + 5C → 2P + 5CO).",
    why: "This is where pig iron gets its 4 % or so of carbon, the reason it must go to the steel shop to be refined.", src: "ispat" },
  { id: "race", Tshort: "about 2,000 °C", tag: "2C + O₂ → 2CO, about 2,000 °C", zone: "Raceway", name: "Hot blast burns coke", eq: "C + O₂ → CO₂, then CO₂ + C → 2CO", dH: -221, dHnote: "for 2C + O₂ → 2CO", T: "about 2,000 °C and more",
    band: [0, 0], regs: [9], gas: false, pos: { r: 0.9, at: "race" },
    plain: "Hot blast (898 °C on BF-3 in 2023-24, with 3.69 % extra oxygen, CAG) blows a hollow in the coke in front of each tuyere. Coke and injected coal dust burn there, first to CO₂ and at once back to CO, because there is so much coke round it. Moisture adds a little hydrogen (H₂O + C → CO + H₂).",
    why: "This is the furnace's fire and its gas maker in one: everything above runs on the heat and the CO made here.", src: "cag" },
  { id: "hearth", Tshort: "1,450 to 1,500 °C", tag: "Slag takes the sulphur", zone: "Hearth", name: "Slag takes the sulphur", eq: "[S] + (CaO) + C → (CaS) + CO", dH: null, T: "hot metal leaves at about 1,450 to 1,500 °C",
    band: [0, 0], regs: [11, 12], gas: false, pos: { r: -0.55, at: "hearth" },
    plain: "Iron (heavier) and slag (lighter) collect in the hearth and separate. Across the boundary, lime in the slag pulls sulphur out of the iron; the coke of the deadman stands in the pool.",
    why: "Hotter, more basic slag takes more sulphur; Indian slags are high in alumina, which limits how basic they can be.", src: "ispat" },
];

// the height (m above the taphole) at which the burden, at a share of the local radius, reaches T
export function heightAtT(L, rFrac, T) {
  const cz = cohesiveOf(L);
  let hi = L.yStock - DIP * 0.5, lo = cz.upper(Math.abs(rFrac) * L.rB);
  for (let i = 0; i < 40; i++) {
    const y = (hi + lo) / 2;
    const t = temperatureAt(L, Math.abs(rFrac) * radiusAt(L, y), y);
    if (t < T) hi = y; else lo = y;
  }
  return (hi + lo) / 2;
}

// The gas on its way up (shape typical): its temperature runs above the burden's, close to it
// through the thermal reserve zone, and far above it below the cohesive zone. Its make-up starts
// as the raceway leaves it: with BF-3's 3.69 % oxygen enrichment (CAG) a dry air blast burnt to CO
// gives about 39 % CO and 61 % N₂ (our arithmetic; coal and moisture add 2 to 3 % H₂, ispat). No
// CO₂ survives above about 1,000 °C (ispat). The gas takes oxygen in the thermal reserve zone up to
// near wüstite's limit (CO/CO₂ about 2.3, so about 30 % of the CO + CO₂ as CO₂) and more in the stack;
// at the top it is drawn inside ispatguru's ranges (CO + CO₂ 37 to 53 %, CO/CO₂ 1.25 to 2.5, H₂ 1 to 7 %).
export const GAS_TOP = { CO: 24, CO2: 18, H2: 3, N2: 55 }; // a typical top gas, not a Durgapur measurement
export const GAS_BOSH = { CO: 38, CO2: 0, H2: 3, N2: 59 };
export function gasAt(L, y, rFrac = 0.55) {
  const cz = cohesiveOf(L);
  const r = rFrac * radiusAt(L, Math.max(L.yT, y));
  const Ts = temperatureAt(L, r, Math.max(L.yT, y));
  const lo = cz.lower(r), hi = lo + cz.thick;
  let T;
  if (y <= L.yT + 0.2) T = 2000;
  else if (y < lo) T = 1800 + 200 * (1 - (y - L.yT) / Math.max(0.5, lo - L.yT));
  else if (y < hi) T = 1450 + 350 * (1 - (y - lo) / cz.thick);
  else {
    const s = (y - hi) / Math.max(0.1, L.yStock - hi);
    const gap = s < 0.14 ? 250 - 200 * (s / 0.14) : s < 0.62 ? 50 - 20 * ((s - 0.14) / 0.48) : 30 + 30 * ((s - 0.62) / 0.38);
    T = Ts + gap;
  }
  // share of CO + CO₂ that is CO₂ (the gas's "work done"), by the burden temperature it meets
  let eta;
  if (Ts >= 1000 || y < hi) eta = 0;
  else if (Ts >= 880) eta = 0.28 * (1000 - Ts) / 120;
  else eta = 0.28 + (0.43 - 0.28) * Math.min(1, (880 - Ts) / 680);
  const k = y < hi ? 0 : Math.min(1, (y - hi) / Math.max(0.1, L.yStock - hi));
  const cox = GAS_BOSH.CO + (GAS_TOP.CO + GAS_TOP.CO2 - GAS_BOSH.CO) * k; // CO + CO₂ grows a little as carbon joins the gas
  const N2 = GAS_BOSH.N2 + (GAS_TOP.N2 - GAS_BOSH.N2) * k;
  const H2 = 100 - cox - N2;
  return { T, Ts, eta, CO: cox * (1 - eta), CO2: cox * eta, N2, H2 };
}
// which reaction stop a moment of the lump's journey is at
export function stopOf(J) {
  if (J.phase === "hearth") return 9;
  if (J.phase === "dripping") return 7;
  if (J.zone === "Cohesive zone") return 6;
  if (J.zone === "Lower stack") return 5;
  if (J.zone === "Thermal reserve zone") return 4;
  if (J.T >= 760) return 3;
  if (J.T >= 600) return 2;
  if (J.T >= 380) return 1;
  return 0;
}
// the hours on the lump's clock that put it at a stop (the raceway has none: the lump is iron by then)
export function hoursOfStop(L, path, i) {
  const id = STOPS[i].id;
  if (id === "drip" || id === "race") return RESIDENCE + 0.12;
  if (id === "hearth") return RESIDENCE + 0.45;
  // the middle of the time the lump spends at that stop
  let first = -1, last = -1;
  for (let h = 0; h <= RESIDENCE; h += 0.01) {
    const J = journeyAt(L, path, h);
    if (stopOf(J) === i) { if (first < 0) first = h; last = h; } else if (first >= 0) break;
  }
  return first < 0 ? 0 : (first + last) / 2;
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
