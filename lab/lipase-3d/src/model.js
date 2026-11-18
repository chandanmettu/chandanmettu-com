// The conditions model: pure, no DOM, no three.js. Every curve is a published dataset (research/04-factors.md,
// 19 Nov 2026), interpolated linearly between the reported points. "approx" values were read off the paper's
// figure (about ±2 to 3 points); "exact" values are from its text or tables.
// pH, temperature and metal ions all come from ONE lipase, the same one the deck plots: SCNL, the Staphylococcus
// caprae NCU S6 lipase of Zhao et al. 2021. Mixing comes from Ben Bacha et al. 2022 (biodiesel from used cooking
// oil), methanol from Shimada et al. 1999 (Novozym 435). The combined activity multiplies the pH, temperature and
// ion factors as if they were independent: an illustration, said so on the page. None of these is TLL's own curve.

export const SOURCES = {
  Zhao2021: { cite: "Zhao J, Ma M, Zeng Z, Yu P, Gong D, Deng S (2021). Production, purification and biochemical characterisation of a novel lipase from a newly identified lipolytic bacterium Staphylococcus caprae NCU S6. J Enzyme Inhib Med Chem 36(1):249-257.", doi: "10.1080/14756366.2020.1861607" },
  BenBacha2022: { cite: "Ben Bacha A, Alonazi M, Alharbi MG, Horchani H, Ben Abdelmalek I (2022). Biodiesel production by single and mixed immobilized lipases using waste cooking oil. Molecules 27(24):8736.", doi: "10.3390/molecules27248736" },
  Shimada1999: { cite: "Shimada Y, Watanabe Y, Samukawa T, Sugihara A, Noda H, Fukuda H, Tominaga Y (1999). Conversion of vegetable oil to biodiesel using immobilized Candida antarctica lipase. JAOCS 76(7):789-793.", doi: "10.1007/s11746-999-0067-6" },
  Pace2009: { cite: "Pace CN, Grimsley GR, Scholtz JM (2009). Protein ionizable groups: pK values and their contribution to protein stability and solubility. J Biol Chem 284(20):13285-13289.", doi: "10.1074/jbc.R800080200" },
  Brzozowski2000: { cite: "Brzozowski AM, Savage H, Verma CS, Turkenburg JP, Lawson DM, Svendsen A, Patkar S (2000). Structural origins of the interfacial activation in Thermomyces (Humicola) lanuginosa lipase. Biochemistry 39:15071. PDB 1DT3.", doi: "10.1021/bi0013905" },
  Yapoudjian2002: { cite: "Yapoudjian S, Ivanova MG, Brzozowski AM, Patkar SA, Vind J, Svendsen A, Verger R (2002). Binding of Thermomyces (Humicola) lanuginosa lipase to the mixed micelles of cis-parinaric acid/NaTDC. Eur J Biochem 269:1613. PDB 1GT6.", doi: "10.1046/j.1432-1327.2002.02786.x" },
};

const SCNL = "SCNL, Staphylococcus caprae NCU S6 lipase";
export const PH = { who: SCNL, src: "Zhao2021", note: "activity at each pH; read off Fig 5C (approx)", opt: 9.0,
  x: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y: [16, 26, 37, 60, 80, 95, 100, 78, 64, 52] };
export const TEMP = { who: SCNL, src: "Zhao2021", note: "100 % at 40 °C; read off Fig 5A (approx)", opt: 40,
  x: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], y: [44, 55, 64, 76, 81, 89, 100, 82, 74, 40, 17] };
