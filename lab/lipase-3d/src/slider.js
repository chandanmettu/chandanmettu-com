// A range slider built once and never rebuilt while it is dragged: pointer capture on the track, arrow keys,
// Page Up/Down, Home/End. The track can carry the dataset's own curve (an area in the track) and a tick at the
// optimum; the thumb carries a value bubble. onInput fires on every change; the caller updates only numbers.
export function createSlider({ name, min, max, step, value, format = (v) => String(v), curve = null, optimum = null, foot = "", onInput, id }) {
  const el = document.createElement("div");
  el.className = "sl";
  const W = 300, H = 30;
  let curveSvg = "";
  if (curve) {
    const lo = 0, hi = Math.max(...curve.y) * 1.08;
    const X = (v) => ((v - min) / (max - min)) * W, Y = (v) => H - ((v - lo) / (hi - lo)) * H;
    const pts = curve.x.map((x, i) => [X(Math.min(max, Math.max(min, x))), Y(curve.y[i])]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
    curveSvg = `<svg class="sl-curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${area}"/><path class="l" d="${line}"/></svg>`;
  }
  const optPct = optimum !== null ? ((optimum - min) / (max - min)) * 100 : null;
  el.innerHTML = `<div class="sl-head"><span class="sl-name">${name}</span><span class="sl-val"></span></div>
    <div class="sl-track" role="slider" tabindex="0" aria-label="${name}" aria-valuemin="${min}" aria-valuemax="${max}" ${id ? `id="${id}"` : ""}>
      ${curveSvg}<div class="sl-rail"><i class="sl-fill"></i></div>${optPct !== null ? `<i class="sl-opt" style="left:${optPct}%" title="optimum"></i>` : ""}
      <div class="sl-thumb"><span class="sl-bubble"></span></div>
    </div>${foot ? `<div class="sl-foot">${foot}</div>` : ""}`;
  const track = el.querySelector(".sl-track"), thumb = el.querySelector(".sl-thumb"), fill = el.querySelector(".sl-fill");
  const val = el.querySelector(".sl-val"), bubble = el.querySelector(".sl-bubble");
  let v = value, disabled = false;
  const snap = (x) => Math.min(max, Math.max(min, Math.round((x - min) / step) * step + min));
  const paint = () => {
    const pct = ((v - min) / (max - min)) * 100;
    thumb.style.left = `${pct}%`; fill.style.width = `${pct}%`;
    const t = format(v); val.textContent = t; bubble.textContent = t;
    track.setAttribute("aria-valuenow", String(v)); track.setAttribute("aria-valuetext", t);
  };
  const set = (x, fire = true) => { const n = Number(snap(x).toFixed(6)); if (n === v) return; v = n; paint(); if (fire) onInput?.(v); };
  const fromX = (cx) => { const r = track.getBoundingClientRect(); return min + ((cx - r.left) / r.width) * (max - min); };
  let dragging = false;
  track.addEventListener("pointerdown", (e) => { if (disabled) return; dragging = true; el.classList.add("drag"); track.setPointerCapture(e.pointerId); set(fromX(e.clientX)); e.preventDefault(); e.stopPropagation(); });
  track.addEventListener("pointermove", (e) => { if (dragging) set(fromX(e.clientX)); });
  const end = () => { dragging = false; el.classList.remove("drag"); };
  track.addEventListener("pointerup", end); track.addEventListener("pointercancel", end);
  track.addEventListener("keydown", (e) => {
    if (disabled) return;
    const big = (max - min) / 10;
    const k = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }[e.key];
    if (k !== undefined) { set(v + k); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "Home") { set(min); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "End") { set(max); e.preventDefault(); e.stopPropagation(); }
  });
  paint();
  return {
    el, get: () => v, set: (x) => set(x, false),
    get dragging() { return dragging; },
    disable(d) { disabled = d; el.classList.toggle("off", d); track.setAttribute("aria-disabled", String(d)); },
  };
}
