# Full Godot Migration ExecPlan

This ExecPlan is a living document for making Godot 4 the canonical runtime for Fake Kirdy. It follows `.agent/PLANS.md` and must stay self-contained: a new agent should be able to resume from this file without relying on the chat history.

## Purpose

The project is formally adopting Godot v2 as the mainline game. The existing Phaser + Matter implementation remains useful as a legacy/reference source for gameplay intent, map topology, controls, tests, and regression expectations, but the end state is a Godot canonical build, run, replay, trace, and metrics workflow.

The migration must not start with destructive deletion. First, Godot must become playable and observable. Only after the Godot mainline has controller, levels, transitions, combat, replay, trace, metrics, and representative content should Phaser/Vite/TypeScript runtime code move to `legacy/` or be removed.

## Current Context

The repository currently has a Phaser + Matter game under `legacy/phaser-reference/src/`, with Vite/Vitest scripts in `package.json`. The Phaser version concentrates much of the runtime orchestration in `legacy/phaser-reference/src/game/scenes/index.ts`, with `GameScene` owning player input, `Kirdy`, inhale/swallow/ability systems, enemy spawning, area transitions, HUD, save progress, goal results, and game-over flow.

The Phaser `Kirdy` movement model uses Matter velocity operations such as direct horizontal velocity assignment and a jump velocity constant. Godot must replace this with `CharacterBody2D` and tuning-driven acceleration, deceleration, gravity, jump buffering, coyote time, variable jump height, hover, and replay-compatible input.

The existing Godot prototype under `prototypes/godot-v2/` already contains a thin controller, marker-based levels, replay input, trace recorder, session transitions, and a one-enemy combat slice. This plan promotes that prototype into a repo-level `godot/` mainline while leaving the prototype and Phaser code in place during migration.

## Progress

