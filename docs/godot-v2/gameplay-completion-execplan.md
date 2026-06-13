# Complete the Godot Gameplay Loop

Status: Completed historical record with one non-blocking follow-up for future polish and tuning. Current implementation work should start from `docs/README.md`, `docs/godot-v2/README.md`, `Task.md`, checked-in Godot data, and tests.

This ExecPlan is a living document for turning the current Godot mainline from a replayable migration slice into a playable game loop. It follows `.agent/PLANS.md` and must stay self-contained so a new contributor can resume from this file alone.

## Purpose

Fake Kirdy currently has a strong Godot migration foundation, but several game-facing systems are still too thin: the main scene starts in a combat test room, the combat room can finish before its exit door, ability use has not been a damaging action, enemies have not had health or defeat, door locks have not consumed progression state, and difficulty has not meaningfully shaped gameplay. After this plan is complete, a player starts from the hub, enters combat and exploration rooms, defeats enemies with abilities or spit projectiles, unlocks doors through items, abilities, completed levels, enemy groups, or bosses, and sees objectives and combat feedback in HUD traces.

## Progress

- [x] 2026-05-30: Added `test/godot-v2-gameplay-completion.test.ts` as the first red contract for the backlog.
- [x] 2026-05-30: Changed the default mainline start from `combat_room` to `central_hub`.
- [x] 2026-05-30: Moved the `combat_room` goal past the exit door so door transition is reachable first.
- [x] 2026-05-30: Added enemy HP, damage, defeat, knockback, patrol/chase AI hooks, and group/boss metadata to `SimpleEnemy.gd`.
- [x] 2026-05-30: Turned ability use into immediate range-based damage and turned release into a traceable spit projectile hit path.
- [x] 2026-05-30: Added `DoorMarker` gate metadata for item, ability, completed level, defeated enemy group, and boss requirements.
- [x] 2026-05-30: Added locked-door trace/HUD feedback, defeated group/boss runtime state, difficulty profiles, and combat HUD fields.
- [x] 2026-05-30: Extended `SaveState.gd` and `trace-summary.mjs` with defeated enemy group/boss and door lock summary fields.
- [x] 2026-05-30: Reflected the first dynamic branch neighbor doors in hand-authored `fire_area`, `ice_area`, and `cave_area` scenes, pointing to generated `labyrinth_011`, `labyrinth_006`, and `labyrinth_033`.
- [x] 2026-05-30: Extended `combat_capture_swallow_goal.json` max frames so, in a Godot-installed environment, the replay has room to transition through the combat exit and complete in `flat_room`.
- [x] 2026-05-30: Added authored gate usage: `combat_room` requires `spark`, `forest_reliquary` requires `forest-keystone`, and `sky_sanctum` uses completed-level, enemy-group, and boss requirements.
- [x] 2026-05-30: Added `HazardMarker.gd`, level definition scanning for hazards, `GameSession.check_hazard_contacts()`, `hazard.entered` traces, and a spike hazard in `danger_room`.
- [x] 2026-05-30: Extended `trace-summary` and its test fixture with `enemies_defeated`, defeated group/boss ids, `door_lock_reasons`, and `hazards_entered`.
- [x] 2026-05-30: Added `AbilityGateMarker.gd`, level definition scanning for ability gates, `GameSession.check_ability_gate_interactions()`, `ability_gate.opened` traces, and save/trace-summary state for opened ability gates.
- [x] 2026-05-30: Added the first five authored ability terrain examples: fire melts an ice block in `fire_area`, ice freezes water in `ice_area`, sword cuts vines in `forest_area`, stone presses a switch in `cave_area`, and spark powers a device in `sky_sanctum`.
- [x] 2026-05-30: Added metadata-driven generated room objectives, generated hazards, and generated ability gates to `procedural_levels.json`, and taught `LevelLoader.gd` to instantiate the generated hazard and ability gate markers.
- [x] 2026-05-30: Added active enemy attack timing with marker-authored attack radius/cooldown/damage, `enemy.attack.started` trace events, and difficulty-scaled attack cadence.
- [x] 2026-05-30: Added focused replay fixtures and suite-level expected event/HUD checks for ability damage, enemy defeat, locked doors, ability-unlocked doors, hazards, ability terrain gates, and hard enemy attack traces.
- [x] 2026-05-31: Added the canonical three-active-enemy spawn cap with `enemy.spawn.skipped` trace coverage in `enemy_spawn_limit_room`.
- [x] 2026-05-31: Added Kirdy-adjacent enemy crowd spacing with `enemy.crowd.spacing_applied` trace coverage in `enemy_crowd_spacing_room`.
- [x] 2026-05-31: Added a replayable `spark` dash movement effect with `ability.movement.applied` trace coverage.
- [x] 2026-05-31: Added ability-specific enemy AI profiles with `enemy.ai.profile.applied` trace coverage.
- [x] 2026-05-31: Added hidden collectible and hidden passage discovery with `hidden.discovered` replay coverage.
- [x] 2026-05-31: Added dead-end reward completion tracking with `dead_end.completed` trace coverage and map feature state.
- [x] 2026-05-30: Expanded generated enemy encounters with ground/flying/elite roles and generated attack timing metadata, restored by `LevelLoader.gd`.
- [x] 2026-05-30: Added replay contracts for spit projectile hits and item-key door progression through `flying_spit_projectile_hit`, `forest_reliquary_locked_without_key`, and `forest_reliquary_key_unlocks_door`.
- [x] 2026-05-30: Ran the expanded replay suite with Godot 4.6.3 and fixed the runtime-only failures surfaced by real traces.
- [x] 2026-05-30: Tuned generated route survivability by making route heals stronger, reducing generated elite burst damage, lengthening generated enemy attack cooldowns, and trimming long generated-chain replays after reliquary arrival.
- [ ] Further expand hand-authored polish and runtime tuning beyond the first complete replay-backed gameplay loop.

