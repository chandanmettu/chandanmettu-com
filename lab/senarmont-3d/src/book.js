import * as THREE from "three";

// An open book on a desk mat. Everything is procedural: paper fibre, page edges, cloth, print.
// Page coordinates are millimetres from a page's top-left corner (mx right, my down).

export const BOOK = { W: 200, D: 260, BASE: 1.6, BOARD: 3, BLOCK: 14, G: 22, DROP: 8 };
BOOK.Y = BOOK.BASE + BOOK.BOARD + BOOK.BLOCK; // the flat page surface
export const PX = 9; // canvas pixels per millimetre of page

const INK = "#1c2433", INK2 = "#4c5466", ACCENT = "#9a3b2a", HEAT = "#e0600c";
export const SERIF = '"Source Serif 4", Georgia, serif';
export const HAND = '"Caveat", "Comic Sans MS", cursive';

export const pageHeight = (u) => BOOK.Y - BOOK.DROP * Math.pow(1 - Math.min(1, Math.max(0, u) / BOOK.G), 2.2);

// world position of a point on a page, given page millimetres
export function pageToWorld(side, mx, my, lift = 0) {
  const x = side === "right" ? mx : mx - BOOK.W;
  const u = side === "right" ? mx : BOOK.W - mx;
  return new THREE.Vector3(x, pageHeight(u) + lift, my - BOOK.D / 2);
}

// ---- procedural textures ----
function valueNoise(seed) {
  const h = (x, y) => {
    let t = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fibreNormal(size = 512, seed = 11) {
  const n1 = valueNoise(seed), n2 = valueNoise(seed + 5);
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = x / size, q = y / size;
    hgt[y * size + x] = 0.5 * n1(p * 24, q * 24) + 0.25 * n2(p * 96, q * 96);
  }
  let r = seed * 99991;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < size * 3; i++) {
    let fx = rnd() * size, fy = rnd() * size;
    const a = rnd() * Math.PI, len = 4 + rnd() * 14, k = 0.035 + rnd() * 0.05;
    for (let j = 0; j < len; j++) {
      const ix = ((Math.round(fx) % size) + size) % size, iy = ((Math.round(fy) % size) + size) % size;
      hgt[iy * size + ix] += k;
      fx += Math.cos(a); fy += Math.sin(a);
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => hgt[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.4, dy = (at(x, y + 1) - at(x, y - 1)) * 1.4;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    data[i] = 128 + 127 * (-dx / l); data[i + 1] = 128 + 127 * (-dy / l); data[i + 2] = 255 / l * 1; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = "#d8ccb6"; g.fillRect(0, 0, 1024, 1024);
  const n = valueNoise(3);
  for (let y = 0; y < 1024; y += 2) {
    const k = n(0.5, y / 37) * 0.6 + n(3, y / 9) * 0.4;
    g.fillStyle = `rgba(120, 96, 66, ${0.05 + 0.09 * k})`;
    g.fillRect(0, y, 1024, 2);
  }
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 1024, x = Math.random() * 1024, w = 40 + Math.random() * 260;
    g.strokeStyle = `rgba(110, 86, 58, ${0.04 + Math.random() * 0.06})`;
    g.lineWidth = 0.6 + Math.random() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y + 3, x + w * 0.6, y - 3, x + w, y + 1); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  return t;
}

// the page material: real paper under real light, plus the coloured spill from the glowing dye
function pageMaterial(map, normal, spill) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.93, metalness: 0, normalMap: normal, normalScale: new THREE.Vector2(0.12, 0.12) });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, spill);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldEj;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWorldEj = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldEj; uniform sampler2D uSpill; uniform vec4 uSpillRect; uniform float uSpillGain;")
      .replace("#include <opaque_fragment>", `
  vec2 ejSq = (vWorldEj.xz - uSpillRect.xy) / uSpillRect.zw;
  float ejIn = step(0.0, ejSq.x) * step(0.0, ejSq.y) * step(ejSq.x, 1.0) * step(ejSq.y, 1.0);
  outgoingLight += diffuseColor.rgb * texture2D(uSpill, clamp(ejSq, 0.0, 1.0)).rgb * ejIn * uSpillGain * 0.8;
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "rp-page";
  return m;
}

function edgeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#f1eadb", roughness: 0.95 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSheet; varying float vSheet;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvSheet = aSheet;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vSheet;
float edHash(float n) { return fract(sin(n * 91.345) * 47453.5453); }`)
      .replace("#include <map_fragment>", `#include <map_fragment>
  {
    float fw = max(fwidth(vSheet), 1e-4);
    float tone = mix(0.93 + 0.07 * edHash(floor(vSheet)), 0.965, smoothstep(0.3, 0.8, fw));
    float d = abs(fract(vSheet) - 0.5);
    float line = 1.0 - smoothstep(0.38 - fw, 0.38 + fw, 0.5 - d);
    line = mix(line, 0.24, smoothstep(0.25, 0.6, fw));
    diffuseColor.rgb *= tone * (1.0 - 0.12 * line);
  }`);
  };
  m.customProgramCacheKey = () => "rp-edge";
  return m;
}

