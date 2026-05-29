import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionState, FakeMatterSprite } from './testHarness';
import { AreaManager, AREA_IDS } from '../world/AreaManager';
import { SaveManager } from '../save/SaveManager';

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

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('統合: GameScene と SaveManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GameScene.update が進捗を保存し、SaveManager.load で同じスナップショットを再取得できる', () => {
    const storage = new MemoryStorage();
    const saveManager = new SaveManager({ storage, now: () => 42 });

    const scene = new GameScene();
    const areaManager = new AreaManager(AREA_IDS.CentralHub);
    const playerSprite = new FakeMatterSprite('kirdy').setPosition(320, 192);

    const stats = {
      hp: 4,
      maxHP: 6,
      score: 900,
      ability: 'ice',
    } as const;

    const kirdyStub = {
      sprite: playerSprite as unknown,
      update: vi.fn(),
      getHP: vi.fn(() => stats.hp),
      getMaxHP: vi.fn(() => stats.maxHP),
      getScore: vi.fn(() => stats.score),
      getAbility: vi.fn(() => stats.ability),
      toStatsSnapshot: vi.fn(() => ({ ...stats })),
    };

    const playerInputStub = {
      update: vi.fn(() => ({
        kirdy: { left: false, right: false, jumpPressed: false, hoverPressed: false },
        actions: actionState(),
      })),
    };

    Object.assign(scene as unknown as Record<string, unknown>, {
      areaManager,
      saveManager,
      kirdy: kirdyStub,
      playerInput: playerInputStub,
      inhaleSystem: { update: vi.fn() },
      swallowSystem: { update: vi.fn(), consumeSwallowedPayload: vi.fn() },
      abilitySystem: { update: vi.fn(), applySwallowedPayload: vi.fn() },
      performanceMonitor: { update: vi.fn() },
      enemies: [],
      progressDirty: true,
    });

    scene.update(2000, 16);

    const raw = storage.getItem('kirdy-progress');
    expect(raw).toBeTruthy();

    const payload = JSON.parse(raw!);
    expect(payload.version).toBe(1);
    expect(payload.data.player).toEqual({
      hp: 4,
      maxHP: 6,
      score: 900,
      ability: 'ice',
      position: { x: 320, y: 192 },
    });
    expect(payload.data.area.currentAreaId).toBe(AREA_IDS.CentralHub);
    expect(payload.data.area.lastKnownPlayerPosition).toEqual({ x: 320, y: 192 });
    expect(payload.data.area.completedAreas).toEqual([]);
    expect(payload.data.area.collectedItems).toEqual([]);
    expect(payload.data.settings).toEqual({
      volume: 0.4,
      controls: 'keyboard',
      difficulty: 'normal',
    });

    const loaded = saveManager.load();
    expect(loaded).toEqual(payload.data);
  });
});
