# Project Overview

Fake Kirdy is a Godot 4 canonical project. The active runtime is under `godot/`.

Primary direction:
- Godot mainline validates a `CharacterBody2D` platformer controller, editor-placeable level metadata, replay input, trace output, generated schema levels, and trace-derived metrics.
- Gameplay behavior, map topology, controls, regression checks, and assets are represented by Godot-owned docs, data, tests, and resources.
- Root runtime commands, build/export flow, typecheck, Vitest contracts, replay suite, and trace tools are Godot canonical.

Important project areas:
- `godot/`: canonical Godot 4 project, scenes, scripts, levels, resources, tests, and replay fixtures.
- `docs/`: current Godot docs. Start from `mem:docs/index`.
- `test/godot*.test.ts` and `test/trace-summary.test.ts`: canonical Vitest contracts.
- `scripts/`: Godot check/export/replay/trace/content tooling.

Do not add new Phaser runtime behavior or Phaser runtime dependencies. New runtime work belongs under `godot/`, with supporting tooling in `scripts/` and tests under `test/`.