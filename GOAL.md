# Goal

## Objective
Godot mainline of Fake Kirdy has a reviewable stage-production and gameplay-pacing vertical slice: stages can be authored or generated through a clear mechanism, the main route no longer ends after roughly two screen transitions, visible doors have clear purpose, and the in-run HUD is a thin full-width top bar with icon-backed readable state.

## Context
This repository is the canonical Godot 4 version of Fake Kirdy. The current player-facing problems are:

- There is no sufficiently clear, repeatable mechanism for creating and validating new stages.
- The HUD should prioritize readability as a thin full-width strip at the top of the screen and use icons or icon-like visual cues for key state.
- Too many unexplained or mysterious doors appear in stages, making the route and interaction purpose unclear.
- The present gameplay experience is too short and thin: it is possible to reach a goal after about two screen transitions, which is far below the expected pacing of a normal action-game stage route.

Project constraints from `AGENTS.md` apply: conversation is Japanese by default, all code changes must follow t-wada TDD, Godot is canonical, Phaser runtime behavior and dependencies must not be reintroduced, and gameplay behavior should remain observable through replay/trace where practical.

Task classification: feature implementation + content design + UI/behavior/accessibility check + test/contract addition.

[Assumption] "ステージを作成するための仕組み" means a repository-owned authoring/generation/validation workflow for adding Godot stages, not a full in-game level editor.

[Assumption] "一般的なアクションゲームと比べて大きくクオリティが低い" is bounded to one representative mainline vertical slice in this goal: route length, pacing, stage variety, goal gating, door clarity, and HUD readability. It does not require a full game redesign or complete content migration.

## Scope
- May inspect and change files under `godot/`, `test/`, `scripts/`, `docs/godot-v2/`, and root test/build configuration only when directly required for this goal.
- May add or update Godot level scenes, level definition resources/data, stage manifests/catalogs, procedural stage generation scripts, validation contracts, replay fixtures, trace assertions, visual snapshot baselines/contracts, and focused Vitest tests.
- May add small reusable HUD icon assets or icon-like Godot UI nodes under `godot/resources/` or `godot/scenes/ui/` if covered by content-budget and asset-fallback checks.
- May update documentation under `docs/godot-v2/` to describe the stage creation workflow, door taxonomy, route pacing expectations, and HUD contract.
- May use subagents only for bounded read-only review such as stage audit, UX critique, or test-gap review. The main agent remains responsible for edits and verification.

## Non-goals
- Do not reintroduce Phaser runtime code, Phaser dependencies, or legacy runtime commands.
- Do not build an in-game level editor, campaign editor UI, networked content pipeline, external CMS, or modding system.
- Do not attempt a full game redesign, full world-map overhaul, full enemy roster migration, complete art pass, save-system rewrite, audio overhaul, monetization, publishing, or deployment work.
- Do not replace the player controller with `RigidBody2D`; the player must remain `CharacterBody2D`.
- Do not hide poor pacing by only increasing timers, disabling goals, or making a single empty corridor longer.
- Do not remove all doors blindly. Doors may remain when they have a documented traversal, gate, shortcut, hidden, or goal purpose that is visible or traceable.
- Do not add large binary assets, unclear-license assets, new production dependencies, or external services without explicit approval.
- Do not commit, push, open a PR, or run destructive cleanup unless explicitly requested later.

## Constraints and anti-gaming rules
- Follow strict Red -> Green -> Refactor. For each checkpoint, first add the smallest failing test, static contract, replay, or visual snapshot assertion that captures the desired behavior, then make it pass with minimal production changes, then refactor only after green.
- Prefer fast Vitest/static checks and Godot replay fixtures. Use runtime Godot checks when Godot is available, and preserve graceful skipping where existing scripts define it.
- Stage placement must remain editor-authored, marker/resource driven, or generated through repository-owned data. Do not hard-code gameplay placement in the main scene script.
- New stage creation workflow must be documented and validated by a command; it must not rely on private manual knowledge.
- Route-length proof must include gameplay-relevant content such as traversal, gates, hazards, enemies, collectibles, or branch decisions. A longer empty hallway does not satisfy the goal.
- Door clarity proof must distinguish door roles such as `progress`, `return`, `locked_gate`, `shortcut`, `secret`, or `goal`; visible unexplained doors must fail a test or lint rule.
- HUD proof must be visual and structural: a thin top bar, full-width layout, icons/icon-like cues, HP/max HP, ability, collectible/progress, score or objective, and run/door status must be visible without cropped or overlapping text.
- Do not delete, skip, weaken, or rewrite tests merely to make checks pass.
- Do not hide integration failures behind mocks when a Godot scene, replay, trace, or visual snapshot can prove the behavior.
- Do not disable build paths, type checks, visual snapshot checks, content-budget checks, scene lint, replay checks, or export checks to claim completion.
- Do not declare completion without exact validation output or clearly labeled manual evidence.

## Risk tier and review depth
Medium-high risk. This touches content production, level topology, UI presentation, progression pacing, and validation infrastructure. Require focused verification after each checkpoint, one adversarial self-review pass against the non-goals and anti-gaming rules, and a short manual/visual review of at least one representative route before completion.

