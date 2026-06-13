import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotAssetRoot = join(repoRoot, 'godot', 'resources', 'assets');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

const readWebpPixels = (relativePath: string): { width: number; height: number; pixels: Buffer } => {
  const assetPath = join(godotAssetRoot, relativePath);
  const probe = execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    assetPath,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-',
  ]);
  const dimensions = readWebpDimensions(assetPath);
  return { ...dimensions, pixels: probe };
};

const readWebpDimensions = (assetPath: string): { width: number; height: number } => {
  const buffer = readFileSync(assetPath);
  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  const startCode = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  if (startCode < 0) {
    throw new Error(`Unsupported WebP header for ${assetPath}`);
  }

  return {
    width: buffer.readUInt16LE(startCode + 3) & 0x3fff,
    height: buffer.readUInt16LE(startCode + 5) & 0x3fff,
  };
};

const countMatchingPixels = (
  image: { pixels: Buffer },
  predicate: (r: number, g: number, b: number, a: number) => boolean,
): number => {
  let count = 0;
  for (let index = 0; index < image.pixels.length; index += 4) {
    if (
      predicate(
        image.pixels[index] ?? 0,
        image.pixels[index + 1] ?? 0,
        image.pixels[index + 2] ?? 0,
        image.pixels[index + 3] ?? 0,
      )
    ) {
      count += 1;
    }
  }
  return count;
};

