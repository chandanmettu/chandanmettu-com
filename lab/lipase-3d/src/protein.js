// The lipase itself, built from the crystal coordinates in data/tll.json (made by tools/pdb_to_json.py from
// PDB 1DT3, lid closed, and 1GT6, lid open, superposed by the core). Nothing here is drawn by hand: the
// ribbon follows the C-alpha trace, the ribbon's face follows each peptide's C=O, helices and strands come from
// the files' HELIX and SHEET records, the surface is a Gaussian density of every heavy atom.
// The lid morph interpolates every atom between the two crystal states (a morph, not a simulation).
import * as THREE from "three";

export const COL = {
  helix: "#2fb2a3", sheet: "#86dbca", coil: "#bfd6d2", lid: "#f6e7c4",
  C: "#cfe3df", O: "#e2553f", N: "#3f7fe0", H: "#f4f4f4", S: "#e6c13a",
  hydro: "#e0a33a", polar: "#2a9a8c", pos: "#24857f", neg: "#2f8f85",
};
export const LID = [82, 96];
export const TRIAD = { ser: 146, his: 258, asp: 201 };
export const OXY = [83, 147];

const smooth = (t) => t * t * (3 - 2 * t);

export function createProtein(data) {
  const res = data.res, atoms = data.atoms, N = atoms.length, R = res.length;
  const closed = Float32Array.from(data.closed), open = Float32Array.from(data.open);
  const cur = Float32Array.from(closed);
  const seqIndex = new Map(res.map((r, i) => [r[0], i]));
  const resAtoms = res.map(() => ({}));
  atoms.forEach((a, i) => { resAtoms[a[0]][a[1]] = i; });
  const moving = [];
  for (let i = 0; i < N; i++) {
    const dx = open[3 * i] - closed[3 * i], dy = open[3 * i + 1] - closed[3 * i + 1], dz = open[3 * i + 2] - closed[3 * i + 2];
    if (dx * dx + dy * dy + dz * dz > 1e-4) moving.push(i);
  }
  const lidAtoms = [];
  atoms.forEach((a, i) => { const s = res[a[0]][0]; if (s >= LID[0] - 2 && s <= LID[1] + 2) lidAtoms.push(i); });

  const group = new THREE.Group();
  group.name = "lipase";
  const P = (i, out = new THREE.Vector3()) => out.set(cur[3 * i], cur[3 * i + 1], cur[3 * i + 2]);
  const atomOf = (seq, name) => { const r = seqIndex.get(seq); return r === undefined ? undefined : resAtoms[r][name]; };
  const pos = (seq, name, out = new THREE.Vector3()) => P(atomOf(seq, name), out);

  // ------------------------------------------------------------------ cartoon
  const S = 7, K = 12;
  const M = (R - 1) * S + 1;
  const ss = res.map((r) => r[2]);
  const isLid = res.map((r) => r[0] >= LID[0] && r[0] <= LID[1]);
  const last = ss.map((s, i) => s === "E" && ss[i + 1] !== "E");
  const geo = new THREE.BufferGeometry();
  const vpos = new Float32Array(M * K * 3), vcol = new Float32Array(M * K * 3);
  const idx = [];
  for (let m = 0; m < M - 1; m++) for (let k = 0; k < K; k++) {
    const a = m * K + k, b = m * K + ((k + 1) % K), c = (m + 1) * K + k, d = (m + 1) * K + ((k + 1) % K);
    idx.push(a, c, b, b, c, d);
  }
  // end caps
  const capA = M * K, capB = M * K + 1;
  const vposFull = new Float32Array((M * K + 2) * 3), vcolFull = new Float32Array((M * K + 2) * 3);
  for (let k = 0; k < K; k++) { idx.push(capA, k, (k + 1) % K); const o = (M - 1) * K; idx.push(capB, o + ((k + 1) % K), o + k); }
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.BufferAttribute(vposFull, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(vcolFull, 3));
  const resOfSample = new Int32Array(M);
  const prof = new Float32Array(M * 2);
  {
    const p = (i) => (ss[i] === "H" ? [1.25, 0.26] : ss[i] === "E" ? [1.05, 0.26] : [0.3, 0.3]);
    for (let m = 0; m < M; m++) {
      const i = Math.min(R - 1, Math.floor(m / S)), u = (m - i * S) / S;
      resOfSample[m] = u < 0.5 ? i : Math.min(R - 1, i + 1);
      let [w, h] = p(i);
      if (i < R - 1) {
        const [w2, h2] = p(i + 1);
        if (last[i]) { w = 1.75 * (1 - u) + 0.3 * u; h = 0.26 * (1 - u) + 0.3 * u; }
        else { const t = smooth(Math.min(1, Math.max(0, (u - 0.3) / 0.4))); w = w + (w2 - w) * t; h = h + (h2 - h) * t; }
      }
      prof[2 * m] = w; prof[2 * m + 1] = h;
    }
    const cc = {}; for (const k of ["helix", "sheet", "coil", "lid"]) cc[k] = new THREE.Color(COL[k]);
    const col = new THREE.Color();
    for (let m = 0; m < M; m++) {
      const i = resOfSample[m];
      col.copy(isLid[i] ? cc.lid : ss[i] === "H" ? cc.helix : ss[i] === "E" ? cc.sheet : cc.coil);
      for (let k = 0; k < K; k++) vcolFull.set([col.r, col.g, col.b], 3 * (m * K + k));
    }
    vcolFull.set([cc.coil.r, cc.coil.g, cc.coil.b], 3 * capA);
    vcolFull.set([cc.coil.r, cc.coil.g, cc.coil.b], 3 * capB);
  }
  const G = Array.from({ length: R }, () => new THREE.Vector3());
  const SD = Array.from({ length: R }, () => new THREE.Vector3());
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), bn: new THREE.Vector3() };
  const samples = Array.from({ length: M }, () => ({ p: new THREE.Vector3(), s: new THREE.Vector3() }));
  const cr = (p0, p1, p2, p3, u, out) => {
    const u2 = u * u, u3 = u2 * u;
    return out.set(
      0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
      0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
      0.5 * (2 * p1.z + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3));
  };
  function buildCartoon() {
    for (let i = 0; i < R; i++) {
      P(resAtoms[i].CA, G[i]);
      if (ss[i] === "E" && i > 0 && i < R - 1 && ss[i - 1] === "E" && ss[i + 1] === "E") {
        P(resAtoms[i - 1].CA, tmp.a); P(resAtoms[i + 1].CA, tmp.b);
        G[i].multiplyScalar(2).add(tmp.a).add(tmp.b).multiplyScalar(0.25);
      }
    }
    for (let i = 0; i < R; i++) {
      const tg = tmp.t.copy(G[Math.min(R - 1, i + 1)]).sub(G[Math.max(0, i - 1)]).normalize();
      P(resAtoms[i].O, tmp.a).sub(P(resAtoms[i].C, tmp.b));
      tmp.a.addScaledVector(tg, -tmp.a.dot(tg)).normalize();
      if (i > 0 && tmp.a.dot(SD[i - 1]) < 0) tmp.a.negate();
      SD[i].copy(tmp.a);
    }
    for (let m = 0; m < M; m++) {
      const i = Math.min(R - 2, Math.floor(m / S)), u = m === M - 1 ? 1 : (m - i * S) / S;
      cr(G[Math.max(0, i - 1)], G[i], G[i + 1], G[Math.min(R - 1, i + 2)], u, samples[m].p);
      samples[m].s.copy(SD[i]).lerp(SD[i + 1], u).normalize();
    }
    for (let m = 0; m < M; m++) {
      const pm = samples[Math.max(0, m - 1)].p, pn = samples[Math.min(M - 1, m + 1)].p;
      const t = tmp.t.copy(pn).sub(pm).normalize();
      const sd = tmp.n.copy(samples[m].s).addScaledVector(t, -samples[m].s.dot(t)).normalize();
      const bn = tmp.bn.copy(t).cross(sd).normalize();
      const w = prof[2 * m], h = prof[2 * m + 1], flat = w > h * 1.6;
      for (let k = 0; k < K; k++) {
        const th = (k / K) * Math.PI * 2;
        let cx = Math.cos(th), cy = Math.sin(th);
        if (flat) { cx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.45); cy = Math.sign(cy) * Math.pow(Math.abs(cy), 0.45); }
        const o = 3 * (m * K + k), p = samples[m].p;
        vposFull[o] = p.x + sd.x * w * cx + bn.x * h * cy;
        vposFull[o + 1] = p.y + sd.y * w * cx + bn.y * h * cy;
        vposFull[o + 2] = p.z + sd.z * w * cx + bn.z * h * cy;
      }
    }
    vposFull.set([samples[0].p.x, samples[0].p.y, samples[0].p.z], 3 * capA);
    vposFull.set([samples[M - 1].p.x, samples[M - 1].p.y, samples[M - 1].p.z], 3 * capB);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  // Draw order (no per-frame sorting decides what is in front):
  //   0 opaque ribbon, sticks and reaction atoms; 2 glass depth prepass (writes depth only);
  //   3 glass colour pass (only the nearest ribbon layer survives the depth test, so nothing shimmers).
  const grey = { value: 0 }, tint = { value: new THREE.Color(1, 1, 1) }, tintAmt = { value: 0 };
  const nearFade = { value: new THREE.Vector2(0, 0) };   // glass only: ribbons closer to the eye than x fade out by y
  const patch = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uGrey = grey; sh.uniforms.uTint = tint; sh.uniforms.uTintAmt = tintAmt;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uGrey; uniform vec3 uTint; uniform float uTintAmt;")
        .replace("#include <color_fragment>", "#include <color_fragment>\nfloat gl = dot(diffuseColor.rgb, vec3(0.3,0.59,0.11));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(gl)*0.72, uGrey);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*uTint*1.2, uTintAmt);");
    };
    m.customProgramCacheKey = () => "lipase-ribbon";
    return m;
  };
  const ribbonMat = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35 }));
  const glassMat = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: true, opacity: 0.3, depthWrite: false, depthFunc: THREE.LessEqualDepth }));
  {
    const base = glassMat.onBeforeCompile;
    glassMat.onBeforeCompile = (sh) => {
      base(sh);
      sh.uniforms.uNear = nearFade;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec2 uNear;")
        .replace("#include <opaque_fragment>", "diffuseColor.a *= (uNear.y > 0.0) ? smoothstep(uNear.x - uNear.y, uNear.x, length(vViewPosition)) * 0.85 + 0.15 : 1.0;\n#include <opaque_fragment>");
    };
    glassMat.customProgramCacheKey = () => "lipase-glass";
  }
  const ribbon = new THREE.Mesh(geo, ribbonMat);
  ribbon.name = "ribbon";
  const glassDepth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false }));
  glassDepth.renderOrder = 2; glassDepth.visible = false;
  const glass = new THREE.Mesh(geo, glassMat);
  glass.renderOrder = 3; glass.visible = false;
  group.add(ribbon, glassDepth, glass);
  function setGlass(o) {
    const solid = o >= 0.995;
    ribbon.visible = solid; glassDepth.visible = !solid; glass.visible = !solid;
    glassMat.opacity = Math.max(0.06, o);
  }

  // ------------------------------------------------------------------ sticks for the catalytic residues
  const ELR = { C: 0.36, N: 0.36, O: 0.36, S: 0.42 };
  const sphere = new THREE.SphereGeometry(1, 24, 16), cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
  const elMat = {};
  for (const e of ["C", "N", "O", "S", "H"]) elMat[e] = new THREE.MeshPhysicalMaterial({ color: COL[e], roughness: 0.28, clearcoat: 0.6 });
  const bondMat = new THREE.MeshPhysicalMaterial({ color: "#d9e6e3", roughness: 0.35, clearcoat: 0.5 });
  const hisH = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.25, clearcoat: 0.6, emissive: "#9fd8ff", emissiveIntensity: 0.6 }));
  hisH.scale.setScalar(0.001);
  const sticks = new THREE.Group();
  sticks.name = "triad";
  group.add(sticks);
  sticks.add(hisH);
  let stickScale = 1, hisHFrac = 0;
  const stickAtoms = [], stickBonds = [];
  const showRes = [TRIAD.ser, TRIAD.his, TRIAD.asp];
  for (const seq of showRes) {
    const r = seqIndex.get(seq), names = Object.keys(resAtoms[r]).filter((n) => !["N", "C", "O"].includes(n) || seq === TRIAD.ser);
    const ids = names.map((n) => resAtoms[r][n]);
    for (const i of ids) {
      const el = atoms[i][2];
      const m = new THREE.Mesh(sphere, elMat[el] || elMat.C);
      m.scale.setScalar(ELR[el] || 0.36);
      m.userData.i = i; sticks.add(m); stickAtoms.push(m);
    }
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const d = P(ids[a], tmp.a).distanceTo(P(ids[b], tmp.b));
      if (d < 1.9) { const m = new THREE.Mesh(cyl, bondMat); m.userData.ab = [ids[a], ids[b]]; sticks.add(m); stickBonds.push(m); }
    }
  }
  // oxyanion hole: the backbone N-H of Ser83 and Leu147 (H placed on the N, opposite the bisector of C(i-1) and CA)
  const oxy = new THREE.Group();
  oxy.name = "oxyanion";
  group.add(oxy);
  const oxyN = OXY.map((seq) => {
    const n = new THREE.Mesh(sphere, elMat.N); n.scale.setScalar(0.36); oxy.add(n);
    const h = new THREE.Mesh(sphere, elMat.H); h.scale.setScalar(0.22); oxy.add(h);
    const b = new THREE.Mesh(cyl, bondMat); oxy.add(b);
    return { seq, n, h, b };
  });
  const setBond = (mesh, a, b, r = 0.14) => {
    const d = tmp.c.copy(b).sub(a), L = d.length();
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(r, L, r);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  function hOf(seq, out) {
    const n = pos(seq, "N", tmp.a.clone()), ca = pos(seq, "CA", tmp.b.clone()), cp = pos(seq - 1, "C", tmp.c.clone());
    const dir = n.clone().sub(ca).normalize().add(n.clone().sub(cp).normalize()).normalize();
    return out.copy(n).addScaledVector(dir, 1.01);
  }
  function placeSticks() {
    const k = stickScale;
    for (const m of stickAtoms) { P(m.userData.i, m.position); m.scale.setScalar((m.userData.r ??= m.scale.x) * k); }
    for (const m of stickBonds) setBond(m, P(m.userData.ab[0], new THREE.Vector3()), P(m.userData.ab[1], new THREE.Vector3()), 0.14 * k);
    // a proton on His258 Ne2 (pointing at Ser146 Og) when the histidine is protonated (acid)
    const ne2 = pos(TRIAD.his, "NE2", new THREE.Vector3()), ogp = pos(TRIAD.ser, "OG", new THREE.Vector3());
    hisH.position.copy(ne2).addScaledVector(ogp.sub(ne2).normalize(), 1.02);
    hisH.scale.setScalar(Math.max(0.001, 0.26 * hisHFrac * k));
    for (const o of oxyN) {
      pos(o.seq, "N", o.n.position); hOf(o.seq, o.h.position);
      o.n.scale.setScalar(0.36 * k); o.h.scale.setScalar(0.22 * k);
      setBond(o.b, o.n.position, o.h.position, 0.1 * k);
    }
  }

  // ------------------------------------------------------------------ Gaussian molecular surface (naive surface nets)
  const surfGeo = new THREE.BufferGeometry();
  const surfMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, clearcoat: 0.3, transparent: true, opacity: 0, depthWrite: true, side: THREE.FrontSide });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  surface.name = "surface";
  surface.visible = false;
  group.add(surface);
  const VDW = { C: 1.7, N: 1.55, O: 1.52, S: 1.8 };
  const hydCol = { h: new THREE.Color(COL.hydro), p: new THREE.Color(COL.polar), "+": new THREE.Color(COL.pos), "-": new THREE.Color(COL.neg) };
  function buildSurface(h = 0.85) {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], cur[3 * i + k]); mx[k] = Math.max(mx[k], cur[3 * i + k]); }
    const pad = 6; mn = mn.map((v) => v - pad); mx = mx.map((v) => v + pad);
    const nx = Math.ceil((mx[0] - mn[0]) / h) + 1, ny = Math.ceil((mx[1] - mn[1]) / h) + 1, nz = Math.ceil((mx[2] - mn[2]) / h) + 1;
    const F = new Float32Array(nx * ny * nz), best = new Float32Array(nx * ny * nz), owner = new Int32Array(nx * ny * nz).fill(-1);
    const I = (x, y, z) => x + nx * (y + ny * z);
    for (let i = 0; i < N; i++) {
      const r = (VDW[atoms[i][2]] || 1.7) * 1.25, cut = r * 2.1, k = 1.1;
      const ax = cur[3 * i], ay = cur[3 * i + 1], az = cur[3 * i + 2];
      const x0 = Math.max(0, Math.floor((ax - cut - mn[0]) / h)), x1 = Math.min(nx - 1, Math.ceil((ax + cut - mn[0]) / h));
      const y0 = Math.max(0, Math.floor((ay - cut - mn[1]) / h)), y1 = Math.min(ny - 1, Math.ceil((ay + cut - mn[1]) / h));
      const z0 = Math.max(0, Math.floor((az - cut - mn[2]) / h)), z1 = Math.min(nz - 1, Math.ceil((az + cut - mn[2]) / h));
      const r2 = r * r;
      for (let z = z0; z <= z1; z++) { const dz = mn[2] + z * h - az; for (let y = y0; y <= y1; y++) { const dy = mn[1] + y * h - ay; for (let x = x0; x <= x1; x++) {
        const dx = mn[0] + x * h - ax, d2 = dx * dx + dy * dy + dz * dz;
        const v = Math.exp(-k * (d2 / r2 - 1)), j = I(x, y, z);
        F[j] += v; if (v > best[j]) { best[j] = v; owner[j] = i; }
      } } }
    }
    const iso = 1.0;
    const vIndex = new Int32Array(nx * ny * nz).fill(-1);
    const verts = [], cols = [], norms = [], faces = [];
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const g = (x, y, z) => F[I(Math.min(nx - 1, Math.max(0, x)), Math.min(ny - 1, Math.max(0, y)), Math.min(nz - 1, Math.max(0, z)))];
    for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
      let mask = 0; const v = [];
      for (let c = 0; c < 8; c++) { const val = F[I(x + corner[c][0], y + corner[c][1], z + corner[c][2])]; v.push(val); if (val > iso) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of edges) {
        if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
        const t = (iso - v[a]) / (v[b] - v[a]);
        sx += corner[a][0] + t * (corner[b][0] - corner[a][0]); sy += corner[a][1] + t * (corner[b][1] - corner[a][1]); sz += corner[a][2] + t * (corner[b][2] - corner[a][2]); n++;
      }
      const px = x + sx / n, py = y + sy / n, pz = z + sz / n;
      vIndex[I(x, y, z)] = verts.length / 3;
      verts.push(mn[0] + px * h, mn[1] + py * h, mn[2] + pz * h);
      const gx = g(x + 1, y, z) - g(x - 1, y, z) + g(x + 1, y + 1, z + 1) - g(x, y + 1, z + 1);
      const gy = g(x, y + 1, z) - g(x, y - 1, z) + g(x + 1, y + 1, z + 1) - g(x + 1, y, z + 1);
      const gz = g(x, y, z + 1) - g(x, y, z - 1) + g(x + 1, y + 1, z + 1) - g(x + 1, y + 1, z);
      const gl = Math.hypot(gx, gy, gz) || 1;
      norms.push(-gx / gl, -gy / gl, -gz / gl);
      // colour by the residue that owns the nearest grid corner
      let o = -1, bv = 0;
      for (let c = 0; c < 8; c++) { const j = I(x + corner[c][0], y + corner[c][1], z + corner[c][2]); if (best[j] > bv) { bv = best[j]; o = owner[j]; } }
      const cl = o >= 0 ? hydCol[res[atoms[o][0]][3]] : hydCol.p;
      cols.push(cl.r, cl.g, cl.b);
    }
    for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const inside = F[I(x, y, z)] > iso;
      for (let ax = 0; ax < 3; ax++) {
        const nx1 = x + (ax === 0), ny1 = y + (ax === 1), nz1 = z + (ax === 2);
        if (nx1 >= nx || ny1 >= ny || nz1 >= nz) continue;
        if (inside === (F[I(nx1, ny1, nz1)] > iso)) continue;
        let q;
        if (ax === 0) q = [I(x, y - 1, z - 1), I(x, y, z - 1), I(x, y, z), I(x, y - 1, z)];
        else if (ax === 1) q = [I(x - 1, y, z - 1), I(x - 1, y, z), I(x, y, z), I(x, y, z - 1)];
        else q = [I(x - 1, y - 1, z), I(x, y - 1, z), I(x, y, z), I(x - 1, y, z)];
        const vi = q.map((j) => vIndex[j]);
        if (vi.some((v) => v < 0)) continue;
        if (inside) faces.push(vi[0], vi[1], vi[2], vi[0], vi[2], vi[3]);
        else faces.push(vi[0], vi[2], vi[1], vi[0], vi[3], vi[2]);
      }
    }
    surfGeo.setIndex(faces);
    surfGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    surfGeo.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
    surfGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    surfGeo.computeBoundingSphere();
    return verts.length / 3;
  }

  // ------------------------------------------------------------------ oleic acid from 1GT6 (shown for reference)
  const lig = data.ligand;
  const ligXYZ = Float32Array.from(lig.xyz);

  // ------------------------------------------------------------------ state
  const state = { lid: 0, jitter: 0, loose: 0, time: 0, surfaceT: -1, dirty: true };
  const coilAtoms = [];
  atoms.forEach((a, i) => { if (res[a[0]][2] === "C") coilAtoms.push(i); });
  const W = { breathe: 0 };
  function apply() {
    const s = smooth(Math.max(0, Math.min(1, state.lid)));
    cur.set(closed);
    for (const i of moving) for (let k = 0; k < 3; k++) cur[3 * i + k] = closed[3 * i + k] + s * (open[3 * i + k] - closed[3 * i + k]);
    if (state.jitter > 0 || state.loose > 0) {
      // thermal motion (fast, small, everywhere on the lid) and, past the optimum, loops and lid loosening
      // (slow, larger): a visual cue, not a simulation
      const t = state.time, A = state.jitter, B = state.loose;
      for (const i of lidAtoms) {
        const ph = i * 0.37;
        cur[3 * i] += A * Math.sin(t * 7.1 + ph) + B * 1.6 * Math.sin(t * 1.3 + ph); cur[3 * i + 1] += A * Math.sin(t * 6.3 + ph * 1.7) + B * 1.6 * Math.sin(t * 1.1 + ph * 1.3); cur[3 * i + 2] += A * Math.sin(t * 8.2 + ph * 0.6) + B * 1.6 * Math.sin(t * 0.9 + ph * 0.7);
      }
      if (B > 0) for (const i of coilAtoms) {
        const ph = i * 0.21;
        cur[3 * i] += B * Math.sin(t * 1.2 + ph); cur[3 * i + 1] += B * Math.sin(t * 1.05 + ph * 1.4); cur[3 * i + 2] += B * Math.sin(t * 0.95 + ph * 0.8);
      }
    }
    buildCartoon();
    placeSticks();
  }
  apply();

  // the direction the active site faces: from the centroid through the open lid toward Ser146
  const og = pos(TRIAD.ser, "OG", new THREE.Vector3());
  const lidC = new THREE.Vector3();
  { let n = 0; atoms.forEach((a, i) => { const s = res[a[0]][0]; if (s >= LID[0] && s <= LID[1]) { lidC.x += open[3 * i]; lidC.y += open[3 * i + 1]; lidC.z += open[3 * i + 2]; n++; } }); lidC.multiplyScalar(1 / n); }
  const face = og.clone().multiplyScalar(0.6).add(lidC.clone().multiplyScalar(0.4)).normalize();

  return {
    group, ribbon, ribbonMat, glass, glassMat, sticks, oxy, surface, surfMat, grey, tint, tintAmt, state, face, ligXYZ, lig, data, meta: data.meta,
    setGlass, nearFade,
    setLoose(b) { if (b !== state.loose) { state.loose = b; state.dirty = true; } },
    setHisProton(f) { if (Math.abs(f - hisHFrac) > 0.002) { hisHFrac = f; state.dirty = true; } },
    pos, atomOf, cur, seqIndex, res,
    set lid(v) { if (v !== state.lid) { state.lid = v; state.dirty = true; } },
    get lid() { return state.lid; },
    setJitter(a) { state.jitter = a; state.dirty = state.dirty || a > 0; },
    update(dt) {
      state.time += dt;
      if (state.jitter > 0 || state.loose > 0) state.dirty = true;
      if (state.dirty) { apply(); state.dirty = false; return true; }
      return false;
    },
    buildSurface,
    // the sticks grow and shrink instead of fading, so they stay opaque and never re-sort against the glass
    sticksScale(o) { const k = Math.max(0, Math.min(1, o)); if (Math.abs(k - stickScale) > 1e-3) { stickScale = k; placeSticks(); } sticks.visible = oxy.visible = k > 0.01; },
    triadOff(f) { const c = new THREE.Color(); for (const [e, m] of Object.entries(elMat)) m.color.copy(c.set(COL[e]).lerp(new THREE.Color("#6d7680"), f * 0.75)); },
    distance(a, b) { return pos(a[0], a[1], new THREE.Vector3()).distanceTo(pos(b[0], b[1], new THREE.Vector3())); },
    hOf: (seq) => hOf(seq, new THREE.Vector3()),
  };
}
