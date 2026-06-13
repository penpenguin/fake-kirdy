# Godot Full Migration Status

Updated 2026-06-14 from current docs.

The full mainline migration boundary is complete. Godot is canonical in `godot/`; root Phaser/Vite runtime commands and direct runtime dependencies are removed; the legacy reference copy is no longer present in the repository.

Completed migration evidence:
- `godot/` owns the active project, scenes, scripts, levels, resources, tests, replay fixtures, and Web export preset.
- Root commands route run/build/replay/trace/test validation through Godot-owned scripts.
- `npm run test` validates TypeScript contracts, trace summary, and Godot-owned static/export/content/project checks.
- `npm run test:canonical` adds the canonical replay suite when Godot is available.
- `npm run build` targets the Godot Web export wrapper; `npm run build:public` is strict for publishable `dist/` output.
- `npm run legacy:inventory` is the current audit command for confirming the removed legacy surface remains empty.

Historical details live in `mem:docs/execplans/full-migration/01-purpose-context-progress`, `mem:docs/execplans/full-migration/02-discoveries-decisions`, and `mem:docs/execplans/full-migration/03-work-validation-outcomes`.