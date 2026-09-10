# Rosin Invaders

An arcade shooter where the invaders are cakes of double bass rosin.

**[Play it →](https://ghillstr.github.io/rosinInvaders/)**

## The idea

Every bassist owns a drawer of rosin they no longer use — each brand in its own
distinctive tin, each one swearing it is the answer to your sound. This is that
drawer, descending on you in formation.

You pick a season first. Winter and Summer rosins are formulated for different
climates, so the game makes you choose a side and defend it: you fly the icon of
your season, and the opposing formation comes for you.

## How to play

| Key | Action |
| --- | --- |
| `←` `→` or `A` `D` | Move |
| `Space` (hold) | Fire |

Six waves, one rosin colour each — Violet, Blue, Grey, Brown, Black, and Red.
Clear Red and you have run the whole gauntlet. You get three lives, and the
clock runs the entire time: the game keeps your best completion time rather
than only a high score, so the goal is to get through it faster than last time.

Each wave is harder than the last. The formation grows to as many as five rows,
sweeps across faster, takes more hits to break, and shoots back sooner.

## Running it locally

No build step and no dependencies.

```bash
npm start          # serves on http://localhost:3000
```

`server.js` is a small static file server for convenience — nothing more. You
can open `index.html` straight from disk, or serve the folder with anything
else (`python3 -m http.server`) and it behaves identically.

## How it is built

Plain HTML, CSS, and about 1,700 lines of JavaScript drawing to a `<canvas>`.
No framework, no bundler, no dependencies in `package.json`.

- **Art** is hand-drawn SVG. Each rosin container is its own file in `assets/`,
  as are the two season icons.
- **Sound** is generated at runtime through the Web Audio API. Nothing is
  loaded from an audio file; every effect is an oscillator.
- **The background music** is a chiptune reduction of the scherzo from
  Beethoven's Fifth — a rising arpeggio in the low strings on a triangle wave,
  answered by the "fate" rhythm in the horns on a square wave, in the
  movement's triple meter. Bassists will recognise the third movement as the
  one that made them practise.
- **Your best time** is kept in `localStorage`, so it survives a reload but
  stays on your own machine.

Because browsers block audio until the page has been interacted with, sound
starts once you choose a season.
