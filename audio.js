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
    return ctx;
  }

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

  return {
    init,
    trigger,
    setCutoff,
    setMaster,
    setTrackLevel,
    get ctx() { return ctx; },
  };
})();