## Required first reads
Before editing, read or inspect:

- `AGENTS.md`
- `package.json`
- `GOAL.md`
- `docs/godot-v2/README.md`
- `docs/godot-v2/level-lab.md`
- `docs/godot-v2/procedural-level-generation.md`
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/door-transition-flow.md`
- `docs/godot-v2/replay-and-trace.md`
- `docs/godot-v2/gameplay-completion-execplan.md`
- Relevant current Godot files discovered from the issue, likely including:
  - `godot/levels/stage_manifest.json`
  - `godot/levels/level_catalog.json`
  - `godot/levels/level_catalog.source.json`
  - representative levels under `godot/levels/`
  - `godot/scripts/level/LevelDefinition.gd`
  - `godot/scripts/level/LevelLoader.gd`
  - `godot/scripts/level/markers/DoorMarker.gd`
  - `godot/scripts/level/markers/GoalMarker.gd`
  - `godot/scripts/session/GameSession.gd`
  - `godot/scripts/ui/HudOverlay.gd`
  - `godot/scenes/ui/HudOverlay.tscn`
- Relevant tests/contracts discovered with `rg`, especially stage manifest, procedural levels, level catalog, level graph, progression solver, scene lint, replay suite, HUD overlay, visual snapshot, usability/accessibility, quality report, and playtest report tests.

Also run or inspect these discovery commands before editing:

```bash
rg --files godot test scripts docs/godot-v2
npm run godot:replay-suite -- --list
npm run godot:level-graph
npm run godot:progression-solver
```

## Work loop
1. Create or update a short plan with checkpoints for stage creation workflow, route pacing, door clarity, top-bar HUD, and integration review.
2. For each checkpoint, write the narrowest failing test, lint rule, replay assertion, or visual snapshot contract first.
3. Run the fastest relevant command and confirm the new check fails for the intended reason.
4. Implement the smallest Godot/data/script/UI change that makes the check pass.
5. Run the focused check again. Refactor only after green and only where it improves maintainability of the new workflow or contract.
6. Record failed attempts, skipped checks, command output summaries, and environment blockers in `ATTEMPTS.md` if the work spans more than one session or if any runtime check is blocked.
7. After all checkpoints are green, run the final gate and perform an adversarial self-review against Scope, Non-goals, Constraints, and anti-gaming rules.

## Implementation checkpoints
1. Stage creation workflow: add or improve a documented, repeatable way to create stages, such as stage recipe data, a generator/scaffold script, manifest/catalog validation, or editor-marker contract. The workflow must be covered by automated tests and documentation.
2. Main route pacing: define a representative mainline route that requires a meaningful sequence of at least five level/room transitions before a final goal, with traversal or gameplay beats between them. Update stage graph/catalog/replay evidence so the goal cannot be reached after only about two screens.
3. Door clarity: audit visible doors in representative stages, classify each meaningful door by role, remove or hide unneeded mystery doors, and expose purpose through labels, lock reasons, HUD status, trace payload, or documented marker fields.
4. HUD top bar: redesign the in-run HUD as a thin full-width top overlay using icons or icon-like visual cues for HP, ability, items/progress, score/objective, and run/door status. Preserve trace-owned HUD payloads.
5. Gameplay-quality vertical slice: add one representative replay/playtest path through the improved route that demonstrates pacing, doors, HUD updates, and goal completion without relying on empty filler.
6. Integration review: update docs, contracts, baselines, generated artifacts, and reports as needed; confirm no forbidden scope was touched.

## Done when
- Stage creation workflow is documented in `docs/godot-v2/` and covered by an automated command such as `npm run godot:stage-manifest -- --check`, `npm run godot:procedural-levels -- --check`, `npm run godot:catalog -- --check`, or a new focused test. The completion receipt must name the exact files and command proving a new or changed stage can be added through the workflow.
- The representative mainline route has automated graph/progression/replay evidence showing at least five meaningful level/room transitions before goal completion. Evidence must include one of `npm run godot:level-graph`, `npm run godot:progression-solver`, `npm run godot:replay-suite -- --out-dir ...`, or a focused Vitest test that names the route and expected transition count.
- At least one replay or static contract proves the route includes meaningful gameplay beats, such as a movement challenge, hazard, enemy, collectible, ability gate, locked gate, branch, or return path. A long empty corridor alone must fail the acceptance criteria.
- Visible doors in representative stages have a defined role and purpose. A scene lint, door transition test, stage contract, or replay assertion must fail if an unclassified visible door appears without target, lock reason, label, hidden/secret state, or goal purpose.
- The count or placement of confusing mystery doors is reduced in the representative route. The completion receipt must show before/after evidence from a script, test fixture, contract, or summarized scene audit.
- The HUD is implemented as a top full-width thin bar in `godot/scenes/ui/HudOverlay.tscn` and `godot/scripts/ui/HudOverlay.gd`, with icon/icon-like cues for key state. A visual snapshot or UI contract must prove the bar occupies the top of the viewport, avoids text overlap/cropping, and shows HP/max HP, ability, item/progress, score or objective, and run/door status.
- Existing HUD trace behavior remains observable: `hud.updated` payloads and `trace:summary` output still include the state required by the HUD, or any intentional payload change is documented and tested.
- The representative route can be completed by replay or documented manual run, and the evidence includes the trace path or screenshot/visual snapshot artifact for the route and HUD.
- All new behavior has TDD evidence: the completion receipt identifies the Red check added before each production/content change and the Green command result after the fix.
- Documentation or contracts under `docs/godot-v2/` and/or `godot/tests/*_contract.json` are updated when stage workflow, route pacing, door taxonomy, HUD layout, replay, trace, or visual snapshot expectations change.

## Verification
### Fast feedback loop
Use the narrowest command for the checkpoint being changed. Prefer these where applicable:

```bash
npm run check:test -- test/godot-v2-stage-manifest.test.ts
npm run check:test -- test/godot-v2-procedural-level-generator.test.ts
npm run check:test -- test/godot-v2-level-catalog.test.ts
npm run check:test -- test/godot-v2-level-graph.test.ts
npm run check:test -- test/godot-v2-progression-solver.test.ts
npm run check:test -- test/godot-v2-door-transition.test.ts
npm run check:test -- test/godot-v2-scene-lint.test.ts
npm run check:test -- test/godot-v2-hud-overlay.test.ts
npm run check:test -- test/godot-v2-visual-snapshot.test.ts
npm run check:test -- test/godot-v2-playtest-report.test.ts
npm run godot:replay-suite -- --list
npm run godot:level-graph
npm run godot:progression-solver
npm run godot:visual-snapshot
```

If `npm run check:test -- <file>` does not narrow Vitest in this repo, use the closest working Vitest command from `package.json` and report the exact command used.

### Final gate
Before declaring completion, run:

```bash
npm run test
npm run check:godot
npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-stage-quality-replays
npm run build
```

If Godot, export templates, browser, or runtime prerequisites are unavailable, existing scripts may skip gracefully. Report exact skip output and still run all non-optional tests that can run locally.

For visual/UI completion, also provide one of:

- updated visual snapshot artifacts/baselines from the repository visual snapshot check, or
- screenshots captured from the Godot/Web run showing the full-width top HUD and representative route, with file paths included in the completion receipt.

## Working memory
Maintain minimal operational state if the work spans more than one focused session:

- `PLAN.md`: current checkpoint, next action, and status.
- `ATTEMPTS.md`: failed tests/checks, commands run, outcomes, skip reasons, and hypotheses.
- `NOTES.md`: only if route design or stage authoring decisions become too detailed to keep in `GOAL.md`.

If the goal is completed in one continuous session, these files are optional. Do not create process files only for ceremony.

## Completion receipt
Before marking the goal complete, report:

- changed files grouped by checkpoint;
- for stage creation workflow, the documented workflow, exact command proving it, and an example stage/recipe/manifest change;
- for route pacing, the representative route id/path, transition count, gameplay beats, replay trace path, and graph/progression proof;
- for door clarity, before/after mystery-door evidence and the rule that now prevents unclassified visible doors;
- for HUD, the implementation files, icons/assets used or generated, visual snapshot/screenshot paths, and accessibility/readability checks;
- for every checkpoint, the Red test/check name and the Green verification command with exit code;
- exact final gate commands with exit codes and important output or skip reasons;
- whether `imagegen` was used, and if so, generated asset paths plus manifest/content-budget evidence;
- whether subagents were used, and for what bounded review task;
- adversarial self-review result covering Scope, Non-goals, TDD, Godot-only constraint, door/HUD anti-gaming rules, and route filler risk;
- unresolved risks, known skips, and remaining follow-up work.

## Stop rules
Stop and ask the user before continuing if any of these occur:

- The expected Godot stage, catalog, manifest, HUD, door marker, session, or replay files cannot be found after the required first reads.
- Fixing the issue appears to require reintroducing Phaser runtime code or dependencies.
- Fixing the issue appears to require replacing the player `CharacterBody2D` controller with `RigidBody2D`.
- A new production dependency, external service, paid asset, unclear-license asset, or large binary asset is required.
- A destructive migration, data deletion, or irreversible operation appears necessary.
- The desired stage creation workflow would require an in-game editor, external content service, or broad campaign rewrite rather than repository-owned Godot authoring/generation.
- Existing tests fail for unrelated reasons and fixing them would require changing product behavior outside this goal or weakening tests.
- Final verification cannot run because a documented prerequisite is unavailable and the relevant script does not skip gracefully.
- The HUD work expands into a full menu, inventory, map, pause, result, or accessibility redesign beyond the in-run top bar.
- The gameplay-quality work expands beyond a representative vertical slice into a full-game redesign.

## Open questions
- None blocking. The route-length target is intentionally set to "at least five meaningful transitions" as a bounded replacement for the vague "一般的なアクションゲーム並み"; adjust upward later if the vertical slice still feels too short after review.