- [x] 2026-05-28: Read `AGENTS.md`, `.agent/PLANS.md`, `package.json`, `docs/design.md`, `legacy/phaser-reference/src/game/characters/Kirdy.ts`, `legacy/phaser-reference/src/game/scenes/index.ts`, `legacy/phaser-reference/src/game/world/AreaManager.ts`, `legacy/phaser-reference/src/game/world/stages/`, and the existing `prototypes/godot-v2/` tree.
- [x] 2026-05-28: Added a Vitest contract for the Godot mainline migration so the repo records the expected ExecPlan, canonical `godot/` location, package scripts, README guidance, and AGENTS guidance.
- [x] 2026-05-28: Promoted the existing Godot prototype into `godot/` without deleting `prototypes/godot-v2/`.
- [x] 2026-05-28: Added graceful Godot script wrappers and `trace:summary` plumbing to `package.json`.
- [x] 2026-05-28: Ran `npm test`; TypeScript, Vitest, and `check:godot` passed with Godot `4.6.3.stable.official.7d41c59c4`.
- [x] 2026-05-28: Ran canonical Godot headless replay for `combat_capture_swallow_goal.json`; trace emitted capture, swallow, ability acquire/use, and `run.finished`.
- [x] 2026-05-28: Ran `npm run trace:summary -- /tmp/fake-kirdy-combat.ndjson`; metrics summary reported `outcome: complete`, 8 events, and duration 2367 ms.
- [x] 2026-05-28: Retargeted Godot contract tests from `prototypes/godot-v2/` to canonical `godot/` and reran `npm test` successfully.
- [x] 2026-05-28: Added minimal Godot session death/game-over behavior: player HP, enemy contact damage metadata, `danger_room`, `danger_room_game_over.json`, and trace events `player.damaged`, `player.defeated`, `game.over`, and `run.finished` with `outcome: game_over`.
- [x] 2026-05-28: Ran canonical Godot headless replay for `danger_room_game_over.json`; `trace:summary` reported `outcome: game_over`, 6 events, and duration 17 ms.
- [x] 2026-05-28: Added minimal Godot heal pickup gameplay from marker metadata: `heal_room`, `heal_room_recover_and_goal.json`, `heal.collected`, `player.healed`, and short contact-damage invulnerability.
- [x] 2026-05-28: Ran canonical Godot headless replay for `heal_room_recover_and_goal.json`; `trace:summary` reported `outcome: complete`, 7 events, `player.damaged`, `heal.collected`, and `player.healed`.
- [x] 2026-05-28: Added the first representative Godot content migration subset: `central_hub`, marker-driven doors to `heal_room`, `combat_room`, and `jump_room`, `content-migration.md`, and `central_hub_to_heal_goal.json`.
- [x] 2026-05-28: Ran canonical Godot headless replay for `central_hub_to_heal_goal.json`; `trace:summary` reported `outcome: complete`, two levels, `door.entered`, `heal.collected`, `player.healed`, and `run.finished`.
- [x] 2026-05-28: Added `godot/levels/level_catalog.json` as the canonical level catalog with level ids, scene paths, migration tags, and `source_ref` references.
- [x] 2026-05-28: Updated `LevelLoader.gd` to load level paths from the JSON catalog instead of hard-coded `level_paths`, then reran the central hub replay through the catalog-backed loader successfully.
- [x] 2026-05-28: Added `godot/levels/level_catalog.source.json` and `scripts/generate-godot-level-catalog.mjs` so the runtime catalog is generated from a source migration map with `migration_status`, scene path validation, and `source_ref` validation.
- [x] 2026-05-28: Wired `npm run godot:catalog -- --check` into `npm run check:godot` so stale catalog output fails local validation while still keeping Godot executable checks graceful.
- [x] 2026-05-28: Extended the catalog source/generator with `stage_id` and `expected_neighbors` validation for `central_hub`, proving the Godot hub stays tied to Phaser `central-hub` and its representative neighbor targets.
- [x] 2026-05-28: Added representative Godot branch rooms for the five explicit Phaser `central-hub` neighbors: `ice_area`, `mirror_corridor`, `fire_area`, `forest_area`, and `cave_area`.
- [x] 2026-05-28: Extended catalog source validation to cover six Phaser stage mappings and selected branch metadata fields such as `cluster` and `difficulty`.
- [x] 2026-05-28: Added `ice_area_return_hub.json` and validated a headless replay that loads a migrated branch room, enters its return door, and records `central_hub` plus `ice_area` in metrics output.
- [x] 2026-05-28: Added `scripts/check-godot-stage-manifest.mjs` and checked-in `godot/levels/stage_manifest.json`, generated from the legacy/reference Phaser stage TypeScript files with ids, source paths, literal/dynamic neighbors, layout dimensions, tile size, and metadata.
- [x] 2026-05-28: Wired `npm run godot:stage-manifest -- --check` into `npm run check:godot` and changed catalog validation to verify `stage_id`, expected neighbors, and expected metadata against `stage_manifest.json`.
- [x] 2026-05-28: Added `scripts/check-godot-content-migration.mjs` and `npm run godot:content-check` to verify mapped Phaser neighbor edges against actual Godot `DoorMarker.target_level_id` entries in `.tscn` scenes.
- [x] 2026-05-28: Added `goal_sanctum` as the next mapped static Phaser stage beyond the central branches, including `mirror_corridor -> goal_sanctum`, `goal_sanctum -> mirror_corridor`, a `GoalMarker`, and `mirror_to_goal_sanctum_finish.json`.
- [x] 2026-05-28: Added static sky-cluster mappings for `sky_sanctum`, `starlit_keep`, and `aurora_spire`, including scene-level doors for `goal_sanctum -> sky_sanctum`, `sky_sanctum -> goal_sanctum`, `sky_sanctum -> starlit_keep`, `sky_sanctum -> aurora_spire`, and return edges from both sky branches.
- [x] 2026-05-28: Added `sky_sanctum_to_goal_finish.json`; headless replay reaches `goal_sanctum` and emits `run.finished` with `outcome: complete`.
- [x] 2026-05-28: Added representative procedural manifest support for `labyrinth-001`, plus Godot `labyrinth_001`, `forest_area -> labyrinth_001`, `labyrinth_001 -> forest_area`, dead-end-style heal metadata, and `labyrinth_001_return_forest.json`.
- [x] 2026-05-28: `npm run godot:content-check` now validates 20 mapped neighbor doors with 0 deferred mapped-neighbor gaps for the current representative subset.
- [x] 2026-05-28: Added the first reliquary/collectible migration slice: Phaser manifest `collectibles` extraction, catalog `expected_collectibles` validation, `CollectibleMarker`, session `collectible.collected`, Godot `forest_reliquary`, and `forest_reliquary_collectible.json`.
- [x] 2026-05-28: Ran canonical Godot headless replay for `forest_reliquary_collectible.json`; `trace:summary` reported one `collectible.collected` event for the run.
- [x] 2026-05-28: Broadened reliquary coverage to all four static Phaser keystone rooms by adding `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`, plus catalog `expected_collectibles` for `ice-keystone`, `fire-keystone`, and `cave-keystone`.
- [x] 2026-05-28: Ran canonical Godot headless replays for `ice_reliquary_collectible.json`, `fire_reliquary_collectible.json`, and `ruins_reliquary_collectible.json`; each `trace:summary` reported one `collectible.collected` event.
- [x] 2026-05-28: Added session-local item acquisition state for collectibles: `acquired_item_ids`, `item.acquired`, sorted `items_collected` payloads, and trace-summary metrics for collected collectibles, acquired items, and ability ids.
- [x] 2026-05-28: Ran canonical Godot headless replay for `forest_reliquary_collectible.json`; `trace:summary` reported `collectible.collected`, `item.acquired`, and `items_collected: [forest-keystone]`.
- [x] 2026-05-28: Added the first Godot save persistence boundary: `SaveState.gd`, `SaveStore.gd`, `GameSession.save_enabled`, `--save` replay argument, and trace events `save.loaded`, `save.written`, and `save.error`.
- [x] 2026-05-28: Ran `forest_reliquary_collectible.json` twice against `/tmp/fake-kirdy-godot-save-persistence.json`; the first run wrote `forest-keystone`, and the second run loaded it without emitting a duplicate `item.acquired`.
- [x] 2026-05-28: Extended the Godot save schema beyond item ids to `current_level_id`, `player_hp`, `player_max_hp`, and `completed_level_ids`; trace summary now reports `completed_levels`.
- [x] 2026-05-28: Ran save-enabled headless replays for `mirror_to_goal_sanctum_finish.json` and `heal_room_recover_and_goal.json`; goal completion saved completed level ids, and damage/heal wrote updated HP.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include saved `player_position`.
- [x] 2026-05-28: Replayed `mirror_to_goal_sanctum_finish.json` against an existing save and fixed saved-position application so a position is only restored when the saved level matches the replay start level.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include current `ability_type`.
- [x] 2026-05-28: Added `use_saved_ability.json` and validated that a save created by `combat_capture_swallow_goal.json` lets a later replay emit `ability.used` without recapturing an enemy.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include `visited_level_ids` and stable `unlocked_door_ids`.
- [x] 2026-05-28: Ran save-enabled `central_hub_to_heal_goal.json`; the save file recorded `visited_level_ids: [central_hub, heal_room]` and `unlocked_door_ids: [central_hub:hub_to_heal_room]`.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include the minimal settings payload: `volume`, `controls`, and `difficulty`.
- [x] 2026-05-28: Ran save-enabled `central_hub_to_heal_goal.json` from a preseeded settings save; the save file and trace summary preserved `volume: 0.25`, `controls: controller`, and `difficulty: hard`.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include Phaser-compatible `explored_tiles` as `{ level_id: ["column,row"] }`.
- [x] 2026-05-28: Ran save-enabled `central_hub_to_heal_goal.json`; the save file and trace summary recorded 17 explored tiles across `central_hub` and `heal_room`.
- [x] 2026-05-28: Replaced the single hard-coded procedural manifest representative with the full generated Phaser procedural chain in `stage_manifest.json`.
- [x] 2026-05-28: `npm run godot:stage-manifest` now exports 146 total stages, including all 132 `labyrinth-*` generated stages, while the Godot runtime catalog still maps only the representative playable subset.
- [x] 2026-05-28: Added `scripts/generate-godot-procedural-levels.mjs` and checked-in `godot/levels/generated/procedural_levels.json`, converting all 132 Phaser `labyrinth-*` stages into Godot ids and schema-level neighbor data.
- [x] 2026-05-28: Wired `npm run godot:procedural-levels -- --check` into `npm run check:godot`, so stale generated procedural schema now fails canonical validation.
- [x] 2026-05-28: Ran `npm run godot:procedural-levels -- --check`; it reported `procedural_levels.json` up to date with 132 generated levels.
- [x] 2026-05-28: Ran `npm run check:godot`; it passed with Godot `4.6.3.stable.official.7d41c59c4`, 146 Phaser manifest stages, 132 generated procedural schema levels, 15 catalog Phaser mappings, 4 collectible mappings, and 20 mapped door validations.
- [x] 2026-05-28: Ran headless Godot replay `central_hub_to_heal_goal.json` and `npm run trace:summary` on its trace; metrics reported `outcome: complete`, 10 events, levels `central_hub` and `heal_room`, and completed level `heal_room`.
- [x] 2026-05-28: Ran `npm test`; it passed with 94 files and 968 tests.
- [x] 2026-05-28: Added `LevelLoader.gd` runtime fallback for generated procedural levels. When a level id is absent from `level_catalog.json` but present in `procedural_levels.json`, the loader now resolves it as `generated_schema://<level_id>` and creates a minimal marker-based room at runtime.
- [x] 2026-05-28: Added `labyrinth_002_to_003_generated.json` to prove a generated-only room can load and transition into another generated-only room without hand-authored `.tscn` scenes.
- [x] 2026-05-28: Ran the generated procedural replay and `npm run trace:summary`; metrics reported levels `labyrinth_002` and `labyrinth_003`, one `door.entered`, two `level.loaded` events, and unlocked door `labyrinth_002:labyrinth_002_to_labyrinth_003`.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 971 tests after the generated procedural runtime fallback.
- [x] 2026-05-28: Extended generated procedural rooms with metadata-driven static platform variants plus `EnemySpawnMarker`, `HealMarker`, and `CollectibleMarker` generation.
- [x] 2026-05-28: Added `labyrinth_010_generated_content.json` to exercise generated enemy damage, heal pickup, generated shard pickup, item acquisition, and a generated reliquary transition.
- [x] 2026-05-28: Ran the generated content replay and `npm run trace:summary`; metrics reported `player.damaged`, `heal.collected`, `player.healed`, two `collectible.collected` events, two `item.acquired` events, and `labyrinth_010:labyrinth_010_to_ice_reliquary`.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 973 tests after metadata-driven generated content.
- [x] 2026-05-28: Added directional generated spawns for `west`, `east`, `north`, and `south` target spawn ids so generated door transitions no longer depend on the `default` spawn fallback.
- [x] 2026-05-28: Added `labyrinth_002_to_forest_reliquary_generated_chain.json` to validate a longer generated chain from `labyrinth_002` through `labyrinth_005` into `forest_reliquary`.
- [x] 2026-05-28: Ran the generated chain replay and `npm run trace:summary`; metrics reported levels `labyrinth_002`, `labyrinth_003`, `labyrinth_004`, `labyrinth_005`, and `forest_reliquary`, four `door.entered` events, generated heal/damage events, generated shard acquisition, `forest-keystone` acquisition, and unlocked door `labyrinth_005:labyrinth_005_to_forest_reliquary`.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 974 tests after directional generated spawns and the forest reliquary chain replay.
- [x] 2026-05-28: Added generated `GoalMarker` support for terminal void procedural rooms such as `labyrinth_132`.
- [x] 2026-05-28: Added `labyrinth_132_generated_goal.json` to validate a generated terminal room completing with `run.finished`.
- [x] 2026-05-28: Ran the generated goal replay and `npm run trace:summary`; metrics reported `outcome: complete`, completed level `labyrinth_132`, and `run.finished` at frame 37.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 975 tests after generated terminal goal support.
- [x] 2026-05-28: Added `labyrinth_006_to_ice_reliquary_generated_chain.json` to cover the generated ice cluster through `labyrinth_010` into `ice_reliquary`.
- [x] 2026-05-28: Added `labyrinth_051_to_sky_sanctum_generated_exit.json` to cover a generated sky branch exit into `sky_sanctum` and onward through the existing hand-authored goal path.
- [x] 2026-05-28: Ran both new generated cluster replays and `trace:summary`; ice metrics reported `ice_reliquary`, `ice-generated-shard`, `ice-keystone`, and five generated door unlocks, while sky metrics reported `outcome: complete`, `sky_sanctum`, `goal_sanctum`, and `sky_sanctum:sky_sanctum_to_goal_sanctum`.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 977 tests after ice and sky generated cluster replay coverage.
- [x] 2026-05-28: Added `labyrinth_029_to_fire_reliquary_generated_chain.json` and `labyrinth_047_to_ruins_reliquary_generated_chain.json` to cover the generated fire and ruins cluster reliquary exits.
- [x] 2026-05-28: Ran the new fire/ruins generated cluster replays and `trace:summary`; fire metrics reported `fire_reliquary`, `fire-generated-shard`, `fire-keystone`, and four generated door unlocks, while ruins metrics reported `ruins_reliquary`, `ruins-generated-shard`, `cave-keystone`, and four generated door unlocks.
- [x] 2026-05-28: Ran `npm test`; it passed with 95 files and 979 tests after fire and ruins generated cluster replay coverage.
- [x] 2026-05-28: Added `godot/tests/replay_suite.json` as the canonical representative replay suite covering combat, hub heal/goal, generated reliquary chains, generated goal paths, and game-over behavior.
- [x] 2026-05-28: Added `scripts/run-godot-replay-suite.mjs` plus `npm run godot:replay-suite` to list suite entries without Godot, run every replay headlessly when Godot exists, summarize per-replay traces, and verify expected outcomes.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 9 representative replays passed with 0 failures.
- [x] 2026-05-28: Ran `npm run trace:summary -- /tmp/fake-kirdy-godot-replay-suite/combat_capture_swallow_goal.ndjson`; metrics reported `outcome: complete`, `ability.acquired`, `ability.used`, and completed level `combat_room`.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 982 tests after adding the canonical replay suite workflow.
- [x] 2026-05-28: Added `FlyingEnemy.gd`/`FlyingEnemy.tscn` as the second minimal combat enemy type and updated `GameSession` to instantiate enemy scenes from `EnemySpawnMarker.enemy_type`.
- [x] 2026-05-28: Added `flying_combat_room` and `flying_enemy_release_swallow_goal.json`, validating `enemy.released`, recapture, swallow, `frost` ability acquisition/use, and goal completion.
- [x] 2026-05-28: Ran `npm run godot:replay -- --replay res://tests/replays/flying_enemy_release_swallow_goal.json --out /tmp/fake-kirdy-flying-combat.ndjson`; `trace:summary` reported `outcome: complete`, two `enemy.captured`, one `enemy.released`, `ability.acquired: frost`, and `ability.used: frost`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 10 representative replays passed with 0 failures after adding flying enemy coverage.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 983 tests after the second enemy type and release replay coverage.
- [x] 2026-05-28: Added `player_motion` metrics to `scripts/trace-summary.mjs`, summarizing player sample count, min/max position, max absolute velocity, max fall speed, and max rise speed from trace player payloads.
- [x] 2026-05-28: Added per-frame `player.sampled` trace events for scene replay runs so `controller_lab_jump.json` captures frame-level movement metrics instead of only event-time samples.
- [x] 2026-05-28: Added `controller_lab_jump` to `godot/tests/replay_suite.json`, making controller movement replay part of canonical headless validation.
- [x] 2026-05-28: Ran `npm run godot:replay -- --replay res://tests/replays/controller_lab_jump.json --out /tmp/fake-kirdy-controller-lab.ndjson`; `trace:summary` reported `outcome: finished`, 150 `player.sampled` events, `max_fall_speed` about 465, and `max_rise_speed` 430.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after adding controller lab coverage.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 983 tests after adding controller movement metrics.
- [x] Milestone 3: harden the canonical player controller and trace behavior under `godot/`.
- [x] 2026-05-28: Added `LevelTileMap.gd` as the editor-visible TileMap metadata script with exported tile size, grid dimensions, and collision-source metadata.
- [x] 2026-05-28: Extended `LevelDefinition.gd` and `LevelLoader.gd` so level definitions collect TileMap metadata through `to_level_tilemap()` alongside marker nodes.
- [x] 2026-05-28: Updated `central_hub.tscn` to attach `LevelTileMap` with `metadata_tile_size = Vector2i(32, 32)`, `columns = 29`, `rows = 17`, and `collision_source = static_body`.
- [x] 2026-05-28: Ran `npm run godot:replay -- --replay res://tests/replays/central_hub_to_heal_goal.json --out /tmp/fake-kirdy-central-hub-tilemap.ndjson`; `trace:summary` reported `outcome: complete`, levels `central_hub` and `heal_room`, and unlocked door `central_hub:hub_to_heal_room`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after adding TileMap metadata.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 984 tests after adding TileMap metadata.
- [x] Milestone 4: expand the canonical level system around TileMap and marker nodes.
- [x] 2026-05-28: Extended `scripts/generate-godot-procedural-levels.mjs` to write `runtime_layout` metadata for every generated procedural room, covering tile/grid size, room size, camera bounds, spawn points, door points, floor geometry, and platform geometry.
- [x] 2026-05-28: Updated generated procedural runtime loading so `LevelLoader.gd` creates a generated `LevelTileMap` and reads spawn, door, floor, camera, and platform placement from `runtime_layout` instead of hard-coded placement constants.
- [x] 2026-05-28: Ran `npm run godot:replay -- --replay res://tests/replays/labyrinth_010_generated_content.json --out /tmp/fake-kirdy-generated-layout.ndjson`; `trace:summary` reported generated damage/heal/collectible/item events, `labyrinth_010:labyrinth_010_to_ice_reliquary`, and `outcome: replay.max_frames_reached`.
- [x] 2026-05-28: Ran `npm run godot:procedural-levels -- --check`; `procedural_levels.json` was up to date with 132 procedural levels.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after schema-driven generated layout placement.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 985 tests after adding generated runtime layout metadata.
- [x] 2026-05-28: Extended `runtime_layout` with generated gameplay marker placement under `content.enemies`, `content.heals`, `content.collectibles`, and `content.goals`.
- [x] 2026-05-28: Updated `LevelLoader.gd` so generated enemy, heal, collectible, and goal markers are created from `runtime_layout.content` instead of deriving their positions and payloads in GDScript.
- [x] 2026-05-28: Ran generated content and terminal-goal replays after the schema change; trace summaries still reported generated damage/heal/collectible/item events for `labyrinth_010` and `outcome: complete` for `labyrinth_132`.
- [x] 2026-05-28: Ran `npm run godot:procedural-levels -- --check`; `procedural_levels.json` was up to date with 132 procedural levels after adding `runtime_layout.content`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after schema-driven generated gameplay marker placement.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 986 tests after moving generated gameplay marker placement into `runtime_layout.content`.
- [x] 2026-05-28: Added `runtime_layout.room.variant` and `GeneratedPlatformVerticalStep` for generated rooms that have north or south routes, giving vertical procedural branches a schema-visible layout variant.
- [x] 2026-05-28: Ran `npm run godot:replay -- --replay res://tests/replays/labyrinth_051_to_sky_sanctum_generated_exit.json --out /tmp/fake-kirdy-vertical-route.ndjson`; `trace:summary` still reported `outcome: complete`, `labyrinth_051:labyrinth_051_to_sky_sanctum`, and `sky_sanctum:sky_sanctum_to_goal_sanctum`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after adding vertical-route generated platform metadata.
- [x] 2026-05-28: Ran `npm test`; it passed with 96 files and 987 tests after adding generated room route variants.
- [x] 2026-05-28: Added `MapOverlay.gd` and `MapOverlay.tscn` as the first minimal Godot UI consumer of persisted `explored_tiles`.
- [x] 2026-05-28: Wired `GameSession` to create the map overlay, sync exploration state into it, and emit `map.updated` trace events when newly explored tiles are discovered.
- [x] 2026-05-28: Updated `trace-summary` so `map.updated` contributes to `explored_tiles_by_level` and `explored_tile_count`.
- [x] 2026-05-28: Ran save-enabled `central_hub_to_heal_goal.json`; trace summary reported 17 `map.updated` events and 17 explored tiles across `central_hub` and `heal_room`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 11 representative replays passed with 0 failures after adding the map overlay trace path.
- [x] 2026-05-28: Ran `npm test`; it passed with 97 files and 989 tests after adding `MapOverlay`.
- [x] 2026-05-28: Extended the Phaser stage manifest and Godot catalog validation with `dead_ends` / `expected_dead_end_rewards`, covering `central-hub` rewards `health` and `max-health` plus procedural `labyrinth-*` reward metadata.
- [x] 2026-05-28: Added `HealMarker.reward_type`, Godot session handling for `max-health`, `player.max_hp_increased`, and representative hub markers `central_hub_dead_end_health` and `central_hub_dead_end_max_health`.
- [x] 2026-05-28: Added `central_hub_dead_end_max_health.json` to the replay suite and validated it headlessly; trace summary reported `heal.collected`, `player.max_hp_increased`, `player_max_hp: 4`, and `outcome: replay.max_frames_reached`.
- [x] 2026-05-28: Ran `npm run godot:stage-manifest -- --check` and `npm run godot:catalog -- --check`; both were up to date, and catalog validation reported `expected_dead_end_rewards` for 2 level mappings.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 12 representative replays passed with 0 failures after adding the hub dead-end max-health replay.
- [x] 2026-05-28: Ran `npm run trace:summary -- /tmp/fake-kirdy-godot-replay-suite/central_hub_dead_end_max_health.ndjson`; metrics reported 7 events, `heal.collected`, `player.max_hp_increased`, 2 explored hub tiles, and `outcome: replay.max_frames_reached`.
- [x] 2026-05-28: Ran `npm test`; it passed with 97 files and 989 tests after adding Phaser dead-end reward validation and Godot max-health pickup coverage.
- [x] 2026-05-28: Implemented the Godot `revive` reward path: `player_revive_count`, persistent save payload, `player.revive_acquired`, lethal-hit recovery through `player.revived`, and normal game-over when no revive remains.
- [x] 2026-05-28: Added `revive_room`, `revive_room_revive_then_game_over.json`, and a replay-suite entry that validates `heal.collected -> player.revive_acquired -> player.revived -> game.over`.
- [x] 2026-05-28: Updated generated procedural room content so `runtime_layout.content.heals` preserves Phaser dead-end reward markers for `health`, `max-health`, and `revive` while retaining the route heal needed by long generated chain replays.
- [x] 2026-05-28: Extended `trace:summary` with `last_player_revive_count` from save trace payloads.
- [x] 2026-05-28: Ran focused Vitest coverage for heal/revive, procedural generator, replay suite, and trace summary; 4 files / 14 tests passed.
- [x] 2026-05-28: Ran save-enabled `revive_room_revive_then_game_over.json`; trace summary reported 41 events, `player.revive_acquired`, `player.revived`, two `player.damaged`, `game.over`, and `last_player_revive_count: 0`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 13 representative replays passed with 0 failures after adding revive coverage.
- [x] 2026-05-28: Ran `npm test`; it passed with 97 files and 990 tests after adding revive reward semantics and generated dead-end reward markers.
- [x] 2026-05-28: Added the first Godot export boundary: `godot/export_presets.cfg`, `scripts/export-godot.mjs`, `npm run godot:export`, and `npm run build:godot`.
- [x] 2026-05-28: Kept `npm run build` on the legacy Vite path for now, but added `npm run build:legacy:web` so the current deployed build is explicitly labeled before the later mainline switch.
- [x] 2026-05-28: Ran `npm run godot:export -- --check`; it validated the `Linux Headless` export preset and detected Godot `4.6.3.stable.official.7d41c59c4`.
- [x] 2026-05-28: Ran `npm run build:godot`; Godot attempted export and skipped successfully because local export templates are not installed.
- [x] 2026-05-28: Ran focused Vitest coverage for the export workflow; `test/godot-v2-export.test.ts` passed with 4 tests.
- [x] 2026-05-28: Ran `npm test`; it passed with 98 files and 994 tests after adding the Godot export boundary.
- [x] 2026-05-28: Updated `build:godot` to forward npm arguments to `godot:export`, and added `npm run godot:export -- --check` to `check:godot` so canonical validation covers the export preset.
- [x] 2026-05-28: Ran focused export workflow coverage after the script change; `test/godot-v2-export.test.ts` passed with 5 tests.
- [x] 2026-05-28: Ran `npm run check:godot`; it now validates stage manifest, procedural schema, catalog, content migration, Godot export preset, and Godot executable version.
- [x] 2026-05-28: Ran `npm test`; it passed with 98 files and 995 tests after wiring export preset validation into `check:godot`.
- [x] 2026-05-28: Added generated-room spawn/door safety metadata to `runtime_layout.safety`, moved east/south target spawns outside their corresponding door trigger radius, and made `LevelLoader.gd` read generated door radius from schema data.
- [x] 2026-05-28: Added Vitest coverage that checks every generated procedural neighbor's target spawn is at least 64 px from its corresponding generated door.
- [x] 2026-05-28: Ran focused procedural generator Vitest coverage; `test/godot-v2-procedural-level-generator.test.ts` passed with 7 tests.
- [x] 2026-05-28: Ran `npm run godot:procedural-levels -- --check`; generated procedural schema was up to date with 132 levels after adding safety metadata.
- [x] 2026-05-28: Ran focused Vitest coverage for procedural generator/runtime; 2 files / 18 tests passed.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 13 representative replays passed after the generated spawn/door safety change.
- [x] 2026-05-28: Ran `npm test`; it passed with 98 files and 996 tests after adding procedural spawn/door safety validation.
- [x] 2026-05-28: Started the non-destructive mainline switch by changing the default `npm run build` path to the Godot export wrapper while keeping the Phaser/Vite build available as `npm run build:legacy:web`.
- [x] 2026-05-28: Ran focused export workflow Vitest coverage after the default build switch; `test/godot-v2-export.test.ts` passed with 6 tests.
- [x] 2026-05-28: Ran `npm run build`; it reached the Godot export wrapper and skipped successfully because local Godot export templates are not installed.
- [x] 2026-05-28: Ran `npm run check:godot`; stage manifest, procedural levels, catalog, content migration, export preset, and Godot executable checks passed.
- [x] 2026-05-28: Ran `npm test`; it passed with 98 files and 997 tests after promoting the default build command to Godot export.
- [x] 2026-05-28: Promoted the default `npm run dev` command to Godot and moved Vite dev/preview commands to explicit `dev:legacy:web` and `preview:legacy:web` script names.
- [x] 2026-05-28: Ran focused mainline/export/Vite config coverage after the default dev switch; 4 files / 12 tests passed.
- [x] 2026-05-28: Ran `npm run build -- --check`; it validated the canonical Godot export preset through the default build command.
- [x] 2026-05-28: Ran `npm test`; it passed with 98 files and 997 tests after promoting the default dev command to Godot.
- [x] 2026-05-28: Added the first minimal Godot HUD overlay for level id, HP, max HP, revive count, ability type, collected item count, and run outcome.
- [x] 2026-05-28: Wired `GameSession` to sync HUD state and emit `hud.updated`; `trace:summary` now reports the latest HUD payload as `last_hud`.
- [x] 2026-05-28: Ran focused HUD and trace-summary coverage; 2 files / 3 tests passed.
- [x] 2026-05-28: Ran `combat_capture_swallow_goal.json` headlessly after adding HUD; trace summary reported 4 `hud.updated` events and `last_hud.ability_type: spark`.
- [x] 2026-05-28: Added `last_hud` to `godot:replay-suite` aggregate results and ran the full suite; all 13 representative replays passed with HUD metrics included.
- [x] 2026-05-28: Ran `npm test`; it passed with 99 files and 999 tests after adding the Godot HUD overlay and HUD metrics.
- [x] 2026-05-28: Added the first minimal Godot result overlay for completed and game-over runs, wired from `GameSession` and exposed through `result.overlay.shown`.
- [x] 2026-05-28: Extended `trace:summary` and `godot:replay-suite` aggregate results with `last_result_overlay`.
- [x] 2026-05-28: Ran focused result-overlay, trace-summary, and replay-suite Vitest coverage; 3 files / 6 tests passed.
- [x] 2026-05-28: Ran `godot --headless --path godot --quit`; the canonical Godot project loaded successfully with Godot `4.6.3.stable.official.7d41c59c4`.
- [x] 2026-05-28: Ran `combat_capture_swallow_goal.json` headlessly after adding the result overlay; trace summary reported one `result.overlay.shown` event and `last_result_overlay.outcome: completed`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 13 representative replays passed with result overlay metrics included for completed/game-over outcomes.
- [x] 2026-05-28: Ran `npm test`; it passed with 100 files and 1001 tests after adding the Godot result overlay and metrics.
- [x] 2026-05-28: Added `npm run test:canonical` as the explicit canonical validation command; it runs `npm test` and then the Godot replay suite.
- [x] 2026-05-28: Added `scripts/legacy-inventory.mjs`, `npm run legacy:inventory`, and `docs/godot-v2/legacy-reference-boundary.md` to make the remaining Phaser/Vite reference surface and retirement gates machine-readable before physical legacy cleanup.
- [x] 2026-05-28: Ran focused canonical validation and legacy-boundary coverage; `test/godot-canonical-validation.test.ts` passed with 3 tests.
- [x] 2026-05-28: Ran `npm run legacy:inventory`; it reported canonical runtime `godot`, legacy source/config surface `src`, `public`, `legacy/phaser-reference/index.html`, `legacy/phaser-reference/vite.config.ts`, legacy commands, and remaining `matter-js`, `phaser`, and `vite` dependencies.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 13 representative replays passed before validating the combined canonical command.
- [x] 2026-05-28: Ran `npm run test:canonical`; `npm test` passed with 101 files and 1004 tests, then the Godot replay suite passed 13/13.
- [x] 2026-05-28: Added `docs/godot-v2/phaser-parity-ledger.json` and `docs/godot-v2/phaser-parity-ledger.md` to track which Phaser reference systems are ported, partial, deferred, deprecated, or still blocking runtime retirement.
- [x] 2026-05-28: Added `scripts/check-godot-parity-ledger.mjs`, `npm run godot:parity-ledger`, and wired `npm run godot:parity-ledger -- --check` into `check:godot`.
- [x] 2026-05-28: Ran focused parity-ledger coverage; `test/godot-v2-parity-ledger.test.ts` passed with 4 tests.
- [x] 2026-05-28: Ran `npm run godot:parity-ledger -- --check`; it reported 12 entries, 6 ported entries, and 6 retirement blockers.
- [x] 2026-05-28: Ran `node scripts/check-godot-parity-ledger.mjs --fail-on-blockers`; it failed intentionally with blockers for representative stage topology, save/settings, UI, audio/polish, export packaging, and Phaser/Vite runtime retirement.
- [x] 2026-05-28: Ran focused parity and canonical validation coverage; 2 files / 7 tests passed.
- [x] 2026-05-28: Ran `npm run check:godot`; it passed with parity-ledger validation included.
- [x] 2026-05-28: Ran `npm run test:canonical`; `npm test` passed with 102 files and 1008 tests, then the Godot replay suite passed 13/13.
- [x] 2026-05-28: Added `SettingsOverlay.gd` / `SettingsOverlay.tscn` as the first Godot UI consumer of persisted settings.
- [x] 2026-05-28: Added replay-driven settings actions for volume, controls, and difficulty, plus `settings.updated` trace events and `trace:summary` extraction into `last_settings`.
- [x] 2026-05-28: Added `settings_adjustment.json` to the canonical replay suite, making settings UI/save/trace behavior replay-covered.
- [x] 2026-05-28: Updated `phaser-parity-ledger.json`; `save-progress-settings` is now ported and no longer a retirement blocker.
- [x] 2026-05-28: Ran save-enabled `settings_adjustment.json`; trace summary reported 4 `settings.updated` events and `last_settings: { volume: 0.5, controls: touch, difficulty: hard }`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 14 representative replays passed after adding settings coverage.
- [x] 2026-05-28: Ran `npm test`; it passed with 103 files and 1011 tests after settings overlay and replay coverage.
- [x] 2026-05-28: Ran `node scripts/check-godot-parity-ledger.mjs --fail-on-blockers`; it still failed intentionally, now with 5 blockers: representative stage topology, UI map/HUD/results, audio/polish, export packaging, and Phaser/Vite runtime retirement.
- [x] 2026-05-28: Added `InventoryOverlay.gd` / `InventoryOverlay.tscn` for item ids, current ability, completed levels, and visited levels as a minimal Godot inventory/progress UI.
- [x] 2026-05-28: Wired `GameSession` to sync inventory state on session start, door transitions, item acquisition, ability acquisition, and level completion, emitting `inventory.updated` trace events.
- [x] 2026-05-28: Extended `trace:summary` to aggregate `inventory.updated` into item/progress sets and expose the latest payload as `last_inventory`.
- [x] 2026-05-28: Updated the Phaser parity ledger so `ui-map-hud-results` is ported and no longer a retirement blocker; `godot:parity-ledger -- --check` now reports 8 ported entries and 4 blockers.
- [x] 2026-05-28: Ran `godot --headless --path godot --quit`; Godot 4.6.3 loaded the mainline project after InventoryOverlay wiring.
- [x] 2026-05-28: Ran combat and collectible replays through `trace:summary`; combat trace reported 3 `inventory.updated` events with `last_inventory.ability_type: spark`, and the forest reliquary trace reported `last_inventory.items_collected: [forest-keystone]`.
- [x] 2026-05-28: Ran `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite`; all 14 representative replays passed with inventory traces included.
- [x] 2026-05-28: Ran `npm test`; it passed with 104 files and 1014 tests after InventoryOverlay and trace-summary coverage.
- [x] 2026-05-28: Ran `node scripts/check-godot-parity-ledger.mjs --fail-on-blockers`; it still failed intentionally, now with 4 blockers: representative stage topology, audio/polish, export packaging, and Phaser/Vite runtime retirement.
- [x] 2026-05-28: Extended `godot:content-check` to validate all 146 Phaser stage ids against either Godot scenes or generated schema, and to validate 263 generated neighbor edges.
- [x] 2026-05-28: Updated `phaser-parity-ledger.json`; `representative-stage-topology` is now ported, and `audio-and-polish` is explicitly deferred backlog rather than a runtime retirement blocker.
- [x] 2026-05-28: Promoted export packaging to ported because the canonical `npm run build` path now validates the Godot export preset and skips missing local export templates gracefully.
- [x] 2026-05-28: Removed root Phaser/Vite runtime commands and dependencies from `package.json`; retained `legacy/phaser-reference/src/`, `legacy/phaser-reference/public/`, `legacy/phaser-reference/index.html`, and `legacy/phaser-reference/vite.config.ts` as legacy/reference source only.
- [x] 2026-05-28: Updated the canonical Vitest/typecheck gate to run Godot migration tests plus trace-summary coverage instead of legacy Phaser runtime tests.
- [x] 2026-05-28: Ran `npm run legacy:inventory`; it now reports no legacy runtime commands or dependencies, with retained reference source dirs `legacy/phaser-reference/src` and `legacy/phaser-reference/public`.
- [x] 2026-05-28: Ran `npm run godot:parity-ledger -- --check` and `node scripts/check-godot-parity-ledger.mjs --fail-on-blockers`; both report blocker_count 0 with 11 ported entries and 1 deferred entry.
- [x] 2026-05-28: Ran `npm test`; it passed with 27 files and 116 tests, including typecheck, Godot content validation, export preset validation, and blocker_count 0.
- [x] 2026-05-28: Ran `npm run test:canonical`; `npm test` passed and the Godot replay suite passed 14/14.
- [x] 2026-05-28: Ran `npm run build`; it reached the Godot export wrapper and skipped successfully because local Godot export templates are not installed.
- [x] 2026-05-29: Renamed the checked-in stage topology to canonical `stage_manifest.json`, removed legacy source-path fields from the manifest schema, and updated catalog/procedural generators to use `stage_manifest:<stage_id>` references.
- [x] 2026-05-29: Updated current README/AGENTS/content docs, parity ledger, and validation tests so Godot level generation no longer requires legacy source paths. `audio-and-polish` remains deferred but non-blocking.
- [x] 2026-05-29: Ran focused canonical schema tests, `npm run check:godot`, `npm test`, `npm run godot:replay-suite --`, `npm run trace:summary -- /tmp/fake-kirdy-godot-replay-suite-605553/combat_capture_swallow_goal.ndjson`, and `npm run build -- --check`; all passed with Godot 4.6.3 available.
- [x] Milestone 5: finish minimal session, transition, death, game-over, and run outcome behavior.
- [x] Milestone 6: expand combat from the one-enemy slice to the smallest mainline-equivalent combat loop.
- [x] Milestone 7: finalize replay, headless trace, and metrics extraction as canonical workflows.
- [x] Milestone 8: migrate representative Phaser content and document the full content migration path.
- [x] Milestone 9: move Phaser/Vite runtime to legacy/reference or remove it after Godot parity gates pass.
- [x] Milestone 10: cleanup, final verification, and retrospective.

