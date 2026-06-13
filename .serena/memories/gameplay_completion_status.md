# Gameplay Status

Updated 2026-06-14 after docs cleanup.

The Godot mainline has a replay-backed gameplay loop. Remaining work is polish, tuning, and future content expansion.

Implemented loop coverage:
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