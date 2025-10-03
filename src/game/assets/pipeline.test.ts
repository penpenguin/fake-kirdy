import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
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

  it('主要なキャラクターテクスチャと攻撃エフェクトをマニフェストに含める', () => {
    const manifest = createAssetManifest();
    const baseDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../public/assets',
    );

    const expectedAssets: Array<{ key: string; path: string }> = [
      { key: 'kirdy', path: 'images/kirdy.png' },
      { key: 'kirdy-run', path: 'images/kirdy-run.png' },
      { key: 'kirdy-jump', path: 'images/kirdy-jump.png' },
      { key: 'kirdy-hover', path: 'images/kirdy-hover.png' },
      { key: 'kirdy-inhale', path: 'images/kirdy-inhale.png' },
      { key: 'kirdy-swallow', path: 'images/kirdy-swallow.png' },
      { key: 'kirdy-spit', path: 'images/kirdy-spit.png' },
      { key: 'fire-attack', path: 'images/fire-attack.png' },
      { key: 'ice-attack', path: 'images/ice-attack.png' },
      { key: 'sword-slash', path: 'images/sword-slash.png' },
      { key: 'star-bullet', path: 'images/star-bullet.png' },
      { key: 'wabble-bee', path: 'images/wabble-bee.png' },
      { key: 'dronto-durt', path: 'images/dronto-durt.png' },
    ];

    expectedAssets.forEach(({ key, path }) => {
      const asset = manifest.images.find((entry) => entry.key === key);
      expect(asset, `Missing manifest image entry for ${key}`).toBeDefined();
      expect(asset?.url).toBe(path);

      const absolutePath = resolve(baseDir, path);
      expect(existsSync(absolutePath)).toBe(true);
    });
  });

  it('クロスプラットフォームのタッチ操作向けvirtual-controlsスプライトを含む', () => {
    const manifest = createAssetManifest();
    const asset = manifest.images.find((entry) => entry.key === 'virtual-controls');

    expect(asset).toBeDefined();
    expect(asset?.url).toBe('images/virtual-controls.png');
    expect(asset?.fallbackUrl).toBe('images/fallbacks/virtual-controls.png');
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
});
