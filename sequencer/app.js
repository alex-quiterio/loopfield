const STEPS = 16;
const DRUMS = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "clap", name: "Clap" },
  { id: "hat", name: "Hat" },
  { id: "open", name: "Open hat" },
  { id: "perc", name: "Perc" },
];
const SYNTHS = [
  { id: "bass", name: "Bass", octave: 36 },
  { id: "lead", name: "Lead", octave: 60 },
];
const TRACKS = [...DRUMS.map((d) => d.id), ...SYNTHS.map((s) => s.id)];
const ROWS = 8; // scale degrees shown in each piano roll, low to high

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  "minor pentatonic": [0, 3, 5, 7, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function emptyPattern() {
  return {
    drums: Object.fromEntries(DRUMS.map((d) => [d.id, Array(STEPS).fill(0)])),
    bass: Array(STEPS).fill(-1),
    lead: Array(STEPS).fill(-1),
  };
}

const state = {
  bpm: 124,
  swing: 0.12,
  root: 9, // A
  scale: "minor",
  cutoff: 0.85,
  delay: 0.3,
  master: 0.8,
  levels: Object.fromEntries(TRACKS.map((id) => [id, 0.8])),
  muted: {},
  pattern: emptyPattern(),
};

const pat = () => state.pattern;
function changed() {}

// Scale degree -> MIDI note, wrapping into higher octaves.
function degreeToMidi(degree, base) {
  const sc = SCALES[state.scale];
  return base + state.root + sc[degree % sc.length] + 12 * Math.floor(degree / sc.length);
}
const noteName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

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

function renderRolls() {
  for (const syn of SYNTHS) {
    const el = $(`#${syn.id}`);
    el.innerHTML = "";
    const head = document.createElement("div");
    head.className = "row";
    head.innerHTML = rowHead(syn.id, syn.name) + "<div></div>";
    el.appendChild(head);
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = document.createElement("div");
      row.className = "row note-row";
      row.innerHTML = `<div class="head note">${noteName(degreeToMidi(r, syn.octave))}</div><div class="steps"></div>`;
      const steps = row.querySelector(".steps");
      for (let s = 0; s < STEPS; s++) steps.appendChild(makeCell({ kind: "note", track: syn.id, row: r, step: s }));
      el.appendChild(row);
    }
  }
}

function refreshCell(c) {
  const s = +c.dataset.step;
  if (c.dataset.kind === "drum") {
    const v = pat().drums[c.dataset.track][s];
    c.classList.toggle("on", v > 0);
    c.classList.toggle("accent", v === 2);
  } else {
    c.classList.toggle("accent", pat()[c.dataset.track][s] === +c.dataset.row);
  }
}

function refreshColumn(track, s) {
  $$(`.cell[data-track="${track}"][data-step="${s}"]`).forEach(refreshCell);
}

function refresh() {
  $$(".cell").forEach(refreshCell);
  $$("[data-mute]").forEach((b) => b.classList.toggle("on", !!state.muted[b.dataset.mute]));
  $$("[data-level]").forEach((i) => (i.value = state.levels[i.dataset.level]));
  $("#bpm").value = state.bpm;
  $("#swing").value = state.swing;
  $("#root").value = state.root;
  $("#scale").value = state.scale;
  $("#cutoff").value = state.cutoff;
  $("#delay").value = state.delay;
  $("#master").value = state.master;
}

function render() {
  renderDrums();
  renderRolls();
  refresh();
}

$("#root").innerHTML = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join("");
$("#scale").innerHTML = Object.keys(SCALES).map((s) => `<option>${s}</option>`).join("");

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
  // Piano roll: one note per step. Clicking the lit note erases, otherwise draws.
  return { kind, track, erase: pat()[track][s] === +c.dataset.row };
}

function applyPaint(c) {
  const s = +c.dataset.step;
  if (paint.kind === "drum") {
    pat().drums[paint.track][s] = paint.value;
    refreshCell(c);
    return;
  }
  const notes = pat()[paint.track];
  const row = +c.dataset.row;
  if (paint.erase) {
    if (notes[s] === row) notes[s] = -1;
  } else {
    notes[s] = row;
  }
  refreshColumn(paint.track, s);
}

function audition(c) {
  if (!Engine.ctx || playing) return;
  const t = Engine.ctx.currentTime;
  if (c.dataset.kind === "drum") {
    if (paint.value) Engine.trigger(c.dataset.track, t, 0.8);
  } else if (!paint.erase) {
    const syn = SYNTHS.find((x) => x.id === c.dataset.track);
    Engine[syn.id](t, degreeToMidi(+c.dataset.row, syn.octave), 0.2);
  }
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
  Engine.setDelay(state.delay);
  Engine.setDelayTime(state.bpm);
  for (const id of Object.keys(state.levels)) Engine.setTrackLevel(id, state.muted[id] ? 0 : state.levels[id]);
}

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.level) state.levels[t.dataset.level] = +t.value;
  else if (t.id === "bpm") state.bpm = Math.min(200, Math.max(60, +t.value || 120));
  else if (t.id === "swing") state.swing = +t.value;
  else if (t.id === "cutoff") state.cutoff = +t.value;
  else if (t.id === "delay") state.delay = +t.value;
  else if (t.id === "master") state.master = +t.value;
  else return;
  applyMix();
  changed();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "root") state.root = +e.target.value;
  else if (e.target.id === "scale") state.scale = e.target.value;
  else return;
  renderRolls();
  refresh();
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
  for (const syn of SYNTHS) {
    const deg = p[syn.id][s];
    if (deg < 0) continue;
    // Bass stays tight; a lead note rings into one empty step after it.
    let len = 1;
    while (s + len < STEPS && p[syn.id][s + len] === -1 && syn.id === "lead" && len < 2) len++;
    Engine[syn.id](time, degreeToMidi(deg, syn.octave), stepDur() * len * 0.85);
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
