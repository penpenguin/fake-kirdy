# Gameplay Stabilization Tasks

- [x] Register ground colliders with Matter physics so Kirdy no longer falls endlessly; ensure terrain bodies are added via `PhysicsSystem.registerTerrain` during scene setup.
- [x] Clamp or reset the saved `lastKnownPlayerPosition` before persisting so out-of-bounds values from freefall do not corrupt future spawns.
- [x] Enable camera follow on Kirdy (e.g. `cameras.main.startFollow`) to keep the player visible as they move through the world.
- [x] Surface keyboard/touch control instructions in HUD, menu, or an onboarding prompt so players understand movement and ability inputs.
- [x] Ship the `virtual-controls` touch asset (and verify it loads) so the mobile touch UI renders and responds to input.
- [x] Rebuild terrain colliders using actual Matter game objects (e.g. `matter.add.image` or `matter.add.gameObject`) so `PhysicsSystem.registerTerrain` receives sprites with `body.gameObject`; right now `GameScene.rebuildTerrainColliders` feeds raw bodies from `matter.add.rectangle`, the collision callbacks never detect terrain, and during play Kirdy falls past y≈100000 with a steady +13.9 velocity instead of landing.
