// The Lab in the browser: the cards are already in the page (build.mjs writes them); this adds
// the shelf and chip filters, re-drawing with the same templates. The list lives in the page as
// JSON, so a cached builds.json can never disagree with what is shown.

const R = await import(`./render.js${new URL(import.meta.url).search}`);
const $ = (id) => document.getElementById(id);
const data = JSON.parse($("lab-data").textContent);
const m = R.model(data);
const valid = new Set(["all", ...data.courses.map((c) => c.id)]);
let filter = new URLSearchParams(location.hash.slice(1)).get("course") || "all";
if (!valid.has(filter)) filter = "all";

function paint() {
  $("shelf").innerHTML = R.shelf(m, filter);
  $("filters").innerHTML = R.chips(m, filter);
  $("grid").innerHTML = R.grid(m, filter);
  $("shelf").querySelectorAll(".folder").forEach((f) => f.addEventListener("click", () => {
    setFilter(filter === f.dataset.course ? "all" : f.dataset.course);
    $("builds").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));
  $("filters").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.course)));
}
function setFilter(next) {
  filter = next;
  history.replaceState(null, "", next === "all" ? location.pathname : `#course=${next}`);
  paint();
}
paint();

// ---------- the hero wheel: the homepage's persona wheel, turning through every build ----------
const wheel = $("wheel");
if (wheel) {
  const cards = [...wheel.querySelectorAll(".wcard")];
  const n = cards.length;
  const stage = $("labStage"), now = $("now");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TONE = { athlete: "#325bda", educator: "#ffc75a", creator: "#fe8167", builder: "#89f35f", overview: "#bcadff" };
  const mod = (a, b) => ((a % b) + b) % b;
  let pos = 0, target = 0, frame = 0, last = 0, settled = 0, drag = null, timer = 0, hover = false;
  const gap = () => cards[0].offsetWidth * (innerWidth < 760 ? 0.7 : 0.8);
  function paint(t) {
    frame = 0;
    const dt = last ? Math.min(34, t - last) : 16.7;
    last = t;
    pos += (target - pos) * (reduced ? 1 : 1 - Math.exp(-dt / (drag ? 30 : 150)));
    if (Math.abs(target - pos) < 0.001) pos = target;
    cards.forEach((c, i) => {
      const d = mod(i - pos + n / 2, n) - n / 2;
      const p = R.pose(d);
      c.style.setProperty("--wx", p.x.toFixed(4));
      c.style.setProperty("--wy", `${p.y.toFixed(2)}px`);
      c.style.setProperty("--wr", `${p.r.toFixed(2)}deg`);
      c.style.setProperty("--ws", p.s.toFixed(4));
      c.style.setProperty("--wo", p.o.toFixed(4));
      c.style.zIndex = String(p.z);
    });
    const i = mod(Math.round(pos), n);
    if (i !== settled) settle(i);
    if (pos !== target) frame = requestAnimationFrame(paint); else last = 0;
  }
  const go = () => { if (!frame) frame = requestAnimationFrame(paint); };
  function settle(i) {
    settled = i;
    cards.forEach((c, k) => c.dataset.on = String(k === i));
    const tone = TONE[cards[i].dataset.tone] || TONE.overview;
    stage.style.setProperty("--glow", tone);
    stage.style.setProperty("--glow2", TONE[cards[mod(i + 1, n)].dataset.tone] || TONE.overview);
    now.innerHTML = R.now(m, i);
    now.classList.remove("swap"); void now.offsetWidth; now.classList.add("swap");
  }
  const turn = (k) => { target = Math.round(target) + k; go(); };
  function toIndex(i) { target += mod(i - Math.round(target) + n / 2, n) - n / 2; go(); }
  // turning by itself, a card every few seconds, until someone takes over
  function auto() { clearTimeout(timer); if (reduced) return; timer = setTimeout(() => { if (!hover && !drag && !document.hidden) turn(1); auto(); }, 3600); }
  wheel.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, start: target, moved: 0, id: e.pointerId };
    wheel.classList.add("dragging");
  });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 6) { target = drag.start - dx / gap(); go(); }
  });
  addEventListener("pointerup", () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null; wheel.classList.remove("dragging");
    if (moved > 6) { target = Math.round(target); go(); auto(); wheel.dataset.dragged = "1"; setTimeout(() => delete wheel.dataset.dragged, 0); }
  });
  // a tap on a side card brings it to the middle; a tap on the middle card opens it
  cards.forEach((c, i) => c.addEventListener("click", (e) => {
    if (wheel.dataset.dragged || drag) { e.preventDefault(); return; }
    if (i !== settled) { e.preventDefault(); toIndex(i); auto(); }
  }));
  wheel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { turn(1); auto(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { turn(-1); auto(); e.preventDefault(); }
    if (e.key === "Enter" && cards[settled].href) location.href = cards[settled].href;
  });
  $("wheelPrev")?.addEventListener("click", () => { turn(-1); auto(); });
  $("wheelNext")?.addEventListener("click", () => { turn(1); auto(); });
  // the wheel's plane leans a few degrees toward the pointer (transform only, so it stays cheap)
  const plane = $("wheelPlane");
  if (plane && !reduced && matchMedia("(hover: hover)").matches) {
    let tf = 0;
    stage.addEventListener("pointermove", (e) => {
      if (tf) return;
      tf = requestAnimationFrame(() => {
        tf = 0;
        const r = stage.getBoundingClientRect();
        const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
        plane.style.setProperty("--ty", `${(u * 7).toFixed(2)}deg`);
        plane.style.setProperty("--tx", `${(-v * 5).toFixed(2)}deg`);
      });
    });
    stage.addEventListener("pointerleave", () => { plane.style.setProperty("--ty", "0deg"); plane.style.setProperty("--tx", "0deg"); });
  }
  wheel.addEventListener("pointerenter", () => (hover = true));
  wheel.addEventListener("pointerleave", () => (hover = false));
  settle(0); go(); auto();
  window.__labWheel = { turn, toIndex, get i() { return settled; } };
}

// ---------- the top bar takes the stage's colour while it floats over it ----------
{
  const bar = document.querySelector(".page-frame > .topbar");
  const stage = $("labStage");
  if (bar && stage) {
    let tick = 0;
    const tone = () => {
      tick = 0;
      bar.classList.toggle("on-dark", stage.getBoundingClientRect().bottom > bar.getBoundingClientRect().bottom + 8);
    };
    addEventListener("scroll", () => { if (!tick) tick = requestAnimationFrame(tone); }, { passive: true });
    addEventListener("resize", tone);
    tone();
  }
}
