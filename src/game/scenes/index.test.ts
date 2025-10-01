import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  const createScenePluginMock = () => ({
    start: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
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
    on: vi.fn(),
    off: vi.fn(),
    setBaseURL: vi.fn(),
    setPath: vi.fn(),
    image: vi.fn(),
    audio: vi.fn(),
    json: vi.fn(),
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

  const createTextMock = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
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
      text: vi.fn(() => createTextMock()),
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

const assetPipelineStubs = vi.hoisted(() => {
  const createAssetManifest = vi.fn(() => ({
    baseURL: '',
    path: 'assets/',
    images: [
      {
        key: 'hero',
        url: 'images/hero.png',
        fallbackUrl: 'images/hero-fallback.png',
      },
    ],
    audio: [
      {
        key: 'theme',
        urls: ['audio/theme.ogg'],
        fallbackUrl: 'audio/theme.mp3',
      },
    ],
    data: [
      {
        key: 'level-data',
        url: 'data/levels.json',
      },
    ],
  }));

  const queueAssetManifest = vi.fn(() => ({
    fallbackMap: new Map([
      ['hero', { type: 'image', url: 'images/hero-fallback.png' }],
      ['theme', { type: 'audio', url: 'audio/theme.mp3' }],
    ]),
  }));

  return {
    createAssetManifest,
    queueAssetManifest,
  };
});

vi.mock('../assets/pipeline', () => assetPipelineStubs);

import { BootScene, GameOverScene, GameScene, MenuScene, PauseScene, SceneKeys, coreScenes } from './index';

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
    expect(SceneKeys.GameOver).toBe('GameOverScene');
  });

  it('boot scene queues assets and transitions after load completes', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    expect(bootScene.load.once).toHaveBeenCalledWith('complete', expect.any(Function));
    expect(bootScene.load.start).toHaveBeenCalled();

    expect(assetPipelineStubs.createAssetManifest).toHaveBeenCalled();
    expect(assetPipelineStubs.queueAssetManifest).toHaveBeenCalledWith(
      bootScene.load,
      expect.objectContaining({
        images: expect.any(Array),
      }),
    );

    const [, onComplete] = bootScene.load.once.mock.calls[0];
    onComplete?.();

    expect(bootScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('boot scene displays progress feedback during loading', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    const progressText = bootScene.add.text.mock.results[0]?.value;
    expect(progressText?.setText).toHaveBeenCalledWith('Loading... 0%');

    const progressCall = bootScene.load.on.mock.calls.find(([event]) => event === 'progress');
    expect(progressCall?.[1]).toBeTypeOf('function');

    const [, progressHandler] = progressCall ?? [];
    progressHandler?.(0.42);

    expect(progressText?.setText).toHaveBeenCalledWith('Loading... 42%');
  });

  it('boot scene retries failed loads using fallback sources', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    const initialImageCalls = bootScene.load.image.mock.calls.length;
    const initialStartCalls = bootScene.load.start.mock.calls.length;

    const errorCall = bootScene.load.on.mock.calls.find(([event]) => event === 'loaderror');
    expect(errorCall?.[1]).toBeTypeOf('function');

    const [, errorHandler] = errorCall ?? [];
    errorHandler?.({ key: 'hero', type: 'image' });

    expect(bootScene.load.image).toHaveBeenCalledWith('hero', 'images/hero-fallback.png');
    expect(bootScene.load.image.mock.calls.length).toBe(initialImageCalls + 1);
    expect(bootScene.load.start.mock.calls.length).toBe(initialStartCalls + 1);

    errorHandler?.({ key: 'hero', type: 'image' });

    expect(bootScene.load.image.mock.calls.length).toBe(initialImageCalls + 1);
    expect(bootScene.load.start.mock.calls.length).toBe(initialStartCalls + 1);
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
    expect(pauseScene.input.keyboard.once).toHaveBeenCalledWith('keydown-R', expect.any(Function));
    expect(pauseScene.input.keyboard.once).toHaveBeenCalledWith('keydown-Q', expect.any(Function));
    expect(pauseScene.input.once).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const [, keyHandler] = pauseScene.input.keyboard.once.mock.calls[0];
    keyHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(pauseScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Game);

    const [, pointerHandler] = pauseScene.input.once.mock.calls[0];
    pointerHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledTimes(2);
    expect(pauseScene.scene.resume).toHaveBeenCalledTimes(2);

    const restartCall = pauseScene.input.keyboard.once.mock.calls.find(([event]) => event === 'keydown-R');
    const restartHandler = restartCall?.[1];
    expect(restartHandler).toBeInstanceOf(Function);
    restartHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Game);
    expect(pauseScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const quitCall = pauseScene.input.keyboard.once.mock.calls.find(([event]) => event === 'keydown-Q');
    const quitHandler = quitCall?.[1];
    expect(quitHandler).toBeInstanceOf(Function);
    quitHandler?.();

    expect(pauseScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('game over scene can restart or return to menu', () => {
    const gameOverScene = new GameOverScene();

    gameOverScene.create({ score: 123, ability: 'fire' as any });

    expect(gameOverScene.input.keyboard.once).toHaveBeenCalledWith('keydown-R', expect.any(Function));
    expect(gameOverScene.input.keyboard.once).toHaveBeenCalledWith('keydown-M', expect.any(Function));
    expect(gameOverScene.input.once).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const restartCall = gameOverScene.input.keyboard.once.mock.calls.find(([event]) => event === 'keydown-R');
    const restartHandler = restartCall?.[1];
    expect(restartHandler).toBeInstanceOf(Function);
    restartHandler?.();

    expect(gameOverScene.scene.stop).toHaveBeenCalledWith(SceneKeys.GameOver);
    expect(gameOverScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Game);
    expect(gameOverScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const menuCall = gameOverScene.input.keyboard.once.mock.calls.find(([event]) => event === 'keydown-M');
    const menuHandler = menuCall?.[1];
    expect(menuHandler).toBeInstanceOf(Function);
    menuHandler?.();

    expect(gameOverScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('registers all core scenes in the expected order', () => {
    expect(coreScenes).toEqual([
      BootScene,
      MenuScene,
      GameScene,
      PauseScene,
      GameOverScene,
    ]);
  });
});
