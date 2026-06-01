import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readPackageScripts = (): Record<string, string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
};

const writeManifest = (path: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        canonical_asset_root: 'godot/resources/assets',
        assets: ['audio/sfx/ability-fire-attack.wav'],
      },
      null,
      2,
    )}\n`,
  );
};

const writeContract = (path: string, gameSessionPath: string, manifestPath: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        source_paths: {
          game_session: gameSessionPath,
          asset_manifest: manifestPath,
        },
        required_sfx_payload_keys: ['sfx_id', 'asset_path', 'source_event_type', 'category', 'volume'],
        required_mix_payload_keys: ['setting_volume', 'bgm_volume', 'sfx_volume', 'ui_sfx_volume', 'ducking_active', 'reason'],
        required_sfx_categories: ['attack'],
        required_sfx_events: [
          {
            id: 'fixture_fire_attack',
            category: 'attack',
            source_event_type: 'ability.used',
            stream_const: 'SfxAbilityFireAttack',
            asset_path: 'audio/sfx/ability-fire-attack.wav',
            required_source_markers: ['play_sfx(SfxAbilityFireAttack, -1.0, "ability.used", "attack")'],
          },
        ],
        required_mix_events: [
          {
            id: 'fixture_pause_ducking',
            reason: 'pause.toggled',
            requires_ducking: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot audio audit', () => {
  it('defines an audio audit command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:audio-audit']).toBe('node scripts/check-godot-audio-audit.mjs');
    expect(scripts['check:godot']).toContain('godot:audio-audit');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-audio-audit.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'audio_audit_contract.json'))).toBe(true);
  });

  it('passes a fixture that traces required SFX and mix events', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-audio-audit-'));
    const gameSessionPath = join(tempDir, 'GameSession.gd');
    const manifestPath = join(tempDir, 'asset_manifest.json');
    const contractPath = join(tempDir, 'audio_audit_contract.json');

    try {
      writeFileSync(
        gameSessionPath,
        `const SfxAbilityFireAttack = preload("res://resources/assets/audio/sfx/ability-fire-attack.wav")

func use_ability() -> void:
    play_sfx(SfxAbilityFireAttack, -1.0, "ability.used", "attack")

func update_audio_mix(reason: String = "audio.mix.updated", emit_trace: bool = false) -> void:
    var mix_payload := get_audio_mix_payload(reason)
    if emit_trace and trace_recorder != null:
        trace_recorder.call("record_event", "audio.mix.updated", mix_payload)

func get_audio_mix_payload(reason: String = "") -> Dictionary:
    var ducking_active := session_paused or settings_menu_open or pause_settings_open
    return {
        "setting_volume": setting_volume,
        "bgm_volume": bgm_volume,
        "sfx_volume": sfx_volume,
        "ui_sfx_volume": ui_sfx_volume,
        "ducking_active": ducking_active,
        "reason": reason,
    }

func play_sfx(stream: AudioStream, volume_scale: float = -1.0, source_event_type: String = "", category: String = "sfx") -> void:
    trace_recorder.call("record_event", "audio.sfx.played", {
        "sfx_id": get_sfx_id_for_stream(stream),
        "asset_path": get_sfx_asset_path_for_stream(stream),
        "source_event_type": source_event_type,
        "category": category,
        "volume": 1.0,
    })
`,
      );
      writeManifest(manifestPath);
      writeContract(contractPath, gameSessionPath, manifestPath);

      const result = spawnSync(process.execPath, ['scripts/check-godot-audio-audit.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        sfx_event_count: number;
        coverage: Record<string, number>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.sfx_event_count).toBe(1);
      expect(report.coverage.attack).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when SFX playback is not traceable', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-audio-audit-missing-trace-'));
    const gameSessionPath = join(tempDir, 'GameSession.gd');
    const manifestPath = join(tempDir, 'asset_manifest.json');
    const contractPath = join(tempDir, 'audio_audit_contract.json');

    try {
      writeFileSync(
        gameSessionPath,
        `const SfxAbilityFireAttack = preload("res://resources/assets/audio/sfx/ability-fire-attack.wav")

func use_ability() -> void:
    play_sfx(SfxAbilityFireAttack, -1.0, "ability.used", "attack")

func play_sfx(stream: AudioStream, volume_scale: float = -1.0, source_event_type: String = "", category: String = "sfx") -> void:
    sfx_player.play()
`,
      );
      writeManifest(manifestPath);
      writeContract(contractPath, gameSessionPath, manifestPath);

      const result = spawnSync(process.execPath, ['scripts/check-godot-audio-audit.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          rule: 'missing_sfx_trace',
        }),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('audio.sfx.played');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical attack, damage, defeat, acquire, door, lock, UI, and mix audio coverage', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-audio-audit.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      sfx_event_count: number;
      mix_event_count: number;
      coverage: Record<string, number>;
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.sfx_event_count).toBeGreaterThanOrEqual(8);
    expect(report.mix_event_count).toBeGreaterThanOrEqual(4);
    expect(report.coverage).toMatchObject({
      attack: expect.any(Number),
      damage: expect.any(Number),
      defeat: expect.any(Number),
      acquire: expect.any(Number),
      door: expect.any(Number),
      lock: expect.any(Number),
      ui: expect.any(Number),
    });
  });

  it('guards locked-door SFX from replaying every overlapped frame', () => {
    const session = readFileSync(join(repoRoot, 'godot', 'scripts', 'session', 'GameSession.gd'), 'utf8');

    expect(session).toContain('var last_locked_door_audio_key: String = ""');
    expect(session).toContain('last_locked_door_audio_key = ""');
    expect(session).toContain('var locked_door_audio_key := "%s:%s:%s" % [source_level_id, door_id, lock_reason]');
    expect(session).toContain('if last_locked_door_audio_key != locked_door_audio_key:');
    expect(session).toContain('last_locked_door_audio_key = locked_door_audio_key');
  });
});
