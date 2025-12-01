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
    url: 'images/characters/kirdy/kirdy.webp',
  },
  {
    key: 'kirdy-run',
    url: 'images/characters/kirdy/kirdy-run.webp',
  },
  {
    key: 'kirdy-jump',
    url: 'images/characters/kirdy/kirdy-jump.webp',
  },
  {
    key: 'kirdy-hover',
    url: 'images/characters/kirdy/kirdy-hover.webp',
  },
  {
    key: 'kirdy-inhale',
    url: 'images/characters/kirdy/kirdy-inhale.webp',
  },
  {
    key: 'kirdy-swallow',
    url: 'images/characters/kirdy/kirdy-swallow.webp',
  },
  {
    key: 'kirdy-spit',
    url: 'images/characters/kirdy/kirdy-spit.webp',
  },
  {
    key: 'kirdy-fire',
    url: 'images/characters/kirdy/kirdy-fire.webp',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.webp',
  },
  {
    key: 'kirdy-ice',
    url: 'images/characters/kirdy/kirdy-ice.webp',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.webp',
  },
  {
    key: 'kirdy-sword',
    url: 'images/characters/kirdy/kirdy-sword.webp',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.webp',
  },
  {
    key: 'inhale-sparkle',
    url: 'images/effects/inhale-sparkle.webp',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.webp',
  },
  {
    key: 'fire-attack',
    url: 'images/effects/fire-attack.webp',
  },
  {
    key: 'ice-attack',
    url: 'images/effects/ice-attack.webp',
  },
  {
    key: 'sword-slash',
    url: 'images/effects/sword-slash.webp',
  },
  { key: 'leaf-attack', url: 'images/effects/leaf-attack.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'spike-attack', url: 'images/effects/spike-attack.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'sticky-shot', url: 'images/effects/sticky-shot.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'ice-arrow-attack', url: 'images/effects/ice-arrow-attack.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'guard-block', url: 'images/effects/guard-block.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'magma-shield', url: 'images/effects/magma-shield.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'dash-fire', url: 'images/effects/dash-fire.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'beam-attack', url: 'images/effects/beam-attack.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'curse-breath', url: 'images/effects/curse-breath.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'warp-blink', url: 'images/effects/warp-blink.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'wind-gust', url: 'images/effects/wind-gust.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'thunder-strike', url: 'images/effects/thunder-strike.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'prism-dash', url: 'images/effects/prism-dash.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  {
    key: 'star-bullet',
    url: 'images/effects/star-bullet.webp',
  },
  {
    key: 'wabble-bee',
    url: 'images/enemies/wabble-bee.webp',
  },
  {
    key: 'dronto-durt',
    url: 'images/enemies/dronto-durt.webp',
  },
  { key: 'vine-hopper', url: 'images/enemies/vine-hopper.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'thorn-roller', url: 'images/enemies/thorn-roller.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'sap-spitter', url: 'images/enemies/sap-spitter.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'chill-wisp', url: 'images/enemies/chill-wisp.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'glacier-golem', url: 'images/enemies/glacier-golem.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'frost-archer', url: 'images/enemies/frost-archer.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'ember-imp', url: 'images/enemies/ember-imp.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'magma-crab', url: 'images/enemies/magma-crab.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'blaze-strider', url: 'images/enemies/blaze-strider.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'stone-sentinel', url: 'images/enemies/stone-sentinel.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'curse-bat', url: 'images/enemies/curse-bat.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'relic-thief', url: 'images/enemies/relic-thief.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'gale-kite', url: 'images/enemies/gale-kite.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'nimbus-knight', url: 'images/enemies/nimbus-knight.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'prism-wraith', url: 'images/enemies/prism-wraith.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'guardian-treant', url: 'images/enemies/guardian-treant.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'frost-colossus', url: 'images/enemies/frost-colossus.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'magma-hydra', url: 'images/enemies/magma-hydra.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  { key: 'relic-warden', url: 'images/enemies/relic-warden.webp', fallbackUrl: 'images/fallbacks/placeholder.webp' },
  {
    key: 'kirdy-idle',
    url: 'images/characters/kirdy/kirdy-idle.webp',
    fallbackUrl: 'images/fallbacks/kirdy-placeholder.webp',
  },
  {
    key: 'wall-texture',
    url: 'images/world/wall-texture.webp',
  },
  {
    key: 'brick-tile',
    url: 'images/world/brick-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'forest-tile',
    url: 'images/world/forest-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'fire-tile',
    url: 'images/world/fire-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'ice-tile',
    url: 'images/world/ice-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'stone-tile',
    url: 'images/world/stone-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'royal-tile',
    url: 'images/world/royal-tile.webp',
    fallbackUrl: 'images/world/wall-texture.webp',
  },
  {
    key: 'door-marker',
    url: 'images/ui/door-marker.webp',
  },
  {
    key: 'goal-door',
    url: 'images/ui/goal-door.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'locked-door',
    url: 'images/ui/locked-door.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'return-gate',
    url: 'images/ui/door-marker.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'heal-orb',
    url: 'images/items/heal-orb.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'fire-artifact',
    url: 'images/items/fire-artifact.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'ice-artifact',
    url: 'images/items/ice-artifact.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'leaf-artifact',
    url: 'images/items/leaf-artifact.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'ruin-artifact',
    url: 'images/items/ruin-artifact.webp',
    fallbackUrl: 'images/ui/door-marker.webp',
  },
  {
    key: 'virtual-controls',
    url: 'images/ui/virtual-controls.webp',
    fallbackUrl: 'images/fallbacks/virtual-controls.webp',
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

const DATA_ASSETS: ReadonlyArray<DataAsset> = [];

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
