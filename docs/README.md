# Documentation

Fake Kirdy の現行仕様は Godot 4 mainline を前提にしています。runtime、replay、trace、level data、Web export は `godot/` と Godot-owned scripts/tests が canonical です。

## 読む順番

1. `../README.md`: 開発・実行コマンドの最短入口。
2. `map-structure.md`: 固定マップ、generated rooms、cluster flow。
3. `godot-v2/README.md`: Godot mainline docs の索引。
4. `../Task.md`: 現行仕様で完了済み/残っている作業の一覧。

## 現行仕様

- Controller and replay: `godot-v2/controller-lab.md`, `godot-v2/replay-and-trace.md`
- Levels and content: `godot-v2/level-lab.md`, `godot-v2/content-migration.md`, `godot-v2/procedural-level-generation.md`
- Gameplay loop: `godot-v2/combat-slice.md`, `godot-v2/session-outcomes.md`
- UI/save/performance: `godot-v2/hud-overlay.md`, `godot-v2/save-persistence.md`, `godot-v2/performance-testing.md`, `godot-v2/web-fallback.md`

## 履歴と削除済み文書

旧 runtime 設計を説明していた `docs/design.md`、`docs/requirements.md`、`docs/swallow-capture-detach.md`、`docs/godot-v2/migration-plan.md` は削除済みです。耐久的な仕様はこの docs tree の Godot 文書、`Task.md`、`godot/levels/*.json`、replay fixtures、Vitest contracts に移しました。

`godot-v2/full-migration-execplan.md` と `godot-v2/gameplay-completion-execplan.md` は完了済み作業の履歴として残します。新しい実装判断では、これらより現行 docs、checked-in Godot data、tests を優先してください。

## Validation

- Fast static/test gate: `npm run test`
- Canonical replay gate when Godot is available: `npm run test:canonical`
- Legacy removal audit: `npm run legacy:inventory`
- Trace metrics: `npm run trace:summary -- <trace.json|trace.ndjson>`
