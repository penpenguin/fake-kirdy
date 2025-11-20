import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/assets');

function expectWebpRelative(path: string) {
  const buf = readFileSync(resolve(ASSET_ROOT, path));
  expect(buf.length).toBeGreaterThan(24);
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WEBP');
}

describe('asset sprites (webp)', () => {
  const characters = [
    'images/characters/kirdy/kirdy.webp',
    'images/characters/kirdy/kirdy-idle.webp',
    'images/characters/kirdy/kirdy-run.webp',
    'images/characters/kirdy/kirdy-jump.webp',
    'images/characters/kirdy/kirdy-hover.webp',
    'images/characters/kirdy/kirdy-inhale.webp',
    'images/characters/kirdy/kirdy-swallow.webp',
    'images/characters/kirdy/kirdy-spit.webp',
    'images/characters/kirdy/kirdy-fire.webp',
    'images/characters/kirdy/kirdy-ice.webp',
    'images/characters/kirdy/kirdy-sword.webp',
  ];

  const effects = [
    'images/effects/inhale-sparkle.webp',
    'images/effects/fire-attack.webp',
    'images/effects/ice-attack.webp',
    'images/effects/sword-slash.webp',
    'images/effects/star-bullet.webp',
  ];

  const enemies = [
    'images/enemies/wabble-bee.webp',
    'images/enemies/dronto-durt.webp',
  ];

  const items = [
    'images/items/heal-orb.webp',
    'images/items/fire-artifact.webp',
    'images/items/ice-artifact.webp',
    'images/items/leaf-artifact.webp',
    'images/items/ruin-artifact.webp',
  ];

  const world = [
    'images/world/wall-texture.webp',
    'images/world/brick-tile.webp',
    'images/world/forest-tile.webp',
    'images/world/fire-tile.webp',
    'images/world/ice-tile.webp',
    'images/world/stone-tile.webp',
    'images/world/royal-tile.webp',
  ];

  const ui = [
    'images/ui/door-marker.webp',
    'images/ui/goal-door.webp',
    'images/ui/locked-door.webp',
    'images/ui/virtual-controls.webp',
  ];

  const fallbacks = [
    'images/fallbacks/kirdy-placeholder.webp',
    'images/fallbacks/virtual-controls.webp',
  ];

  const allAssets = [...characters, ...effects, ...enemies, ...items, ...world, ...ui, ...fallbacks];

  it('all referenced sprite assets are present and valid WebP files', () => {
    allAssets.forEach(expectWebpRelative);
  });
});
