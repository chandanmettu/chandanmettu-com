import * as THREE from "three";

// Things that flow (gas, hot blast, burden) as glowing beads moving along paths in figure space.
// The beads glow, so they bloom; the pipes they run in are drawn as glass, so they show.

const VERT = /* glsl */ `
uniform vec2 uRes;
attribute vec3 aColor;
attribute float aAlpha, aSize;
varying vec3 vColor; varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * 0.5 * uRes.y * projectionMatrix[1][1] / gl_Position.w, 1.5, 28.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vAlpha;
  if (a < 0.004) discard;
  vec3 c = mix(vColor, vec3(1.0), 0.45 * (1.0 - smoothstep(0.0, 0.45, d)));
  gl_FragColor = vec4(c * a * 1.25, a);
}`;

export class Flow {
  constructor({ figure }) {
    this.fig = figure;
    this.paths = [];
    this.points = null;
    this.t = 0;
  }

  // grad: three colours along the path (start, middle, end), so a bead can cool as it travels;
  // shrink: its size at the end as a share of its size at the start
  add(points, { color, count = 10, speed = 30, size = 3, group = "main", clip = false, tension = 0.3, closed = false, grad = null, shrink = 1 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()), closed, "catmullrom", tension);
    const len = curve.getLength();
    // a table of points so a bead's position is a cheap lookup
    const N = Math.max(16, Math.round(len / 1.5));
    const table = curve.getSpacedPoints(N);
    const p = { curve, len, table, N, color: new THREE.Color(color), count, speed, size, group, clip, closed, offset: Math.random(), grad: grad && grad.map((c) => new THREE.Color(c)), shrink };
    this.paths.push(p);
    return p;
  }

  build() {
    const n = this.paths.reduce((s, p) => s + p.count, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    let i = 0;
    for (const p of this.paths) {
      p.first = i;
      p.base = [];
      for (let k = 0; k < p.count; k++, i++) {
        geo.attributes.aColor.setXYZ(i, p.color.r, p.color.g, p.color.b);
        p.base.push(p.size * (0.8 + 0.4 * ((k * 0.618) % 1)));
        geo.attributes.aSize.setX(i, p.base[k]);
      }
    }
    this.dyn = this.paths.some((p) => p.grad || p.shrink !== 1);
    this._c = new THREE.Color();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uRes: this.fig.pen.uRes },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, premultipliedAlpha: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.points.userData.glow = true;
    this.points.layers.enable(3);
    this.fig.group.add(this.points);
  }

  // on: { group: 0..1 }; alpha: the figure's surface fade; clipZ: beads in front of the knife hide
  update(dt, on, alpha = 1, clipZ = 1e9) {
    if (!this.points) this.build();
    this.t += dt;
    const P = this.points.geometry.attributes.position, A = this.points.geometry.attributes.aAlpha;
    for (const p of this.paths) {
      const g = (on[p.group] ?? 0) * alpha;
      for (let k = 0; k < p.count; k++) {
        const i = p.first + k;
        if (g <= 0.001) { A.setX(i, 0); continue; }
        let s = (p.offset + k / p.count + (this.t * p.speed) / p.len) % 1;
        const f = s * p.N, j = Math.floor(f), u = f - j;
        const a = p.table[j], b = p.table[Math.min(p.N, j + 1)];
        const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, z = a.z + (b.z - a.z) * u;
        P.setXYZ(i, x, y, z);
        const ends = p.closed ? 1 : Math.min(1, s / 0.06, (1 - s) / 0.06);
        A.setX(i, p.clip && z > clipZ ? 0 : g * ends * 0.95);
        if (p.grad) {
          const c = this._c, G = p.grad;
          if (s < 0.5) c.copy(G[0]).lerp(G[1], s * 2); else c.copy(G[1]).lerp(G[2], (s - 0.5) * 2);
          this.points.geometry.attributes.aColor.setXYZ(i, c.r, c.g, c.b);
        }
        if (p.shrink !== 1) this.points.geometry.attributes.aSize.setX(i, p.base[k] * (1 + (p.shrink - 1) * s));
      }
    }
    P.needsUpdate = true; A.needsUpdate = true;
    if (this.dyn) { this.points.geometry.attributes.aColor.needsUpdate = true; this.points.geometry.attributes.aSize.needsUpdate = true; }
  }
}
