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
