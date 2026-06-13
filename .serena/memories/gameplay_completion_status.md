# Gameplay Completion Status

Updated 2026-06-14 from current docs.

The first replay-backed Godot gameplay loop is complete. Current remaining work is polish/tuning/expansion, not a blocking gameplay-loop gap.

Implemented loop coverage:
- Mainline starts from the Godot hub path rather than the old combat-only slice.
- Player controller, door transitions, goal completion, damage, game-over, revive, heals, collectibles, dead-end rewards, save/load, and result UI are traceable.
- Combat supports capture, release/spit, swallow, ability acquisition, ability use, enemy HP/damage/defeat/feedback, active enemy attacks, ability-specific profiles, and focused replay evidence.
- Door locks and progression checks support item, ability, completed-level, defeated-group, boss, and cluster-keystone requirements, with `door.locked` trace/HUD feedback.
- Generated schema rooms carry topology, placement, safety, route variants, enemies, heals, collectibles, hazards, ability gates, objectives, and representative replay coverage.
- HUD, inventory/progress, map, settings, pause, result, runtime error, virtual controls, audio mix, performance, and usability/accessibility contracts are documented and validated through Godot-owned checks.

Representative commands:
- `npm run check:test`
- `npm run check:godot`
- `npm run godot:replay-suite -- --out-dir <dir>`
- `npm run trace:summary -- <trace.ndjson>`

Historical implementation record: `mem:docs/execplans/gameplay-completion`.