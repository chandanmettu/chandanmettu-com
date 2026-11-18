// Small molecules and the reaction at Ser146.
// Colour meaning: carbon of fat (acyl chains, the oil and the biodiesel it becomes) is amber; carbon of the
// enzyme is pale teal-grey; glycerol carbon is pale cream; methanol and water are neutral. O red, N blue, H white.
// The reaction is drawn in the real active site of 1GT6/1DT3: the oleic acid that 1GT6 crystallised with sets
// where the acyl chain lies and which oxygen sits in the oxyanion hole; the rest (the glycerol, the diglyceride's
// other two chains, methanol) is placed with standard bond lengths (C-C 1.53, C-O 1.43, C=O 1.23 A).
import * as THREE from "three";

export const MC = { acyl: "#d99a2b", acylHot: "#ffc451", gly: "#efe1bf", meth: "#b9c2c9", O: "#e2553f", H: "#f4f4f4", Cenz: "#cfe3df" };
const sph = new THREE.SphereGeometry(1, 20, 14), cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
const UP = new THREE.Vector3(0, 1, 0);
const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function mat(col, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3, ...opts });
}

// a zigzag fatty acyl chain from p0 heading along dir, n carbons, in the plane spanned by dir and side
export function chain(p0, dir, side, n, bond = 1.53) {
  const out = [], d = dir.clone().normalize(), s = side.clone().addScaledVector(d, -side.dot(d)).normalize();
  const along = bond * Math.cos((180 - 112) / 2 * Math.PI / 180), off = bond * Math.sin((180 - 112) / 2 * Math.PI / 180) * 0.5;
  for (let i = 0; i < n; i++) out.push(p0.clone().addScaledVector(d, along * i).addScaledVector(s, (i % 2 ? off : -off)));
  return out;
}

// a triglyceride: glycerol backbone and three acyl chains of n carbons, roughly a tuning fork
export function triglyceride(origin, axis, n = 18, rot = 0) {
  const a = axis.clone().normalize();
  const t1 = new THREE.Vector3(1, 0, 0); if (Math.abs(t1.dot(a)) > 0.9) t1.set(0, 0, 1);
  const s = t1.clone().addScaledVector(a, -t1.dot(a)).normalize().applyAxisAngle(a, rot);
  const atoms = [], bonds = [];
  const add = (p, el, kind) => { atoms.push({ p, el, kind }); return atoms.length - 1; };
  const g = [-2.5, 0, 2.5].map((k) => add(origin.clone().addScaledVector(s, k * 0.62), "C", "gly"));
  bonds.push([g[0], g[1]], [g[1], g[2]]);
  const spread = [-1, 0, 1];
  g.forEach((gi, j) => {
    const o = add(atoms[gi].p.clone().addScaledVector(a, 1.2).addScaledVector(s, spread[j] * 0.4), "O", "est");
    bonds.push([gi, o]);
    const c1p = atoms[o].p.clone().addScaledVector(a, 1.1).addScaledVector(s, spread[j] * 0.5);
    const c1 = add(c1p, "C", "acyl"); bonds.push([o, c1]);
    const od = add(c1p.clone().addScaledVector(s, (j - 1 || 1) * 1.15).addScaledVector(a, 0.2), "O", "carb"); bonds.push([c1, od]);
    const dir = a.clone().addScaledVector(s, spread[j] * 0.22).normalize();
    const ch = chain(c1p.clone().addScaledVector(dir, 1.3), dir, s.clone().applyAxisAngle(a, 1.2), n - 1);
    let prev = c1;
    for (const p of ch) { const c = add(p, "C", "acyl"); bonds.push([prev, c]); prev = c; }
  });
  return { atoms, bonds };
}

