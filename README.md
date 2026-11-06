# LOOPFIELD

> // intercepted transmissions · sector 7 · cycle 2089

Electronic music written as code. Every song here is a short program: drums, bass, chords and noise described as patterns that loop, mutate and decay while they play. Pick one, press play, and rewrite it while it runs.

**▶ Listen and edit live: [alex-quiterio.github.io/loopfield](https://alex-quiterio.github.io/loopfield/)**

## The transmissions

### I · The city, 2089

| # | Song | Style | Key | Signal |
| --- | --- | --- | --- | --- |
| 01 | [Curfew](songs/curfew.strudel) | industrial techno · 132 bpm | F phrygian | The sirens start at bar 9. Stay indoors. |
| 02 | [The Arcology Sleeps](songs/arcology.strudel) | dark ambient · 84 bpm | D locrian | Eleven million people dreaming in a concrete hive. Something hums in the walls. |
| 03 | [Surveillance Choir](songs/surveillance-choir.strudel) | darkwave · 108 bpm | C# harmonic minor | The city sings to you through every speaker. It knows your name. |
| 04 | [Signal Lost](songs/signal-lost.strudel) | glitch electro · 140 bpm | E phrygian | The last transmission from the outer districts, arriving in pieces. |

### II · The old world

| # | Song | Style | Key | Signal |
| --- | --- | --- | --- | --- |
| 05 | [The Long Road East](songs/the-long-road-east.strudel) | pastoral folk · 6/8 | D mixolydian | Green hills, a borrowed walking stick, and a road that goes on further than anyone meant to walk. |
| 06 | [Halls Under the Mountain](songs/halls-under-the-mountain.strudel) | dark choral · 64 bpm | D phrygian | Forges that have burned for a thousand years, and voices that remember why. |
| 07 | [The Ember Crown](songs/the-ember-crown.strudel) | epic hybrid · 140 bpm | C minor | Banners on the ridge, a crown of fire on the horizon, and no road back. |

### III · The edges of the map

| # | Song | Style | Key | Signal |
| --- | --- | --- | --- | --- |
| 08 | [Polar Night Station](songs/polar-night-station.strudel) | arctic ambient · 72 bpm | E dorian | Seventy degrees north. The sun left in November. The instruments are still listening. |
| 09 | [Red Earth Gathering](songs/red-earth-gathering.strudel) | tribal percussion · 118 bpm | A minor pentatonic | A fire in the middle, drums all around it, and a rhythm older than any city. |

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

- **Mini-notation.** `"bd*4"` is four kicks per bar, `"[~ hh]*4"` is offbeat hats, `"lt(3,8)"` is a Euclidean rhythm and `"<a b>"` alternates bar by bar.
- **Scales, not notes.** Melodies are written as scale degrees (`n("0 2 4")`) and `.scale()` maps them to pitches, so a whole song changes mood by swapping one word.
- **Continuous signals.** `sine`, `perlin` and `rand` modulate filters, volume and panning, which keeps a loop moving for minutes.
- **Arrangement as pattern.** `.mask("<0!8 1!8>")` keeps a part silent for 8 bars and then lets it in. `.degradeBy()` makes it fall apart on purpose.

## The player

- **Live editing.** Change any line and press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>; <kbd>Ctrl</kbd> + <kbd>.</kbd> stops. **Open in Strudel** sends your edited version to [strudel.cc](https://strudel.cc) to save or share.
- **Visuals that listen.** A circular oscilloscope and a particle field (rain in the city, embers in the old world, snow at the edges) react to the audio itself, so they follow your edits too.
- **A palette per chapter**, and a bar counter read from each song's tempo.
- **Keys.** <kbd>1</kbd>–<kbd>9</kbd> pick a song, <kbd>Space</kbd> plays or stops, arrows step through, <kbd>R</kbd> picks one at random.

## Run it locally

The player fetches the `.strudel` files, so serve the folder rather than opening it as a file:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Write your own transmission

1. Add `songs/<name>.strudel`. The first line is `// TITLE — style · bpm · key`, the second is a one-line story.
2. Add `<name>` to a chapter in `CHAPTERS` at the top of `player.js`.

Sounds available out of the box: the built-in synths (`sine`, `square`, `sawtooth`, `triangle`, `supersaw`, `white`, `pink`, `crackle`), the Tidal drum machines via `.bank()` (`RolandTR909`, `RolandTR808`, `LinnDrum` and more), General MIDI instruments (`gm_flute`, `gm_choir_aahs`, `gm_taiko_drum`…), and a few Dirt-Samples sets (`wind`, `metal`, `space`, `numbers`, `crow`).

## Credits

Built on [Strudel](https://strudel.cc) by Felix Roos, Alex McLean and contributors (AGPL-3.0), loaded from a CDN at runtime. Drum and instrument sounds come from the Tidal drum machines, General MIDI soundfonts and Dirt-Samples collections that Strudel loads.
