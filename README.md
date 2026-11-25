# Particle Game — Singularity

A small browser game built on actual particle physics. You are a gravity well: particles accelerate
toward you (`F ∝ 1/r`), bend into orbits, collide, and merge — conserving momentum as they clump.
Eat the clumps before the red anti-matter eats you.

## Play

- **Move** — mouse / touch drag, or `WASD` / arrow keys
- **Overcharge** — hold the mouse button or `Space` to widen and strengthen your gravity well
  (drains energy; it regenerates when you let go)
- **Blue motes** — mass and score. Colliding motes merge into heavier ones worth more.
- **Gold flares** — refill energy.
- **Red anti-matter** — burns mass and dents your score. It resists your pull, but not enough.

Mass reaching zero collapses you. Waves get denser and meaner every 13 seconds.

## Run locally

No build step, no dependencies — it's plain HTML/CSS/JS. Serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`, which copies the static files into `dist/`
and publishes them with GitHub Actions Pages. The game is served at
`https://jason1015-coder.github.io/particle-game/`.

Pages source must be **GitHub Actions** (the workflow enables this on first run); subsequent deploys
need no manual setup.
