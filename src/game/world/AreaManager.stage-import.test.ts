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
  });
});