// 10 mM, 30 min pre-incubation, p-NPP assay; Table 3 (exact, mean of 3). Colours are for the ions in 3D only.
export const IONS = { who: SCNL, src: "Zhao2021", note: "10 mM, 30 min pre-incubation, p-NPP assay; Table 3 (exact, mean of three)",
  list: [
    { id: "none", sym: "—", name: "No added ion", v: 100.0, col: null },
    { id: "Ca", sym: "Ca²⁺", name: "Calcium", v: 166.4, col: "#eef3f6" },
    { id: "Na", sym: "Na⁺", name: "Sodium", v: 120.8, col: "#cbb8ff" },
    { id: "Mg", sym: "Mg²⁺", name: "Magnesium", v: 83.6, col: "#bfe6a8" },
    { id: "Co", sym: "Co²⁺", name: "Cobalt", v: 72.3, col: "#e58ab8" },
    { id: "Zn", sym: "Zn²⁺", name: "Zinc", v: 53.9, col: "#a7bccf" },
    { id: "Al", sym: "Al³⁺", name: "Aluminium", v: 47.3, col: "#d5d9dd" },
    { id: "EDTA", sym: "EDTA", name: "EDTA (strips metal ions)", v: 32.9, col: null },
    { id: "Fe2", sym: "Fe²⁺", name: "Iron(II)", v: 25.6, col: "#9fc48a" },
    { id: "Cu", sym: "Cu²⁺", name: "Copper", v: 24.3, col: "#5b8ff0" },
    { id: "Fe3", sym: "Fe³⁺", name: "Iron(III)", v: 22.9, col: "#c8642c" },
  ] };
export const STIR = { who: "CaCO₃-immobilised B. stearothermophilus + S. aureus lipases, used cooking oil", src: "BenBacha2022", note: "6:1 methanol:oil, 55 °C, 24 h; read off Fig 5 (approx; 200 rpm exact 97.66 %)",
  x: [100, 150, 200, 250, 300], y: [79, 98, 97.7, 94, 85], opt: 200 };
export const METHANOL = { who: "Novozym 435 (immobilised Candida antarctica lipase B)", src: "Shimada1999",
  limit: 1.5, stepwise: { steps: 3, each: 1, hours: 48, conversion: 98.4, cycles: 50, keep: 95 } };
export const HIS_PKA = 6.6; // histidine side chains titrate around pH 6.6 (Pace et al. 2009)

export function interp(c, x) {
  const xs = c.x, ys = c.y;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) { const t = (x - xs[i]) / (xs[i + 1] - xs[i]); return ys[i] + t * (ys[i + 1] - ys[i]); }
  return ys[ys.length - 1];
}

export const DEFAULTS = { pH: 9.0, T: 40, ion: "none", rpm: 200, meoh: 1, stepwise: false };
export const PRESETS = [
  { id: "best", name: "Best case", set: { pH: 9.0, T: 40, ion: "Ca", rpm: 200, meoh: 1, stepwise: true } },
  { id: "acid", name: "Acidic", set: { pH: 4.0, T: 40, ion: "none", rpm: 200, meoh: 1, stepwise: false } },
  { id: "hot", name: "Too hot", set: { pH: 9.0, T: 60, ion: "none", rpm: 200, meoh: 1, stepwise: false } },
  { id: "meoh", name: "Methanol shock", set: { pH: 9.0, T: 40, ion: "none", rpm: 200, meoh: 2.5, stepwise: false } },
  { id: "metal", name: "Heavy metal", set: { pH: 9.0, T: 40, ion: "Cu", rpm: 200, meoh: 1, stepwise: false } },
];

export function readings(s) {
  const fpH = interp(PH, s.pH), fT = interp(TEMP, s.T);
  const ion = IONS.list.find((i) => i.id === s.ion) || IONS.list[0];
  const combined = (fpH / 100) * (fT / 100) * (ion.v / 100) * 100;
  const yieldStir = interp(STIR, s.rpm);
  const inactivated = !s.stepwise && s.meoh > METHANOL.limit;
  const hisH = 1 / (1 + Math.pow(10, s.pH - HIS_PKA)); // fraction of His protonated (Henderson-Hasselbalch)
  return {
    pH: s.pH, T: s.T, rpm: s.rpm, meoh: s.meoh, stepwise: s.stepwise,
    fpH, fT, fIon: ion.v, ion, combined, yieldStir, inactivated, hisH,
    // what the model shows on the enzyme (visual cues, said so on the page)
    jitter: 0.02 + Math.max(0, s.T - 10) * 0.0035,
    loose: Math.max(0, (s.T - TEMP.opt) / 20) * 0.9,
    grey: inactivated ? 0.9 : 0,
    // biodiesel molecules leaving per second at the interface (illustrative scale: 3 per s at 100 %, best mixing)
    rate: inactivated ? 0 : 3 * (combined / 100) * (yieldStir / 97.7),
  };
}
