# Godot UI, Save, Web, Performance Docs Summary

Updated from HUD, pause, result, runtime error, save, virtual controls, audio, performance, web fallback, and usability docs.

## HUD And Result UI

`HudOverlay.gd` displays level id, HP/max HP, ability, item progress, score, outcome/status, objective, cooldown, and lock/combat status. `GameSession.gd` owns payloads and emits `hud.updated`; `trace:summary` exposes `last_hud`.

`InventoryOverlay.gd` mirrors collected item ids, current ability, completed levels, visited levels, and unlocked doors through `inventory.updated` and `last_inventory`.

`ResultOverlay.gd` shows outcome, elapsed time, score, remaining-life bonus, collected item count, restart prompt, and continue prompt. It emits `result.overlay.shown`; `ResultsScene.gd` emits `results.scene.shown` and can continue back to the hub.

`ErrorOverlay.gd` shows runtime load failures and emits `runtime.error.shown`; retry emits `runtime.error.retry_selected`.

## Pause, Settings, And Virtual Controls

`PauseOverlay.gd` and `PauseScene.gd` handle pause/resume, settings-from-pause, and blur fallback. Trace events include `pause.toggled`, `pause.scene.shown`, `pause.settings.opened`, and `pause.settings.closed`.

`SettingsOverlay.gd` edits persisted `volume`, `controls`, and `difficulty`; replay actions include settings menu open/close, focus movement, volume changes, controls cycle, and difficulty cycle.

`VirtualControlsOverlay.gd` maps touch D-pad and action buttons to canonical input actions: `move_left`, `move_right`, `jump`, `use_ability`, `swallow`, and `inhale`. Visibility emits `virtual_controls.updated`.

## Save

`SaveState.gd` stores `version`, item ids, completed/visited levels, unlocked doors, consumed heals, discovered hidden features, completed dead ends, explored tiles, current level, HP/max HP, player position, ability type, and settings.

`SaveStore.gd` uses `FileAccess` outside Web, `localStorage["kirdy-save"]` on Web, and `sessionStorage["kirdy-save-temp"]` as fallback. Save traces include `save.loaded`, `save.written`, `save.local_storage.written`, `save.session_storage_fallback.written`, and `save.error`.

## Audio And Polish

`GameSession.gd` routes BGM/SFX through `update_audio_mix()`. Mix controls include BGM, SFX, ability SFX, UI SFX, and ducking scales. It can emit `audio.mix.updated`; `npm run godot:audio-audit -- --json` checks maximum SFX scale.

## Performance And Web

Performance gates:
- `npm run godot:performance`
- `npm run godot:web-performance`

The local replay performance gate checks trace FPS, replay wall time, process RSS where available, import/load time, and trace size. The web gate checks browser RAF FPS, worst sampled frame, warmup, canvas creation, and required Godot Web artifacts.

`npm run godot:web-fallback` injects `webgl-fallback.js` into `dist/index.html`. If WebGL 2 is unavailable, it hides the Godot canvas and shows a lightweight Canvas 2D compatibility scene.

## Usability/Accessibility Static Contract

`npm run godot:usability` checks keyboard mappings, representative replays, visible UI text, touch/combat/map feedback, minimap color-role separation, tutorial size ratios, HUD captions, readability envelope, and `central_hub` door support platforms.