# Session Outcomes

`GameSession.gd` owns the minimal Godot mainline run outcome state. A run currently ends by reaching a `GoalMarker` or by player defeat.

## Death Flow

The player starts each replay/session with `player_max_hp`. Idle enemies can apply contact damage from `EnemySpawnMarker.contact_damage`, which is copied onto `SimpleEnemy.contact_damage` when the level loads.

When contact damage is applied, the session emits:

- `player.damaged`
- `player.defeated` when HP reaches zero
- `game.over`
- `run.finished` with `outcome: game_over`

If `player_revive_count` is greater than zero when HP reaches zero, the session consumes one revive before game-over. That emits `player.revived`, restores HP to `player_max_hp`, writes save state when enabled, and lets the run continue. A later lethal hit with no revive left follows the normal game-over flow.

`danger_room_game_over.json` is the smallest replay fixture for this flow. It loads `danger_room`, moves into a high-damage enemy, and should finish with `game.over` and `run.finished`.

## Heal Flow

`HealMarker` metadata is consumed by `GameSession.gd`. When the player overlaps a heal marker, the session records the marker id in `consumed_heal_ids`, emits `heal.collected`, and applies the marker `reward_type`.

The current reward types are:

- `health`: restore HP by `amount`; emits `player.healed` when HP changes.
- `max-health`: increase `player_max_hp` by `amount`, heal by the same amount, emit `player.max_hp_increased`, and write the new max HP through the save path when save is enabled.
- `revive`: increase `player_revive_count` by `amount`, emit `player.revive_acquired`, and write the new revive count through the save path when save is enabled.

Enemy contact damage uses a short `player_invulnerability_ms` window so a single enemy does not drain all HP every physics frame. This keeps the first healing replay deterministic without adding the full Phaser damage model yet.

`heal_room_recover_and_goal.json` loads `heal_room`, takes one enemy contact hit, collects `heal_room_recovery`, emits `player.healed`, then reaches the goal and emits `run.finished`.

`central_hub_dead_end_max_health.json` starts at the Phaser-derived `central_hub` dead-end max-health marker, collects `central_hub_dead_end_max_health`, emits `player.max_hp_increased`, and ends by `replay.max_frames_reached`. The replay is intentionally short so it validates pickup/session/save behavior without drifting into a nearby hub door.

`revive_room_revive_then_game_over.json` collects `revive_room_dead_end_revive`, emits `player.revive_acquired`, survives the first lethal enemy contact through `player.revived`, then reaches a later lethal contact and emits the normal game-over trace once the revive count is empty.

## Collectible Flow

`CollectibleMarker` metadata is also consumed by `GameSession.gd`. When the player overlaps a collectible marker, the session records the marker id in `collected_collectible_ids` and emits `collectible.collected` with both `collectible_id` and `item_id`.

The session also tracks acquired item ids in `acquired_item_ids`. A newly acquired item emits `item.acquired` with the collected item id and the sorted `items_collected` list. When `save_enabled` is true, those ids are loaded from and written to the minimal Godot save store alongside current level id, HP, max HP, completed level ids, visited level ids, unlocked door ids, explored tiles, player position, current ability type, and the minimal settings payload.

The `*_reliquary_collectible.json` replays load `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`, walk into the room keystone, and leave trace events that can be summarized by `npm run trace:summary`.

## Goal Flow

Goal completion remains separate: touching a `GoalMarker` emits `run.finished` with the goal metadata payload.

When save is enabled, touching a `GoalMarker` also records the current level in `completed_level_ids` before `run.finished`.

Completed and game-over runs also call `ResultOverlay.set_result_state()` and emit `result.overlay.shown`. The overlay payload carries the level id, outcome, run time, frame count, collected item ids, and completed level ids. `trace:summary` exposes the latest payload as `last_result_overlay` so replay review can compare the player-facing result screen with `run.finished` and save state.

All flows use the same trace schema so metrics can compare completed runs, game-over runs, and replay failures without special parsing.

## HUD Flow

`HudOverlay.gd` is the first minimal player-facing HUD for the Godot mainline. `GameSession` creates it when `hud_overlay_enabled` is true and syncs level id, HP, max HP, revive count, ability type, collected item ids, and outcome.

Each meaningful HUD state change can emit `hud.updated`. `trace:summary` exposes the latest HUD payload as `last_hud`, which lets replay review compare player-facing state with save, combat, item, and outcome events.
