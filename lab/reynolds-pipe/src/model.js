// The flow model: one energy balance from the tank surface to the free jet, and a one-dimensional
// intermittency field for transition. Ported from the 13 Oct 2026 "Reynolds' Pipe" page so both
// versions give the same numbers. Pure: no DOM, no three.js.
//
// Dye: an unmixed thread θ(x) carried at the centreline speed, and mixed dye m(x) carried at the
// bulk speed; turbulence converts thread into mixed dye.

export const RIG = {
  D: 12.7e-3, // ½-inch glass tube, m
  L: 1.5, // tube length, m
  H: 0.5, // tank head above the tube axis, m
  Kin: 0.04, // bell-mouth entry loss
  taps: [0.3, 1.2], // piezometer tap positions from the inlet, m
  g: 9.81,
  rho: 998,
  Kv: [0.3, 3.0e4], // valve loss coefficient, fully open → nearly shut
};
export const RE_LOWER = 2000; // below this every disturbance decays
export const RE_SLUG = 2300; // above this puffs grow into slugs
export const U_MAX = 0.86; // the handwheel's last turn adds nothing worth showing

// Water viscosity (Vogel equation), Pa·s, T in °C. 1.002 mPa·s at 20 °C.
export const viscosity = (T) => 2.414e-5 * Math.pow(10, 247.8 / (T + 273.15 - 140));
// Onset Re for a tank stillness s ∈ [0, 1]: 2,000 for a stirred tank, about 13,000 for water left
// to settle for hours, as Reynolds found.
export const onsetRe = (s) => RE_LOWER * Math.pow(13000 / RE_LOWER, s);
export const valveK = (u) => RIG.Kv[0] * Math.pow(RIG.Kv[1] / RIG.Kv[0], 1 - u);
export const frictionLaminar = (Re) => 64 / Math.max(Re, 1);
export const frictionBlasius = (Re) => 0.316 * Math.pow(Math.max(Re, 1), -0.25);
export const friction = (Re, gamma) => (1 - gamma) * frictionLaminar(Re) + gamma * frictionBlasius(Re);

// Steady velocity for a valve opening, temperature and intermittency.
export function steadyVelocity(u, T, gamma) {
  const nu = viscosity(T) / RIG.rho;
  let V = 0.1;
  for (let i = 0; i < 60; i++) {
    const Re = (V * RIG.D) / nu;
    const K = 1 + RIG.Kin + friction(Re, gamma) * (RIG.L / RIG.D) + valveK(u);
    const next = Math.sqrt((2 * RIG.g * RIG.H) / K);
    if (Math.abs(next - V) < 1e-10) { V = next; break; }
    V = 0.5 * V + 0.5 * next;
  }
  return V;
}

// Piezometric head above the tube axis at distance x from the inlet, m.
export function headAt(x, V, Re, gammaUpTo) {
  const q = (V * V) / (2 * RIG.g);
  return RIG.H - (1 + RIG.Kin) * q - friction(Re, gammaUpTo) * (x / RIG.D) * q;
}

export function regimeOf(Re, gamma) {
  if (gamma > 0.6) return "turbulent";
  if (gamma > 0.04) return "transitional";
  return Re < RE_LOWER ? "laminar" : "laminar, but unstable";
}

