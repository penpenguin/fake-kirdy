# Goal

## Objective
Godot mainline の代表プレイ導線で、操作説明・リザルト・チュートリアル文言・能力/攻撃表現・敵バリエーション・被ダメ無敵時間・Hub扉配置のUXを、常時HUD重複や仮置き感のある表示なしに検証可能な品質まで引き上げる。

## Context
このリポジトリは Fake Kirdy の canonical Godot 4 プロジェクトです。現在のユーザー指摘は、操作説明が右上に常時出てHUDと重なる、リザルトが画面体験として弱い、`Blue wall: get Spark, press Z` や `Hub -> first real stage` のようなデバッグ文言がゲームにそぐわない、Spark能力がソード風/居合風に見える、攻撃用テクスチャが使われていない、敵が少ない、接触ダメージがほぼ即死に見える、Hub扉が近すぎて意味が分かりにくい、というものです。

`AGENTS.md` の制約を適用します。会話は日本語、コード変更は t-wada TDD、Godot が canonical、Phaser runtime と依存は再導入禁止、プレイヤーは `CharacterBody2D`、配置は editor-driven marker/resource/data を優先し、replay/trace で観測可能にします。

Task classification: UI / behavior / accessibility check + feature implementation + bug fix + content/design polish + test addition.

[Assumption] 「全体的にUXを上げる」は、このゴールでは上記8項目の代表導線に限定します。フルゲーム全体のアート刷新、全ステージ再設計、全敵ロスター移植は含めません。

[Assumption] ImageGen は、Godot-owned の小さなUI/攻撃/敵差分用ビットマップが必要な場合に限り使用可です。既存アセットやGodot/CSS的な実装で十分なら使わなくて構いません。

## Scope
- Inspect/change files under `godot/`, `test/`, `scripts/`, `docs/godot-v2/`, and root test/build configuration only when directly required.
- May update UI scenes/scripts such as `ControlGuideOverlay`, `PauseOverlay`/`PauseScene`, `ResultOverlay`/`ResultsScene`, `HudOverlay`, and related visual snapshot/usability contracts.
- May update representative levels/catalog/manifests under `godot/levels/` for tutorial and Hub door UX, including marker metadata, door roles, labels/signs, spacing, and visual category cues.
- May update player/session/combat scripts for control-guide state, result popup flow, ability attack visuals, damage invulnerability, enemy spawning, replay input handling, and trace payloads.
- May add or update small Godot-owned assets under `godot/resources/` when required, including ImageGen-produced bitmap assets, provided content-budget and fallback audits cover them.
- May add or update focused Vitest tests, static contract scripts, replay fixtures, trace assertions, visual snapshots, usability/accessibility contracts, and docs.
- May use subagents for bounded read-only review tasks such as UX critique, asset/scene audit, or test-gap review. The main agent remains responsible for edits and verification.

## Non-goals
- Do not reintroduce Phaser runtime code, Phaser dependencies, or legacy runtime commands.
- Do not replace the player `CharacterBody2D` controller with `RigidBody2D`.
- Do not implement a full menu redesign, full campaign redesign, full art direction pass, save-system rewrite, audio overhaul, localization system, in-game level editor, external CMS, networking, deployment, or publishing work.
- Do not port every enemy, every ability, every stage, every animation, or every UI screen in one run.
- Do not solve confusing Hub doors by simply deleting traversal content unless the route remains playable and the removed door was genuinely redundant.
- Do not hide the control guide by removing all control discoverability; controls must remain visible at first presentation and reachable from ESC pause menu.
- Do not make Spark appear correct only by renaming text while keeping sword/iai visuals and motion unchanged.
- Do not satisfy enemy variety with only metadata differences; enemy variants must be visually and behaviorally distinguishable in-game or in replay/contract evidence.
- Do not add large binary assets, unclear-license assets, production dependencies, or external services without explicit approval.
- Do not commit, push, open a PR, or run destructive cleanup unless explicitly requested later.