// ---- the page block: curved top (the page), sheet-lined edges ----
function blockGeometry(side) {
  const { W, D, BASE, BOARD } = BOOK;
  const y0 = BASE + BOARD;
  const nu = 44;
  const us = [];
  for (let i = 0; i <= nu; i++) us.push(W * Math.pow(i / nu, 1.7));
  const sx = side === "right" ? 1 : -1;
  // top
  const top = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= 1; j++) {
    const u = us[i], z = -D / 2 + j * D;
    pos.push(sx * u, pageHeight(u), z);
    uv.push(side === "right" ? u / W : 1 - u / W, 1 - (z + D / 2) / D);
  }
  for (let i = 0; i < nu; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (side === "right") idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
  }
  top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  top.setIndex(idx);
  top.computeVertexNormals();
  // edges: front, back (follow the curve) and the fore-edge
  const ep = [], es = [], ei = [];
  const SHEETS = 120;
  const quad = (a, b, c, d, sa, sb, sc, sd) => {
    const base = ep.length / 3;
    ep.push(...a, ...b, ...c, ...d); es.push(sa, sb, sc, sd);
    ei.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  for (const zs of [-1, 1]) {
    const z = zs * D / 2;
    for (let i = 0; i < nu; i++) {
      const u0 = us[i], u1 = us[i + 1];
      const A = [sx * u0, y0, z], B = [sx * u1, y0, z], C = [sx * u0, pageHeight(u0), z], Dd = [sx * u1, pageHeight(u1), z];
      if ((zs > 0) === (side === "right")) quad(A, B, C, Dd, 0, 0, SHEETS, SHEETS); else quad(B, A, Dd, C, 0, 0, SHEETS, SHEETS);
    }
  }
  const fe = [sx * W, y0, -D / 2], fe2 = [sx * W, y0, D / 2], fe3 = [sx * W, BOOK.Y, -D / 2], fe4 = [sx * W, BOOK.Y, D / 2];
  if (side === "right") quad(fe2, fe, fe4, fe3, 0, 0, SHEETS, SHEETS); else quad(fe, fe2, fe3, fe4, 0, 0, SHEETS, SHEETS);
  const edge = new THREE.BufferGeometry();
  edge.setAttribute("position", new THREE.Float32BufferAttribute(ep, 3));
  edge.setAttribute("aSheet", new THREE.Float32BufferAttribute(es, 1));
  edge.setIndex(ei);
  edge.computeVertexNormals();
  return { top, edge };
}

