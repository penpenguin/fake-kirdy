# Docs Index For Fake Kirdy

Imported to Serena on 2026-06-14. Source tree: `docs/` in `/home/user/repository/fake-kirdy`.

## How To Read

1. Current implementation guidance starts here, not in historical ExecPlans.
2. Use `mem:docs/root-map-and-assets` for `docs/README.md`, map topology, and image metadata.
3. Use `mem:docs/godot/core-runtime` for controller, level marker, door transition, replay, and trace contracts.
4. Use `mem:docs/godot/content-gameplay` for content migration, procedural levels, combat, and run/session outcomes.
5. Use `mem:docs/godot/ui-save-web` for HUD, pause, result/error overlays, save, virtual controls, audio, performance, Web fallback, and usability/accessibility.
6. Use `mem:docs/godot/legacy-reference-boundary` for the removed legacy surface rules.
7. Use ExecPlan memories only for historical context: `mem:docs/execplans/gameplay-completion`, `mem:docs/execplans/full-migration/01-purpose-context-progress`, `mem:docs/execplans/full-migration/02-discoveries-decisions`, and `mem:docs/execplans/full-migration/03-work-validation-outcomes`.

## Coverage

All Markdown files under `docs/` are represented in Serena memories:

- `docs/README.md` -> `mem:docs/root-map-and-assets`
- `docs/map-structure.md` -> `mem:docs/root-map-and-assets`
- `docs/godot-v2/README.md` -> `mem:docs/godot/core-runtime`
- `docs/godot-v2/controller-lab.md` -> `mem:docs/godot/core-runtime`
- `docs/godot-v2/replay-and-trace.md` -> `mem:docs/godot/core-runtime`
- `docs/godot-v2/level-lab.md` -> `mem:docs/godot/core-runtime`
- `docs/godot-v2/door-transition-flow.md` -> `mem:docs/godot/core-runtime`
- `docs/godot-v2/content-migration.md` -> `mem:docs/godot/content-gameplay`
- `docs/godot-v2/procedural-level-generation.md` -> `mem:docs/godot/content-gameplay`
- `docs/godot-v2/combat-slice.md` -> `mem:docs/godot/content-gameplay`
- `docs/godot-v2/session-outcomes.md` -> `mem:docs/godot/content-gameplay`
- `docs/godot-v2/hud-overlay.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/pause-overlay.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/result-overlay.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/runtime-error-overlay.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/save-persistence.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/virtual-controls.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/audio-polish.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/performance-testing.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/web-fallback.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/usability-accessibility-testing.md` -> `mem:docs/godot/ui-save-web`
- `docs/godot-v2/legacy-reference-boundary.md` -> `mem:docs/godot/legacy-reference-boundary`
- `docs/godot-v2/gameplay-completion-execplan.md` -> `mem:docs/execplans/gameplay-completion`
- `docs/godot-v2/full-migration-execplan.md` -> split across the three `mem:docs/execplans/full-migration/*` memories.

## Current Source Of Truth

- Runtime: `godot/`
- Level topology: `godot/levels/stage_manifest.json`, `godot/levels/level_catalog.source.json`, generated `godot/levels/level_catalog.json`, and `godot/levels/generated/procedural_levels.json`
- Replay suite: `godot/tests/replay_suite.json`
- Trace summary: `npm run trace:summary -- <trace.json|trace.ndjson>`
- Fast gate: `npm run test`
- Canonical gameplay parity gate: `npm run test:canonical` when Godot is available
- Legacy audit: `npm run legacy:inventory`

## Image Assets In Docs

Serena memories are UTF-8 Markdown; binary images are recorded as metadata rather than embedded bytes.

- `docs/Key visual.png`: PNG image data, 1400 x 1024, 8-bit/color RGB, non-interlaced. SHA-256: `c87a46c4e347a229ddc6c684d0d894f0fb8a60e9343a921ab129c4624c7863a9`.
- `docs/key_visual.gif`: GIF image data, version 89a, 800 x 450. SHA-256: `b57e6ca2ec4b8e9a7282785a551a62e60129fbe39b27497d53a655bbc23bc334`.

## Important Note

`docs/godot-v2/full-migration-execplan.md` and `docs/godot-v2/gameplay-completion-execplan.md` are completed historical records. For new implementation decisions, prefer current docs, checked-in Godot data, tests, and replay fixtures over older migration text.