## Surprises & Discoveries

- Observation: The repository had no MCP resources listed in this session, so implementation relied on checked-in docs, tests, and source files.
  Evidence: `list_mcp_resources` returned an empty resource list.
- Observation: The default PATH still has no `godot`, but a temporary official Godot 4.6.3 binary was downloaded under `/tmp/fake-kirdy-godot-bin/` and used for real replay validation.
  Evidence: `PATH=/tmp/fake-kirdy-godot-bin:$PATH npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite-gameplay-16` returned `passed_replays: 23`, `failed_replays: 0`.
- Observation: Real Godot traces exposed runtime issues that Vitest contracts could not catch: generated route chains died after active enemy attacks, `fire_area`'s gate spawn overlapped a door trigger, and fixed door-lock/key-door fixtures ran too long.
  Evidence: `/tmp/fake-kirdy-godot-replay-suite-gameplay-12` initially reported 14 passed / 9 failed; after focused TDD fixes, `/tmp/fake-kirdy-godot-replay-suite-gameplay-16` reported 23 passed / 0 failed.

## Decision Log

- Decision: Keep `combat_room` as a hub-accessible tutorial/validation room instead of making it the initial level.
  Rationale: `central_hub` is the real mainline entry point, while `combat_room` still has value as a narrow combat fixture.
  Date/Author: 2026-05-30 / Codex.
- Decision: Implement first-pass ability attacks as immediate range checks in `GameSession.gd` instead of spawning separate projectile scenes.
  Rationale: The existing combat slice is session-driven and trace-driven. Immediate checks create observable damage/defeat behavior with minimal new scene complexity, while leaving room to replace the internals with projectile nodes later.
  Date/Author: 2026-05-30 / Codex.
