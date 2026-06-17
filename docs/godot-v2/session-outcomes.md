# Session Outcomes

`GameSession.gd` owns the minimal Godot mainline run outcome state. A run currently ends by reaching the single authored completion goal in `goal_sanctum`, a generated terminal `GoalMarker`, or by player defeat.

## Death Flow

The player starts each replay/session with `player_max_hp`. Idle enemies can apply contact damage from `EnemySpawnMarker.contact_damage`, which is copied onto `SimpleEnemy.contact_damage` when the level loads.

Enemy spawning is capped by `GameSession.max_active_enemy_count`, currently 3. If a level contains more enemy markers than the cap, the session skips later markers and emits `enemy.spawn.skipped` so replay traces can verify the crowd-control rule.

Enemy crowding near Kirdy is also constrained. When at least two targetable enemies are within `enemy_crowd_player_radius`, `GameSession.apply_enemy_crowd_spacing()` pushes any enemy closer than `enemy_crowd_min_player_distance` back to that minimum and emits `enemy.crowd.spacing_applied` once for the level.

When contact damage is applied, the session emits:

- `player.damaged`
- `player.defeated` when HP reaches zero
- `game.over`
- `run.finished` with `outcome: game_over`

If `player_revive_count` is greater than zero when HP reaches zero, the session consumes one revive before game-over. That emits `player.revived`, restores HP to `player_max_hp`, writes save state when enabled, and lets the run continue. A later lethal hit with no revive left follows the normal game-over flow.

`danger_room_game_over.json` is the smallest replay fixture for this flow. It loads `danger_room`, moves into a high-damage enemy, and should finish with `game.over` and `run.finished`.

`game_over_restart_option.json` keeps replay input active after the first finished state with `continue_after_finished`. It presses `result_restart`, emits `run.restart.selected`, reloads the current level, restores HP, and continues until `replay.max_frames_reached` with the HUD back to `outcome: running`.

`game_over_no_auto_results.json` keeps a game-over replay active without pressing result controls. It forbids `results.scene.shown`, proving game-over remains on the restart-capable result overlay instead of being covered by the full results scene.

## Heal Flow

`HealMarker` metadata is consumed by `GameSession.gd`. When the player overlaps a heal marker, the session records the marker id in `consumed_heal_ids`, hides that heal marker's scene node and `Visual`, emits `heal.collected`, and applies the marker `reward_type`. Reloading a level reapplies `consumed_heal_ids`, so previously consumed heals stay visually gone and cannot look collectible again.

The current reward types are:

- `health`: restore HP by `amount`; emits `player.healed` when HP changes.
- `max-health`: increase `player_max_hp` by `amount`, heal by the same amount, emit `player.max_hp_increased`, and write the new max HP through the save path when save is enabled.
- `revive`: increase `player_revive_count` by `amount`, emit `player.revive_acquired`, and write the new revive count through the save path when save is enabled.

Enemy contact damage uses a `player_invulnerability_ms` window so a single enemy does not drain all HP every physics frame. The default recovery is now 2000ms with blinking translucent player feedback. The session emits `player.invulnerability.started` and `player.invulnerability.ended`, and the `player.damaged` payload includes `invulnerability_remaining_ms` so replay traces can prove repeated contact during the recovery window does not stack damage.

`heal_room_recover_and_goal.json` loads `heal_room`, takes one enemy contact hit, collects `heal_room_recovery`, and ends by `replay.max_frames_reached` so heal behavior is validated without adding another authored completion goal.

`central_hub_dead_end_max_health.json` starts at the `central_hub` dead-end max-health marker, collects `central_hub_dead_end_max_health`, emits `player.max_hp_increased`, and ends by `replay.max_frames_reached`. The replay is intentionally short so it validates pickup/session/save behavior without drifting into a nearby hub door.

Dead-end reward markers can also set `dead_end_id`. Collecting such a reward emits `dead_end.completed`, records the id in session state, and updates the map feature payload so the minimap can render the completed dead end separately from ordinary heal markers.

`revive_room_revive_then_game_over.json` collects `revive_room_dead_end_revive`, emits `player.revive_acquired`, survives the first lethal enemy contact through `player.revived`, then reaches a later lethal contact and emits the normal game-over trace once the revive count is empty.

## Collectible Flow

`CollectibleMarker` metadata is also consumed by `GameSession.gd`. When the player overlaps a collectible marker, the session records the marker id in `collected_collectible_ids` and emits `collectible.collected` with both `collectible_id` and `item_id`.

The session also tracks acquired item ids in `acquired_item_ids`. A newly acquired item emits `item.acquired` with the collected item id and the sorted `items_collected` list. When `save_enabled` is true, those ids are loaded from and written to the minimal Godot save store alongside current level id, HP, max HP, completed level ids, visited level ids, unlocked door ids, explored tiles, player position, current ability type, and the minimal settings payload.

The `*_reliquary_collectible.json` replays load `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`, walk into the room keystone, and leave trace events that can be summarized by `npm run trace:summary`.

