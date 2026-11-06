# LOOPFIELD

> // intercepted transmissions · sector 7 · cycle 2089

Dystopian electronic music written as code. Every song here is a short program: drums, bass, chords and noise described as patterns that loop, mutate and decay while they play.

**▶ Listen and edit live: [alex-quiterio.github.io/loopfield](https://alex-quiterio.github.io/loopfield/)**

## The transmissions

| # | Song | Style | Key | Signal |
| --- | --- | --- | --- | --- |
| 01 | [Curfew](songs/curfew.strudel) | industrial techno · 132 bpm | F phrygian | The sirens start at bar 9. Stay indoors. |
| 02 | [The Arcology Sleeps](songs/arcology.strudel) | dark ambient · 84 bpm | D locrian | Eleven million people dreaming in a concrete hive. Something hums in the walls. |
| 03 | [Surveillance Choir](songs/surveillance-choir.strudel) | darkwave · 108 bpm | C# harmonic minor | The city sings to you through every speaker. It knows your name. |
| 04 | [Signal Lost](songs/signal-lost.strudel) | glitch electro · 140 bpm | E phrygian | The last transmission from the outer districts, arriving in pieces. |

## How the music is made

The songs are written in [Strudel](https://strudel.cc), the JavaScript port of [TidalCycles](https://tidalcycles.org), a language built for live-coding music. A song is a `stack` of patterns, one per instrument:

```js
setcpm(132/4)                                  // 132 bpm, one cycle per bar

stack(
  s("bd*4").bank("RolandTR909").distort(1.2),  // four-on-the-floor 909 kick
  n("[~ 0 0 <0 1>]*4").scale("F1:phrygian")    // offbeat acid bass in F phrygian
    .s("sawtooth").lpf(sine.range(250, 1800).slow(16)).lpq(14),
)
```

A few ideas do most of the work:

- **Mini-notation.** `"bd*4"` is four kicks per bar, `"[~ hh]*4"` is offbeat hats, `"rim(5,16,3)"` is a Euclidean rhythm and `"<a b>"` alternates bar by bar.
- **Scales, not notes.** Melodies are written as scale degrees (`n("0 2 4")`) and `.scale()` maps them to pitches, so a whole song changes mood by swapping one word.
- **Continuous signals.** `sine`, `perlin` and `rand` modulate filters, volume and panning, which keeps a loop moving for minutes.
- **Arrangement as pattern.** `.mask("<0!8 1!8>")` keeps a part silent for 8 bars and then lets it in. `.degradeBy()` makes it fall apart on purpose.

## Run it locally

The player fetches the `.strudel` files, so serve the folder rather than opening it as a file:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Click a song, then edit any line and press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to hear the change. **Open in Strudel** sends your current version to [strudel.cc](https://strudel.cc), where you can save and share it.

## Also on this frequency: the sequencer

[`sequencer/`](sequencer/) is the same idea from the other end: a 16-step drum machine with bass and lead piano rolls, where every sound is synthesised from oscillators and noise with the raw Web Audio API. No libraries, no samples. It has a lookahead clock with swing, drag-to-paint steps, accents, scale-locked melodies and a tempo-synced echo.

## Write your own transmission

1. Add `songs/<name>.strudel`. The first line is `// TITLE — style · bpm · key`, the second is a one-line story.
2. Add `<name>` to the `SONGS` list in `player.js`.

## Credits

Built on [Strudel](https://strudel.cc) by Felix Roos, Alex McLean and contributors (AGPL-3.0), loaded from a CDN at runtime. Drum sounds come from the Tidal drum machine and Dirt-Samples collections that Strudel loads.