export function createFlow({ cells = 128, seed = 7 } = {}) {
  let rng = seed >>> 0;
  const random = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  const dx = RIG.L / cells;
  const tau = new Float64Array(cells);
  const thread = new Float64Array(cells);
  const mixed = new Float64Array(cells);
  const scratch = new Float64Array(cells);
  const s = {
    cells, dx, tau, thread, mixed,
    u: 0.35, T: 20, still: 0.5, dye: true,
    V: 0, Re: 0, gamma: 0, time: 0, collected: 0,
    puffClock: 0, centre: 0,
  };
  s.V = steadyVelocity(s.u, s.T, 0);

  // Semi-Lagrangian shift of a field by a distance, with an inflow value at x = 0.
  const advect = (field, distance, inflow) => {
    const shift = distance / dx;
    for (let i = 0; i < cells; i++) {
      const from = i - shift;
      if (from <= 0) { scratch[i] = inflow; continue; }
      const i0 = Math.floor(from), f = from - i0;
      scratch[i] = i0 + 1 < cells ? field[i0] * (1 - f) + field[i0 + 1] * f : field[cells - 1];
    }
    field.set(scratch);
  };

  s.step = (dt) => {
    const nu = viscosity(s.T) / RIG.rho;
    // the flow answers the valve within a fraction of a second (tube inertia L/V-ish)
    const target = steadyVelocity(s.u, s.T, s.gamma);
    s.V += (target - s.V) * (1 - Math.exp(-dt / 0.35));
    const V = s.V;
    s.Re = (V * RIG.D) / nu;
    const Re = s.Re;
    const onset = onsetRe(s.still);
    // turbulence: advect with the puff speed, grow or decay, spread at the fronts
    advect(tau, V * dt, 0);
    const rate = Re < RE_LOWER ? -1.6 : Re < RE_SLUG ? -0.25 + 0.25 * (Re - RE_LOWER) / (RE_SLUG - RE_LOWER) : 1.4 * Math.min(1, (Re - RE_SLUG) / 2000);
    const spread = Re > RE_SLUG ? 0.04 * V * Math.min(1, (Re - RE_SLUG) / 3000) : 0;
    for (let i = 0; i < cells; i++) {
      const t = tau[i];
      const left = tau[Math.max(0, i - 1)], right = tau[Math.min(cells - 1, i + 1)];
      const lap = (left - 2 * t + right) / (dx * dx);
      tau[i] = Math.min(1, Math.max(0, t + dt * (rate * t * (rate > 0 ? 1 - t : 1) + spread * dx * lap)));
    }
    // the inlet: above onset the flow trips by itself downstream; below it, puffs come from disturbances
    if (Re >= onset) {
      const grow = 3 + 6 * Math.min(1, (Re - onset) / onset);
      tau[0] = Math.max(tau[0], 0.04);
      for (let i = 1; i < cells; i++) {
        const t = tau[i];
        tau[i] = Math.min(1, t + dt * grow * (t + 0.01) * (1 - t) * (V / 0.5));
      }
    } else if (Re > RE_LOWER * 0.92) {
      const chance = (1 - s.still) * 0.9 + 0.12;
      const lambda = chance * Math.min(1, Math.max(0, (Re - RE_LOWER * 0.92) / (onset - RE_LOWER * 0.92 + 1)));
      s.puffClock += dt * lambda * 0.9;
      if (s.puffClock > 1) {
        s.puffClock = 0;
        if (random() < 0.85) {
          const length = Math.max(2, Math.round((20 * RIG.D) / dx));
          for (let i = 0; i < length && i < cells; i++) tau[i] = Math.max(tau[i], 0.9);
        }
      }
    }
    // dye: thread rides the centreline, mixed dye rides the bulk; turbulence shreds the thread
    const centre = V * 2 * (1 - 0.6 * s.gamma);
    s.centre = centre;
    advect(thread, centre * dt, s.dye ? 1 : 0);
    advect(mixed, V * dt, 0);
    for (let i = 0; i < cells; i++) {
      const torn = thread[i] * Math.min(1, dt * 14 * tau[i] * tau[i]);
      thread[i] -= torn;
      mixed[i] += torn * 0.9;
      mixed[i] *= 1 - dt * 0.02;
    }
    let sum = 0;
    for (let i = 0; i < cells; i++) sum += tau[i];
    s.gamma = sum / cells;
    s.time += dt;
    s.collected += V * Math.PI * RIG.D * RIG.D * 0.25 * dt;
  };
  s.gammaBetween = (x0, x1) => {
    const i0 = Math.floor(x0 / dx), i1 = Math.max(i0 + 1, Math.floor(x1 / dx));
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += tau[i];
    return sum / (i1 - i0);
  };
  // the readings the page shows, all from the state above
  s.readings = () => {
    const nu = viscosity(s.T) / RIG.rho;
    const [xa, xb] = RIG.taps;
    const ha = headAt(xa, s.V, s.Re, s.gammaBetween(0, xa));
    const hb = headAt(xb, s.V, s.Re, s.gammaBetween(0, xb));
    const dh = ha - hb;
    const q = (s.V * s.V) / (2 * RIG.g);
    const fMeasured = q > 1e-9 ? (dh * RIG.D) / ((xb - xa) * q) : 0;
    return {
      Re: s.Re, V: s.V, Q: s.V * Math.PI * RIG.D * RIG.D * 0.25, nu, ha, hb, dh,
      fMeasured, fLam: frictionLaminar(s.Re), fBlasius: frictionBlasius(s.Re),
      onset: onsetRe(s.still), gamma: s.gamma, regime: regimeOf(s.Re, s.gamma),
    };
  };
  s.reset = () => { tau.fill(0); thread.fill(0); mixed.fill(0); s.gamma = 0; };
  return s;
}

// A stirred tank settles back over about 45 s of bench time (the 13 Oct page's rule).
export const stillnessAfter = (stillSet, secondsSinceStir) => stillSet * (1 - Math.exp(-secondsSinceStir / 45));

export function settledFor(s) {
  const minutes = 180 * s * s;
  if (s < 0.03) return "just stirred";
  return minutes < 60 ? `${Math.max(1, Math.round(minutes))} min` : `${(minutes / 60).toFixed(1)} h`;
}
