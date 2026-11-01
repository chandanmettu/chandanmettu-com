// Sénarmont's plate, the truth module: ported line for line from the 13 Oct 2026 figure (the
// lab's senarmont-plate page), so the 3D lesson and the figure give the same numbers.
// A thin crystal plate (disc with a reference flat) coated in wax, heated at its centre by a
// thermostatted stylus (a soldering-iron tip) that holds the hole at Ts while it touches. Heat spreads in the plane with a conductivity tensor K, and leaves both
// faces to still air with coefficient h. Everything the figure shows reads from this module.
//
// The solver works in the crystal's own frame, where K = diag(k1, k2): axis 1 (x) is the
// reference axis marked by the flat, axis 2 (y) is across it. Turning the stage turns the
// crystal, which is a change of frame, not of physics; the lab-frame tensor is
// K_lab = R(θ) diag(k1, k2) R(θ)ᵀ and is reported, never needed by the solver.
//
// Finite volumes on a square grid, cells outside the plate inactive. Every face flux is
// k·d·ΔT (W), zero across the plate edge, so the energy balance closes to rounding.

export const PLATE = {
  R: 20e-3, // plate radius, m
  flat: 18e-3, // distance of the reference flat from the centre, m (flat runs along axis 1)
  d: 0.3e-3, // thickness, m: a thin section, so the faces lose heat as fast as the plane carries it
  hole: 0.5e-3, // drilled hole the stylus sits in, m
  source: 0.6e-3, // radius the stylus tip holds at its set temperature, m
};

export const AIR = { h: 12, T0: 22 }; // W m⁻² K⁻¹ per face (still air + radiation), °C
export const WAX = { Tm: 62, name: "beeswax" }; // melting point, °C

// Room-temperature values. Quartz from the TPRC recommended data (Touloukian et al.):
// 10.4 along c, 6.21 along a. Fused silica is the same chemistry with no lattice: isotropic.
export const MATERIALS = {
  fused: { label: "Fused silica", note: "glass · isotropic", k1: 1.38, k2: 1.38, rho: 2200, cp: 740 },
  zcut: { label: "Quartz, Z-cut", note: "plate ⊥ c · both axes are a", k1: 6.21, k2: 6.21, rho: 2650, cp: 740 },
  ycut: { label: "Quartz, Y-cut", note: "plate ∥ c · Sénarmont's plate", k1: 10.4, k2: 6.21, rho: 2650, cp: 740 },
  custom: { label: "Custom crystal", note: "set k₁ and k₂", k1: 12, k2: 3, rho: 2650, cp: 740 },
};