Cluster progression is enforced by `GameSession.get_cluster_transition_lock_reason()`. `LevelLoader.get_level_cluster()` resolves authored cluster tags and generated `metadata.cluster`, then cross-cluster door transitions require the previous cluster keystone: ice requires `forest-keystone`, fire requires `ice-keystone`, ruins requires `fire-keystone`, and sky requires `cave-keystone`. Missing requirements emit `door.locked` with `missing_cluster_keystone:<item_id>`. `central_hub_ice_gate_without_keystone.json` validates that the hub ice door remains locked before the forest keystone, while the sky generated goal replay seeds the completed keystone chain explicitly through replay `initial_item_ids`.

## Boss Orb Flow

`EnemySpawnMarker` can set `boss_id` and `orb_reward_item_id` for boss encounters. When a damage action defeats such an enemy, `GameSession` records the boss id in `defeated_boss_ids`, emits `enemy.defeated`, then emits `boss.defeated` with the boss id, enemy group id, and orb reward id. If the reward id is non-empty, the session uses the normal `acquire_item()` path so the orb is saved, traced as `item.acquired`, reflected in inventory, and included in HUD `acquired_orb_ids`.

The mainline boss-orb rooms now follow the same contract for forest, ice, fire, ruins, and sky. The boss ids are `forest_guard_boss`, `ice_guard_boss`, `fire_guard_boss`, `ruins_guard_boss`, and `sky_guard_boss`; their orb rewards are `forest-orb`, `ice-orb`, `fire-orb`, `cave-orb`, and `sky-orb`. Each Central return door requires both the matching defeated boss id and the matching orb item id, so a player cannot use the return shortcut before defeating the boss and receiving the orb.

`forest_reliquary_boss_orb_return.json` is the first representative replay for this contract. It defeats `forest_guard_boss`, awards `forest-orb`, updates the HUD orb payload, and uses `forest_reliquary_return_to_central_hub` to return to `central_hub`. `ice_reliquary_boss_orb_return.json` repeats the same runtime proof outside the forest route by defeating `ice_guard_boss`, awarding `ice-orb`, and returning through `ice_reliquary_return_to_central_hub`.

## Goal Flow

Goal completion remains separate: touching a `GoalMarker` emits `run.finished` with the goal metadata payload. Hand-authored content keeps a single authored completion goal in `goal_sanctum`; focused rooms validate combat, healing, and doors without local completion goals. Generated terminal rooms may still materialize a `GoalMarker` from schema data.

The canonical goal path uses `GoalDoorController.gd`, a thin `GoalMarker` specialization with the dedicated `goal-marker.webp` visual contract. `goal_sanctum.tscn` uses it for `goal_sanctum_clear`. Reaching that controller emits `goal.door.entered` before `run.finished`; both payloads include `time_ms`, `frames`, `score`, and `remaining_life_bonus` so trace review can compare the physical goal clear with result UI metrics.

When save is enabled, touching a `GoalMarker` also records the current level in `completed_level_ids` before `run.finished`.

Game-over runs call `ResultOverlay.set_result_state()` and emit `result.overlay.shown`. The overlay payload carries the level id, outcome, run time, frame count, collected item ids, and completed level ids. `trace:summary` exposes the latest payload as `last_result_overlay` so replay review can compare the player-facing failure screen with `run.finished` and save state.

Completed runs go directly to the dedicated `ResultsScene` and emit `results.scene.shown`, which `trace:summary` exposes as `last_results_scene`. This avoids stacking a `Run Complete` overlay and a `Results` scene for the same goal clear. Game-over outcomes are intentionally excluded from this transition.

Result menu input remains active after the full results scene is visible. `results_scene_restart.json` presses `result_restart`; the session emits `results.scene.hidden` and `run.restart.selected` before returning the HUD to `outcome: running`.

The full results scene also supports continuing back to the hub. `results_scene_continue_to_hub.json` presses `result_continue` after `ResultsScene` is visible, emits `results.continue.selected`, hides the results scene, loads `central_hub/default`, and verifies that normal movement/jump input is live again with the HUD at `outcome: running`.

## Runtime Error Flow

If a session cannot load its requested level, `GameSession` records the existing `replay.error`, switches the outcome to `error`, and shows `ErrorOverlay.gd`. The overlay receives the requested level/spawn, a user-facing message, and retry metadata.

The same path emits `runtime.error.shown`; `trace:summary` exposes the latest payload as `last_runtime_error`. Pressing the configured `error_retry_action` records `runtime.error.retry_selected` before attempting to restart the requested session.

All flows use the same trace schema so metrics can compare completed runs, game-over runs, and replay failures without special parsing.

## HUD Flow

`HudOverlay.gd` is the first minimal player-facing HUD for the Godot mainline. `GameSession` creates it when `hud_overlay_enabled` is true and syncs level id, HP, max HP, revive count, ability type, collected item ids, and outcome.

The HUD also receives `orb_item_ids` and `acquired_orb_ids`, letting the visible `ORBS` row show acquired orbs and missing-orb silhouettes without relying on the removed constant run/status fields.

Each meaningful HUD state change can emit `hud.updated`. `trace:summary` exposes the latest HUD payload as `last_hud`, including orb ids, which lets replay review compare player-facing state with save, combat, item, and outcome events.
