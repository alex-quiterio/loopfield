// Loads the songs in songs/ into a Strudel editor and drives it.
const SONGS = ["curfew", "arcology", "surveillance-choir", "signal-lost"];

const $ = (sel) => document.querySelector(sel);
const repl = $("#repl");
let current = null;

// Each song's first two comment lines are its title/meta and its blurb.
function parse(id, code) {
  const [first = "", second = ""] = code.split("\n");
  const [title, meta = ""] = first.replace(/^\/\/\s*/, "").split(/\s+—\s+/);
  const blurb = second.startsWith("//") ? second.replace(/^\/\/\s*/, "") : "";
  return { id, code, title, meta, blurb };
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

function markLive(live) {
  document.querySelectorAll(".track").forEach((b) => b.classList.toggle("live", live && b.dataset.id === current?.id));
}

async function select(song, autoplay) {
  current = song;
  const editor = await editorReady();
  editor.setCode(song.code);
  $("#now").textContent = song.title;
  $("#meta").textContent = song.meta;
  $("#blurb").textContent = song.blurb;
  document.querySelectorAll(".track").forEach((b) => b.classList.toggle("active", b.dataset.id === song.id));
  history.replaceState(null, "", "#" + song.id);
  if (autoplay) {
    await editor.evaluate();
    markLive(true);
  } else {
    markLive(false);
  }
}

function renderList(songs) {
  const nav = $("#tracks");
  songs.forEach((song, i) => {
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

$("#play").addEventListener("click", async () => {
  const editor = await editorReady();
  await editor.evaluate();
  markLive(true);
});

$("#stop").addEventListener("click", async () => {
  const editor = await editorReady();
  await editor.stop();
  markLive(false);
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
      SONGS.map(async (id) => {
        const res = await fetch(`songs/${id}.strudel`);
        if (!res.ok) throw new Error(`${id}: ${res.status}`);
        return parse(id, await res.text());
      }),
    );
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
