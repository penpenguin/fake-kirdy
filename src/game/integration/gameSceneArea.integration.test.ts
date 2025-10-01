import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionState, FakeMatterSprite } from './testHarness';
import { AreaManager, AREA_IDS } from '../world/AreaManager';

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

describe('統合: GameScene と AreaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('境界を越えると隣接エリアへ遷移し、プレイヤー座標とセーブ要求が更新される', () => {
    const scene = new GameScene();
    const areaManager = new AreaManager(AREA_IDS.CentralHub);
    const playerSprite = new FakeMatterSprite('kirdy').setPosition(650, 160);

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

    const mapOverlayStub = {
      isVisible: vi.fn().mockReturnValue(false),
      show: vi.fn(),
      hide: vi.fn(),
      update: vi.fn(),
    };

    const requestSaveSpy = vi.spyOn(scene as any, 'requestSave');

    Object.assign(scene as unknown as Record<string, unknown>, {
      areaManager,
      kirdy: kirdyStub,
      playerInput: playerInputStub,
      inhaleSystem: { update: vi.fn() },
      swallowSystem: { update: vi.fn(), consumeSwallowedPayload: vi.fn() },
      abilitySystem: { update: vi.fn(), applySwallowedPayload: vi.fn() },
      mapOverlay: mapOverlayStub,
      performanceMonitor: { update: vi.fn() },
      enemies: [],
      progressDirty: false,
    });

    (scene as any).lastSavedTileKey = 'central-hub:10,5';

    scene.update(1000, 16);

    const currentAreaId = areaManager.getCurrentAreaState().definition.id;
    expect(currentAreaId).toBe(AREA_IDS.MirrorCorridor);

    const spawn = areaManager.getCurrentAreaState().playerSpawnPosition;
    expect(playerSprite.x).toBe(spawn.x);
    expect(playerSprite.y).toBe(spawn.y);
    expect(playerSprite.body.velocity.x).toBe(0);
    expect(playerSprite.body.velocity.y).toBe(0);

    expect(areaManager.getDiscoveredAreas()).toContain(AREA_IDS.MirrorCorridor);
    expect(requestSaveSpy).toHaveBeenCalledTimes(1);
  });
});