## Surprises & Discoveries

- `GameScene` is the main Phaser integration point. It owns player creation, input, enemy systems, area transitions, results, game over, save persistence, and terrain visuals, so direct one-to-one file migration would be risky. Godot should instead keep these responsibilities split across `GameSession`, level scripts, player/enemy scripts, replay/trace utilities, and future UI/session nodes.
- `docs/design.md` still reflects the Phaser/Matter runtime, but it has durable design intent: controls, inhale/swallow/ability flow, hover, enemies, 100+ area ambition, dead-end heals, collectible/relic progression, goal door, and run result behavior.
- `legacy/phaser-reference/src/game/world/stages/procedural.ts` generates a large stage graph. Migrating all generated areas at once would be noisy and fragile; the safe path is a canonical Godot schema/importer plus a representative playable subset.
- The Godot prototype already validates the core vertical slice better than expected: controller, markers, replay, trace, door transition, goal finish, and one-enemy combat exist. The main migration should promote and harden this rather than rebuild from scratch.
- `AGENTS.md` still described Godot as a vertical slice and Phaser as the reference implementation. That guidance had to change now that the user made Godot canonical.
- Adding `GameSession` as the GUI main scene introduced an auto-start concern for headless replay. The runner must set `session.auto_start = false` before adding the session node, then start the replay-controlled session explicitly.
- The first death replay can end on frame 1 because contact damage is proximity-based and the danger enemy starts close to the spawn. That is acceptable for a deterministic outcome fixture, but not a final damage tuning model.
- Idle enemies originally blocked the player because `SimpleEnemy` is a `CharacterBody2D` with a collision shape. For the current slice, enemies now use distance-based session damage and scene collision layer/mask `0` so replay movement can pass through them while combat capture still works.
- Godot 4.6 can still load a `TileMap` node in the hub scene. The current `central_hub` includes `LevelTileMap` grid metadata plus StaticBody collision while full TileMap collision/importer work remains pending.
- Moving level ids into `level_catalog.json` immediately removed the need to touch `LevelLoader.gd` for every new representative room. This is a useful first schema boundary even before a full stage importer exists.
- The catalog still needs a hand-authored `level_catalog.source.json`, but the generator now validates scene files and Phaser reference paths. This gives future importer work a concrete output contract.
- The first Phaser stage mapping validation is intentionally narrow: it checks the central hub stage id and neighbor target strings, not the full layout. This is enough to prevent accidental detachment from the reference door graph while keeping the importer work incremental.
- Some Phaser neighbors are generated by helper functions rather than durable string literals in the branch stage file. The current validation records the durable literal edges and metadata first; full generated graph parity still needs a TypeScript-aware importer or exported stage manifest.
- The hub now has both slice-support doors (`heal_room`, `combat_room`, `jump_room`) and Phaser branch doors. This is a transitional content state; the branch rooms prove topology migration, while the slice rooms still provide replayable heal/combat/controller validation.
- TypeScript AST parsing can extract the hand-authored stage files without running Phaser. The generated manifest currently exports 14 static stage definitions and records dynamic procedural neighbor expressions such as `getIceExpanseEntryId()` for later importer work.
- Manifest/catalog validation alone does not prove playable topology. The content checker now verifies scene-level door markers for mapped endpoints and reports unmapped neighbors as deferred, which makes migration gaps explicit without pretending the full generated graph is ported.
- `goal-sanctum` was a good next migration target because it is a hand-authored Phaser stage in the manifest and carries the canonical goal-door intent. Adding it increased scene-level mapped door validation from 10 to 12 while keeping generated/procedural gaps deferred.
- Mapping the static sky cluster increased scene-level mapped door validation from 12 to 18 and reduced deferred neighbor count from 2 to 1. The remaining deferred edge is procedural (`forest-area -> labyrinth-001`), not another hand-authored static stage.
- Adding `labyrinth-001` as a representative procedural manifest entry resolves the previously deferred `forest-area -> labyrinth-001` edge without claiming that the entire generated labyrinth chain is scene-authored.
- Static Phaser reliquary stages already expose collectible ids in their stage configs, but the first manifest generator ignored those arrays. Extracting primitive object arrays is enough to validate `forest-keystone` without executing the Phaser runtime.
- `forest-reliquary` points west through a dynamic procedural helper. The current Godot scene uses a representative return door to `labyrinth_001`, while catalog `expected_neighbors` stays empty for that stage until the procedural chain importer can resolve the exact dynamic exit.
- The remaining static reliquaries use the same dynamic procedural exit pattern. Mapping them as representative rooms validates the keystone pickup contract now, while exact expanse return topology remains a procedural importer task.
- The save implementation is still intentionally narrow. It persists acquired item ids, current level id, HP, max HP, completed level ids, visited level ids, unlocked door ids, explored tiles, player position, current ability type, and the minimal settings payload, but it does not yet persist a complete UI-facing profile.
- Restoring saved player position across a replay that explicitly starts in a different level can create false early door transitions. `GameSession` now only applies saved position when the saved `current_level_id` matches the level being started.
- Ability restoration is global rather than level-scoped. A replay starting in `flat_room` can load `spark` from a prior combat-room save and emit `ability.used`; this matches ability ownership better than tying ability restore to the saved level id.
- Godot now persists a minimal tile-by-tile exploration model from player position and syncs it into a simple `MapOverlay`. This is still not a full map screen or TileMap visibility layer, but it closes the first UI-facing exploration loop.
- The Phaser procedural chain can be mirrored into manifest data without executing Phaser/Matter runtime code. This gives the next importer a complete durable graph input while avoiding 132 hand-authored scenes in this milestone.
- The generated procedural schema cleanly maps static exits such as `forest-area`, `ice-area`, reliquaries, and `sky-sanctum` to existing Godot ids through `level_catalog.source.json`, while preserving the original Phaser ids for auditability.
- The procedural schema is useful even before runtime loading because it makes the full generated graph testable in Vitest and visible to agents without opening every generated room as a `.tscn`.
- The first generated-room replay exposed an immediate west-door trigger because the default spawn was inside the generated west door radius. Moving the generated west door farther left fixed the representative eastward transition without adding per-room hand-authored overrides.
- Generated content can reuse the existing session systems once it is expressed as marker nodes. The `labyrinth_010` replay produced damage, heal, collectible, item acquisition, and door traces without adding new session-specific procedural code.
- A longer generated chain can now move from generated rooms into a hand-authored reliquary without adding intermediate `.tscn` scenes. The replay still ends by `max_frames` rather than a goal condition, which is acceptable for topology/content coverage but not final completion-flow coverage.
- Generated rooms can now produce a true completion outcome through marker data rather than only `replay.max_frames_reached`. The first case is intentionally narrow: terminal void rooms with only a west neighbor.
- The sky cluster replay exposed that generated branch exits can immediately compose with hand-authored goal-path rooms. That is useful coverage for mixed generated/scene-authored topology, distinct from the reliquary chain fixtures.
- The generated reliquary pattern now covers forest, ice, fire, and ruins clusters with equivalent trace evidence. The remaining generated-content weakness is less about cluster coverage and more about room-shape variety and longer cross-cluster routes.
- A replay suite needs to keep stdout machine-readable because agents and CI will consume the aggregate result. The suite runner therefore captures Godot output per replay and prints one final JSON object instead of inheriting Godot stdout.
- The existing `EnemySpawnMarker.enemy_type` field was unused until the flying enemy slice. Wiring it into `GameSession` gives future content migration a small enemy selection contract without adding a broad enemy factory yet.
- Event-only player traces were too sparse for controller tuning metrics; `controller_lab_jump` initially could report rise speed but not a useful fall-speed sample. Adding `player.sampled` to scene replay keeps the trace observable without changing gameplay code.
- TileMap metadata can be introduced without immediately converting all prototype collision geometry to TileMap collision. `LevelTileMap.collision_source` records the transitional state explicitly.
- Generated procedural placement was still mostly embedded in `LevelLoader.gd` constants. Moving it into `runtime_layout` keeps generated layout data reviewable in JSON and makes later room-shape variation less risky.
- Generated content placement had a second layer of GDScript derivation after floor/spawn/door/platform placement moved to JSON. The replay traces stayed stable after moving enemy/heal/collectible/goal marker payloads into `runtime_layout.content`, which confirms the schema can own gameplay placement without adding a separate procedural session path.
- The first route-shape variation did not need a loader change because generated platforms were already schema-driven. That is a useful signal: future room-shape work should add data to `runtime_layout` first and only touch Godot code when the schema needs a new primitive.
- The first map UI should stay very small. A rectangle-only `Control` overlay is enough to prove saved exploration reaches visible Godot UI and trace metrics without committing to the final map screen design.
- The first HUD should follow the same principle as the map overlay: expose the gameplay state needed to test the Godot mainline, but avoid porting the full Phaser UI stack before replay-trace parity is stronger.
- The first result overlay can be driven by the same payload style as HUD and map overlays. Emitting `result.overlay.shown` keeps run-end UI observable in replay metrics without adding a full Phaser-style results screen yet.
- The Phaser `deadEndOverrides` data gives concrete reward placement semantics beyond generic heal pickups. Treating `health`, `max-health`, and `revive` as marker `reward_type` values lets Godot preserve reward intent while keeping the pickup system small.
- The `central_hub` max-health dead-end sits close enough to branch geometry that a long idle replay can drift into a door after gravity settles. The fixture is intentionally capped at 5 frames to validate the pickup/session/save behavior without conflating it with traversal.
- Replacing generated route heals with exact Phaser dead-end reward placements made long generated chain replays die before reaching reliquaries. The stable generated content contract needs both: a route heal for current replayability, plus separate dead-end reward markers for Phaser reward parity.
- The local Godot binary is installed, but export templates are not. `godot:export` therefore must remain a graceful optional build path until CI or local setup installs the matching `4.6.3.stable` templates.
- A schema-only safety test exposed that generated east and south target spawns were close enough to their same-direction doors to risk immediate bounce-back transitions. This was not consistently visible in long route replays because the replay input often moved away quickly, so the invariant belongs in generated data validation.
- `npm test` is intentionally still the everyday repository gate; adding `test:canonical` gives a stronger parity gate that runs the full replay suite when Godot is present without making every local edit pay the full replay cost.
- The remaining legacy surface is not only `legacy/phaser-reference/src/`; `legacy/phaser-reference/public/`, `legacy/phaser-reference/index.html`, `legacy/phaser-reference/vite.config.ts`, `phaser`, `matter-js`, and `vite` are also part of the retirement inventory. Capturing that list now should make the eventual dependency removal less error-prone.
- A parity ledger is needed in addition to the inventory. Inventory can say what remains, but the ledger says whether each remaining Phaser reference system is ported, partial, deferred, deprecated, or still a retirement blocker.
- Settings parity was blocked less by storage and more by lack of a visible/replayable Godot consumer. A small `SettingsOverlay` plus replay actions was enough to make the persisted settings state observable through UI, trace, and metrics without porting the full Phaser settings menu.
- Inventory/progress UI can be treated as a trace consumer rather than a separate gameplay authority. `InventoryOverlay` only mirrors `GameSession` state, while `inventory.updated` gives agents a UI-facing state snapshot without image recognition.
- The final root runtime retirement can be done without physically deleting Phaser reference source. Removing root commands/dependencies and narrowing canonical tests to Godot keeps the reference readable while preventing Phaser/Vite from remaining part of the active project surface.

