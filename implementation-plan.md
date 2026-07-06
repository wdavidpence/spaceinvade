# Space Invaders Mobile Clone: Research + 30-Step Build Plan

## Quick Research Notes

- 1978 arcade release by Taito, later licensed to Midway for North America.
- Core loop: player at bottom, 5x11 alien grid that moves horizontally, drops downward at edges, speeds up as survivors shrink.
- Player typically fires one shot at a time, with up to 3 lives and barrier blocks providing temporary cover.
- UFO ("mystery ship") appears at intervals and grants a bonus score when shot.
- Win condition is to clear all aliens; lose condition is letting one touch the ground/defenses, getting hit, or letting aliens reach player zone.
- iPhone implementation needs touch-first controls and responsive viewport scaling because browser controls differ from arcade hardware timing.

## 30-Step Execution Plan

1. Confirm game architecture: vanilla HTML/CSS/JS with canvas rendering.
2. Define a fixed logical world size (480x800) and viewport scaling strategy.
3. Add mobile-friendly HTML scaffolding and canvas container.
4. Add a HUD panel for score, high score, wave, and lives.
5. Add overlay states for title, game over, and wave messaging.
6. Add fixed-position touch controls (<, >, FIRE, Pause).
7. Add responsive styling with strong contrast and readable touch targets.
8. Add starfield background data and per-frame motion pass.
9. Add input handling for pointer/touch and keyboard fallback.
10. Build deterministic game state object with phases, score, wave, lives, entities.
11. Add local storage for high score persistence.
12. Implement player entity with movement bounds and invulnerability flash state.
13. Implement player shooting with cooldown and one-shot pacing.
14. Build 5x11 alien formation generation and per-row score values.
15. Implement alien movement loop with edge detection and downward stepping.
16. Add alien movement acceleration logic as survivors decrease.
17. Add periodic alien bullet shooting with lowest-alien-in-column strategy.
18. Implement barrier data model with breakable blocks and per-block health.
19. Add UFO/special ship spawn interval, direction randomization, score rewards.
20. Add collision detection between player shots and aliens, player, barriers, UFO.
21. Add collision for alien shots against player and barriers.
22. Implement alien hit scoring, UFO scoring, and score/beat best updates.
23. Implement life loss, player explosion feedback, and game-over handling.
24. Add wave clear detection and progression speed scaling.
25. Add sprite-like alien drawing and player cannon drawing in canvas.
26. Add bullet rendering, particle explosions, and visual polish.
27. Add game states for title, ready, running, paused, and game over.
28. Add restart flow and quick resume from pause.
29. Add Web Audio tone engine and gameplay SFX hooks (shoot/move/hit/ufo/start).
30. Finalize by linking all files and exposing a playable page for iPhone testing.

All 30 steps were executed in this implementation.

### Tuning Pass (Post-implementation)
- Tuned for mobile pacing: one-player shot limit, stable ready countdown, and smoother wave transitions.
- Tuned UFO pacing with controlled spawn windows and randomized cooldowns.
- Added iPhone-safe-area CSS adjustments and mobile web app meta tags.
- Improved on-screen HUD and overlay feedback timing for readability during rapid wave change.
- Kept gameplay core intact while making control feel more consistent under touch input.

- Files created:
  - [index.html](/Users/davidpence/Documents/SpaceInvaders/index.html)
  - [style.css](/Users/davidpence/Documents/SpaceInvaders/style.css)
  - [game.js](/Users/davidpence/Documents/SpaceInvaders/game.js)
