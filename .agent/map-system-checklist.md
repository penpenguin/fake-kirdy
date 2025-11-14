# Map System Safety & Goal Expansion

## Purpose / Big Picture

Players must experience a true labyrinth: dozens of interconnected rooms where spawn points feel fair, dead ends reward exploration with healing, and a distinctive goal door ends the run by surfacing score and time. This plan guides the creation of more than 100 playable areas, enforces safety rules around doors, guarantees health pickups in cul-de-sacs, and introduces a goal interaction that feeds a results overlay so users clearly see their accomplishments the moment they touch the exit.

## Progress

- [x] Door safety-ring specification enforced in stage definitions and spawn logic
- [x] Dead-end metadata populated and used for deterministic heal placement
- [x] Area catalog expanded to at least 128 unique definitions with validation tests
- [x] Goal door assets, controller, and HUD results pipeline implemented and tested
- [x] Regression suite (unit + integration) updated to cover new behaviors end to end

## Surprises & Discoveries

Document unforeseen blockers, data constraints, or engine limitations here as the implementation progresses. Include date stamps and describe how the surprise alters later milestones.

- 2025-11-14: Retired the temporary `SceneItemSpawner` shim once MapSystem began tracking heal pickups itself. This avoided shutdown-handler ordering issues and simplified tests by keeping all heal state in one place.

## Decision Log

- 2025-11-14: Chose to model the goal door as a dedicated `GoalDoorController` plus HUD overlay event so score/time display stays decoupled from MapSystem.

## Outcomes & Retrospective

Leave reflections about what went well or poorly, along with any follow-up tasks that future contributors should consider once the feature ships.

- Procedural stage generation ensures we can scale beyond 128 areas without hand-authoring files, but we still need interactive heal pickups wired into gameplay. Future work: hook spawned heal markers into actual item logic so players can collect them.

## Context and Orientation

Area definitions live under `src/game/world/stages/*.ts` and are imported via `AreaManager`. Player spawning is coordinated in `src/game/scenes/GameScene.ts` (hooking into `PlayerSpawner`). Heal pickups are orchestrated by `MapSystem.scatterDeadEndHeals`, while HUD overlays plus timers can be found in `src/game/ui` and `src/game/performance`. The docs you just edited (`docs/design.md`) describe intent but no longer house implementation steps; this ExecPlan is now the sole authoritative checklist.

## Plan of Work

Work proceeds in four phases: (1) enrich area data to encode door buffers, dead ends, and goal metadata; (2) enforce door-adjacent spawn exclusion while guaranteeing heal placement using the new metadata; (3) scale the area catalog past 128 entries and add automated validation; (4) add the goal door asset, controller, event flow, and HUD integration, then wire everything through a results overlay. Each phase starts with a failing Vitest spec (Red), introduces the minimal code to satisfy it (Green), and finally performs safe refactors before moving on.

## Concrete Steps

1. Extend `AreaDefinition` types (likely `src/game/world/types.ts`) with `doorBuffer`, `doors[]`, `deadEnds[]`, and `goal` metadata. Red test: update `AreaManager.stage-import.test.ts` to expect these fields for seeded fixtures. Green: adjust parsers and defaults; Refactor: deduplicate validation helpers.
2. Implement `MapSystem.enforceDoorSpawnConstraints` (unit tested in `src/game/world/AreaManager.test.ts`) so any spawn candidate within Chebyshev distance ≤ `doorBuffer` is rejected. Update `PlayerSpawner` integration tests to confirm respawn never happens beside a door tile.
3. Introduce `MapSystem.scatterDeadEndHeals` that walks `deadEnds[]`, registers heal metadata, and exposes consumption helpers so GameScene can spawn/consume pickups. Tests should triangulate cases with multiple rewards and confirm consumption removes items.
4. Create at least 128 concrete stage modules by cloning existing templates, varying layouts, and setting proper `cluster`, `metadata.index`, and `deadEnds`. Add `test/MapGraph.validator.test.ts` to assert the count, the proportion of dead ends (≥20%), and valid door links.
5. Add a `GoalDoorController` under `src/game/mechanics/GoalDoorController.ts` that listens for player overlap events, pulls `GameState.player.score` and `RunTimer.getElapsedMs()`, sets `world.goal.reached`, and emits `goal:reached` with payload `{ score, timeMs }`. Write a Vitest suite using jsdom to verify the event flow.
6. Implement a HUD overlay (likely in `src/game/ui/ResultsOverlay.ts`) that subscribes to `goal:reached`, renders score/time, and transitions to `ResultsScene` after button press or timeout. Integration test through scene harness or a mocked Phaser scene to ensure the overlay activates exactly once.
7. Wire the new goal door asset: register `goal-door` texture in `src/game/assets/loader.ts`, update relevant stage definitions, and ensure the MapSystem switches to the dedicated sprite when `goal` metadata is present. Smoke test via `npm run dev` manually if possible, but prioritize automated coverage.

## Validation and Acceptance

Automated acceptance hinges on `npm run test` passing with the new suites, plus the validator guaranteeing ≥128 areas and required metadata. Manual acceptance: start `npm run dev`, navigate to a goal door, and confirm the overlay shows score and total run time upon contact. Record the observed values and compare to console logs for sanity.

## Idempotence and Recovery

Most steps modify TypeScript source and stage data; rerunning them is safe because the validation suite enforces canonical shapes. When generating stage files, script the process or keep templates so re-running does not create duplicates. If a migration fails, restore from git and regenerate using the documented commands in this plan.

## Artifacts and Notes

Keep snippets of representative stage definitions and validator outputs within future updates to this plan so successors can see concrete examples without searching the tree. Capture any CLI logs (e.g., failing test output) that informed design decisions.

## Interfaces and Dependencies

Expose new MapSystem APIs with explicit TypeScript signatures, e.g., `enforceDoorSpawnConstraints(areaId: string): SpawnTile[]` and `checkGoalContact(player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): void`. ItemSpawner must accept `{ reward: 'health' | 'max-health' | 'revive' }`. Goal overlay depends on `RunTimer` (ensure it offers `getElapsedMs(): number`). Document these signatures in code comments as they are implemented.
