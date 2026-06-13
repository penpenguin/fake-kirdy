# Docs Index For Fake Kirdy

Updated 2026-06-14 after docs cleanup. Source tree: `docs/` in `/home/user/repository/fake-kirdy`.

## Current Entry Points

- `docs/README.md`: short documentation entrypoint and validation commands.
- `docs/map-structure.md`: fixed maps, generated maps, cluster flow, and topology validation.
- `docs/godot-v2/README.md`: Godot mainline docs index.
- `docs/godot-v2/content.md`: current playable content, catalog data, generated schema, and replay coverage.
- `Task.md`: current backlog/status.

## Topic Memories

- `mem:docs/root-map-and-assets`: root docs index, map structure, and image metadata.
- `mem:docs/godot/core-runtime`: controller, replay/trace, level markers, and door transitions.
- `mem:docs/godot/content-gameplay`: playable content, procedural generation, combat, and session outcomes.
- `mem:docs/godot/ui-save-web`: HUD, pause/result/error UI, save, virtual controls, audio, performance, Web fallback, and usability checks.

## Coverage

All Markdown files under `docs/` are represented by the topic memories:

- `docs/README.md`
- `docs/map-structure.md`
- `docs/godot-v2/README.md`
- `docs/godot-v2/controller-lab.md`
- `docs/godot-v2/replay-and-trace.md`
- `docs/godot-v2/level-lab.md`
- `docs/godot-v2/door-transition-flow.md`
- `docs/godot-v2/content.md`
- `docs/godot-v2/procedural-level-generation.md`
- `docs/godot-v2/combat-slice.md`
- `docs/godot-v2/session-outcomes.md`
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/pause-overlay.md`
- `docs/godot-v2/result-overlay.md`
- `docs/godot-v2/runtime-error-overlay.md`
- `docs/godot-v2/save-persistence.md`
- `docs/godot-v2/virtual-controls.md`
- `docs/godot-v2/audio-polish.md`
- `docs/godot-v2/performance-testing.md`
- `docs/godot-v2/web-fallback.md`
- `docs/godot-v2/usability-accessibility-testing.md`

Completed transition and historical boundary docs are no longer part of the active docs tree.

## Current Source Of Truth

- Runtime: `godot/`
- Level topology: `godot/levels/stage_manifest.json`, `godot/levels/level_catalog.source.json`, generated `godot/levels/level_catalog.json`, and `godot/levels/generated/procedural_levels.json`
- Replay suite: `godot/tests/replay_suite.json`
- Trace summary: `npm run trace:summary -- <trace.json|trace.ndjson>`
- Fast gate: `npm run test`
- Canonical behavior gate: `npm run test:canonical` when Godot is available

## Image Assets

Serena memories are UTF-8 Markdown; binary images are recorded as metadata rather than embedded bytes.

- `docs/Key visual.png`: PNG, 1400 x 1024, SHA-256 `c87a46c4e347a229ddc6c684d0d894f0fb8a60e9343a921ab129c4624c7863a9`.
- `docs/key_visual.gif`: GIF, 800 x 450, SHA-256 `b57e6ca2ec4b8e9a7282785a551a62e60129fbe39b27497d53a655bbc23bc334`.