# Godot v2 Vertical Slice Migration Plan

## Summary

The Godot v2 effort is an exploration, not a replacement. The current Phaser + Matter version remains the reference implementation while we validate whether Godot gives us better control over movement feel, jump behavior, level iteration, and automated replay/trace analysis.

The first goal is a small playable vertical slice that proves three things:

1. A `CharacterBody2D` platformer controller can produce better-feeling movement and jump tuning.
2. Godot editor-authored level layout can make iteration faster than the current code-driven Phaser workflow.
3. Headless replay and trace output can give agents enough evidence to propose focused gameplay improvements.

## Why This Is a Vertical Slice

This is a vertical slice because the risk is not whether every existing feature can be ported. The immediate risk is whether Godot solves the specific problems blocking iteration: movement feel, jump reliability, level editing, and replay-based diagnosis.

The slice should include the minimum end-to-end path needed to judge those risks: spawn, move, jump, hover, traverse a small editor-built level, enter a door or finish marker, and emit deterministic trace output. It should not attempt to recreate the complete game.

A full rewrite would spend effort on broad parity before proving that the new engine improves the hardest parts. The vertical slice keeps the decision reversible and lets us compare results against the existing implementation before committing to a migration.

## Phaser Remains the Reference

The Phaser + Matter game is still the source of truth for current gameplay expectations, requirements, and regression coverage. It remains the reference implementation for these reasons:

- It is the working version users can run today.
- Its requirements and tests define the current behavior envelope.
- It provides comparison material for movement, hover, enemy interaction, doors, UI expectations, and failure handling.
- Keeping it intact prevents the Godot experiment from becoming an accidental rewrite.

Godot v2 work must not delete, rewrite, or bypass the Phaser implementation. Existing TypeScript tests must continue to pass while the prototype evolves.

## Target Success Criteria

The Godot v2 vertical slice is successful when it demonstrates:

- A playable `CharacterBody2D` controller with horizontal acceleration/deceleration, coyote time, jump buffering, variable jump height, separate rising/falling gravity, and hover behavior.
- Controller tuning exposed through Godot resources or exported fields so movement can be adjusted without rewriting the controller.
- A small editor-authored level that uses placeable metadata nodes such as spawn, door, enemy, heal, goal, and camera-bound markers instead of hard-coded placement in the main scene script.
- A headless replay mode that can consume JSON input and produce JSON or NDJSON trace output.
- Trace events that are specific enough for agent-driven analysis: spawn, jump start, jump cut, landing, hover start/end, door entry, run finish, and replay errors.
- Existing repo checks still pass with `npm test`.

## Non-goals

- Do not migrate the full game.
- Do not remove or rewrite the Phaser + Matter implementation.
- Do not port all enemies, maps, saves, menus, audio, UI, or asset pipelines.
- Do not make Godot mandatory for existing `npm test` or baseline CI until a dedicated optional Godot check exists.
- Do not add large binary assets unless the PR explains why they are required for the slice.
- Do not chase final art, full content parity, performance polish, or release packaging during this validation phase.

## PR Milestones

1. **Docs and guardrails**
   - Add repository guidance and this migration plan.
   - Define the prototype directory, non-goals, success criteria, and replay/trace expectations.
   - Verify `npm test` still passes.

2. **Godot project skeleton**
   - Add the canonical `godot/project.godot` and minimal scenes/scripts/resources directories.
   - Add optional Godot validation scripts that skip cleanly when Godot is unavailable.
   - Avoid any dependency that makes the existing web build or tests depend on Godot.

3. **CharacterBody2D controller slice**
   - Implement the player controller with exported tuning values.
   - Cover movement, jump, jump cut, coyote time, buffering, hover, and landing events.
   - Add deterministic replay input plumbing for controller actions.

4. **Editor-authored level slice**
   - Build a small level using editor-placeable metadata nodes.
   - Include a spawn point, traversal space, at least one door or finish marker, and camera bounds.
   - Keep placement data out of the main scene script.

5. **Headless replay and trace slice**
   - Add a replay runner that consumes JSON input.
   - Emit JSON or NDJSON traces with frame/time/event/player position/player velocity/level id.
   - Include replay error reporting for malformed input or impossible state.

6. **Evaluation report and decision PR**
   - Compare trace results and iteration workflow against the Phaser reference.
   - Document whether Godot v2 should continue, pause, or expand toward a larger migration.
   - List any Phaser behaviors that need clearer specs before a future port.

## Replay and Trace for Agent-Driven Improvement

Replay and trace output are the main mechanism for agent-driven improvement. Agents should be able to run the same replay repeatedly, inspect structured events, and compare traces after a controller or level-tuning change.

Replay input must be JSON so agents can generate, minimize, and mutate scenarios. A replay should describe player inputs over frames or time, plus enough metadata to select the level and starting state.

Trace output must be JSON or NDJSON. Each event should include:

- `frame`
- `time_ms`
- `event_type`
- optional `payload`
- player position
- player velocity
- current level id

Agents should use trace data to answer concrete questions:

- Did jump buffering trigger when expected?
- Did coyote time allow the intended late jump?
- Did jump cut reduce upward velocity at the right moment?
- Did hover start and end at the expected frames?
- Did landing occur at the expected position and speed?
- Did a door or finish marker complete the run?
- Did the same replay produce the same trace after repeated runs?

Trace-based improvements should stay focused. A PR should change one controller behavior, one level issue, or one replay/trace gap at a time, then include before/after trace evidence when practical.
