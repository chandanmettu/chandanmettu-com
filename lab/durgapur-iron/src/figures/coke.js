import * as THREE from "three";
import { Figure, HEAT, GAS, V3, UP, circle, smooth } from "../figure.js?v=f9d0af7e";
import { Flow } from "../flow.js?v=f9d0af7e";
import { COKE, coking } from "../model.js?v=f9d0af7e";

// A coke oven battery: 78 ovens (Durgapur's count, 4.45 m tall) in a row, with the pusher machine
// on the far side, the coke guide and quench car on the near side, the coal tower at one end, the
// quench tower at the other, the gas collecting main on top and a chimney behind. Battery drawn
// at about 1.7 mm to the metre with a typical oven pitch. Beside it, "one oven drawn large": a slice
// through three ovens and four heating walls at 14 mm to the metre, where the coking happens.

const B = { x0: 24, x1: 214, y0: 6, y1: 22, z0: -58, z1: -34 }; // the battery block
const N = COKE.ovens;
const PITCH = (B.x1 - B.x0) / N;
const PUSH_I = 52; // the oven being pushed
// the enlarged slice: three ovens, four walls (oven width typical, about 0.45 m)
const D = { x0: 246, y0: 2, h: 62, z0: -24, z1: -6, wall: 6.5, oven: 10.5 }; // ovens drawn wider than life so their insides read

export class Coke extends Figure {
  constructor({ frame, spill }) {
    super({ frame, name: "coke", spill, total: 3.0 });
    this.p = 0.35; this.push = null;
    this.build();
  }

  build() {
    const brick = this.paper("brick", { color: "#f1e9dc", hatchA: [0.62, 0.74, 0.45], spacing: 1.2, shade: 0.16, seed: 5 });
    const steel = this.paper("steel", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 1.0, shade: 0.2, seed: 3 });
    const conc = this.paper("conc", { color: "#f3efe6", hatchA: [0.62, 0.74, 0.45], spacing: 1.4, shade: 0.14, seed: 7 });
    const coal = this.paper("coal", { color: "#bdb6ab", hatchA: [0.9, 0.3, 0.3], hatchB: [-0.4, 0.9, 0.2], spacing: 0.5, shade: 0.35, seed: 41 });
    const cokeM = this.paper("coke", { color: "#f3eee4", hatchA: [0.2, 1, 0.1], spacing: 0.8, shade: 0.12, seed: 43 });
    const flat = { wobble: 0, overshoot: 0, taper: false };