// ---- text helpers (page millimetres) ----
function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function para(g, text, x, y, maxW, size, lh, { font = SERIF, style = "", weight = 400, color = INK } = {}) {
  g.font = `${style} ${weight} ${size}px ${font}`;
  g.fillStyle = color;
  const lines = wrap(g, text, maxW);
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}
function caps(g, text, x, y, size, color = ACCENT, spacing = 0.32) {
  g.font = `600 ${size}px ${SERIF}`;
  g.fillStyle = color;
  let cx = x;
  for (const ch of text.toUpperCase()) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + size * spacing; }
  return cx;
}
// a hand-drawn tick or cross, in page millimetres
function penPath(g, pts, w = 0.45, color = INK) {
  g.save();
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  g.lineTo(...pts[pts.length - 1]);
  g.stroke(); g.restore();
}

export const OPTIONS = [
  { id: "A", text: "A circle: heat spreads the same way in every direction." },
  { id: "B", text: "An ellipse, longest along the crystal’s c axis." },
  { id: "C", text: "An ellipse, longest across the c axis." },
];
export const ANSWER = "B";

export const LEFT = {
  options: OPTIONS.map((o, i) => ({ ...o, rect: [18, 108 + i * 8.2, 182, 114.5 + i * 8.2] })),
  flap: [18, 202, 176, 240],
  chart: [18, 142, 176, 196],
};
export const RIGHT = { stamp: [165, 222], challenge: [18, 206, 182, 240] };

