import { describe, expect, it, vi } from 'vitest';
import type { LoadedArea } from '../world/AreaManager';
import { GoalDoorController } from './GoalDoorController';
import { RunTimer } from '../performance/RunTimer';

function createLoadedArea(overrides: Partial<LoadedArea> = {}): LoadedArea {
  const tileSize = overrides.definition?.tileSize ?? 32;
  return {
    definition: {
      id: 'goal-sanctum',
      name: 'Goal',
      tileSize,
      layout: ['###', '#D#', '###'],
      neighbors: {},
      entryPoints: { default: { position: { x: tileSize, y: tileSize } } },
      doors: [
        {
          id: 'north-0',
          direction: 'north',
          tile: { column: 1, row: 0 },
          position: { x: tileSize, y: 0 },
          safeRadius: 2,
          type: 'goal',
        },
      ],
      metadata: { cluster: 'ruins', index: 6 },
      doorBuffer: 2,
      deadEnds: [],
      goal: {
        doorId: 'north-0',
        texture: 'goal-door',
        resultOverlayKey: 'goal-results',
      },
      enemySpawns: undefined,
    },
    tileMap: {
      getTileAtWorldPosition: () => 'door',
    } as unknown as LoadedArea['tileMap'],
    pixelBounds: { width: tileSize * 3, height: tileSize * 3 },
    playerSpawnPosition: { x: tileSize, y: tileSize },
    ...overrides,
  } satisfies LoadedArea;
}

describe('GoalDoorController', () => {
  it('emits goal:reached when the player overlaps the goal door tile', () => {
    const events = { emit: vi.fn() };
    const area = createLoadedArea();
    const timer = new RunTimer(() => 5000);
    timer.start(0);

    const controller = new GoalDoorController({
      sceneEvents: events,
      getAreaState: () => area,
      getPlayerPosition: () => ({ x: 32, y: 8 }),
      getScore: () => 4200,
      runTimer: timer,
    });

    controller.update();

    expect(events.emit).toHaveBeenCalledWith('goal:reached', expect.objectContaining({
      score: 4200,
      timeMs: 5000,
    }));
  });

  it('does not emit when there is no goal metadata', () => {
    const events = { emit: vi.fn() };
    const area = createLoadedArea({
      definition: {
        ...createLoadedArea().definition,
        goal: null,
        doors: [],
      },
    });

    const controller = new GoalDoorController({
      sceneEvents: events,
      getAreaState: () => area,
      getPlayerPosition: () => ({ x: 32, y: 8 }),
      getScore: () => 0,
      runTimer: new RunTimer(() => 0),
    });

    controller.update();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('can trigger again after area change reset', () => {
    const events = { emit: vi.fn() };
    const area = createLoadedArea();
    const controller = new GoalDoorController({
      sceneEvents: events,
      getAreaState: () => area,
      getPlayerPosition: () => ({ x: 32, y: 8 }),
      getScore: () => 100,
      runTimer: new RunTimer(() => 1000),
    });

    controller.update();
    controller.update();
    controller.handleAreaChanged();
    controller.update();

    expect(events.emit).toHaveBeenCalledTimes(2);
  });
});
