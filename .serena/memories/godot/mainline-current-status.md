# Godot Mainline Current Status

Updated 2026-06-13.

The canonical Godot mainline is playable from `tutorial_room` into the real-stage route and remains replay-backed.

Key shipped state:
- Startup now begins in `tutorial_room`; `central_hub` is reached through the tutorial route.
- `MapOverlay` starts hidden and toggles with `M`; `InventoryOverlay` is hidden by default behind `inventory_debug_overlay_enabled`.
- `ControlGuideOverlay` shows Move, Jump, Inhale, Swallow, Ability, and Map controls.
- Live door transitions require interact input through `DoorMarker.requires_interact`; replay-driven sessions still use automatic transitions for deterministic fixtures.
- Tutorial content includes a spark enemy, spark ability gate with visual/collision state, labels, edge guards, and door routing into `central_hub`.
- The Golden Fire Path is implemented: capture/swallow fire, open `fire_area_ice_block`, enter `labyrinth_011`, and collect `fire_route_cache`.
- Ability gates own `opened`, `Visual`, `CollisionBody/CollisionShape2D`, idempotent `open_gate()`, and `get_gate_state()`. `GameSession` reapplies opened gates on level load and traces scene state in `ability_gate.opened`.
- Object/HUD polish is in place: larger item/heal/door markers, hazard visuals, distinct map feature marker shapes plus legend, expanded HUD objective/cooldown/status labels, camera-boundary clamping, and Sword Z wall-collision blocking.

Representative verification from recent work:
- `npm run check:typecheck` passed.
- `npm run check:test` passed: 55 files, 291 tests.
- `npm run check:godot` passed.
- `npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-object-hud-bounds-replay-suite` passed: 48/48.
- `npm run godot:trace-assert`, `npm run godot:usability`, and `npm run godot:visual-snapshot` passed.

Useful replay fixtures:
- `golden_fire_path`
- `tutorial_no_death_path`
- `tutorial_no_edge_fall_path`
- `tutorial_right_edge_recovery_path`
- `tutorial_to_real_stage_path`
- `sword_z_wall_collision`

Notes:
- Generated reliquary chain fixtures may use elevated initial HP because they test topology traversal rather than combat balance.
- Headless Godot runs can still print resource leak warnings at shutdown even when commands exit 0.
