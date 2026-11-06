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
    theme = document.body.dataset.album || "city";
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

    // a murmuration: each starling steers by its neighbours only (align, gather, keep
    // a little space), and they all drift around a roost point that wanders the sky
    const flock = [];
    function drawFlock(t) {
      if (!flock.length) {
        const n = reduce ? 80 : 220;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          flock.push({ x: W * (0.3 + Math.random() * 0.4), y: H * (0.2 + Math.random() * 0.3), vx: Math.cos(a), vy: Math.sin(a) });
        }
      }
      const R2 = (60 * dpr) ** 2;
      const sep2 = (14 * dpr) ** 2;
      const speed = (reduce ? 0.6 : 1.3 + level * 3) * dpr;
      const rx = W / 2 + Math.sin(t * 0.00013) * W * 0.28;
      const ry = H * 0.35 + Math.cos(t * 0.00017) * H * 0.18;
      for (const b of flock) {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
        for (const o of flock) {
          if (o === b) continue;
          const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > R2) continue;
          ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; n++;
          if (d2 < sep2) { sx -= dx; sy -= dy; }
        }
        if (n) {
          b.vx += (ax / n - b.vx) * 0.05 + ((cx / n - b.x) * 0.0006 + sx * 0.002) / dpr;
          b.vy += (ay / n - b.vy) * 0.05 + ((cy / n - b.y) * 0.0006 + sy * 0.002) / dpr;
        }
        // the roost pulls gently; a heavy bass note startles the flock outward
        const pull = 0.00003 - bass * 0.0004;
        b.vx += ((rx - b.x) * pull) / dpr;
        b.vy += ((ry - b.y) * pull) / dpr;
        const len = Math.hypot(b.vx, b.vy) || 1;
        b.vx /= len; b.vy /= len;
        b.x = (b.x + b.vx * speed + W) % W;
        b.y = (b.y + b.vy * speed + H) % H;
      }
      fx.strokeStyle = alpha(colors.a3, 0.6);
      fx.lineWidth = 1.4 * dpr;
      fx.beginPath();
      for (const b of flock) {
        fx.moveTo(b.x, b.y);
        fx.lineTo(b.x - b.vx * 4 * dpr, b.y - b.vy * 4 * dpr);
      }
      fx.stroke();
    }

    // rain in the city, embers in the old world, snow at the edges of the map,
    // and a night sky with starlings for the album
    function drawField(t) {
      fx.clearRect(0, 0, W, H);
      const k = (reduce ? 0.4 : 1) * (1 + level * 6);
      if (theme === "quixote") {
        for (const p of parts) {
          const tw = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.0008 + p.s * 40));
          fx.fillStyle = alpha(colors.a2, tw * p.z);
          fx.fillRect(p.x, p.y ?? 0, 1.2 * dpr * p.z, 1.2 * dpr * p.z);
        }
        drawFlock(t);
        return;
      }
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

    // each album draws its sound differently
    function drawScope(t) {
      if (theme === "old") return drawSun(t);
      if (theme === "edge") return drawAurora(t);
      if (theme === "quixote") return drawOrbit(t);
      return drawRing(t);
    }

    const sample = (i, n) =>
      timeData && analyser ? timeData[Math.floor((i / n) * timeData.length) % timeData.length] : 0.02 * Math.sin(i * 0.3 + performance.now() * 0.002);

    // the old world: a sun whose rays are the frequencies
    function drawSun(t) {
      const S = scope.width, c = S / 2, R = S * 0.16;
      sx.clearRect(0, 0, S, S);
      const g = sx.createRadialGradient(c, c, 0, c, c, R * (1.6 + level));
      g.addColorStop(0, alpha(colors.a3, 0.9));
      g.addColorStop(0.5, alpha(colors.a1, 0.5));
      g.addColorStop(1, "rgba(0,0,0,0)");
      sx.fillStyle = g;
      sx.fillRect(0, 0, S, S);
      if (!freqData) return;
      const rays = 48, rot = t * 0.00005;
      sx.strokeStyle = alpha(colors.a1, 0.8);
      sx.lineWidth = S / 160;
      sx.lineCap = "round";
      sx.beginPath();
      for (let i = 0; i < rays; i++) {
        const v = freqData[Math.floor((i / rays) * freqData.length * 0.4)] / 255;
        const a = rot + (i / rays) * Math.PI * 2;
        const r0 = R * 1.25, r1 = r0 + v * S * 0.3;
        sx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        sx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      }
      sx.stroke();
    }

    // the edges of the map: the waveform hung in the sky as layered aurora
    function drawAurora(t) {
      const S = scope.width;
      sx.clearRect(0, 0, S, S);
      const N = 128;
      for (let layer = 0; layer < 4; layer++) {
        const base = S * (0.3 + layer * 0.12);
        sx.strokeStyle = alpha(layer % 2 ? colors.a3 : colors.a1, 0.55 - layer * 0.1);
        sx.lineWidth = S / (90 + layer * 40);
        sx.shadowColor = colors.a1;
        sx.shadowBlur = S / 30;
        sx.beginPath();
        for (let i = 0; i <= N; i++) {
          const x = (i / N) * S;
          const drift = Math.sin(i * 0.05 + t * 0.0006 + layer) * S * 0.03;
          const y = base + drift + sample(i + layer * 17, N) * S * (0.35 - layer * 0.05);
          i ? sx.lineTo(x, y) : sx.moveTo(x, y);
        }
        sx.stroke();
      }
      sx.shadowBlur = 0;
      sx.strokeStyle = alpha(colors.a3, 0.25);
      sx.lineWidth = 1;
      sx.beginPath();
      sx.moveTo(0, S * 0.86);
      sx.lineTo(S, S * 0.86);
      sx.stroke();
    }

    // the album: the signal traced against itself a quarter-turn later, an orbit
    function drawOrbit(t) {
      const S = scope.width, c = S / 2, R = S * 0.36;
      sx.clearRect(0, 0, S, S);
      sx.strokeStyle = alpha(colors.a2, 0.25);
      sx.lineWidth = 1;
      sx.beginPath();
      sx.arc(c, c, R, 0, Math.PI * 2);
      sx.stroke();
      const a = t * 0.0004;
      sx.fillStyle = colors.a1;
      sx.beginPath();
      sx.arc(c + Math.cos(a) * R, c + Math.sin(a) * R, S / 70 + bass * S / 30, 0, Math.PI * 2);
      sx.fill();
      const N = 400, q = timeData ? Math.floor(timeData.length / 4) : 0;
      sx.strokeStyle = alpha(colors.a3, 0.85);
      sx.lineWidth = S / 220;
      sx.shadowColor = colors.a1;
      sx.shadowBlur = S / 24;
      sx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = timeData && analyser ? timeData[i % timeData.length] : 0.04 * Math.cos(i * 0.05 + t * 0.001);
        const y = timeData && analyser ? timeData[(i + q) % timeData.length] : 0.04 * Math.sin(i * 0.05 + t * 0.001);
        const px = c + x * R * 2.2, py = c + y * R * 2.2;
        i ? sx.lineTo(px, py) : sx.moveTo(px, py);
      }
      sx.stroke();
      sx.shadowBlur = 0;
    }

    // the city: a circular oscilloscope with a ring of frequency bars inside it
    function drawRing(t) {
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
