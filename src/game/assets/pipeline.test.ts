import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAssetManifest, queueAssetManifest } from './pipeline';

function createLoaderStub() {
  return {
    setBaseURL: vi.fn(),
    setPath: vi.fn(),
    image: vi.fn(),
    audio: vi.fn(),
    json: vi.fn(),
  };
}

function expectCallForAsset(
  calls: unknown[][],
  key: string,
  expectedSecondArg: unknown,
) {
  const call = calls.find(([calledKey]) => calledKey === key);
  expect(call, `Missing loader call for asset ${key}`).toBeDefined();
  expect(call?.[1]).toEqual(expectedSecondArg);
  return call;
}

function expectWebp(absolutePath: string) {
  const buffer = readFileSync(absolutePath);
  expect(buffer.length).toBeGreaterThan(24);
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
}

describe('asset pipeline manifest', () => {
  afterEach(() => {
    delete (globalThis as any).__KIRDY_ASSET_BASE_URL__;
  });

  it('queues every asset defined in the manifest', () => {
    const loader = createLoaderStub();
    const manifest = createAssetManifest();

    const context = queueAssetManifest(loader as any, manifest);

    expect(loader.setBaseURL).toHaveBeenCalledWith(manifest.baseURL);
    expect(loader.setPath).toHaveBeenCalledWith(manifest.path);

    manifest.images.forEach((asset) => {
      const call = expectCallForAsset(loader.image.mock.calls, asset.key, asset.url);
      if (asset.frameConfig) {
        expect(call?.[2]).toEqual(asset.frameConfig);
      }
    });

    manifest.audio.forEach((asset) => {
      const call = expectCallForAsset(loader.audio.mock.calls, asset.key, asset.urls);
      expect(call?.[2]).toBeUndefined();
    });

    manifest.data.forEach((asset) => {
      expectCallForAsset(loader.json.mock.calls, asset.key, asset.url);
    });

    manifest.images
      .filter((asset) => asset.fallbackUrl)
      .forEach((asset) => {
        expect(context.fallbackMap.get(asset.key)).toEqual({
          type: 'image',
          url: asset.fallbackUrl,
        });
      });

    manifest.audio
      .filter((asset) => asset.fallbackUrl)
      .forEach((asset) => {
        expect(context.fallbackMap.get(asset.key)).toEqual({
          type: 'audio',
          url: asset.fallbackUrl,
        });
      });
  });

  it('prefers a global override for optimized asset delivery', () => {
    const loader = createLoaderStub();
    const manifest = createAssetManifest();

    (globalThis as any).__KIRDY_ASSET_BASE_URL__ = 'https://cdn.example.com/kirdy';

    const overridden = createAssetManifest();

    queueAssetManifest(loader as any, overridden);

    expect(overridden.baseURL).toBe('https://cdn.example.com/kirdy');
    expect(loader.setBaseURL).toHaveBeenCalledWith('https://cdn.example.com/kirdy');
  });

  it('lists background music and core sound effect assets', () => {
    const manifest = createAssetManifest();
    const audioKeys = manifest.audio.map((asset) => asset.key);

    expect(audioKeys).toEqual(
      expect.arrayContaining([
        'bgm-main',
        'kirdy-inhale',
        'kirdy-swallow',
        'kirdy-spit',
        'ability-fire-attack',
        'ability-ice-attack',
        'ability-sword-attack',
      ]),
    );
  });

  it('does not bundle unused stage layout data assets', () => {
    const manifest = createAssetManifest();
    const dataKeys = manifest.data.map((asset) => asset.key);

    expect(dataKeys).not.toContain('stage-layouts');
    expect(manifest.data.length).toBe(0);
  });

  it('主要なキャラクターテクスチャと攻撃エフェクトをマニフェストに含める', () => {
    const manifest = createAssetManifest();
    const baseDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../public/assets',
    );

    const expectedAssets: Array<{ key: string; path: string }> = [
      { key: 'kirdy', path: 'images/characters/kirdy/kirdy.webp' },
      { key: 'kirdy-run', path: 'images/characters/kirdy/kirdy-run.webp' },
      { key: 'kirdy-jump', path: 'images/characters/kirdy/kirdy-jump.webp' },
      { key: 'kirdy-hover', path: 'images/characters/kirdy/kirdy-hover.webp' },
      { key: 'kirdy-inhale', path: 'images/characters/kirdy/kirdy-inhale.webp' },
      { key: 'kirdy-swallow', path: 'images/characters/kirdy/kirdy-swallow.webp' },
      { key: 'kirdy-spit', path: 'images/characters/kirdy/kirdy-spit.webp' },
      { key: 'fire-attack', path: 'images/effects/fire-attack.webp' },
      { key: 'ice-attack', path: 'images/effects/ice-attack.webp' },
      { key: 'sword-slash', path: 'images/effects/sword-slash.webp' },
      { key: 'star-bullet', path: 'images/effects/star-bullet.webp' },
      { key: 'wabble-bee', path: 'images/enemies/wabble-bee.webp' },
      { key: 'dronto-durt', path: 'images/enemies/dronto-durt.webp' },
      { key: 'fire-artifact', path: 'images/items/fire-artifact.webp' },
      { key: 'ice-artifact', path: 'images/items/ice-artifact.webp' },
      { key: 'leaf-artifact', path: 'images/items/leaf-artifact.webp' },
      { key: 'ruin-artifact', path: 'images/items/ruin-artifact.webp' },
      { key: 'locked-door', path: 'images/ui/locked-door.webp' },
      { key: 'wall-texture', path: 'images/world/wall-texture.webp' },
      { key: 'brick-tile', path: 'images/world/brick-tile.webp' },
      { key: 'forest-tile', path: 'images/world/forest-tile.webp' },
      { key: 'fire-tile', path: 'images/world/fire-tile.webp' },
      { key: 'ice-tile', path: 'images/world/ice-tile.webp' },
      { key: 'stone-tile', path: 'images/world/stone-tile.webp' },
      { key: 'royal-tile', path: 'images/world/royal-tile.webp' },
    ];

    expectedAssets.forEach(({ key, path }) => {
      const asset = manifest.images.find((entry) => entry.key === key);
      expect(asset, `Missing manifest image entry for ${key}`).toBeDefined();
      expect(asset?.url).toBe(path);

      const absolutePath = resolve(baseDir, path);
      expect(existsSync(absolutePath)).toBe(true);
    });
  });

  it('クラスタ別の壁タイルはwall-textureへのフォールバックを指定する', () => {
    const manifest = createAssetManifest();
    const clusterTileKeys = ['brick-tile', 'forest-tile', 'fire-tile', 'ice-tile', 'stone-tile', 'royal-tile'];

    clusterTileKeys.forEach((key) => {
      const asset = manifest.images.find((entry) => entry.key === key);
      expect(asset, `Missing manifest image entry for ${key}`).toBeDefined();
      expect(asset?.fallbackUrl).toBe('images/world/wall-texture.webp');
    });
  });

  it('クロスプラットフォームのタッチ操作向けvirtual-controlsスプライトを含む', () => {
    const manifest = createAssetManifest();
    const asset = manifest.images.find((entry) => entry.key === 'virtual-controls');

    expect(asset).toBeDefined();
    expect(asset?.url).toBe('images/ui/virtual-controls.webp');
    expect(asset?.fallbackUrl).toBe('images/fallbacks/virtual-controls.webp');
  });

  it('ensures every fallback asset file exists under public/assets', () => {
    const manifest = createAssetManifest();
    const baseDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../public',
    );

    const expectFallbackExists = (relativePath: string) => {
      const normalized = relativePath.replace(/^\/+/, '');
      const absolutePath = resolve(baseDir, normalized);
      expect(existsSync(absolutePath)).toBe(true);
    };

    manifest.images
      .filter((asset) => asset.fallbackUrl)
      .forEach((asset) => expectFallbackExists(`assets/${asset.fallbackUrl}`));

    manifest.audio
      .filter((asset) => asset.fallbackUrl)
      .forEach((asset) => expectFallbackExists(`assets/${asset.fallbackUrl}`));

    manifest.data
      .filter((asset) => asset.fallbackUrl)
      .forEach((asset) => expectFallbackExists(`assets/${asset.fallbackUrl}`));
  });

  describe('image asset payload integrity', () => {
    const manifest = createAssetManifest();
    const baseDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../public/assets',
    );

    const imageEntries = [
      ...manifest.images.map((asset) => ({
        label: asset.key,
        relativePath: asset.url,
      })),
      ...manifest.images
        .filter((asset) => asset.fallbackUrl)
        .map((asset) => ({
          label: `${asset.key} fallback`,
          relativePath: asset.fallbackUrl!,
        })),
    ];

    it.each(imageEntries)('%s is a valid webp file', ({ label, relativePath }) => {
      const absolutePath = resolve(baseDir, relativePath);
      expectWebp(absolutePath);
    });
  });
});
