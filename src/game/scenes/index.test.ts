import { beforeEach, describe, expect, it, vi } from 'vitest';
import Phaser from 'phaser';

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

vi.mock('phaser', () => {
  const createScenePluginMock = () => ({
    start: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    bringToTop: vi.fn(),
    get: vi.fn(),
    isActive: vi.fn(() => false),
    isPaused: vi.fn(() => false),
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

  const createTextureManagerMock = () => ({
    setDefaultFilter: vi.fn(),
    get: vi.fn(),
  });

  const createKeyboardMock = () => ({
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
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
    setPosition: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPadding: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const createRectangleMock = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
  });

  const createGraphicsMock = () => ({
    fillStyle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  class PhaserSceneMock {
    public scene = createScenePluginMock();
    public events = createEventEmitterMock();
    public load = createLoaderMock();
    public scale = { width: 800, height: 600 };
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
      rectangle: vi.fn(() => createRectangleMock()),
      graphics: vi.fn(() => createGraphicsMock()),
    };
    public tweens = {
      add: vi.fn(),
    };
    public matter = {
      add: {
        sprite: vi.fn(() => createMatterSpriteMock()),
      },
    };
    public textures = createTextureManagerMock();

    constructor(_config?: string | Record<string, unknown>) {}
  }

  return {
    default: {
      Scene: PhaserSceneMock,
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH', NO_CENTER: 'NO_CENTER' },
      Textures: { FilterMode: { LINEAR: 'LINEAR', NEAREST: 'NEAREST' } },
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
  const clearTerrain = vi.fn();
  const mock = vi.fn(() => ({
    registerPlayer,
    registerTerrain,
    registerEnemy,
    registerPlayerAttack,
    destroyProjectile,
    clearTerrain,
  }));

  return {
    registerPlayer,
    registerTerrain,
    registerEnemy,
    registerPlayerAttack,
    destroyProjectile,
    clearTerrain,
    mock,
  };
});

vi.mock('../physics/PhysicsSystem', () => ({
  PhysicsSystem: physicsSystemStubs.mock,
}));

const audioManagerStubs = vi.hoisted(() => {
  const playBgm = vi.fn();
  const setMasterVolume = vi.fn();
  const setMuted = vi.fn();
  const toggleMute = vi.fn();
  const stopBgm = vi.fn();
  const instance = { playBgm, setMasterVolume, setMuted, toggleMute, stopBgm };
  const mock = vi.fn(() => instance);

  return {
    mock,
    playBgm,
    setMasterVolume,
    setMuted,
    toggleMute,
    stopBgm,
  };
});

vi.mock('../audio/AudioManager', () => ({
  AudioManager: audioManagerStubs.mock,
}));

const saveManagerStubs = vi.hoisted(() => {
  type SaveManagerInstance = {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    resetPlayerPosition: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };

  const instances: SaveManagerInstance[] = [];

  const createInstance = () => {
    const load = vi.fn(() => undefined) as ReturnType<typeof vi.fn>;
    const save = vi.fn() as ReturnType<typeof vi.fn>;
    const resetPlayerPosition = vi.fn() as ReturnType<typeof vi.fn>;
    const clear = vi.fn() as ReturnType<typeof vi.fn>;
    const updateSettings = vi.fn(() => ({
      volume: 0.4,
      controls: 'keyboard',
      difficulty: 'normal',
    })) as ReturnType<typeof vi.fn>;

    const instance: SaveManagerInstance = {
      load,
      save,
      resetPlayerPosition,
      clear,
      updateSettings,
    };

    instances.push(instance);
    return instance;
  };

  const defaultFactory = () => createInstance();
  const mock = vi.fn<[], SaveManagerInstance>(defaultFactory) as unknown as ReturnType<typeof vi.fn>;

  const reset = () => {
    instances.length = 0;
    mock.mockImplementation(defaultFactory);
  };

  return {
    mock,
    instances,
    createInstance,
    reset,
  };
});

vi.mock('../save/SaveManager', () => ({
  SaveManager: saveManagerStubs.mock,
  DEFAULT_SETTINGS: {
    volume: 0.4,
    controls: 'keyboard',
    difficulty: 'normal',
  },
}));

const playerInputStubs = vi.hoisted(() => {
  type PlayerInputInstance = {
    update: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    setControlScheme: ReturnType<typeof vi.fn>;
    setSwallowDownEnabled: ReturnType<typeof vi.fn>;
  };

  const instances: PlayerInputInstance[] = [];

  const createInstance = () => {
    const update = vi.fn(() => ({
      kirdy: { left: false, right: false, jumpPressed: false, hoverPressed: false },
      actions: {
        inhale: { isDown: false, justPressed: false },
        swallow: { isDown: false, justPressed: false },
        spit: { isDown: false, justPressed: false },
        discard: { isDown: false, justPressed: false },
      },
    })) as ReturnType<typeof vi.fn>;
    const destroy = vi.fn() as ReturnType<typeof vi.fn>;
    const setControlScheme = vi.fn() as ReturnType<typeof vi.fn>;
    const setSwallowDownEnabled = vi.fn() as ReturnType<typeof vi.fn>;

    const instance: PlayerInputInstance = {
      update,
      destroy,
      setControlScheme,
      setSwallowDownEnabled,
    };

    instances.push(instance);
    return instance;
  };

  const defaultFactory = () => createInstance();
  const mock = vi.fn<[], PlayerInputInstance>(defaultFactory) as unknown as ReturnType<typeof vi.fn>;

  const reset = () => {
    instances.length = 0;
    mock.mockImplementation(defaultFactory);
  };

  return {
    mock,
    instances,
    createInstance,
    reset,
  };
});

vi.mock('../input/PlayerInputManager', () => ({
  PlayerInputManager: playerInputStubs.mock,
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

import {
  BootScene,
  GameOverScene,
  GameScene,
  MenuScene,
  PauseScene,
  SettingsScene,
  SceneKeys,
  coreScenes,
} from './index';

type SettingsSceneCreateArg = Parameters<SettingsScene['create']>[0];

describe('Scene registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    physicsSystemStubs.mock.mockClear();
    physicsSystemStubs.registerPlayer.mockClear();
    physicsSystemStubs.registerTerrain.mockClear();
    physicsSystemStubs.registerEnemy.mockClear();
    physicsSystemStubs.registerPlayerAttack.mockClear();
    physicsSystemStubs.destroyProjectile.mockClear();
    physicsSystemStubs.clearTerrain.mockClear();
    audioManagerStubs.mock.mockClear();
    audioManagerStubs.playBgm.mockClear();
    audioManagerStubs.setMasterVolume.mockClear();
    audioManagerStubs.setMuted.mockClear();
    audioManagerStubs.toggleMute.mockClear();
    audioManagerStubs.stopBgm.mockClear();
    saveManagerStubs.reset();
    playerInputStubs.reset();
  });

  it('exposes stable scene keys for coordination', () => {
    expect(SceneKeys.Boot).toBe('BootScene');
    expect(SceneKeys.Menu).toBe('MenuScene');
    expect(SceneKeys.Game).toBe('GameScene');
     expect(SceneKeys.Settings).toBe('SettingsScene');
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

    const loadOnceMock = asMock(bootScene.load.once);
    const completeCall = loadOnceMock.mock.calls.find(([event]) => event === 'complete');
    expect(completeCall?.[1]).toBeTypeOf('function');

    const [, onComplete] = completeCall ?? [];
    onComplete?.();

    expect(bootScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('boot scene displays progress feedback during loading', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    const addTextMock = asMock(bootScene.add.text);
    const progressText = addTextMock.mock.results[0]?.value;
    expect(progressText?.setText).toHaveBeenCalledWith('Loading... 0%');

    const loadOnMock = asMock(bootScene.load.on);
    const progressCall = loadOnMock.mock.calls.find(([event]) => event === 'progress');
    expect(progressCall?.[1]).toBeTypeOf('function');

    const [, progressHandler] = progressCall ?? [];
    progressHandler?.(0.42);

    expect(progressText?.setText).toHaveBeenCalledWith('Loading... 42%');
  });

  it('boot scene retries failed loads using fallback sources', () => {
    const bootScene = new BootScene();

    bootScene.preload();

    const loadOnMock = asMock(bootScene.load.on);
    const loadImageMock = asMock(bootScene.load.image);
    const loadStartMock = asMock(bootScene.load.start);
    const initialImageCalls = loadImageMock.mock.calls.length;
    const initialStartCalls = loadStartMock.mock.calls.length;

    const errorCall = loadOnMock.mock.calls.find(([event]) => event === 'loaderror');
    expect(errorCall?.[1]).toBeTypeOf('function');

    const [, errorHandler] = errorCall ?? [];
    errorHandler?.({ key: 'hero', type: 'image' });

    expect(bootScene.load.image).toHaveBeenCalledWith('hero', 'images/hero-fallback.png');
    expect(loadImageMock.mock.calls.length).toBe(initialImageCalls + 1);
    expect(loadStartMock.mock.calls.length).toBe(initialStartCalls + 1);

    errorHandler?.({ key: 'hero', type: 'image' });

    expect(loadImageMock.mock.calls.length).toBe(initialImageCalls + 1);
    expect(loadStartMock.mock.calls.length).toBe(initialStartCalls + 1);
  });

  it('BootSceneがタイルセットのフィルタとミップマップ設定を初期化する', () => {
    const bootScene = new BootScene();

    const texture = {
      setFilter: vi.fn(),
      setGenerateMipmaps: vi.fn(),
    };
    const texturesGetMock = asMock(bootScene.textures.get);
    texturesGetMock.mockReturnValue(texture as any);

    bootScene.preload();

    const textureManager = bootScene.textures as unknown as {
      setDefaultFilter: ReturnType<typeof vi.fn>;
    };
    expect(textureManager.setDefaultFilter).toHaveBeenCalledWith(Phaser.Textures.FilterMode.NEAREST);

    const loadOnceMock = asMock(bootScene.load.once);
    const tilesetCall = loadOnceMock.mock.calls.find(
      ([event]) => event === 'filecomplete-image-tileset-main',
    );
    const wallTextureCall = loadOnceMock.mock.calls.find(
      ([event]) => event === 'filecomplete-image-wall-texture',
    );
    expect(tilesetCall?.[1]).toBeTypeOf('function');
    expect(wallTextureCall?.[1]).toBeTypeOf('function');

    const [, tilesetHandler] = tilesetCall ?? [];
    const [, wallTextureHandler] = wallTextureCall ?? [];

    tilesetHandler?.();
    wallTextureHandler?.();

    expect(bootScene.textures.get).toHaveBeenCalledWith('tileset-main');
    expect(bootScene.textures.get).toHaveBeenCalledWith('wall-texture');
    expect(texture.setFilter).toHaveBeenCalledWith(Phaser.Textures.FilterMode.NEAREST);
    expect(texture.setGenerateMipmaps).toHaveBeenCalledWith(false);
  });

  it('menu scene can transition into the main game scene', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    const menuKeyboard = menuScene.input.keyboard!;
    const keyboardOnceMock = asMock(menuKeyboard.once);
    const inputOnMock = asMock(menuScene.input.on);

    expect(menuKeyboard.once).toHaveBeenCalledWith('keydown-SPACE', expect.any(Function));
    expect(menuScene.input.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const [, keyHandler] = keyboardOnceMock.mock.calls[0];
    keyHandler?.();

    expect(menuScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const [, pointerHandler] = inputOnMock.mock.calls[0];
    pointerHandler?.();

    expect(menuScene.scene.start).toHaveBeenCalledTimes(2);
  });

  it('menu scene zones instruction panels and renders rounded keycaps', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    const addTextMock = asMock(menuScene.add.text);
    const promptCallIndex = addTextMock.mock.calls.findIndex(
      ([, , text]) => text === 'Press Space or Tap to Start',
    );
    expect(promptCallIndex).toBeGreaterThanOrEqual(0);

    const prompt = addTextMock.mock.results[promptCallIndex]?.value;
    expect(prompt?.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(prompt?.setPosition).toHaveBeenCalledWith(400, 144);

    const movementSection = addTextMock.mock.calls.find(([, , text]) => text === 'Movement');
    const abilitiesSection = addTextMock.mock.calls.find(([, , text]) => text === 'Abilities');
    const menuSection = addTextMock.mock.calls.find(([, , text]) => text === 'Menu Shortcuts');
    const settingsSection = addTextMock.mock.calls.find(([, , text]) => text === 'Settings Adjustments');
    expect(movementSection).toBeTruthy();
    expect(abilitiesSection).toBeTruthy();
    expect(menuSection).toBeTruthy();
    expect(settingsSection).toBeTruthy();

    const addRectangleMock = asMock(menuScene.add.rectangle);
    const zonePanels = addRectangleMock.mock.calls.filter(([, , , , fillColor]) => fillColor === 0x0d162e);
    expect(zonePanels.length).toBe(4);
    zonePanels.forEach(([, , , , , fillAlpha]) => {
      expect(fillAlpha).toBeCloseTo(0.85);
    });

    const panelXs = Array.from(new Set(zonePanels.map(([x]) => x))).sort((a, b) => a - b);
    expect(panelXs.length).toBe(2);

    const panelTops = zonePanels.map(([, centerY, , height]) => centerY - height / 2);
    const panelBottoms = zonePanels.map(([, centerY, , height]) => centerY + height / 2);
    const panelHeights = zonePanels.map(([, , , height]) => height);
    const firstPanelHeight = panelHeights[0];
    expect(firstPanelHeight).toBeGreaterThan(0);
    panelHeights.forEach((height) => {
      expect(height).toBe(firstPanelHeight);
    });
    expect(Math.min(...panelTops)).toBeGreaterThanOrEqual(140);
    expect(Math.max(...panelBottoms)).toBeLessThanOrEqual(600);

    const rowTops = Array.from(new Set(panelTops.map((value) => value.toFixed(2)))).map(Number);
    expect(rowTops.length).toBe(2);
    expect(rowTops[0]).toBeLessThan(rowTops[1]);

    const movementZone = zonePanels[0];
    expect(movementZone).toBeDefined();
    const movementZoneTop = (movementZone?.[1] ?? 0) - (movementZone?.[3] ?? 0) / 2;

    const addGraphicsMock = asMock(menuScene.add.graphics);
    const expectedKeycaps = [
      '← / A',
      '→ / D',
      'Space',
      'C',
      'S',
      'Z',
      'X',
      'Esc',
      'O',
      'R',
      '← / →',
      '↑ / ↓',
      'C',
      'Esc',
    ];
    const graphicsCalls = addGraphicsMock.mock.results.map((result) => {
      const graphics = result?.value as {
        fillRoundedRect: ReturnType<typeof vi.fn>;
      } | undefined;
      expect(graphics).toBeDefined();
      const fillCalls = graphics ? asMock(graphics.fillRoundedRect).mock.calls : [];
      expect(fillCalls.length).toBeGreaterThan(0);
      const [x, y, width, height, radius] = fillCalls[0] ?? [];
      return { graphics, x, y, width, height, radius };
    });

    const zonePanelGraphics = graphicsCalls.filter((call) => (call.width ?? 0) > 200);
    const keycapGraphics = graphicsCalls.filter((call) => (call.width ?? 0) <= 200);

    expect(zonePanelGraphics.length).toBe(4);
    zonePanelGraphics.forEach((call) => {
      expect(call.radius).toBe(16);
      expect(call.height).toBeGreaterThan(100);
    });

    expect(keycapGraphics.length).toBe(expectedKeycaps.length);
    keycapGraphics.forEach((call) => {
      expect(call.radius).toBe(10);
    });

    const getKeycapWidth = (label: string) => {
      const keycapIndex = expectedKeycaps.indexOf(label);
      const call = keycapGraphics[keycapIndex];
      const width = call?.width ?? 0;
      return width;
    };

    expect(getKeycapWidth('← / A')).toBeGreaterThan(getKeycapWidth('O'));

    const findTextCall = (value: string) =>
      addTextMock.mock.calls.find(([, , text]) => typeof text === 'string' && text === value);

    expectedKeycaps.forEach((label) => {
      const call = findTextCall(label);
      expect(call).toBeTruthy();
      const style = call?.[3] as Phaser.Types.GameObjects.Text.TextStyle | undefined;
      expect(style).toMatchObject({
        fontFamily: 'monospace',
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
      });
      expect(style?.backgroundColor).toBeUndefined();
    });

    const expectedKeycapCounts: Record<string, number> = {
      '← / A': 1,
      '→ / D': 1,
      Space: 1,
      C: 2,
      S: 1,
      Z: 1,
      X: 1,
      Esc: 2,
      O: 1,
      R: 1,
      '← / →': 1,
      '↑ / ↓': 1,
    };
    Object.entries(expectedKeycapCounts).forEach(([label, count]) => {
      const matches = addTextMock.mock.calls.filter(([, , text, style]) =>
        text === label && style?.fontFamily === 'monospace'
      );
      expect(matches.length).toBe(count);
    });

    const captionTexts = [
      'Left',
      'Right',
      'Jump',
      'Inhale',
      'Spit',
      'Pause',
      'Settings',
      'Reset',
      'Volume',
      'Difficulty',
      'Controls',
      'Close',
    ];
    captionTexts.forEach((caption) => {
      const call = findTextCall(caption);
      expect(call).toBeTruthy();
    });

    const touchCall = findTextCall('Touch');
    expect(touchCall).toBeTruthy();

    const getCaptionY = (caption: string) => {
      const call = findTextCall(caption);
      expect(call).toBeTruthy();
      return call?.[1] ?? 0;
    };

    const movementRowCaptions = ['Left', 'Right', 'Jump'] as const;
    const movementRowYs = movementRowCaptions.map((caption) => getCaptionY(caption));
    movementRowYs.forEach((currentY, index) => {
      if (index === 0) {
        return;
      }
      const previousY = movementRowYs[index - 1];
      expect(currentY - previousY).toBeGreaterThanOrEqual(32);
    });

    const findTextCallNear = (value: string, targetY?: number) => {
      const matches = addTextMock.mock.calls.filter(([, , text]) => typeof text === 'string' && text === value);
      if (matches.length <= 1 || targetY === undefined) {
        return matches[0];
      }
      return matches.find(([, y]) => Math.abs((y ?? 0) - targetY) < 1) ?? matches[0];
    };

    const ensureCaptionRightOfKeys = (caption: string, keyLabels: string[]) => {
      const captionCall = findTextCall(caption);
      expect(captionCall).toBeTruthy();
      const captionX = captionCall?.[0] ?? 0;
      const captionY = captionCall?.[1] ?? 0;
      const keyXs = keyLabels.map((label) => {
        const keyCall = findTextCallNear(label, captionY);
        expect(keyCall).toBeTruthy();
        return keyCall?.[0] ?? 0;
      });
      const maxKeyX = Math.max(...keyXs);
      expect(captionX).toBeGreaterThan(maxKeyX + 12);
      const firstKeyY = findTextCallNear(keyLabels[0], captionY)?.[1] ?? 0;
      expect(Math.abs((captionY ?? 0) - firstKeyY)).toBeLessThanOrEqual(40);
    };

    ensureCaptionRightOfKeys('Left', ['← / A']);
    ensureCaptionRightOfKeys('Right', ['→ / D']);
    ensureCaptionRightOfKeys('Jump', ['Space']);
    ensureCaptionRightOfKeys('Inhale', ['S']);
    ensureCaptionRightOfKeys('Spit', ['X']);
    ensureCaptionRightOfKeys('Pause', ['Esc']);
    ensureCaptionRightOfKeys('Settings', ['O']);
    ensureCaptionRightOfKeys('Reset', ['R']);
    ensureCaptionRightOfKeys('Volume', ['← / →']);
    ensureCaptionRightOfKeys('Difficulty', ['↑ / ↓']);
    ensureCaptionRightOfKeys('Controls', ['C']);
    ensureCaptionRightOfKeys('Close', ['Esc']);

    const leftKeyCall = findTextCall('← / A');

    const movementTitleToKeys = (leftKeyCall?.[1] ?? 0) - (movementSection?.[1] ?? 0);
    expect(movementTitleToKeys).toBeGreaterThanOrEqual(44);

    const hoverCaptionCall = findTextCall('Jump');
    expect(touchCall?.[1]).toBeGreaterThanOrEqual((hoverCaptionCall?.[1] ?? 0) + 12);

    const movementSectionTopPadding = (movementSection?.[1] ?? 0) - movementZoneTop;
    expect(movementSectionTopPadding).toBeGreaterThanOrEqual(6);

    const touchBottomPadding = Math.max(...panelBottoms) - ((touchCall?.[1] ?? 0) + 18);
    expect(touchBottomPadding).toBeGreaterThanOrEqual(12);

    expect((settingsSection?.[1] ?? 0)).toBe(menuSection?.[1] ?? 0);

    expect(
      addTextMock.mock.calls.some(
        ([, , text]) => typeof text === 'string' && text.includes('Press O to'),
      ),
    ).toBe(false);

    const oKeyCall = findTextCall('O');
    const rKeyCall = findTextCall('R');
    expect(oKeyCall?.[1]).toBeGreaterThan((touchCall?.[1] ?? 0));
    expect(rKeyCall?.[1]).toBeGreaterThan((oKeyCall?.[1] ?? 0));
  });

  it('menu scene animates the start prompt with a gentle blink', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    const addTextMock = asMock(menuScene.add.text);
    const promptCallIndex = addTextMock.mock.calls.findIndex(
      ([, , text]) => text === 'Press Space or Tap to Start',
    );
    expect(promptCallIndex).toBeGreaterThanOrEqual(0);

    const prompt = addTextMock.mock.results[promptCallIndex]?.value;
    const tweenAddMock = asMock(menuScene.tweens.add);
    const blinkCall = tweenAddMock.mock.calls.find(([config]) => config?.targets === prompt);

    expect(blinkCall).toBeDefined();

    const blinkConfig = blinkCall?.[0] ?? {};
    expect(blinkConfig).toMatchObject({
      targets: prompt,
      yoyo: true,
      repeat: -1,
    });
    expect(typeof blinkConfig.duration).toBe('number');
    expect(blinkConfig.duration).toBe(1200);
    const alphaConfig = blinkConfig.alpha as { from: number; to: number } | undefined;
    expect(alphaConfig).toBeDefined();
    expect(alphaConfig?.from).toBe(1);
    expect(alphaConfig?.to).toBe(0);
    expect(blinkConfig.ease).toBe('Sine.easeInOut');
  });

  it('menu scene surfaces critical error notices when provided via scene data', () => {
    const menuScene = new MenuScene();

    menuScene.create({ errorMessage: 'テストエラー発生' });

    const addTextMock = asMock(menuScene.add.text);
    const errorCall = addTextMock.mock.calls.find(([, , text]) =>
      typeof text === 'string' && text.includes('テストエラー発生'),
    );

    expect(errorCall).toBeDefined();
    const [, , , style] = errorCall ?? [];
    expect(style).toMatchObject({ color: expect.stringContaining('#ff') });
  });

  it('menu scene opens the settings overlay and pauses itself', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    expect(saveManagerStubs.instances.length).toBeGreaterThan(0);

    const menuKeyboard = menuScene.input.keyboard!;
    const keyboardOnceMock = asMock(menuKeyboard.once);
    const settingsCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();

    const [, handler] = settingsCall ?? [];
    expect(handler).toBeInstanceOf(Function);

    asMock(menuScene.scene.launch).mockClear();
    asMock(menuScene.scene.pause).mockClear();

    handler?.();

    expect(menuScene.scene.launch).toHaveBeenCalledWith(
      SceneKeys.Settings,
      expect.objectContaining({ returnTo: SceneKeys.Menu }),
    );
    expect(menuScene.scene.pause).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('menu scene resets the stored spawn point when requested', () => {
    const menuScene = new MenuScene();

    menuScene.create();

    const menuKeyboard = menuScene.input.keyboard!;
    const keyboardOnceMock = asMock(menuKeyboard.once);
    const resetCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-R');
    expect(resetCall).toBeTruthy();

    const [, handler] = resetCall ?? [];
    expect(handler).toBeInstanceOf(Function);

    const saveManagerInstance = saveManagerStubs.instances.at(-1);
    expect(saveManagerInstance).toBeDefined();
    saveManagerInstance?.resetPlayerPosition.mockClear();

    const addTextMock = asMock(menuScene.add.text);
    const initialCallCount = addTextMock.mock.calls.length;

    handler?.();

    expect(saveManagerInstance?.resetPlayerPosition).toHaveBeenCalledTimes(1);

    const confirmationCall = addTextMock.mock.calls
      .slice(initialCallCount)
      .find(([, , text]) => typeof text === 'string' && text.includes('初期位置'));
    expect(confirmationCall).toBeTruthy();
  });

  it('game scene pauses by launching the pause scene overlay', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const gameKeyboard = gameScene.input.keyboard!;
    const keyboardOnMock = asMock(gameKeyboard.on);

    expect(gameKeyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));

    const [, handler] = keyboardOnMock.mock.calls[0];
    handler?.();

    expect(gameScene.scene.pause).toHaveBeenCalledWith(SceneKeys.Game);
    expect(gameScene.scene.launch).toHaveBeenCalledWith(SceneKeys.Pause);
  });

  it('game scene calls postFX.addBlur with its postFX context', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const blurEffect = { destroy: vi.fn() };
    const add = vi.fn<[string, number, number, number], typeof blurEffect>(() => blurEffect);

    const postFX = {
      add,
      addBlur: vi.fn((radius: number, quality: number, strength: number) => {
        return add('Blur', radius, quality, strength);
      }),
    };

    (gameScene as unknown as { cameras: { main: { postFX: typeof postFX } } }).cameras = {
      main: { postFX },
    };

    expect(() => gameScene.pauseGame()).not.toThrow();
    expect(postFX.addBlur).toHaveBeenCalledWith(4, 1, 2);
    expect(add).toHaveBeenCalledWith('Blur', 4, 1, 2);
    expect((gameScene as unknown as { menuBlurEffect?: unknown }).menuBlurEffect).toBe(blurEffect);
  });

  it('game scene skips menu blur gracefully when postFX.addBlur throws', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const blurError = new TypeError('addBlur failed');
    const addBlur = vi.fn<[number, number, number], void>(() => {
      throw blurError;
    });

    (gameScene as unknown as {
      cameras: {
        main: { postFX: { addBlur: ReturnType<typeof vi.fn<[number, number, number], void>> } };
      };
    }).cameras = {
      main: {
        postFX: {
          addBlur,
        },
      },
    };

    expect(() => gameScene.pauseGame()).not.toThrow();
    expect(addBlur).toHaveBeenCalledWith(4, 1, 2);
    expect(gameScene.scene.pause).toHaveBeenCalledWith(SceneKeys.Game);
    expect(gameScene.scene.launch).toHaveBeenCalledWith(SceneKeys.Pause);

    const internalState = gameScene as unknown as { menuBlurEffect?: unknown };
    expect(internalState.menuBlurEffect).toBeUndefined();
  });

  it('game scene applies menu blur when the game over overlay launches', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const blurEffect = { destroy: vi.fn() };
    const addBlur = vi.fn<[number, number, number], unknown>(() => blurEffect);

    (gameScene as unknown as { cameras: { main: { postFX: { addBlur: typeof addBlur } } } }).cameras = {
      main: {
        postFX: {
          addBlur,
        },
      },
    };

    const kirdyStub = {
      update: vi.fn(),
      getMouthContent: vi.fn(() => undefined),
      getHP: vi.fn(() => 6),
      getMaxHP: vi.fn(() => 6),
      getScore: vi.fn(() => 4200),
      getAbility: vi.fn(() => 'fire'),
    };

    (gameScene as unknown as { kirdy?: typeof kirdyStub }).kirdy = kirdyStub;

    const internal = gameScene as unknown as { handlePlayerDefeated: () => void };
    internal.handlePlayerDefeated();

    expect(addBlur).toHaveBeenCalledWith(4, 1, 2);
    const internalState = gameScene as unknown as { menuBlurEffect?: unknown };
    expect(internalState.menuBlurEffect).toBe(blurEffect);
  });

  it('game scene keeps overlay depth when blur cannot be applied', () => {
    const gameScene = new GameScene();

    gameScene.create();

    (gameScene as unknown as { cameras: { main: { postFX: Record<string, unknown> } } }).cameras = {
      main: {
        postFX: {},
      },
    };

    const kirdyStub = {
      update: vi.fn(),
      getMouthContent: vi.fn(() => undefined),
      getHP: vi.fn(() => 6),
      getMaxHP: vi.fn(() => 6),
      getScore: vi.fn(() => 4200),
      getAbility: vi.fn(() => 'fire'),
    };

    (gameScene as unknown as { kirdy?: typeof kirdyStub }).kirdy = kirdyStub;

    (gameScene as unknown as { handlePlayerDefeated: () => void }).handlePlayerDefeated();

    const internalState = gameScene as unknown as { menuOverlayDepth?: number; menuBlurEffect?: unknown };
    expect(internalState.menuOverlayDepth).toBe(1);
    expect(internalState.menuBlurEffect).toBeUndefined();

    gameScene.deactivateMenuOverlay();
    expect(internalState.menuOverlayDepth).toBe(0);
  });

  it('pause scene re-activates gameplay blur when opening settings', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const blurEffect = { destroy: vi.fn() };
    const addBlur = vi.fn<[number, number, number], unknown>(() => blurEffect);
    (gameScene as unknown as { cameras: { main: { postFX: { addBlur: typeof addBlur } } } }).cameras = {
      main: {
        postFX: {
          addBlur,
        },
      },
    };

    gameScene.pauseGame();
    gameScene.deactivateMenuOverlay({ force: true });

    const internal = gameScene as unknown as { menuOverlayDepth?: number };
    expect(internal.menuOverlayDepth).toBe(0);

    addBlur.mockClear();

    const pauseScene = new PauseScene();
    const overlaySpy = vi.spyOn(gameScene as any, 'activateMenuOverlay');

    asMock(pauseScene.scene.get).mockReturnValue(gameScene);

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnceMock = asMock(pauseKeyboard.once);
    const settingsCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();
    const [, handler] = settingsCall ?? [];

    handler?.();

    expect(pauseScene.scene.get).toHaveBeenCalledWith(SceneKeys.Game);
    expect(overlaySpy).toHaveBeenCalled();

    expect(addBlur).toHaveBeenCalledWith(4, 1, 2);
    expect(internal.menuOverlayDepth).toBeGreaterThan(0);
  });

  it('game scene keeps the pause listener active and cleans it up on shutdown', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const gameKeyboard = gameScene.input.keyboard!;
    const keyboardOnMock = asMock(gameKeyboard.on);

    const pauseCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-ESC');
    expect(pauseCall).toBeTruthy();
    const [, pauseHandler] = pauseCall ?? [];
    expect(pauseHandler).toBeInstanceOf(Function);

    pauseHandler?.();
    expect(gameScene.scene.launch).toHaveBeenCalledWith(SceneKeys.Pause);

    const eventsOnceMock = asMock(gameScene.events.once);
    const shutdownCall = eventsOnceMock.mock.calls.find(([event]) => event === 'shutdown');
    const shutdownHandler = shutdownCall?.[1];
    expect(shutdownHandler).toBeInstanceOf(Function);

    const keyboardOffMock = asMock(gameKeyboard.off);
    keyboardOffMock.mockClear();
    shutdownHandler?.();

    expect(gameKeyboard.off).toHaveBeenCalledWith('keydown-ESC', pauseHandler);
  });

  it('pause scene removes its escape handler while the settings scene is active', () => {
    const pauseScene = new PauseScene();
    const gameScene = new GameScene();

    asMock(pauseScene.scene.get).mockReturnValue(gameScene);

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnMock = asMock(pauseKeyboard.on);

    const escapeCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-ESC');
    expect(escapeCall).toBeTruthy();
    const [, escapeHandler] = escapeCall ?? [];
    expect(escapeHandler).toBeInstanceOf(Function);

    const settingsCall = asMock(pauseKeyboard.once).mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();
    const [, openSettingsHandler] = settingsCall ?? [];
    expect(openSettingsHandler).toBeInstanceOf(Function);

    asMock(pauseKeyboard.off).mockClear();

    openSettingsHandler?.();

    expect(pauseKeyboard.off).toHaveBeenCalledWith('keydown-ESC', escapeHandler);
  });

  it('pause scene rebinds its escape handler after the settings scene resumes it', () => {
    const pauseScene = new PauseScene();
    const gameScene = new GameScene();

    asMock(pauseScene.scene.get).mockReturnValue(gameScene);

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnMock = asMock(pauseKeyboard.on);

    const escapeCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-ESC');
    expect(escapeCall).toBeTruthy();
    const [, escapeHandler] = escapeCall ?? [];
    expect(escapeHandler).toBeInstanceOf(Function);

    const keyboardOnceMock = asMock(pauseKeyboard.once);
    const settingsCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();
    const [, openSettingsHandler] = settingsCall ?? [];
    expect(openSettingsHandler).toBeInstanceOf(Function);

    const eventsOnceMock = asMock(pauseScene.events.once);
    eventsOnceMock.mockClear();
    keyboardOnMock.mockClear();

    openSettingsHandler?.();

    const resumeCall = eventsOnceMock.mock.calls.find(([event]) => event === 'resume');
    expect(resumeCall).toBeTruthy();
    const [, resumeHandler] = resumeCall ?? [];
    expect(resumeHandler).toBeInstanceOf(Function);

    keyboardOnMock.mockClear();
    asMock(pauseScene.scene.resume).mockClear();
    asMock(pauseScene.scene.stop).mockClear();

    resumeHandler?.();

    expect(pauseScene.scene.bringToTop).toHaveBeenCalledWith(SceneKeys.Pause);

    const rebindCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-ESC');
    const reboundEscape = rebindCall?.[1] as (() => void) | undefined;
    expect(reboundEscape).toBe(escapeHandler);

    reboundEscape?.();
    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(pauseScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Game);
  });

  it('game scene skips its update loop while the pause menu overlay is active', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const enemyManagerUpdate = vi.fn();
    const kirdyStub = {
      update: vi.fn(),
      getMouthContent: vi.fn(() => undefined),
      getHP: vi.fn(() => 6),
      getMaxHP: vi.fn(() => 6),
      getScore: vi.fn(() => 0),
      getAbility: vi.fn(() => undefined),
    };
    const swallowSystemStub = {
      update: vi.fn(),
      consumeSwallowedPayload: vi.fn(() => undefined),
    };
    const abilitySystemStub = {
      update: vi.fn(),
      applySwallowedPayload: vi.fn(),
    };

    (gameScene as unknown as {
      enemyManager?: { update: (delta: number) => void };
      kirdy?: typeof kirdyStub;
      swallowSystem?: typeof swallowSystemStub;
      abilitySystem?: typeof abilitySystemStub;
      maintainEnemyPopulation?: (delta: number) => void;
      updateAreaState?: () => void;
      syncHudHpWithPlayer?: () => void;
      persistProgress?: () => void;
      runtimeErrorCaptured?: boolean;
    }).enemyManager = {
      update: enemyManagerUpdate,
    };
    (gameScene as unknown as { kirdy?: typeof kirdyStub }).kirdy = kirdyStub;
    (gameScene as unknown as { swallowSystem?: typeof swallowSystemStub }).swallowSystem = swallowSystemStub;
    (gameScene as unknown as { abilitySystem?: typeof abilitySystemStub }).abilitySystem = abilitySystemStub;
    (gameScene as unknown as { maintainEnemyPopulation?: (delta: number) => void }).maintainEnemyPopulation = vi.fn();
    (gameScene as unknown as { updateAreaState?: () => void }).updateAreaState = vi.fn();
    (gameScene as unknown as { syncHudHpWithPlayer?: () => void }).syncHudHpWithPlayer = vi.fn();
    (gameScene as unknown as { persistProgress?: () => void }).persistProgress = vi.fn();
    (gameScene as unknown as { runtimeErrorCaptured?: boolean }).runtimeErrorCaptured = false;

    expect(enemyManagerUpdate).not.toHaveBeenCalled();

    gameScene.pauseGame();

    gameScene.update(0, 16);
    expect(enemyManagerUpdate).not.toHaveBeenCalled();
  });

  it('game scene halts gameplay updates after player defeat triggers the game over menu', () => {
    const gameScene = new GameScene();

    gameScene.create();

    const enemyManagerUpdate = vi.fn();
    const kirdyStub = {
      update: vi.fn(),
      getMouthContent: vi.fn(() => undefined),
      getHP: vi.fn(() => 6),
      getMaxHP: vi.fn(() => 6),
      getScore: vi.fn(() => 2500),
      getAbility: vi.fn(() => 'fire'),
    };
    const swallowSystemStub = {
      update: vi.fn(),
      consumeSwallowedPayload: vi.fn(() => undefined),
    };
    const abilitySystemStub = {
      update: vi.fn(),
      applySwallowedPayload: vi.fn(),
    };

    (gameScene as unknown as {
      enemyManager?: { update: (delta: number) => void };
      kirdy?: typeof kirdyStub;
      swallowSystem?: typeof swallowSystemStub;
      abilitySystem?: typeof abilitySystemStub;
      maintainEnemyPopulation?: (delta: number) => void;
      updateAreaState?: () => void;
      syncHudHpWithPlayer?: () => void;
      persistProgress?: () => void;
      runtimeErrorCaptured?: boolean;
    }).enemyManager = {
      update: enemyManagerUpdate,
    };
    (gameScene as unknown as { kirdy?: typeof kirdyStub }).kirdy = kirdyStub;
    (gameScene as unknown as { swallowSystem?: typeof swallowSystemStub }).swallowSystem = swallowSystemStub;
    (gameScene as unknown as { abilitySystem?: typeof abilitySystemStub }).abilitySystem = abilitySystemStub;
    (gameScene as unknown as { maintainEnemyPopulation?: (delta: number) => void }).maintainEnemyPopulation = vi.fn();
    (gameScene as unknown as { updateAreaState?: () => void }).updateAreaState = vi.fn();
    (gameScene as unknown as { syncHudHpWithPlayer?: () => void }).syncHudHpWithPlayer = vi.fn();
    (gameScene as unknown as { persistProgress?: () => void }).persistProgress = vi.fn();
    (gameScene as unknown as { runtimeErrorCaptured?: boolean }).runtimeErrorCaptured = false;

    const internal = gameScene as unknown as { handlePlayerDefeated: () => void };
    internal.handlePlayerDefeated();

    gameScene.update(0, 16);
    expect(enemyManagerUpdate).not.toHaveBeenCalled();
  });

  it('game scene starts background music when created', () => {
    const gameScene = new GameScene();

    gameScene.create();

    expect(audioManagerStubs.mock).toHaveBeenCalledWith(gameScene);
    expect(audioManagerStubs.playBgm).toHaveBeenCalledWith('bgm-main', expect.any(Object));
  });

  it('game scene forwards audio controls to the audio manager', () => {
    const gameScene = new GameScene();

    gameScene.create();
    gameScene.setAudioVolume(0.6);
    gameScene.setAudioMuted(true);
    gameScene.toggleAudioMute();

    expect(audioManagerStubs.setMasterVolume).toHaveBeenCalledWith(0.6);
    expect(audioManagerStubs.setMuted).toHaveBeenCalledWith(true);
    expect(audioManagerStubs.toggleMute).toHaveBeenCalled();
  });

  it('game scene applies saved settings when available', () => {
    saveManagerStubs.mock.mockImplementation(() => {
      const instance = saveManagerStubs.createInstance();
      instance.load.mockReturnValue({
        player: { hp: 6, maxHP: 6, score: 0, ability: undefined, position: { x: 0, y: 0 } },
        area: undefined,
        settings: {
          volume: 0.45,
          controls: 'touch',
          difficulty: 'hard',
        },
      });
      return instance;
    });

    const gameScene = new GameScene();

    gameScene.create();

    expect(audioManagerStubs.setMasterVolume).toHaveBeenCalledWith(0.45);

    const inputInstance = playerInputStubs.instances.at(-1);
    expect(inputInstance?.setControlScheme).toHaveBeenCalledWith('touch');

    const settingsSnapshot = (gameScene as any).getSettingsSnapshot?.();
    expect(settingsSnapshot).toMatchObject({
      volume: expect.any(Number),
      controls: 'touch',
      difficulty: 'hard',
    });
  });

  it('ゲームシーンは壁タイルのフレームが存在しない場合に矩形描画へフォールバックする', () => {
    const gameScene = new GameScene();

    const tileMap = {
      columns: 1,
      rows: 1,
      tileSize: 32,
      getTileAt: vi.fn(() => 'wall'),
    };

    const areaManager = {
      getCurrentAreaState: vi.fn(() => ({ tileMap })),
    };
    (gameScene as any).areaManager = areaManager;

    const placements = (gameScene as any).collectWallTiles();
    expect(placements).toHaveLength(1);
    tileMap.getTileAt.mockClear();

    const texture = {
      getFrameNames: vi.fn(() => []),
      frames: {},
    };
    const textures = gameScene.textures as any;
    textures.exists = vi.fn((key: string) => key !== 'wall-texture');
    asMock(textures.get).mockReturnValue(texture as any);

    const rectangleVisual = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const imageVisual = {
      ...rectangleVisual,
      setFrame: vi.fn(() => {
        throw new Error('missing frame');
      }),
    };
    expect('setFrame' in imageVisual).toBe(true);

    const addImage = vi.fn(() => imageVisual);
    const addRectangle = vi.fn(() => rectangleVisual);

    const addFactory = (gameScene as unknown as { add: Record<string, any> }).add;
    addFactory.image = addImage;
    addFactory.rectangle = addRectangle;

    expect(addFactory.image).toBe(addImage);

    expect(() => (gameScene as any).buildTerrainVisuals()).not.toThrow();
    expect(addImage).not.toHaveBeenCalled();
    expect(addRectangle).toHaveBeenCalledTimes(1);
    expect(rectangleVisual.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(tileMap.getTileAt).toHaveBeenCalledTimes(2);
    expect((gameScene as any).terrainTiles).toHaveLength(1);
  });

  it('terrain colliders register as matter game objects so physics callbacks can resolve gameObject references', () => {
    const gameScene = new GameScene();

    const registerTerrain = vi.fn();
    const clearTerrain = vi.fn();
    (gameScene as unknown as { physicsSystem: { registerTerrain: typeof registerTerrain; clearTerrain: typeof clearTerrain } }).physicsSystem = {
      registerTerrain,
      clearTerrain,
    };

    const tileMap = {
      columns: 1,
      rows: 1,
      tileSize: 16,
      getTileAt: vi.fn(() => 'wall'),
    };

    (gameScene as unknown as { areaManager: { getCurrentAreaState: () => unknown } }).areaManager = {
      getCurrentAreaState: () => ({ tileMap }),
    };

    const addRectangle = vi.fn(() => ({
      setVisible: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }));

    const matterAdd = (gameScene as any).matter?.add ?? {};
    matterAdd.rectangle = vi.fn(() => ({ body: { id: 42 } }));
    matterAdd.gameObject = vi.fn((gameObject: any) => {
      const collider = {
        ...gameObject,
        setIgnoreGravity: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setName: vi.fn().mockReturnThis(),
      };
      collider.body = { id: 42, gameObject: collider };
      return collider;
    });
    (gameScene as any).matter.add = matterAdd;
    (gameScene as any).add.rectangle = addRectangle;

    (gameScene as any).rebuildTerrainColliders();

    expect(registerTerrain).toHaveBeenCalledTimes(1);
    const [collider] = registerTerrain.mock.calls[0] ?? [];
    expect(collider?.body?.gameObject).toBe(collider);
  });

  it('pause scene resumes gameplay and closes itself', () => {
    const pauseScene = new PauseScene();

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const pauseKeyboardOnMock = asMock(pauseKeyboard.on);
    const pauseKeyboardOnceMock = asMock(pauseKeyboard.once);
    const pauseInputOnceMock = asMock(pauseScene.input.once);

    expect(pauseKeyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(pauseKeyboard.once).toHaveBeenCalledWith('keydown-R', expect.any(Function));
    expect(pauseKeyboard.once).toHaveBeenCalledWith('keydown-Q', expect.any(Function));
    expect(pauseScene.input.once).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const [, keyHandler] = pauseKeyboardOnMock.mock.calls.find(([event]) => event === 'keydown-ESC') ?? [];
    keyHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(pauseScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Game);

    const [, pointerHandler] = pauseInputOnceMock.mock.calls[0];
    pointerHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledTimes(2);
    expect(pauseScene.scene.resume).toHaveBeenCalledTimes(2);

    const restartCall = pauseKeyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-R');
    const restartHandler = restartCall?.[1];
    expect(restartHandler).toBeInstanceOf(Function);
    restartHandler?.();

    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Game);
    expect(pauseScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const quitCall = pauseKeyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-Q');
    const quitHandler = quitCall?.[1];
    expect(quitHandler).toBeInstanceOf(Function);
    quitHandler?.();

    expect(pauseScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('pause scene restart resets the stored spawn before relaunching the game', () => {
    const pauseScene = new PauseScene();

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnceMock = asMock(pauseKeyboard.once);
    const restartCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-R');
    expect(restartCall).toBeTruthy();

    const [, restartHandler] = restartCall ?? [];
    expect(restartHandler).toBeInstanceOf(Function);

    const saveManagerInstance = saveManagerStubs.instances.at(-1);
    expect(saveManagerInstance).toBeDefined();
    saveManagerInstance?.resetPlayerPosition.mockClear();

    restartHandler?.();

    expect(saveManagerInstance?.resetPlayerPosition).toHaveBeenCalledTimes(1);
    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(pauseScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Game);
    expect(pauseScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);
  });

  it('positions the pause menu text around the screen center', () => {
    const pauseScene = new PauseScene();

    pauseScene.create();

    const addTextMock = asMock(pauseScene.add.text);
    const centerX = pauseScene.scale.width / 2;
    const centerY = pauseScene.scale.height / 2;

    expect(addTextMock).toHaveBeenCalledTimes(5);

    const [titleArgs, resumeArgs, restartArgs, quitArgs, settingsArgs] = addTextMock.mock.calls;

    expect(titleArgs?.[0]).toBe(centerX);
    expect(titleArgs?.[1]).toBeCloseTo(centerY - 60, 5);

    expect(resumeArgs?.[0]).toBe(centerX);
    expect(resumeArgs?.[1]).toBeCloseTo(centerY - 10, 5);

    expect(restartArgs?.[0]).toBe(centerX);
    expect(restartArgs?.[1]).toBeCloseTo(centerY + 30, 5);

    expect(quitArgs?.[0]).toBe(centerX);
    expect(quitArgs?.[1]).toBeCloseTo(centerY + 70, 5);

    expect(settingsArgs?.[0]).toBe(centerX);
    expect(settingsArgs?.[1]).toBeCloseTo(centerY + 110, 5);
  });

  it('pause scene opens the settings overlay while keeping gameplay paused', () => {
    const pauseScene = new PauseScene();

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnceMock = asMock(pauseKeyboard.once);
    const settingsCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();

    const [, handler] = settingsCall ?? [];
    expect(handler).toBeInstanceOf(Function);

    asMock(pauseScene.scene.launch).mockClear();
    asMock(pauseScene.scene.pause).mockClear();

    handler?.();

    expect(pauseScene.scene.launch).toHaveBeenCalledWith(
      SceneKeys.Settings,
      expect.objectContaining({ returnTo: SceneKeys.Pause }),
    );
    expect(pauseScene.scene.pause).toHaveBeenCalledWith(SceneKeys.Pause);
  });

  it('pause scene avoids pausing the game scene again when it is already paused', () => {
    const pauseScene = new PauseScene();
    const gameScene = new GameScene();

    asMock(pauseScene.scene.get).mockReturnValue(gameScene);

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const keyboardOnceMock = asMock(pauseKeyboard.once);
    const settingsCall = keyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-O');
    expect(settingsCall).toBeTruthy();

    const [, handler] = settingsCall ?? [];
    expect(handler).toBeInstanceOf(Function);

    asMock(pauseScene.scene.pause).mockClear();
    asMock(pauseScene.scene.isActive).mockReturnValue(true);
    asMock(pauseScene.scene.isPaused).mockReturnValue(true);

    handler?.();

    expect(pauseScene.scene.pause).not.toHaveBeenCalledWith(SceneKeys.Game);
    expect(pauseScene.scene.pause).toHaveBeenCalledWith(SceneKeys.Pause);
  });

  it('applies a blur effect to the gameplay camera while paused and removes it on resume', () => {
    const gameScene = new GameScene();

    const remove = vi.fn();
    const clear = vi.fn();
    const blurEffect = { destroy: vi.fn() } as const;
    const addBlur = vi.fn(() => blurEffect);

    const postFX = { addBlur, remove, clear };
    (gameScene as unknown as { cameras: { main: { postFX: typeof postFX } } }).cameras = {
      main: { postFX },
    };

    gameScene.pauseGame();

    expect(addBlur).toHaveBeenCalledTimes(1);

    gameScene.deactivateMenuOverlay();

    expect(remove).toHaveBeenCalledWith(blurEffect);
    expect(clear).not.toHaveBeenCalled();
  });

  it('game over scene can restart or return to menu', () => {
    const gameOverScene = new GameOverScene();

    gameOverScene.create({ score: 123, ability: 'fire' as any });

    const gameOverKeyboard = gameOverScene.input.keyboard!;
    const gameOverKeyboardOnceMock = asMock(gameOverKeyboard.once);
    const gameOverInputOnceMock = asMock(gameOverScene.input.once);

    expect(gameOverKeyboard.once).toHaveBeenCalledWith('keydown-R', expect.any(Function));
    expect(gameOverKeyboard.once).toHaveBeenCalledWith('keydown-M', expect.any(Function));
    expect(gameOverScene.input.once).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    const restartCall = gameOverKeyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-R');
    const restartHandler = restartCall?.[1];
    expect(restartHandler).toBeInstanceOf(Function);
    restartHandler?.();

    expect(gameOverScene.scene.stop).toHaveBeenCalledWith(SceneKeys.GameOver);
    expect(gameOverScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Game);
    expect(gameOverScene.scene.start).toHaveBeenCalledWith(SceneKeys.Game);

    const menuCall = gameOverKeyboardOnceMock.mock.calls.find(([event]) => event === 'keydown-M');
    const menuHandler = menuCall?.[1];
    expect(menuHandler).toBeInstanceOf(Function);
    menuHandler?.();

    expect(gameOverScene.scene.start).toHaveBeenCalledWith(SceneKeys.Menu);
  });

  it('centers the game over menu contents around the screen midpoint', () => {
    const gameOverScene = new GameOverScene();

    gameOverScene.create({ score: 999, ability: 'ice' as any, maxHP: 8 });

    const addTextMock = asMock(gameOverScene.add.text);
    const centerX = gameOverScene.scale.width / 2;
    const centerY = gameOverScene.scale.height / 2;

    expect(addTextMock).toHaveBeenCalledTimes(5);

    const [titleArgs, scoreArgs, abilityArgs, restartArgs, menuArgs] = addTextMock.mock.calls;

    expect(titleArgs?.[0]).toBe(centerX);
    expect(titleArgs?.[1]).toBeCloseTo(centerY - 80, 5);

    expect(scoreArgs?.[0]).toBe(centerX);
    expect(scoreArgs?.[1]).toBeCloseTo(centerY - 20, 5);

    expect(abilityArgs?.[0]).toBe(centerX);
    expect(abilityArgs?.[1]).toBeCloseTo(centerY + 20, 5);

    expect(restartArgs?.[0]).toBe(centerX);
    expect(restartArgs?.[1]).toBeCloseTo(centerY + 70, 5);

    expect(menuArgs?.[0]).toBe(centerX);
    expect(menuArgs?.[1]).toBeCloseTo(centerY + 110, 5);
  });

  it('settings scene cycles configuration values and resumes the invoking scene', () => {
    saveManagerStubs.mock.mockImplementation(() => {
      const instance = saveManagerStubs.createInstance();
      instance.load.mockReturnValue({
        settings: {
          volume: 0.4,
          controls: 'keyboard',
          difficulty: 'normal',
        },
      });
      return instance;
    });

    const settingsScene = new SettingsScene();

    settingsScene.create({ returnTo: SceneKeys.Menu });

    const settingsKeyboard = settingsScene.input.keyboard!;
    const saveManagerInstance = saveManagerStubs.instances.at(-1);
    expect(saveManagerInstance).toBeDefined();

    const keyboardOnMock = asMock(settingsKeyboard.on);

    const leftCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-LEFT');
    expect(leftCall).toBeTruthy();
    const [, leftHandler] = leftCall ?? [];
    saveManagerInstance?.updateSettings.mockClear();
    leftHandler?.();
    expect(saveManagerInstance?.updateSettings).toHaveBeenCalledWith({ volume: 0.3 });

    const controlCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-C');
    expect(controlCall).toBeTruthy();
    const [, controlHandler] = controlCall ?? [];
    saveManagerInstance?.updateSettings.mockClear();
    controlHandler?.();
    expect(saveManagerInstance?.updateSettings).toHaveBeenCalledWith({ controls: 'touch' });

    const difficultyCall = keyboardOnMock.mock.calls.find(([event]) => event === 'keydown-UP');
    expect(difficultyCall).toBeTruthy();
    const [, difficultyHandler] = difficultyCall ?? [];
    saveManagerInstance?.updateSettings.mockClear();
    difficultyHandler?.();
    expect(saveManagerInstance?.updateSettings).toHaveBeenCalledWith({ difficulty: 'hard' });

    const escCall = asMock(settingsKeyboard.once).mock.calls.find(([event]) => event === 'keydown-ESC');
    expect(escCall).toBeTruthy();
    const [, escHandler] = escCall ?? [];
    asMock(settingsScene.scene.resume).mockClear();
    asMock(settingsScene.scene.stop).mockClear();
    escHandler?.();
    expect(settingsScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Menu);
    expect(settingsScene.scene.stop).toHaveBeenCalledWith(SceneKeys.Settings);
  });

  it('settings scene skips repausing the game when it is already paused', () => {
    const gameScene = new GameScene();
    const settingsScene = new SettingsScene();

    asMock(settingsScene.scene.get).mockImplementation((key: unknown) =>
      key === SceneKeys.Game ? gameScene : undefined,
    );
    asMock(settingsScene.scene.isActive).mockImplementation((key: unknown) => key === SceneKeys.Game);
    asMock(settingsScene.scene.isPaused).mockImplementation((key: unknown) => key === SceneKeys.Game);
    asMock(settingsScene.scene.pause).mockClear();

    settingsScene.create({ returnTo: SceneKeys.Pause });

    expect(settingsScene.scene.pause).not.toHaveBeenCalledWith(SceneKeys.Game);
  });

  it('settings scene resumes the pause menu and brings it to the front when closed with ESC', () => {
    const gameScene = new GameScene();
    const settingsScene = new SettingsScene();

    asMock(settingsScene.scene.get).mockImplementation((key: unknown) =>
      key === SceneKeys.Game ? gameScene : undefined,
    );
    asMock(settingsScene.scene.isActive).mockImplementation((key: unknown) => key === SceneKeys.Game);
    asMock(settingsScene.scene.isPaused).mockImplementation((key: unknown) => key === SceneKeys.Game);

    settingsScene.create({ returnTo: SceneKeys.Pause });

    const escCall = asMock(settingsScene.input.keyboard!.once).mock.calls.find(
      ([event]) => event === 'keydown-ESC',
    );
    expect(escCall).toBeTruthy();
    const [, escHandler] = escCall ?? [];
    expect(escHandler).toBeInstanceOf(Function);

    const deactivateSpy = vi.spyOn(gameScene, 'deactivateMenuOverlay');

    asMock(settingsScene.scene.resume).mockClear();
    asMock(settingsScene.scene.bringToTop).mockClear();

    escHandler?.();

    expect(deactivateSpy).toHaveBeenCalledTimes(2);
    expect(settingsScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Pause);
    expect(settingsScene.scene.bringToTop).toHaveBeenCalledWith(SceneKeys.Pause);
  });

  it('clears the gameplay blur after returning from settings to resume the game', () => {
    const gameScene = new GameScene();
    gameScene.create();
    gameScene.pauseGame();

    const pauseScene = new PauseScene();
    const settingsScene = new SettingsScene();
    const scenePlugin = pauseScene.scene;

    asMock(scenePlugin.get).mockReturnValue(gameScene);

    const launchMock = asMock(scenePlugin.launch);
    launchMock.mockImplementation((key, data) => {
      if (key === SceneKeys.Settings) {
        asMock(settingsScene.scene.get).mockImplementation((target: unknown) =>
          target === SceneKeys.Game ? gameScene : undefined,
        );
        asMock(settingsScene.scene.isActive).mockImplementation((target: unknown) =>
          target === SceneKeys.Game,
        );
        asMock(settingsScene.scene.isPaused).mockImplementation((target: unknown) =>
          target === SceneKeys.Game,
        );
        settingsScene.create(data as SettingsSceneCreateArg);
      }
    });

    pauseScene.create();

    const pauseKeyboard = pauseScene.input.keyboard!;
    const settingsCall = asMock(pauseKeyboard.once).mock.calls.find(([event]) => event === 'keydown-O');
    const [, openSettingsHandler] = settingsCall ?? [];
    expect(openSettingsHandler).toBeInstanceOf(Function);

    openSettingsHandler?.();

    const resumeCall = asMock(pauseScene.events.once).mock.calls.find(([event]) => event === 'resume');
    const [, resumeHandler] = resumeCall ?? [];
    expect(resumeHandler).toBeInstanceOf(Function);

    const settingsKeyboard = settingsScene.input.keyboard!;
    const escCall = asMock(settingsKeyboard.once).mock.calls.find(([event]) => event === 'keydown-ESC');
    const [, escHandler] = escCall ?? [];
    expect(escHandler).toBeInstanceOf(Function);

    escHandler?.();
    resumeHandler?.();

    const escapeCall = asMock(pauseKeyboard.on).mock.calls.find(([event]) => event === 'keydown-ESC');
    const [, escapeHandler] = escapeCall ?? [];
    expect(escapeHandler).toBeInstanceOf(Function);

    const overlayState = gameScene as unknown as { menuOverlayDepth?: number };

    escapeHandler?.();

    expect(pauseScene.scene.resume).toHaveBeenCalledWith(SceneKeys.Game);
    expect(overlayState.menuOverlayDepth).toBe(0);
  });

  it('registers all core scenes in the expected order', () => {
    expect(coreScenes).toEqual([
      BootScene,
      MenuScene,
      GameScene,
      PauseScene,
      SettingsScene,
      GameOverScene,
    ]);
  });
});
