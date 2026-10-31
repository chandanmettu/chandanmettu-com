// Small synthesized sounds, no files: a pen on paper while the drawing lifts, water running into
// the beaker (louder and rougher as the flow grows), a page tick, the flap, the stamp.
// Audio starts only after the first click or key, as browsers require.

export class Sound {
  constructor() {
    this.on = true;
    this.ctx = null;
    this.water = null;
    this.pen = null;
  }

  // call from a user gesture
  wake() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? 0.5 : 0;
    this.master.connect(ctx.destination);
    // one second of white noise, looped by every continuous sound
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.water = this.loop({ type: "bandpass", freq: 1400, q: 0.7 });
    this.waterLow = this.loop({ type: "lowpass", freq: 420, q: 0.5 });
    this.pen = this.loop({ type: "bandpass", freq: 3200, q: 1.6 });
  }

  loop({ type, freq, q }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return { f, g };
  }

  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  // every frame: the jet's sound follows the discharge, the pen scratches while it draws
  update({ Qml, gamma, drawing }) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const q = Math.min(1, Math.sqrt(Math.max(0, Qml)) / 11);
    this.water.g.gain.setTargetAtTime(0.05 * q, t, 0.15);
    this.water.f.frequency.setTargetAtTime(900 + 900 * q + 500 * gamma * Math.random(), t, 0.08);
    this.waterLow.g.gain.setTargetAtTime(0.06 * q * (0.6 + 0.4 * gamma), t, 0.2);
    // a pen moves in strokes: the scratch flickers rather than hisses
    const stroke = drawing ? (Math.random() < 0.7 ? 0.05 + 0.04 * Math.random() : 0.008) : 0;
    this.pen.g.gain.setTargetAtTime(stroke, t, 0.02);
    if (drawing) this.pen.f.frequency.setTargetAtTime(2600 + 1600 * Math.random(), t, 0.03);
  }

  // short sounds: a filtered burst with an envelope
  burst({ freq = 2000, q = 1, dur = 0.08, gain = 0.2, type = "bandpass", thump = 0 }) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    if (thump) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      og.gain.setValueAtTime(thump, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
      o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.25);
    }
  }
  tick() { this.burst({ freq: 3800, q: 2, dur: 0.05, gain: 0.12 }); }
  paper() { this.burst({ freq: 1800, q: 0.6, dur: 0.28, gain: 0.16 }); }
  stamp() { this.burst({ freq: 900, q: 0.8, dur: 0.12, gain: 0.25, thump: 0.5 }); }
}
