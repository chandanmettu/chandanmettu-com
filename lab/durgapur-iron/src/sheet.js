import * as THREE from "three";
import { paperMaterial, surfaceUniforms } from "./paper.js?v=f9d0af7e";
import { pageUniforms } from "./lift.js?v=f9d0af7e";
import { PRODUCTIVITY, FURNACES, PLANT, AUDIT } from "./model.js?v=f9d0af7e";

// The poster: an A0 sheet (1189 × 841 mm) on a desk. Everything printed on it is drawn on one
// canvas: the title block, the figure captions, the flow arrows between the units, the numbers and
// a small chart. The figures themselves print through their own ink (see figure.js).

export const SHEET = { W: 1189, D: 841 };
export const SERIF = '"Source Serif 4", Georgia, serif';
export const HAND = '"Caveat", cursive';
const INK = "#1c2433", INK2 = "#4c5466", RUST = "#9a3b2a";

export class Sheet {
  constructor({ renderer, spill, layout }) {
    this.layout = layout;
    this.group = new THREE.Group();
    const px = renderer.capabilities.maxTextureSize >= 8192 && Math.min(innerWidth, innerHeight) > 700 ? 3.2 : 2.2;
    this.px = px;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(SHEET.W * px);
    this.canvas.height = Math.round(SHEET.D * px);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.surf = surfaceUniforms();
    Object.assign(this.surf, spill);
    this.surf.uSurfAlpha.value = 1;
    const page = pageUniforms(new THREE.Matrix4());
    const mat = paperMaterial(this.surf, page, { color: "#ffffff", hatch: 0, shade: 0.03, map: this.tex });
    mat.transparent = false;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.W, SHEET.D), mat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0;
    top.receiveShadow = true;
    top.userData.page = true;
    this.mesh = top;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(SHEET.W, 0.9, SHEET.D), new THREE.MeshStandardMaterial({ color: "#efe9dc", roughness: 0.95 }));
    edge.position.y = -0.8; // its top sits well under the printed face, so the two never fight
    edge.receiveShadow = true;
    // the desk: a wide matt board, and a cutting mat under the poster
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), new THREE.MeshStandardMaterial({ color: "#a89c86", roughness: 1 }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -2.2; desk.receiveShadow = true;
    const mat2 = new THREE.Mesh(new THREE.BoxGeometry(SHEET.W + 150, 1.2, SHEET.D + 120), new THREE.MeshStandardMaterial({ color: "#5d6b66", roughness: 0.92 }));
    mat2.position.set(10, -1.9, 8); mat2.receiveShadow = true;
    this.group.add(desk, mat2, edge, top);
  }

  // canvas coordinates: sheet x (−W/2..W/2) and z (−D/2..D/2) → pixels
  X(x) { return (x + SHEET.W / 2) * this.px; }
  Z(z) { return (z + SHEET.D / 2) * this.px; }

  draw() {
    const g = this.canvas.getContext("2d"), p = this.px, X = (x) => this.X(x), Z = (z) => this.Z(z);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.blank ? "#f6f1e6" : "#fbf8f0"; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // paper tooth: faint fibres
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.globalAlpha = 0.05; g.strokeStyle = "#7a6a50"; g.lineWidth = 0.6;
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * this.canvas.width, y = rnd() * this.canvas.height, a = rnd() * Math.PI, l = (2 + rnd() * 6) * p;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
    if (this.blank) { this.tex.needsUpdate = true; return; }
    const font = (w, size, fam = SERIF, style = "") => `${style} ${w} ${size * p}px ${fam}`;
    const text = (s, x, z, { size = 8, w = 400, color = INK, fam = SERIF, style = "", align = "left", spacing = 0 } = {}) => {
      g.font = font(w, size, fam, style); g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
      if (spacing) { try { g.letterSpacing = `${spacing * p}px`; } catch { /* older canvas */ } }
      g.fillText(s, X(x), Z(z));
      if (spacing) { try { g.letterSpacing = "0px"; } catch { /* older canvas */ } }
    };
    const wrap = (s, x, z, width, opts = {}) => {
      const size = opts.size ?? 8, lh = (opts.lh ?? 1.38) * size;
      g.font = font(opts.w ?? 400, size, opts.fam ?? SERIF, opts.style ?? "");
      const words = s.split(" ");
      let line = "", yy = z;
      for (const wd of words) {
        const t = line ? line + " " + wd : wd;
        if (g.measureText(t).width > width * p && line) { text(line, x, yy, opts); line = wd; yy += lh; } else line = t;
      }
      if (line) text(line, x, yy, opts);
      return yy + lh;
    };
    const rule = (x0, z0, x1, z1, w = 0.35, color = INK) => { g.strokeStyle = color; g.lineWidth = w * p; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };

    // border and margins
    g.strokeStyle = INK; g.lineWidth = 1.1 * p; g.strokeRect(X(-574), Z(-400), (1148) * p, (800) * p);
    g.lineWidth = 0.35 * p; g.strokeRect(X(-570), Z(-396), (1140) * p, (792) * p);

    // title block
    text("SAIL · DURGAPUR STEEL PLANT · IRON ZONE", -548, -362, { size: 9, w: 600, color: RUST, spacing: 2.2 });
    text("How Durgapur makes iron", -550, -318, { size: 42, w: 640 });
    wrap("From ore and coal to hot metal: the four units of the iron zone, drawn as figures that stand up off this poster. Heat is the only colour; the gas is the only other.", -548, -298, 520, { size: 10, style: "italic", color: INK2 });
    text("Chandan Mettu · Iron Making · IIT Hyderabad · data to October 2026", -548, -262, { size: 7.6, color: INK2 });

    // figure captions, under each figure's hinge line
    for (const f of this.layout) {
      if (!f.caption) continue;
      text(f.label, f.x, f.z + 13, { size: 8.6, w: 640, color: RUST });
      g.font = font(640, 8.6); const lw = g.measureText(f.label + "  ").width / p;
      wrap(f.caption, f.x + lw, f.z + 13, f.capW ?? 300 - lw, { size: 8.6, style: "italic", color: INK });
    }

    // the flow of materials between the units, as printed arrows
    const arrow = (pts, label, at = 0.5, side = -1) => {
      g.strokeStyle = INK; g.lineWidth = 0.7 * p; g.setLineDash([3.2 * p, 2.2 * p]);
      g.beginPath(); g.moveTo(X(pts[0][0]), Z(pts[0][1]));
      for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Z(pts[i][1]));
      g.stroke(); g.setLineDash([]);
      const [ax, az] = pts[pts.length - 2], [bx, bz] = pts[pts.length - 1];
      const ang = Math.atan2(bz - az, bx - ax);
      g.fillStyle = INK; g.beginPath();
      g.moveTo(X(bx), Z(bz));
      g.lineTo(X(bx - 7 * Math.cos(ang - 0.38)), Z(bz - 7 * Math.sin(ang - 0.38)));
      g.lineTo(X(bx - 7 * Math.cos(ang + 0.38)), Z(bz - 7 * Math.sin(ang + 0.38)));
      g.closePath(); g.fill();
      if (label) {
        const i = Math.min(pts.length - 2, Math.floor(at * (pts.length - 1)));
        const [cx, cz] = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
        text(label, cx + (side > 0 ? 4 : -4), cz - 3, { size: 10, fam: HAND, w: 600, color: INK, align: side > 0 ? "left" : "right" });
      }
    };
    for (const a of this.layout.arrows || []) arrow(a.pts, a.label, a.at, a.side);

    // Durgapur in numbers
    const nx = 30, nz = -380;
    text("DURGAPUR IN NUMBERS", nx, nz, { size: 8, w: 640, color: RUST, spacing: 2 });
    rule(nx, nz + 4, 556, nz + 4, 0.4);
    const stat = (x, z, big, unit, label) => {
      text(big, x, z, { size: 24, w: 600 });
      g.font = font(600, 24); const w = g.measureText(big).width / p;
      text(unit, x + w + 2, z, { size: 10, w: 600, color: RUST });
      wrap(label, x, z + 9, 116, { size: 7.2, color: INK2 });
    };
    const tot = FURNACES.reduce((s, f) => s + f.prod * f.working, 0);
    stat(nx, nz + 34, "2.40", "Mt", "hot metal a year, rated (CAG gives 2.45)");
    stat(nx + 132, nz + 34, "3", "furnaces", "BF-2, BF-3, BF-4: 4,600 m³ useful volume in all");
    stat(nx + 264, nz + 34, `${Math.round(tot).toLocaleString("en-IN")}`, "t/day", "from published productivity × working volume");
    stat(nx + 396, nz + 34, "17.05", "Mt", "hot metal in 2017-24: 105 % of its MoU target, best in SAIL (CAG)");
    stat(nx, nz + 84, "5 × 78", "ovens", "coke oven batteries, ovens 4.45 m tall");
    stat(nx + 132, nz + 84, "3", "machines", "sinter strands: 142.7, 142.7 and 198 m²");
    stat(nx + 264, nz + 84, "~350", "kg", "of slag with every tonne of iron (5.93 Mt ÷ 17.05 Mt, CAG)");
    stat(nx + 396, nz + 84, "898–934", "°C", "hot blast, 2023-24; SAIL's new furnaces run 1,137–1,155 °C");

    // a printed chart: productivity planned vs actual (CAG Table 6)
    const cx = 30, cz = -228, cw = 230, ch = 64;
    text("Productivity, t per m³ of working volume a day", cx, cz - ch - 12, { size: 7.4, w: 600 });
    const yv = (v) => cz - ((v - 1.6) / (2.0 - 1.6)) * ch;
    rule(cx, cz, cx + cw, cz, 0.4);
    for (const v of [1.6, 1.8, 2.0]) { rule(cx - 2, yv(v), cx + cw, yv(v), 0.12, INK2); text(v.toFixed(1), cx - 4, yv(v) + 2, { size: 6, color: INK2, align: "right" }); }
    const bw = cw / PRODUCTIVITY.length;
    PRODUCTIVITY.forEach((d, i) => {
      const x = cx + i * bw + bw * 0.22;
      g.fillStyle = "rgba(28,36,51,0.85)"; g.fillRect(X(x), Z(yv(d.actual)), bw * 0.34 * p, (cz - yv(d.actual)) * p);
      g.strokeStyle = INK; g.lineWidth = 0.45 * p; g.strokeRect(X(x + bw * 0.36), Z(yv(d.plan)), bw * 0.3 * p, (cz - yv(d.plan)) * p);
      text(d.fy.replace("20", "’").replace("-20", "–"), x + bw * 0.3, cz + 8, { size: 5.8, color: INK2, align: "center" });
    });
    text("■ actual   □ plan · CAG Report 38 of 2025", cx, cz + 17, { size: 6.2, color: INK2 });
    void PLANT; void AUDIT;

    // footer: where the numbers come from
    wrap("Sources: SAIL plant pages; CAG Report No. 38 of 2025 (SAIL blast furnaces, 2017-24); Global Energy Monitor; PIB; Suchnaji; standard ironmaking texts for typical ranges (marked typical). Furnace shapes are typical profiles scaled to Durgapur's published volumes.", -548, 382, 1080, { size: 6.4, color: INK2 });
    this.tex.needsUpdate = true;
  }
}
