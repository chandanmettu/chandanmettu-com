// Present mode for The Lab's figures: one button per step, in order. In Manual only the next step
// is live, so nobody skips the part that matters; Auto plays the whole sequence on a loop for a
// room. Each step drives the figure's own controls (clicks and slider moves), so every number on
// screen still comes from the figure's model. One line underneath says the big idea.
// The steps live in the page as <script type="application/json" id="lab-guide">.
(() => {
  const cfgEl = document.getElementById("lab-guide");
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const q = (sel) => document.querySelector(sel);
  const sleep = (ms, token) => new Promise((res) => { const t = setTimeout(res, ms); token.stops.push(() => { clearTimeout(t); res(); }); });

  // ---- actions on the figure's own controls ----
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function setRange(el, to, ms, token) {
    const from = Number(el.value), step = Number(el.step) || 1;
    if (reduced || !ms) { el.value = String(to); fire(el, "input"); fire(el, "change"); return Promise.resolve(); }
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = (now) => {
        if (token.dead) return res();
        const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k);
        const v = Math.round((from + (to - from) * e) / step) * step;
        if (String(v) !== el.value) { el.value = String(v); fire(el, "input"); }
        if (k < 1) requestAnimationFrame(tick); else { fire(el, "change"); res(); }
      };
      requestAnimationFrame(tick);
    });
  }
  async function run(actions, token) {
    for (const a of actions || []) {
      if (token.dead) return;
      if (a.wait) { await sleep(a.wait, token); continue; }
      const el = q(a.click || a.set);
      if (!el) continue;
      if (a.click) {
        if (a.when && el.getAttribute(a.when[0]) !== a.when[1]) continue;
        el.click();
      } else if (a.set) await setRange(el, a.to, a.ms, token);
    }
  }

  // ---- the bar ----
  const css = `
.lg-start{position:fixed;z-index:9998;right:16px;bottom:max(16px,env(safe-area-inset-bottom));display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border:1px solid rgba(255,255,255,.7);border-radius:999px;background:#19132d;color:#fff;font:700 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 12px 30px -10px rgba(25,19,45,.6);cursor:pointer;transition:transform .2s}
.lg-start:hover{transform:translateY(-2px)}
.lg-start i{width:0;height:0;border-left:9px solid #ffc75a;border-top:6px solid transparent;border-bottom:6px solid transparent}
.lg-bar{position:fixed;z-index:9999;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(1000px,calc(100vw - 24px));padding:12px 14px 14px;border:1px solid rgba(255,255,255,.75);border-radius:22px;background:rgba(251,250,248,.78);-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);box-shadow:0 18px 50px -14px rgba(25,19,45,.45),inset 0 1px 0 rgba(255,255,255,.8);color:#19132d;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.lg-bar[hidden],.lg-start[hidden]{display:none}
.lg-row{display:flex;align-items:center;gap:10px}
.lg-mode{display:flex;flex:none;padding:3px;border-radius:12px;background:rgba(25,19,45,.07)}
.lg-mode button{border:0;border-radius:9px;padding:7px 11px;background:none;color:#5b5672;font:700 12.5px/1 inherit;font-family:inherit;cursor:pointer}
.lg-mode button[aria-pressed=true]{background:#fff;color:#19132d;box-shadow:0 2px 8px -3px rgba(25,19,45,.35)}
.lg-steps{display:flex;flex:1;gap:6px;min-width:0;margin:0;padding:2px;list-style:none;overflow-x:auto;scrollbar-width:none}
.lg-steps::-webkit-scrollbar{display:none}
.lg-steps button{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid rgba(25,19,45,.14);border-radius:12px;background:rgba(255,255,255,.6);color:#19132d;font:650 13px/1 inherit;font-family:inherit;white-space:nowrap;cursor:pointer;transition:background .2s,color .2s,transform .2s}
.lg-steps button b{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(25,19,45,.1);font-size:11px}
.lg-steps button:disabled{opacity:.38;cursor:not-allowed}
.lg-steps button.is-next{border-color:#19132d;box-shadow:0 0 0 3px rgba(255,199,90,.55)}
.lg-steps button.is-next:hover{transform:translateY(-1px)}
.lg-steps button.is-now{background:#19132d;color:#fff}
.lg-steps button.is-now b{background:#ffc75a;color:#19132d}
.lg-steps button.is-done b{background:#30a46c;color:#fff}
.lg-next{flex:none;border:0;border-radius:12px;padding:10px 16px;background:#19132d;color:#fff;font:700 13.5px/1 inherit;font-family:inherit;cursor:pointer}
.lg-next:disabled{opacity:.35;cursor:default}
.lg-x{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:rgba(25,19,45,.08);color:#19132d;font:16px/1 inherit;cursor:pointer}
.lg-hint{margin:10px 4px 0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.lg-big{margin:6px 4px 0;color:#5b5672;font-size:13.5px}
.lg-big b{color:#9a3b2a;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-right:6px}
.lg-bar :focus-visible,.lg-start:focus-visible{outline:2px solid #9776fb;outline-offset:2px}
@media (prefers-color-scheme:dark){.lg-bar{background:rgba(24,24,26,.8);border-color:rgba(255,255,255,.16);color:#eee}.lg-mode{background:rgba(255,255,255,.08)}.lg-mode button{color:#aaa}.lg-mode button[aria-pressed=true]{background:#333;color:#fff}.lg-steps button{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#eee}.lg-steps button.is-now{background:#ffc75a;color:#19132d}.lg-next{background:#ffc75a;color:#19132d}.lg-x{background:rgba(255,255,255,.1);color:#eee}.lg-big{color:#aaa}.lg-big b{color:#ff9a7a}}
@media (max-width:720px){.lg-row{flex-wrap:wrap}.lg-steps{order:3;flex-basis:100%}.lg-hint{font-size:15px}.lg-start{padding:10px 15px}html.lab-present .lab-back{display:none}}
${cfg.css || ""}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const start = document.createElement("button");
  start.className = "lg-start";
  start.type = "button";
  start.innerHTML = "<i></i>Present";
  start.title = "Step through this figure, or let it play for a room";
  const bar = document.createElement("section");
  bar.className = "lg-bar";
  bar.hidden = true;
  bar.setAttribute("aria-label", "Present this figure step by step");
  bar.innerHTML = `<div class="lg-row"><div class="lg-mode" role="group" aria-label="Mode"><button type="button" data-m="manual" aria-pressed="true">Manual</button><button type="button" data-m="auto" aria-pressed="false">Auto</button></div><ol class="lg-steps"></ol><button type="button" class="lg-next">Next ▸</button><button type="button" class="lg-x" aria-label="Stop presenting">✕</button></div><p class="lg-hint" aria-live="polite"></p><p class="lg-big"><b>The big idea</b>${cfg.big || ""}</p>`;
  document.body.append(start, bar);
  const stepsEl = bar.querySelector(".lg-steps"), hintEl = bar.querySelector(".lg-hint"), nextEl = bar.querySelector(".lg-next");
  stepsEl.innerHTML = cfg.steps.map((s, i) => `<li><button type="button" data-i="${i}"><b>${i + 1}</b>${s.title}</button></li>`).join("");

  let mode = "manual", now = -1, token = { dead: true, stops: [] }, keep = 0;
  const kill = () => { token.dead = true; token.stops.forEach((f) => f()); token = { dead: false, stops: [] }; return token; };
  function paint() {
    stepsEl.querySelectorAll("button").forEach((b) => {
      const i = Number(b.dataset.i);
      b.classList.toggle("is-done", i < now);
      b.classList.toggle("is-now", i === now);
      b.classList.toggle("is-next", mode === "manual" && i === now + 1);
      b.disabled = mode === "auto" || i > now + 1;
    });
    nextEl.disabled = mode === "auto" || now >= cfg.steps.length - 1;
    nextEl.textContent = now < 0 ? "Start ▸" : "Next ▸";
    hintEl.textContent = now < 0 ? (cfg.intro || "Press Start, then go step by step.") : cfg.steps[now].hint;
    bar.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
    const live = stepsEl.querySelector(".is-now, .is-next");
    if (live) live.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  async function go(i) {
    const t = kill();
    now = i;
    paint();
    await run(cfg.steps[i].do, t);
  }
  async function auto() {
    const t = kill();
    while (!t.dead) {
      now = -1; paint();
      await run(cfg.reset, t);
      for (let i = 0; i < cfg.steps.length && !t.dead; i++) {
        now = i; paint();
        await run(cfg.steps[i].do, t);
        await sleep(cfg.steps[i].hold || 6000, t);
      }
      await sleep(1500, t);
    }
  }
  function open() {
    document.documentElement.classList.add("lab-present");
    start.hidden = true; bar.hidden = false;
    const fig = cfg.scrollTo && q(cfg.scrollTo);
    if (fig) fig.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    now = -1; paint();
    run(cfg.reset, kill());
    // keep the figure's own idle tour asleep while presenting: a no-change nudge it treats as use
    clearInterval(keep);
    if (cfg.keepalive) keep = setInterval(() => { const el = q(cfg.keepalive); if (el) fire(el, "input"); }, 3000);
    nextEl.focus();
  }
  function close() {
    kill(); clearInterval(keep);
    document.documentElement.classList.remove("lab-present");
    bar.hidden = true; start.hidden = false; mode = "manual";
    start.focus();
  }
  start.addEventListener("click", open);
  bar.querySelector(".lg-x").addEventListener("click", close);
  nextEl.addEventListener("click", () => { if (now < cfg.steps.length - 1) go(now + 1); });
  stepsEl.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b && !b.disabled) go(Number(b.dataset.i)); });
  bar.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.m === mode) return;
    mode = b.dataset.m;
    if (mode === "auto") auto(); else { kill(); paint(); }
  }));
  addEventListener("keydown", (e) => {
    if (bar.hidden || e.target instanceof HTMLInputElement) return;
    if ((e.key === "n" || e.key === "N") && mode === "manual" && now < cfg.steps.length - 1) { e.preventDefault(); go(now + 1); }
  });
  window.__labGuide = { open, close, go, get step() { return now; }, get mode() { return mode; } };
})();
