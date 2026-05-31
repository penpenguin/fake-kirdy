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