## Constraints and anti-gaming rules
- Follow strict Red -> Green -> Refactor. For every behavior/design change, first add the smallest failing test, replay, trace assertion, visual snapshot contract, or static lint rule that captures the user-visible problem.
- Prefer fast Vitest/static checks and Godot replay fixtures. Runtime Godot checks may skip gracefully only where existing scripts already define that behavior.
- Control guidance must not overlap the normal in-run HUD after the first dismissible popup is gone.
- ESC pause menu must expose controls/help in a player-facing way without relying on persistent top-right text.
- Result UI must be popup/modal-like and readable while preserving deterministic `result.overlay.shown`, `run.finished`, and summary payloads.
- Tutorial/Hub instructional text must be in-world and game-appropriate. Debug-like literal strings such as `Blue wall: get Spark, press Z` and `Hub -> first real stage` must not remain visible in representative player-facing scenes.
- Spark must have coherent electric/spark behavior and visuals, or the ability/enemy pairing must be changed so the copied ability, motion, texture, and displayed name agree.
- Attack animation/effect assets that are intended for active attacks must be referenced by the relevant scene/script/contract and appear in replay or visual snapshot evidence.
- Player damage recovery must include approximately 2 seconds of invulnerability after a hit, visible translucent blinking, and trace/replay proof that repeated contact during that window does not stack damage.
- Hub doors must be distinguishable by type/purpose and spaced or signposted enough that nearby doors are not ambiguous.
- Do not delete, skip, weaken, or rewrite tests merely to make checks pass.
- Do not disable build paths, type checks, visual snapshot checks, content-budget checks, usability checks, replay checks, scene lint, or export checks to claim completion.
- Do not declare completion without exact validation output or clearly labeled manual evidence.

## Risk tier and review depth
Medium-high risk. The work touches UI flow, combat readability, player damage rules, content layout, generated/static contracts, and visual assets. Require focused verification at each checkpoint, one adversarial self-review pass against the non-goals/anti-gaming rules, and a manual or screenshot-based UX review of the representative tutorial-to-Hub route before completion.

## Required first reads
Before editing, read or inspect:

