# Task Completion Checklist

For code changes:
- Follow red -> green -> refactor. Start with the smallest failing Vitest/replay/trace contract that captures the behavior.
- Run the narrow focused test first, then the relevant broader gate.
- For TypeScript/tooling/shared docs rule changes, run `npm run test` unless the change is demonstrably docs-only and does not alter development rules.
- For gameplay, movement, level topology, replay, trace, save, UI, or generated-schema changes, prefer a focused replay/trace assertion and run the relevant `check:godot` subcommand.
- Before claiming canonical gameplay parity, run `npm run test:canonical` on a machine with Godot available.

For docs/memory-only work:
- No repo test is required when no repository files or development rules changed.
- Verify Serena memory changes with `mcp__serena.list_memories` and read back the high-signal memory entries.

Always mention skipped checks explicitly, especially when Godot or export templates are unavailable.