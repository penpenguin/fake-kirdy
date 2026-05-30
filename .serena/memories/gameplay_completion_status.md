# Gameplay Completion Status

Updated 2026-05-30.

The `Goal.md` gameplay-completion backlog has been implemented through the first complete Godot replay-backed milestone.

Key shipped behavior:
- Mainline start is `central_hub`, with `combat_room` kept as a tutorial/fixture room.
- `combat_room` no longer completes before its exit door.
- Enemies have HP, damage, defeat, knockback, patrol/chase metadata, group/boss ids, and active timed attacks.
- Ability use damages enemies and emits `ability.used`, `enemy.damaged`, and `enemy.defeated`; spit release emits `spit.projectile.fired` and `spit.projectile.hit`.
- Door gates support item, ability, completed-level, defeated-group, and boss requirements with `door.locked` trace/HUD feedback.
- Difficulty now affects enemy HP, contact damage, attack cadence, heal amount, and player invulnerability.
- Hazard and ability-gate markers are implemented, loaded from authored and generated content, persisted where needed, and summarized in traces.
- Generated levels now include objectives, hazards, ability gates, varied enemy roles, route heals, and attack metadata.
- Replay suite schema now enforces `expected_events` and `expected_last_hud`; replay input accepts `initial_ability_type` and `setting_difficulty`.

Validation performed:
- `npm run test` passed: 29 files, 143 tests.
- `PATH=/tmp/fake-kirdy-godot-bin:$PATH npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-godot-replay-suite-gameplay-16` passed with `replay_count: 23`, `passed_replays: 23`, `failed_replays: 0` using temporary official Godot 4.6.3.

Notable runtime tuning from real traces:
- Generated route heal amount is 3.
- Generated elite contact/attack damage is 1.
- Generated enemy attack cooldowns are 4000 ms to keep long generated traversal replayable while still proving active attacks.
- Ice/fire generated-chain replay max frames were trimmed after reliquary arrival to avoid testing unrelated reliquary survival.

Remaining work is polish and expansion, not a blocking gameplay-loop gap: richer hand-authored pacing, stronger visual/audio feedback, and more nuanced ability-specific attacks.