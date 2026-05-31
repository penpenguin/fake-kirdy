# Godot v2 HUD Overlay

`HudOverlay.gd` is the first minimal mainline HUD. It is intentionally small: it shows the state a player needs while testing the Godot build without porting the full Phaser UI stack.

Displayed state:

- current level id
- player HP and max HP
- current ability type
- collected item count
- current score
- run outcome

`GameSession.gd` owns the HUD data. It builds a payload from session state and calls `HudOverlay.set_hud_state()` when levels load, HP changes, ability or item state changes, doors transition, or a run finishes. Score is intentionally deterministic and trace-friendly: items, completed levels, defeated groups, defeated bosses, remaining HP, and revive stock contribute through `calculate_total_score()`.

The same payload is emitted as `hud.updated` trace events. `trace:summary` records the latest HUD payload as `last_hud`, so agents can compare what the player would see against replay outcomes and save/trace state.

`InventoryOverlay.gd` is the companion minimal inventory/progress readout. It displays collected item ids, current ability, completed level count, and visited level count from the same `GameSession` state that is saved and replay-traced.

Inventory changes emit `inventory.updated` trace events. `trace:summary` records the latest inventory payload as `last_inventory`, including `items_collected`, `ability_type`, `completed_level_ids`, `visited_level_ids`, and `unlocked_door_ids`.

The HUD remains compact, but audio/presentation polish now lives in the adjacent menu and result surfaces. See `audio-polish.md` for the traceable BGM/SFX mix, menu ducking, UI cues, and tween contracts shared by pause, settings, and results.
