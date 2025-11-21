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
    expect(entries).toContain('chill-wisp');
    expect(entries).toContain('glacier-golem');
    expect(entries).toContain('frost-archer');
  });

  it('assigns forest-themed enemy types to the forest area', () => {
    const forestArea = STAGE_DEFINITIONS.find((definition) => definition.id === 'forest-area');
    expect(forestArea).toBeDefined();
    const entries = forestArea?.enemySpawns?.entries.map((entry) => entry.type) ?? [];

    expect(entries).toContain('vine-hopper');
    expect(entries).toContain('thorn-roller');
    expect(entries).toContain('sap-spitter');
  });

  it('assigns fire-themed enemy types to the fire area', () => {
    const fireArea = STAGE_DEFINITIONS.find((definition) => definition.id === 'fire-area');
    expect(fireArea).toBeDefined();
    const entries = fireArea?.enemySpawns?.entries.map((entry) => entry.type) ?? [];

    expect(entries).toContain('ember-imp');
    expect(entries).toContain('magma-crab');
    expect(entries).toContain('blaze-strider');
  });

  it('assigns ruins-themed enemy types to the ruins reliquary', () => {
    const ruins = STAGE_DEFINITIONS.find((definition) => definition.id === 'ruins-reliquary');
    expect(ruins).toBeDefined();
    const entries = ruins?.enemySpawns?.entries.map((entry) => entry.type) ?? [];

    expect(entries).toContain('stone-sentinel');
    expect(entries).toContain('curse-bat');
    expect(entries).toContain('relic-thief');
  });

  it('assigns sky-themed enemy types to the sky sanctum', () => {
    const sky = STAGE_DEFINITIONS.find((definition) => definition.id === 'sky-sanctum');
    expect(sky).toBeDefined();
    const entries = sky?.enemySpawns?.entries.map((entry) => entry.type) ?? [];

    expect(entries).toContain('gale-kite');
    expect(entries).toContain('nimbus-knight');
    expect(entries).toContain('prism-wraith');
  });
});