- Decision: Add all five requested door gate fields now, but leave authored locked-door content as follow-up.
  Rationale: The interface is now stable for levels and generated schema; content can adopt it incrementally through TDD replay fixtures.
  Date/Author: 2026-05-30 / Codex.
- Decision: Use `danger_room` for the first marker-driven hazard.
  Rationale: `danger_room` already validates damage and game-over behavior, so adding a spike marker there proves the hazard path without creating another one-off test room.
  Date/Author: 2026-05-30 / Codex.
- Decision: Put the first authored gate requirements on existing progression rooms rather than making a new gate-only scene.
  Rationale: `combat_room`, `forest_reliquary`, and `sky_sanctum` are already in the canonical catalog and replay/content checks, so the gate metadata now lives on playable mainline content.
  Date/Author: 2026-05-30 / Codex.
- Decision: Model ability terrain as marker interactions opened by `use_ability()` rather than as physics blockers in the first slice.
  Rationale: The project already validates gameplay through marker metadata and trace events. A marker interaction proves each ability has a traversal use while keeping the first implementation observable and low-risk until Godot runtime replays can be added.
  Date/Author: 2026-05-30 / Codex.
- Decision: Export generated objectives, hazards, and ability gates as runtime schema content rather than hard-coding them in `LevelLoader.gd`.
  Rationale: The generated rooms should remain data-driven, and the loader should only rehydrate marker nodes from checked-in schema data.
  Date/Author: 2026-05-30 / Codex.
- Decision: Implement the first enemy attack upgrade as session-resolved timed attacks rather than new projectile scenes.
  Rationale: It turns enemies into active attackers with traceable timing and damage while keeping the runtime deterministic and replay-observable before adding richer enemy projectile nodes.
  Date/Author: 2026-05-30 / Codex.
- Decision: Extend the replay suite schema with `expected_events` and `expected_last_hud`.
  Rationale: Outcome-only replay checks are too weak for gameplay completion; the suite now fails on a Godot-installed machine when required trace events or HUD state are absent.
  Date/Author: 2026-05-30 / Codex.
- Decision: Add generated encounter variety through schema-authored enemy roles instead of extra loader rules.
  Rationale: Procedural rooms stay inspectable in `procedural_levels.json`, and `LevelLoader.gd` remains a rehydration layer for marker metadata.
  Date/Author: 2026-05-30 / Codex.
- Decision: Use the existing `forest_reliquary` item lock and `flying_combat_room` combat fixture for the next replay contracts.
  Rationale: Both rooms are already in the canonical Godot surface. Adding a door-check spawn and a spit target enemy proves the requested flows without adding a one-off test-only level.
  Date/Author: 2026-05-30 / Codex.
- Decision: Keep generated enemies active but tune generated route survival around one major generated attack window per room.
  Rationale: The expanded suite should prove active attacks without making long generated traversal fixtures fail before their progression evidence is collected.
  Date/Author: 2026-05-30 / Codex.

## Outcomes & Retrospective

The first implementation milestone is complete at both the TypeScript/Vitest contract level and the Godot runtime replay level. The mainline start now points to `central_hub`; `combat_room` no longer completes before its exit door; enemies are damageable and defeatable; ability use and spit release can apply damage and emit traces; door lock metadata and runtime checks exist; authored levels now use those gate fields; difficulty profiles affect enemy HP, contact damage, attack cadence, heal amount, and player invulnerability; HUD and trace summary payloads expose the new state; the first dynamic branch doors now connect authored branch rooms into generated expanse rooms; `danger_room` now has a marker-driven spike hazard; the first five ability terrain gates are present in authored branch/sky rooms; generated labyrinth rooms now carry schema-driven objectives, hazards, ability gates, and varied enemy roles that the runtime loader rehydrates into marker nodes; and enemies now have active timed attacks instead of only passive proximity damage.

The remaining work is polish rather than a blocking loop gap: richer authored level pacing, better visual/audio combat feedback, and more nuanced ability-specific attacks can now build on passing replay coverage.

