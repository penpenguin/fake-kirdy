import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot v2 audio and presentation polish', () => {
  it('routes migrated audio through a traceable BGM/SFX mix with menu ducking', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const contract = JSON.parse(readGodotFile('tests/audio_audit_contract.json')) as {
      max_volume_scales?: {
        sfx?: number;
        ui_sfx?: number;
        ability_sfx?: number;
      };
    };
    const auditScript = readRepoFile('scripts/check-godot-audio-audit.mjs');

    expect(session).toContain('@export var bgm_volume_scale: float');
    expect(session).toContain('@export var sfx_volume_scale: float');
    expect(session).toContain('@export var ui_sfx_volume_scale: float');
    expect(session).toContain('@export var ability_sfx_volume_scale: float');
    expect(session).toContain('play_sfx(get_ability_sfx(String(player.ability_type)), ability_sfx_volume_scale, "ability.used", "attack")');
    expect(session).toContain('@export var audio_ducking_volume_scale: float');
    expect(session).toContain('func update_audio_mix(reason: String = "audio.mix.updated", emit_trace: bool = false) -> void:');
    expect(session).toContain('func get_audio_mix_payload(reason: String = "") -> Dictionary:');
    expect(session).toContain('"audio.mix.updated"');
    expect(session).toContain('"ducking_active"');
    expect(session).toContain('"ability_sfx_volume"');
    expect(session).toContain('"ability_sfx_volume_scale"');
    expect(session).toContain('session_paused or settings_menu_open or pause_settings_open');
    expect(session).toContain('play_ui_sfx');
    expect(session).toContain('update_audio_mix("pause.toggled", true)');
    expect(session).toContain('update_audio_mix(reason, true)');

    expect(contract.max_volume_scales?.sfx).toBeLessThanOrEqual(0.7);
    expect(contract.max_volume_scales?.ui_sfx).toBeLessThanOrEqual(0.5);
    expect(contract.max_volume_scales?.ability_sfx).toBeLessThanOrEqual(0.65);
    expect(auditScript).toContain('checkMaxVolumeScales');
  });

  it('adds tween-backed presentation contracts to pause, settings, and result overlays', () => {
    const pauseScene = readGodotFile('scripts/ui/PauseScene.gd');
    const settingsOverlay = readGodotFile('scripts/ui/SettingsOverlay.gd');
    const resultOverlay = readGodotFile('scripts/ui/ResultOverlay.gd');

    expect(pauseScene).toContain('@export var polish_transition_ms: int');
    expect(pauseScene).toContain('func animate_menu_polish(is_visible: bool) -> void:');
    expect(pauseScene).toContain('create_tween()');
    expect(pauseScene).toContain('"modulate:a"');

    expect(settingsOverlay).toContain('@export var polish_transition_ms: int');
    expect(settingsOverlay).toContain('@export var focus_pulse_scale: float');
    expect(settingsOverlay).toContain('func animate_menu_polish(is_visible: bool) -> void:');
    expect(settingsOverlay).toContain('func animate_focus_polish() -> void:');
    expect(settingsOverlay).toContain('create_tween()');

    expect(resultOverlay).toContain('@export var polish_transition_ms: int');
    expect(resultOverlay).toContain('@export var score_countup_ms: int');
    expect(resultOverlay).toContain('var displayed_score: int = 0');
    expect(resultOverlay).toContain('func animate_result_polish(is_visible: bool) -> void:');
    expect(resultOverlay).toContain('func animate_score_countup() -> void:');
    expect(resultOverlay).toContain('create_tween()');
  });

  it('documents the completed audio/polish scope without leaving prior deferred wording active', () => {
    const audioDocPath = join(repoRoot, 'docs', 'godot-v2', 'audio-polish.md');
    const hudDoc = readRepoFile('docs/godot-v2/hud-overlay.md');
    const resultDoc = readRepoFile('docs/godot-v2/result-overlay.md');

    expect(existsSync(audioDocPath)).toBe(true);
    expect(readFileSync(audioDocPath, 'utf8')).toContain('audio.mix.updated');
    expect(readFileSync(audioDocPath, 'utf8')).toContain('polish_transition_ms');
    expect(hudDoc).not.toContain('It avoids animation, audio, menus, and polished layout');
    expect(resultDoc).not.toContain('It intentionally avoids score animation, audio');
  });
});
