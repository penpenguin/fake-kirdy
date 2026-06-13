# Full Migration ExecPlan Snapshot 01: Purpose, Context, Progress

Imported from `docs/godot-v2/full-migration-execplan.md`.

# Full Godot Migration ExecPlan

Status: Completed historical record. Godot is now the canonical runtime in `godot/`; root Phaser/Vite runtime commands and dependencies have been removed, and the legacy reference copy is no longer present in the repository. Use this file for migration history and decision context, not as the active docs index.

This ExecPlan is a living document for making Godot 4 the canonical runtime for Fake Kirdy. It follows `.agent/PLANS.md` and must stay self-contained: a new agent should be able to resume from this file without relying on the chat history.

## Purpose

The project is formally adopting Godot v2 as the mainline game. The existing Phaser + Matter implementation remains useful as a legacy/reference source for gameplay intent, map topology, controls, tests, and regression expectations, but the end state is a Godot canonical build, run, replay, trace, and metrics workflow.

The migration must not start with destructive deletion. First, Godot must become playable and observable. Only after the Godot mainline has controller, levels, transitions, combat, replay, trace, metrics, and representative content should Phaser/Vite/TypeScript runtime code move to `legacy/` or be removed.

## Current Context

The repository currently has a Phaser + Matter game under `legacy/phaser-reference/src/`, with Vite/Vitest scripts in `package.json`. The Phaser version concentrates much of the runtime orchestration in `legacy/phaser-reference/src/game/scenes/index.ts`, with `GameScene` owning player input, `Kirdy`, inhale/swallow/ability systems, enemy spawning, area transitions, HUD, save progress, goal results, and game-over flow.

The Phaser `Kirdy` movement model uses Matter velocity operations such as direct horizontal velocity assignment and a jump velocity constant. Godot must replace this with `CharacterBody2D` and tuning-driven acceleration, deceleration, gravity, jump buffering, coyote time, variable jump height, hover, and replay-compatible input.

The former Godot prototype has been promoted into the repo-level `godot/` mainline and no longer exists as a separate `prototypes/` tree. The canonical project now owns the controller, marker-based levels, replay input, trace recorder, session transitions, combat slice, and migrated content.

## Progress

- [x] 2026-05-28: Read `AGENTS.md`, `.agent/PLANS.md`, `package.json`, `docs/design.md`, `legacy/phaser-reference/src/game/characters/Kirdy.ts`, `legacy/phaser-reference/src/game/scenes/index.ts`, `legacy/phaser-reference/src/game/world/AreaManager.ts`, `legacy/phaser-reference/src/game/world/stages/`, and the existing `prototypes/godot-v2/` tree.
- [x] 2026-05-28: Added a Vitest contract for the Godot mainline migration so the repo records the expected ExecPlan, canonical `godot/` location, package scripts, README guidance, and AGENTS guidance.
- [x] 2026-05-28: Promoted the existing Godot prototype into `godot/` without deleting `prototypes/godot-v2/`.
- [x] 2026-05-29: The promoted Godot prototype tree has been removed; `godot/` is the only retained Godot project tree.
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
- [x] 2026-05-28: Added `goal_sanctum` as the next mapped static Phaser stage beyond the central branches, including `mirror_corridor -> goal_sanctum`, `goal_sanctum -> mirror_corridor`, a `GoalMarker`, and the original mirror-to-goal replay. Current coverage uses `mirror_to_goal_sanctum_locked_without_keystone.json` for the locked shortcut and `sky_sanctum_to_goal_finish.json` for goal completion.
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
- [x] 2026-05-28: Ran save-enabled headless replays for the mirror goal route and `heal_room_recover_and_goal.json`; goal completion saved completed level ids, and damage/heal wrote updated HP.
- [x] 2026-05-28: Extended the Godot save schema and trace metrics to include saved `player_position`.
- [x] 2026-05-28: Replayed the mirror goal route against an existing save and fixed saved-position application so a position is only restored when the saved level matches the replay start level.
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

Note: The source ExecPlan progress section continues in `mem:docs/execplans/full-migration/02-discoveries-decisions` due memory size.