## Decision Log

- 2026-05-28: Use `godot/` as the canonical project directory. `game/` was avoided because the repository already has `legacy/phaser-reference/src/game/`, and `godot/` makes editor, runner, and CI commands unambiguous.
- 2026-05-28: Keep `prototypes/godot-v2/` during the initial promotion. It is a useful comparison point and avoids destructive deletion before Godot mainline validation.
- 2026-05-28: Keep Phaser runtime dependencies until Milestone 9. The Phaser implementation remains a legacy/reference source until Godot playable, replay, trace, metrics, and representative content are working.
- 2026-05-28: Keep `npm test` meaningful during migration by running TypeScript/Vitest plus a graceful Godot executable check. Godot-specific headless replay remains separately runnable through `npm run godot:replay`.
- 2026-05-28: Implement trace metrics as a Node script first. This keeps metrics testable in Vitest and allows useful validation even when Godot is absent.
- 2026-05-28: Let `GameSession` auto-start for `godot:run`, but disable that auto-start in `tests/run_replay.gd` so replay setup remains deterministic.
- 2026-05-28: Use enemy contact damage metadata for the first Godot game-over path. This reuses existing `EnemySpawnMarker` and `SimpleEnemy` instead of introducing a separate hazard system before the combat/session basics are stable.
- 2026-05-28: Implement heals as marker-driven session gameplay before broader collectible/save work. This directly migrates the Phaser design's dead-end heal concept into Godot without adding UI or persistence yet.
- 2026-05-28: Start content migration with `central_hub` as a representative hub and a replay path into `heal_room`, instead of attempting the full procedural stage graph. This keeps migration verifiable and leaves room for a schema/importer next.
- 2026-05-28: Treat `level_catalog.json` as the canonical catalog interface for migrated Godot content. Future importers should write or update this catalog rather than adding ids directly to GDScript.
- 2026-05-28: Keep generated runtime catalog `level_catalog.json` checked in for Godot loading simplicity, but make `level_catalog.source.json` the migration source of truth and validate generated output in `check:godot`.
- 2026-05-28: Add lightweight Phaser stage mapping checks to the catalog generator before attempting a full TypeScript stage importer. This raises confidence in representative content without coupling Godot generation to the full Phaser runtime.
- 2026-05-28: Add hand-authored representative branch rooms for all explicit `central-hub` neighbors before building the full importer. This makes the Godot hub graph visibly closer to Phaser while preserving small, verifiable scenes.
- 2026-05-28: Validate selected Phaser `metadata` fields with literal source checks as an interim schema contract. This avoids loading the TypeScript runtime from the catalog generator while still catching accidental drift in branch identity.
- 2026-05-28: Generate a checked-in Phaser stage manifest with the TypeScript compiler API instead of importing Phaser runtime modules. This gives Godot migration a deterministic content data source without executing Phaser/Matter code.
- 2026-05-28: Move catalog validation from raw source text checks to `stage_manifest.json`. The manifest is now the contract for stage ids, durable neighbor edges, and selected metadata until a fuller Godot level importer exists.
- 2026-05-28: Add a scene-level content checker instead of relying only on catalog JSON. Mapped Phaser edges must be represented by `DoorMarker.target_level_id` in Godot scenes; unmapped Phaser edges remain deferred until their target stage has a Godot mapping.
- 2026-05-28: Map `goal-sanctum` before procedural `labyrinth-001` because it is a static stage with goal semantics and gives the Godot content subset a Phaser-derived clear destination.
- 2026-05-28: Map `sky-sanctum`, `starlit-keep`, and `aurora-spire` together because their static Phaser topology is tightly connected. This avoids introducing new deferred static edges while extending the migrated late-game path.
- 2026-05-28: Add only `labyrinth-001` as the first procedural representative instead of dumping all generated nodes into Godot. This validates the procedural entry seam and leaves the full generated chain for a later importer/generator.
- 2026-05-28: Add `CollectibleMarker` and `collectible.collected` as marker/session behavior before persistence or inventory UI. This validates relic pickup observability while avoiding save-system work before Godot parity.
- 2026-05-28: Validate `forest_reliquary.expected_collectibles` against `stage_manifest.json` instead of hard-coding collectible ids only in docs. This keeps the first reliquary mapping tied to the Phaser reference config.
- 2026-05-28: Add the remaining static reliquary rooms before implementing inventory persistence. This increases migrated content coverage without entangling collectible pickup with save data or UI.
- 2026-05-28: Add `item.acquired` and metrics extraction before save-system work. Agent-driven analysis needs stable item ids in trace summaries before deciding how persistent collectible progression should work.
- 2026-05-28: Implement Godot save persistence as a small JSON item-id store first. This makes reliquary progression durable without prematurely porting the full Phaser `SaveManager` surface.
- 2026-05-28: Extend save persistence to HP/current-level/completed-level fields once item saves were stable. This keeps save parity moving while still avoiding an all-at-once port of Phaser storage/settings behavior.
- 2026-05-28: Persist player position in the Godot save file, but gate restoration by level id. Explicit replay scene selection remains authoritative when it disagrees with a saved `current_level_id`.
- 2026-05-28: Persist `ability_type` in the Godot save file and restore it independently of saved level id. Ability ownership is session/player state, while position is level-local state.
- 2026-05-28: Persist `visited_level_ids` and `unlocked_door_ids` before tile-level map exploration. Door ids are stored as `source_level_id:door_id` so they remain stable and unique across scenes.
- 2026-05-28: Store generated spawn/door safety as `runtime_layout.safety` instead of only documenting it or leaving it as loader constants. The schema now owns `door_trigger_radius` and `min_spawn_door_distance`, while Godot reads the generated door radius from that data.
- 2026-05-28: Promote the default `build` command to Godot export before moving or deleting Phaser runtime files. This makes the repo command surface Godot-canonical while preserving `build:legacy:web` for the current web reference.
- 2026-05-28: Promote the default `dev` command to Godot before moving or deleting Phaser runtime files. Vite remains available through explicit legacy web commands so the reference implementation can still be inspected during migration.
- 2026-05-28: Persist the Phaser-compatible settings fields `volume`, `controls`, and `difficulty` in the Godot save file even before a Godot settings UI exists. Save/load/replay can now preserve settings while UI work remains deferred.
- 2026-05-28: Persist `explored_tiles` in the same `{ level_id: ["column,row"] }` shape used by Phaser save data, but derive the keys from Godot player position and `exploration_tile_size` instead of porting Phaser `AreaManager`.
- 2026-05-28: Connect `explored_tiles` to a minimal `MapOverlay` before building a full map screen. This gives the Godot mainline a visible exploration consumer and a `map.updated` trace contract while preserving freedom to redesign the final UI.
- 2026-05-28: Add a minimal `HudOverlay` before the full UI port. HP, ability, item count, level id, and outcome are now visible and traceable through `hud.updated`, while detailed menus, animation, audio, and inventory screens remain deferred.
- 2026-05-28: Add a minimal `ResultOverlay` before porting the full Phaser results UI. Completed and game-over runs now have player-facing result state and `result.overlay.shown` trace metrics, while scoring, menus, animation, and audio remain deferred.
- 2026-05-28: Generate the full `labyrinth-001` through `labyrinth-132` procedural topology into `stage_manifest.json`, but do not automatically add all of those nodes to `level_catalog.source.json` until a Godot scene/schema generator can make them playable.
- 2026-05-28: Add `procedural_levels.json` as a generated schema layer before adding runtime-generated scenes. This keeps the full procedural graph canonical and validated without creating 132 placeholder scenes or overloading `level_catalog.json`, which still represents scene-loadable levels.
- 2026-05-28: Keep generated procedural rooms out of `level_catalog.json` and resolve them through a `LevelLoader` fallback. This preserves the catalog as the list of hand-authored scenes while still making generated rooms playable and traceable.
- 2026-05-28: Generate procedural gameplay content as marker nodes rather than adding a separate procedural gameplay path. This keeps generated rooms compatible with `LevelDefinition`, `GameSession`, replay, trace, save, and metrics behavior already used by hand-authored rooms.
- 2026-05-28: Add explicit directional spawns to generated rooms instead of relying on `find_marker_by_id` falling back to the first spawn. This makes door transitions more robust as generated chain replay coverage gets longer.
- 2026-05-28: Generate terminal void goals through `GoalMarker` rather than special-casing completion in `GameSession`. This preserves the marker-based level contract for generated rooms.
- 2026-05-28: Broaden generated replay coverage with fixtures rather than adding more hand-authored scenes. This keeps the procedural migration focused on schema/runtime generation while still producing trace evidence for cluster-specific topology.
- 2026-05-28: Use short end-of-cluster replay chains for fire and ruins instead of traversing all generated rooms in each cluster. This keeps validation runtime practical while proving the generated reliquary exit contract for each cluster.
- 2026-05-28: Keep `godot:replay-suite` as an explicit command rather than folding it into `npm test`. The suite is canonical replay validation when Godot is available, while normal `npm test` must remain useful and graceful on machines without Godot.
- 2026-05-28: Add a flying enemy variant and release replay before porting the full enemy roster. This covers the missing `enemy.released` trace path and proves marker-selected enemy types while keeping combat scope intentionally small.
- 2026-05-28: Include controller movement replay in the canonical replay suite and emit per-frame samples only for scene replay runs. This gives movement tuning stable metrics while avoiding noisy per-frame trace output for every `GameSession` content replay.
- 2026-05-28: Add TileMap metadata to `LevelDefinition` before replacing StaticBody collision. This lets editor-authored grid size and tile size become canonical while preserving playable collision during migration.
- 2026-05-28: Put generated room placement in `procedural_levels.json.runtime_layout` before adding richer layouts. This keeps the generator as the source of truth and lets runtime loading consume schema data rather than accumulating GDScript constants.
- 2026-05-28: Put generated gameplay marker placement under `runtime_layout.content` instead of leaving content-specific rules in `LevelLoader.gd`. The generator remains responsible for deciding when procedural rooms receive enemy, heal, collectible, or terminal goal markers; the loader only materializes the marker nodes.
- 2026-05-28: Represent vertical generated routes as a `runtime_layout.room.variant` plus normal platform entries rather than adding a new Godot node type. This keeps generated layout variation inside the existing schema and loader path.
- 2026-05-28: Model Phaser dead-end rewards as `HealMarker.reward_type` rather than adding a separate reward node class. This keeps health, max-health, and future revive behavior in the same marker/session path while still exposing reward semantics to catalog validation and traces.
- 2026-05-28: Implement `revive` as a session-level extra life counter instead of a direct heal. A revive pickup emits `player.revive_acquired`, lethal damage consumes one revive and emits `player.revived`, and the run only reaches `game.over` once the counter is empty.
- 2026-05-28: Keep generated route heals even after adding Phaser dead-end reward markers. The route heal preserves existing generated chain playability, while the dead-end markers preserve migration metadata and future editor/schema placement intent.
- 2026-05-28: Add `godot:export` before changing the default `build` command. Export templates are often missing on local or CI machines, so the wrapper must skip gracefully until the mainline switch can make Godot export a hard gate.
- 2026-05-28: Keep `check:godot` focused on static/export-preset validation, not a full binary export. The check path should prove the canonical export configuration is present while remaining green without export templates.
- 2026-05-28: Add `test:canonical` instead of folding the full replay suite into `npm test`. This preserves a fast, graceful default gate while giving release/migration review a single stronger command that includes replay parity.
- 2026-05-28: Add a legacy inventory command before moving Phaser files. The migration should retire `legacy/phaser-reference/src/`, Vite config, and Phaser/Matter dependencies from an audited list rather than by ad-hoc deletion.
- 2026-05-28: Add a Phaser parity ledger and make `check:godot` validate its schema and evidence paths. Blocker enforcement remains explicit through `--fail-on-blockers` so daily checks stay green while still making unfinished parity visible.
- 2026-05-28: Treat the Godot settings scope as ported once settings are persisted, sanitized, visible in a minimal overlay, adjustable through replay actions, and summarized through trace metrics. Full menu polish remains part of the broader UI/polish blocker rather than the save/settings blocker.
- 2026-05-28: Count minimal map, HUD, inventory/progress, settings, and result overlays as the runtime-retirement UI baseline. Polished menus, animation, audio cues, and final visual treatment remain tracked by deferred `audio-and-polish` backlog rather than blocking Phaser runtime retirement.
- 2026-05-28: Treat retained `legacy/phaser-reference/src/`, `legacy/phaser-reference/public/`, `legacy/phaser-reference/index.html`, and `legacy/phaser-reference/vite.config.ts` as legacy/reference source only. Root runtime commands, package dependencies, typecheck, and Vitest validation are now Godot canonical; Phaser/Vite can be audited from source but not run from the root package.
- 2026-05-29: Keep optional legacy/reference copies discoverable through `legacy:inventory`, but do not make current generators, docs, tests, or parity evidence depend on their paths. The canonical source of migrated stage topology is now `godot/levels/stage_manifest.json`.

