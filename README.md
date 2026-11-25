# Particle — 7×7 chain reaction

A two-player board game about particle physics you can play in a browser. Every cell holds
particles, and a cell splits when it is full: **2** in a corner, **3** on an edge, **4** inside.
A split fires one particle into each orthogonal neighbour and recolours it for the player who
split — so one placement can cascade across the board.

## Rules

- Players alternate. On your turn place one particle in an empty cell, or in a cell you already own.
- When a cell reaches capacity it splits: its particles are spent, and each orthogonal neighbour
  gains one particle of your colour.
- A cell that fills from a split splits as well — the whole wave resolves before the turn ends.
- You lose when you have no particles left on the board. Wipe out the other colour to win.

The 7×7 board has 4 corner cells (capacity 2), 20 edge cells (capacity 3) and 25 interior cells
(capacity 4). Corners are cheap to fire but easy to lose; interior cells hold more but need three
placements to split.

## Run locally

No build step and no dependencies — plain HTML, CSS and JavaScript. Serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

`.github/workflows/pages.yml` publishes `index.html`, `styles.css` and `game.js` to GitHub Pages on
every push to `main` (and on manual dispatch). The live game is at
`https://jason1015-coder.github.io/particle-game/`.
