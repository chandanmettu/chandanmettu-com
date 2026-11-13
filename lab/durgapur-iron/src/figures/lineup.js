import * as THREE from "three";
import { Figure, V3, UP, circle } from "../figure.js?v=d8f12ce5";
import { glassMaterial } from "../paper.js?v=d8f12ce5";
import { linesOf, FURNACES, BF5, BHILAI8 } from "../model.js?v=d8f12ce5";

// Five furnaces to one scale (2 mm to the metre): Durgapur's three, the planned BF-5, and Bhilai's
// BF-8 for comparison. Each shell is the same typical profile scaled to that furnace's published
// volumes, so the sizes compare honestly; BF-5 is drawn in glass and dashed, because it is a plan.

export const LS = 2.0;
export const LINEUP = [
  { f: FURNACES[0], x: 16 }, { f: FURNACES[1], x: 56 }, { f: FURNACES[2], x: 100 },
  { f: BF5, x: 152, planned: true }, { f: BHILAI8, x: 214 },
];
const Z = -22;

export class Lineup extends Figure {
  constructor({ frame, spill }) {
    super({ frame, name: "lineup", spill, total: 2.4 });
    this.build();
  }

  build() {
    const steel = this.paper("steel", { color: "#ece9e1", hatchA: [0.15, 1, 0.25], hatchB: [1, 0.25, -0.3], spacing: 0.9, shade: 0.2, seed: 3 });
    const glass = glassMaterial(this.surf, this.page, { tint: "#e9dcc8", base: 0.1, edge: 0.45 });
    this.glassMats = [glass];
    this.tops = [];
    // a ground line and a 10 m scale bar
    this.part();
    this.line(this.main, [V3(0, 0.05, -2), V3(246, 0.05, -2)], { wobble: 0.1 });
    this.line(this.main, [V3(236, 0.05, -6), V3(236, 10 * LS, -6)], { wobble: 0 });
    for (const y of [0, 5 * LS, 10 * LS]) this.line(this.fine, [V3(234, y, -6), V3(238, y, -6)], { wobble: 0, overshoot: 0 });
    for (const it of LINEUP) {
      this.part(0.7);
      const L = linesOf(it.f);
      const lin = (y) => (y < L.yT ? 1.15 : y < L.yStack ? 0.78 : 0.5);
      const rin = (y) => (y <= L.yT ? L.rH : y <= L.yBosh ? L.rH + (L.rB - L.rH) * ((y - L.yT) / L.hBosh) : y <= L.yBelly ? L.rB : y <= L.yStack ? L.rB + (L.rT - L.rB) * ((y - L.yBelly) / L.hStack) : L.rT);
      const base = 5.0; // the hearth pad, m
      const prof = [];
      for (const y of [-base, 0, L.yT, L.yBosh, L.yBelly, L.yStack, L.yStock + 2.2]) prof.push([(y + base) * LS, (rin(y) + lin(y) + 0.14) * LS]);
      prof.push([(L.yStock + 5.4 + base) * LS, 1.9 * LS]);
      const mat = it.planned ? glass : steel;
      const m = this.lathe(V3(it.x, 0, Z), UP, prof, mat, { rings: [0, prof[3][0], prof[4][0], prof[5][0]], segments: 48, set: it.planned ? this.fine : this.main, occlude: !it.planned });
      if (it.planned) { m.renderOrder = 6; for (const r of [8, 16, 24, 32, 40, 48, 56, 64]) if (r < prof[6][0]) this.line(this.fine, circle(V3(it.x, r, Z), UP, rOfProf(prof, r), 40).pts, { closed: true, dash: 1.6, wobble: 0.04, overshoot: 0 }); }
      this.cylinder(V3(it.x, prof[7][0], Z), V3(it.x, prof[7][0] + 8 * LS, Z), 1.4 * LS, it.planned ? glass : steel, { rings: [8 * LS] });
      this.tops.push({ ...it, top: V3(it.x, prof[7][0] + 8 * LS, Z), L });
    }
    this.finish();
  }
  update() {}
}
function rOfProf(prof, y) {
  for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [y0, r0] = prof[i - 1], [y1, r1] = prof[i]; return r0 + (r1 - r0) * ((y - y0) / (y1 - y0)); }
  return prof[prof.length - 1][1];
}