- `AGENTS.md`
- `package.json`
- `GOAL.md`
- `docs/godot-v2/README.md`
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/pause-overlay.md`
- `docs/godot-v2/result-overlay.md`
- `docs/godot-v2/combat-slice.md`
- `docs/godot-v2/door-transition-flow.md`
- `docs/godot-v2/usability-accessibility-testing.md`
- `godot/scenes/ui/ControlGuideOverlay.tscn`
- `godot/scripts/ui/ControlGuideOverlay.gd`
- `godot/scenes/ui/PauseOverlay.tscn`
- `godot/scripts/ui/PauseOverlay.gd`
- `godot/scenes/ui/PauseScene.tscn`
- `godot/scripts/ui/PauseScene.gd`
- `godot/scenes/ui/ResultOverlay.tscn`
- `godot/scripts/ui/ResultOverlay.gd`
- `godot/scenes/ui/ResultsScene.tscn`
- `godot/scripts/ui/ResultsScene.gd`
- `godot/scenes/ui/HudOverlay.tscn`
- `godot/scripts/ui/HudOverlay.gd`
- `godot/scripts/session/GameSession.gd`
- `godot/scripts/player/PlayerController.gd`
- `godot/scripts/enemies/SimpleEnemy.gd`
- `godot/scripts/enemies/FlyingEnemy.gd`
- `godot/scripts/level/markers/DoorMarker.gd`
- `godot/scripts/level/markers/EnemySpawnMarker.gd`
- representative tutorial/Hub levels and catalog entries discovered from `godot/levels/level_catalog.source.json`
- relevant tests/contracts discovered with `rg`, especially HUD, pause, result, visual snapshot, usability/accessibility, combat slice, combat matrix, enemy AI arena, door transition, scene lint, content budget, asset fallback, replay, and trace summary tests.

Run or inspect these discovery commands before editing:

```bash
rg -n "ControlGuide|ResultOverlay|PauseOverlay|Blue wall|Hub ->|Spark|spark|invulner|damage|enemy_type|DoorMarker|door_role" godot test scripts docs/godot-v2
npm run godot:replay-suite -- --list
npm run godot:usability
npm run godot:visual-snapshot
```

## Work loop
1. Create or update a short plan with checkpoints for control guide, result popup, tutorial/Hub text, Spark/attack visuals, enemy variety, damage invulnerability, Hub door UX, and final review.
2. For each checkpoint, write the narrowest failing test, replay, trace assertion, visual snapshot contract, or static lint rule first.
3. Run the fastest relevant command and confirm the new check fails for the intended reason.
4. Implement the smallest Godot/data/script/asset change that makes the check pass.
5. Run the focused check again. Refactor only after green and only where it reduces duplication or aligns with existing patterns.
6. If ImageGen is used, store generated assets in an appropriate Godot resource path, update import/fallback/content-budget evidence, and record the prompt/purpose in the completion receipt.
7. If subagents are used, keep them read-only and bounded to review/audit; summarize their findings and which were acted on.
8. After all checkpoints are green, run the final gate and perform an adversarial self-review against scope, non-goals, and user-visible UX claims.

## Implementation checkpoints
1. Control-guide lifecycle: remove persistent in-run top-right operation text; show a dismissible first-run/session-start popup; expose controls/help from ESC pause menu; preserve keyboard/replay determinism.
2. Result popup: make run-end result presentation popup/modal-like, readable, and consistent with pause/menu styling while preserving trace summary data and restart/continue behavior.
3. Tutorial/Hub copy and signposting: replace debug-like English labels with game-appropriate in-world copy, icon/sign/marker treatment, or diegetic prompts for Spark gates and the first real stage route.
4. Spark and attack visuals: align copied Spark ability identity with electric/spark visuals and motion, or change the ability pairing so name, texture, animation, and motion are coherent; ensure intended attack texture/effect assets are actually used.
5. Enemy variety: add or expose a bounded set of visually and behaviorally distinct enemy archetypes in representative tutorial/early-route content, with replay/static evidence that more than one enemy type is present and meaningful.
6. Player damage recovery: implement approximately 2 seconds of invulnerability after damage, translucent blinking feedback, and trace/replay proof that repeated contact during invulnerability does not immediately kill the player.
7. Hub door UX: classify and visually distinguish Hub doors by role/purpose, improve spacing or signposting, and add a contract that catches ambiguous nearby visible doors.
8. Integration and review: update docs, contracts, replay fixtures, snapshots, generated artifacts, and reports; verify no forbidden scope or shortcuts were used.

## Done when
- Operation instructions are no longer persistently visible in the in-run HUD/top-right area after initial dismissal. A focused test, replay trace, UI contract, or visual snapshot proves `ControlGuideOverlay` appears as an initial popup and can be hidden without leaving overlapping HUD text.
- ESC pause menu exposes controls/help in a player-facing menu state. A pause overlay test/replay/trace proves controls are reachable from pause and closing the menu returns to gameplay deterministically.
- Result presentation is popup/modal-like for both clear and game-over paths. A result overlay test, replay, trace summary, or visual snapshot proves it displays outcome, time, score, item/HP bonus, and restart/continue affordance without cropped or overlapping text.
- Representative player-facing scenes no longer contain visible debug-like strings `Blue wall: get Spark, press Z` or `Hub -> first real stage`. A static scene/text contract or visual snapshot proves replacement copy/signposting exists for the Spark gate and first-stage route.
- Spark/copied ability behavior is coherent: either Spark uses electric/spark visuals and non-sword/iai presentation, or the copied ability/enemy/label is changed so sword-like visuals and motion make sense. Combat matrix, replay trace, asset fallback, or visual snapshot evidence must name the ability and attack type.
- Intended attack animation/effect texture assets are actually referenced by the relevant ability scene/script/resource and covered by asset fallback/content-budget or visual snapshot evidence.
- At least three visually or behaviorally distinct enemy archetypes are available in the representative early route or documented combat slice. A contract/replay/test must prove their `enemy_type`, ability profile, movement/attack behavior, and visual/scene identity are not all the same.
- Player contact damage grants roughly 2000ms invulnerability with translucent blinking feedback. A replay or focused test proves HP decreases on the first hit, does not decrease again during the invulnerability window despite continued contact, and can decrease again after the window expires.
- The damage recovery behavior emits traceable events or payloads such as damage taken, invulnerability started/ended, and blink/feedback state, or an equivalent existing trace payload is documented and asserted.
- Hub doors are distinguishable by type/purpose through role metadata plus visible signposting, icon, color, label, shape, or layout. A scene lint/door contract/visual snapshot fails if multiple nearby visible Hub doors lack distinct roles or readable purpose cues.
- Hub door placement is less ambiguous. The completion receipt must include before/after evidence from a scene audit, contract output, or screenshot summary showing reduced confusing clustering or improved category separation.
- New/changed docs under `docs/godot-v2/` describe the control-guide lifecycle, result popup contract, ability/attack visual rule, damage invulnerability rule, enemy variety expectation, and Hub door UX rule where those contracts changed.
- Every production/content change has TDD evidence: the completion receipt identifies the Red check added before the change and the Green command result after the fix.

## Verification
### Fast feedback loop
Use the narrowest relevant command while iterating. Likely commands include:

```bash
npm run check:test -- test/godot-v2-hud-overlay.test.ts
npm run check:test -- test/godot-v2-pause-overlay.test.ts
npm run check:test -- test/godot-v2-results-overlay.test.ts
npm run check:test -- test/godot-v2-results-scene.test.ts
npm run check:test -- test/godot-v2-usability-accessibility.test.ts
npm run check:test -- test/godot-v2-visual-snapshot.test.ts
npm run check:test -- test/godot-v2-combat-slice.test.ts
npm run check:test -- test/godot-v2-combat-matrix.test.ts
npm run check:test -- test/godot-v2-enemy-ai-arena.test.ts
npm run check:test -- test/godot-v2-door-transition.test.ts
npm run godot:usability
npm run godot:visual-snapshot
npm run godot:combat-matrix
npm run godot:enemy-ai-arena
npm run godot:scene-lint
```

If `npm run check:test -- <file>` does not narrow Vitest in this repo, use the closest working command from `package.json` and report the exact command.

### Final gate
Before declaring completion, run:

```bash
npm run test
npm run check:godot
npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-ux-polish-replays
npm run build
```

For visual/UI completion, also provide one of:

- updated visual snapshot artifacts/baselines from `npm run godot:visual-snapshot`, or
- screenshots captured from the Godot/Web run showing the initial controls popup, ESC controls/help menu, result popup, Spark/attack visual, damage blink, and Hub doors, with file paths in the completion receipt.

If Godot, export templates, browser, or runtime prerequisites are unavailable, existing scripts may skip gracefully. Report exact skip output and still run all non-optional tests that can run locally.

## Working memory
Maintain minimal operational state if the work spans more than one focused session:

- `PLAN.md`: current checkpoint, next action, and status.
- `ATTEMPTS.md`: failed tests/checks, commands run, outcomes, skip reasons, and hypotheses.
- `NOTES.md`: only if UX/asset/route decisions become too detailed to keep in `GOAL.md`.

If the goal is completed in one continuous session, these files are optional. Do not create process files only for ceremony.

## Completion receipt
Before marking the goal complete, report:

- changed files grouped by checkpoint;
- for control guide, the first-popup behavior, dismissal behavior, ESC menu access path, and evidence that no persistent overlapping HUD instructions remain;
- for result popup, clear/game-over paths tested, trace summary payloads preserved, and visual evidence path;
- for tutorial/Hub text, the exact removed debug strings and replacement signposting/copy;
- for Spark/attack visuals, ability identity decision, attack texture/effect assets used, replay/snapshot evidence, and asset fallback/content-budget result;
- for enemy variety, enemy archetypes added or exposed, their visual/behavior differences, and replay/static proof;
- for damage recovery, invulnerability duration, blink feedback mechanism, trace events/payloads, and replay/test proving no rapid repeated damage;
- for Hub doors, before/after ambiguity evidence, role taxonomy, spacing/signposting rule, and the contract that prevents regression;
- for every checkpoint, the Red check name/output summary and the Green verification command with exit code;
- exact final gate commands with exit codes and important output or skip reasons;
- whether ImageGen was used, with generated asset paths and prompt/purpose summary if applicable;
- whether subagents were used, and for what bounded review/audit task;
- adversarial self-review result covering Scope, Non-goals, TDD, Godot-only constraint, visual/UI anti-gaming rules, asset risk, and UX residual risk;
- unresolved risks, known skips, and remaining follow-up work.

## Stop rules
Stop and ask the user before continuing if any of these occur:

- Expected Godot UI, session, player, enemy, level, door, replay, or contract files cannot be found after required first reads.
- Fixing the issue appears to require reintroducing Phaser runtime code or dependencies.
- Fixing the issue appears to require replacing the player `CharacterBody2D` controller with `RigidBody2D`.
- A new production dependency, external service, paid asset, unclear-license asset, or large binary asset is required.
- ImageGen would need to imitate a copyrighted/proprietary source image rather than creating a distinct Godot-owned asset.
- A destructive migration, data deletion, or irreversible operation appears necessary.
- The request expands into full campaign redesign, full enemy roster migration, full localization, full menu system rewrite, or broad art replacement.
- Existing tests fail for unrelated reasons and fixing them would require changing product behavior outside this goal or weakening tests.
- Final verification cannot run because a documented prerequisite is unavailable and the relevant script does not skip gracefully.
- Any acceptance criterion can only be satisfied by manual taste judgment without a command, artifact, replay, trace, screenshot, or explicit user confirmation.

## Open questions
- None blocking. The target is a representative UX vertical slice for the listed issues; broader whole-game polish can be split into later goals after this one produces evidence.
