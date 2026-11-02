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

// ---------- the top bar takes the stage's colour while it floats over it ----------
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
