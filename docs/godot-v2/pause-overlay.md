# Godot v2 Pause Overlay

`PauseOverlay.gd` is the minimal pause menu contract for the Godot mainline. It appears when `GameSession` receives the `pause_toggle` action, which is bound to Esc.

The pause state remains session-owned so replay can pause and resume deterministically, but the visible menu now instantiates `PauseScene.gd` by default through `GameSession.pause_scene_enabled`. `PauseScene.gd` extends `PauseOverlay.gd`, keeps the existing labels and input hierarchy, and adds a canvas blur fallback background via `BlurFallback` when the session is paused.

When paused, the `pause_settings` action opens the existing `SettingsOverlay`; Enter is the default keyboard binding. ESC closes settings first and leaves the game paused, then a second ESC resumes gameplay. Settings replay actions remain active only while that pause settings menu is open.

When paused outside the settings submenu, the `pause_reset` action resets Kirdy to the active safe spawn for the current level without clearing collected items, keys, completed levels, visited levels, score state, or save state. The session keeps the game paused, zeros player velocity, applies a short recovery window, and emits `pause.position_reset` with previous and reset positions for trace review.

The session emits `pause.toggled` with `is_paused`, `settings_open`, `pause_scene_active`, and `blur_active`. It also emits `pause.scene.shown` when the dedicated pause scene becomes visible, plus `pause.settings.opened` and `pause.settings.closed` for the settings hierarchy. `godot/tests/replays/pause_toggle_menu.json` covers pause/resume and the pause scene trace, and `godot/tests/replays/pause_settings_flow.json` covers opening settings from pause, changing a setting, closing settings, and resuming.

The in-run control guide is no longer a persistent corner overlay. `ControlGuideOverlay.gd` opens as an `initial_popup`, can be dismissed with the configured `control_guide_dismiss_action`, and `GameSession.gd` emits `control.guide.dismissed`. The ESC pause scene now keeps controls/help visible through `ControlsHelpLabel`, so discoverability lives in pause after the first popup is gone.
