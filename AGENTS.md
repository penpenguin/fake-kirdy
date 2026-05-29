# Repository Guidelines

## Project Intent
- Godot canonical is now the mainline direction for Fake Kirdy. The repository is migrating from the current Phaser + Matter.js game to a Godot 4 project.
- Phaser legacy/reference source remains useful for gameplay behavior, map topology, controls, tests, and regression checks, but root runtime commands and dependencies are now Godot canonical.
- The Godot mainline validates a `CharacterBody2D` platformer controller, editor-driven level design, headless replay/trace output, and trace-derived metrics.
- Do not add new Phaser runtime behavior. Use the retained legacy/reference source only for audits and migration context.

## Serena Tooling Expectations
- Default to Serena's MCP integrations whenever you need context; it centralizes specs, saved memories, and helper scripts so agents stay in sync.
- Kick off each session by opening the Serena Instructions Manual (call `mcp__serena__initial_instructions`) and listing resources via `list_mcp_resources` to learn what's already documented before poking around the repo.
- Use `read_mcp_resource` (or the parameterized templates) instead of ad-hoc browsing when you need docs from `docs/` or historical decisions, and record new findings with `write_memory` so future agents inherit them.
- Favor Serena's memory + resource workflow during hand-offs (e.g., summarize outstanding bugs, feature flags, or test gaps) to minimize institutional knowledge loss.

## ExecPlans
When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.

## Project Structure & Module Organization
- `godot/` contains the canonical Godot 4 project.
- Optional legacy/reference copies may exist for audits only; they are not part of the root runtime, canonical import data, or canonical test gate.
- Canonical repository tests live under `test/godot*.test.ts` plus `test/trace-summary.test.ts`.
- Static web assets from the former runtime are optional reference material only; canonical assets live under `godot/resources/`.
- Scope, rules, and open tasks are tracked in `docs/`; revise those specs before adjusting gameplay.
- Godot migration documentation belongs in `docs/godot-v2/`; historical prototype files may remain under `prototypes/godot-v2/`, but new mainline Godot work belongs under `godot/`.

## Build, Test, and Development Commands
- `npm run dev` starts the canonical Godot project at `godot/`.
- `npm run godot:run` starts the canonical Godot project at `godot/`.
- `npm run godot:replay` runs the canonical Godot headless replay wrapper and skips gracefully if Godot is unavailable.
- `npm run godot:export` exports the canonical Godot project when export templates are installed and skips gracefully when they are missing.
- `npm run trace:summary -- <trace.json|trace.ndjson>` emits metrics JSON from a replay trace.
- `npm run godot:parity-ledger -- --check` validates the Phaser-to-Godot parity ledger and referenced evidence paths.
- `npm run check:godot` validates that the canonical Godot project exists and skips executable validation gracefully when Godot is unavailable.
- `npm run build` runs the canonical Godot export wrapper and skips gracefully when Godot or export templates are unavailable.
- `npm run test` executes the canonical Godot migration Vitest suite in jsdom and then `check:godot`; `npm run test:watch` keeps the red-green loop tight.
- `npm run test:canonical` runs `npm test` plus the canonical Godot replay suite; use it before claiming Godot gameplay parity.
- `npm run legacy:inventory` prints the retained legacy/reference source surface and retirement gates as JSON.
- `npm run godot:parity-ledger -- --fail-on-blockers` must pass before changing the retained legacy/reference boundary.
- `npm run typecheck` runs `tsc --noEmit` to catch signature drift early.
- For Godot files, keep optional scripts graceful when `godot` is not installed. `npm test` may include non-destructive Godot checks only if they skip gracefully without Godot.

## Coding Style & Naming Conventions
- Use TypeScript with ES modules, 2-space indentation, and `const` defaults; supply explicit return types for exported APIs.
- Favor `camelCase` for values, `PascalCase` for types and classes, and kebab-case filenames (`create-game-scene.ts`) unless mirroring third-party names.
- Keep retained Phaser reference factories side-effect free if auditing them; do not add new DOM/runtime behavior outside the Godot mainline.
- No repo formatter is enforced, so follow surrounding style and keep imports ordered logically.

