# Coding Style And Project Rules

- Project discussion should generally be in Japanese. Commit messages and code comments may be English.
- Follow Takuto Wada style TDD for code changes: smallest failing test first, make it pass minimally, then refactor after green.
- Prefer fast Vitest + jsdom contracts for TypeScript/tooling changes; use Godot replay/trace checks for gameplay-critical behavior.
- TypeScript uses ES modules, 2-space indentation, `const` defaults, explicit return types for exported APIs, `camelCase` values, `PascalCase` types/classes, and kebab-case filenames unless mirroring third-party names.
- Godot runtime work belongs under `godot/`; do not reintroduce Phaser runtime behavior or dependencies.
- Player controller must use `CharacterBody2D`, not `RigidBody2D`, and movement tuning should remain exported/resource-backed and replay-observable.
- Keep placement metadata in editor-placeable marker nodes or generated schema rather than hard-coding topology in gameplay scripts.
- Trace/replay contracts should remain JSON/NDJSON and observable through `trace:summary`.