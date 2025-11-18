const DEFAULT_COLLECTIBLE_TEXTURE = 'heal-orb';

const COLLECTIBLE_TEXTURES: Record<string, string> = {
  'forest-keystone': 'leaf-artifact',
  'ice-keystone': 'ice-artifact',
  'fire-keystone': 'fire-artifact',
  'cave-keystone': 'ruin-artifact',
} as const;

export function resolveCollectibleTextureKey(itemId: string): string {
  if (typeof itemId !== 'string' || itemId.trim().length === 0) {
    return DEFAULT_COLLECTIBLE_TEXTURE;
  }

  return COLLECTIBLE_TEXTURES[itemId] ?? DEFAULT_COLLECTIBLE_TEXTURE;
}
