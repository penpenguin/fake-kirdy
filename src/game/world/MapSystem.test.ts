import { describe, expect, it } from 'vitest';
import type { AreaDefinition, AreaDoorDefinition, DeadEndDefinition } from './AreaManager';
import { MapSystem, type SpawnTile } from './MapSystem';

function createDoor(overrides: Partial<AreaDoorDefinition> = {}): AreaDoorDefinition {
  return {
    id: overrides.id ?? 'north-0',
    direction: overrides.direction ?? 'north',
    tile: overrides.tile ?? { column: 0, row: 0 },
    position: overrides.position ?? { x: 16, y: 16 },
    safeRadius: overrides.safeRadius ?? 1,
    type: overrides.type ?? 'standard',
    target: overrides.target,
  } satisfies AreaDoorDefinition;
}

function createDeadEnd(overrides: Partial<DeadEndDefinition> = {}): DeadEndDefinition {
  return {
    id: overrides.id ?? 'dead-end-0',
    tile: overrides.tile ?? { column: 5, row: 5 },
    position: overrides.position ?? { x: 176, y: 176 },
    reward: overrides.reward ?? 'health',
  } satisfies DeadEndDefinition;
}

describe('MapSystem', () => {
  it('filters spawn tiles within the configured door safety radius', () => {
    const definition: AreaDefinition = {
      id: 'central-hub',
      name: 'Test Area',
      tileSize: 32,
      layout: ['D..', '...', '..D'],
      neighbors: {},
      entryPoints: { default: { position: { x: 0, y: 0 } } },
      metadata: { cluster: 'hub', index: 0 },
      doorBuffer: 1,
      doors: [
        createDoor({
          id: 'north-0',
          direction: 'north',
          tile: { column: 0, row: 0 },
          position: { x: 16, y: 16 },
          safeRadius: 1,
        }),
      ],
      deadEnds: [],
      goal: null,
    };

    const mapSystem = new MapSystem([definition]);
    const candidates: SpawnTile[] = [
      { column: 0, row: 1, x: 16, y: 48 },
      { column: 2, row: 2, x: 80, y: 80 },
    ];

    const result = mapSystem.enforceDoorSpawnConstraints('central-hub', candidates);
    expect(result).toHaveLength(1);
    expect(result[0]?.column).toBe(2);
  });

  it('honors expanded safe radius per door metadata', () => {
    const definition: AreaDefinition = {
      id: 'mirror-corridor',
      name: 'Test Area 2',
      tileSize: 32,
      layout: ['...D', '....', 'D...'],
      neighbors: {},
      entryPoints: { default: { position: { x: 0, y: 0 } } },
      metadata: { cluster: 'hub', index: 1 },
      doorBuffer: 1,
      doors: [
        createDoor({
          id: 'east-0',
          direction: 'east',
          tile: { column: 3, row: 0 },
          position: { x: 112, y: 16 },
          safeRadius: 2,
        }),
      ],
      deadEnds: [],
      goal: null,
    };

    const mapSystem = new MapSystem([definition]);
    const candidates: SpawnTile[] = [
      { column: 1, row: 1, x: 48, y: 48 },
      { column: 3, row: 2, x: 112, y: 80 },
    ];

    const result = mapSystem.enforceDoorSpawnConstraints('mirror-corridor', candidates);
    expect(result).toHaveLength(0);
  });

  it('tracks heal items for each dead end and marks consumed ones', () => {
    const deadEnds = [
      createDeadEnd({ id: 'dead-end-0', tile: { column: 5, row: 5 }, position: { x: 176, y: 176 }, reward: 'health' }),
      createDeadEnd({ id: 'dead-end-1', tile: { column: 10, row: 8 }, position: { x: 336, y: 272 }, reward: 'max-health' }),
    ];

    const definition: AreaDefinition = {
      id: 'forest-area',
      name: 'Forest Dead Ends',
      tileSize: 32,
      layout: ['...'],
      neighbors: {},
      entryPoints: { default: { position: { x: 0, y: 0 } } },
      metadata: { cluster: 'forest', index: 2 },
      doorBuffer: 1,
      doors: [createDoor({ id: 'south-0', direction: 'south' })],
      deadEnds,
      goal: null,
    };

    const mapSystem = new MapSystem([definition]);
    const result = mapSystem.scatterDeadEndHeals('forest-area');

    expect(result).toHaveLength(2);
    const activeBefore = mapSystem.getActiveHealItems('forest-area');
    expect(activeBefore).toHaveLength(2);
    expect(activeBefore.map((item) => item.id)).toEqual(expect.arrayContaining(['dead-end-0', 'dead-end-1']));

    const consumed = mapSystem.consumeHeal('forest-area', 'dead-end-0');
    expect(consumed?.id).toBe('dead-end-0');

    const activeAfter = mapSystem.getActiveHealItems('forest-area');
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0]?.id).toBe('dead-end-1');
  });
});
