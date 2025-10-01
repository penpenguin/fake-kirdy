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
    key: 'kirdy-idle',
    url: 'images/kirdy-idle.png',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.png',
  },
  {
    key: 'tileset-main',
    url: 'images/tileset-main.png',
    fallbackUrl: 'images/fallbacks/tileset-placeholder.png',
  },
];

const AUDIO_ASSETS: ReadonlyArray<AudioAsset> = [
  {
    key: 'bgm-main',
    urls: ['audio/bgm-main.ogg', 'audio/bgm-main.mp3'],
    fallbackUrl: 'audio/bgm-main.mp3',
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