describe('Godot v2 assets', () => {
  it('tracks canonical assets from a Godot-owned manifest', () => {
    const manifest = JSON.parse(readFileSync(join(godotAssetRoot, 'asset_manifest.json'), 'utf8')) as {
      version?: number;
      canonical_asset_root?: string;
      assets?: string[];
    };

    expect(manifest.version).toBe(1);
    expect(manifest.canonical_asset_root).toBe('godot/resources/assets');
    expect(manifest.assets?.length).toBeGreaterThanOrEqual(30);
    expect(manifest.assets).toEqual(
      expect.arrayContaining([
        'audio/bgm-main.wav',
        'audio/sfx/kirdy-inhale.wav',
        'images/characters/kirdy/kirdy-idle.webp',
        'images/enemies/wabble-bee.webp',
        'images/enemies/blaze-imp.webp',
        'images/enemies/dronto-durt.webp',
        'images/enemies/frost-flutter.webp',
        'images/enemies/leaf-sprout.webp',
        'images/items/heal-orb.webp',
        'images/ui/door-marker.webp',
        'images/ui/goal-door.webp',
        'images/world/forest-tile.webp',
      ]),
    );

    manifest.assets?.forEach((assetPath) => {
      expect(existsSync(join(godotAssetRoot, assetPath)), assetPath).toBe(true);
      expect(existsSync(join(godotAssetRoot, `${assetPath}.import`)), `${assetPath}.import`).toBe(true);
    });
  });

  it('renders the player from Kirdy textures instead of a polygon placeholder', () => {
    const scene = readGodotFile('scenes/player/Player.tscn');
    const controller = readGodotFile('scripts/player/PlayerController.gd');

    [
      'kirdy-idle.webp',
      'kirdy-run.webp',
      'kirdy-jump.webp',
      'kirdy-hover.webp',
      'kirdy-inhale.webp',
      'kirdy-swallow.webp',
      'kirdy-spit.webp',
      'kirdy-fire.webp',
      'kirdy-ice.webp',
      'kirdy-leaf.webp',
      'kirdy-sword.webp',
    ].forEach((fileName) => {
      expect(scene).toContain(fileName);
    });

    expect(scene).toContain('[node name="Body" type="Sprite2D" parent="."]');
    expect(scene).not.toContain('[node name="Body" type="Polygon2D" parent="."]');
    expect(controller).toContain('update_visual_state');
    expect(controller).toContain('kirdy_hover_texture');
    expect(controller).toContain('kirdy_leaf_texture');
    expect(controller).toContain('ability_type');
  });

  it('keeps the leaf Kirdy sprite recognisable as the base Kirdy with leaf elements added', () => {
    const idle = readWebpPixels('images/characters/kirdy/kirdy-idle.webp');
    const leaf = readWebpPixels('images/characters/kirdy/kirdy-leaf.webp');

    expect(leaf.width).toBe(idle.width);
    expect(leaf.height).toBe(idle.height);

    const redBodyPixels = countMatchingPixels(leaf, (r, g, b, a) => a > 180 && r > 120 && g < 95 && b < 85);
    const goldStarPixels = countMatchingPixels(leaf, (r, g, b, a) => a > 180 && r > 150 && g > 100 && b < 70);
    const greenLeafPixels = countMatchingPixels(leaf, (r, g, b, a) => a > 180 && g > 95 && r < 125 && b < 95);

    expect(redBodyPixels).toBeGreaterThanOrEqual(350);
    expect(goldStarPixels).toBeGreaterThanOrEqual(24);
    expect(greenLeafPixels).toBeGreaterThanOrEqual(70);
  });

  it('falls back safely when ability-specific Kirdy textures are unavailable', () => {
    const controller = readGodotFile('scripts/player/PlayerController.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(controller).toContain('@export var ability_texture_fallback_enabled: bool = true');
    expect(controller).toContain('func get_ability_texture(next_ability_type: String) -> Texture2D:');
    expect(controller).toContain('func get_ability_fallback_texture() -> Texture2D:');
    expect(controller).toContain('func emit_ability_texture_fallback(next_ability_type: String, fallback_texture: Texture2D) -> void:');
    expect(controller).toContain('"fire", "burn"');
    expect(controller).toContain('"ice", "frost"');
    expect(controller).toContain('"sword", "blade"');
    expect(controller).toContain('"leaf"');
    expect(controller).toContain('return kirdy_leaf_texture');
    expect(controller).not.toContain('"leaf":\n            return kirdy_ice_texture');
    expect(controller).toContain('player.ability_texture.fallback');
    expect(controller).toContain('last_ability_texture_fallback_key');
    expect(suite.replays?.find((entry) => entry.id === 'spark_ability_dash_movement')?.expected_events).not.toContain(
      'player.ability_texture.fallback',
    );
  });

  it('renders combat actors, pickups, goals, and doors with migrated visual assets', () => {
    const simpleEnemyScene = readGodotFile('scenes/enemies/SimpleEnemy.tscn');
    const flyingEnemyScene = readGodotFile('scenes/enemies/FlyingEnemy.tscn');
    const doorMarker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const healMarker = readGodotFile('scripts/level/markers/HealMarker.gd');
    const collectibleMarker = readGodotFile('scripts/level/markers/CollectibleMarker.gd');
    const goalMarker = readGodotFile('scripts/level/markers/GoalMarker.gd');

    expect(simpleEnemyScene).toContain('wabble-bee.webp');
    expect(simpleEnemyScene).toContain('[node name="Body" type="Sprite2D" parent="."]');
    expect(flyingEnemyScene).toContain('frost-flutter.webp');
    expect(flyingEnemyScene).toContain('[node name="Body" type="Sprite2D" parent="."]');

    expect(doorMarker).toContain('door-marker.webp');
    expect(doorMarker).toContain('ensure_visual');
    expect(healMarker).toContain('heal-orb.webp');
    expect(healMarker).toContain('ensure_visual');
    expect(collectibleMarker).toContain('fire-artifact.webp');
    expect(collectibleMarker).toContain('ice-artifact.webp');
    expect(collectibleMarker).toContain('leaf-artifact.webp');
    expect(collectibleMarker).toContain('ruin-artifact.webp');
    expect(collectibleMarker).toContain('ensure_visual');
    expect(goalMarker).toContain('goal-door.webp');
    expect(goalMarker).toContain('ensure_visual');
  });

  it('applies migrated world textures and audio from the Godot runtime', () => {
    const visualAssets = readGodotFile('scripts/level/LevelVisualAssets.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    [
      'wall-texture.webp',
      'brick-tile.webp',
      'forest-tile.webp',
      'fire-tile.webp',
      'ice-tile.webp',
      'stone-tile.webp',
      'royal-tile.webp',
    ].forEach((fileName) => {
      expect(visualAssets).toContain(fileName);
    });

    [
      'bgm-main.wav',
      'kirdy-inhale.wav',
      'kirdy-swallow.wav',
      'kirdy-spit.wav',
      'ability-fire-attack.wav',
      'ability-ice-attack.wav',
      'ability-sword-attack.wav',
    ].forEach((fileName) => {
      expect(session).toContain(fileName);
    });

    expect(session).toContain('leaf-attack.webp');
    expect(session).not.toContain('"visual_effect": "leaf_cutter",\n                "effect_texture": "res://resources/assets/images/effects/star-bullet.webp"');

    expect(session).toContain('AudioStreamPlayer');
    expect(session).toContain('apply_to_level');
  });

  it('uses texture-backed Central and fire area visuals instead of placeholder polygons', () => {
    const centralHub = readGodotFile('levels/central_hub.tscn');
    const fireArea = readGodotFile('levels/fire_area.tscn');
    const visualAssets = readGodotFile('scripts/level/LevelVisualAssets.gd');

    expect(centralHub).not.toContain('[node name="CathedralNave" type="Polygon2D"');
    expect(visualAssets).toContain('if normalized_level_id == "central_hub":');
    expect(visualAssets).toContain('return RoyalBackgroundTexture');
    expect(fireArea).toContain('res://resources/assets/images/world/fire-tile.webp');
    expect(fireArea).toContain('texture = ExtResource("7_fire_tile")');
    expect(fireArea).not.toContain('color = Color(0.48, 0.26, 0.18, 1)');
  });

  it('imports Godot asset caches before headless replay commands use migrated resources', () => {
    const replayRunner = readFileSync(join(repoRoot, 'scripts', 'run-godot-replay.mjs'), 'utf8');
    const replaySuiteRunner = readFileSync(join(repoRoot, 'scripts', 'run-godot-replay-suite.mjs'), 'utf8');

    expect(replayRunner).toContain('ensureGodotImport');
    expect(replayRunner).toContain("'--import'");
    expect(replaySuiteRunner).toContain('ensureGodotImport');
    expect(replaySuiteRunner).toContain("'--import'");
  });
});
