import { describe, expect, it } from 'vitest';
import { ABILITY_TYPES, isAbilityType } from './AbilitySystem';

const NEW_ABILITIES = [
  'leaf',
  'spike',
  'sticky',
  'ice-arrow',
  'guard',
  'magma-shield',
  'dash-fire',
  'beam',
  'curse',
  'warp',
  'wind',
  'thunder',
  'prism',
] as const;

describe('AbilitySystem biome placeholder abilities', () => {
  it('exposes biome ability keys for new enemies', () => {
    expect(ABILITY_TYPES).toEqual(expect.arrayContaining([...NEW_ABILITIES]));
    NEW_ABILITIES.forEach((key) => {
      expect(isAbilityType(key)).toBe(true);
    });
  });
});
