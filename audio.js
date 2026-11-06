// Web Audio engine. Every sound is synthesised on the fly: no samples to load.
const Engine = (() => {
  let ctx = null;
  let filter, master, noiseBuf;
  const buses = {};

  function init(trackIds) {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    filter.connect(comp).connect(master).connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    for (const id of trackIds) {
      const g = ctx.createGain();
      g.connect(filter);
      buses[id] = g;
    }

    // Dotted-eighth echo: lead and perc feed it, it feeds the master filter.
    delay = ctx.createDelay(2);
    delayFb = ctx.createGain();
    delayFb.gain.value = 0.38;
    delaySend = ctx.createGain();
    const tone = filt("lowpass", 3200);
    delaySend.connect(delay).connect(tone).connect(delayFb).connect(delay);
    tone.connect(filter);
    for (const id of ["lead", "perc"]) if (buses[id]) buses[id].connect(delaySend);
    return ctx;
  }

  let delay, delayFb, delaySend;
  const setDelay = (v) => ctx && smooth(delaySend.gain, v);
  const setDelayTime = (bpm) => ctx && smooth(delay.delayTime, 0.75 * (60 / bpm));

  const smooth = (param, value) => param.setTargetAtTime(value, ctx.currentTime, 0.02);
  const setCutoff = (x) => ctx && smooth(filter.frequency, 200 * Math.pow(100, x));
  const setMaster = (v) => ctx && smooth(master.gain, v);
  const setTrackLevel = (id, v) => ctx && buses[id] && smooth(buses[id].gain, v);

  // --- building blocks ---------------------------------------------------
  function env(g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }
  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.start(t);
    s.stop(t + dur);
    return s;
  }
  function filt(type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  function osc(type, t, dur) {
    const o = ctx.createOscillator();
    o.type = type;
    o.start(t);
    o.stop(t + dur);
    return o;
  }
  const gain = () => ctx.createGain();

  // --- drum voices -------------------------------------------------------
  const drums = {
    kick(t, v, out) {
      const o = osc("sine", t, 0.5), g = gain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      env(g, t, v, 0.45);
      o.connect(g).connect(out);
    },
    snare(t, v, out) {
      const g = gain();
      env(g, t, v * 0.7, 0.2);
      noise(t, 0.25).connect(filt("highpass", 1200)).connect(g).connect(out);
      const o = osc("triangle", t, 0.15), g2 = gain();
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      env(g2, t, v * 0.5, 0.12);
      o.connect(g2).connect(out);
    },
    clap(t, v, out) {
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        g.gain.setValueAtTime(v * 0.8, tt);
        g.gain.exponentialRampToValueAtTime(v * 0.15, tt + 0.009);
      }
      g.gain.setValueAtTime(v * 0.6, t + 0.034);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      noise(t, 0.3).connect(filt("bandpass", 1600, 1.2)).connect(g).connect(out);
    },
    hat(t, v, out) {
      const g = gain();
      env(g, t, v * 0.45, 0.05);
      noise(t, 0.08).connect(filt("highpass", 7500)).connect(g).connect(out);
    },
    open(t, v, out) {
      const g = gain();
      env(g, t, v * 0.4, 0.32);
      noise(t, 0.35).connect(filt("highpass", 7000)).connect(g).connect(out);
    },
    perc(t, v, out) {
      const o = osc("sine", t, 0.12), g = gain();
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.06);
      env(g, t, v * 0.6, 0.09);
      o.connect(g).connect(out);
    },
  };

  const trigger = (id, t, v) => drums[id](t, v, buses[id]);

  // --- synth voices ------------------------------------------------------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function bass(t, midi, dur, out = buses.bass) {
    const o = osc("sawtooth", t, dur + 0.1);
    const sub = osc("square", t, dur + 0.1);
    o.frequency.value = mtof(midi);
    sub.frequency.value = mtof(midi - 12);
    const subG = gain();
    subG.gain.value = 0.35;
    const f = filt("lowpass", 180, 9);
    f.frequency.setValueAtTime(1900, t);
    f.frequency.exponentialRampToValueAtTime(170, t + Math.max(dur, 0.08));
    const g = gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.setValueAtTime(0.5, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(f);
    sub.connect(subG).connect(f);
    f.connect(g).connect(out);
  }

  function lead(t, midi, dur, out = buses.lead) {
    const f = filt("lowpass", 900, 4);
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const g = gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.1, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    for (const cents of [-8, 8]) {
      const o = osc("sawtooth", t, dur + 0.15);
      o.frequency.value = mtof(midi);
      o.detune.value = cents;
      o.connect(f);
    }
    f.connect(g).connect(out);
  }

  return {
    init,
    trigger,
    bass,
    lead,
    setDelay,
    setDelayTime,
    setCutoff,
    setMaster,
    setTrackLevel,
    get ctx() { return ctx; },
  };
})();
