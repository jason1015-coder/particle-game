# Particle Game — 7×7 board

A two-player turn-based board game about particle physics, played in the browser. Everything
lives in one self-contained `index.html` — no build step, no dependencies.

## The board

A 7×7 grid. The near side and the far side each start with one row of particles
(K⁰, K⁺, π⁺, π⁰, π⁻, K⁻, K̄⁰), and a neutral row of seven electrons sits across the middle.

## Rules

- Pieces move like queens — any distance along a rank, file or diagonal — and cannot pass
  through other pieces.
- Pieces are never captured. Antiparticle pairs (K⁰/K̄⁰, K⁺/K⁻, π⁺/π⁻, μ⁺/μ⁻, e⁺/e⁻)
  annihilate on contact. π⁰ has no partner and only blocks; γ leaves the board as light, and
  neutrinos never land on it.
- A turn is either one queen move, or one decay. Decays send the parent off the board and eject
  its products as far as possible in the directions you choose, one product at a time; a channel
  is only offered when there are enough free squares for its board products.
- Charged particles act on two rings. A like charge in the near ring (the eight squares it
  touches) is pushed one square outward into the outer ring; an opposite charge in the outer
  ring (two steps out) is drawn one square inward. Both resolve at the same time from the board
  as it was, so a shoved particle and a drawn-in one can trade squares. Touching opposites bind
  instead of moving, and a step that would leave the board or land on a particle staying put
  does not happen.
- Bound particles are stuck: no player can move them again, though the field can still drag
  them, and they may still decay.
- You win by annihilating the enemy K⁰, or by leaving the opponent with no move and no decay.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

`.github/workflows/pages.yml` publishes `index.html` to GitHub Pages on every push to `main`
(and on manual dispatch). The live game is at
`https://jason1015-coder.github.io/particle-game/`.