## Plan Of Work

Milestone 1: Canonical migration plan and repo orientation

Create this ExecPlan. Update README and AGENTS so Godot is described as canonical, while Phaser is described as legacy/reference until migration gates pass. Do not delete runtime code.

Milestone 2: Godot mainline scaffold

Promote the prototype into `godot/`. Add `godot/project.godot`, `godot/scenes`, `godot/scripts`, `godot/levels`, `godot/tests`, and script wrappers for run, replay, trace summary, and graceful Godot checking. Make the main scene start a minimal `GameSession`.

Milestone 3: Player controller mainline

Harden `PlayerController.gd` and `PlayerTuning.gd` under `godot/`. Keep `CharacterBody2D`; never use `RigidBody2D` for the player. Preserve tuning fields for max speed, ground/air acceleration and deceleration, rising/falling gravity, coyote time, jump buffer, jump cut, and hover.

Milestone 4: Level system

Move level design toward TileMap plus marker nodes. Keep metadata in `PlayerSpawn`, `DoorMarker`, `EnemySpawnMarker`, `HealMarker`, `CollectibleMarker`, `GoalMarker`, and `CameraBoundsMarker`. `LevelLoader` must scan markers instead of hard-coding spawn positions in the player.

Milestone 5: Session, transition, outcome

