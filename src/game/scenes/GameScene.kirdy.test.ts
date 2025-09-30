import { beforeEach, describe, expect, it, vi } from 'vitest';

const stubs = vi.hoisted(() => {
  const keyboard = {
    once: vi.fn(),
  };

  const events = {
    once: vi.fn(),
  };

  const scenePlugin = {
    launch: vi.fn(),
  };

  const matterFactory = {
    add: {
      existing: vi.fn(),
    },
  };

  class PhaserSceneMock {
    public input = { keyboard };
    public matter = matterFactory;
    public scene = scenePlugin;
    public events = events;
  }

  return { keyboard, scenePlugin, matterFactory, events, PhaserSceneMock };
});

vi.mock('phaser', () => ({
  default: {
    Scene: stubs.PhaserSceneMock,
    AUTO: 'AUTO',
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Types: {
      Scenes: {
        SettingsConfig: class {},
      },
    },
  },
}));

const createKirdyMock = vi.hoisted(() => vi.fn());

vi.mock('../characters/Kirdy', () => ({
  createKirdy: createKirdyMock,
}));

const playerInputUpdateMock = vi.hoisted(() => vi.fn());
const playerInputDestroyMock = vi.hoisted(() => vi.fn());
const PlayerInputManagerMock = vi.hoisted(() =>
  vi.fn(() => ({
    update: playerInputUpdateMock,
    destroy: playerInputDestroyMock,
    simulateTouch: vi.fn(),
  })),
);

vi.mock('../input/PlayerInputManager', () => ({
  PlayerInputManager: PlayerInputManagerMock,
}));

const inhaleSystemUpdateMock = vi.hoisted(() => vi.fn());
const inhaleSystemAddTargetMock = vi.hoisted(() => vi.fn());
const inhaleSystemSetTargetsMock = vi.hoisted(() => vi.fn());
const inhaleSystemReleaseMock = vi.hoisted(() => vi.fn());
const InhaleSystemMock = vi.hoisted(() => vi.fn(() => ({
  update: inhaleSystemUpdateMock,
  addInhalableTarget: inhaleSystemAddTargetMock,
  setInhalableTargets: inhaleSystemSetTargetsMock,
  releaseCapturedTarget: inhaleSystemReleaseMock,
})));

vi.mock('../mechanics/InhaleSystem', () => ({
  InhaleSystem: InhaleSystemMock,
}));

const swallowSystemUpdateMock = vi.hoisted(() => vi.fn());
const swallowSystemConsumeMock = vi.hoisted(() => vi.fn());
const SwallowSystemMock = vi.hoisted(() =>
  vi.fn(() => ({
    update: swallowSystemUpdateMock,
    consumeSwallowedPayload: swallowSystemConsumeMock,
  })),
);

vi.mock('../mechanics/SwallowSystem', () => ({
  SwallowSystem: SwallowSystemMock,
}));

import { GameScene } from './index';

describe('GameScene player integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createSnapshot(overrides?: Partial<ReturnType<typeof playerInputUpdateMock>>) {
    return {
      kirdy: {
        left: false,
        right: false,
        jumpPressed: false,
        hoverPressed: false,
        ...overrides?.kirdy,
      },
      actions: {
        inhale: { isDown: false, justPressed: false },
        swallow: { isDown: false, justPressed: false },
        spit: { isDown: false, justPressed: false },
        discard: { isDown: false, justPressed: false },
        ...overrides?.actions,
      },
    };
  }

  it('creates a Kirdy instance and player input manager during setup', () => {
    const scene = new GameScene();
    const kirdyInstance = { update: vi.fn() };
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(createKirdyMock).toHaveBeenCalledWith(scene, { x: 160, y: 360 });
    expect(PlayerInputManagerMock).toHaveBeenCalledWith(scene);
    expect((scene as any).kirdy).toBe(kirdyInstance);
    expect((scene as any).playerInput).toBeDefined();
    expect(stubs.keyboard.once).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(stubs.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
  });

  it('forwards sampled input snapshots to Kirdy on update', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    createKirdyMock.mockReturnValue({ update: updateSpy });

    const snapshot = createSnapshot({
      kirdy: {
        left: true,
        right: false,
        jumpPressed: true,
        hoverPressed: true,
      },
      actions: {
        inhale: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();
    scene.update(100, 16);

    expect(playerInputUpdateMock).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(100, 16, snapshot.kirdy);
  });

  it('creates the inhale and swallow systems and forwards action state updates', () => {
    const scene = new GameScene();
    const kirdyInstance = { update: vi.fn() };
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot({
      actions: {
        inhale: { isDown: true, justPressed: true },
        swallow: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(InhaleSystemMock).toHaveBeenCalledWith(scene, kirdyInstance);
    const inhaleInstance = InhaleSystemMock.mock.results[0]?.value;
    expect(SwallowSystemMock).toHaveBeenCalledWith(scene, kirdyInstance, inhaleInstance);

    scene.update(32, 16);

    expect(inhaleSystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
    expect(swallowSystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
  });

  it('exposes helpers to manage inhalable targets from other systems', () => {
    const scene = new GameScene();
    const kirdyInstance = { update: vi.fn() };
    createKirdyMock.mockReturnValue(kirdyInstance);

    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const fakeTarget = {} as any;
    const fakeList = [fakeTarget] as any;

    scene.addInhalableTarget(fakeTarget);
    scene.setInhalableTargets(fakeList);

    expect(inhaleSystemAddTargetMock).toHaveBeenCalledWith(fakeTarget);
    expect(inhaleSystemSetTargetsMock).toHaveBeenCalledWith(fakeList);
  });

  it('cleans up the player input manager during shutdown', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue({ update: vi.fn() });
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownHandler = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown')?.[1];
    expect(shutdownHandler).toBeInstanceOf(Function);

    shutdownHandler?.();

    expect(playerInputDestroyMock).toHaveBeenCalled();
  });

  it('exposes the latest player input snapshot for other systems', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    createKirdyMock.mockReturnValue({ update: updateSpy });

    const firstSnapshot = createSnapshot({
      kirdy: { left: true },
      actions: {
        inhale: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(firstSnapshot);

    scene.create();
    scene.update(0, 16);

    const exposedFirst = scene.getPlayerInputSnapshot();
    expect(exposedFirst).toBe(firstSnapshot);
    expect(scene.getActionState('inhale')).toBe(firstSnapshot.actions.inhale);

    const secondSnapshot = createSnapshot({
      kirdy: { right: true },
      actions: {
        swallow: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(secondSnapshot);
    scene.update(16, 16);

    const exposedSecond = scene.getPlayerInputSnapshot();
    expect(exposedSecond).toBe(secondSnapshot);
    expect(scene.getActionState('swallow')).toBe(secondSnapshot.actions.swallow);
  });
});
