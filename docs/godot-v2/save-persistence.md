# Godot v2 Save Persistence

Godot save persistence is intentionally minimal while the migration is still in progress. The first canonical save boundary stores progression state that replay traces can verify.

`SaveState.gd` owns the JSON shape:

- `version`
- `acquired_item_ids`
- `completed_level_ids`
- `visited_level_ids`
- `unlocked_door_ids`
- `explored_tiles`
- `current_level_id`
- `player_hp`
- `player_max_hp`
- `player_position`
- `ability_type`
- `settings`

`SaveStore.gd` reads and writes that state with `FileAccess` and `JSON.parse_string`. Missing save files load as an empty state.

`GameSession.gd` owns the gameplay connection. When `save_enabled` is true, session startup emits `save.loaded`. When a collectible grants a new item, `item.acquired` is emitted before the session writes the save file. Swallowing an enemy stores the current `ability_type`; loading a level records it in `visited_level_ids`, and entering a door records a stable `source_level_id:door_id` key in `unlocked_door_ids`. The session also records tile exploration as `explored_tiles`, using the Phaser-compatible shape `{ level_id: ["column,row"] }` from the player's current position and `exploration_tile_size`. Settings preserve the Phaser save shape for `volume`, `controls`, and `difficulty`, with the same basic sanitizing rules. HP changes, player position, and goal completion also write the save file and emit `save.written`. Read or write failures emit `save.error`.

`MapOverlay.gd` is the first minimal UI consumer of `explored_tiles`. `GameSession` creates it when `map_overlay_enabled` is true, syncs the current exploration payload into it, and emits `map.updated` when a new tile is discovered. The overlay is intentionally simple: it draws explored tile rectangles and highlights the current level, while replay/trace remains the authoritative validation path.

`SettingsOverlay.gd` is the first minimal UI consumer of the persisted settings payload. `GameSession` creates it when `settings_overlay_enabled` is true, syncs `volume`, `controls`, and `difficulty`, and emits `settings.updated` when settings replay actions change those values. The current replay actions are `settings_volume_up`, `settings_volume_down`, `settings_cycle_controls`, and `settings_cycle_difficulty`.

Saved player position is applied only when the saved `current_level_id` matches the level being started. This keeps explicit replay starts deterministic; a saved position from `goal_sanctum` will not be applied to a replay that starts in `mirror_corridor`.

Headless replay can use a deterministic save path:

```bash
npm run godot:replay -- --replay res://tests/replays/forest_reliquary_collectible.json --out /tmp/forest.ndjson --save /tmp/fake-kirdy-save.json
```

This is not the final save system. It does not yet persist a complete UI-facing profile.
