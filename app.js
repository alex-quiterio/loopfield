const STEPS = 16;
const DRUMS = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "clap", name: "Clap" },
  { id: "hat", name: "Hat" },
  { id: "open", name: "Open hat" },
  { id: "perc", name: "Perc" },
];
const TRACKS = DRUMS.map((d) => d.id);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function emptyPattern() {
  return { drums: Object.fromEntries(DRUMS.map((d) => [d.id, Array(STEPS).fill(0)])) };
}

const state = {
  bpm: 124,
  swing: 0.12,
  cutoff: 0.85,
  master: 0.8,
  levels: Object.fromEntries(TRACKS.map((id) => [id, 0.8])),
  muted: {},
  pattern: emptyPattern(),
};

const pat = () => state.pattern;
function changed() {}

// --- rendering -------------------------------------------------------------
function rowHead(id, name) {
  return `<div class="head">
    <button class="mute" data-mute="${id}" title="Mute">M</button>
    <span>${name}</span>
    <input class="level" type="range" min="0" max="1" step="0.01" data-level="${id}" title="Level" />
  </div>`;
}

function makeCell(data) {
  const c = document.createElement("button");
  c.className = "cell";
  Object.assign(c.dataset, data);
  return c;
}

function renderDrums() {
  const el = $("#drums");
  el.innerHTML = "";
  for (const d of DRUMS) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = rowHead(d.id, d.name) + `<div class="steps"></div>`;
    const steps = row.querySelector(".steps");
    for (let s = 0; s < STEPS; s++) steps.appendChild(makeCell({ kind: "drum", track: d.id, step: s }));
    el.appendChild(row);
  }
}

function refreshCell(c) {
  const s = +c.dataset.step;
  if (c.dataset.kind === "drum") {
    const v = pat().drums[c.dataset.track][s];
    c.classList.toggle("on", v > 0);
    c.classList.toggle("accent", v === 2);
  }
}

function refresh() {
  $$(".cell").forEach(refreshCell);
  $$("[data-mute]").forEach((b) => b.classList.toggle("on", !!state.muted[b.dataset.mute]));
  $$("[data-level]").forEach((i) => (i.value = state.levels[i.dataset.level]));
  $("#bpm").value = state.bpm;
  $("#swing").value = state.swing;
  $("#cutoff").value = state.cutoff;
  $("#master").value = state.master;
}

function render() {
  renderDrums();
  refresh();
}

// --- painting steps --------------------------------------------------------
let paint = null;

function startPaint(c, shift) {
  const { kind, track } = c.dataset;
  const s = +c.dataset.step;
  if (kind === "drum") {
    const cur = pat().drums[track][s];
    const value = shift ? (cur === 2 ? 0 : 2) : cur ? 0 : 1;
    return { kind, track, value };
  }
  return null;
}

function applyPaint(c) {
  const s = +c.dataset.step;
  if (paint.kind === "drum") {
    pat().drums[paint.track][s] = paint.value;
    refreshCell(c);
  }
}

function audition(c) {
  if (!Engine.ctx || playing) return;
  if (c.dataset.kind === "drum" && paint.value) Engine.trigger(c.dataset.track, Engine.ctx.currentTime, 0.8);
}

document.addEventListener("pointerdown", (e) => {
  const c = e.target.closest(".cell");
  if (!c) return;
  e.preventDefault();
  paint = startPaint(c, e.shiftKey);
  if (!paint) return;
  applyPaint(c);
  audition(c);
});

document.addEventListener("pointermove", (e) => {
  if (!paint) return;
  const c = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cell");
  if (c && c.dataset.kind === paint.kind && c.dataset.track === paint.track) applyPaint(c);
});

document.addEventListener("pointerup", () => {
  if (!paint) return;
  paint = null;
  changed();
});

// --- mixer -----------------------------------------------------------------
function applyMix() {
  Engine.setCutoff(state.cutoff);
  Engine.setMaster(state.master);
  for (const id of Object.keys(state.levels)) Engine.setTrackLevel(id, state.muted[id] ? 0 : state.levels[id]);
}

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.level) state.levels[t.dataset.level] = +t.value;
  else if (t.id === "bpm") state.bpm = Math.min(200, Math.max(60, +t.value || 120));
  else if (t.id === "swing") state.swing = +t.value;
  else if (t.id === "cutoff") state.cutoff = +t.value;
  else if (t.id === "master") state.master = +t.value;
  else return;
  applyMix();
  changed();
});

document.addEventListener("click", (e) => {
  const m = e.target.closest("[data-mute]");
  if (!m) return;
  const id = m.dataset.mute;
  state.muted[id] = !state.muted[id];
  m.classList.toggle("on", state.muted[id]);
  applyMix();
  changed();
});

// --- sequencer clock (lookahead scheduler) ---------------------------------
let playing = false;
let step = 0;
let nextTime = 0;
let timer = null;
const visualQueue = [];

const stepDur = () => 60 / state.bpm / 4;

function scheduleStep(s, t) {
  const time = t + (s % 2 ? state.swing * stepDur() : 0);
  const p = pat();
  for (const d of DRUMS) {
    const v = p.drums[d.id][s];
    if (v) Engine.trigger(d.id, time, v === 2 ? 1 : 0.7);
  }
  visualQueue.push({ s, t: time });
}

function onBar() {}

function tick() {
  const ctx = Engine.ctx;
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(step, nextTime);
    nextTime += stepDur();
    step = (step + 1) % STEPS;
    if (step === 0) onBar();
  }
}

async function start() {
  Engine.init(TRACKS);
  applyMix();
  await Engine.ctx.resume();
  step = 0;
  nextTime = Engine.ctx.currentTime + 0.05;
  playing = true;
  tick();
  timer = setInterval(tick, 25);
  $("#play").classList.add("on");
  $("#play").textContent = "■ Stop";
}

function stop() {
  clearInterval(timer);
  playing = false;
  visualQueue.length = 0;
  $$(".cell.playhead").forEach((c) => c.classList.remove("playhead"));
  $("#play").classList.remove("on");
  $("#play").textContent = "▶ Play";
}

const toggle = () => (playing ? stop() : start());

function draw() {
  if (playing) {
    let cur = null;
    while (visualQueue.length && visualQueue[0].t <= Engine.ctx.currentTime) cur = visualQueue.shift();
    if (cur) {
      $$(".cell.playhead").forEach((c) => c.classList.remove("playhead"));
      $$(`.cell[data-step="${cur.s}"]`).forEach((c) => c.classList.add("playhead"));
    }
  }
  requestAnimationFrame(draw);
}

$("#play").addEventListener("click", toggle);

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return;
  if (e.code === "Space") {
    e.preventDefault();
    toggle();
  }
});

render();
requestAnimationFrame(draw);
