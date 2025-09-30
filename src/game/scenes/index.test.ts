import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  const createScenePluginMock = () => ({
    start: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
  });

  const createEventEmitterMock = () => ({
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  });

  const createLoaderMock = () => ({
    start: vi.fn(),
    once: vi.fn(),
  });

  const createKeyboardMock = () => ({
    once: vi.fn(),
    on: vi.fn(),
    addKey: vi.fn(() => ({ isDown: false })),
  });

  const createMatterSpriteMock = () => ({
    setFixedRotation: vi.fn().mockReturnThis(),
    setIgnoreGravity: vi.fn().mockReturnThis(),
    setFrictionAir: vi.fn().mockReturnThis(),
    setName: vi.fn().mockReturnThis(),
  });

  class PhaserSceneMock {
    public scene = createScenePluginMock();
    public events = createEventEmitterMock();
    public load = createLoaderMock();
    public input = {
      keyboard: createKeyboardMock(),
      on: vi.fn(),
      once: vi.fn(),
    };
    public add = {
      text: vi.fn(),
      image: vi.fn(() => ({
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        off: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
      })),
      container: vi.fn(() => ({
        add: vi.fn(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
      })),
    };
    public matter = {
      add: {
        sprite: vi.fn(() => createMatterSpriteMock()),
      },
    };

    constructor(_config?: string | Record<string, unknown>) {}
  }

  return {
    default: {
      Scene: PhaserSceneMock,
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Types: {
        Scenes: {
          SettingsConfig: class {},
        },
      },
    },
  };
});

const physicsSystemStubs = vi.hoisted(() => {
  const registerPlayer = vi.fn();
  const registerTerrain = vi.fn();
  const registerEnemy = vi.fn();
  const registerPlayerAttack = vi.fn();
  const destroyProjectile = vi.fn();
  const mock = vi.fn(() => ({
    registerPlayer,
    registerTerrain,
    registerEnemy,
    registerPlayerAttack,
    destroyProjectile,
  }));

  return {
    registerPlayer,
    registerTerrain,
    registerEnemy,
    registerPlayerAttack,
    destroyProjectile,
    mock,
  };
});

vi.mock('../physics/PhysicsSystem', () => ({
  PhysicsSystem: physicsSystemStubs.mock,
}));

import { BootScene, GameScene, MenuScene, PauseScene, SceneKeys, coreScenes } from './index';

describe('Scene registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    physicsSystemStubs.mock.mockClear();
    physicsSystemStubs.registerPlayer.mockClear();
  });

  it('exposes stable scene keys for coordination', () => {
    expect(SceneKeys.Boot).toBe('BootScene');
    expect(SceneKeys.Menu).toBe('MenuScene');
    expect(SceneKeys.Game).toBe('GameScene');
    expect(SceneKeys.Pause).toBe('PauseScene');
  });

  it('boot scene queues assets and transitions after load completes', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    expect(bootScene.load.once).toHaveBeenCalledWith('complete', expect.any(Function));
    expect(bootScene.load.start).toHaveBeenCalled();

    const [, onComplete] = bootScene.load.once.mock.calls[0];
    onComplete?.();

    expect(bootScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('menu scene can transition into the main game scene', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    expect(menuScene.input.keyboard.once).toHaveBeenCalledWith('keydown-SPACE', expect.any(Function));
    expect(menuScene.input.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const [, keyHandler] = menuScene.input.keyboard.once.mock.calls[0];
    keyHandler?.();

    expect(menuScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const [, pointerHandler] = menuScene.input.on.mock.calls[0];
    pointerHandler?.();

    expect(menuScene.scene.start).toHaveBeenCalledTimes(2);
  });

  it('game scene pauses by launching the pause scene overlay', () => {
    const gameScene = new GameScene();

    gameScene.create();

    expect(gameScene.input.keyboard.once).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));

    const [, handler] = gameScene.input.keyboard.once.mock.calls[0];
    handler?.();

    expect(gameScene.scene.launch).toHaveBeenCalledWith(SceneKeys.Pause);
  });

  it('pause scene resumes gameplay and closes itself', () => {
    const pauseScene = new PauseScene();

    pauseScene.create();

    expect(pauseScene.input.keyboard.once).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(pauseScene.input.once).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const [, keyHandler] = pauseScene.input.keyboard.once.mock.calls[0];
    keyHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(pauseScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Game);

    const [, pointerHandler] = pauseScene.input.once.mock.calls[0];
    pointerHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledTimes(2);
    expect(pauseScene.scene.resume).toHaveBeenCalledTimes(2);
  });

  it('registers all core scenes in the expected order', () => {
    expect(coreScenes).toEqual([
      BootScene,
      MenuScene,
      GameScene,
      PauseScene,
    ]);
  });
});
