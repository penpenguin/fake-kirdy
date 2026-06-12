# Goal

## Objective
Godot mainline of Fake Kirdy has a reviewable gameplay-quality pass that fixes the current level dead-fall, door scale, collectible pickup, double-jump, and HUD presentation gaps with automated evidence and visual review artifacts.

## Context
This repository is the canonical Godot 4 version of Fake Kirdy. The user reported five current issues: screen-left/right floor gaps can drop the player into an unrecoverable state, the door texture remains too small, item pickup has no acquisition judgment, the player cannot double-jump, and the HUD is still too simple for a normal game presentation.

Project constraints from `AGENTS.md` apply: conversations are Japanese by default, all code changes must follow t-wada TDD, Godot is canonical, Phaser runtime behavior and dependencies must not be reintroduced, and gameplay behavior must remain observable through replay/trace where practical.

Task classification: bug fix + feature implementation + UI/behavior/accessibility check.

[Assumption] "一般的なゲームとして謙遜のないHUD" means the HUD should present core player state with deliberate layout, iconography/visual hierarchy, responsive spacing, and automated snapshot evidence; it does not mean building a full menu/UI redesign outside the in-run HUD.

## Scope
- May inspect and change files under `godot/`, `test/`, `scripts/`, `docs/godot-v2/`, and root test/build configuration only when directly required for this goal.
- May add or update Godot scenes, scripts, resources, replay fixtures, trace assertions, visual snapshot baselines/contracts, and Vitest tests that prove the five requested behaviors.
- May use subagents for bounded read-only analysis, test-gap review, or visual review. The main agent remains responsible for final edits and verification.
- May use `imagegen` for small, repo-appropriate raster assets for door or HUD presentation when it is more efficient than hand-authored UI art. Any generated asset must be checked in intentionally, referenced from Godot resources, and covered by manifest/content-budget checks.
- May update documentation in `docs/godot-v2/` when behavior contracts or review procedures change.

## Non-goals
- Do not reintroduce Phaser runtime code, Phaser dependencies, or legacy runtime commands.
- Do not perform a broad Godot rewrite, full content migration, enemy overhaul, save-system redesign, audio pass, or release/deployment work.
- Do not replace the player controller with `RigidBody2D`; the player must remain `CharacterBody2D`.
- Do not add large binary assets or unreviewed third-party assets.
- Do not change unrelated gameplay balance, level topology, combat, persistence, or public scripts unless a failing test proves the change is necessary for this goal.
- Do not commit, push, open a PR, or run destructive cleanup unless explicitly requested later.

## Constraints and anti-gaming rules
- Follow strict Red -> Green -> Refactor. For each bug or feature, first add the smallest failing test or replay/static check that captures the expected behavior, then make it pass with minimal production changes, then refactor only after green.
- Prefer fast Vitest/static checks and Godot replay fixtures. Use runtime Godot checks when Godot is available, and preserve graceful skipping where existing scripts define it.
- Do not delete, skip, weaken, or rewrite tests merely to make checks pass.
- Do not hide missing real gameplay behavior behind mocks when a Godot scene/replay/trace can prove it.
- Do not disable build paths, type checks, visual snapshot checks, content-budget checks, scene lint, or export checks to claim completion.
- Do not hard-code gameplay placement in the main scene script. Level placement must remain editor-authored or marker/resource driven.
- Do not fake HUD or door quality by embedding a static full-screen screenshot. Visual improvements must be implemented as reusable Godot UI/resource behavior.
- Keep trace output meaningful. New collectible, jump, HUD, door, or failure-state evidence should be observable through existing trace/summary flows when practical.
- Update asset manifests/contracts when adding image assets, and keep generated assets small enough to satisfy repository content-budget checks.

## Risk tier and review depth
Medium risk. This touches player movement, collision, collectible state, scene visuals, and HUD presentation. Require focused verification after each checkpoint and one adversarial self-review pass before completion. If generated assets are added, include an asset/license/source note in the completion receipt.

## Required first reads
Before editing, read or inspect:
- `AGENTS.md`
- `package.json`
- `docs/godot-v2/replay-and-trace.md`
- `docs/godot-v2/level-lab.md`
- `docs/godot-v2/hud-overlay.md`
- Relevant Godot scripts/scenes discovered from the issue, likely including:
  - `godot/scripts/session/GameSession.gd`
  - `godot/scripts/ui/HudOverlay.gd`
  - `godot/scenes/ui/HudOverlay.tscn`
  - `godot/scenes/player/Player.tscn`
  - player controller script attached to `Player.tscn`
  - relevant level scenes under `godot/levels/`
  - collectible, door, and marker scripts under `godot/scripts/level/markers/`
- Relevant tests/contracts discovered with `rg`, especially current controller, level lab, door transition, collectible progression, HUD overlay, visual snapshot, replay suite, and trace summary tests.

Also run or inspect these read-only discovery commands before editing:

```bash
rg --files godot test scripts docs/godot-v2
npm run godot:replay-suite -- --list
```

## Work loop
1. Create or update a small plan with checkpoints for floor safety, door scale, collectible pickup, double jump, and HUD polish.
2. For each checkpoint, write the narrowest failing test/replay/static assertion first.
3. Run the fastest relevant command and confirm the new test fails for the intended reason.
4. Implement the smallest Godot/TypeScript/resource change that makes that test pass.
5. Run the focused test again, then refactor only if the code or scene structure clearly benefits.
6. Record failed attempts, skipped checks, or environment gaps in `ATTEMPTS.md` if the work spans more than one session or if a check is blocked.
7. After all checkpoints are green, run the final gate and perform one adversarial self-review pass against Scope, Non-goals, and anti-gaming rules.