// draw a static molecule into instanced meshes (many molecules at once)
export function instancedMolecules(mols, { scale = 1, acylColor = MC.acyl, opacity = 1 } = {}) {
  const group = new THREE.Group();
  const byKind = new Map();
  const colOf = (a) => (a.el === "O" ? MC.O : a.el === "H" ? MC.H : a.kind === "gly" ? MC.gly : a.kind === "meth" ? MC.meth : acylColor);
  const radOf = (a) => (a.el === "H" ? 0.22 : 0.42);
  let bondsN = 0;
  for (const m of mols) { for (const a of m.atoms) { const c = colOf(a); byKind.set(c, (byKind.get(c) || 0) + 1); } bondsN += m.bonds.length; }
  const meshes = new Map();
  for (const [c, n] of byKind) { const im = new THREE.InstancedMesh(sph, mat(c, { opacity, transparent: opacity < 1 }), n); im.count = 0; meshes.set(c, im); group.add(im); }
  const bm = new THREE.InstancedMesh(cyl, mat("#e6dccb", { opacity, transparent: opacity < 1 }), bondsN); bm.count = 0; group.add(bm);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  for (const m of mols) {
    for (const a of m.atoms) { const im = meshes.get(colOf(a)); M4.compose(a.p, Q.identity(), Sc.setScalar(radOf(a) * scale)); im.setMatrixAt(im.count++, M4); }
    for (const [i, j] of m.bonds) {
      const A = m.atoms[i].p, B = m.atoms[j].p; V.copy(B).sub(A); const L = V.length();
      Q.setFromUnitVectors(UP, V.clone().normalize());
      M4.compose(A.clone().addScaledVector(V, 0.5), Q, Sc.set(0.15 * scale, L, 0.15 * scale)); bm.setMatrixAt(bm.count++, M4);
    }
  }
  for (const im of [...meshes.values(), bm]) im.instanceMatrix.needsUpdate = true;
  group.userData.materials = [...[...meshes.values()].map((m) => m.material), bm.material];
  return group;
}

// ------------------------------------------------------------------ the reaction in the active site
export const STEPS = [
  { t: "Substrate docks", s: "A triglyceride from the oil slides into the open site. Its ester carbonyl lines up on Ser146; the C=O oxygen points into the oxyanion hole." },
  { t: "Ser146 attacks", s: "His258 pulls the proton off Ser146 (Asp201 holds the histidine in place), and the serine oxygen attacks the carbonyl carbon." },
  { t: "Tetrahedral intermediate 1", s: "The carbon now has four bonds. The carbonyl oxygen carries a negative charge, held by two backbone N–H groups (Ser83, Leu147): the oxyanion hole." },
  { t: "Acyl-enzyme; diglyceride leaves", s: "The intermediate collapses. His258 hands its proton to the glycerol oxygen, which leaves as a diglyceride. The fatty acid stays bound to Ser146." },
  { t: "Methanol enters", s: "Methanol (or water) takes the leaving group's place. This is the second substrate of a ping-pong bi-bi mechanism." },
  { t: "Tetrahedral intermediate 2", s: "His258 takes methanol's proton and the methoxide attacks the acyl carbon. The oxyanion hole stabilises the charge again." },
  { t: "Biodiesel released", s: "The intermediate collapses, the bond to Ser146 breaks and the proton returns to the serine. A fatty acid methyl ester (biodiesel) leaves." },
  { t: "Ready again", s: "The enzyme is back where it started. The diglyceride returns for its next chain: TG → DG → MG → glycerol, three methyl esters per fat molecule." },
];

// each step animates s between these values; DUR is its length in seconds at 1x
export const STEP_RANGE = [[0, 1], [1, 2], [2, 2.15], [2.15, 3.3], [3.3, 4.1], [4.1, 5], [5, 6.4], [6.4, 7]];
export const STEP_DUR = [2.8, 2.6, 2.0, 3.0, 2.4, 2.6, 3.0, 2.2];
export const STEP_SHORT = ["Dock", "Attack", "TI 1", "Acyl-enzyme", "Methanol in", "TI 2", "Ester out", "Reset"];

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW = glowTexture();
export function glowSprite(col, size, k = 1, order = 6) {
  const m = new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color(col).multiplyScalar(k), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = order; return s;
}

