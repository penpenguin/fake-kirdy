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

const readWebpInfo = (relativePath: string): { width: number; height: number; hasAlpha: boolean } => {
  const data = readFileSync(join(repoRoot, relativePath));
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${relativePath} is not a WebP file`);
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkType = data.toString('ascii', offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkType === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(chunkStart + 4, 3),
        height: 1 + data.readUIntLE(chunkStart + 7, 3),
        hasAlpha: (data[chunkStart] & 0x10) !== 0,
      };
    }
    if (chunkType === 'VP8L') {
      const bits = data.readUInt32LE(chunkStart + 1);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
        hasAlpha: true,
      };
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  throw new Error(`${relativePath} has no supported VP8X/VP8L dimension chunk`);
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
          'images/world/wall-texture.webp',
          'images/world/brick-tile.webp',
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
          level_visual_assets: join(tempDir, 'LevelVisualAssets.gd'),
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
        level_visuals: {
          required_polygon_name_terms: ['floor', 'platform', 'step', 'wall'],
          required_texture_assets: [
            {
              texture_const: 'WallTexture',
              asset_path: 'images/world/wall-texture.webp',
            },
            {
              texture_const: 'BrickTileTexture',
              asset_path: 'images/world/brick-tile.webp',
            },
          ],
        },
        primary_enemy_assets: ['images/enemies/wabble-bee.webp'],
        allowed_fallback_event_types: ['inhale.effect.fallback'],
        rules: {
          mainline_ability_texture: { severity: 'error' },
          mainline_ability_sfx: { severity: 'error' },
          ability_sfx_default_fire_fallback: { severity: 'error' },
          missing_asset_file: { severity: 'error' },
          resource_path_exists: { severity: 'error' },
          missing_level_texture_asset: { severity: 'error' },
          missing_level_texture_mapping: { severity: 'error' },
          missing_level_visual_polygon_term: { severity: 'error' },
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

  it('keeps Spark ability texture aligned with the existing Kirdy ability asset format', () => {
    const abilityAssetPaths = [
      'godot/resources/assets/images/characters/kirdy/kirdy-fire.webp',
      'godot/resources/assets/images/characters/kirdy/kirdy-ice.webp',
      'godot/resources/assets/images/characters/kirdy/kirdy-sword.webp',
      'godot/resources/assets/images/characters/kirdy/kirdy-spark.webp',
    ];
    const infos = abilityAssetPaths.map(readWebpInfo);
    const sparkInfo = infos.at(-1);
    const manifest = readFileSync(join(repoRoot, 'godot', 'resources', 'assets', 'asset_manifest.json'), 'utf8');
    const playerScene = readFileSync(join(repoRoot, 'godot', 'scenes', 'player', 'Player.tscn'), 'utf8');

    expect(new Set(infos.map((info) => `${info.width}x${info.height}`))).toEqual(new Set(['64x64']));
    expect(sparkInfo?.hasAlpha).toBe(true);
    expect(manifest).toContain('images/characters/kirdy/kirdy-spark.webp');
    expect(playerScene).toContain('path="res://resources/assets/images/characters/kirdy/kirdy-spark.webp"');
  });

  it('keeps Spark as a Kirdy-format WebP companion without requiring pixel decoding', () => {
    const idlePath = 'godot/resources/assets/images/characters/kirdy/kirdy-idle.webp';
    const sparkPath = 'godot/resources/assets/images/characters/kirdy/kirdy-spark.webp';
    const idleInfo = readWebpInfo(idlePath);
    const sparkInfo = readWebpInfo(sparkPath);
    const idleBytes = readFileSync(join(repoRoot, idlePath));
    const sparkBytes = readFileSync(join(repoRoot, sparkPath));

    expect(sparkInfo.width).toBe(idleInfo.width);
    expect(sparkInfo.height).toBe(idleInfo.height);
    expect(sparkInfo.hasAlpha).toBe(true);
    expect(sparkBytes.equals(idleBytes)).toBe(false);
    expect(sparkBytes.byteLength).toBeGreaterThan(1024);
    expect(sparkBytes.byteLength).toBeLessThan(16 * 1024);
  });

  it('audits every checked-in effect image as a live action effect asset', () => {
    const requiredEffectAssets = [
      'images/effects/fire-attack.webp',
      'images/effects/ice-attack.webp',
      'images/effects/inhale-sparkle.webp',
      'images/effects/spark-attack.webp',
      'images/effects/star-bullet.webp',
      'images/effects/sword-slash.webp',
    ];
    const manifest = readFileSync(join(repoRoot, 'godot', 'resources', 'assets', 'asset_manifest.json'), 'utf8');
    const contract = JSON.parse(readFileSync(join(repoRoot, 'godot', 'tests', 'asset_fallback_audit_contract.json'), 'utf8')) as {
      required_effect_assets?: string[];
    };
    const auditScript = readFileSync(join(repoRoot, 'scripts', 'check-godot-asset-fallback-audit.mjs'), 'utf8');
    const sourceText = [
      'godot/scripts/session/GameSession.gd',
      'godot/scripts/player/PlayerController.gd',
      'godot/scenes/player/Player.tscn',
    ].map((path) => readFileSync(join(repoRoot, path), 'utf8')).join('\n');

    expect(contract.required_effect_assets).toEqual(expect.arrayContaining(requiredEffectAssets));
    expect(auditScript).toContain('checkRequiredEffectAssets');
    for (const assetPath of requiredEffectAssets) {
      const fullPath = join(repoRoot, 'godot', 'resources', 'assets', assetPath);
      expect(existsSync(fullPath)).toBe(true);
      expect(manifest).toContain(assetPath);
      expect(sourceText).toContain(`res://resources/assets/${assetPath}`);
    }
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
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'world')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'audio', 'sfx')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'world')]);
      spawnSync('mkdir', ['-p', scenesDir]);
      spawnSync('mkdir', ['-p', scriptsDir]);
      for (const asset of [
        'images/characters/kirdy/kirdy-fire.webp',
        'images/characters/kirdy/kirdy-ice.webp',
        'images/enemies/wabble-bee.webp',
        'audio/sfx/ability-fire-attack.wav',
        'audio/sfx/ability-ice-attack.wav',
        'audio/sfx/kirdy-spit.wav',
        'images/world/wall-texture.webp',
        'images/world/brick-tile.webp',
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
        join(tempDir, 'LevelVisualAssets.gd'),
        `const WallTexture = preload("res://resources/assets/images/world/wall-texture.webp")
const BrickTileTexture = preload("res://resources/assets/images/world/brick-tile.webp")

func get_texture_for_level(level_id: String) -> Texture2D:
    if level_id.contains("hub") or level_id.contains("room"):
        return BrickTileTexture
    return WallTexture

func should_texture_polygon(polygon: Polygon2D) -> bool:
    var polygon_name := polygon.name.to_lower()
    return polygon_name.contains("floor") or polygon_name.contains("platform") or polygon_name.contains("step") or polygon_name.contains("wall")
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
        level_visuals: {
          polygon_terms: string[];
          texture_assets: { texture_const: string; asset_status: string; mapping_status: string }[];
        };
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.categories).toMatchObject({
        ability_assets: expect.any(Number),
        audio_assets: expect.any(Number),
        resource_paths: expect.any(Number),
        ui_labels: expect.any(Number),
        level_visual_assets: expect.any(Number),
      });
      expect(report.level_visuals.polygon_terms).toEqual(expect.arrayContaining(['floor', 'platform', 'step', 'wall']));
      expect(report.level_visuals.texture_assets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ texture_const: 'WallTexture', asset_status: 'present', mapping_status: 'used' }),
          expect.objectContaining({ texture_const: 'BrickTileTexture', asset_status: 'present', mapping_status: 'used' }),
        ]),
      );
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
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'world')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'audio', 'sfx')]);
      spawnSync('mkdir', ['-p', scenesDir]);
      writeFileSync(join(assetsRoot, 'images', 'characters', 'kirdy', 'kirdy-fire.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'characters', 'kirdy', 'kirdy-ice.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'enemies', 'wabble-bee.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'world', 'wall-texture.webp'), 'fixture');
      writeFileSync(join(assetsRoot, 'images', 'world', 'brick-tile.webp'), 'fixture');
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
        join(tempDir, 'LevelVisualAssets.gd'),
        `const WallTexture = preload("res://resources/assets/images/world/wall-texture.webp")
const BrickTileTexture = preload("res://resources/assets/images/world/brick-tile.webp")

func get_texture_for_level(level_id: String) -> Texture2D:
    if level_id.contains("hub") or level_id.contains("room"):
        return BrickTileTexture
    return WallTexture

func should_texture_polygon(polygon: Polygon2D) -> bool:
    var polygon_name := polygon.name.to_lower()
    return polygon_name.contains("floor") or polygon_name.contains("platform") or polygon_name.contains("step") or polygon_name.contains("wall")
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

  it('fails when level wall polygons are excluded from terrain texturing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-level-visual-audit-broken-'));
    const assetsRoot = join(tempDir, 'assets');
    const contractPath = join(tempDir, 'asset_fallback_audit_contract.json');

    try {
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'characters', 'kirdy')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'enemies')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'images', 'world')]);
      spawnSync('mkdir', ['-p', join(assetsRoot, 'audio', 'sfx')]);
      for (const asset of [
        'images/characters/kirdy/kirdy-fire.webp',
        'images/characters/kirdy/kirdy-ice.webp',
        'images/enemies/wabble-bee.webp',
        'audio/sfx/ability-fire-attack.wav',
        'audio/sfx/ability-ice-attack.wav',
        'audio/sfx/kirdy-spit.wav',
        'images/world/wall-texture.webp',
        'images/world/brick-tile.webp',
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
        "ice", "frost", "spark":
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
        join(tempDir, 'LevelVisualAssets.gd'),
        `const WallTexture = preload("res://resources/assets/images/world/wall-texture.webp")
const BrickTileTexture = preload("res://resources/assets/images/world/brick-tile.webp")

func get_texture_for_level(level_id: String) -> Texture2D:
    return WallTexture

func should_texture_polygon(polygon: Polygon2D) -> bool:
    var polygon_name := polygon.name.to_lower()
    return polygon_name.contains("floor") or polygon_name.contains("platform") or polygon_name.contains("step")
`,
      );
      writeFixtureContract(contractPath, tempDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-asset-fallback-audit.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; polygon_term?: string; texture_const?: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({ rule: 'missing_level_visual_polygon_term', polygon_term: 'wall' }),
      );
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
      warnings: { path?: string }[];
      categories: Record<string, number>;
      level_visuals: {
        polygon_terms: string[];
        texture_assets: { texture_const: string; asset_status: string; mapping_status: string }[];
      };
      mainline_abilities: { id: string; texture_status: string; sfx_status: string }[];
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.warnings.every((warning) => !warning.path || !warning.path.startsWith(repoRoot))).toBe(true);
    expect(report.categories).toMatchObject({
      trace_fallbacks: expect.any(Number),
      ability_assets: expect.any(Number),
      audio_assets: expect.any(Number),
      ui_labels: expect.any(Number),
      resource_paths: expect.any(Number),
      unused_assets: expect.any(Number),
      level_visual_assets: expect.any(Number),
    });
    expect(report.level_visuals.polygon_terms).toEqual(expect.arrayContaining(['floor', 'platform', 'step', 'wall']));
    expect(report.level_visuals.texture_assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ texture_const: 'WallTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'BrickTileTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'ForestTileTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'FireTileTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'IceTileTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'StoneTileTexture', asset_status: 'present', mapping_status: 'used' }),
        expect.objectContaining({ texture_const: 'RoyalTileTexture', asset_status: 'present', mapping_status: 'used' }),
      ]),
    );
    expect(report.mainline_abilities.map((ability) => ability.id)).toEqual(
      expect.arrayContaining(['fire', 'frost', 'sword', 'spark', 'leaf', 'stone']),
    );
    expect(report.mainline_abilities.every((ability) => ability.texture_status === 'explicit')).toBe(true);
    expect(report.mainline_abilities.every((ability) => ability.sfx_status === 'explicit')).toBe(true);
  });

  it('wires Spark to a dedicated Kirdy texture asset instead of reusing spit or fallback art', () => {
    const playerScene = readFileSync(join(repoRoot, 'godot', 'scenes', 'player', 'Player.tscn'), 'utf8');
    const playerController = readFileSync(join(repoRoot, 'godot', 'scripts', 'player', 'PlayerController.gd'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'godot', 'resources', 'assets', 'asset_manifest.json'), 'utf8')) as {
      assets?: string[];
    };
    const sparkAsset = join(repoRoot, 'godot', 'resources', 'assets', 'images', 'characters', 'kirdy', 'kirdy-spark.webp');

    expect(existsSync(sparkAsset)).toBe(true);
    expect(manifest.assets).toContain('images/characters/kirdy/kirdy-spark.webp');
    expect(playerScene).toContain('path="res://resources/assets/images/characters/kirdy/kirdy-spark.webp"');
    expect(playerScene).toContain('kirdy_spark_texture = ExtResource("13_spark")');
    expect(playerScene).not.toContain('kirdy_spark_texture = ExtResource("9_spit")');
    expect(playerController).toContain('"spark":');
    expect(playerController).toContain('return kirdy_spark_texture');
  });
});
