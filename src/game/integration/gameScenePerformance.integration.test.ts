import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionState, FakeMatterSprite } from './testHarness';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import * as renderingPreference from '../performance/RenderingModePreference';

const phaserStubs = vi.hoisted(() => {
  const events = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  };

  class SceneMock {
    public events = events;
    public scene = {
      launch: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    public cameras = {
      main: {
        worldView: { x: 0, y: 0, width: 800, height: 600 },
      },
    };
    public input = {
      keyboard: {
        once: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    };
    public add = {
      text: vi.fn(),
      container: vi.fn(),
      particles: vi.fn(),
    };
    public matter = {
      add: {
        sprite: vi.fn(),
        existing: vi.fn(),
      },
    };
    public sound = {
      play: vi.fn(),
    };
    public time = {
      delayedCall: vi.fn(),
    };
    public scale = { width: 800, height: 600 };
    public textures = { exists: vi.fn() };
    public anims = { exists: vi.fn(), create: vi.fn() };

    constructor(_config?: unknown) {}
  }

  return { SceneMock, events };
});

vi.mock('phaser', () => ({
  default: {
    Scene: phaserStubs.SceneMock,
    AUTO: 'AUTO',
    WEBGL: 'WEBGL',
    CANVAS: 'CANVAS',
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Types: {
      Scenes: {
        SettingsConfig: class {},
      },
      Physics: {
        Matter: {
          SetCollideCallback: class {},
        },
      },
    },
  },
}));

import { GameScene } from '../scenes';

describe('統合: GameScene のパフォーマンス監視', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    phaserStubs.events.emit.mockClear();
  });

  it('FPSサンプルに応じてレンダリングモードイベントを記録し、低FPSイベントを発火する', () => {
    const recordStableSpy = vi
      .spyOn(renderingPreference, 'recordStableFpsEvent')
      .mockImplementation(() => {});
    const recordLowSpy = vi.spyOn(renderingPreference, 'recordLowFpsEvent').mockImplementation(() => {});

    const scene = new GameScene();
    const playerSprite = new FakeMatterSprite('kirdy');
    const kirdyStub = {
      sprite: playerSprite as unknown,
      update: vi.fn(),
    };

    const playerInputStub = {
      update: vi.fn(() => ({
        kirdy: { left: false, right: false, jumpPressed: false, hoverPressed: false },
        actions: actionState(),
      })),
    };

    const performanceMonitor = new PerformanceMonitor({
      sampleWindowMs: 50,
      lowFpsThreshold: 40,
      lowFpsSampleCount: 2,
      onSample: (metrics) => (scene as any).handlePerformanceSample(metrics),
      onLowFps: (metrics) => (scene as any).handleLowFps(metrics),
    });

    Object.assign(scene as unknown as Record<string, unknown>, {
      playerInput: playerInputStub,
      inhaleSystem: { update: vi.fn() },
      swallowSystem: { update: vi.fn(), consumeSwallowedPayload: vi.fn() },
      abilitySystem: { update: vi.fn(), applySwallowedPayload: vi.fn() },
      kirdy: kirdyStub,
      performanceMonitor,
      enemies: [],
    });

    for (let i = 0; i < 5; i += 1) {
      scene.update(i * 10, 10);
    }

    expect(recordStableSpy).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      scene.update(500 + i * 100, 100);
    }

    for (let i = 0; i < 5; i += 1) {
      scene.update(1100 + i * 100, 100);
    }

    expect(recordLowSpy).toHaveBeenCalledTimes(1);
    expect(phaserStubs.events.emit).toHaveBeenCalledWith(
      'performance:low-fps',
      expect.objectContaining({ averageFps: expect.any(Number) }),
    );
  });
});
