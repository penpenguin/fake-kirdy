import { describe, expect, it } from 'vitest';
import { STAGE_DEFINITIONS } from './index';

describe('Stage enemy variety', () => {
  it('defines at least four distinct enemy types across all areas', () => {
    const uniqueTypes = new Set(
      STAGE_DEFINITIONS.flatMap((definition) => definition.enemySpawns?.entries.map((entry) => entry.type) ?? []),
    );

    expect(uniqueTypes.size).toBeGreaterThanOrEqual(4);
    expect(uniqueTypes.has('frost-wabble')).toBe(true);
    expect(uniqueTypes.has('glacio-durt')).toBe(true);
  });

  it('assigns ice-themed enemy types to the ice area', () => {
    const iceArea = STAGE_DEFINITIONS.find((definition) => definition.id === 'ice-area');
    expect(iceArea).toBeDefined();
    const entries = iceArea?.enemySpawns?.entries.map((entry) => entry.type) ?? [];

    expect(entries).toContain('frost-wabble');
    expect(entries).toContain('glacio-durt');
  });
});
