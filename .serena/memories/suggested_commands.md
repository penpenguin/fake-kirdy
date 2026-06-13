# Suggested Commands

Core:
- `npm run dev`: start the canonical Godot project via `npm run godot:run --`.
- `npm run godot:run`: run the canonical Godot project at `godot/`.
- `npm run build`: run the Godot Web export wrapper; it skips gracefully when local Godot/export templates are unavailable.
- `npm run build:public`: strict Godot Web export for publishable `dist/` output.
- `npm run typecheck` is not defined; use `npm run check:typecheck`.

Tests and validation:
- `npm run test`: `check:typecheck`, `check:test`, and `check:godot`.
- `npm run check:typecheck`: TypeScript `tsc --noEmit`.
- `npm run check:test`: Vitest over `test/godot*.test.ts` and `test/trace-summary.test.ts`.
- `npm run check:godot`: validates stage manifest, procedural schema, catalog, content topology, scene lint, graph/progression/combat/AI/feel/visual/audio/content/save/web/playtest/quality/replay-gen/export checks, then Godot executable checks where available.
- `npm run test:canonical`: `npm test` plus the canonical Godot replay suite.
- `npm run check:full`: stronger local/CI-style gate including runtime Godot checks, strict public build, web smoke, and web performance.

Replay, trace, and content:
- `npm run godot:replay -- --replay <res://tests/replays/file.json> --out <trace.ndjson>`.
- `npm run godot:replay-suite -- --list` or `--filter <id>` or `--out-dir <dir>`.
- `npm run trace:summary -- <trace.json|trace.ndjson>`.
- `npm run legacy:inventory`: confirm the removed legacy surface remains empty.
- `npm run godot:stage-manifest -- --check`, `npm run godot:procedural-levels -- --check`, `npm run godot:catalog -- --check`, `npm run godot:content-check`: focused content/schema validation.