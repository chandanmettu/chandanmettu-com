// Cards that move out of the molecule's way: drag by the header (kept inside the window, position remembered),
// collapse to a titled pill and back, double-click the header to reset. hideAll() clears every card for a clean
// view (H). Storage is a convenience: every read and write is wrapped, and the page works without it.
const KEY = "lipase-3d:ui:v2";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { saved = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage off */ } };
const cards = new Map();

export function makeCard(el, id, { title = "" } = {}) {
  const head = el.querySelector(".card-head");
  const btn = el.querySelector(".card-min");
  const pill = el.querySelector(".card-pill");
  const st = saved[id] || {};
  const place = () => {
    const s = saved[id];
    if (s && Number.isFinite(s.x)) {
      const r = el.getBoundingClientRect();
      const x = Math.max(6, Math.min(innerWidth - Math.min(r.width, innerWidth - 12) - 6, s.x));
      const y = Math.max(6, Math.min(innerHeight - Math.min(r.height || 40, innerHeight - 12) - 6, s.y));
      el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.right = "auto"; el.style.bottom = "auto";
      el.classList.add("moved");
    } else { el.style.left = el.style.top = el.style.right = el.style.bottom = ""; el.classList.remove("moved"); }
  };
  const setCollapsed = (c) => {
    el.classList.toggle("collapsed", c);
    btn?.setAttribute("aria-expanded", String(!c));
    btn && (btn.title = c ? "Expand" : "Collapse");
    saved[id] = { ...(saved[id] || {}), collapsed: c }; save();
    requestAnimationFrame(place);
  };
  if (st.collapsed) el.classList.add("collapsed");
  btn?.addEventListener("click", (e) => { e.stopPropagation(); setCollapsed(!el.classList.contains("collapsed")); });
  pill?.addEventListener("click", () => setCollapsed(false));
  let drag = null;
  head?.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, input, select, a, [role=slider]")) return;
    const r = el.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    head.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
  });
  head?.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.moved = true;
    saved[id] = { ...(saved[id] || {}), x: e.clientX - drag.dx, y: e.clientY - drag.dy };
    place();
  });
  const end = () => { if (drag?.moved) save(); drag = null; el.classList.remove("dragging"); };
  head?.addEventListener("pointerup", end); head?.addEventListener("pointercancel", end);
  head?.addEventListener("dblclick", (e) => { if (e.target.closest("button")) return; const c = saved[id]?.collapsed; saved[id] = c ? { collapsed: c } : {}; save(); place(); });
  addEventListener("resize", place);
  requestAnimationFrame(place);
  const api = { el, id, place, setCollapsed, title };
  cards.set(id, api);
  return api;
}

export function hideAll(on) {
  document.body.classList.toggle("ui-hidden", on);
}
export const uiHidden = () => document.body.classList.contains("ui-hidden");
export function resetAll() { saved = {}; save(); for (const c of cards.values()) { c.el.classList.remove("collapsed"); c.place(); } }
