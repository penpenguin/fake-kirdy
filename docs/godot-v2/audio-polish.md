# Godot v2 Audio And Polish

`GameSession.gd` now routes the migrated BGM and SFX assets through one traceable mix contract.

Runtime mix controls:

- `bgm_volume_scale` keeps background music below gameplay effects.
- `sfx_volume_scale` caps combat and pickup cues below the user setting so migrated SE do not dominate the mix.
- `ability_sfx_volume_scale` gives ability attacks their own cap instead of reusing the generic SFX level.
- `ui_sfx_volume_scale` makes menu cues quieter than combat cues.
- `audio_ducking_volume_scale` lowers BGM while pause or settings UI is active.

`update_audio_mix()` applies the current settings volume, BGM/SFX scales, and ducking state to `BgmPlayer` and `SfxPlayer`. When replay evidence is useful it emits `audio.mix.updated` with `setting_volume`, `bgm_volume`, `sfx_volume`, `ui_sfx_volume`, `ability_sfx_volume`, `ducking_active`, and the triggering reason. `npm run godot:audio-audit -- --json` enforces the maximum SFX scale contract.

Pause, settings, focus movement, and settings changes play a short UI cue through `play_ui_sfx()`. Combat capture, swallow, spit, and ability attacks continue to use the migrated gameplay SFX.

Presentation polish is intentionally lightweight and Godot-owned. `PauseScene.gd`, `SettingsOverlay.gd`, and `ResultOverlay.gd` expose `polish_transition_ms` and use `create_tween()` for alpha/focus transitions. `ResultOverlay.gd` also exposes `score_countup_ms` and animates `displayed_score` before the final score settles.
