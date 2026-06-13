# Godot UI, Save, Web, Performance Docs Snapshot

Imported from:
- `docs/godot-v2/hud-overlay.md`
- `docs/godot-v2/pause-overlay.md`
- `docs/godot-v2/result-overlay.md`
- `docs/godot-v2/runtime-error-overlay.md`
- `docs/godot-v2/save-persistence.md`
- `docs/godot-v2/virtual-controls.md`
- `docs/godot-v2/audio-polish.md`
- `docs/godot-v2/performance-testing.md`
- `docs/godot-v2/web-fallback.md`
- `docs/godot-v2/usability-accessibility-testing.md`

## docs/godot-v2/hud-overlay.md

# Godot v2 HUD Overlay

`HudOverlay.gd` is the polished in-run HUD for the Godot mainline. It keeps the same trace-friendly payload owned by `GameSession.gd`, but presents it as a thin full-width top bar with icon-like cues instead of a centered debug panel.

Displayed state:

- current level id
- player HP and max HP in an HP bar with a red HP icon cue
- current ability type in an ability chip with an ability icon-like cue
- collected item progress in an item progress chip with an item icon-like cue
- current score
- run outcome/status in an outcome badge with a status icon-like cue
- current objective, cooldown, and lock/combat status

`GameSession.gd` owns the HUD data. It builds a payload from session state and calls `HudOverlay.set_hud_state()` when levels load, HP changes, ability or item state changes, doors transition, or a run finishes. Score is deterministic and trace-friendly: items, completed levels, defeated groups, defeated bosses, remaining HP, and revive stock contribute through `calculate_total_score()`.

The same payload is emitted as `hud.updated` trace events. `trace:summary` records the latest HUD payload as `last_hud`, so agents can compare what the player would see against replay outcomes and save/trace state.

The visual contract is covered by the Godot visual snapshot suite. HUD snapshots should include the top bar frame, HP bar, ability chip, item progress, score chip, objective text, cooldown, status, and icon-like cues without cropped or overlapping text at the configured viewport.

`InventoryOverlay.gd` remains the companion debug/progress readout. It displays collected item ids, current ability, completed level count, and visited level count from the same `GameSession` state that is saved and replay-traced.

Inventory changes emit `inventory.updated` trace events. `trace:summary` records the latest inventory payload as `last_inventory`, including `items_collected`, `ability_type`, `completed_level_ids`, `visited_level_ids`, and `unlocked_door_ids`.

## docs/godot-v2/pause-overlay.md

# Godot v2 Pause Overlay

`PauseOverlay.gd` is the minimal pause menu contract for the Godot mainline. It appears when `GameSession` receives the `pause_toggle` action, which is bound to Esc.

The pause state remains session-owned so replay can pause and resume deterministically, but the visible menu now instantiates `PauseScene.gd` by default through `GameSession.pause_scene_enabled`. `PauseScene.gd` extends `PauseOverlay.gd`, keeps the existing labels and input hierarchy, and adds a canvas blur fallback background via `BlurFallback` when the session is paused.

When paused, the `pause_settings` action opens the existing `SettingsOverlay`; Enter is the default keyboard binding. ESC closes settings first and leaves the game paused, then a second ESC resumes gameplay. Settings replay actions remain active only while that pause settings menu is open.

The session emits `pause.toggled` with `is_paused`, `settings_open`, `pause_scene_active`, and `blur_active`. It also emits `pause.scene.shown` when the dedicated pause scene becomes visible, plus `pause.settings.opened` and `pause.settings.closed` for the settings hierarchy. `godot/tests/replays/pause_toggle_menu.json` covers pause/resume and the pause scene trace, and `godot/tests/replays/pause_settings_flow.json` covers opening settings from pause, changing a setting, closing settings, and resuming.

The in-run control guide is no longer a persistent corner overlay. `ControlGuideOverlay.gd` opens as an `initial_popup`, can be dismissed with the configured `control_guide_dismiss_action`, and `GameSession.gd` emits `control.guide.dismissed`. The ESC pause scene now keeps controls/help visible through `ControlsHelpLabel`, so discoverability lives in pause after the first popup is gone.

## docs/godot-v2/result-overlay.md

# Godot v2 Result Overlay

`ResultOverlay.gd` is the run-end popup UI for the Godot mainline. It appears when a replay/session reaches a goal or ends in game-over, dims the playfield with `PopupBackdrop`, and frames the summary inside `ModalPanel` so it reads as a modal result card instead of loose HUD text.

