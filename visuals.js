// Live visuals. Taps whatever reaches the speakers, so it reacts to any song,
// including the edits you make while it plays. Loaded before Strudel so the tap
// is in place before the first sound is connected.
(() => {
  // --- the tap: mirror every connection to the speakers into an analyser ---
  const connect = AudioNode.prototype.connect;
  const taps = new Map();
  let analyser = null;

  function tapFor(ctx) {
    let a = taps.get(ctx);
    if (!a) {
      a = ctx.createAnalyser();
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.82;
      // keep the analyser in the processing graph without making it audible
      const sink = ctx.createGain();
      sink.gain.value = 0;
      connect.call(a, sink);
      connect.call(sink, ctx.destination);
      taps.set(ctx, a);
    }
    analyser = a;
    return a;
  }

  AudioNode.prototype.connect = function (dest, ...rest) {
    if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
      connect.call(this, tapFor(dest.context));
    }
    return connect.call(this, dest, ...rest);
  };

  // --- shared audio features ------------------------------------------------
  let timeData = null;
  let freqData = null;
  let level = 0;
  let bass = 0;

  function listen() {
    if (!analyser) {
      level *= 0.95;
      bass *= 0.9;
      return;
    }
    if (!timeData || timeData.length !== analyser.fftSize) {
      timeData = new Float32Array(analyser.fftSize);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }
    analyser.getFloatTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    const rms = Math.sqrt(sum / timeData.length);
    level += (Math.min(rms * 4, 1) - level) * 0.25;
    let low = 0;
    for (let i = 1; i < 8; i++) low += freqData[i];
    const b = low / (7 * 255);
    bass = Math.max(b * b, bass * 0.88);
  }

  window.LoopfieldVisuals = {
    get level() { return level; },
    get bass() { return bass; },
  };

  // --- drawing ---------------------------------------------------------------
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colors = { a1: "#ff2e4d", a2: "#3df2ff", a3: "#ffb000" };
  let theme = "city";
  let frame = 0;

  function readTheme() {
    const css = getComputedStyle(document.body);
    for (const k of ["a1", "a2", "a3"]) colors[k] = css.getPropertyValue(`--${k}`).trim() || colors[k];
    theme = document.body.dataset.theme || "city";
  }

  function alpha(hex, a) {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
  }

  function start() {
    const field = document.getElementById("field");
    const scope = document.getElementById("scope");
    const fx = field.getContext("2d");
    const sx = scope.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    const parts = [];

    const spawn = (anywhere) => ({
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : null,
      z: Math.random() * 0.8 + 0.2,
      s: Math.random(),
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = field.width = innerWidth * dpr;
      H = field.height = innerHeight * dpr;
      const n = Math.round(((innerWidth * innerHeight) / 9000) * (reduce ? 0.3 : 1));
      parts.length = Math.min(parts.length, n);
      while (parts.length < n) parts.push(spawn(true));
    }
    addEventListener("resize", resize);
    resize();

    // rain in the city, embers in the old world, snow at the edges of the map
    function drawField(t) {
      fx.clearRect(0, 0, W, H);
      const k = (reduce ? 0.4 : 1) * (1 + level * 6);
      if (bass > 0.05) {
        const g = fx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.7);
        g.addColorStop(0, alpha(colors.a1, bass * 0.12));
        g.addColorStop(1, "rgba(0,0,0,0)");
        fx.fillStyle = g;
        fx.fillRect(0, 0, W, H);
      }
      for (const p of parts) {
        if (theme === "old") {
          p.y = (p.y ?? H) - (0.4 + 1.2 * p.z) * k * dpr;
          p.x += Math.sin(t * 0.001 + p.s * 10) * 0.4 * dpr;
          if (p.y < -10) Object.assign(p, spawn(false), { y: H + 10 });
          const flicker = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.003 + p.s * 20));
          fx.fillStyle = alpha(colors.a1, flicker * p.z);
          fx.beginPath();
          fx.arc(p.x, p.y, (1 + 1.5 * p.z) * dpr, 0, Math.PI * 2);
          fx.fill();
        } else if (theme === "edge") {
          p.y = (p.y ?? -10) + (0.3 + 0.9 * p.z) * k * dpr;
          p.x += Math.sin(t * 0.0005 + p.s * 6) * 0.5 * dpr;
          if (p.y > H + 10) Object.assign(p, spawn(false), { y: -10 });
          fx.fillStyle = alpha(colors.a3, 0.5 * p.z);
          fx.beginPath();
          fx.arc(p.x, p.y, (0.8 + 1.8 * p.z) * dpr, 0, Math.PI * 2);
          fx.fill();
        } else {
          p.y = (p.y ?? -20) + (6 + 10 * p.z) * k * dpr;
          p.x += 1.5 * p.z * k * dpr;
          if (p.y > H + 20 || p.x > W + 20) Object.assign(p, spawn(false), { y: -20 });
          fx.strokeStyle = alpha(colors.a2, 0.25 * p.z);
          fx.lineWidth = dpr;
          fx.beginPath();
          fx.moveTo(p.x, p.y);
          fx.lineTo(p.x - 2 * p.z * dpr, p.y - 14 * p.z * dpr);
          fx.stroke();
        }
      }
    }

    // a circular oscilloscope with a ring of frequency bars inside it
    function drawScope(t) {
      const S = scope.width;
      const c = S / 2;
      const R = S * 0.3;
      sx.clearRect(0, 0, S, S);
      const rot = t * 0.00008;

      if (freqData) {
        const bars = 72;
        sx.strokeStyle = alpha(colors.a2, 0.55);
        sx.lineWidth = S / 220;
        sx.beginPath();
        for (let i = 0; i < bars; i++) {
          const v = freqData[Math.floor((i / bars) * freqData.length * 0.5)] / 255;
          const a = rot + (i / bars) * Math.PI * 2;
          const r0 = R * 0.62;
          const r1 = r0 + v * R * 0.32;
          sx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
          sx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        }
        sx.stroke();
      }

      const N = 256;
      sx.strokeStyle = colors.a1;
      sx.lineWidth = S / 130;
      sx.shadowColor = colors.a1;
      sx.shadowBlur = S / 18;
      sx.beginPath();
      for (let i = 0; i <= N; i++) {
        const idx = i % N;
        const v = timeData && analyser
          ? timeData[Math.floor((idx / N) * timeData.length)]
          : 0.02 * Math.sin(idx * 0.3 + t * 0.002);
        const a = -rot * 2 + (idx / N) * Math.PI * 2;
        const r = R + v * R * 0.9 + bass * R * 0.15;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        i ? sx.lineTo(x, y) : sx.moveTo(x, y);
      }
      sx.stroke();
      sx.shadowBlur = 0;

      // crosshair ticks, like a radar
      sx.strokeStyle = alpha(colors.a3, 0.35);
      sx.lineWidth = S / 300;
      for (let q = 0; q < 4; q++) {
        const a = rot * 3 + (q * Math.PI) / 2;
        sx.beginPath();
        sx.moveTo(c + Math.cos(a) * R * 1.35, c + Math.sin(a) * R * 1.35);
        sx.lineTo(c + Math.cos(a) * R * 1.5, c + Math.sin(a) * R * 1.5);
        sx.stroke();
      }
    }

    function loop(t) {
      if (frame++ % 20 === 0) readTheme();
      listen();
      drawField(t);
      drawScope(t);
      document.documentElement.style.setProperty("--pulse", bass.toFixed(3));
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