## Context and Orientation

The canonical runtime is the Godot 4 project under `godot/`. `godot/scenes/Main.tscn` instantiates `GameSession.gd`, which owns level loading, replay input, trace emission, save state, HUD sync, combat checks, pickups, doors, goals, and outcome state. Levels are marker-driven: `DoorMarker.gd`, `EnemySpawnMarker.gd`, `GoalMarker.gd`, `CollectibleMarker.gd`, `HealMarker.gd`, and `PlayerSpawn.gd` expose editor-placeable metadata, which `LevelLoader.gd` converts into a level definition consumed by `GameSession.gd`.

The fast repository test gate is `npm run check:test`, which runs Vitest over Godot migration contracts and `trace-summary`. `npm run check:godot` validates checked-in Godot manifests, procedural schema, catalog output, content topology, parity ledger, export config, and gracefully skips executable checks when Godot is absent. `npm run godot:replay-suite` runs canonical headless replays only when Godot is installed.

## Plan of Work

The first milestone establishes combat and gate interfaces without broad content churn. Keep the implementation in the current session architecture: `GameSession.gd` performs range-based combat resolution, records trace events, updates runtime save state, and syncs HUD/inventory payloads. `SimpleEnemy.gd` owns health, damage, defeat, and lightweight AI movement. `DoorMarker.gd` owns progression requirements, and `GameSession.gd` evaluates them before calling `load_level`.

The second milestone adds focused replays under `godot/tests/replays/` and suite entries in `godot/tests/replay_suite.json` for: ability use damages an enemy, enemy defeat emits `enemy.defeated`, spit release emits `spit.projectile.hit`, a locked door refuses transition without an ability, an ability-unlocked door transitions, a key door refuses transition without its item, a key pickup unlocks the same door, a hazard emits `hazard.entered` and damages the player, an ability terrain gate emits `ability_gate.opened`, and hard difficulty produces higher target enemy HP in HUD state. These fixtures are now checked into the suite; they still need execution on a Godot-installed machine.

The third milestone should enrich content. Add authored or generated rooms that use the new gate fields, introduce simple ability terrain blockers, and add hazards such as spikes or lava through marker metadata. Keep each content addition replay-backed and small.

## Concrete Steps

From `/home/user/repository/fake-kirdy`, run the focused contracts first:

    npx vitest run test/godot-v2-gameplay-completion.test.ts

Then run the normal fast gate:

    npm run check:test

Run canonical validation:

    npm run check:typecheck
    npm run check:godot

With Godot installed or available on PATH, run:

    npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite-gameplay

If replay output is available, inspect focused traces through:

    npm run trace:summary -- /tmp/fake-kirdy-godot-replay-suite-gameplay/combat_capture_swallow_goal.ndjson

## Validation and Acceptance

The current milestone is accepted when `test/godot-v2-gameplay-completion.test.ts` passes, `npm run check:test` passes, `npm run check:typecheck` passes, `npm run check:godot` passes or skips only Godot executable validation due to a missing local Godot binary, and a Godot-installed environment reports all configured replay-suite entries passed. The focused traces now show `ability.used`, `enemy.damaged`, `enemy.defeated`, `spit.projectile.fired`, `spit.projectile.hit`, `door.locked`, `hazard.entered`, `ability_gate.opened`, `door.entered`, `dead_end.completed`, and `goal.door.entered` after requirements are satisfied.

## Idempotence and Recovery

All commands are read-only validation except generated checks, which run in `--check` mode. If catalog or procedural files become stale after future content changes, rerun the relevant generator without `--check`, inspect the generated diff, then rerun `npm run check:godot`. Do not remove `Goal.md`; it is an untracked user-supplied backlog input.

## Artifacts and Notes

The first red run failed all seven new contract tests, proving the tests described existing gaps. After the first implementation slice, the focused test passed:

    Test Files  1 passed (1)
    Tests       7 passed (7)