Displayed state:

- outcome
- elapsed run time
- score
- remaining-life bonus
- collected item count
- restart prompt when the outcome is `game_over`
- continue prompt for moving to the dedicated results scene

`GameSession.gd` owns the data. It builds a result payload from the current session state, calls `ResultOverlay.set_result_state()`, and emits `result.overlay.shown`. The result payload includes the same deterministic score as the HUD plus the remaining-life bonus used inside that total.

Goal-door clears carry the same metrics earlier in the trace: `GoalDoorController.gd` emits `goal.door.entered`, and the matching `run.finished` payload includes elapsed time, frames, score, and remaining-life bonus before the overlay is shown.

For game-over results, the payload sets `restart_available`. `ResultOverlay` shows the restart prompt, and `GameSession` accepts `result_restart` to reload the current level, restore HP, hide the result overlay, emit `run.restart.selected`, and return the HUD to `outcome: running`. The restart replay keeps running after the first terminal state with `continue_after_finished`.

`trace:summary` records the latest result payload as `last_result_overlay`. This keeps result-screen checks available to agents without needing image recognition or manual UI inspection.

`ResultsScene.gd` is the dedicated final-results UI. It uses its own dim backdrop and modal panel rather than loose labels, so the final results read as a modal scene after the run-end overlay. `GameSession` shows it from the result overlay after `result_auto_results_delay_ms` or immediately when `result_continue` is pressed. It receives the same score, time, and remaining-life bonus payload plus `result_elapsed_ms` and `auto_delay_ms`, then emits `results.scene.shown`; `trace:summary` exposes that payload as `last_results_scene`.

The result overlay now carries the first Godot-owned presentation polish pass: `score_countup_ms` animates the visible score, `polish_transition_ms` fades the overlay in, and the session audio mix continues to emit `audio.mix.updated` when settings or menu state changes.

The popup contract is intentionally lightweight: clear and game-over both use the same backdrop, modal panel, score count-up, restart/continue labels, and trace-owned payload. Future results-scene polish should keep `result.overlay.shown` and `last_result_overlay` stable unless the trace contract is updated with tests.

## docs/godot-v2/runtime-error-overlay.md

# Godot v2 Runtime Error Overlay

`ErrorOverlay.gd` is the minimal recovery UI for runtime failures that stop a session before normal gameplay can continue.

Current trigger:

- `GameSession.start_session()` cannot load the requested level id.

Displayed state:

- runtime error title
- user-facing error message
- retry prompt when a retry target is available

`GameSession.gd` owns the error payload. It calls `ErrorOverlay.set_error_state()` and emits `runtime.error.shown` with the current outcome, requested level id, requested spawn id, reason, message, retry availability, and retry action. `trace:summary` records the latest payload as `last_runtime_error`.

Retry currently reuses `result_restart` by default through `error_retry_action`. Selecting it emits `runtime.error.retry_selected` before `GameSession` attempts to restart the requested level/spawn.

Headless replay still exits non-zero when the initial session cannot start; the error overlay trace is written before that exit so automated diagnosis can still see the player-facing recovery state.

## docs/godot-v2/save-persistence.md

# Godot v2 Save Persistence

Godot save persistence is intentionally minimal while the migration is still in progress. The first canonical save boundary stores progression state that replay traces can verify.

`SaveState.gd` owns the JSON shape:

- `version`
- `acquired_item_ids`
- `completed_level_ids`
- `visited_level_ids`
- `unlocked_door_ids`
- `consumed_heal_ids`
- `discovered_hidden_feature_ids`
- `completed_dead_end_ids`
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

`GameSession.gd` owns the gameplay connection. When `save_enabled` is true, session startup emits `save.loaded`. When a collectible grants a new item, `item.acquired` is emitted before the session writes the save file. Swallowing an enemy stores the current `ability_type`; loading a level records it in `visited_level_ids`, and entering a door records a stable `source_level_id:door_id` key in `unlocked_door_ids`. Hidden feature discovery records stable `feature_type:feature_id` keys in `discovered_hidden_feature_ids` so discovered hidden doors and collectibles stay visible and usable after reload. Heal markers record consumed ids in `consumed_heal_ids` so saved max-health and revive rewards cannot be collected again after reload, and dead-end rewards record `completed_dead_end_ids` so map completion markers persist across saved sessions. The session also records tile exploration as `explored_tiles`, using the Phaser-compatible shape `{ level_id: ["column,row"] }` from the player's current position and `exploration_tile_size`. Settings preserve the Phaser save shape for `volume`, `controls`, and `difficulty`, with the same basic sanitizing rules. HP changes, player position, and goal completion also write the save file and emit `save.written`. Read or write failures emit `save.error`.

