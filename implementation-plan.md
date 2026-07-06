# Space Invaders: 20-Pass Improvement Plan

Local Kenney assets have been located and a first-pass sprite/audio integration has started.

1. Asset Pipeline Foundation
   - Add runtime asset preloader for Kenney sheet and audio files.
   - Add offline cache busting by versioning script/style query strings.

2. Sprite Upgrade I: Player + Aliens
   - Replace procedural aliens/player shapes with Kenney sprite cells.
   - Keep fallback drawing for when assets fail to load.

3. Sprite Upgrade II: UFO + Effects
   - Replace canvas UFO block with a real sprite.
   - Add sprite-driven hit flashes or tinting for impacts.

4. Sound Upgrade I
   - Replace tone-only laser SFX with Kenney `.ogg` for shoot and hit.
   - Keep WebAudio synthesis fallback.

5. Sound Upgrade II
   - Add distinct samples for alien shot, explosion, and player hit.
   - Add a short looped background track.

6. Music Behavior
   - Start music on session start only after first user interaction.
   - Pause music with game pause, restart on new wave.

7. Bunker Depth Pass
   - Add multi-cell bunker visuals (dark/light fragments) instead of flat rectangles.
   - Tune bunker HP to match barrier erosion from both shot types.

8. Speed Curve Pass
   - Tune base speed and per-wave ramping to match late-wave acceleration.

9. Drop-Step Pass
   - Ensure alien edge-bounce and descent cadence matches original style.

10. Shot Cadence Pass
    - Validate single shot limit and cooldown so touch input never over-fires.

11. Collision Edge-Case Pass
    - Fix projectile clipping through thin bunkers at high frame rates.

12. Fairness Pass (Lives / Contact)
    - Reduce accidental life loss from near-miss bullets and maintain invulnerability rhythm.

13. UFO Reward Pass
    - Increase score spread and on-screen value pop for UFO catches.

14. Animation Pass
    - Add 2-frame row-based alien flip using atlas variants.
    - Animate player exhaust/flash subtly on movement.

15. Visual Polish Pass
    - Add tiny star twinkle/density pass instead of uniform moving dots.

16. UX Pass
    - Improve start/pause overlays for readability on iPhone with larger buttons.

17. Accessibility Pass
    - Use high-contrast HUD text and larger tap targets for critical controls.

18. Device Fit Pass
    - Re-tune safe-area and landscape behavior after art swap.

19. Replayability Pass
    - Add progressive difficulty modifiers every wave (shot speed, fire chance).

20. Regression & Stability Pass
    - Run a scripted playthrough sweep across pass/ready/running/game-over states and capture screenshot checkpoints.

Completed so far in this run:
1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19.