The full Vitest contract gate also passed:

    Test Files  29 passed (29)
    Tests       143 passed (143)

The generated procedural objective/gate/hazard slice passed its focused contracts:

    Test Files  2 passed (2)
    Tests       19 passed (19)

The replay suite was also validated with a temporary official Godot 4.6.3 binary:

    replay_count: 37
    passed_replays: 37
    failed_replays: 0

## Interfaces and Dependencies

`DoorMarker.gd` now exposes `required_item_id`, `required_ability_type`, `required_completed_level_id`, `required_defeated_enemy_group_id`, and `required_boss_id`. `GameSession.gd` evaluates these with `get_door_lock_reason(payload)` and emits `door.locked` when a requirement is missing.

`SimpleEnemy.gd` now exposes `max_hp`, `hurt_invulnerability_ms`, `patrol_radius`, `patrol_speed`, `chase_speed`, `detection_radius`, `return_radius`, `enemy_group_id`, and `boss_id`. It implements `take_damage(amount, source)`, `die(source)`, `apply_knockback(knockback)`, and `configure_ai(player, configured_patrol_radius)`.

Enemy damage also has a visible hit feedback path. `SimpleEnemy.show_hit_feedback()` flashes the `Body` sprite with `hit_flash_color`, keeps defeated enemies visible for `defeat_flash_ms`, and `GameSession.apply_damage_to_enemy()` emits `enemy.feedback.shown` with the flash metrics before defeat handling.

`SimpleEnemy.gd` also exposes `attack_damage`, `attack_radius`, `attack_cooldown_ms`, and `attack_cooldown_remaining_ms`. `EnemySpawnMarker.gd` can author those values, and `GameSession.gd` runs `check_enemy_attacks(delta)` to emit `enemy.attack.started` and damage the player with `source_type: enemy_attack`.

`GameSession.gd` now exposes the behavior-level helpers `get_ability_profile(ability_type)`, `find_enemy_targets(profile, ignored_enemy)`, `apply_damage_to_enemy(enemy, amount, source, knockback)`, `get_difficulty_profile()`, and `apply_difficulty_to_enemy(enemy)`. Trace summary output includes `enemies_defeated`, `defeated_enemy_group_ids`, `defeated_boss_ids`, and `door_lock_reasons`.

`HazardMarker.gd` exposes `hazard_id`, `hazard_type`, `damage`, `trigger_radius`, and `knockback`. `LevelDefinition.gd` stores hazard markers in `hazards`, and `GameSession.gd` checks them through `check_hazard_contacts()`, emits `hazard.entered`, then calls `damage_player()` with `source_type: hazard`. Trace summary output includes `hazards_entered`.

`AbilityGateMarker.gd` exposes `gate_id`, `required_ability_type`, `gate_effect`, `trigger_radius`, and `grants_item_id`. `LevelDefinition.gd` stores gates in `ability_gates`, and `GameSession.gd` checks them from `use_ability()` through `check_ability_gate_interactions()`, emits `ability_gate.opened`, persists `opened_ability_gate_ids`, and optionally grants an item. Trace summary output includes `ability_gates_opened`.

`scripts/generate-godot-procedural-levels.mjs` now exports `runtime_layout.content.objective`, `hazards`, and `ability_gates`. `LevelLoader.gd` restores those generated `HazardMarker` and `AbilityGateMarker` nodes through `add_generated_hazard_marker()` and `add_generated_ability_gate_marker()`.

Generated procedural levels now also export richer `runtime_layout.content.enemies`: difficulty 2 rooms have a ground enemy with attack timing, difficulty 3 rooms add a flying role, and difficulty 4 rooms add an elite flying role. Generated route enemies use longer attack cooldowns and stronger route heals so long traversal fixtures prove active threats without collapsing before progression evidence is collected. `LevelLoader.gd` restores `attack_damage`, `attack_radius`, `attack_cooldown_ms`, and `patrol_radius` onto generated enemy spawn markers.

