// The reader: the case study and the A0 poster, drawn in the page by pdf.js (vendored, Apache-2.0),
// so they open the same on every browser, phones included, without leaving the poster. pdf.js loads
// only the first time the reader opens. Pages render when they come near the view, at the zoom in
// force, and again when the zoom changes.

const DOCS = {
  case: {
    tab: "Case study", title: "SAIL Durgapur Steel Plant · Ironmaking case study", file: "./docs/case-study.pdf", fit: "width",
    note: "Checked since it was written: BF-2 started in 1961, not 1959 (CAG Report 38 of 2025, Table 2); the March 2025 BF-3 relining comes from one tracker and SAIL has not confirmed it.",
  },
  // the A0 page is shown as tiled pictures made from its PDF by tools/poster_images.py: pdf.js stalls
  // on it, and the host's CDN shrinks any picture to 1,600 px, so each picture comes in tiles
  poster: { tab: "Poster", title: "Durgapur Iron Zone · the A0 poster", file: "./docs/poster.pdf", fit: "page", note: "", tiles: "./docs/poster/tiles.json" },
};
const MAX_PX = 16e6; // the most pixels one page canvas may hold, so a zoomed A0 page does not run out of memory

export class Reader {
  constructor({ onOpen = () => {}, onClose = () => {}, sound = null } = {}) {
    this.onOpen = onOpen; this.onClose = onClose; this.sound = sound;
    this.docs = {}; this.cur = null; this.zoom = 1; this.isOpen = false; this.tasks = new Set();
    const el = document.createElement("div");
    el.id = "reader";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "rdTitle");
    el.hidden = true;
    el.innerHTML = `
      <div class="rd-bar">
        <div class="rd-tabs" role="tablist" aria-label="Documents">${Object.entries(DOCS).map(([k, d]) => `<button type="button" role="tab" data-doc="${k}" aria-selected="false">${d.tab}</button>`).join("")}</div>
        <span class="rd-title" id="rdTitle"></span>
        <span class="rd-page" id="rdPage" aria-live="polite"></span>
        <span class="rd-zoom"><button type="button" class="ic" id="rdOut" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" class="rd-pct" id="rdFit" title="Fit (0)">100 %</button><button type="button" class="ic" id="rdIn" aria-label="Zoom in" title="Zoom in (+)">+</button></span>
        <a class="ic" id="rdOpen" target="_blank" rel="noopener" aria-label="Open the PDF in a new tab" title="Open the PDF in a new tab">↗</a>
        <a class="ic" id="rdDown" download aria-label="Download the PDF" title="Download">⤓</a>
        <button type="button" class="ic rd-close" id="rdClose" aria-label="Close the reader" title="Close (Esc)">✕</button>
      </div>
      <p class="rd-note" id="rdNote" hidden></p>
      <div class="rd-scroll" id="rdScroll" tabindex="0"><div class="rd-pages" id="rdPages"></div></div>
      <div class="rd-load" id="rdLoad" role="status"><span class="rd-spin" aria-hidden="true"></span><span id="rdLoadT">Opening…</span></div>`;
    document.body.appendChild(el);
    this.el = el;
    const $ = (id) => el.querySelector(`#${id}`);
    this.$ = $;
    el.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () => this.show(b.dataset.doc)));
    $("rdClose").addEventListener("click", () => this.close());
    $("rdIn").addEventListener("click", () => this.setZoom(this.zoom * 1.25));
    $("rdOut").addEventListener("click", () => this.setZoom(this.zoom / 1.25));
    $("rdFit").addEventListener("click", () => this.setZoom(1));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); this.close(); }
      else if (e.key === "+" || e.key === "=") { this.setZoom(this.zoom * 1.25); e.preventDefault(); }
      else if (e.key === "-") { this.setZoom(this.zoom / 1.25); e.preventDefault(); }
      else if (e.key === "0") { this.setZoom(1); e.preventDefault(); }
      else if (e.key === "Tab") this.trap(e);
      e.stopPropagation(); // the poster's own keys stay quiet while reading
    });
    // ctrl/⌘ + wheel or a trackpad pinch zooms the document, not the page
    $("rdScroll").addEventListener("wheel", (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.01)); }, { passive: false });
    $("rdScroll").addEventListener("scroll", () => this.trackPage(), { passive: true });
    this.io = new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) this.draw(en.target); }, { root: $("rdScroll"), rootMargin: "600px 0px" });
    addEventListener("resize", () => { if (this.isOpen) this.layout(); });
  }

  trap(e) {
    const f = [...this.el.querySelectorAll("button, a[href], [tabindex='0']")].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); }
    else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
  }

  async lib() {
    if (!this.pdfjs) {
      this.pdfjs = await import("../vendor/pdfjs/pdf.min.js");
      this.pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;
    }
    return this.pdfjs;
  }

  async open(id = "case") {
    if (!this.isOpen) {
      this.back = document.activeElement;
      this.isOpen = true;
      this.el.hidden = false;
      requestAnimationFrame(() => this.el.classList.add("on"));
      document.body.classList.add("reading");
      this.onOpen();
      this.sound?.paper();
    }
    await this.show(id);
    this.$("rdClose").focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove("on");
    document.body.classList.remove("reading");
    this.cancelAll();
    setTimeout(() => { if (!this.isOpen) this.el.hidden = true; }, 260);
    this.onClose();
    this.sound?.paper();
    if (this.back && this.back.focus) this.back.focus({ preventScroll: true });
  }

  async show(id) {
    const d = DOCS[id];
    if (!d) return;
    this.el.querySelectorAll("[data-doc]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.doc === id)));
    this.$("rdTitle").textContent = d.title;
    this.$("rdOpen").href = d.file; this.$("rdDown").href = d.file;
    const note = this.$("rdNote"); note.textContent = d.note; note.hidden = !d.note;
    if (this.cur === id && this.$("rdPages").children.length) return;
    this.cur = id; this.zoom = 1;
    this.cancelAll();
    this.$("rdPages").innerHTML = "";
    this.$("rdPage").textContent = "";
    const load = this.$("rdLoad"); load.classList.add("on"); this.$("rdLoadT").textContent = "Opening…";
    try {
      if (d.tiles && !this.docs[id]) {
        const sets = await (await fetch(d.tiles)).json();
        this.docs[id] = { images: sets, sized: [{ vp: { width: sets.view.w, height: sets.view.h } }] };
      }
      const pdfjs = d.tiles ? null : await this.lib();
      if (!this.docs[id]) {
        // wasmUrl: pdf.js decodes colour-profiled (ICC) JPEGs with qcms; without it the poster's
        // renders never finish drawing
        this.docs[id] = await pdfjs.getDocument({ url: d.file, isEvalSupported: false, wasmUrl: new URL("../vendor/pdfjs/wasm/", import.meta.url).href }).promise;
        const pages = [];
        for (let n = 1; n <= this.docs[id].numPages; n++) { const p = await this.docs[id].getPage(n); pages.push({ p, vp: p.getViewport({ scale: 1 }) }); }
        this.docs[id].sized = pages;
      }
      if (this.cur !== id) return;
      this.build();
      load.classList.remove("on");
    } catch (err) {
      console.error(err);
      this.$("rdLoadT").innerHTML = `This browser could not draw the PDF here. <a href="${d.file}" target="_blank" rel="noopener">Open it in a new tab</a>.`;
    }
  }

  // one sheet per page, sized now and drawn when it comes near the view
  build() {
    const doc = this.docs[this.cur], box = this.$("rdPages");
    box.innerHTML = "";
    box.dataset.fit = DOCS[this.cur].fit;
    doc.sized.forEach((s, i) => {
      const pg = document.createElement("div");
      pg.className = "rd-pg";
      pg.style.animationDelay = `${Math.min(i, 8) * 45}ms`;
      pg.dataset.n = String(i + 1);
      pg.innerHTML = doc.images ? "" : `<canvas aria-label="Page ${i + 1} of ${doc.sized.length}"></canvas>`;
      box.appendChild(pg);
      this.io.observe(pg);
    });
    this.layout();
    this.$("rdScroll").scrollTo(0, 0);
    this.trackPage();
  }

  // the size every sheet takes at the current zoom: the case study fits the width (to 880 px), the
  // poster fits whole in the view
  layout() {
    const doc = this.docs[this.cur];
    if (!doc) return;
    const sc = this.$("rdScroll");
    const W = sc.clientWidth - 32, H = sc.clientHeight - 32;
    const fit = DOCS[this.cur].fit;
    this.$("rdPages").classList.toggle("wide", this.zoom > 1.001);
    for (const [i, pg] of [...this.$("rdPages").children].entries()) {
      const { vp } = doc.sized[i];
      const base = fit === "page" ? Math.min(W / vp.width, H / vp.height) : Math.min(W, 880) / vp.width;
      const s = base * this.zoom;
      pg.style.width = `${Math.round(vp.width * s)}px`;
      pg.style.height = `${Math.round(vp.height * s)}px`;
      pg.dataset.scale = String(s);
      if (pg.dataset.drawn && pg.dataset.drawn !== String(s)) { pg.dataset.stale = "1"; }
    }
    this.$("rdFit").textContent = `${Math.round(this.zoom * 100)} %`;
    // redraw what is in view now
    const sr = sc.getBoundingClientRect();
    for (const pg of this.$("rdPages").children) { const r = pg.getBoundingClientRect(); if (r.bottom > sr.top - 600 && r.top < sr.bottom + 600) this.draw(pg); }
  }

  setZoom(z) {
    const sc = this.$("rdScroll");
    const nz = Math.max(0.5, Math.min(DOCS[this.cur]?.fit === "page" ? 8 : 4, z));
    if (Math.abs(nz - this.zoom) < 1e-3) return;
    // keep the middle of the view in the middle
    const cx = (sc.scrollLeft + sc.clientWidth / 2) / Math.max(1, sc.scrollWidth), cy = (sc.scrollTop + sc.clientHeight / 2) / Math.max(1, sc.scrollHeight);
    this.zoom = nz;
    clearTimeout(this.zt);
    this.layout();
    sc.scrollLeft = cx * sc.scrollWidth - sc.clientWidth / 2;
    sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2;
  }

  async draw(pg) {
    const doc = this.docs[this.cur];
    if (!doc) return;
    if (doc.images) return this.drawImage(pg, doc.images);
    const s = Number(pg.dataset.scale || 1);
    if (pg.dataset.drawn === String(s) || pg.dataset.busy === String(s)) return;
    const i = Number(pg.dataset.n) - 1, { p } = doc.sized[i];
    let dpr = Math.min(devicePixelRatio || 1, 2);
    const vp = p.getViewport({ scale: s });
    while (vp.width * vp.height * dpr * dpr > MAX_PX && dpr > 0.5) dpr *= 0.8;
    const out = p.getViewport({ scale: s * dpr });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(out.width); canvas.height = Math.floor(out.height);
    canvas.setAttribute("aria-label", `Page ${i + 1} of ${doc.sized.length}`);
    pg.dataset.busy = String(s);
    const task = p.render({ canvasContext: canvas.getContext("2d"), viewport: out });
    this.tasks.add(task);
    try {
      await task.promise;
      const links = await this.links(doc.sized[i]);
      if (pg.dataset.scale !== String(s)) return; // the zoom moved on while this drew
      pg.replaceChildren(canvas, links);
      pg.dataset.drawn = String(s);
      pg.classList.add("drawn");
    } catch (e) { if (e?.name !== "RenderingCancelledException") console.warn(e); }
    finally { this.tasks.delete(task); if (pg.dataset.busy === String(s)) delete pg.dataset.busy; }
  }

  // the page's web links as real anchors over the canvas (a canvas alone cannot be clicked), placed
  // in percentages so they stay put at any zoom; only http(s) and mailto links, so a dead link left
  // in the PDF by the app that made it does nothing
  async links(sp) {
    if (!sp.links) {
      const anns = await sp.p.getAnnotations({ intent: "display" }).catch(() => []);
      const base = sp.p.getViewport({ scale: 1 });
      sp.links = anns.filter((a) => a.subtype === "Link" && /^(https?:|mailto:)/i.test(a.url || "")).map((a) => {
        const [x1, y1, x2, y2] = base.convertToViewportRectangle(a.rect);
        return { url: a.url, l: Math.min(x1, x2) / base.width, t: Math.min(y1, y2) / base.height, w: Math.abs(x2 - x1) / base.width, h: Math.abs(y2 - y1) / base.height };
      });
    }
    const layer = document.createElement("div");
    layer.className = "rd-links";
    for (const k of sp.links) {
      const a = document.createElement("a");
      a.href = k.url; a.target = "_blank"; a.rel = "noopener"; a.title = k.url;
      a.setAttribute("aria-label", k.url);
      Object.assign(a.style, { left: `${100 * k.l}%`, top: `${100 * k.t}%`, width: `${100 * k.w}%`, height: `${100 * k.h}%` });
      layer.appendChild(a);
    }
    return layer;
  }

  // a picture page: the screen-sized set of tiles first, the big set once the zoom needs its pixels;
  // a set replaces the last only when all its tiles have loaded
  drawImage(pg, im) {
    const need = parseFloat(pg.style.width) * Math.min(devicePixelRatio || 1, 2);
    const key = need > im.view.w * 1.05 ? "zoom" : "view";
    if (pg.dataset.src === key || pg.dataset.busy === key) return;
    pg.dataset.busy = key;
    const set = im[key], layer = document.createElement("div");
    layer.className = "rd-tiles";
    layer.setAttribute("role", "img"); layer.setAttribute("aria-label", DOCS[this.cur].title);
    const loads = set.tiles.map((t) => {
      const img = new Image();
      img.alt = ""; img.decoding = "async"; img.draggable = false;
      Object.assign(img.style, { left: `${(100 * t.x) / set.w}%`, top: `${(100 * t.y) / set.h}%`, width: `${(100 * t.w) / set.w}%`, height: `${(100 * t.h) / set.h}%` });
      layer.appendChild(img);
      return new Promise((ok) => { img.onload = img.onerror = ok; img.src = t.src; });
    });
    Promise.all(loads).then(() => {
      if (pg.dataset.busy !== key) return;
      delete pg.dataset.busy;
      pg.replaceChildren(layer);
      pg.dataset.src = key;
      pg.classList.add("drawn");
    });
  }

  cancelAll() { for (const t of this.tasks) { try { t.cancel(); } catch { /* done already */ } } this.tasks.clear(); }

  trackPage() {
    const doc = this.docs[this.cur];
    if (!doc) return;
    const sc = this.$("rdScroll"), mid = sc.getBoundingClientRect().top + sc.clientHeight * 0.4;
    let n = 1;
    for (const pg of this.$("rdPages").children) { if (pg.getBoundingClientRect().top <= mid) n = Number(pg.dataset.n); }
    const t = doc.sized.length > 1 ? `Page ${n} of ${doc.sized.length}` : "";
    if (this.$("rdPage").textContent !== t) this.$("rdPage").textContent = t;
  }
}
