import { describe, expect, it } from 'vitest';
import { resolveCollectibleTextureKey } from './collectible-assets';

describe('resolveCollectibleTextureKey', () => {
  it('maps keystone collectible IDs to their themed artifact textures', () => {
    expect(resolveCollectibleTextureKey('forest-keystone')).toBe('leaf-artifact');
    expect(resolveCollectibleTextureKey('ice-keystone')).toBe('ice-artifact');
    expect(resolveCollectibleTextureKey('fire-keystone')).toBe('fire-artifact');
    expect(resolveCollectibleTextureKey('cave-keystone')).toBe('ruin-artifact');
  });

  it('falls back to heal orb texture for unknown or empty IDs', () => {
    expect(resolveCollectibleTextureKey('unknown-item')).toBe('heal-orb');
    expect(resolveCollectibleTextureKey('')).toBe('heal-orb');
  });
});
