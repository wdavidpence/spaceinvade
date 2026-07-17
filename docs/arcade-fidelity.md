# Space Invaders arcade fidelity (2026-07-17)

Canonical repo: `spaceinvade` (supersedes archived `space-invaders`).

## Target (1978 Taito / Midway upright)
- Fixed shooter, 5×11 ranks, laser base, bunkers, mystery ship
- Discrete step movement; speed/march tempo rises as invaders die
- Scoring: top 30 / mid 20 / bottom 10; UFO 50–300
- Game over if invaders reach the base line or lives exhausted
- Monochrome CRT green presentation; march / shoot / death / UFO siren via Web Audio

## Intentionally not emulated
- Cycle-accurate 8080 / CRT mirror moon backdrop artwork
- Cellophane strip hardware coloring (we use full-screen green phosphor)
- Original ROM samples (synthesized approximations)

## Mobile
- Touch L/R/Fire/Pause retained
- Kenney modern art/music removed from runtime path for authenticity
