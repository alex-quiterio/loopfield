// Loads the songs in songs/ into a Strudel editor and drives it, album by album.
const ALBUMS = [
  {
    id: "quixote",
    title: "The Quixote Protocol",
    kicker: "an album in six movements",
    lede: "From a rocket's countdown to a piece of land by the sea: machines that dream, voices that agree, a sky full of starlings, giants that are only windmills, and hope as a thing you do.",
    epigraph: "“The most important duty of our lives is to inspire one another.”",
    words: { play: "▶ play", stop: "■ pause", label: "now playing" },
    songs: ["poyekhali", "the-factory-that-dreams", "one-honest-node", "murmuration", "tilting-at-windmills", "active-hope"],
  },
  {
    id: "city",
    title: "Transmissions from 2089",
    kicker: "// intercepted · sector 7",
    lede: "Four signals recovered from a city that never sleeps. Sirens, hives, choirs that know your name, and the last broadcast from the outer districts.",
    words: { play: "▶ transmit", stop: "■ cut", label: "now decoding" },
    songs: ["curfew", "arcology", "surveillance-choir", "signal-lost"],
  },
  {
    id: "old",
    title: "The Old World",
    kicker: "~ songs from before the machines ~",
    lede: "Fire, stone and a long road east. Flutes on green hills, voices under the mountain, and a crown burning on the horizon.",
    words: { play: "▶ begin", stop: "■ rest", label: "now telling" },
    songs: ["the-long-road-east", "halls-under-the-mountain", "the-ember-crown"],
  },
  {
    id: "edge",
    title: "Edges of the Map",
    kicker: "70°N · and somewhere far south",
    lede: "Ice at one end of the world and drums at the other. A research station in the polar night, and a fire with everyone around it.",
    words: { play: "▶ listen", stop: "■ silence", label: "now receiving" },
    songs: ["polar-night-station", "red-earth-gathering"],
  },
];

const $ = (sel) => document.querySelector(sel);
const repl = $("#repl");

let songs = [];
let album = ALBUMS[0];
let current = null;
let playing = false;
let startedAt = null;
let cpm = null;
let advancing = false;

// Header lines: "// TITLE — meta", "// blurb", and for album tracks "// 132 bars · 6:00".
function parse(id, albumId, code) {
  const lines = code.split("\n");
  const strip = (l = "") => (l.startsWith("//") ? l.replace(/^\/\/\s*/, "") : "");
  const [title, meta = ""] = strip(lines[0]).split(/\s+—\s+/);
  const length = strip(lines[2]).match(/^(\d+) bars · (\d+:\d\d)/);
  return {
    id,
    album: albumId,
    code,
    title,
    meta,
    blurb: strip(lines[1]),
    bars: length ? +length[1] : null,
    length: length ? length[2] : null,
  };
}

const songsOf = (albumId) => songs.filter((s) => s.album === albumId);
const fmt = (secs) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

function albumLength(list) {
  if (!list.every((s) => s.length)) return "";
  const secs = list.reduce((t, s) => {
    const [m, ss] = s.length.split(":");
    return t + +m * 60 + +ss;
  }, 0);
  return ` · ${Math.round(secs / 60)} min`;
}

// strudel.cc reads the code from the URL hash as base64 of its UTF-8 bytes.
function strudelLink(code) {
  let bin = "";
  for (const b of new TextEncoder().encode(code)) bin += String.fromCharCode(b);
  return "https://strudel.cc/#" + encodeURIComponent(btoa(bin));
}