// Everything here is opaque. Atoms appear and leave by growing and shrinking; bonds break by thinning and form by
// growing from one atom to the other; so nothing is ever re-sorted against the glass ribbon while it moves.
export function createReaction(protein) {
  const P = (seq, n) => protein.pos(seq, n, new THREE.Vector3());
  const OG = P(146, "OG"), NE2 = P(258, "NE2"), CB = P(146, "CB");
  const NL = P(147, "N"), NS = P(83, "N");
  const L = protein.ligXYZ, names = protein.lig.atoms.map((a) => a[0]);
  const lp = (n) => { const i = names.indexOf(n); return new THREE.Vector3(L[3 * i], L[3 * i + 1], L[3 * i + 2]); };
  const C1 = lp("C1");
  const [Oa, Ob] = [lp("O1"), lp("O2")];
  const Oox0 = Oa.distanceTo(NL) + Oa.distanceTo(NS) < Ob.distanceTo(NL) + Ob.distanceTo(NS) ? Oa : Ob;
  const chainL = []; for (let k = 2; k <= 18; k++) chainL.push(lp("C" + k));
  const u = C1.clone().sub(OG).normalize();
  const Cae = OG.clone().addScaledVector(u, 1.42);
  const shiftAE = Cae.clone().sub(C1);
  const oxDir = Oox0.clone().sub(C1).normalize();
  const c2Dir = chainL[0].clone().sub(C1).normalize();
  const nuc = u.clone().negate().add(oxDir).add(c2Dir).negate().normalize();
  const out = protein.face.clone();
  const keys = {};
  const acylAt = (shift) => ({ C: C1.clone().add(shift), O: Oox0.clone().add(shift), chain: chainL.map((p) => p.clone().add(shift)) });
  keys.far = acylAt(shiftAE.clone().addScaledVector(out, 9).addScaledVector(u, 1.6));
  keys.mich = acylAt(shiftAE.clone().addScaledVector(u, 1.55));
  keys.ti = acylAt(shiftAE.clone().addScaledVector(u, 0.06));
  keys.ae = acylAt(shiftAE);
  keys.gone = acylAt(shiftAE.clone().addScaledVector(out, 8).addScaledVector(u, 2.2));
  const OgAt = (k, d = 1.36) => k.C.clone().addScaledVector(nuc, d);
  const Hser = OG.clone().addScaledVector(NE2.clone().sub(OG).normalize(), 0.98);
  const Hhis = NE2.clone().addScaledVector(OG.clone().sub(NE2).normalize(), 1.02);

  const group = new THREE.Group();
  group.name = "reaction";
  const atoms = {}, bonds = [];
  const atom = (id, col, r) => { const m = new THREE.Mesh(sph, mat(col, { transparent: false })); m.userData.r = r; m.scale.setScalar(r); group.add(m); atoms[id] = m; return m; };
  // kind: "keep" (always), "form" (grows from a to b as it appears), "break" (thins away)
  const bond = (a, b, vis, r = 0.15, kind = "keep") => { const m = new THREE.Mesh(cyl, mat("#e6dccb", { transparent: false })); group.add(m); bonds.push({ m, a, b, vis, r, kind, last: 1 }); };
  atom("C", MC.acyl, 0.42); atom("Ox", MC.O, 0.42); atom("Og", MC.O, 0.42); atom("Cg", MC.gly, 0.42); atom("H", MC.H, 0.24);
  atom("Om", MC.O, 0.42); atom("Cm", MC.meth, 0.42); atom("Hm", MC.H, 0.24); atom("Hw", MC.H, 0.24);
  chainL.forEach((_, i) => atom("c" + i, MC.acyl, 0.42));
  const dgChains = [];
  for (let j = 0; j < 2; j++) { const arr = []; for (let i = 0; i < 12; i++) arr.push(atom(`d${j}_${i}`, MC.acyl, 0.4)); dgChains.push(arr); }
  dgChains.forEach((arr, j) => arr.slice(1).forEach((_, i) => bond(`d${j}_${i}`, `d${j}_${i + 1}`, () => 1)));
  bond("Cg", "d0_0", () => 1); bond("Cg", "d1_0", () => 1);
  // the oxyanion's charge: a soft red glow that pulses while the carbon is tetrahedral
  const glow = glowSprite("#ff6a4a", 3.2, 1.25);
  group.add(glow);
  // the travelling proton gets a cyan halo while it hops
  const halo = glowSprite("#8fd6ff", 1.6, 1.1, 7), haloM = glowSprite("#8fd6ff", 1.6, 1.1, 8);
  group.add(halo, haloM);
  const ogMark = OG.clone();

  const win = (a, b, s, f = 0.25) => sm((s - a) / f) * (1 - sm((s - b) / f));
  bond("C", "Ox", () => 1, 0.17);
  bond("C", "c0", () => 1);
  chainL.slice(1).forEach((_, i) => bond("c" + i, "c" + (i + 1), () => 1));
  bond("C", "Og", (s) => 1 - sm((s - 2.3) / 0.4), 0.15, "break");
  bond("Og", "Cg", () => 1);
  bond("SER", "C", (s) => win(1.4, 5.5, s, 0.4), 0.15, "form");
  bond("Om", "Cm", () => 1);
  bond("Om", "Hw", () => 1, 0.1);
  bond("Om", "C", (s) => sm((s - 4.4) / 0.5), 0.15, "form");
  bond("Om", "Hm", (s) => 1 - sm((s - 4.3) / 0.4), 0.1, "break");
  bond("Og", "H", (s) => sm((s - 2.5) / 0.4), 0.1, "form");
  bond("SER", "Hser", (s) => 1 - sm((s - 1.2) / 0.4), 0.1, "break");
  bond("Hhm", "SER", (s) => sm((s - 5.6) / 0.4), 0.1, "form");

  // hydrogen bonds into the oxyanion hole: dotted, opaque
  const dots = [];
  const HL = protein.hOf(147), HS = protein.hOf(83);
  const dotMat = new THREE.MeshBasicMaterial({ color: "#9fd8ff" });
  for (const to of ["HL", "HS"]) for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(sph, dotMat); group.add(m); dots.push({ m, to, i }); }
  const hbVis = (s) => Math.min(1, win(1.5, 2.5, s) + win(4.5, 5.5, s));

  const tmp = new THREE.Vector3();
  const lerpK = (k0, k1, t, key) => (key === "chain" ? k0.chain.map((p, i) => p.clone().lerp(k1.chain[i], t)) : k0[key].clone().lerp(k1[key], t));
  const acylPath = (s) => {
    if (s < 1) return [keys.far, keys.mich, sm(s)];
    if (s < 2) return [keys.mich, keys.ti, sm(s - 1)];
    if (s < 5.4) return [keys.ae, keys.ae, 0];
    return [keys.ae, keys.gone, sm((s - 5.4) / 1.1)];
  };
  const pos = {};
  const state = { s: 0, mode: "methanol", t: 0 };
  const extra = () => ({ SER: OG, HL, HS, Hser: atoms.H.position, Hhm: atoms.Hm.position });
  const show = (k, p) => { const m = atoms[k]; const v = Math.max(0, Math.min(1, p)); m.scale.setScalar(m.userData.r * v); m.visible = v > 0.02; m.userData.p = v; };
  function set(s, time = state.t) {
    state.s = s; state.t = time;
    const water = state.mode === "water";
    const [k0, k1, t] = acylPath(s);
    pos.C = lerpK(k0, k1, t, "C"); pos.Ox = lerpK(k0, k1, t, "O");
    const ch = lerpK(k0, k1, t, "chain");
    const leave = sm((s - 2.3) / 1.0);
    const ogBase = OgAt({ C: s < 2 ? pos.C : keys.ti.C });
    pos.Og = ogBase.clone().addScaledVector(out, 12 * leave).addScaledVector(nuc, 2 * leave);
    pos.Cg = pos.Og.clone().addScaledVector(nuc, 1.43).addScaledVector(out, 0.3);
    dgChains.forEach((arr, j) => {
      const side = new THREE.Vector3().crossVectors(out, nuc).normalize().multiplyScalar(j ? 1 : -1);
      const base = pos.Cg.clone().addScaledVector(side, 1.4).addScaledVector(out, 1.2);
      chain(base, out.clone().addScaledVector(side, 0.25), nuc, arr.length).forEach((p, i) => arr[i].position.copy(p));
    });
    // Ser's proton: Ser Og -> His Ne2 (attack) -> the leaving glycerol oxygen (collapse)
    const H = new THREE.Vector3();
    let hop = 0;
    if (s < 1.2) H.copy(Hser);
    else if (s < 2.4) { const k = sm((s - 1.2) / 0.6); H.copy(Hser).lerp(Hhis, k); hop = k * (1 - k) * 4; }
    else if (s < 3.0) { const k = sm((s - 2.4) / 0.5); H.copy(Hhis).lerp(pos.Og.clone().addScaledVector(nuc, 0.97), k); hop = k * (1 - k) * 4; }
    else H.copy(pos.Og).addScaledVector(nuc, 0.97);
    pos.H = H;
    // methanol (or water) arrives; its proton goes to His258, then back to Ser146 as the ester leaves
    const mIn = sm((s - 3.3) / 0.7);
    const site = OgAt(keys.ae, 2.9);
    const far = site.clone().addScaledVector(out, 12);
    const bondT = sm((s - 4.4) / 0.6);
    const Om = far.clone().lerp(site, mIn).lerp(OgAt(keys.ae, 1.42), bondT);
    const prodShift = s >= 5.4 ? pos.C.clone().sub(keys.ae.C) : new THREE.Vector3();
    pos.Om = Om.clone().add(prodShift);
    pos.Cm = pos.Om.clone().addScaledVector(nuc, 1.42).addScaledVector(out, 0.35);
    pos.Hw = pos.Om.clone().addScaledVector(nuc, 0.97).addScaledVector(out, -0.3);
    const Hm0 = Om.clone().addScaledVector(NE2.clone().sub(Om).normalize(), 0.97);
    let hopM = 0;
    let Hm;
    if (s < 4.2) Hm = Hm0;
    else if (s < 5.4) { const k = sm((s - 4.2) / 0.6); Hm = Hm0.clone().lerp(Hhis, k); hopM = k * (1 - k) * 4; }
    else { const k = sm((s - 5.5) / 0.5); Hm = Hhis.clone().lerp(Hser, k); hopM = k * (1 - k) * 4; }
    pos.Hm = Hm;
    for (const k of ["C", "Ox", "Og", "Cg", "H", "Om", "Cm", "Hm", "Hw"]) atoms[k].position.copy(pos[k]);
    ch.forEach((p, i) => atoms["c" + i].position.copy(p));
    // presence: the diglyceride leaves, the alcohol arrives, the ester leaves
    const dgP = 1 - sm((s - 2.9) / 0.5);
    const inP = sm((s - 3.3) / 0.35);
    const prodP = 1 - sm((s - 6.45) / 0.45);
    ["Og", "Cg"].forEach((k) => show(k, dgP));
    dgChains.flat().forEach((m) => { const v = dgP; m.scale.setScalar(m.userData.r * v); m.visible = v > 0.02; m.userData.p = v; });
    show("H", s < 2.9 ? 1 : dgP);
    show("Om", inP * prodP); show("Cm", water ? 0 : inP * prodP); show("Hw", water ? inP * prodP : 0); show("Hm", inP);
    ["C", "Ox", ...chainL.map((_, i) => "c" + i)].forEach((k) => show(k, prodP));
    // the product glows gold as it is released
    const hot = sm((s - 5.5) / 0.5) * prodP;
    const ca = new THREE.Color(MC.acyl), chot = new THREE.Color(MC.acylHot);
    for (const k of ["C", ...chainL.map((_, i) => "c" + i)]) { const m = atoms[k].material; m.color.copy(ca).lerp(chot, hot); m.emissive.set("#ffb030").multiplyScalar(0.5 * hot); }
    // the oxyanion's charge pulses at each tetrahedral intermediate
    const ti = win(1.5, 2.5, s) + win(4.5, 5.5, s);
    glow.position.copy(pos.Ox);
    glow.material.opacity = Math.min(1, ti) * (0.55 + 0.3 * Math.sin(time * 6.5));
    halo.position.copy(pos.H); halo.material.opacity = Math.min(1, hop) * 0.9;
    haloM.position.copy(pos.Hm); haloM.material.opacity = Math.min(1, hopM) * 0.9;
    const ex = extra();
    for (const b of bonds) {
      const A = atoms[b.a]?.position || ex[b.a], B = atoms[b.b]?.position || ex[b.b];
      let v = Math.max(0, Math.min(1, b.vis(s)));
      v *= Math.min(atoms[b.a]?.userData.p ?? 1, atoms[b.b]?.userData.p ?? 1);
      if (atoms[b.a] && !atoms[b.a].visible) v = 0; if (atoms[b.b] && !atoms[b.b].visible) v = 0;
      b.m.visible = v > 0.02;
      if (!b.m.visible) continue;
      tmp.copy(B).sub(A); const Lb = tmp.length();
      // forming bonds grow from a to b; breaking bonds thin
      const grow = b.kind === "form" ? sm(v) : 1;
      const rad = b.r * (b.kind === "break" ? 0.15 + 0.85 * v : Math.min(1, 0.35 + 0.65 * v));
      b.m.position.copy(A).addScaledVector(tmp, 0.5 * grow);
      b.m.scale.set(rad, Lb * grow, rad);
      b.m.quaternion.setFromUnitVectors(UP, tmp.normalize());
    }
    const hv = hbVis(s);
    for (const d of dots) {
      const A = atoms.Ox.position, B = ex[d.to];
      const p = A.clone().lerp(B, (d.i + 0.5) / 6);
      d.m.position.copy(p); d.m.scale.setScalar(0.075 * hv); d.m.visible = hv > 0.02 && atoms.Ox.visible;
    }
  }
  set(0, 0);
  const distances = () => ({
    serHis: OG.distanceTo(NE2),
    oxyL: keys.ae.O.distanceTo(protein.pos(147, "N", new THREE.Vector3())),
    oxyS: keys.ae.O.distanceTo(protein.pos(83, "N", new THREE.Vector3())),
  });
  return { group, set, state, anchors: { OG: ogMark, NE2, C: () => atoms.C.position, Ox: () => atoms.Ox.position, Om: () => atoms.Om.position, Og: () => atoms.Og.position, prod: () => atoms.c8.position, H: () => atoms.H.position, Hm: () => atoms.Hm.position }, distances, CB, keys, out };
}
