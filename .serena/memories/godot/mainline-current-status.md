# Godot Mainline Current Status

Updated 2026-06-14 from current docs and `package.json`.

Godot 4 under `godot/` is the canonical Fake Kirdy runtime. The previous Phaser + Matter.js runtime/reference copy is no longer present in the repository. Current implementation work should use checked-in Godot docs, data, resources, tests, replay fixtures, and validation scripts.

Current shipped shape:
- Mainline runtime, run/build/replay/trace/test commands are Godot canonical.
- Stage topology is represented by `godot/levels/stage_manifest.json`, `level_catalog.source.json`, generated `level_catalog.json`, and `generated/procedural_levels.json`.
- The playable surface includes hand-authored hub/branch/reliquary/goal/test scenes and generated schema rooms `labyrinth_001` through `labyrinth_132`.
- Controller, doors, levels, combat, outcomes, saves, map/HUD/inventory/settings/pause/result/error UI, virtual controls, audio mix, generated content, and replay traces are documented in `mem:docs/index`.
- Replay and trace are canonical observability tools; `trace:summary` exposes outcome, event counts, visited/completed levels, items, abilities, saves, inventory/HUD/result/runtime-error payloads, and player motion metrics.

Core commands:
- `npm run test` for the fast canonical gate.
- `npm run test:canonical` before claiming canonical gameplay parity when Godot is available.
- `npm run check:full` for stronger runtime/export/web verification.
- `npm run legacy:inventory` to verify the removed legacy surface remains empty.

Current caveats:
- Local Godot/export-template availability can vary; wrappers should skip gracefully unless the strict command explicitly requires output.
- `docs/godot-v2/full-migration-execplan.md` and `gameplay-completion-execplan.md` are historical records. Prefer current docs, checked-in data, and tests for new implementation decisions.