Make `GameSession` own current level id, player spawn, trace recorder, run timer, outcome, door transition, goal clear, death, and game over. Emit `level.loaded`, `door.entered`, `run.finished`, and failure/death events.

Milestone 6: Combat core

Keep one or two enemy types. Implement inhale, capture, release, swallow, ability acquire, and ability use with trace events. Avoid full enemy roster, polished animation, audio, save, or HUD until the core loop is reliable.

Milestone 7: Replay, headless trace, metrics

Make JSON replay input canonical. Run headless replay through Godot when available, write JSON or NDJSON trace, and summarize traces into metrics JSON. Vitest should cover metrics extraction and script behavior independent of Godot.

Milestone 8: Content migration

Migrate a representative playable subset of the Phaser area graph: central hub, several branch rooms, door graph examples, heal, collectible, goal, and combat rooms. Convert durable `docs/design.md` details into Godot-focused docs. Do not bulk-port all 128+ areas manually before the canonical schema/importer exists.

Milestone 9: Mainline switch

Update README, CI/local validation, and default commands so Godot is the mainline. Move Phaser/Vite runtime to `legacy/` or remove it if no longer needed. Remove Phaser/Matter/Vite dependencies only after Godot gates pass.

Milestone 10: Cleanup and final verification

Remove obsolete docs/scripts, update this ExecPlan retrospective, run final validation, and summarize changed files, tests run, skipped checks, and manual verification still needed.

