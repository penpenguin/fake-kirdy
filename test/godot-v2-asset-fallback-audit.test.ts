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

const writeFixtureManifest = (path: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        canonical_asset_root: 'assets',
        assets: [
          'images/characters/kirdy/kirdy-fire.webp',
          'images/characters/kirdy/kirdy-ice.webp',
          'images/enemies/wabble-bee.webp',
          'audio/sfx/ability-fire-attack.wav',
          'audio/sfx/ability-ice-attack.wav',
          'audio/sfx/kirdy-spit.wav',
        ],
      },
      null,
      2,
    )}\n`,
  );
};

const writeFixtureContract = (path: string, tempDir: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        source_paths: {
          player_controller: join(tempDir, 'PlayerController.gd'),
          game_session: join(tempDir, 'GameSession.gd'),
          asset_manifest: join(tempDir, 'asset_manifest.json'),
          source_roots: [join(tempDir, 'scenes'), join(tempDir, 'scripts')],
        },
        mainline_abilities: [
          {
            id: 'fire',
            aliases: ['flame'],
            texture_var: 'kirdy_fire_texture',
            allowed_sfx_streams: ['SfxAbilityFireAttack'],
          },
          {
            id: 'frost',
            aliases: ['ice'],
            texture_var: 'kirdy_ice_texture',
            allowed_sfx_streams: ['SfxAbilityIceAttack'],
          },
          {
            id: 'spark',
            texture_var: 'kirdy_ice_texture',
            allowed_sfx_streams: ['SfxKirdySpit'],
          },
        ],
        required_asset_paths: [
          'images/characters/kirdy/kirdy-fire.webp',
          'images/characters/kirdy/kirdy-ice.webp',
          'images/enemies/wabble-bee.webp',
          'audio/sfx/ability-fire-attack.wav',
          'audio/sfx/ability-ice-attack.wav',
          'audio/sfx/kirdy-spit.wav',
        ],
        primary_enemy_assets: ['images/enemies/wabble-bee.webp'],
        allowed_fallback_event_types: ['inhale.effect.fallback'],
        rules: {
          mainline_ability_texture: { severity: 'error' },
          mainline_ability_sfx: { severity: 'error' },
          ability_sfx_default_fire_fallback: { severity: 'error' },
          missing_asset_file: { severity: 'error' },
          resource_path_exists: { severity: 'error' },
          empty_label_text: { severity: 'error' },
          protected_fallback_event: { severity: 'warning' },
          unused_manifest_asset: { severity: 'warning' },
        },
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot asset fallback audit', () => {
  it('defines an asset fallback audit command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:asset-fallback-audit']).toBe('node scripts/check-godot-asset-fallback-audit.mjs');
    expect(scripts['check:godot']).toContain('godot:asset-fallback-audit');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-asset-fallback-audit.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'asset_fallback_audit_contract.json'))).toBe(true);
  });

  it('passes a fixture with explicit ability visuals, SFX mappings, labels, and resource paths', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-asset-fallback-audit-'));
    const assetsRoot = join(tempDir, 'assets');
    const scenesDir = join(tempDir, 'scenes');
    const scriptsDir = join(tempDir, 'scripts');
    const contractPath = join(tempDir, 'asset_fallback_audit_contract.json');

    try {
      writeFileSync(join(tempDir, 'asset_manifest.json'), '');
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'characters', 'kirdy')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'enemies')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'audio', 'sfx')]);
      spawnSync('mkdir', ['-p', scenesDir]);
      spawnSync('mkdir', ['-p', scriptsDir]);
      for (const asset of [
        'images/characters/kirdy/kirdy-fire.webp',
        'images/characters/kirdy/kirdy-ice.webp',
        'images/enemies/wabble-bee.webp',
        'audio/sfx/ability-fire-attack.wav',
        'audio/sfx/ability-ice-attack.wav',
        'audio/sfx/kirdy-spit.wav',
      ]) {
        writeFileSync(join(assetsRoot, asset), 'fixture');
      }
      writeFixtureManifest(join(tempDir, 'asset_manifest.json'));
      writeFileSync(
        join(tempDir, 'PlayerController.gd'),
        `func get_ability_texture(next_ability_type: String) -> Texture2D:
    match next_ability_type:
        "fire", "flame":
            return kirdy_fire_texture
        "ice", "frost":
            return kirdy_ice_texture
        "spark":
            return kirdy_ice_texture
        _:
            return null
