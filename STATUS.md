# Status

## Current checkpoint
All checkpoints are implemented and verified.

Completed locally:
- Checkpoint 1: HUD `AREA`/`ABILITY`/`ITEMS` and related status fields use readable separated labels/values.
- Checkpoint 2: Pause, pause help, ResultOverlay, and ResultsScene have foreground modal/backdrop treatment.
- Checkpoint 3: Pause and result states pause actors and restore them only after resume/restart/continue.
- Checkpoint 4: Pause safe-position reset is bound to `pause_reset` and emits `pause.position_reset`.
- Checkpoint 5: Spark tutorial release/detach softlock coverage passes; Spark detach is blocked before the tutorial gate opens.
- Checkpoint 6: Forest key pickup, HUD/inventory reflection, locked-before-key, and door-entered-after-key coverage passes.
- Checkpoint 7: Progression solver reports 8 reachable biome/area destinations beyond forest-only access.
- Checkpoint 8: CentralHub is a symmetric cathedral-style hub with nave/altar/side-aisle scene structure and safe door/platform checks.
- Checkpoint 9: Docs, replay fixtures, contracts, and visual baselines are updated.

## Red/Green evidence
- HUD/Pause/Results readability Red: `npm run check:test -- test/godot-v2-hud-overlay.test.ts test/godot-v2-pause-overlay.test.ts test/godot-v2-results-scene.test.ts` failed on missing HUD caption separation, PauseScene modal panel, and ResultsScene foreground z-index.
- HUD/Pause/Results readability Green: same command exited 0.
- Pause reset Red: `npm run check:test -- test/godot-v2-pause-overlay.test.ts` failed on missing `pause_reset` contract/action/replay.
- Pause reset Green: same command exited 0; `npm run godot:replay-suite -- --filter pause_position_reset` emitted `pause.position_reset`.
- Result freeze Red/Green: `npm run check:test -- test/godot-v2-results-overlay.test.ts` first failed on missing `pause_result_actors`/`restore_result_actors`, then exited 0 after implementation.
- Pause freeze Red/Green: `npm run check:test -- test/godot-v2-pause-overlay.test.ts` first failed on missing `set_pause_actor_state`, then exited 0 after implementation.
- Spark softlock Red: `npm run godot:replay-suite -- --filter tutorial_spark_detach_gate_recover_path` failed on missing `ability.detach.blocked`, missing progress events, and forbidden detach.
- Spark softlock Green: `npm run godot:replay-suite -- --filter tutorial_spark_detach_gate_recover_path` exited 0; `tutorial_spark_release_recover_path` also exited 0.
- Key door Green: `npm run godot:replay-suite -- --filter forest_reliquary` exited 0 with 3/3 replays, including `door.locked -> item.acquired -> door.entered`.
- 8 biome Red/Green: `npm run check:test -- test/godot-v2-progression-solver.test.ts` first failed on missing reachable destination contract output, then exited 0 after solver/contract updates.
- CentralHub Red/Green: `npm run check:test -- test/godot-v2-ux-polish.test.ts` first failed on missing `CathedralNave`, then exited 0 after scene/docs updates and visual baseline refresh.

## Final verification
- `npm run godot:visual-snapshot -- --update --json` exited 0 and refreshed 24 generated baselines after UI/CentralHub scene hash changes.
- `npm run godot:visual-snapshot -- --json` exited 0 with `baseline_updated_count: 0`.
- `npm run godot:quality-report -- --json` exited 0 with `passed: 10`, `failed: 0`; generated ignored report artifacts were removed afterward.
- `npm run check:test -- test/godot-v2-ux-polish.test.ts` exited 0 with 56 files / 323 tests passed.
- `npm run godot:replay-suite -- --filter central_hub` exited 0 with 3/3 replays passed.
- `npm run godot:replay-suite -- --filter tutorial_` exited 0 with 6/6 replays passed.
- `npm run godot:replay-suite -- --filter forest_reliquary` exited 0 with 3/3 replays passed.
- `npm run test` exited 0: typecheck, 56 Vitest files / 323 tests, and `check:godot` all passed.
- `npm run godot:replay-suite` exited 0 with 56/56 replays passed.
- `node scripts/check-godot-progression-solver.mjs --json` exited 0 and reported `reachable_biome_destinations`: `aurora_spire`, `cave_area`, `fire_area`, `forest_area`, `goal_sanctum`, `ice_area`, `sky_sanctum`, `starlit_keep`.
- `npm run build` exited 0 and exported the Godot Web build to ignored `dist/`.

## Review pass
- Pass 1 TDD/contract review: every user-reported category has a Red fixture/test or static contract before Green behavior; no tests, replay expectations, or audits were deleted or skipped.
- Pass 2 gameplay/adversarial review: pause/result traces include actor pause/restore events, tutorial Spark release/detach paths recover, key-door replay proves locked-before-key and entered-after-key, solver proves 8 reachable destinations, and CentralHub scene/static/replay checks preserve safe hub paths.

## Remaining risk
- Manual in-editor visual inspection was not performed; coverage is via scene/static contracts, visual snapshot baselines, replay traces, and Godot Web export.
- `STATUS.md` is retained as requested working memory. `ATTEMPTS.md` was not created because no category hit three repeated failures.