## Testing Guidelines
- Strict TDD policy: all code changes follow red-green-refactor in the smallest practical steps.
- Prefer fast unit tests with Vitest + jsdom; isolate Phaser or Matter using `vi.mock`.
- Name files `<subject>.test.ts` near the code or place infra checks under `test/`.
- Apply Takuto Wada's TDD cycle: write the smallest failing spec, make it pass, then refactor safely.
- Extend `vitest.setup.ts` for shared matchers instead of repeating hooks.
- Guard critical Godot gameplay with replay or trace tests before fixing bugs; retained Phaser source, when present, is audit material, not mainline runtime.
- Run `npm run test` after changes that affect existing TypeScript code, repo configuration, or shared documentation that changes development rules.

## Godot Canonical Migration Rules
- Treat Godot as the canonical runtime, but migrate through thin playable milestones instead of a destructive rewrite.
- Phaser legacy/reference source remains available for audits, but Godot build / run / replay / trace / metrics and representative gameplay content are canonical.
- Do not reintroduce Phaser runtime dependencies or commands into the root package.
- Do not port every enemy, map, save flow, menu, audio path, or UI surface in one step. Port the smallest mainline-equivalent behavior first.
- Do not introduce large binary assets without a clear review note.

### Godot Directory Plan
- `godot/project.godot`
- `godot/scenes/`
- `godot/scripts/`
- `godot/resources/`
- `godot/levels/`
- `godot/tests/`
- `prototypes/godot-v2/` is historical reference only during migration.
- `docs/godot-v2/`

### Player Controller Rules
- Use Godot `CharacterBody2D` for the player. Do not use `RigidBody2D` for the player controller.
- Expose controller tuning through a resource or exported fields: `max_speed`, `ground_accel`, `ground_decel`, `air_accel`, `air_decel`, `jump_velocity`, `gravity_up`, `gravity_down`, `jump_cut_multiplier`, `coyote_time_ms`, `jump_buffer_ms`, `hover_gravity_scale`, and `hover_max_fall_speed`.
- Implement horizontal acceleration/deceleration, coyote time, jump buffering, variable jump height, separate rising/falling gravity, hover mode, landing trace events, and a deterministic replay input adapter.

### Level Design Rules
- Prefer editor-placeable nodes for gameplay metadata: `PlayerSpawn`, `DoorMarker`, `EnemySpawn`, `HealMarker`, `CollectibleMarker`, `GoalMarker`, and `CameraBoundsMarker`.
- Do not hard-code gameplay placement in the main scene script.

### Replay and Trace Rules
- Replay input must be representable as JSON.
- Trace output must be JSON or NDJSON and include `frame`, `time_ms`, `event_type`, optional `payload`, player position, player velocity, and current level id.
- Minimum events are `player.spawned`, `player.jump.started`, `player.jump.cut`, `player.landed`, `player.hover.started`, `player.hover.ended`, `door.entered`, `run.finished`, and `replay.error`.
- Keep gameplay logic observable so agents can compare replay traces and propose focused movement, level, or failure-state improvements.

## Commit & Pull Request Guidelines
- Mirror the history: short, imperative commit subjects without trailing periods (e.g., "Add terrain tile visuals").
- Bundle changes by TDD stage when possible: tests first, implementation next, refactors last.
- Reference the relevant spec task in each PR, summarise gameplay impact, and note test commands run; include media for visual updates.
- Validate `npm run test` and `npm run build` locally before requesting review, and flag deferred work as follow-up tasks.
- For Godot v2 reviews, focus on accidental full migration, use of `RigidBody2D` for the player, Godot logic hidden inside the scene tree without traceability, missing replay/trace hooks, breaking existing `npm run test`, unnecessary binary assets, and unexplained production dependencies.