function songCpm(code) {
  const m = code.match(/setcpm\(\s*([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const v = +m[1] / (m[2] ? +m[2] : 1);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function editorReady() {
  return new Promise((resolve) => {
    const check = () => (repl.editor ? resolve(repl.editor) : setTimeout(check, 50));
    check();
  });
}

// --- albums ------------------------------------------------------------------
function renderAlbums() {
  const nav = $("#albums");
  nav.innerHTML = "";
  ALBUMS.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "album";
    b.dataset.id = a.id;
    b.innerHTML = `<img class="album-cover" alt="" /><span class="album-title"></span><span class="album-sub"></span>`;
    b.querySelector(".album-cover").src = `art/covers/${a.id}.svg`;
    b.querySelector(".album-cover").alt = `${["I", "II", "III", "IV"][i] || i + 1} · ${a.title} cover`;
    b.querySelector(".album-title").textContent = a.title;
    const list = songsOf(a.id);
    b.querySelector(".album-sub").textContent = `${list.length} tracks${albumLength(list)}`;
    b.addEventListener("click", () => openAlbum(a));
    nav.appendChild(b);
  });
}

function openAlbum(a) {
  album = a;
  document.body.dataset.album = a.id;
  $("#kicker-text").textContent = a.kicker;
  const title = $("#title");
  title.textContent = a.title;
  title.dataset.text = a.title;
  $("#lede").textContent = a.lede;
  $("#epigraph").textContent = a.epigraph || "";
  $("#epigraph").hidden = !a.epigraph;
  $("#play").textContent = a.words.play;
  $("#stop").textContent = a.words.stop;
  $("#label-text").textContent = a.words.label;
  document.querySelectorAll(".album").forEach((b) => b.classList.toggle("active", b.dataset.id === a.id));
  renderTracks();
  if (!playing) select(songsOf(a.id)[0], false);
}

function renderTracks() {
  const nav = $("#tracks");
  nav.innerHTML = "";
  songsOf(album.id).forEach((song, i) => {
    const b = document.createElement("button");
    b.className = "track";
    b.dataset.id = song.id;
    b.innerHTML = `<span class="num"></span><span class="title"></span><span class="dur"></span><span class="sub"></span>`;
    b.querySelector(".num").textContent = String(i + 1).padStart(2, "0");
    b.querySelector(".title").textContent = song.title;
    b.querySelector(".dur").textContent = song.length || "";
    b.querySelector(".sub").textContent = song.meta;
    b.addEventListener("click", () => select(song, true));
    nav.appendChild(b);
  });
  markTracks();
}

function markTracks() {
  document.querySelectorAll(".track").forEach((b) => {
    b.classList.toggle("active", b.dataset.id === current?.id);
    b.classList.toggle("live", playing && b.dataset.id === current?.id);
  });
}

// --- playback ----------------------------------------------------------------
async function select(song, autoplay) {
  if (!song) return;
  if (song.album !== album.id) openAlbum(ALBUMS.find((a) => a.id === song.album));
  const editor = await editorReady();
  // Arrangements count bars from the moment playback starts, so restart the clock.
  if (autoplay && playing) await editor.stop();
  current = song;
  editor.setCode(song.code);
  $("#now").textContent = song.title;
  $("#meta").textContent = song.meta + (song.length ? ` · ${song.length}` : "");
  $("#blurb").textContent = song.blurb;
  history.replaceState(null, "", "#" + song.id);
  if (autoplay) await start();
  else markTracks();
}

async function start() {
  const editor = await editorReady();
  await editor.evaluate();
  playing = true;
  startedAt = performance.now();
  cpm = songCpm(repl.editor?.code || current?.code || "");
  markTracks();
}

// While playing, the play button re-applies your edits without restarting the clock.
async function play() {
  if (!playing) return start();
  const editor = await editorReady();
  await editor.evaluate();
  cpm = songCpm(editor.code || "") || cpm;
}

async function stop() {
  const editor = await editorReady();
  await editor.stop();
  playing = false;
  startedAt = null;
  markTracks();
}

function tick() {
  const fill = $("#progress-fill");
  if (!playing || !startedAt || !cpm) {
    $("#bar").textContent = "";
    $("#time").textContent = current?.length ? `0:00 / ${current.length}` : "";
    fill.style.width = "0%";
    return;
  }
  const secs = (performance.now() - startedAt) / 1000;
  const bars = (secs / 60) * cpm;
  $("#bar").textContent = `· bar ${String(Math.floor(bars) + 1).padStart(3, "0")}${current.bars ? " / " + current.bars : ""}`;
  if (!current.bars) {
    $("#time").textContent = fmt(secs);
    fill.style.width = "0%";
    return;
  }
  $("#time").textContent = `${fmt(secs)} / ${current.length}`;
  fill.style.width = `${Math.min(100, (bars / current.bars) * 100)}%`;
  // An album plays through: at the end of a track, the next one begins.
  if (bars >= current.bars && !advancing) {
    advancing = true;
    const list = songsOf(current.album);
    const next = list[list.indexOf(current) + 1];
    (next ? select(next, true) : stop()).finally(() => (advancing = false));
  }
}
setInterval(tick, 100);

function step(by) {
  const list = songsOf(album.id);
  if (!list.length) return;
  const i = list.indexOf(current);
  select(list[(i + by + list.length) % list.length], playing);
}

function stepAlbum(by) {
  const i = ALBUMS.indexOf(album);
  openAlbum(ALBUMS[(i + by + ALBUMS.length) % ALBUMS.length]);
}

$("#play").addEventListener("click", play);
$("#stop").addEventListener("click", stop);

// Open whatever is in the editor right now, including your edits.
$("#open").addEventListener("click", (e) => {
  e.currentTarget.href = strudelLink(repl.editor?.code || current?.code || "");
});

// Keyboard, ignored while typing in the code editor (it has its own Strudel keys).
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.(".cm-editor, input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const list = songsOf(album.id);
  if (/^[1-9]$/.test(e.key) && list[+e.key - 1]) select(list[+e.key - 1], true);
  else if (e.code === "Space") playing ? stop() : current && select(current, true);
  else if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
  else if (e.key === "]") stepAlbum(1);
  else if (e.key === "[") stepAlbum(-1);
  else if (e.key.toLowerCase() === "r") {
    const others = list.filter((s) => s !== current);
    if (others.length) select(others[Math.floor(Math.random() * others.length)], true);
  } else return;
  e.preventDefault();
});

function tickClock() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("#clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
tickClock();
setInterval(tickClock, 1000);

(async () => {
  try {
    songs = await Promise.all(
      ALBUMS.flatMap((a) =>
        a.songs.map(async (id) => {
          const res = await fetch(`songs/${id}.strudel`);
          if (!res.ok) throw new Error(`${id}: ${res.status}`);
          return parse(id, a.id, await res.text());
        }),
      ),
    );
    renderAlbums();
    const fromHash = songs.find((s) => s.id === location.hash.slice(1));
    if (fromHash) {
      openAlbum(ALBUMS.find((a) => a.id === fromHash.album));
      select(fromHash, false);
    } else {
      openAlbum(ALBUMS[0]);
    }
  } catch (err) {
    $("#now").textContent = "signal lost";
    $("#blurb").textContent =
      "Could not load the songs. Serve this folder over HTTP (for example `npx serve`) instead of opening the file directly.";
    console.error(err);
  }
})();
