# Gameplay Stabilization Tasks

- [ ] Register ground colliders with Matter physics so Kirdy no longer falls endlessly; ensure terrain bodies are added via `PhysicsSystem.registerTerrain` during scene setup.
- [ ] Clamp or reset the saved `lastKnownPlayerPosition` before persisting so out-of-bounds values from freefall do not corrupt future spawns.
- [ ] Enable camera follow on Kirdy (e.g. `cameras.main.startFollow`) to keep the player visible as they move through the world.
- [ ] Surface keyboard/touch control instructions in HUD, menu, or an onboarding prompt so players understand movement and ability inputs.
- [ ] Ship the `virtual-controls` touch asset (and verify it loads) so the mobile touch UI renders and responds to input.
