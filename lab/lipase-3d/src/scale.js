// Powers of ten: the same enzyme on its carrier, the carrier bead, and the packed-bed reactor.
// Each level is its own group in its own unit (A, um, cm); the page cuts between them with a short dip,
// because one floating-point scene cannot hold 5 A detail and a 30 cm column at once.
// Sizes: TLL about 5 nm (coordinates); Lipozyme TL IM granules and Novozym 435 beads are a few hundred
// micrometres (manufacturer ranges vary; drawn as 0.5 mm); the column is drawn 30 cm tall. Beads in the column are
// drawn about six times larger than life so they read; said on the page.
import * as THREE from "three";

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function createScale(scene, protein) {
  const levels = {};
  // ---------------------------------------------------------------- 1. enzymes on the carrier's pore wall (A)
  {
    const g = new THREE.Group(); g.name = "carrier"; g.visible = false; scene.add(g);
    // a C-alpha tube of the open enzyme, for instancing
    const ca = [];
    protein.res.forEach((r) => ca.push(protein.pos(r[0], "CA", new THREE.Vector3())));
    const curve = new THREE.CatmullRomCurve3(ca);
    const tube = new THREE.TubeGeometry(curve, 900, 1.3, 6, false);
    // orient so the active-site face points down (-y), like the adsorbed enzyme on a hydrophobic support
    const q = new THREE.Quaternion().setFromUnitVectors(protein.face, new THREE.Vector3(0, -1, 0));
    tube.applyQuaternion(q);
    const n = 170;
    const im = new THREE.InstancedMesh(tube, new THREE.MeshPhysicalMaterial({ color: "#1f9e90", roughness: 0.35, clearcoat: 0.6 }), n);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
    const wall = (x, z) => 18 * Math.sin(x * 0.006) * Math.cos(z * 0.007) + 10 * Math.sin(x * 0.017 + z * 0.011);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 1100, z = (rnd() - 0.5) * 900;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      M4.compose(new THREE.Vector3(x, wall(x, z) + 22, z), Q, S); im.setMatrixAt(i, M4);
    }
    g.add(im);
    // the carrier surface: a porous polymer, cream with pits
    const geo = new THREE.PlaneGeometry(1600, 1400, 220, 200);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let y = wall(x, z);
      const px = Math.sin(x * 0.045) * Math.sin(z * 0.05);
      y -= Math.max(0, px - 0.55) * 60;
      p.setY(i, y);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#d9d2c3", roughness: 0.85 })));
    // a film of oil over them
    const film = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1400), new THREE.MeshPhysicalMaterial({ color: "#c27a0e", transparent: true, opacity: 0.22, roughness: 0.2, emissive: "#6b3c05", emissiveIntensity: 0.4, depthWrite: false }));
    film.rotation.x = -Math.PI / 2; film.position.y = 52; g.add(film);
    levels.carrier = { group: g, cam: { tx: 0, ty: 30, tz: 0, az: 25, el: 32, d: 520 }, bar: { len: 100, unit: "10 nm", worldLen: 100 } };
  }
  // ---------------------------------------------------------------- 2. one bead (um)
  {
    const g = new THREE.Group(); g.name = "bead"; g.visible = false; scene.add(g);
    const r = 250;
    const geo = new THREE.IcosahedronGeometry(r, 72);
    const p = geo.attributes.position, v = new THREE.Vector3();
    // pores: random pits of mixed size scattered over the sphere (a porous resin, drawn, not imaged)
    const pits = [];
    for (let i = 0; i < 520; i++) {
      const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const big = rnd() < 0.15;
      const rad = big ? 0.05 + rnd() * 0.04 : 0.018 + rnd() * 0.025;
      pits.push([new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z), rad, big ? 0.06 : 0.035, Math.cos(rad)]);
    }
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let d = 1 + Math.sin(v.x * 9 + v.z * 7) * 0.004 + Math.sin(v.y * 13 + v.x * 5) * 0.003;
      for (const [c, rad, depth, cr] of pits) {
        const dt = v.x * c.x + v.y * c.y + v.z * c.z;
        if (dt > cr) { const t = Math.acos(Math.min(1, dt)) / rad; d -= depth * (1 - t * t) * (1 - t * t); }
      }
      p.setXYZ(i, v.x * r * d, v.y * r * d, v.z * r * d);
    }
    geo.computeVertexNormals();
    const beadMat = new THREE.MeshPhysicalMaterial({ color: "#b8ae9c", roughness: 0.9, clearcoat: 0.0, sheen: 0.2, sheenColor: new THREE.Color("#7fd8c4") });
    const bead = new THREE.Mesh(geo, beadMat);
    g.add(bead);
    // oil around it and a few neighbours in the bed
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r * 1.035, 96, 64), new THREE.MeshPhysicalMaterial({ color: "#d48a17", transparent: true, opacity: 0.18, roughness: 0.1, emissive: "#7a4306", emissiveIntensity: 0.5, depthWrite: false }));
    g.add(shell);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, m = bead.clone();
      m.position.set(Math.cos(a) * r * 2.15, (rnd() - 0.5) * r * 0.8, Math.sin(a) * r * 2.15 - r * 1.2);
      m.scale.setScalar(0.85 + rnd() * 0.3); g.add(m);
    }
    levels.bead = { group: g, cam: { tx: 0, ty: 0, tz: 0, az: 20, el: 14, d: 1500 }, bar: { len: 100, unit: "100 µm", worldLen: 100 } };
  }
  // ---------------------------------------------------------------- 3. the packed-bed reactor (cm)
  {
    const g = new THREE.Group(); g.name = "reactor"; g.visible = false; scene.add(g);
    const H = 30, R = 2.6;
    const glass = new THREE.MeshPhysicalMaterial({ color: "#dfeef2", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), glass); col.position.y = H / 2; g.add(col);
    const steel = new THREE.MeshStandardMaterial({ color: "#b8bfc4", metalness: 0.9, roughness: 0.3 });
    for (const y of [0, H]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.8, 48), steel); c.position.y = y; g.add(c); }
    // the bed: beads (drawn about 6x life size)
    const nb = 2600, bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 2), new THREE.MeshStandardMaterial({ color: "#e6dfcf", roughness: 0.6 }), nb);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < nb; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (R - 0.25); M4.compose(new THREE.Vector3(Math.cos(a) * rr, 2 + rnd() * (H - 4), Math.sin(a) * rr), Q, S); bm.setMatrixAt(i, M4); }
    g.add(bm);
    // the liquid in the bed: oil feed, amber at the bottom turning golden-pale at the top as it converts
    const liq = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: `varying float vY; uniform float uTime; void main(){ float t = clamp((vY+${H / 2}.0)/${H}.0,0.0,1.0); vec3 a = vec3(0.62,0.33,0.04), b = vec3(0.98,0.86,0.45); vec3 c = mix(a,b,smoothstep(0.0,0.9,t)); gl_FragColor = vec4(c, 0.42); \n#include <colorspace_fragment>\n }` });
    const lq = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.97, H - 2, 48, 24, true), liq); lq.position.y = H / 2; g.add(lq);
    // pipes: feed in at the bottom, product out the top to a settler
    const pipeMat = new THREE.MeshStandardMaterial({ color: "#9aa3a8", metalness: 0.85, roughness: 0.35 });
    const pipe = (pts, r = 0.35) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05), 64, r, 12, false), pipeMat); g.add(m); };
    pipe([[-12, -1, 0], [-6, -1, 0], [0, -1, 0], [0, 0, 0]]);
    pipe([[0, H, 0], [0, H + 2.5, 0], [6, H + 2.5, 0], [12, H + 2.5, 0], [12, 16, 0]]);
    // the settler: biodiesel (light, top) over glycerol (dense, bottom)
    const st = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 48, 1, true), glass); st.position.set(12, 8, 0); g.add(st);
    const fame = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 8, 48), new THREE.MeshPhysicalMaterial({ color: "#f3d27a", transparent: true, opacity: 0.75, roughness: 0.1, emissive: "#8a6410", emissiveIntensity: 0.25 }));
    fame.position.set(12, 9.6, 0); g.add(fame);
    const glyc = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 3.6, 48), new THREE.MeshPhysicalMaterial({ color: "#f4efe4", transparent: true, opacity: 0.85, roughness: 0.2 }));
    glyc.position.set(12, 3.6, 0); g.add(glyc);
    // feed tank of used cooking oil
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 48), new THREE.MeshPhysicalMaterial({ color: "#a8600b", transparent: true, opacity: 0.85, roughness: 0.15, emissive: "#4a2803", emissiveIntensity: 0.3 }));
    tank.position.set(-12, 4, 0); g.add(tank);
    // bubbles of flow rising through the bed
    const nf = 320, fp = new Float32Array(nf * 3), fs = new Float32Array(nf);
    for (let i = 0; i < nf; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (R - 0.4); fp[3 * i] = Math.cos(a) * rr; fp[3 * i + 1] = rnd() * H; fp[3 * i + 2] = Math.sin(a) * rr; fs[i] = 0.5 + rnd(); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    const flow = new THREE.Points(fg, new THREE.PointsMaterial({ color: "#ffc451", size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
    g.add(flow);
    levels.reactor = { group: g, cam: { tx: 0, ty: 15, tz: 0, az: 28, el: 12, d: 95 }, bar: { len: 5, unit: "5 cm", worldLen: 5 },
      update(dt) { const a = fg.attributes.position; for (let i = 0; i < nf; i++) { let y = a.getY(i) + dt * fs[i] * 1.6; if (y > H) y = 0.5; a.setY(i, y); } a.needsUpdate = true; liq.uniforms.uTime.value += dt; } };
  }
  return levels;
}