export function createModel({ N = 121, span = 41e-3 } = {}) {
  const dx = span / N;
  const area = dx * dx;
  const half = (N - 1) / 2;
  const active = new Uint8Array(N * N);
  const source = new Float32Array(N * N);
  let sourceCells = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i - half) * dx;
      const y = (j - half) * dx;
      const inside = Math.hypot(x, y) <= PLATE.R && y >= -PLATE.flat;
      active[j * N + i] = inside ? 1 : 0;
      if (Math.hypot(x, y) <= PLATE.source) {
        source[j * N + i] = 1;
        sourceCells++;
      }
    }
  }
  for (let c = 0; c < N * N; c++) source[c] /= sourceCells;
  const T = new Float64Array(N * N); // temperature rise above ambient, K
  const flow = new Float64Array(N * N);
  const s = {
    N, dx, span, half, active, T,
    k1: 1, k2: 1, rho: 2200, cp: 740,
    stylus: 220, on: true, // stylus set temperature, °C, and whether it touches the plate
    time: 0, energyIn: 0, energyLost: 0, power: 0,
  };
  const cellCount = active.reduce((sum, a) => sum + a, 0);
  s.plateArea = cellCount * area;

  s.setMaterial = ({ k1, k2, rho, cp }) => Object.assign(s, { k1, k2, rho, cp });

  // Largest stable explicit step, with margin.
  s.stableDt = () => {
    const capacity = s.rho * s.cp * PLATE.d * area;
    const out = 2 * (s.k1 + s.k2) * PLATE.d + 2 * AIR.h * area;
    return (0.45 * capacity) / out;
  };

  s.step = (duration) => {
    const limit = s.stableDt();
    const steps = Math.max(1, Math.ceil(duration / limit));
    const dt = duration / steps;
    const capacity = s.rho * s.cp * PLATE.d * area;
    const gx = s.k1 * PLATE.d; // W/K per face (dy/dx = 1)
    const gy = s.k2 * PLATE.d;
    const loss = 2 * AIR.h * area;
    const held = s.stylus - AIR.T0;
    for (let n = 0; n < steps; n++) {
      flow.fill(0);
      let lost = 0;
      for (let j = 0; j < N; j++) {
        const row = j * N;
        for (let i = 0; i < N; i++) {
          const c = row + i;
          if (!active[c]) continue;
          const t = T[c];
          if (i + 1 < N && active[c + 1]) {
            const f = gx * (T[c + 1] - t);
            flow[c] += f;
            flow[c + 1] -= f;
          }
          if (j + 1 < N && active[c + N]) {
            const f = gy * (T[c + N] - t);
            flow[c] += f;
            flow[c + N] -= f;
          }
          const l = loss * t;
          flow[c] -= l;
          lost += l;
        }
      }
      let delivered = 0;
      for (let c = 0; c < N * N; c++) {
        if (!active[c]) continue;
        T[c] += (dt * flow[c]) / capacity;
        if (s.on && source[c] > 0) {
          delivered += (held - T[c]) * capacity; // the stylus supplies exactly what holds its cells at Ts
          T[c] = held;
        }
      }
      s.energyIn += delivered;
      s.power = delivered / dt;
      s.energyLost += lost * dt;
      s.time += dt;
    }
    return steps;
  };

  s.reset = () => {
    T.fill(0);
    s.time = 0;
    s.energyIn = 0;
    s.energyLost = 0;
    s.power = 0;
  };

  s.stored = () => {
    let sum = 0;
    for (let c = 0; c < N * N; c++) if (active[c]) sum += T[c];
    return sum * s.rho * s.cp * PLATE.d * area;
  };

  // Bilinear temperature rise at a crystal-frame point (m). Inactive neighbours are skipped.
  s.sample = (x, y) => {
    const fi = x / dx + half;
    const fj = y / dx + half;
    const i0 = Math.max(0, Math.min(N - 2, Math.floor(fi)));
    const j0 = Math.max(0, Math.min(N - 2, Math.floor(fj)));
    const u = Math.min(1, Math.max(0, fi - i0));
    const v = Math.min(1, Math.max(0, fj - j0));
    let sum = 0, weight = 0;
    const take = (i, j, w) => {
      const c = j * N + i;
      if (active[c] && w > 0) { sum += T[c] * w; weight += w; }
    };
    take(i0, j0, (1 - u) * (1 - v));
    take(i0 + 1, j0, u * (1 - v));
    take(i0, j0 + 1, (1 - u) * v);
    take(i0 + 1, j0 + 1, u * v);
    return weight > 0 ? sum / weight : 0;
  };

  // Gradient (K/m) and heat flux (W/m²) in the crystal frame at a point.
  s.probe = (x, y) => {
    const e = dx * 0.75;
    const gx = (s.sample(x + e, y) - s.sample(x - e, y)) / (2 * e);
    const gy = (s.sample(x, y + e) - s.sample(x, y - e)) / (2 * e);
    return { T: s.sample(x, y), grad: [gx, gy], flux: [-s.k1 * gx, -s.k2 * gy] };
  };

  // Mean temperature rise under the stylus.
  s.tip = () => {
    let sum = 0;
    for (let c = 0; c < N * N; c++) sum += T[c] * source[c];
    return sum;
  };

  // Where the wax melt front crosses a ray from the centre (crystal-frame angle), m, or 0.
  s.frontAt = (angle, rise = WAX.Tm - AIR.T0) => {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    const stepLength = dx * 0.25;
    let previous = s.sample(0, 0);
    if (previous < rise) return 0;
    for (let r = stepLength; r < PLATE.R; r += stepLength) {
      const x = cx * r, y = cy * r;
      if (y < -PLATE.flat) return r;
      const t = s.sample(x, y);
      if (t < rise) return r - stepLength * ((rise - t) / (previous - t));
      previous = t;
    }
    return PLATE.R;
  };

  return s;
}

// The lab-frame tensor for a crystal turned by θ (radians, anticlockwise seen from above).
export function labTensor(k1, k2, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    xx: k1 * c * c + k2 * s * s,
    yy: k1 * s * s + k2 * c * c,
    xy: (k1 - k2) * c * s,
  };
}

// Angle between q and −∇T for an unbounded plate at crystal angle φ from axis 1.
// T depends on xᵀK⁻¹x only, so −∇T ∝ K⁻¹x while q = −K∇T ∝ x: the flux is radial.
export function skewAt(k1, k2, phi) {
  const g = Math.atan2(Math.sin(phi) / k2, Math.cos(phi) / k1);
  let d = g - phi;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// The melt front along both crystal axes, in metres: a along axis 1 (the flat), b across it.
export function frontsOf(model) {
  const a = (model.frontAt(0) + model.frontAt(Math.PI)) / 2;
  const b = (model.frontAt(Math.PI / 2) + model.frontAt(-Math.PI / 2)) / 2;
  return { a, b };
}
