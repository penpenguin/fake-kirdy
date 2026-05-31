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
