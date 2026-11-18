// What the conditions do, made visible on the enzyme at the oil (chapter 5). Every effect is driven by
// model.readings(); the sizes and speeds are illustrative and the page says so.
//  - activity: how fast biodiesel molecules (methyl esters, gold) leave the active site into the oil
//  - metal ions: ions from the water settle on the enzyme; inhibitors tint it toward the ion's colour
//  - (pH, temperature, methanol are applied on the protein itself by main.js: proton on His258, jitter and
//    loosening, grey when methanol has inactivated it)
import * as THREE from "three";
import { glowSprite } from "./chem.js?v=3be210fe";

let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function createConditions(scene, protein, iface) {
  const group = new THREE.Group(); group.name = "conditions"; group.visible = false; scene.add(group);
  // ---------------------------------------------------------------- biodiesel leaving: short ester glyphs
  const NP = 36, PER = 9;
  const sph = new THREE.SphereGeometry(1, 14, 10);
  const prod = new THREE.InstancedMesh(sph, new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.7, emissive: "#7a4a06", emissiveIntensity: 0.5 }), NP * PER);
  prod.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * PER * 3), 3);
  const cGold = new THREE.Color("#ffc451"), cO = new THREE.Color("#e2553f");
  for (let i = 0; i < NP * PER; i++) prod.setColorAt(i, i % PER < 2 ? cO : cGold);
  prod.count = NP * PER; group.add(prod);
  const parts = Array.from({ length: NP }, () => ({ live: false, t: 0, dir: new THREE.Vector3(), spin: rnd() * 6 }));
  let acc = 0;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  // ---------------------------------------------------------------- metal ions
  const NI = 14;
  const ionMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.2, clearcoat: 1, emissive: "#ffffff", emissiveIntensity: 0.35 });
  const ions = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), ionMat, NI);
  ions.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NI * 3), 3);
  group.add(ions);
  // binding spots: outward-facing surface atoms (largest distance from the centroid), spread over the enzyme
  const spots = [];
  {
    const c = protein.cur, n = c.length / 3, cand = [];
    for (let i = 0; i < n; i += 7) { const v = new THREE.Vector3(c[3 * i], c[3 * i + 1], c[3 * i + 2]); cand.push([v.length(), v]); }
    cand.sort((a, b) => b[0] - a[0]);
    const top = cand.slice(0, 140);
    for (let k = 0; k < NI; k++) spots.push(top[Math.floor((k / NI) * top.length)][1].clone().multiplyScalar(1.08));
  }
  const ionState = Array.from({ length: NI }, () => ({ from: new THREE.Vector3((rnd() - 0.5) * 140, 20 + rnd() * 50, (rnd() - 0.5) * 140), k: 0, ph: rnd() * 6 }));
  const ionGlow = Array.from({ length: NI }, (_, i) => { const g = glowSprite("#ffffff", 3.2, 0.6, 10 + i); group.add(g); return g; });
  const col = new THREE.Color();
  const tmp = new THREE.Vector3();
  let time = 0;
  return {
    group,
    update(dt, R, on) {
      group.visible = on;
      if (!on) return;
      time += dt;
      // the active-site mouth in world space, and the outward direction along the interface
      const site = protein.group.localToWorld(protein.pos(146, "OG", new THREE.Vector3()));
      site.y = Math.min(site.y, iface + 1.5);
      // spawn by rate
      acc += dt * R.rate;
      while (acc >= 1) {
        acc -= 1;
        const p = parts.find((q) => !q.live);
        if (!p) break;
        const a = rnd() * Math.PI * 2;
        p.live = true; p.t = 0; p.dir.set(Math.cos(a), -0.25 - rnd() * 0.25, Math.sin(a)).normalize(); p.spin = rnd() * 6;
      }
      let j = 0;
      for (const p of parts) {
        if (p.live) { p.t += dt; if (p.t > 4.2) p.live = false; }
        for (let k = 0; k < PER; k++, j++) {
          if (!p.live) { prod.setMatrixAt(j, ZERO); continue; }
          const life = p.t / 4.2, grow = Math.min(1, p.t / 0.4) * (1 - Math.max(0, (life - 0.8) / 0.2));
          const head = tmp.copy(site).addScaledVector(p.dir, 4 + p.t * 9);
          // a zigzag chain trailing behind the head
          const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x);
          V.copy(head).addScaledVector(p.dir, -k * 1.25).addScaledVector(side, (k % 2 ? 0.4 : -0.4)).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(p.spin + k) * 0.2);
          S.setScalar((k < 2 ? 0.55 : 0.5) * grow);
          M4.compose(V, Q, S); prod.setMatrixAt(j, M4);
        }
      }
      prod.instanceMatrix.needsUpdate = true;
      // ions: settle on the enzyme when an ion is chosen; leave when none (or EDTA strips them)
      const ion = R.ion, want = ion.col ? 1 : 0;
      for (let i = 0; i < NI; i++) {
        const s = ionState[i];
        s.k += (want - s.k) * (1 - Math.exp(-dt * (want ? 0.9 + i * 0.05 : 2.2)));
        const target = protein.group.localToWorld(spots[i].clone());
        const wob = new THREE.Vector3(Math.sin(time * 1.3 + s.ph), Math.sin(time * 1.1 + s.ph * 2), Math.cos(time * 1.2 + s.ph)).multiplyScalar(1 - s.k);
        V.copy(s.from).lerp(target, Math.min(1, s.k * 1.02)).add(wob.multiplyScalar(4));
        S.setScalar(s.k > 0.02 ? 0.95 * Math.min(1, s.k * 3) : 0);
        M4.compose(V, Q, S); ions.setMatrixAt(i, M4);
        col.set(ion.col || "#ffffff"); ions.setColorAt(i, col);
        ionGlow[i].position.copy(V); ionGlow[i].material.color.copy(col).multiplyScalar(0.6); ionGlow[i].material.opacity = s.k > 0.05 ? 0.55 * s.k : 0;
      }
      ions.instanceMatrix.needsUpdate = true; ions.instanceColor.needsUpdate = true;
    },
    // a label anchor for the departing biodiesel
    prodAnchor() { const site = protein.group.localToWorld(protein.pos(146, "OG", new THREE.Vector3())); return site.add(new THREE.Vector3(14, -3, 6)); },
    ionAnchor() { return protein.group.localToWorld(spots[2].clone()); },
  };
}
