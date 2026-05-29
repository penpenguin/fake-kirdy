import { describe, expect, it, vi } from 'vitest';

describe('AreaManager stage integration', () => {
  it('hydrates area definitions from stage modules', async () => {
    vi.mock('./stages', () => {
      const mockDefinition = {
        id: 'central-hub',
        name: 'Mock Hub',
        tileSize: 32,
        layout: ['####', '#..#', '####'],
        neighbors: {},
        entryPoints: {
          default: { position: { x: 16, y: 16 } },
        },
        metadata: {
          cluster: 'hub',
          index: 0,
          difficulty: 1,
        },
        doorBuffer: 2,
        doors: [
          {
            id: 'north-door',
            direction: 'north',
            tile: { column: 2, row: 0 },
            position: { x: 64, y: 0 },
            safeRadius: 2,
            type: 'standard',
            target: 'ice-area',
          },
        ],
        deadEnds: [
          {
            id: 'dead-end-1',
            tile: { column: 1, row: 1 },
            position: { x: 32, y: 32 },
            reward: 'health',
          },
        ],
        goal: {
          doorId: 'north-door',
          texture: 'goal-door',
          resultOverlayKey: 'goal-results',
        },
        enemySpawns: {
          baseline: 1,
          maxActive: 1,
          entries: [{ type: 'wabble-bee', limit: 1 }],
        },
      } as any;

      return {
        STAGE_DEFINITIONS: [mockDefinition],
        cloneStageDefinition: (definition: unknown) => JSON.parse(JSON.stringify(definition)),
      };
    });

    vi.resetModules();

    const module = await import('./AreaManager');
    const { AreaManager, AREA_IDS } = module;

    const manager = new AreaManager(AREA_IDS.CentralHub);
    const state = manager.getCurrentAreaState();

    expect(state.definition.name).toBe('Mock Hub');
    expect(state.definition.layout).toEqual(['####', '#..#', '####']);
    expect(state.definition.doorBuffer).toBe(2);
    expect(state.definition.doors?.[0]?.id).toBe('north-door');
    expect(state.definition.deadEnds?.[0]?.reward).toBe('health');
    expect(state.definition.goal?.doorId).toBe('north-door');
  });
});
