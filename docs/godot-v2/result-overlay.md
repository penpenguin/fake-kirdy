# Godot v2 Result Overlay

`ResultOverlay.gd` is the minimal run-end UI for the Godot mainline. It appears when a replay/session reaches a goal or ends in game-over.

Displayed state:

- outcome
- elapsed run time
- score
- remaining-life bonus
- collected item count
- restart prompt when the outcome is `game_over`

`GameSession.gd` owns the data. It builds a result payload from the current session state, calls `ResultOverlay.set_result_state()`, and emits `result.overlay.shown`. The result payload includes the same deterministic score as the HUD plus the remaining-life bonus used inside that total.

Goal-door clears carry the same metrics earlier in the trace: `GoalDoorController.gd` emits `goal.door.entered`, and the matching `run.finished` payload includes elapsed time, frames, score, and remaining-life bonus before the overlay is shown.

For game-over results, the payload sets `restart_available`. `ResultOverlay` shows the restart prompt, and `GameSession` accepts `result_restart` to reload the current level, restore HP, hide the result overlay, emit `run.restart.selected`, and return the HUD to `outcome: running`. The restart replay keeps running after the first terminal state with `continue_after_finished`.

`trace:summary` records the latest result payload as `last_result_overlay`. This keeps result-screen checks available to agents without needing image recognition or manual UI inspection.

`ResultsScene.gd` is the dedicated final-results UI. `GameSession` shows it from the result overlay after `result_auto_results_delay_ms` or immediately when `result_continue` is pressed. It receives the same score, time, and remaining-life bonus payload and emits `results.scene.shown`; `trace:summary` exposes that payload as `last_results_scene`.

The result overlay now carries the first Godot-owned presentation polish pass: `score_countup_ms` animates the visible score, `polish_transition_ms` fades the overlay in, and the session audio mix continues to emit `audio.mix.updated` when settings or menu state changes.
