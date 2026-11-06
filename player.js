// Loads the songs in songs/ into a Strudel editor and drives it.
const CHAPTERS = [
  { name: "I · the city, 2089", theme: "city", songs: ["curfew", "arcology", "surveillance-choir", "signal-lost"] },
  { name: "II · the old world", theme: "old", songs: ["the-long-road-east", "halls-under-the-mountain", "the-ember-crown"] },
  { name: "III · the edges of the map", theme: "edge", songs: ["polar-night-station", "red-earth-gathering"] },
];
const SONGS = CHAPTERS.flatMap((c) => c.songs.map((id) => ({ id, chapter: c })));

const $ = (sel) => document.querySelector(sel);
const repl = $("#repl");
let current = null;

// Each song's first two comment lines are its title/meta and its blurb.
function parse({ id, chapter }, code) {
  const [first = "", second = ""] = code.split("\n");
  const [title, meta = ""] = first.replace(/^\/\/\s*/, "").split(/\s+—\s+/);
  const blurb = second.startsWith("//") ? second.replace(/^\/\/\s*/, "") : "";
  return { id, chapter, code, title, meta, blurb };
}

// strudel.cc reads the code from the URL hash as base64 of its UTF-8 bytes.
function strudelLink(code) {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "https://strudel.cc/#" + encodeURIComponent(btoa(bin));
}

function editorReady() {
  return new Promise((resolve) => {
    const check = () => (repl.editor ? resolve(repl.editor) : setTimeout(check, 50));
    check();
  });
}

// Read the tempo from setcpm(132/4) or setcpm(28) in the code being played.
function songCpm(code) {
  const m = code.match(/setcpm\(\s*([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const v = +m[1] / (m[2] ? +m[2] : 1);
  return Number.isFinite(v) && v > 0 ? v : null;
}

let startedAt = null;
let cpm = null;

function markLive(live) {
  document.querySelectorAll(".track").forEach((b) => b.classList.toggle("live", live && b.dataset.id === current?.id));
  startedAt = live ? performance.now() : null;
  cpm = live ? songCpm(repl.editor?.code || current?.code || "") : null;
  tickBar();
}

function tickBar() {
  const el = $("#bar");
  if (!startedAt || !cpm) {
    el.textContent = "";
    return;
  }
  const bar = Math.floor(((performance.now() - startedAt) / 60000) * cpm) + 1;
  el.textContent = `· bar ${String(bar).padStart(3, "0")}`;
}
setInterval(tickBar, 100);

let allSongs = [];
let playing = false;

async function play() {
  const editor = await editorReady();
  await editor.evaluate();
  playing = true;
  markLive(true);
}

async function stop() {
  const editor = await editorReady();
  await editor.stop();
  playing = false;
  markLive(false);
}

function step(by) {
  if (!allSongs.length) return;
  const i = allSongs.indexOf(current);
  const next = allSongs[(i + by + allSongs.length) % allSongs.length];
  select(next, playing);
}

async function select(song, autoplay) {
  current = song;
  const editor = await editorReady();
  editor.setCode(song.code);
  $("#now").textContent = song.title;
  $("#meta").textContent = song.meta;
  $("#blurb").textContent = song.blurb;
  document.body.dataset.theme = song.chapter.theme;
  document.querySelectorAll(".track").forEach((b) => b.classList.toggle("active", b.dataset.id === song.id));
  history.replaceState(null, "", "#" + song.id);
  if (autoplay) await play();
  else markLive(false);
}

function renderList(songs) {
  const nav = $("#tracks");
  songs.forEach((song, i) => {
    if (song.chapter !== songs[i - 1]?.chapter) {
      const h = document.createElement("p");
      h.className = "chapter";
      h.textContent = song.chapter.name;
      nav.appendChild(h);
    }
    const b = document.createElement("button");
    b.className = "track";
    b.dataset.id = song.id;
    b.innerHTML = `<span class="num">${String(i + 1).padStart(2, "0")}</span>
      <span class="title"></span><span class="sub"></span>`;
    b.querySelector(".title").textContent = song.title;
    b.querySelector(".sub").textContent = song.meta;
    b.addEventListener("click", () => select(song, true));
    nav.appendChild(b);
  });
}

$("#play").addEventListener("click", play);
$("#stop").addEventListener("click", stop);

// Keyboard: 1-9 pick a song, space plays or cuts, arrows step, R picks at random.
// Ignored while typing in the code editor, which has its own Strudel shortcuts.
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.(".cm-editor, input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key) && allSongs[+e.key - 1]) select(allSongs[+e.key - 1], true);
  else if (e.code === "Space") playing ? stop() : play();
  else if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
  else if (e.key.toLowerCase() === "r") {
    const others = allSongs.filter((s) => s !== current);
    select(others[Math.floor(Math.random() * others.length)], true);
  } else return;
  e.preventDefault();
});

// Open whatever is in the editor right now, including your edits.
$("#open").addEventListener("click", (e) => {
  const code = repl.editor?.code || current?.code || "";
  e.currentTarget.href = strudelLink(code);
});

function tickClock() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("#clock").textContent = `cycle 2089 · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
tickClock();
setInterval(tickClock, 1000);

(async () => {
  try {
    const songs = await Promise.all(
      SONGS.map(async (entry) => {
        const res = await fetch(`songs/${entry.id}.strudel`);
        if (!res.ok) throw new Error(`${entry.id}: ${res.status}`);
        return parse(entry, await res.text());
      }),
    );
    allSongs = songs;
    renderList(songs);
    const fromHash = songs.find((s) => s.id === location.hash.slice(1));
    select(fromHash || songs[0], false);
  } catch (err) {
    $("#now").textContent = "signal lost";
    $("#blurb").textContent =
      "Could not load the songs. Serve this folder over HTTP (for example `python3 -m http.server`) instead of opening the file directly.";
    console.error(err);
  }
})();