## Validation

At the end of each milestone, run the fastest meaningful validation:

- `npm test`
- `npm run trace:summary -- <sample trace path>` after trace samples exist
- `npm run godot:replay -- --replay res://tests/replays/combat_capture_swallow_goal.json --out user://combat_capture_swallow_goal.ndjson` when Godot is installed
- `npm run check:godot`, which must skip gracefully if Godot is missing

If Godot is unavailable, document the skipped check and keep static/Vitest/metrics validation green.

## Interfaces And Dependencies

Canonical Godot project:

- `godot/project.godot`
- `godot/scenes/Main.tscn`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/enemies/SimpleEnemy.gd`
- `godot/scripts/enemies/FlyingEnemy.gd`
- `godot/scripts/player/PlayerController.gd`
- `godot/scripts/player/PlayerTuning.gd`
- `godot/scripts/level/**`
- `godot/scripts/level/LevelTileMap.gd`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/scripts/sim/**`
- `godot/tests/replays/**`

Node validation scripts:

- `scripts/check-godot.mjs`
- `scripts/check-godot-content-migration.mjs`
- `scripts/export-godot.mjs`
- `scripts/generate-godot-procedural-levels.mjs`
- `scripts/check-godot-stage-manifest.mjs`
- `scripts/legacy-inventory.mjs`
- `scripts/check-godot-parity-ledger.mjs`
- `scripts/run-godot-replay-suite.mjs`
- `scripts/run-godot-replay.mjs`
- `scripts/trace-summary.mjs`

Package commands:

- `npm run godot:run`
- `npm run dev`
- `npm run godot:export`
- `npm run build`
- `npm run build:godot`
- `npm run godot:replay`
- `npm run godot:replay-suite`
- `npm run godot:stage-manifest`
- `npm run godot:procedural-levels`
- `npm run godot:content-check`
- `npm run godot:parity-ledger`
- `npm run check:godot`
- `npm run trace:summary`
- `npm run legacy:inventory`
- `npm test`
- `npm run test:canonical`

## Idempotence And Recovery

All promotion work should be repeatable without deleting the Phaser runtime. If a Godot replay fails, inspect trace output first, update this ExecPlan's discoveries and decisions, then fix the smallest failing behavior under TDD. If generated `.godot/` editor cache files appear, do not treat them as source; they should remain untracked.

## Outcomes & Retrospective

Complete for the requested mainline migration boundary, with one additional 2026-05-29 tightening pass: the repo has a canonical `godot/` project, Godot-aware package commands, a self-contained migration ExecPlan, Godot canonical README/AGENTS guidance, trace metrics tooling, and a canonical Godot export wrapper that skips missing local export templates gracefully. Root Phaser/Vite commands and direct runtime dependencies have been removed, and optional legacy/reference copies are no longer required by current Godot generators, docs, tests, or parity evidence. Milestone 3 has controller movement replay in the canonical suite plus frame-level `player_motion` metrics for tuning review. Milestone 4 has `LevelDefinition` collecting both marker nodes and `LevelTileMap` TileMap metadata, with `central_hub` carrying editor-visible tile size/grid metadata while retaining transitional StaticBody collision. Milestone 6 has a small mainline-oriented combat loop with simple ground and flying enemies, marker-selected enemy type, capture, release, recapture, swallow, ability acquisition/use, damage/game-over coverage, revive reward coverage, and replay trace evidence. Milestone 7 has a canonical replay suite command that runs representative headless Godot replays and emits aggregate JSON metrics, including `last_player_revive_count`, `last_settings`, `last_inventory`, `last_hud`, and `last_result_overlay`. Milestone 8 has full canonical stage topology coverage through hand-authored Godot scenes or generated schema: 146 stage ids, 132 generated schema levels, and 263 generated neighbor edges are validated from `godot/levels/stage_manifest.json`. The Godot mainline has small visible overlays for map exploration, settings, HUD state, inventory/progress state, and run results without porting final presentation polish. The parity ledger reports ported entries plus one deferred non-blocking `audio-and-polish` backlog entry, with 0 retirement blockers.