`MapOverlay.gd` is the first minimal UI consumer of `explored_tiles`. `GameSession` creates it when `map_overlay_enabled` is true, syncs the current exploration payload into it, and emits `map.updated` when a new tile is discovered. The `map_toggle` action is bound to M and toggles the overlay visibility with a `map.toggled` trace event. The overlay draws explored tile rectangles, highlights the current level, and draws feature markers for current-level doors, heals, collectibles, hazards, ability gates, and goals. Feature markers carry `discovered` so known elements and still-unseen elements are visually distinct while replay/trace remains the authoritative validation path.

`SettingsOverlay.gd` is the gameplay settings menu consumer of the persisted settings payload. `GameSession` creates it when `settings_overlay_enabled` is true, keeps it hidden until `settings_menu` or pause settings opens it, syncs `volume`, `controls`, `difficulty`, `selected_setting_index`, and blur state, and emits `settings.updated` when settings replay actions change those values. The current replay actions are `settings_menu`, `settings_focus_next`, `settings_focus_previous`, `settings_volume_up`, `settings_volume_down`, `settings_cycle_controls`, and `settings_cycle_difficulty`. Opening from gameplay emits `settings.menu.opened`, focus movement emits `settings.focus.changed`, and closing emits `settings.menu.closed`. During pause, `pause_settings` opens this overlay, ESC closes it back to pause, and a second ESC resumes gameplay. The overlay uses `SettingsBlur.gdshader` for post-processing blur and `BlurFallback` for Canvas-compatible fallback dimming.

`VirtualControlsOverlay.gd` consumes the same `controls` setting. When `controls` changes to `touch`, `GameSession` shows the touch D-pad and Z/X/C action buttons after the settings menu closes and emits `virtual_controls.updated`; switching away from `touch` hides the overlay and releases any pressed virtual actions.

Saved player position is applied only when the saved `current_level_id` matches the level being started. This keeps explicit replay starts deterministic; a saved position from `goal_sanctum` will not be applied to a replay that starts in `mirror_corridor`.

Headless replay can use a deterministic save path:

```bash
npm run godot:replay -- --replay res://tests/replays/forest_reliquary_collectible.json --out /tmp/forest.ndjson --save /tmp/fake-kirdy-save.json
```

This is not the final save system. It does not yet persist a complete UI-facing profile.

## docs/godot-v2/virtual-controls.md

# Godot v2 Virtual Controls

`VirtualControlsOverlay.gd` provides the first Godot-owned touch control surface. It is enabled when the settings payload uses `controls: touch`.

The overlay uses a left-side D-pad for movement:

- `DpadLeftButton` -> `move_left`
- `DpadRightButton` -> `move_right`
- `DpadUpButton` -> `jump`

The right-side action cluster mirrors the keyboard controls:

- `ActionZButton` -> `use_ability`
- `ActionXButton` -> `swallow`
- `ActionCButton` -> `inhale`

Button press and release call `Input.action_press` and `Input.action_release`, so the player controller consumes the same canonical action names as keyboard and replay input. Pressed buttons also change their modulation so touch feedback is visible.

`GameSession.gd` owns visibility. It instantiates `VirtualControlsOverlay` when `virtual_controls_enabled` is true, shows it only while `setting_controls == "touch"` and gameplay is running, and hides it during pause or non-touch control modes. Visibility changes are traceable through `virtual_controls.updated`.

`godot/tests/replays/virtual_controls_touch_mode.json` switches controls from keyboard to touch through the settings action and verifies the trace event through the replay suite.

## docs/godot-v2/audio-polish.md

# Godot v2 Audio And Polish

`GameSession.gd` now routes the migrated BGM and SFX assets through one traceable mix contract.

Runtime mix controls:

- `bgm_volume_scale` keeps background music below gameplay effects.
- `sfx_volume_scale` caps combat and pickup cues below the user setting so migrated SE do not dominate the mix.
- `ability_sfx_volume_scale` gives ability attacks their own cap instead of reusing the generic SFX level.
- `ui_sfx_volume_scale` makes menu cues quieter than combat cues.
- `audio_ducking_volume_scale` lowers BGM while pause or settings UI is active.

