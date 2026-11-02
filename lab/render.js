// The Lab's markup, as pure functions of builds.json. The browser uses them to re-draw on a filter
// change (lab.js); build.mjs uses the same ones to write the cards into index.html, so search
// engines and readers without JavaScript see every build.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const STATUS = { open: "Open", soon: "On the way", sample: "Sample" };

// the featured build first, then newest first, placeholders always last
export function model(data) {
  const rank = (b) => (b.featured ? 0 : b.status === "sample" ? 2 : 1);
  const builds = [...data.builds].sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date));
  const real = builds.filter((b) => b.status !== "sample");
  const byDate = [...real].sort((a, b) => b.date.localeCompare(a.date));
  return { courses: new Map(data.courses.map((c) => [c.id, c])), list: data.courses, builds, real, newest: byDate[0], newestOpen: builds.find((b) => b.status === "open") };
}

export function stats(m) {
  const courses = new Set(m.real.map((b) => b.course));
  const d = m.newest?.date;
  return [
    `<li><strong>${m.real.length}</strong> builds</li>`,
    `<li><strong>${courses.size}</strong> ${courses.size === 1 ? "course" : "courses"}</li>`,
    d ? `<li>last added <strong>${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}</strong></li>` : "",
  ].join("");
}

// The hero, kept to a title and one picture: the newest build's render in a frame under the
// title (never behind it), with a small tag naming it.
const lead = (m) => m.newestOpen || m.real[0];
export function shot(m) {
  const b = lead(m);
  if (!b) return "";
  const c = m.courses.get(b.course) || {};
  return `<a class="shot" data-tone="${esc(c.tone)}" href="${esc(b.href)}" aria-label="${esc(b.title)}, the newest build"><img src="${esc(b.wide || b.image)}" alt="" width="1600" height="900" fetchpriority="high"><span class="now-tag"><span class="new">New</span><i class="dot"></i><strong>${esc(b.title)}</strong><span class="go" aria-hidden="true">↗</span></span></a>`;
}

// Abhyas's folder: a back panel, the builds as sheets peeking out, a frosted pocket in front
export function shelf(m, filter) {
  return m.list.map((c) => {
    const inside = m.builds.filter((b) => b.course === c.id);
    const count = inside.filter((b) => b.status !== "sample").length;
    const sheets = (inside.length ? inside : [{}]).slice(0, 3).map((b, i) => `<span class="f-sheet s${i + 1}"><span class="f-sheet-top"><i></i><small>${b.date && b.status !== "sample" ? esc(b.date.slice(0, 7).replace("-", " · ")) : "soon"}</small></span><b>${esc(b.title || "New build")}</b>${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy" width="960" height="600">` : '<span class="f-blank"></span>'}</span>`).join("");
    const year = inside.map((b) => b.date).filter(Boolean).sort().pop()?.slice(0, 4) || "";
    return `<button type="button" class="folder${c.sample ? " is-sample" : ""}${inside.length > 1 ? "" : " one"}" role="listitem" data-tone="${esc(c.tone)}" data-course="${esc(c.id)}" aria-pressed="${filter === c.id}" aria-label="${esc(c.name)}: ${count} ${count === 1 ? "build" : "builds"}"><span class="f-back"></span>${sheets}<span class="f-front"><span class="f-id"><span class="f-code">${esc(c.short)}${year && !c.sample ? " · " + year : ""}</span><strong class="f-title">${esc(c.name)}</strong><span class="f-open">${c.sample ? "Shelf waiting" : "Open shelf"} <span>→</span></span></span><span class="f-stat"><b>${count}</b><span>${count === 1 ? "build" : "builds"}</span></span></span>${m.newest && c.id === m.newest.course ? '<span class="f-sticky">new</span>' : ""}</button>`;
  }).join("");
}

export function chips(m, filter) {
  const all = `<button type="button" class="chip" data-course="all" aria-pressed="${filter === "all"}">All <em>${m.real.length}</em></button>`;
  return all + m.list.filter((c) => !c.sample).map((c) => {
    const n = m.real.filter((b) => b.course === c.id).length;
    return `<button type="button" class="chip" data-tone="${esc(c.tone)}" data-course="${esc(c.id)}" aria-pressed="${filter === c.id}"><i class="dot"></i>${esc(c.name)} <em>${n}</em></button>`;
  }).join("");
}

function card(m, b, i, filter) {
  const c = m.courses.get(b.course) || {};
  const open = b.status === "open";
  const tag = open ? "a" : "div";
  const featured = b.featured && filter === "all";
  const cls = ["build", featured ? "is-featured" : "", b.status === "soon" ? "is-soon" : "", b.status === "sample" ? "is-sample" : "", "reveal"].filter(Boolean).join(" ");
  const img = featured && b.wide ? b.wide : b.image;
  const media = img ? `<img src="${esc(img)}" alt="" ${featured ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} width="960" height="600">` : "";
  return `<${tag} class="${cls}" style="--d:${Math.min(i, 6) * 60}ms" data-tone="${esc(c.tone)}" ${open ? `href="${esc(b.href)}"` : `aria-disabled="true" title="${b.status === "soon" ? "Coming to the site soon" : "Sample entry"}"`}><span class="build-media">${media}<span class="kind">${esc(b.kind)}</span><span class="status ${esc(b.status)}">${STATUS[b.status] || ""}</span></span><span class="build-body"><span class="build-meta"><i class="dot"></i>${esc(c.name)} · ${b.status === "sample" ? "coming soon" : month(b.date)}</span><strong class="build-title">${esc(b.title)}</strong><span class="build-summary">${esc(b.summary)}</span><span class="build-tags">${(b.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</span><span class="build-go" aria-hidden="true">↗</span></span></${tag}>`;
}

export function grid(m, filter) {
  const list = m.builds.filter((b) => filter === "all" || b.course === filter);
  return list.length ? list.map((b, i) => card(m, b, i, filter)).join("") : '<p class="empty">Nothing on this shelf yet.</p>';
}
