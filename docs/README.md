# Documentation

Fake Kirdy の現行仕様は Godot 4 mainline を前提にしています。runtime、replay、trace、level data、Web export は `godot/` と Godot-owned scripts/tests が canonical です。

## 読む順番

1. `../README.md`: 開発・実行コマンドの最短入口。
2. `map-structure.md`: 固定マップ、generated rooms、cluster flow。
3. `godot-v2/README.md`: Godot mainline docs の索引。
4. `../Task.md`: 現行仕様で残っている作業の一覧。

## 現行仕様

- Controller and replay: `godot-v2/controller-lab.md`, `godot-v2/replay-and-trace.md`
- Levels and content: `godot-v2/level-lab.md`, `godot-v2/content.md`, `godot-v2/procedural-level-generation.md`
- Gameplay loop: `godot-v2/combat-slice.md`, `godot-v2/session-outcomes.md`
- UI/save/performance: `godot-v2/hud-overlay.md`, `godot-v2/save-persistence.md`, `godot-v2/performance-testing.md`, `godot-v2/web-fallback.md`

## Validation

- Fast static/test gate: `npm run test`
- Canonical replay gate when Godot is available: `npm run test:canonical`
- Trace metrics: `npm run trace:summary -- <trace.json|trace.ndjson>`