    // ---------- the battery ----------
    this.part();
    this.box(B.x0 - 4, B.x1 + 4, 0, B.y0, B.z0 - 2, B.z1 + 2, conc, { set: this.bold }); // the regenerators' base
    this.box(B.x0, B.x1, B.y0, B.y1, B.z0, B.z1, brick, { set: this.bold });
    this.part(0.6);
    for (let i = 0; i <= N; i++) {
      const x = B.x0 + i * PITCH;
      this.line(i % 6 === 0 ? this.main : this.fine, [V3(x, B.y0 + 0.6, B.z1 + 0.02), V3(x, B.y1 - 0.6, B.z1 + 0.02)], flat);
      if (i < N) this.line(this.fine, [V3(x + PITCH * 0.5, B.y1 + 0.02, B.z0 + 2), V3(x + PITCH * 0.5, B.y1 + 0.02, B.z1 - 2)], { ...flat, dash: 1.2 });
    }
    // the charging holes on the top, the gas collecting main and its ascension pipes
    this.part(0.6);
    const gm = this.pipe([V3(B.x0 - 2, B.y1 + 7, B.z1 - 3), V3(B.x1 + 2, B.y1 + 7, B.z1 - 3)], 1.8, steel, { tension: 0 });
    void gm;
    for (let i = 3; i < N; i += 6) {
      const x = B.x0 + (i + 0.5) * PITCH;
      this.cylinder(V3(x, B.y1, B.z1 - 3), V3(x, B.y1 + 6, B.z1 - 3), 0.55, steel, { rings: [6] });
    }
    // rails and the charging car on top
    for (const z of [B.z0 + 2.5, B.z1 - 7]) this.line(this.fine, [V3(B.x0, B.y1 + 0.05, z), V3(B.x1, B.y1 + 0.05, z)], flat);
    this.larry = this.mover("larry");
    this.box(-5, 5, B.y1, B.y1 + 6, B.z0 + 1, B.z1 - 8, steel, { set: this.larry.userData.ink.main, parent: this.larry });
    // the coal tower at the left end, the quench tower at the right, the chimney behind
    this.part();
    this.box(4, 20, 0, 66, -60, -36, conc, { set: this.main });
    this.lathe(V3(12, 66, -48), UP, [[0, 9], [6, 5]], steel, { rings: [6] });
    this.box(B.x1 + 8, B.x1 + 24, 0, 46, -10, 0, conc, { set: this.main });
    this.box(B.x1 + 10, B.x1 + 22, 46, 60, -8, -2, conc, { set: this.fine });
    this.cylinder(V3(120, 0, -80), V3(120, 128, -80), 6.5, brick, { rings: [0, 40, 90, 128] });
    this.lathe(V3(120, 128, -80), UP, [[0, 6.5], [2.5, 7.5]], brick, { rings: [2.5] });
    // the pusher machine on its rails behind the battery, with its ram
    this.part();
    for (const z of [B.z0 - 6, B.z0 - 14]) this.line(this.main, [V3(B.x0 - 4, 0.05, z), V3(B.x1 + 4, 0.05, z)], flat);
    this.pusher = this.mover("pusher");
    this.pusher.position.set(B.x0 + (PUSH_I + 0.5) * PITCH, 0, 0);
    this.box(-8, 8, 0, 20, B.z0 - 18, B.z0 - 3, steel, { set: this.pusher.userData.ink.main, parent: this.pusher });
    this.ram = this.mover("ram", this.pusher);
    this.box(-1, 1, B.y0 + 5, B.y0 + 7.5, -6, 0, steel, { set: this.ram.userData.ink.main, parent: this.ram });
    this.ram.position.z = B.z0 - 3;
    // the coke guide and the quench car on the near side
    this.part();
    for (const z of [B.z1 + 14, B.z1 + 22]) this.line(this.main, [V3(B.x0 - 4, 0.05, z), V3(B.x1 + 26, 0.05, z)], flat);
    this.box(B.x0 + (PUSH_I - 1) * PITCH, B.x0 + (PUSH_I + 2) * PITCH, B.y0 - 1, B.y1, B.z1, B.z1 + 8, steel, { set: this.fine });
    this.car = this.mover("car");
    this.box(-9, 9, 1, 10, B.z1 + 11, B.z1 + 25, steel, { set: this.car.userData.ink.main, parent: this.car });
    // the coke cake: a glowing slab that leaves the oven, slides into the car, and is quenched
    this.cake = this.glowMesh(new THREE.BoxGeometry(PITCH * 0.6, B.y1 - B.y0 - 2, B.z1 - B.z0), HEAT, { gain: 1.6, alpha: 0.95 });
    this.cake.visible = false;
    this.steam = [];
    const steamM = this.paper("steam", { color: "#ffffff", hatch: 0, shade: 0.02, seed: 3 });
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(4 + k, 16, 10), steamM);
      m.position.set(B.x1 + 16 + (k % 2) * 3, 62 + k * 7, -5); m.visible = false;
      this.group.add(m); this.steam.push(m);
    }

    // ---------- one oven drawn large: three ovens, four heating walls ----------
    this.part(1.5);
    const xs = [];
    let x = D.x0;
    for (let k = 0; k < 7; k++) { const w = k % 2 === 0 ? D.wall : D.oven; xs.push([x, x + w, k % 2 === 0 ? "wall" : "oven"]); x += w; }
    this.detailX = xs;
    this.box(D.x0 - 2, x + 2, 0, D.y0, D.z0 - 1, D.z1 + 1, conc, { set: this.main });
    this.walls = [];
    this.ovens = [];
    for (const [a, b, kind] of xs) {
      if (kind === "wall") {
        this.box(a, b, D.y0, D.y0 + D.h, D.z0, D.z1, brick, { set: this.main });
        // the flues inside the wall: they glow as the gas burns in them
        for (let f = 0; f < 1; f++) {
          const fx = a + D.wall / 2;
          const g = this.glowMesh(new THREE.PlaneGeometry(2.0, D.h - 8), HEAT, { gain: 1.3, alpha: 0.7 });
          g.position.set(fx, D.y0 + D.h / 2, D.z1 + 0.06);
          this.walls.push(g);
          this.line(this.fine, [V3(fx - 1.2, D.y0 + 4, D.z1 + 0.04), V3(fx - 1.2, D.y0 + D.h - 4, D.z1 + 0.04), V3(fx + 1.2, D.y0 + D.h - 4, D.z1 + 0.04), V3(fx + 1.2, D.y0 + 4, D.z1 + 0.04)], { closed: true, ...flat });
        }
      } else {
        const ov = { a, b, parts: {} };
        // coke from each wall, coal in the middle, a plastic layer at each front
        const mk = (mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, D.h - 4, D.z1 - D.z0 - 1), mat); m.position.y = D.y0 + 2 + (D.h - 4) / 2; m.position.z = (D.z0 + D.z1) / 2; this.surface(m, { occlude: false }); return m; };
        ov.parts.cokeL = mk(cokeM); ov.parts.cokeR = mk(cokeM); ov.parts.coal = mk(coal);
        ov.glowL = this.glowMesh(new THREE.PlaneGeometry(1, D.h - 4), HEAT, { gain: 1.5, alpha: 0.9 });
        ov.glowR = this.glowMesh(new THREE.PlaneGeometry(1, D.h - 4), HEAT, { gain: 1.5, alpha: 0.9 });
        ov.cokeGlow = [this.glowMesh(new THREE.PlaneGeometry(1, D.h - 4), HEAT, { gain: 1.2, alpha: 0.6 }), this.glowMesh(new THREE.PlaneGeometry(1, D.h - 4), HEAT, { gain: 1.2, alpha: 0.6 })];
        for (const g of [ov.glowL, ov.glowR, ...ov.cokeGlow]) { g.position.y = D.y0 + 2 + (D.h - 4) / 2; g.position.z = D.z1 + 0.1; }
        this.line(this.main, [V3(a, D.y0 + D.h, D.z1), V3(b, D.y0 + D.h, D.z1)], flat);
        this.line(this.fine, [V3(a, D.y0 + D.h - 2, D.z1 + 0.02), V3(b, D.y0 + D.h - 2, D.z1 + 0.02)], { ...flat, dash: 1 });
        this.ovens.push(ov);
      }
    }
    // a magnifier ring from the battery to the slice
    this.part(0.5);
    const mx = B.x0 + (PUSH_I + 0.5) * PITCH;
    this.line(this.fine, [V3(mx, B.y1 + 2, B.z1), V3(D.x0 - 4, D.y0 + D.h + 4, D.z1)], { dash: 2.2 });
    this.line(this.fine, circle(V3(mx, (B.y0 + B.y1) / 2, B.z1 + 0.5), V3(0, 0, 1), 6, 24).pts, { closed: true, wobble: 0.05 });

    // the gas leaving the ovens: up the ascension pipes into the collecting main, away to the by-products
    this.flows = new Flow({ figure: this });
    this.flows.add([V3(B.x0, B.y1 + 7, B.z1 - 3), V3(B.x1 + 2, B.y1 + 7, B.z1 - 3), V3(B.x1 + 4, B.y1 + 7, B.z1 - 14), V3(B.x1 + 4, B.y1 + 7, -76)], { color: GAS, count: 18, speed: 26, size: 2.2, group: "gas" });

    this.tags = { coke: this.tag({ x0: 118, x1: 158, h: 18, z: -2, y: 0.3 }) };
    this.finish();
  }

  // stages for the three big ovens: they were charged at different times, so each shows another moment
  stageOf(k) { return [Math.min(1, this.p + 0.42), this.p, Math.max(0, this.p - 0.3)][k]; }

  pushNow() {
    if (this.push) return null;
    const ok = this.p >= 0.97;
    this.push = { t: 0, ok };
    return ok;
  }

  update(dt, { live }) {
    if (live && this.phase === "live" && !this.push) this.p = Math.min(1, this.p + dt * (this.auto ? 0.035 : 0));
    // the slice: each oven's two plastic layers have moved in by its stage
    this.ovens.forEach((ov, k) => {
      const C = coking(this.stageOf(k));
      const w = ov.b - ov.a, half = w / 2, f = C.front * half;
      const set = (m, x0, x1) => { const ww = Math.max(0.01, x1 - x0); m.scale.x = ww; m.position.x = (x0 + x1) / 2; m.visible = ww > 0.05 && this.surfA > 0.002; };
      set(ov.parts.cokeL, ov.a, ov.a + f); set(ov.parts.cokeR, ov.b - f, ov.b); set(ov.parts.coal, ov.a + f, ov.b - f);
      const band = 1.1;
      ov.glowL.scale.x = ov.glowR.scale.x = band;
      ov.glowL.position.x = ov.a + f; ov.glowR.position.x = ov.b - f;
      const on = C.done ? 0.15 : 0.95;
      ov.glowL.material.uniforms.uOn.value = ov.glowR.material.uniforms.uOn.value = on;
      ov.cokeGlow[0].scale.x = ov.cokeGlow[1].scale.x = Math.max(0.01, f);
      ov.cokeGlow[0].position.x = ov.a + f / 2; ov.cokeGlow[1].position.x = ov.b - f / 2;
      for (const g of ov.cokeGlow) g.material.uniforms.uOn.value = 0.2 * Math.min(1, f / 1.2);
    });
    for (const g of this.walls) g.material.uniforms.uOn.value = 0.22 + 0.04 * Math.sin(performance.now() / 300 + g.position.x);
    // the push: ram forward, cake slides out into the car, car runs to the quench tower, steam
    const P = this.push;
    const ovenX = B.x0 + (PUSH_I + 0.5) * PITCH;
    let carX = ovenX;
    this.cake.visible = false;
    this.steam.forEach((m) => (m.visible = false));
    if (P) {
      P.t += dt;
      const t = P.t;
      this.ram.position.z = B.z0 - 3 + smooth(t / 2.2) * (B.z1 - B.z0 + 8) * (1 - smooth((t - 3) / 1.5));
      const out = smooth(t / 2.2);
      this.cake.visible = this.surfA > 0.01 && t < 6.5;
      this.cake.position.set(ovenX, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2 + out * (B.z1 - B.z0 + 14));
      carX = ovenX + smooth((t - 2.6) / 2.4) * (B.x1 + 16 - ovenX);
      if (t > 2.6) this.cake.position.x = carX;
      this.cake.material.uniforms.uOn.value = t < 5 ? (P.ok ? 1 : 0.55) : Math.max(0, 1 - (t - 5) / 1.5);
      if (t > 5) this.steam.forEach((m, k) => { m.visible = this.surfA > 0.01; const u = Math.min(1, (t - 5 - k * 0.12) / 2.5); m.position.y = 52 + k * 8 + u * 30; m.scale.setScalar(0.4 + u); });
      if (t > 9.5) { this.push = null; this.p = 0; }
    }
    this.car.position.x = P ? carX : ovenX;
    // the charging car rides back and forth over the battery
    this.larry.position.x = B.x0 + 10 + (0.5 + 0.5 * Math.sin(performance.now() / 4200)) * (B.x1 - B.x0 - 20);
    this.flows.update(dt, { gas: live ? 1 : 0 }, this.surfA);
  }

  drawTags(ctx) {
    if (this.phase !== "live") return;
    const C = coking(this.p);
    drawTag(this.tags.coke, { title: "Middle oven, centre", big: `${ctx.fmt(C.centre)} °C`, color: C.centre > 700 ? "#c4520c" : "#1c2433", note: C.done ? "layers met: push it" : `${Math.round(this.p * 100)} % of the cycle` });
  }
}

const SERIF = '"Source Serif 4", Georgia, serif', HAND = '"Caveat", cursive';
export function drawTag(tag, lines) {
  const key = JSON.stringify(lines);
  if (tag.last === key) return;
  tag.last = key;
  const c = tag.canvas, g = c.getContext("2d"), s = c.width / tag.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, c.width, c.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  g.textBaseline = "alphabetic";
  g.font = `600 2.5px ${SERIF}`; g.fillStyle = "#1c2433"; g.fillText(lines.title, 2.6, 4.4);
  g.font = `600 ${lines.size || 7.6}px ${HAND}`; g.fillStyle = lines.color || "#1c2433"; g.fillText(lines.big, 2.6, 12.4);
  g.font = `italic 400 2.2px ${SERIF}`; g.fillStyle = "#4c5466"; g.fillText(lines.note, 2.6, tag.h - 2.4);
  tag.tex.needsUpdate = true;
}
export { D as COKE_DETAIL, B as COKE_BATTERY, PITCH as COKE_PITCH, PUSH_I };
