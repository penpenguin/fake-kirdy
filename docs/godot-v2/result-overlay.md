# Godot v2 Result Overlay

`ResultOverlay.gd` is the game-over popup UI for the Godot mainline. It appears when a replay/session ends in game-over, dims the playfield with `PopupBackdrop`, and frames the summary inside `ModalPanel` so it reads as a modal result card instead of loose HUD text.

Displayed state:

- outcome
- elapsed run time
- score
- remaining-life bonus
- collected item count
- restart prompt when the outcome is `game_over`

`GameSession.gd` owns the data. For game-over it builds a result payload from the current session state, calls `ResultOverlay.set_result_state()`, and emits `result.overlay.shown`. The result payload includes the same deterministic score as the HUD plus the remaining-life bonus used inside that total.

Goal clears carry the same metrics earlier in the trace: `GoalDoorController.gd` emits `goal.door.entered`, and the matching `run.finished` payload includes elapsed time, frames, score, and remaining-life bonus before the dedicated results scene is shown.

For game-over results, the payload sets `restart_available`. `ResultOverlay` shows the restart prompt, and `GameSession` accepts `result_restart` to reload the current level, restore HP, hide the result overlay, emit `run.restart.selected`, and return the HUD to `outcome: running`. The restart replay keeps running after the first terminal state with `continue_after_finished`.

`trace:summary` records the latest result payload as `last_result_overlay`. This keeps result-screen checks available to agents without needing image recognition or manual UI inspection.

`ResultsScene.gd` is the dedicated final-results UI for completed runs. It uses its own dim backdrop and modal panel rather than loose labels, and `GameSession` shows it directly when the outcome is `completed`/`complete`. It receives the same score, time, and remaining-life bonus payload, then emits `results.scene.shown`; `trace:summary` exposes that payload as `last_results_scene`.

The result overlay now carries the first Godot-owned presentation polish pass: `score_countup_ms` animates the visible score, `polish_transition_ms` fades the overlay in, and the session audio mix continues to emit `audio.mix.updated` when settings or menu state changes.

The popup contract is intentionally lightweight: game-over uses `result.overlay.shown` and the trace-owned result payload. Completed clears use `results.scene.shown` directly, so the player does not see both `Run Complete` and `Results` for the same goal. Game-over stays on the result overlay with restart available; it must not auto-cover the game-over overlay with `ResultsScene`.
