export interface ImageAsset {
  key: string;
  url: string;
  fallbackUrl?: string;
  frameConfig?: unknown;
}

export interface AudioAsset {
  key: string;
  urls: string[];
  fallbackUrl?: string;
}

export interface DataAsset {
  key: string;
  url: string;
  fallbackUrl?: string;
}

export interface AssetManifest {
  baseURL: string;
  path: string;
  images: ImageAsset[];
  audio: AudioAsset[];
  data: DataAsset[];
}

export type AssetType = 'image' | 'audio' | 'data';

export interface AssetFallback {
  type: AssetType;
  url: string;
}

const DEFAULT_BASE_URL = '';
const DEFAULT_PATH = 'assets/';

const IMAGE_ASSETS: ReadonlyArray<ImageAsset> = [
  {
    key: 'kirdy',
    url: 'images/characters/kirdy/kirdy.png',
  },
  {
    key: 'kirdy-run',
    url: 'images/characters/kirdy/kirdy-run.png',
  },
  {
    key: 'kirdy-jump',
    url: 'images/characters/kirdy/kirdy-jump.png',
  },
  {
    key: 'kirdy-hover',
    url: 'images/characters/kirdy/kirdy-hover.png',
  },
  {
    key: 'kirdy-inhale',
    url: 'images/characters/kirdy/kirdy-inhale.png',
  },
  {
    key: 'kirdy-swallow',
    url: 'images/characters/kirdy/kirdy-swallow.png',
  },
  {
    key: 'kirdy-spit',
    url: 'images/characters/kirdy/kirdy-spit.png',
  },
  {
    key: 'kirdy-fire',
    url: 'images/characters/kirdy/kirdy-fire.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'kirdy-ice',
    url: 'images/characters/kirdy/kirdy-ice.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'kirdy-sword',
    url: 'images/characters/kirdy/kirdy-sword.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'inhale-sparkle',
    url: 'images/effects/inhale-sparkle.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'fire-attack',
    url: 'images/effects/fire-attack.png',
  },
  {
    key: 'ice-attack',
    url: 'images/effects/ice-attack.png',
  },
  {
    key: 'sword-slash',
    url: 'images/effects/sword-slash.png',
  },
  {
    key: 'star-bullet',
    url: 'images/effects/star-bullet.png',
  },
  {
    key: 'wabble-bee',
    url: 'images/enemies/wabble-bee.png',
  },
  {
    key: 'dronto-durt',
    url: 'images/enemies/dronto-durt.png',
  },
  {
    key: 'kirdy-idle',
    url: 'images/characters/kirdy/kirdy-idle.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'tileset-main',
    url: 'images/world/tileset-main.png',
    fallbackUrl: 'images/fallbacks/tileset-placeholder.png',
    frameConfig: { frameWidth: 32, frameHeight: 32 },
  },
  {
    key: 'wall-texture',
    url: 'images/world/wall-texture.png',
  },
  {
    key: 'door-marker',
    url: 'images/ui/door-marker.png',
  },
  {
    key: 'goal-door',
    url: 'images/ui/goal-door.png',
    fallbackUrl: 'images/ui/door-marker.png',
  },
  {
    key: 'heal-orb',
    url: 'images/items/heal-orb.png',
    fallbackUrl: 'images/ui/door-marker.png',
  },
  {
    key: 'virtual-controls',
    url: 'images/ui/virtual-controls.png',
    fallbackUrl: 'images/fallbacks/virtual-controls.png',
  },
];

const AUDIO_ASSETS: ReadonlyArray<AudioAsset> = [
  {
    key: 'bgm-main',
    urls: ['audio/bgm-main.wav'],
    fallbackUrl: 'audio/bgm-main.wav',
  },
  {
    key: 'kirdy-inhale',
    urls: ['audio/sfx/kirdy-inhale.wav'],
    fallbackUrl: 'audio/sfx/kirdy-inhale.wav',
  },
  {
    key: 'kirdy-swallow',
    urls: ['audio/sfx/kirdy-swallow.wav'],
    fallbackUrl: 'audio/sfx/kirdy-swallow.wav',
  },
  {
    key: 'kirdy-spit',
    urls: ['audio/sfx/kirdy-spit.wav'],
    fallbackUrl: 'audio/sfx/kirdy-spit.wav',
  },
  {
    key: 'ability-fire-attack',
    urls: ['audio/sfx/ability-fire-attack.wav'],
    fallbackUrl: 'audio/sfx/ability-fire-attack.wav',
  },
  {
    key: 'ability-ice-attack',
    urls: ['audio/sfx/ability-ice-attack.wav'],
    fallbackUrl: 'audio/sfx/ability-ice-attack.wav',
  },
  {
    key: 'ability-sword-attack',
    urls: ['audio/sfx/ability-sword-attack.wav'],
    fallbackUrl: 'audio/sfx/ability-sword-attack.wav',
  },
];

const DATA_ASSETS: ReadonlyArray<DataAsset> = [
  {
    key: 'stage-layouts',
    url: 'data/stage-layouts.json',
    fallbackUrl: 'data/stage-layouts-fallback.json',
  },
];

function cloneImageAsset(asset: ImageAsset): ImageAsset {
  return { ...asset };
}

function cloneAudioAsset(asset: AudioAsset): AudioAsset {
  return { ...asset, urls: [...asset.urls] };
}

function cloneDataAsset(asset: DataAsset): DataAsset {
  return { ...asset };
}

function resolveBaseURL(): string {
  const override = (globalThis as any).__KIRDY_ASSET_BASE_URL__;
  if (typeof override === 'string' && override.trim().length > 0) {
    return override.replace(/\/$/, '');
  }

  return DEFAULT_BASE_URL;
}

export function createAssetManifest(): AssetManifest {
  return {
    baseURL: resolveBaseURL(),
    path: DEFAULT_PATH,
    images: IMAGE_ASSETS.map(cloneImageAsset),
    audio: AUDIO_ASSETS.map(cloneAudioAsset),
    data: DATA_ASSETS.map(cloneDataAsset),
  };
}

export function queueAssetManifest(
  loader: Partial<{
    setBaseURL(value: string): void;
    setPath(value: string): void;
    image(key: string, url: string, frameConfig?: unknown): void;
    audio(key: string, urls: string[], config?: unknown): void;
    json(key: string, url: string): void;
  }>,
  manifest: AssetManifest = createAssetManifest(),
) {
  loader.setBaseURL?.(manifest.baseURL);
  loader.setPath?.(manifest.path);

  const fallbackMap = new Map<string, AssetFallback>();

  manifest.images.forEach((asset) => {
    loader.image?.(asset.key, asset.url, asset.frameConfig);
    if (asset.fallbackUrl) {
      fallbackMap.set(asset.key, { type: 'image', url: asset.fallbackUrl });
    }
  });

  manifest.audio.forEach((asset) => {
    loader.audio?.(asset.key, asset.urls);
    if (asset.fallbackUrl) {
      fallbackMap.set(asset.key, { type: 'audio', url: asset.fallbackUrl });
    }
  });

  manifest.data.forEach((asset) => {
    loader.json?.(asset.key, asset.url);
    if (asset.fallbackUrl) {
      fallbackMap.set(asset.key, { type: 'data', url: asset.fallbackUrl });
    }
  });

  return {
    fallbackMap,
  };
}