## Implementation checkpoints
1. Floor-edge recovery: prove and fix the left/right floor gaps or out-of-bounds failure so normal play cannot fall into an unrecoverable state from screen edges.
2. Door visual scale: prove and fix door texture/visual sizing so the door reads at gameplay scale and aligns with collision/interaction affordance.
3. Collectible pickup: add acquisition judgment for item/collectible markers, update session/inventory/HUD state, and emit trace evidence.
4. Double jump: add exactly one airborne extra jump before landing, preserve coyote/buffer/variable jump behavior, and prevent triple-jump without landing.
5. HUD upgrade: replace the minimal HUD presentation with a deliberate in-run HUD showing HP, ability, collectible/progress, score/outcome/status, with visual hierarchy and responsive layout.
6. Integration review: update docs/contracts/snapshots/manifests as needed and confirm no forbidden scope was touched.

## Done when
- Floor-edge safety is covered by a failing-then-passing test, replay, scene lint, or progression check that names the affected level(s) and proves the player no longer reaches an unrecoverable below-floor/out-of-bounds state from left or right edge movement.
- Door visual scale is covered by an automated scene/resource/visual snapshot check, and the evidence shows the door visual is sized and positioned consistently with its interaction/collision area in the relevant level(s).
- Collectible pickup is covered by a replay or focused test where the player overlaps a collectible, the item is acquired exactly once, `inventory.updated` and/or `hud.updated` reflects the item count, and `trace:summary` reports the acquired item/collectible id.
- Double jump is covered by controller/replay evidence showing two jump starts before landing are possible and a third jump before landing is rejected; landing resets the available double jump.
- HUD polish is covered by updated Godot UI implementation plus visual snapshot evidence at the repository's supported snapshot/check size(s). The HUD must display HP/max HP, current ability, collectible or progress count, score, and run status/outcome without incoherent overlap or cropped text.
- All new or changed behavior has TDD evidence: the completion receipt identifies the Red test/check added before each production change and the Green command result after the fix.
- Documentation or contracts under `docs/godot-v2/` and/or `godot/tests/*_contract.json` are updated if the observable HUD, replay, trace, visual snapshot, or asset expectations changed.
- The final verification gate completes with exact command output or clearly labeled skip reasons for optional Godot runtime/export prerequisites.

## Verification
### Fast feedback loop
Use the narrowest command for the checkpoint being changed. Prefer these where applicable:

```bash
npm run check:test -- test/godot-v2-controller.test.ts
npm run check:test -- test/godot-v2-door-transition.test.ts
npm run check:test -- test/godot-v2-collectible-progression.test.ts
npm run check:test -- test/godot-v2-hud-overlay.test.ts
npm run check:test -- test/godot-v2-visual-snapshot.test.ts
npm run godot:replay-suite -- --list
npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-goal-replays
npm run trace:summary -- <trace.ndjson>
```

If a listed command does not accept the shown file arguments, use the closest existing Vitest invocation from `package.json` and report the exact command used.

### Final gate
Before declaring completion, run:

```bash
npm run test
npm run check:godot
npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-goal-replays
npm run build
```

If Godot, export templates, or browser/runtime prerequisites are unavailable, the existing scripts may skip gracefully. Report the exact skip output and still run all non-optional tests that can run locally.

For visual/UI completion, also provide one of:
- updated visual snapshot artifacts/baselines from the repository's visual snapshot check, or
- screenshots captured from the Godot/Web run showing HUD and door scale, with the file paths included in the completion receipt.

## Working memory
Maintain minimal operational state only if the run spans multiple sessions:
- `PLAN.md`: current checkpoint, next action, and status.
- `ATTEMPTS.md`: failed tests/checks, commands run, outcomes, and hypotheses.

If the goal is completed in one continuous session, these files are optional. Do not create process files just for ceremony.

## Completion receipt
Before marking the goal complete, report:
- changed files grouped by checkpoint;
- for each of the five user-reported gaps, the Red test/check name, the production/resource changes, and the Green verification command;
- exact final gate commands with exit codes and important output or skip reasons;
- replay trace paths and `trace:summary` highlights for collectible pickup and double-jump evidence, if generated;
- visual snapshot or screenshot artifact paths for door scale and HUD presentation;
- whether `imagegen` was used, and if so, generated asset paths plus manifest/content-budget evidence;
- whether subagents were used, and for what bounded review task;
- adversarial self-review result covering Scope, Non-goals, TDD, Godot-only constraint, and anti-gaming rules;
- unresolved risks, known skips, and remaining follow-up work.

## Stop rules
Stop and ask the user before continuing if any of these occur:
- The expected Godot player controller, HUD, level, door, or collectible files cannot be found after the required first reads.
- Fixing the issue appears to require reintroducing Phaser runtime code or dependencies.
- Fixing the issue appears to require replacing the player `CharacterBody2D` controller with `RigidBody2D`.
- A new production dependency, external service, paid asset, or unclear asset license is required.
- A large binary asset is needed and would materially affect repository size or content-budget checks.
- A destructive migration, data deletion, or irreversible repository operation appears necessary.
- Existing tests fail for unrelated reasons and fixing them would require changing product behavior outside this goal or weakening tests.
- Final verification cannot run because a documented prerequisite is unavailable and the relevant script does not skip gracefully.
- The requested HUD polish expands into a full menu, inventory, map, pause, result, or accessibility redesign beyond the in-run HUD.

## Open questions
- None blocking. The HUD target is intentionally bounded by the assumptions and Done when criteria above.
