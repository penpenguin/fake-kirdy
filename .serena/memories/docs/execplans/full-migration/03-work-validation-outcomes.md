# Full Migration ExecPlan Snapshot 03: Work, Validation, Interfaces, Outcomes

Imported from `docs/godot-v2/full-migration-execplan.md`.

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

Migrate a representative playable subset of the Phaser area graph: central hub, several branch rooms, door graph examples, heal, collectible, goal, and combat rooms. Convert durable design details into Godot-focused docs. Do not bulk-port all 128+ areas manually before the canonical schema/importer exists.

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
- `npm run check:godot`
- `npm run trace:summary`
- `npm run legacy:inventory`
- `npm test`
- `npm run test:canonical`

## Idempotence And Recovery

All promotion work should be repeatable without deleting the Phaser runtime. If a Godot replay fails, inspect trace output first, update this ExecPlan's discoveries and decisions, then fix the smallest failing behavior under TDD. If generated `.godot/` editor cache files appear, do not treat them as source; they should remain untracked.

## Outcomes & Retrospective

Complete for the requested mainline migration boundary, with one additional 2026-05-29 tightening pass: the repo has a canonical `godot/` project, Godot-aware package commands, a self-contained migration ExecPlan, Godot canonical README/AGENTS guidance, trace metrics tooling, and a canonical Godot Web export wrapper that skips missing local export templates gracefully for local builds while providing strict `build:public` output for GitHub Pages. Root Phaser/Vite commands and direct runtime dependencies have been removed, and optional legacy/reference copies are no longer required by current Godot generators, docs, tests, or parity evidence. Milestone 3 has controller movement replay in the canonical suite plus frame-level `player_motion` metrics for tuning review. Milestone 4 has `LevelDefinition` collecting both marker nodes and `LevelTileMap` TileMap metadata, with `central_hub` carrying editor-visible tile size/grid metadata while retaining transitional StaticBody collision. Milestone 6 has a small mainline-oriented combat loop with simple ground and flying enemies, marker-selected enemy type, capture, release, recapture, swallow, ability acquisition/use, damage/game-over coverage, revive reward coverage, and replay trace evidence. Milestone 7 has a canonical replay suite command that runs representative headless Godot replays and emits aggregate JSON metrics, including `last_player_revive_count`, `last_settings`, `last_inventory`, `last_hud`, and `last_result_overlay`. Milestone 8 has full canonical stage topology coverage through hand-authored Godot scenes or generated schema: 146 stage ids, 132 generated schema levels, and 263 generated neighbor edges are validated from `godot/levels/stage_manifest.json`. The Godot mainline has small visible overlays for map exploration, settings, HUD state, inventory/progress state, and run results without porting final presentation polish. The parity ledger reports ported entries plus one deferred non-blocking `audio-and-polish` backlog entry, with 0 retirement blockers.