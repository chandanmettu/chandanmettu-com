// Present mode for The Lab's figures: one button per step, in order. In Manual only the next step
// is live, so nobody skips the part that matters; Auto plays the whole sequence on a loop for a
// room. Each step drives the figure's own controls (clicks and slider moves), so every number on
// screen still comes from the figure's model. One line underneath says the big idea.
//
// The lesson loop around the steps: a prediction to tick before anything moves (not marked until
// the flap is lifted), a paper flap with the reason, and a challenge that earns a stamp. The
// challenge is checked against the figure's own readouts, never against the player's clicks.
// A clock badge says how fast the figure runs against real time, and a few sound words pop on
// the action. The steps live in the page as <script type="application/json" id="lab-guide">.
(() => {
  const cfgEl = document.getElementById("lab-guide");
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const q = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sleep = (ms, token) => new Promise((res) => { const t = setTimeout(res, ms); token.stops.push(() => { clearTimeout(t); res(); }); });
  const slug = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "").split("/").pop() || "figure";
  const LETTERS = "ABCD";

  // ---- saved progress: guesses and stamps, one versioned key; the page works without storage ----
  const KEY = "lab-guide:v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (fn) => { try { const all = load(); fn(all); localStorage.setItem(KEY, JSON.stringify(all)); } catch {} };
  let stamp = (load().stamps || {})[slug] || null;

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

  // ---- reading the figure: the challenge and the clock look only at what the page shows ----
  function valueOf(el, attr) {
    if (attr) return el.getAttribute(attr) ?? "";
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return el.value;
    return el.textContent || "";
  }
  const numberIn = (text) => {
    const m = String(text).replace(/[−–]/g, "-").replace(/[,  ]/g, "").match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/i);
    return m ? Number(m[0]) : NaN;
  };
  function holds(c) {
    const el = q(c.sel);
    if (!el) return false;
    const v = valueOf(el, c.attr);
    if (c.value !== undefined && v !== String(c.value)) return false;
    if (c.text !== undefined && ![].concat(c.text).some((t) => v.includes(t))) return false;
    if (c.not !== undefined && [].concat(c.not).some((t) => v.includes(t))) return false;
    if (c.num) { const n = numberIn(v); if (!(n >= c.num[0] && n <= c.num[1])) return false; }
    return true;
  }
  const all = (list) => (list || []).every(holds);
  function clockText() {
    const c = cfg.clock;
    if (!c) return "";
    if (c.text) return c.text;
    const el = q(c.sel);
    const v = el ? valueOf(el).trim() : "";
    return v ? (c.tpl || "{}").replace("{}", v) : "";
  }

  // ---- styles ----
  const css = `
.lg-start{position:fixed;z-index:9998;right:16px;bottom:max(16px,env(safe-area-inset-bottom));display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border:1px solid rgba(255,255,255,.7);border-radius:999px;background:#19132d;color:#fff;font:700 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 12px 30px -10px rgba(25,19,45,.6);cursor:pointer;transition:transform .2s}
.lg-start:hover{transform:translateY(-2px)}
.lg-start i{width:0;height:0;border-left:9px solid #ffc75a;border-top:6px solid transparent;border-bottom:6px solid transparent}
.lg-start s{margin-left:2px;padding:3px 7px;border-radius:999px;background:#c8321e;color:#fff;font:800 10px/1 inherit;font-family:inherit;letter-spacing:.08em;text-decoration:none;text-transform:uppercase}
.lg-bar{position:fixed;z-index:9999;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(1000px,calc(100vw - 24px));max-height:calc(100vh - 28px);overflow:auto;padding:12px 14px 14px;border:1px solid rgba(255,255,255,.75);border-radius:22px;background:rgba(251,250,248,.84);-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);box-shadow:0 18px 50px -14px rgba(25,19,45,.45),inset 0 1px 0 rgba(255,255,255,.8);color:#19132d;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.lg-bar[hidden],.lg-start[hidden],.lg-bar [hidden]{display:none!important}
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
.lg-steps button.lg-why-step b{background:#c8321e;color:#fff}
.lg-next{flex:none;border:0;border-radius:12px;padding:10px 16px;background:#19132d;color:#fff;font:700 13.5px/1 inherit;font-family:inherit;cursor:pointer}
.lg-next:disabled{opacity:.35;cursor:default}
.lg-x{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:rgba(25,19,45,.08);color:#19132d;font:16px/1 inherit;cursor:pointer}
.lg-hint{margin:10px 4px 0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.lg-foot{display:flex;align-items:baseline;gap:12px;margin:6px 4px 0}
.lg-big{flex:1;margin:0;color:#5b5672;font-size:13.5px}
.lg-big b,.lg-rest b,.lg-kick{color:#9a3b2a;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-right:6px}
.lg-clock{flex:none;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid currentColor;border-radius:999px;font:700 11.5px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.02em;white-space:nowrap;opacity:.8}
.lg-clock::before{content:"";width:7px;height:7px;border-radius:50%;background:#30a46c;box-shadow:0 0 0 3px rgba(48,164,108,.22)}
.lg-predict{display:flex;flex-wrap:wrap;gap:8px;margin:10px 4px 0}
.lg-predict button{display:inline-flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid rgba(25,19,45,.18);border-radius:12px;background:rgba(255,255,255,.7);color:#19132d;font:600 14px/1.25 inherit;font-family:inherit;text-align:left;cursor:pointer;transition:transform .15s,background .2s}
.lg-predict button:hover{transform:translateY(-1px)}
.lg-predict button b{display:grid;place-items:center;flex:none;width:22px;height:22px;border:1.5px solid currentColor;border-radius:50%;font-size:11px}
.lg-predict button[aria-pressed=true]{background:#19132d;color:#fff}
.lg-predict button[aria-pressed=true] b{background:#ffc75a;border-color:#ffc75a;color:#19132d}
.lg-predict-note{flex-basis:100%;margin:2px 2px 0;color:#5b5672;font-size:13px}
.lg-end{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0 2px}
.lg-flap{position:relative;min-height:150px;perspective:900px}
.lg-flap-back,.lg-flap-front,.lg-chal{border-radius:14px}
.lg-flap-back{height:100%;padding:13px 15px;background:#fbf7ee;border:1px solid rgba(25,19,45,.16);color:#1c2433;font:14.5px/1.5 Georgia,"Source Serif 4",serif}
.lg-flap-back p{margin:0}
.lg-verdict{margin-bottom:6px!important;font:700 13px/1.3 -apple-system,BlinkMacSystemFont,sans-serif}
.lg-verdict.ok{color:#1d7a4c}.lg-verdict.no{color:#9a3b2a}
.lg-flap-front{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:0;background:repeating-linear-gradient(135deg,rgba(28,36,51,.05) 0 2px,transparent 2px 7px),#f3ead6;color:#1c2433;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 10px 22px -12px rgba(25,19,45,.6);font:800 15px/1 Georgia,"Source Serif 4",serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transform-origin:50% 0;transition:transform .7s cubic-bezier(.3,.7,.2,1.1),opacity .7s;backface-visibility:hidden}
.lg-flap-front small{font:600 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:0;text-transform:none;opacity:.65}
.lg-flap-front::after{content:"";position:absolute;left:18px;right:18px;top:7px;border-top:1.5px dashed rgba(28,36,51,.35)}
.lg-flap.is-open .lg-flap-front{transform:rotateX(-176deg);opacity:0;pointer-events:none}
.lg-chal{position:relative;padding:13px 15px;border:1.5px dashed rgba(25,19,45,.28);background:rgba(255,255,255,.55);overflow:hidden}
.lg-chal p{margin:0 0 9px;font-size:14.5px;font-weight:600}
.lg-end.is-chal{grid-template-columns:1fr}.lg-end.is-chal .lg-flap{display:none}
.lg-chal.has-stamp{padding-right:132px;min-height:120px}
.lg-chal-go{border:0;border-radius:10px;padding:8px 13px;background:#19132d;color:#fff;font:700 13px/1 inherit;font-family:inherit;cursor:pointer}
.lg-chal-status{margin:0!important;color:#5b5672;font-size:13px!important;font-weight:500!important}
.lg-stamp{position:absolute;right:14px;top:50%;display:grid;place-items:center;width:104px;height:104px;margin-top:-52px;border:3px double #c8321e;border-radius:50%;color:#c8321e;font:900 15px/1.05 Georgia,serif;letter-spacing:.1em;text-align:center;text-transform:uppercase;transform:rotate(-14deg);opacity:.9;mix-blend-mode:multiply;pointer-events:none}
.lg-stamp small{display:block;margin-top:4px;font:700 9.5px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em}
.lg-stamp.is-new{animation:lg-thump .5s cubic-bezier(.2,.8,.3,1.2)}
@keyframes lg-thump{0%{transform:rotate(-14deg) scale(2.4);opacity:0}60%{transform:rotate(-14deg) scale(.94);opacity:1}100%{transform:rotate(-14deg) scale(1);opacity:.9}}
.lg-word{position:fixed;z-index:9997;pointer-events:none;color:#ffc75a;font:italic 900 26px/1 "Arial Rounded MT Bold",ui-rounded,-apple-system,sans-serif;letter-spacing:.02em;-webkit-text-stroke:1.5px #19132d;paint-order:stroke fill;text-shadow:0 3px 0 #19132d;transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(.2);opacity:0;animation:lg-pop 1.9s cubic-bezier(.2,.9,.3,1.3) forwards}
@keyframes lg-pop{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(.2)}14%{opacity:1;transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(1.12)}24%{transform:translate(-50%,-50%) rotate(var(--r,-8deg)) scale(1)}78%{opacity:1;transform:translate(-50%,-62%) rotate(var(--r,-8deg)) scale(1)}100%{opacity:0;transform:translate(-50%,-80%) rotate(var(--r,-8deg)) scale(.96)}}
.lg-rest{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 12px;margin:12px 0 0;padding:10px 12px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px;font-size:14.5px;line-height:1.45}
.lg-rest p{flex:1;min-width:220px;margin:0}
.lg-rest b{color:#ff8a6a}
.lg-rest .lg-mini{flex:none;padding:3px 8px;border:1.5px solid #e2553f;border-radius:999px;color:#e2553f;font:800 10.5px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.08em;text-transform:uppercase}
html.lab-present .lg-rest{display:none}
.lg-bar :focus-visible,.lg-start:focus-visible{outline:2px solid #9776fb;outline-offset:2px}
@media (prefers-color-scheme:dark){.lg-bar{background:rgba(24,24,26,.86);border-color:rgba(255,255,255,.16);color:#eee}.lg-mode{background:rgba(255,255,255,.08)}.lg-mode button{color:#aaa}.lg-mode button[aria-pressed=true]{background:#333;color:#fff}.lg-steps button,.lg-predict button{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#eee}.lg-steps button.is-now,.lg-predict button[aria-pressed=true]{background:#ffc75a;color:#19132d}.lg-next,.lg-chal-go{background:#ffc75a;color:#19132d}.lg-x{background:rgba(255,255,255,.1);color:#eee}.lg-big,.lg-predict-note,.lg-chal-status{color:#aaa!important}.lg-big b,.lg-kick{color:#ff9a7a}.lg-chal{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.22)}.lg-stamp{mix-blend-mode:normal;color:#ff6b55;border-color:#ff6b55}}
@media (max-width:720px){.lg-row{flex-wrap:wrap}.lg-steps{order:3;flex-basis:100%}.lg-hint{font-size:15px}.lg-start{padding:10px 15px}html.lab-present .lab-back{display:none}.lg-end{grid-template-columns:1fr}.lg-foot{flex-wrap:wrap}.lg-word{font-size:21px}}
${cfg.css || ""}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- the Present button, the bar and the line under the figure ----
  const start = document.createElement("button");
  start.className = "lg-start";
  start.type = "button";
  start.title = "Step through this figure, or let it play for a room";
  const paintStart = () => { start.innerHTML = `<i></i>Present${stamp ? "<s>Solved</s>" : ""}`; };
  paintStart();
  const steps = cfg.steps;
  const hasEnd = Boolean(cfg.why || cfg.challenge);
  const last = steps.length - 1 + (hasEnd ? 1 : 0); // the flap and challenge are one more stop
  const bar = document.createElement("section");
  bar.className = "lg-bar";
  bar.hidden = true;
  bar.setAttribute("aria-label", "Present this figure step by step");
  bar.innerHTML = `<div class="lg-row"><div class="lg-mode" role="group" aria-label="Mode"><button type="button" data-m="manual" aria-pressed="true">Manual</button><button type="button" data-m="auto" aria-pressed="false">Auto</button></div><ol class="lg-steps"></ol><button type="button" class="lg-next">Next ▸</button><button type="button" class="lg-x" aria-label="Stop presenting">✕</button></div>
