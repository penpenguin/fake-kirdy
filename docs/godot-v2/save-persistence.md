# Godot v2 Save Persistence

Godot save persistence is intentionally minimal while the migration is still in progress. The first canonical save boundary stores progression state that replay traces can verify.

`SaveState.gd` owns the JSON shape:

- `version`
- `acquired_item_ids`
- `completed_level_ids`
- `visited_level_ids`
- `unlocked_door_ids`
- `consumed_heal_ids`
- `explored_tiles`
- `current_level_id`
- `player_hp`
- `player_max_hp`
- `player_position`
- `ability_type`
- `settings`

`SaveStore.gd` reads and writes that state with `FileAccess` and `JSON.parse_string`. Missing save files load as an empty state.

On Web exports, `SaveStore.gd` uses `localStorage["kirdy-save"]` as the primary browser save backend through `JavaScriptBridge`, matching the legacy web save contract. A successful browser primary write emits `save.written` with `storage_backend: "localStorage"` and also emits `save.local_storage.written`.

The Web path keeps a sessionStorage fallback for failed primary writes. If `localStorage` cannot write the save data, the store serializes the same save JSON into `sessionStorage["kirdy-save-temp"]`. Loads read `localStorage["kirdy-save"]` first and then the temporary session entry when the primary store is unavailable. Successful fallback writes still emit `save.written` with `storage_backend: "sessionStorage"` and additionally emit `save.session_storage_fallback.written` so traces can distinguish temporary browser recovery from normal file persistence.

`GameSession.gd` owns the gameplay connection. When `save_enabled` is true, session startup emits `save.loaded`. When a collectible grants a new item, `item.acquired` is emitted before the session writes the save file. Swallowing an enemy stores the current `ability_type`; loading a level records it in `visited_level_ids`, and entering a door records a stable `source_level_id:door_id` key in `unlocked_door_ids`. Heal markers record consumed ids in `consumed_heal_ids` so saved max-health and revive rewards cannot be collected again after reload. The session also records tile exploration as `explored_tiles`, using the Phaser-compatible shape `{ level_id: ["column,row"] }` from the player's current position and `exploration_tile_size`. Settings preserve the Phaser save shape for `volume`, `controls`, and `difficulty`, with the same basic sanitizing rules. HP changes, player position, and goal completion also write the save file and emit `save.written`. Read or write failures emit `save.error`.

`MapOverlay.gd` is the first minimal UI consumer of `explored_tiles`. `GameSession` creates it when `map_overlay_enabled` is true, syncs the current exploration payload into it, and emits `map.updated` when a new tile is discovered. The `map_toggle` action is bound to M and toggles the overlay visibility with a `map.toggled` trace event. The overlay draws explored tile rectangles, highlights the current level, and draws feature markers for current-level doors, heals, collectibles, hazards, ability gates, and goals. Feature markers carry `discovered` so known elements and still-unseen elements are visually distinct while replay/trace remains the authoritative validation path.

`SettingsOverlay.gd` is the gameplay settings menu consumer of the persisted settings payload. `GameSession` creates it when `settings_overlay_enabled` is true, keeps it hidden until `settings_menu` or pause settings opens it, syncs `volume`, `controls`, `difficulty`, `selected_setting_index`, and blur state, and emits `settings.updated` when settings replay actions change those values. The current replay actions are `settings_menu`, `settings_focus_next`, `settings_focus_previous`, `settings_volume_up`, `settings_volume_down`, `settings_cycle_controls`, and `settings_cycle_difficulty`. Opening from gameplay emits `settings.menu.opened`, focus movement emits `settings.focus.changed`, and closing emits `settings.menu.closed`. During pause, `pause_settings` opens this overlay, ESC closes it back to pause, and a second ESC resumes gameplay. The overlay uses `SettingsBlur.gdshader` for post-processing blur and `BlurFallback` for Canvas-compatible fallback dimming.

`VirtualControlsOverlay.gd` consumes the same `controls` setting. When `controls` changes to `touch`, `GameSession` shows the touch D-pad and Z/X/C action buttons after the settings menu closes and emits `virtual_controls.updated`; switching away from `touch` hides the overlay and releases any pressed virtual actions.

Saved player position is applied only when the saved `current_level_id` matches the level being started. This keeps explicit replay starts deterministic; a saved position from `goal_sanctum` will not be applied to a replay that starts in `mirror_corridor`.

Headless replay can use a deterministic save path:

```bash
npm run godot:replay -- --replay res://tests/replays/forest_reliquary_collectible.json --out /tmp/forest.ndjson --save /tmp/fake-kirdy-save.json
```

This is not the final save system. It does not yet persist a complete UI-facing profile.
