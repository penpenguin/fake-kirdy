# Godot v2 Result Overlay

`ResultOverlay.gd` is the minimal run-end UI for the Godot mainline. It appears when a replay/session reaches a goal or ends in game-over.

Displayed state:

- outcome
- elapsed run time
- collected item count

`GameSession.gd` owns the data. It builds a result payload from the current session state, calls `ResultOverlay.set_result_state()`, and emits `result.overlay.shown`.

`trace:summary` records the latest result payload as `last_result_overlay`. This keeps result-screen checks available to agents without needing image recognition or manual UI inspection.

This is not the final results screen. It intentionally avoids score animation, menus, audio, or a full inventory breakdown while replay, trace, and content parity are still evolving.