`update_audio_mix()` applies the current settings volume, BGM/SFX scales, and ducking state to `BgmPlayer` and `SfxPlayer`. When replay evidence is useful it emits `audio.mix.updated` with `setting_volume`, `bgm_volume`, `sfx_volume`, `ui_sfx_volume`, `ability_sfx_volume`, `ducking_active`, and the triggering reason. `npm run godot:audio-audit -- --json` enforces the maximum SFX scale contract.

Pause, settings, focus movement, and settings changes play a short UI cue through `play_ui_sfx()`. Combat capture, swallow, spit, and ability attacks continue to use the migrated gameplay SFX.

Presentation polish is intentionally lightweight and Godot-owned. `PauseScene.gd`, `SettingsOverlay.gd`, and `ResultOverlay.gd` expose `polish_transition_ms` and use `create_tween()` for alpha/focus transitions. `ResultOverlay.gd` also exposes `score_countup_ms` and animates `displayed_score` before the final score settles.

## docs/godot-v2/performance-testing.md

# Godot v2 Performance Testing

The explicit performance gate is:

```bash
npm run godot:performance
```

The command reads `godot/tests/performance_budget.json`, imports the Godot project, and runs the selected representative replays headlessly. It checks:

- effective trace FPS against the 60 FPS target
- replay wall-clock runtime
- peak replay process RSS when the host exposes `/proc/<pid>/status`
- Godot import/load time
- trace output size

The check skips gracefully when Godot is not installed, matching the rest of the optional Godot executable gates. It is intentionally separate from `npm test` because performance measurements are environment-sensitive and slower than static migration contracts.

The explicit browser 60 FPS gate is:

```bash
npm run godot:web-performance
```

This command reads `godot/tests/web_performance_budget.json`, serves the Godot Web export from `dist/`, launches a local Chromium-compatible browser through the Chrome DevTools Protocol, and samples `requestAnimationFrame` timing. It checks:

- browser 60 FPS target through `min_browser_raf_fps`
- worst sampled frame duration through `max_browser_frame_ms`
- a short `warmup_ms` window before sampling so Godot Web boot and shader/resource initialization do not count as steady-state frame pacing
- that the exported page creates a canvas
- that the expected Godot Web export artifacts (`index.html`, JavaScript, `.wasm`, and `.pck`) are present

The browser gate skips gracefully when the Web export artifacts are missing or when a browser executable is unavailable. CI runs it after `npm run build:public`, so the gate is enforced where Godot export templates and browser tooling are available.

## docs/godot-v2/web-fallback.md

# Godot Web Fallback

The canonical browser build is still the Godot Web export. After a successful Web export, `scripts/export-godot.mjs` runs:

```bash
npm run godot:web-fallback
```

That installer injects `webgl-fallback.js` into `dist/index.html`. At runtime the script probes WebGL 2 with a temporary canvas. If WebGL 2 is available, it does nothing and the Godot canvas owns the page. The injected script is the Canvas 2D fallback boundary for unsupported browsers.

When WebGL 2 unavailable is detected, the script hides the Godot canvas and creates a `data-kirdy-canvas2d-fallback` canvas. The fallback draws a lightweight Canvas 2D compatibility scene with a clear message that a WebGL 2-capable browser is required for the playable Godot build. This keeps unsupported browsers from showing a blank page without reintroducing Phaser runtime dependencies.

The installer is idempotent so repeated export or deploy steps keep a single script tag.

## docs/godot-v2/usability-accessibility-testing.md

# Godot v2 Usability and Accessibility Testing

The explicit usability/accessibility gate is:

```bash
npm run godot:usability
```

The command reads `godot/tests/usability_accessibility_contract.json` and checks the current Godot-owned UI and input surface:

- keyboard mappings exist for core movement, combat, map, pause, and result actions
- representative replays cover difficulty, touch controls, pause, settings-from-pause, and restart flows
- visible UI scenes contain labels with text
- visual feedback paths exist for touch buttons, combat damage, and map completion
- minimap color roles are present and separated enough to avoid relying on a single indistinct hue
- tutorial size ratios keep the player, enemies, heal pickups, and item/door/goal markers readable against each other

This is a static contract, not a replacement for user research or full screen-reader support. It keeps the current Godot migration from regressing on the basic usability evidence that agents can verify quickly.