`godot/tests/replay_suite.json` now supports focused evidence checks through `expected_events` and `expected_last_hud`, enforced by `scripts/run-godot-replay-suite.mjs` after trace summary generation. `ReplayInputSource.gd` and `tests/run_replay.gd` accept `initial_ability_type` and `setting_difficulty` so focused fixtures can directly validate ability gates, locked doors, and difficulty-specific combat state. `GameSession.gd` also caps active spawned enemies at `max_active_enemy_count` and emits `enemy.spawn.skipped` when a room has more enemy markers than the current cap. When at least two active enemies crowd Kirdy within `enemy_crowd_player_radius`, `apply_enemy_crowd_spacing()` pushes enemies back to `enemy_crowd_min_player_distance` and records `enemy.crowd.spacing_applied` once per level.

`spark_ability_dash_movement` validates the first enemy-ability movement effect. The `spark` profile carries `movement_effect: dash` and `movement_impulse: 64.0`; `GameSession.apply_ability_movement()` applies the facing-direction dash and emits `ability.movement.applied` before the normal `ability.used` trace.

`PlayerController.gd` also owns ability texture fallback. `get_ability_texture()` maps `fire` / `burn`, `ice` / `frost`, `sword` / `blade`, and `spark` to explicit Kirdy ability textures. Spark now uses `images/characters/kirdy/kirdy-spark.webp` instead of the spit texture. When a requested ability texture is unavailable, `get_ability_fallback_texture()` keeps the player visible through idle/run/current texture fallback and emits `player.ability_texture.fallback` once for the selected fallback.

The inhale pull effect also has a runtime fallback. `PlayerController.show_inhale_effect_fallback()` creates a local `Line2D` named `InhaleEffectFallback` between Kirdy and the captured enemy, and `GameSession.capture_nearest_enemy()` emits `inhale.effect.fallback`. The fallback line is hidden when the enemy is released, swallowed, or cleared after defeat.

`frost_enemy_ai_profile` validates ability-specific enemy AI profile application. `GameSession.get_enemy_ability_ai_profile()` gives `frost`, `fire`, and `stone` enemies distinct movement, detection, attack cadence, or hover tuning, and `apply_enemy_ability_ai_profile()` records `enemy.ai.profile.applied` when a profile changes spawned enemy behavior.

`hidden_discovery_path` validates hidden exploration. `CollectibleMarker` and `DoorMarker` can set `hidden_until_discovered` plus `discovery_radius`; `GameSession.check_hidden_discoveries()` emits `hidden.discovered`, reveals marker visuals, and only then allows hidden collectible pickup or hidden door transition.

`central_hub_dead_end_max_health` now also validates dead-end exploration completion. `HealMarker.dead_end_id` marks a heal reward as a dead-end completion target, `GameSession.complete_dead_end()` records `dead_end.completed`, and `MapOverlay.gd` renders completed dead-end map features with a dedicated square marker color.

`sky_generated_goal_path` now validates the canonical goal-door completion controller through the migrated sky hub, while `mirror_to_goal_sanctum_locked_without_keystone` proves the old direct mirror shortcut is locked until the cave Keystone is collected. `goal_sanctum.tscn` uses `GoalDoorController.gd`, which preserves `GoalMarker` semantics while emitting `goal.door.entered`; that trace and `run.finished` both carry time, frame, score, and remaining-life bonus metrics.

The focused replay suite now includes `flying_spit_projectile_hit`, `forest_reliquary_locked_without_key`, and `forest_reliquary_key_unlocks_door`. `flying_combat_room.tscn` has a second target enemy for spit projectile validation, and `forest_reliquary.tscn` has a `door_check` spawn so the item lock can be tested before collecting `forest-keystone`.
