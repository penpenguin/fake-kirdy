# Fake Kirdy Godot UI/Pause/Progression fixes

Implemented a goal covering HUD clipping, pause/result readability, actor freeze, pause position reset, Spark tutorial softlock, forest key door progression, 8 reachable biome destinations, and CentralHub cathedral symmetry.

Key details:
- HUD labels/values were separated and visual baselines refreshed.
- Pause/Result/Results overlays now have foreground modal/backdrop treatment.
- `GameSession.gd` pauses/restores actor physics for pause and result states and emits `pause.actors.*` / `result.actors.*` trace events.
- Pause reset uses `pause_reset` and emits `pause.position_reset`; it resets player position/velocity to the active safe spawn without clearing collected items, keys, completed/visited levels, score, or save state.
- Tutorial Spark detach is blocked in `tutorial_room` until `tutorial_spark_gate` is opened, emitting `ability.detach.blocked`; release and re-capture path is covered separately.
- Forest reliquary key replay proves `door.locked -> item.acquired -> door.entered`.
- Progression solver now continues after first final solution to report `reachable_level_ids` and `reachable_biome_destinations`; required destinations are `forest_area`, `ice_area`, `fire_area`, `cave_area`, `sky_sanctum`, `aurora_spire`, `starlit_keep`, `goal_sanctum`.
- CentralHub scene now has `CathedralNave`, `AltarPlatform`, `LeftAislePlatform`, `RightAislePlatform`, with major doors symmetric around x=420.

Verification passed:
- `npm run test`
- `npm run godot:replay-suite` (56/56)
- `npm run godot:visual-snapshot -- --json` (`baseline_updated_count: 0`)
- `npm run godot:quality-report -- --json` (10/10, artifacts removed afterward)
- `node scripts/check-godot-progression-solver.mjs --json`
- `npm run build`

Working note: `STATUS.md` contains the full Red/Green and final verification receipt. `ATTEMPTS.md` was not created because no category hit three repeated failures.