import { beforeEach, describe, expect, it, vi } from 'vitest';

const stubs = vi.hoisted(() => {
  const cursorKeys = {
    left: { isDown: false },
    right: { isDown: false },
    up: { isDown: false, justDown: false },
    space: { isDown: false, timeDown: 0 },
  };

  const keyboard = {
    createCursorKeys: vi.fn(() => cursorKeys),
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
  }

  return { cursorKeys, keyboard, scenePlugin, matterFactory, PhaserSceneMock };
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

import { GameScene } from './index';

describe('GameScene player integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Kirdy instance during scene setup', () => {
    const scene = new GameScene();

    createKirdyMock.mockReturnValue({
      update: vi.fn(),
    });

    scene.create();

    expect(createKirdyMock).toHaveBeenCalledWith(scene, { x: 160, y: 360 });
    expect((scene as any).kirdy).toBe(createKirdyMock.mock.results[0]?.value);
    expect(stubs.keyboard.createCursorKeys).toHaveBeenCalled();
  });

  it('forwards cursor key state to Kirdy during update', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();

    createKirdyMock.mockReturnValue({
      update: updateSpy,
    });

    scene.create();

    stubs.cursorKeys.left.isDown = true;
    stubs.cursorKeys.right.isDown = false;
    stubs.cursorKeys.up.isDown = false;
    stubs.cursorKeys.space.isDown = true;

    scene.update(100, 16);

    expect(updateSpy).toHaveBeenCalledWith(100, 16, {
      left: true,
      right: false,
      jumpPressed: true,
      hoverPressed: true,
    });
  });
});