`,
      );
      writeFileSync(
        join(tempDir, 'GameSession.gd'),
        `func get_ability_sfx(current_ability_type: String) -> AudioStream:
    match current_ability_type:
        "fire", "flame":
            return SfxAbilityFireAttack
        "ice", "frost":
            return SfxAbilityIceAttack
        "spark":
            return SfxKirdySpit
        _:
            return SfxKirdySpit
`,
      );
      writeFileSync(
        join(scenesDir, 'HudOverlay.tscn'),
        `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://resources/assets/images/enemies/wabble-bee.webp" id="1_enemy"]
[node name="StatusLabel" type="Label" parent="."]
text = "Ready"
`,
      );
      writeFileSync(join(scriptsDir, 'Marker.gd'), 'const EnemyTexture = preload("res://resources/assets/images/enemies/wabble-bee.webp")\n');
      writeFixtureContract(contractPath, tempDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-asset-fallback-audit.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        categories: Record<string, number>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.categories).toMatchObject({
        ability_assets: expect.any(Number),
        audio_assets: expect.any(Number),
        resource_paths: expect.any(Number),
        ui_labels: expect.any(Number),
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence for fallback-only mainline ability assets and fire-default SFX', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-asset-fallback-audit-broken-'));
    const assetsRoot = join(tempDir, 'assets');
    const scenesDir = join(tempDir, 'scenes');
    const contractPath = join(tempDir, 'asset_fallback_audit_contract.json');

    try {
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'characters', 'kirdy')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'enemies')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'audio', 'sfx')]);
      spawnSync('mkdir', ['-p', scenesDir]);
      writeFileSync(join(assetsRoot, 'images', 'characters', 'kirdy', 'kirdy-fire.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'characters', 'kirdy', 'kirdy-ice.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'enemies', 'wabble-bee.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'audio', 'sfx', 'ability-fire-attack.wav'), 'fixture');
      writeFileSync(join(assetsRoot, 'audio', 'sfx', 'ability-ice-attack.wav'), 'fixture');
      writeFileSync(join(assetsRoot, 'audio', 'sfx', 'kirdy-spit.wav'), 'fixture');
      writeFixtureManifest(join(tempDir, 'asset_manifest.json'));
      writeFileSync(
        join(tempDir, 'PlayerController.gd'),
        `func get_ability_texture(next_ability_type: String) -> Texture2D:
    match next_ability_type:
        "fire", "flame":
            return kirdy_fire_texture
        _:
            return null
`,
      );
      writeFileSync(
        join(tempDir, 'GameSession.gd'),
        `func get_ability_sfx(current_ability_type: String) -> AudioStream:
    match current_ability_type:
        "ice", "frost":
            return SfxAbilityIceAttack
        _:
            return SfxAbilityFireAttack
`,
      );
      writeFileSync(
        join(scenesDir, 'HudOverlay.tscn'),
        `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://resources/assets/images/enemies/missing.webp" id="1_missing"]
[node name="EmptyLabel" type="Label" parent="."]
text = ""
`,
      );
      writeFixtureContract(contractPath, tempDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-asset-fallback-audit.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; ability_id?: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'mainline_ability_texture', ability_id: 'frost' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'mainline_ability_sfx', ability_id: 'fire' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'ability_sfx_default_fire_fallback' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'resource_path_exists' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'empty_label_text' }));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical fallback, ability asset, audio, UI label, resource path, and unused asset coverage', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-asset-fallback-audit.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      warnings: unknown[];
      categories: Record<string, number>;
      mainline_abilities: { id: string; texture_status: string; sfx_status: string }[];
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.categories).toMatchObject({
      trace_fallbacks: expect.any(Number),
      ability_assets: expect.any(Number),
      audio_assets: expect.any(Number),
      ui_labels: expect.any(Number),
      resource_paths: expect.any(Number),
      unused_assets: expect.any(Number),
    });
    expect(report.mainline_abilities.map((ability) => ability.id)).toEqual(
      expect.arrayContaining(['fire', 'frost', 'sword', 'spark', 'leaf', 'stone']),
    );
    expect(report.mainline_abilities.every((ability) => ability.texture_status === 'explicit')).toBe(true);
    expect(report.mainline_abilities.every((ability) => ability.sfx_status === 'explicit')).toBe(true);
  });
});