<p class="lg-hint" aria-live="polite"></p>
<div class="lg-predict" role="group" aria-label="Your prediction" hidden></div>
<div class="lg-end" hidden>
  <div class="lg-flap"><div class="lg-flap-back"><p class="lg-verdict" hidden></p><p class="lg-why"></p></div><button type="button" class="lg-flap-front" aria-label="Why? Lift the flap">Why?<small>Lift the flap</small></button></div>
  <div class="lg-chal"><p><span class="lg-kick">Challenge</span><span class="lg-task"></span></p><button type="button" class="lg-chal-go">Take it on</button><p class="lg-chal-status" aria-live="polite" hidden></p></div>
</div>
<div class="lg-foot"><p class="lg-big"><b>The big idea</b>${esc(cfg.big || "")}</p><span class="lg-clock" hidden></span></div>`;
  document.body.append(start, bar);
  const $ = (sel) => bar.querySelector(sel);
  const stepsEl = $(".lg-steps"), hintEl = $(".lg-hint"), nextEl = $(".lg-next"), predictEl = $(".lg-predict");
  const endEl = $(".lg-end"), flapEl = $(".lg-flap"), chalEl = $(".lg-chal"), statusEl = $(".lg-chal-status"), goEl = $(".lg-chal-go");
  const clocks = [$(".lg-clock")];
  stepsEl.innerHTML = steps.map((s, i) => `<li><button type="button" data-i="${i}"><b>${i + 1}</b>${esc(s.title)}</button></li>`).join("")
    + (hasEnd ? `<li><button type="button" data-i="${steps.length}" class="lg-why-step"><b>?</b>${cfg.challenge ? "Why + challenge" : "Why?"}</button></li>` : "");
  $(".lg-why").textContent = cfg.why || "";
  if (!cfg.why) flapEl.hidden = true;
  if (cfg.challenge) $(".lg-task").textContent = cfg.challenge.task; else chalEl.hidden = true;

  let rest = null;
  const host = cfg.rest && q(cfg.rest);
  if (host) {
    rest = document.createElement("div");
    rest.className = "lg-rest";
    rest.innerHTML = `<span class="lg-clock" hidden></span><p><b>The big idea</b>${esc(cfg.big || "")}</p><span class="lg-mini" hidden></span>`;
    if (cfg.restAt === "start") { rest.style.margin = "0"; host.prepend(rest); } else host.appendChild(rest);
    clocks.push(rest.querySelector(".lg-clock"));
  }
  const paintRest = () => {
    if (!rest) return;
    const mini = rest.querySelector(".lg-mini");
    mini.hidden = !stamp;
    if (stamp) mini.textContent = `★ Challenge solved ${stamp}`;
  };
  paintRest();
  function paintClock() {
    const t = clockText();
    for (const el of clocks) {
      el.hidden = !t;
      if (t && el.textContent !== t) el.textContent = t;
      if (cfg.clock?.title) el.title = cfg.clock.title;
    }
  }
  paintClock();
  if (cfg.clock && !cfg.clock.text) setInterval(paintClock, 700);

  // ---- predict ----
  let guess = (load().guesses || {})[slug];
  if (guess === undefined) guess = null;
  function paintPredict() {
    const p = cfg.predict;
    if (!p) return;
    predictEl.innerHTML = p.options.map((o, i) => `<button type="button" data-g="${i}" aria-pressed="${guess === i}"><b>${LETTERS[i]}</b>${esc(o)}</button>`).join("")
      + `<p class="lg-predict-note">${guess === null ? "Tick one before you press Start. It is checked when the flap is lifted." : `Your guess: ${LETTERS[guess]}. Watch, then lift the flap.`}</p>`;
  }
  predictEl.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-g]");
    if (!b || mode === "auto") return;
    guess = Number(b.dataset.g);
    save((s) => { (s.guesses ||= {})[slug] = guess; });
    paintPredict();
  });

  // ---- flap ----
  function paintVerdict() {
    const v = $(".lg-verdict"), p = cfg.predict;
    if (!p) { v.hidden = true; return; }
    v.hidden = false;
    const right = `${LETTERS[p.answer]}: ${p.options[p.answer]}`;
    if (guess === null || mode === "auto") { v.className = "lg-verdict"; v.textContent = `Answer ${right}.`; }
    else if (guess === p.answer) { v.className = "lg-verdict ok"; v.textContent = `You guessed ${LETTERS[guess]}. Right: ${p.options[p.answer]}.`; }
    else { v.className = "lg-verdict no"; v.textContent = `You guessed ${LETTERS[guess]}. The answer is ${right}.`; }
  }
  const openFlap = (open) => { paintVerdict(); flapEl.classList.toggle("is-open", open); };
  $(".lg-flap-front").addEventListener("click", () => openFlap(true));

  // ---- challenge ----
  let chal = "idle", poll = 0;
  function say(text) { statusEl.hidden = false; statusEl.textContent = text; }
  function paintChallenge() {
    const old = chalEl.querySelector(".lg-stamp");
    if (old) old.remove();
    goEl.hidden = chal !== "idle";
    endEl.classList.toggle("is-chal", chal !== "idle");
    chalEl.classList.toggle("has-stamp", Boolean(stamp) && chal !== "active");
    if (stamp && chal !== "active") {
      chalEl.insertAdjacentHTML("beforeend", `<div class="lg-stamp${chal === "won" ? " is-new" : ""}"><span>Solved<small>${esc(stamp)}</small></span></div>`);
      if (chal === "idle") { goEl.textContent = "Try it again"; goEl.hidden = false; }
    }
    if (chal === "idle") statusEl.hidden = true;
  }
  function stopChallenge() { clearInterval(poll); poll = 0; }
  function startChallenge() {
    const c = cfg.challenge;
    stopChallenge();
    chal = "active";
    let armed = !c.arm;
    paintChallenge();
    const check = () => {
      if (!armed) {
        if (all(c.arm)) { armed = true; say(c.armed || "Ready. Go."); } else say(c.wait || "Set it up first.");
        return;
      }
      if (c.keep && !all(c.keep)) { armed = !c.arm; say(c.lost || "That broke the rule. Set it up again."); return; }
      if (all(c.win)) win();
    };
    check();
    poll = setInterval(check, 250);
  }
  function win() {
    stopChallenge();
    const d = new Date();
    stamp = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    save((s) => { (s.stamps ||= {})[slug] = stamp; });
    chal = "won";
    say(cfg.challenge.done || "Done.");
    paintChallenge();
    paintRest();
    paintStart();
    pop({ text: "Solved!", at: [0.5, 0.45], r: -10 });
  }
  goEl.addEventListener("click", () => {
    if (mode === "auto") { mode = "manual"; kill(); paint(); }
    startChallenge();
  });

  // ---- sound words, drawn on the action ----
  function pop(w) {
    if (reduced || !w) return;
    const box = q(cfg.wordsIn || cfg.scrollTo || "body");
    if (!box) return;
    const r = box.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = "lg-word";
    el.textContent = w.text;
    el.style.left = `${r.left + w.at[0] * r.width}px`;
    el.style.top = `${r.top + w.at[1] * r.height}px`;
    el.style.setProperty("--r", `${w.r ?? -8}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
  async function words(list, token) {
    for (const w of [].concat(list || [])) {
      if (w.delay) await sleep(w.delay, token);
      if (token.dead) return;
      pop(w);
    }
  }

  // ---- stepping ----
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
    nextEl.disabled = mode === "auto" || now >= last;
    nextEl.textContent = now < 0 ? "Start ▸" : now === steps.length - 1 && hasEnd ? "Why? ▸" : "Next ▸";
    const atEnd = hasEnd && now === steps.length;
    hintEl.textContent = now < 0 ? (cfg.predict ? cfg.predict.q : cfg.intro || "Press Start, then go step by step.") : atEnd ? (cfg.endHint || "Lift the flap for the reason, then take on the challenge.") : steps[now].hint;
    predictEl.hidden = !(now < 0 && cfg.predict);
    if (!predictEl.hidden) paintPredict();
    endEl.hidden = !atEnd;
    if (!atEnd) { openFlap(false); if (chal === "active") stopChallenge(); chal = "idle"; paintChallenge(); }
    bar.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
    const live = stepsEl.querySelector(".is-now, .is-next");
    if (live) live.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  async function go(i) {
    const t = kill();
    now = i;
    paint();
    if (i < steps.length) { words(steps[i].word, t); await run(steps[i].do, t); }
  }
  async function auto() {
    const t = kill();
    while (!t.dead) {
      now = -1; paint();
      await run(cfg.reset, t);
      if (cfg.predict) await sleep(4500, t);
      for (let i = 0; i < steps.length && !t.dead; i++) {
        now = i; paint();
        words(steps[i].word, t);
        await run(steps[i].do, t);
        await sleep(steps[i].hold || 6000, t);
      }
      if (hasEnd && !t.dead) {
        now = steps.length; paint();
        await sleep(1800, t);
        if (!t.dead) openFlap(true);
        await sleep(9000, t);
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
    kill(); clearInterval(keep); stopChallenge(); chal = "idle";
    document.documentElement.classList.remove("lab-present");
    bar.hidden = true; start.hidden = false; mode = "manual";
    start.focus();
  }
  start.addEventListener("click", open);
  $(".lg-x").addEventListener("click", close);
  nextEl.addEventListener("click", () => { if (now < last) go(now + 1); });
  stepsEl.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b && !b.disabled) go(Number(b.dataset.i)); });
  bar.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.m === mode) return;
    mode = b.dataset.m;
    if (mode === "auto") { stopChallenge(); chal = "idle"; auto(); } else { kill(); paint(); }
  }));
  addEventListener("keydown", (e) => {
    if (bar.hidden || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if ((e.key === "n" || e.key === "N") && mode === "manual" && now < last) { e.preventDefault(); go(now + 1); }
    else if (now < 0 && cfg.predict && mode === "manual" && /^[1-4]$/.test(e.key) && (e.target === document.body || bar.contains(e.target))) {
      const i = Number(e.key) - 1;
      if (i < cfg.predict.options.length) { guess = i; save((s) => { (s.guesses ||= {})[slug] = guess; }); paintPredict(); }
    }
  });
  window.__labGuide = { open, close, go, pop, get step() { return now; }, get mode() { return mode; }, get challenge() { return chal; }, get stamp() { return stamp; } };
})();