export class Book {
  constructor({ renderer, spill }) {
    this.group = new THREE.Group();
    this.spill = spill;
    const { W, D, BASE, BOARD } = BOOK;

    // desk and mat
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.82 }));
    desk.rotation.x = -Math.PI / 2;
    desk.receiveShadow = true;
    this.group.add(desk);
    const shape = new THREE.Shape();
    const mw = 620, md = 420, mr = 18;
    shape.moveTo(-mw / 2 + mr, -md / 2);
    shape.lineTo(mw / 2 - mr, -md / 2); shape.quadraticCurveTo(mw / 2, -md / 2, mw / 2, -md / 2 + mr);
    shape.lineTo(mw / 2, md / 2 - mr); shape.quadraticCurveTo(mw / 2, md / 2, mw / 2 - mr, md / 2);
    shape.lineTo(-mw / 2 + mr, md / 2); shape.quadraticCurveTo(-mw / 2, md / 2, -mw / 2, md / 2 - mr);
    shape.lineTo(-mw / 2, -md / 2 + mr); shape.quadraticCurveTo(-mw / 2, -md / 2, -mw / 2 + mr, -md / 2);
    const matGeo = new THREE.ExtrudeGeometry(shape, { depth: BASE, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.6, bevelSegments: 2 });
    matGeo.rotateX(-Math.PI / 2);
    const deskMat = new THREE.Mesh(matGeo, new THREE.MeshStandardMaterial({ color: "#8fa79e", roughness: 0.97, normalMap: fibreNormal(256, 4), normalScale: new THREE.Vector2(0.35, 0.35) }));
    deskMat.receiveShadow = true;
    this.group.add(deskMat);

    // cloth boards and spine
    const cloth = new THREE.MeshStandardMaterial({ color: "#243a63", roughness: 0.96, normalMap: fibreNormal(256, 21), normalScale: new THREE.Vector2(0.6, 0.6) });
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W + 6, BOARD, D + 9), cloth);
      b.position.set(sx * (W / 2 + 4), BASE + BOARD / 2, 0);
      b.castShadow = true; b.receiveShadow = true;
      this.group.add(b);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(14, BOARD - 0.6, D + 9), cloth);
    spine.position.set(0, BASE + (BOARD - 0.6) / 2, 0);
    this.group.add(spine);

    // pages
    this.normal = fibreNormal();
    this.canvases = {};
    this.textures = {};
    this.mats = {};
    this.meshes = {};
    const edgeMat = edgeMaterial();
    for (const side of ["left", "right"]) {
      const c = document.createElement("canvas");
      c.width = W * PX; c.height = D * PX;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      const m = pageMaterial(t, this.normal, spill);
      const { top, edge } = blockGeometry(side);
      const page = new THREE.Mesh(top, m);
      page.receiveShadow = true;
      page.userData.page = side;
      this.group.add(page);
      const e = new THREE.Mesh(edge, edgeMat);
      e.receiveShadow = true; e.castShadow = true;
      this.group.add(e);
      this.canvases[side] = c; this.textures[side] = t; this.mats[side] = m; this.meshes[side] = page;
    }
    this.state = { predict: null, flapOpen: false, flapSeen: false, stamp: false };

    // the chart sits on the left page as its own small printed plate, redrawn live
    const [cx0, cy0, cx1, cy1] = LEFT.chart;
    this.chartCanvas = document.createElement("canvas");
    this.chartCanvas.width = Math.round((cx1 - cx0) * PX);
    this.chartCanvas.height = Math.round((cy1 - cy0) * PX);
    this.chartTex = new THREE.CanvasTexture(this.chartCanvas);
    this.chartTex.colorSpace = THREE.SRGBColorSpace;
    this.chartTex.anisotropy = 8;
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(cx1 - cx0, cy1 - cy0), new THREE.MeshStandardMaterial({ map: this.chartTex, transparent: true, roughness: 0.93, depthWrite: false }));
    chart.rotation.x = -Math.PI / 2;
    chart.position.copy(pageToWorld("left", (cx0 + cx1) / 2, (cy0 + cy1) / 2, 0.03));
    chart.receiveShadow = true;
    chart.renderOrder = 1;
    this.group.add(chart);
    this.trail = [];

    // the flap: a paper card hinged at its top edge
    const [fx0, fy0, fx1, fy1] = LEFT.flap;
    const fc = document.createElement("canvas");
    fc.width = Math.round((fx1 - fx0) * PX); fc.height = Math.round((fy1 - fy0) * PX);
    this.flapCanvas = fc;
    const ft = new THREE.CanvasTexture(fc);
    ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 8;
    this.flapTex = ft;
    const flapPaper = new THREE.MeshStandardMaterial({ color: "#efe5cf", roughness: 0.92 });
    const flapFace = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.92, normalMap: this.normal, normalScale: new THREE.Vector2(0.25, 0.25) });
    const bc = document.createElement("canvas");
    bc.width = fc.width; bc.height = fc.height;
    this.flapBackCanvas = bc;
    const bt = new THREE.CanvasTexture(bc);
    bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 8;
    this.flapBackTex = bt;
    const flapBack = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92, normalMap: this.normal, normalScale: new THREE.Vector2(0.25, 0.25) });
    const flap = new THREE.Mesh(new THREE.BoxGeometry(fx1 - fx0, 0.35, fy1 - fy0), [flapPaper, flapPaper, flapFace, flapBack, flapPaper, flapPaper]);
    flap.position.set(0, 0.18, (fy1 - fy0) / 2);
    flap.castShadow = true; flap.receiveShadow = true;
    flap.userData.flap = true;
    this.flapPivot = new THREE.Group();
    this.flapPivot.position.copy(pageToWorld("left", (fx0 + fx1) / 2, fy0, 0.05));
    this.flapPivot.add(flap);
    this.flapMesh = flap;
    this.group.add(this.flapPivot);
    this.flapAngle = 0;

    // the stamp, pressed onto the right page when the challenge is met
    const sc = document.createElement("canvas");
    sc.width = sc.height = 512;
    this.stampCanvas = sc;
    const st = new THREE.CanvasTexture(sc);
    st.colorSpace = THREE.SRGBColorSpace;
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.95, depthWrite: false, opacity: 0 }));
    stamp.rotation.x = -Math.PI / 2;
    stamp.rotation.z = 0.18;
    stamp.position.copy(pageToWorld("right", RIGHT.stamp[0], RIGHT.stamp[1], 0.06));
    stamp.renderOrder = 1;
    this.stampMesh = stamp;
    this.stampPress = 0;
    this.group.add(stamp);
  }

  // ---- print ----
  drawLeft() {
    const c = this.canvases.left, g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#fbf8f0"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.textBaseline = "alphabetic";
    caps(g, "Transport phenomena · Lesson 2", 18, 20, 2.7);
    g.font = `600 11px ${SERIF}`; g.fillStyle = INK; g.fillText("Sénarmont’s", 18, 34);
    const w = g.measureText("Sénarmont’s ").width;
    g.font = `italic 400 11px ${SERIF}`; g.fillStyle = ACCENT; g.fillText("plate", 18 + w, 34);
    para(g, "Does heat care which way it travels?", 18, 42, 164, 4.4, 5, { style: "italic", color: INK2 });
    let y = para(g, "In 1847 Henri de Sénarmont coated thin crystal plates in wax and touched a hot wire to the centre. Where the plate passed the wax’s melting point, the wax ran clear, so the melt front traced an isotherm. Inside a crystal the conductivity can depend on direction, and Fourier’s law becomes a tensor law:", 18, 51, 164, 3.5, 5.15);
    y += 2;
    g.strokeStyle = "rgba(28,36,51,0.35)"; g.lineWidth = 0.18;
    g.beginPath(); g.moveTo(18, y); g.lineTo(182, y); g.stroke();
    g.font = `italic 400 7.4px ${SERIF}`; g.fillStyle = INK;
    g.fillText("q = −K ∇T", 22, y + 9.5);
    g.font = `400 2.8px ${SERIF}`; g.fillStyle = INK2;
    g.fillText("K = diag(k₁, k₂) in the crystal’s own axes", 80, y + 6);
    g.fillText("isotherms: ellipses with a / b = √(k₁ / k₂)", 80, y + 10.4);
    g.beginPath(); g.moveTo(18, y + 13.5); g.lineTo(182, y + 13.5); g.stroke();
    const pe = caps(g, "1 · Predict", 18, 102.5, 2.7);
    para(g, "A quartz plate cut along its c axis: what shape will the melt take?", pe + 2.5, 102.5, 182 - pe - 2.5, 3.3, 4.6, { style: "italic", color: INK2 });
    for (const o of LEFT.options) {
      const [x0, y0] = o.rect;
      g.strokeStyle = INK; g.lineWidth = 0.28;
      g.strokeRect(x0 + 0.6, y0 + 0.4, 3.8, 3.8);
      g.font = `600 3.2px ${SERIF}`; g.fillStyle = INK; g.fillText(o.id, x0 + 6.4, y0 + 3.7);
      para(g, o.text, x0 + 11, y0 + 3.7, 160, 3.35, 4.6);
      if (this.state.predict === o.id) penPath(g, [[x0 + 0.9, y0 + 2.3], [x0 + 2.1, y0 + 3.9], [x0 + 5.4, y0 - 1.1]], 0.55, HEAT);
    }
    g.font = `italic 400 2.9px ${SERIF}`; g.fillStyle = INK2;
    g.fillText("Fig. 2  The melt front, traced from the plate in the crystal’s own axes.", 18, 140);
    const [fx0, fy0, fx1] = LEFT.flap;
    caps(g, "Why", fx0 + 3, fy0 + 6, 2.6);
    let ay = para(g, "B. Quartz carries heat faster along its c axis (10.4 W/m·K) than across it (6.21). In the same time the 62 °C isotherm reaches further along c, so the wax melts in an ellipse with its long axis on c, in the ratio √(10.4 ÷ 6.21) ≈ 1.29. Sénarmont measured 1.31.", fx0 + 3, fy0 + 11, fx1 - fx0 - 6, 3.2, 4.45);
    if (this.state.predict && this.state.flapSeen) {
      const right = this.state.predict === ANSWER;
      g.font = `600 4.6px ${HAND}`; g.fillStyle = HEAT;
      g.fillText(right ? `You ticked ${this.state.predict}: right.` : `You ticked ${this.state.predict}: look again at k₁ and k₂.`, fx0 + 3, Math.min(ay + 2.2, fy0 + 37));
    }
    para(g, "The model: finite volumes on a 121 × 121 grid of a 0.3 mm plate, 40 mm across, losing heat from both faces to still air (h = 12 W/m²·K). Quartz values from the TPRC data (Touloukian et al.). H. de Sénarmont (1847), Ann. Chim. Phys. 21, 457.", 18, 247, 164, 2.35, 3.2, { color: INK2 });
    g.font = `400 2.6px ${SERIF}`; g.fillStyle = INK2; g.fillText("4", 18, 256);
    this.textures.left.needsUpdate = true;
  }

  drawRight(frameMx, hingeMy) {
    const c = this.canvases.right, g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#fbf8f0"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.font = `italic 400 2.7px ${SERIF}`; g.fillStyle = INK2;
    g.textAlign = "right"; g.fillText("Sénarmont’s plate", 182, 16); g.textAlign = "left";
    para(g, "Fig. 1  Sénarmont’s experiment on a bench: a waxed crystal plate on a turning stage, a stylus held at a set temperature at its centre, and a control box that reads the tip. The plate is drawn 1.5 times its 40 mm size. The arrow on the base is the bench’s x axis.", 18, hingeMy + 9, 164, 3.0, 4.2, { style: "italic", color: INK2 });
    const te = caps(g, "2 · Try", 18, 196, 2.7);
    para(g, "Pick a plate on the bench card, press Fresh wax, and turn the stage by its grip. Watch which way the melt grows.", te + 2.5, 196, 182 - te - 2.5, 3.2, 4.4);
    const [x0, y0, x1, y1] = RIGHT.challenge;
    g.strokeStyle = "rgba(28,36,51,0.55)"; g.lineWidth = 0.22;
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    caps(g, "3 · Challenge", x0 + 4, y0 + 7, 2.7);
    para(g, "On the Y-cut plate, line the melt’s long axis up with the arrow on the base.", x0 + 4, y0 + 14, 120, 3.6, 4.8, { weight: 600 });
    para(g, "Hint: does the ellipse belong to the room or to the crystal?", x0 + 4, y0 + 27, 120, 3.1, 4.3, { style: "italic", color: INK2 });
    g.setLineDash([1.2, 1.2]);
    g.beginPath(); g.arc(RIGHT.stamp[0], RIGHT.stamp[1], 12.5, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.font = `400 2.6px ${SERIF}`; g.fillStyle = INK2; g.textAlign = "right"; g.fillText("5", 182, 256); g.textAlign = "left";
    this.textures.right.needsUpdate = true;
  }

  drawFlap() {
    const c = this.flapCanvas, g = c.getContext("2d");
    const [fx0, fy0, fx1, fy1] = LEFT.flap;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#f1e7d0"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.strokeStyle = "rgba(28,36,51,0.5)"; g.lineWidth = 0.22;
    g.strokeRect(1.4, 1.4, fx1 - fx0 - 2.8, fy1 - fy0 - 2.8);
    caps(g, "Why?", 6, 10, 2.9);
    g.font = `600 5.2px ${SERIF}`; g.fillStyle = INK; g.fillText("Lift the flap to see the answer", 6, 20);
    g.font = `italic 400 3.4px ${SERIF}`; g.fillStyle = INK2; g.fillText("after you have made your prediction", 6, 26.5);
    g.font = `600 4.6px ${HAND}`; g.fillStyle = INK; g.fillText("lift here", fx1 - fx0 - 30, 9.5);
    penPath(g, [[fx1 - fx0 - 26, 13], [fx1 - fx0 - 20, 22], [fx1 - fx0 - 12, 30]], 0.32);
    penPath(g, [[fx1 - fx0 - 15.5, 29.2], [fx1 - fx0 - 12, 30], [fx1 - fx0 - 12.2, 26.4]], 0.32);
    this.flapTex.needsUpdate = true;
  }

  drawFlapBack() {
    const c = this.flapBackCanvas, g = c.getContext("2d");
    const [fx0, fy0, fx1, fy1] = LEFT.flap;
    const w = fx1 - fx0, h = fy1 - fy0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#ece2ca"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.strokeStyle = "rgba(28,36,51,0.4)"; g.lineWidth = 0.2;
    g.strokeRect(1.4, 1.4, w - 2.8, h - 2.8);
    caps(g, "Why a tensor, not a number", 6, 8.5, 2.5);
    para(g, "In the crystal’s own axes K is diagonal. Turn the plate and the bench’s axes no longer match the crystal’s: K picks up off-diagonal terms, and a gradient along x drives some heat along y. The ellipse turns with the crystal; the physics stays put.", 6, 14.5, w - 12, 3.0, 4.15);
    g.font = `600 3.9px ${HAND}`; g.fillStyle = INK2;
    g.fillText("tap the flap to close it and see Fig. 2 again", 6, h - 4);
    this.flapBackTex.needsUpdate = true;
  }

  drawStamp() {
    const g = this.stampCanvas.getContext("2d");
    g.clearRect(0, 0, 512, 512);
    g.save();
    g.translate(256, 256);
    g.strokeStyle = "rgba(154,59,42,0.9)"; g.fillStyle = "rgba(154,59,42,0.9)";
    g.lineWidth = 14; g.beginPath(); g.arc(0, 0, 232, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 196, 0, Math.PI * 2); g.stroke();
    g.font = `600 44px ${SERIF}`;
    const text = "SÉNARMONT · 1847 · TENSOR · ";
    for (let i = 0; i < text.length; i++) {
      g.save(); g.rotate((i / text.length) * Math.PI * 2 - Math.PI / 2); g.translate(0, -204); g.fillText(text[i], -12, 0); g.restore();
    }
    g.font = `600 64px ${HAND}`; g.textAlign = "center";
    g.fillText("aligned", 0, -18);
    g.font = `600 50px ${SERIF}`;
    g.fillText("K diagonal", 0, 52);
    g.restore();
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    g.globalCompositeOperation = "source-over";
    this.stampMesh.material.map.needsUpdate = true;
  }

  // the live chart: the melt front in the crystal's axes, against the ellipse √(k₁/k₂) predicts
  drawChart(R) {
    const c = this.chartCanvas, g = c.getContext("2d");
    const [cx0, cy0, cx1, cy1] = LEFT.chart;
    const Wm = cx1 - cx0, Hm = cy1 - cy0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#fbf8f0"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    const ox = 27, oy = Hm / 2 - 0.5, k = 1.15; // plot centre and mm of chart per real mm
    const P = (xr, yr) => [ox + xr * 1e3 * k, oy - yr * 1e3 * k];
    // the plate's outline, faint, with its flat
    g.strokeStyle = "rgba(28,36,51,0.35)"; g.lineWidth = 0.2;
    const a0 = Math.asin(-18 / 20);
    g.beginPath();
    for (let i = 0; i <= 80; i++) { const t = a0 + (Math.PI - 2 * a0) * (i / 80); const [x, y] = P(0.02 * Math.cos(t), 0.02 * Math.sin(t)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
    // axes
    g.strokeStyle = "rgba(28,36,51,0.5)"; g.lineWidth = 0.18;
    g.beginPath(); g.moveTo(ox - 25, oy); g.lineTo(ox + 25, oy); g.moveTo(ox, oy - 24); g.lineTo(ox, oy + 24); g.stroke();
    for (const r of [5, 10, 15]) { g.beginPath(); g.arc(ox, oy, r * k, 0, Math.PI * 2); g.strokeStyle = "rgba(28,36,51,0.1)"; g.stroke(); }
    g.font = `italic 400 2.5px ${SERIF}`; g.fillStyle = INK2;
    g.fillText("axis 1", ox + 18.5, oy - 1.2);
    g.fillText("axis 2", ox + 1.2, oy - 22.4);
    g.fillText("5 mm", ox + 5 * k + 0.4, oy + 3);
    if (R && R.front && R.a > 0) {
      // theory: an ellipse through the measured a with a / b = √(k₁ / k₂)
      const ratio = Math.sqrt(R.k1 / R.k2), bt = R.a / ratio;
      g.setLineDash([0.9, 0.9]); g.strokeStyle = INK; g.lineWidth = 0.28;
      g.beginPath(); g.ellipse(ox, oy, R.a * 1e3 * k, bt * 1e3 * k, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      // the measured front
      g.beginPath();
      R.front.forEach((r, i) => { const t = (i / R.front.length) * Math.PI * 2; const [x, y] = P(r * Math.cos(t), r * Math.sin(t)); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath();
      g.fillStyle = "rgba(255,122,28,0.18)"; g.fill();
      g.strokeStyle = HEAT; g.lineWidth = 0.42; g.stroke();
    }
    // the numbers beside it
    const tx = 60;
    g.font = `italic 400 2.9px ${SERIF}`; g.fillStyle = INK2;
    g.fillText("melt front along axis 1, a, and across it, b", tx, 8);
    if (R && R.a > 0) {
      g.font = `600 7px ${HAND}`; g.fillStyle = HEAT;
      g.fillText(`${(R.a * 1e3).toFixed(1)} × ${(R.b * 1e3).toFixed(1)} mm`, tx, 17);
      g.font = `400 3.1px ${SERIF}`; g.fillStyle = INK;
      g.fillText(`a / b measured   ${(R.a / R.b).toFixed(2)}`, tx, 25);
      g.fillText(`√(k₁ / k₂)          ${Math.sqrt(R.k1 / R.k2).toFixed(2)}`, tx, 30);
    } else {
      g.font = `600 5.4px ${HAND}`; g.fillStyle = INK2;
      g.fillText(R && R.on ? "warming… no melt yet" : "stylus lifted", tx, 17);
      g.font = `400 3.1px ${SERIF}`; g.fillStyle = INK;
      g.fillText(`√(k₁ / k₂)          ${R ? Math.sqrt(R.k1 / R.k2).toFixed(2) : "–"}`, tx, 30);
    }
    g.font = `italic 400 2.6px ${SERIF}`; g.fillStyle = INK2;
    g.fillText("solid: traced from the solver · dashed: the ellipse √(k₁/k₂) predicts", tx, 38);
    g.fillText("near steady state the insulated rim stretches it a little", tx, 42);
    if (R) {
      g.fillText(`${R.label} · k₁ ${R.k1.toFixed(2)} · k₂ ${R.k2.toFixed(2)} W/m·K`, tx, 48);
    }
    this.chartTex.needsUpdate = true;
  }

  // which printed thing (if any) is at this page point
  hitAt(side, mx, my) {
    if (side !== "left") return null;
    for (const o of LEFT.options) {
      const [x0, y0, x1, y1] = o.rect;
      if (mx >= x0 && mx <= x1 && my >= y0 - 0.5 && my <= y1) return { kind: "predict", id: o.id };
    }
    const [fx0, fy0, fx1, fy1] = LEFT.flap;
    if (!this.state.flapOpen && mx >= fx0 && mx <= fx1 && my >= fy0 && my <= fy1) return { kind: "flap" };
    const [cx0, cy0, cx1, cy1] = LEFT.chart;
    if (this.state.flapOpen && mx >= cx0 && mx <= cx1 && my >= cy0 - 10 && my <= fy0) return { kind: "flap" };
    return null;
  }

  update(dt) {
    const target = this.state.flapOpen ? -2.93 : 0;
    this.flapAngle += (target - this.flapAngle) * Math.min(1, dt * 5);
    this.flapPivot.rotation.x = this.flapAngle;
    if (this.state.stamp) {
      this.stampPress = Math.min(1, this.stampPress + dt * 2.4);
      const k = this.stampPress, e = 1 - Math.pow(1 - k, 3);
      this.stampMesh.material.opacity = Math.min(1, k * 1.6);
      this.stampMesh.scale.setScalar(1.35 - 0.35 * e);
    }
  }
}
