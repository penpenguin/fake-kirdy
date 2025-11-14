import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { MapSystem, type HealItemInstance } from '../world/MapSystem';

const stubs = vi.hoisted(() => {
  const keyboardManager = {
    enabled: true,
    resetKeys: vi.fn(),
    releaseAllKeys: vi.fn(),
    clearCaptures: vi.fn(),
  };
  const keyboard = {
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    enabled: true,
    resetKeys: vi.fn(),
    manager: keyboardManager,
  };

  const events = {
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  const scenePlugin = {
    launch: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
  };

  const addRectangleMock = vi.fn();
  const addImageMock = vi.fn();
  const addSpriteMock = vi.fn();
  const addTextMock = vi.fn();
  const addContainerMock = vi.fn();

  const createDisplayRectangle = () => ({
    setVisible: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const createDisplayImage = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const createDisplaySprite = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
  });

  const createDisplayText = () => ({
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const createDisplayContainer = () => {
    const containerChildren: any[] = [];
    const container: any = {
      add: vi.fn((items: any[] | any) => {
        const normalized = Array.isArray(items) ? items : [items];
        containerChildren.push(...normalized);
        return container;
      }),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      list: containerChildren,
    };
    return container;
  };

  const createDisplayList = () => {
    const listeners: Array<(child: any) => void> = [];
    return {
      list: [] as any[],
      on: vi.fn((event: string, handler: (child: any) => void) => {
        if (event === 'add') {
          listeners.push(handler);
        }
      }),
      off: vi.fn((event: string, handler: (child: any) => void) => {
        if (event === 'add') {
          const index = listeners.indexOf(handler);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        }
      }),
      emitAdd: (child: any) => {
        listeners.slice().forEach((listener) => listener(child));
      },
    };
  };

  const matterFactory = {
    add: {
      existing: vi.fn(),
      gameObject: vi.fn(),
      rectangle: vi.fn(),
    },
  };

  const terrainTexture = {
    hasFrame: vi.fn((frame: string) => frame === 'wall'),
    getFrame: vi.fn((frame: string) => (frame === 'wall' ? {} : undefined)),
    getFrameNames: vi.fn(() => ['wall']),
    frames: { wall: {} },
  };

  const textures = {
    exists: vi.fn(
      (key: string) =>
        key === 'tileset-main' ||
        key === 'door-marker' ||
        key === 'wall-texture' ||
        key === 'goal-door' ||
        key === 'heal-orb',
    ),
    get: vi.fn((key: string) => (key === 'tileset-main' ? terrainTexture : undefined)),
  };

  const cameraStartFollow = vi.fn();
  const cameraSetViewport = vi.fn();
  const cameraIgnore = vi.fn();
  const hudCameraIgnore = vi.fn();
  const hudCameraSetScroll = vi.fn().mockReturnThis();
  const camerasAdd = vi.fn(() => ({
    setScroll: hudCameraSetScroll,
    ignore: hudCameraIgnore,
    destroy: vi.fn(),
  }));

  class PhaserSceneMock {
    public input = {
      keyboard,
      on: vi.fn(),
      once: vi.fn(),
      enabled: true,
      mouse: { enabled: true },
      touch: { enabled: true },
    };
    public matter = matterFactory;
    public scene = scenePlugin;
    public events = events;
    public scale = { width: 800, height: 600 };
    public children = createDisplayList();
    public add = {
      rectangle: (...args: unknown[]) => {
        const result = addRectangleMock(...args as any);
        const rect = result ?? createDisplayRectangle();
        this.children.list.push(rect);
        this.children.emitAdd(rect);
        return rect;
      },
      image: (...args: unknown[]) => {
        const result = addImageMock(...args as any);
        const image = result ?? createDisplayImage();
        this.children.list.push(image);
        this.children.emitAdd(image);
        return image;
      },
      sprite: (...args: unknown[]) => {
        const result = addSpriteMock(...args as any);
        const sprite = result ?? createDisplaySprite();
        sprite.x = (args[0] as number) ?? 0;
        sprite.y = (args[1] as number) ?? 0;
        this.children.list.push(sprite);
        this.children.emitAdd(sprite);
        return sprite;
      },
      text: (...args: unknown[]) => {
        const result = addTextMock(...args as any);
        const text = result ?? createDisplayText();
        this.children.list.push(text);
        this.children.emitAdd(text);
        return text;
      },
      container: (...args: unknown[]) => {
        const result = addContainerMock(...args as any);
        const container = result ?? createDisplayContainer();
        this.children.list.push(container as any);
        this.children.emitAdd(container as any);
        return container;
      },
    };
    public textures = textures;
    public cameras = {
      main: {
        worldView: { x: 0, y: 0, width: 800, height: 600 },
        startFollow: cameraStartFollow,
        setViewport: cameraSetViewport,
        ignore: cameraIgnore,
        setBounds: vi.fn(),
      },
      add: camerasAdd,
      remove: vi.fn(),
    };
  }

  return {
    keyboard,
    keyboardManager,
    scenePlugin,
    matterFactory,
    events,
    cameraStartFollow,
    cameraSetViewport,
    cameraIgnore,
    hudCameraIgnore,
    hudCameraSetScroll,
    camerasAdd,
    addRectangleMock,
    addImageMock,
    addSpriteMock,
    addTextMock,
    addContainerMock,
    childrenCreateList: createDisplayList,
    PhaserSceneMock,
    textures,
    terrainTexture,
  };
});

vi.mock('phaser', () => ({
  default: {
    Scene: stubs.PhaserSceneMock,
    AUTO: 'AUTO',
    WEBGL: 'WEBGL',
    CANVAS: 'CANVAS',
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Types: {
      Scenes: {
        SettingsConfig: class {},
      },
    },
  },
}));

const performanceMonitorStubs = vi.hoisted(() => {
  const update = vi.fn();
  const monitorInstance = { update };
  const monitorMock = vi.fn((_options?: unknown) => monitorInstance);
  return { update, monitorMock };
});

vi.mock('../performance/PerformanceMonitor', () => ({
  PerformanceMonitor: performanceMonitorStubs.monitorMock,
}));

const renderingPreferenceStubs = vi.hoisted(() => ({
  recordLowFpsEvent: vi.fn(),
  recordStableFpsEvent: vi.fn(),
}));

vi.mock('../performance/RenderingModePreference', () => renderingPreferenceStubs);

const createKirdyMock = vi.hoisted(() => vi.fn());

vi.mock('../characters/Kirdy', () => ({
  createKirdy: createKirdyMock,
}));

const playerInputUpdateMock = vi.hoisted(() => vi.fn());
const playerInputDestroyMock = vi.hoisted(() => vi.fn());
const playerInputSetSwallowDownMock = vi.hoisted(() => vi.fn());
const PlayerInputManagerMock = vi.hoisted(() =>
  vi.fn(() => ({
    update: playerInputUpdateMock,
    destroy: playerInputDestroyMock,
    simulateTouch: vi.fn(),
    setSwallowDownEnabled: playerInputSetSwallowDownMock,
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

const abilitySystemUpdateMock = vi.hoisted(() => vi.fn());
const abilitySystemApplyPayloadMock = vi.hoisted(() => vi.fn());
const AbilitySystemMock = vi.hoisted(() =>
  vi.fn(() => ({
    update: abilitySystemUpdateMock,
    applySwallowedPayload: abilitySystemApplyPayloadMock,
  })),
);

vi.mock('../mechanics/AbilitySystem', () => ({
  AbilitySystem: AbilitySystemMock,
}));

const enemyUpdateMock = vi.hoisted(() => vi.fn());
const enemyIsDefeatedMock = vi.hoisted(() => vi.fn().mockReturnValue(false));
const enemySpriteFactory = vi.hoisted(() => () => ({
  x: 0,
  y: 0,
  setData: vi.fn(),
  setActive: vi.fn(),
  setVisible: vi.fn(),
  setPosition: vi.fn().mockReturnThis(),
  setVelocity: vi.fn().mockReturnThis(),
  destroy: vi.fn(),
}));

type EnemySpriteStub = ReturnType<typeof enemySpriteFactory>;

const createWabbleBeeMock = vi.hoisted(() =>
  vi.fn(() => ({
    sprite: enemySpriteFactory(),
    update: enemyUpdateMock,
    takeDamage: vi.fn(),
    getHP: vi.fn().mockReturnValue(3),
    isDefeated: enemyIsDefeatedMock,
    getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
    getAbilityType: vi.fn().mockReturnValue('fire'),
    onDisperse: vi.fn(),
  })),
);

const createDrontoDurtMock = vi.hoisted(() =>
  vi.fn(() => ({
    sprite: enemySpriteFactory(),
    update: enemyUpdateMock,
    takeDamage: vi.fn(),
    getHP: vi.fn().mockReturnValue(4),
    isDefeated: enemyIsDefeatedMock,
    getEnemyType: vi.fn().mockReturnValue('dronto-durt'),
    getAbilityType: vi.fn().mockReturnValue('sword'),
    onDisperse: vi.fn(),
  })),
);

vi.mock('../enemies', () => ({
  createWabbleBee: createWabbleBeeMock,
  createDrontoDurt: createDrontoDurtMock,
}));

const areaManagerGetStateMock = vi.hoisted(() => vi.fn());
const areaManagerUpdateMock = vi.hoisted(() => vi.fn());
const areaManagerGetDiscoveredMock = vi.hoisted(() => vi.fn());
const areaManagerGetExplorationStateMock = vi.hoisted(() => vi.fn());
const areaManagerGetAllDefinitionsMock = vi.hoisted(() => vi.fn());
const areaManagerGetLastKnownPositionMock = vi.hoisted(() => vi.fn());
const areaManagerGetSnapshotMock = vi.hoisted(() => vi.fn());
const areaManagerRestoreMock = vi.hoisted(() => vi.fn());
const AreaManagerMock = vi.hoisted(() =>
  vi.fn(() => ({
    getCurrentAreaState: areaManagerGetStateMock,
    updatePlayerPosition: areaManagerUpdateMock,
    getDiscoveredAreas: areaManagerGetDiscoveredMock,
    getExplorationState: areaManagerGetExplorationStateMock,
    getAllAreaMetadata: areaManagerGetAllDefinitionsMock,
    getLastKnownPlayerPosition: areaManagerGetLastKnownPositionMock,
    getPersistenceSnapshot: areaManagerGetSnapshotMock,
    restoreFromSnapshot: areaManagerRestoreMock,
  })),
);

vi.mock('../world/AreaManager', () => ({
  AREA_IDS: {
    CentralHub: 'central-hub',
    MirrorCorridor: 'mirror-corridor',
  },
  AreaManager: AreaManagerMock,
}));

const saveManagerLoadMock = vi.hoisted(() => vi.fn());
const saveManagerSaveMock = vi.hoisted(() => vi.fn());
const saveManagerClearMock = vi.hoisted(() => vi.fn());
const SaveManagerMock = vi.hoisted(() =>
  vi.fn(() => ({
    load: saveManagerLoadMock,
    save: saveManagerSaveMock,
    clear: saveManagerClearMock,
  })),
);

vi.mock('../save/SaveManager', () => ({
  SaveManager: SaveManagerMock,
  DEFAULT_SETTINGS: {
    volume: 0.4,
    controls: 'keyboard',
    difficulty: 'normal',
  },
}));

const mapOverlayShowMock = vi.hoisted(() => vi.fn());
const mapOverlayHideMock = vi.hoisted(() => vi.fn());
const mapOverlayUpdateMock = vi.hoisted(() => vi.fn());
const mapOverlayIsVisibleMock = vi.hoisted(() => vi.fn());
const mapOverlayDestroyMock = vi.hoisted(() => vi.fn());
const MapOverlayMock = vi.hoisted(() =>
  vi.fn(() => ({
    show: mapOverlayShowMock,
    hide: mapOverlayHideMock,
    update: mapOverlayUpdateMock,
    isVisible: mapOverlayIsVisibleMock,
    destroy: mapOverlayDestroyMock,
  })),
);

vi.mock('../ui/MapOverlay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/MapOverlay')>();
  return {
    ...actual,
    MapOverlay: MapOverlayMock,
  };
});

const hudUpdateHPMock = vi.hoisted(() => vi.fn());
const hudUpdateAbilityMock = vi.hoisted(() => vi.fn());
const hudUpdateScoreMock = vi.hoisted(() => vi.fn());
const hudDestroyMock = vi.hoisted(() => vi.fn());
const HudMock = vi.hoisted(() =>
  vi.fn((scene: any) => {
    const root = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    scene?.children?.list?.push?.(root);
    scene?.children?.emitAdd?.(root);
    return {
      updateHP: hudUpdateHPMock,
      updateAbility: hudUpdateAbilityMock,
      updateScore: hudUpdateScoreMock,
      destroy: hudDestroyMock,
    };
  }),
);

vi.mock('../ui/Hud', () => ({
  Hud: HudMock,
}));

const physicsRegisterPlayerMock = vi.hoisted(() => vi.fn());
const physicsRegisterTerrainMock = vi.hoisted(() => vi.fn());
const physicsRegisterEnemyMock = vi.hoisted(() => vi.fn());
const physicsDestroyProjectileMock = vi.hoisted(() => vi.fn());
const physicsClearTerrainMock = vi.hoisted(() => vi.fn());
const physicsSuspendEnemyMock = vi.hoisted(() => vi.fn());
const physicsResumeEnemyMock = vi.hoisted(() => vi.fn());
const physicsConsumeEnemyMock = vi.hoisted(() => vi.fn());

const PhysicsSystemMock = vi.hoisted(() =>
  vi.fn(() => ({
    registerPlayer: physicsRegisterPlayerMock,
    registerTerrain: physicsRegisterTerrainMock,
    registerEnemy: physicsRegisterEnemyMock,
    registerPlayerAttack: vi.fn(),
    destroyProjectile: physicsDestroyProjectileMock,
    clearTerrain: physicsClearTerrainMock,
    suspendEnemy: physicsSuspendEnemyMock,
    resumeEnemy: physicsResumeEnemyMock,
    consumeEnemy: physicsConsumeEnemyMock,
  })),
);

vi.mock('../physics/PhysicsSystem', () => ({
  PhysicsSystem: PhysicsSystemMock,
}));

import { HUD_SAFE_AREA_HEIGHT, HUD_WORLD_MARGIN } from '../ui/hud-layout';
import { GameScene, SceneKeys } from './index';
import { ErrorHandler } from '../errors/ErrorHandler';
import type { AreaDefinition } from '../world/AreaManager';
import { auroraSpire } from '../world/stages/aurora-spire';
import { skySanctum } from '../world/stages/sky-sanctum';

describe('GameScene player integration', () => {
  let defaultAreaState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    enemyIsDefeatedMock.mockReset();
    enemyIsDefeatedMock.mockReturnValue(false);
    enemyUpdateMock.mockReset();
    createWabbleBeeMock.mockClear();
    createDrontoDurtMock.mockClear();
    stubs.scenePlugin.launch.mockClear();
    stubs.scenePlugin.pause.mockClear();
    stubs.scenePlugin.stop.mockClear();
    stubs.scenePlugin.start.mockClear();
    stubs.cameraSetViewport.mockClear();
    stubs.cameraIgnore.mockClear();
    stubs.camerasAdd.mockClear();
    stubs.hudCameraIgnore.mockClear();
    stubs.hudCameraSetScroll.mockClear();
    stubs.cameraStartFollow.mockClear();
    physicsRegisterPlayerMock.mockClear();
    physicsRegisterTerrainMock.mockClear();
    physicsRegisterEnemyMock.mockClear();
    physicsDestroyProjectileMock.mockClear();
    physicsClearTerrainMock.mockClear();
    physicsSuspendEnemyMock.mockClear();
    physicsResumeEnemyMock.mockClear();
    physicsConsumeEnemyMock.mockClear();
    PhysicsSystemMock.mockClear();
    AreaManagerMock.mockClear();
    stubs.matterFactory.add.existing.mockReset();
    stubs.addRectangleMock.mockReset();
    stubs.addImageMock.mockReset();
    stubs.addSpriteMock.mockReset();
    stubs.addTextMock.mockReset();
    stubs.addContainerMock.mockReset();
    stubs.matterFactory.add.existing.mockImplementation((gameObject: any) => {
      const collider = gameObject as any;
      collider.setStatic = vi.fn().mockReturnThis();
      collider.setIgnoreGravity = vi.fn().mockReturnThis();
      collider.setDepth = vi.fn().mockReturnThis();
      collider.setName = vi.fn().mockReturnThis();
      collider.body = collider.body ?? { gameObject: collider };
      return collider;
    });
    areaManagerGetLastKnownPositionMock.mockClear();
    areaManagerGetSnapshotMock.mockClear();
    areaManagerRestoreMock.mockClear();
    mapOverlayShowMock.mockClear();
    mapOverlayHideMock.mockClear();
    mapOverlayUpdateMock.mockClear();
    mapOverlayIsVisibleMock.mockClear();
    mapOverlayDestroyMock.mockClear();
    stubs.events.on.mockClear();
    stubs.events.off.mockClear();
    stubs.events.emit.mockClear();
    hudUpdateHPMock.mockClear();
    hudUpdateAbilityMock.mockClear();
    hudUpdateScoreMock.mockClear();
    hudDestroyMock.mockClear();
    HudMock.mockClear();
    SaveManagerMock.mockClear();
    saveManagerLoadMock.mockReset();
    saveManagerSaveMock.mockReset();
    saveManagerClearMock.mockReset();
    const tileKeyFn = vi.fn().mockReturnValue({ column: 10, row: 5 });
    const tileSize = 32;
    const columns = 20;
    const rows = 10;
    const getTileAt = vi.fn((column: number, row: number) => {
      if (column <= 0 || column >= columns - 1) {
        return 'wall';
      }

      if (row <= 0 || row >= rows - 1) {
        return 'wall';
      }

      if ((row === 3 || row === 6) && column >= 4 && column <= 7) {
        return 'wall';
      }

      return 'floor';
    });
    const getTileAtWorldPosition = vi.fn((position: { x: number; y: number }) => {
      const column = Math.floor(position.x / tileSize);
      const row = Math.floor(position.y / tileSize);
      return getTileAt(column, row);
    });

    defaultAreaState = {
      definition: { id: 'central-hub' },
      tileMap: {
        tileSize,
        columns,
        rows,
        getClampedTileCoordinate: tileKeyFn,
        getTileAt,
        getTileAtWorldPosition,
      },
      pixelBounds: { width: columns * tileSize, height: rows * tileSize },
      playerSpawnPosition: { x: (columns * tileSize) / 2, y: (rows * tileSize) / 2 },
    };
    areaManagerGetStateMock.mockReturnValue(defaultAreaState as any);
    areaManagerUpdateMock.mockReturnValue({ areaChanged: false });
    areaManagerGetDiscoveredMock.mockReturnValue(['central-hub']);
    areaManagerGetExplorationStateMock.mockReturnValue({
      visitedTiles: 0,
      totalTiles: 1,
      completion: 0,
    });
    areaManagerGetAllDefinitionsMock.mockReturnValue([
      { id: 'central-hub', name: 'Central Hub' },
      { id: 'mirror-corridor', name: 'Mirror Corridor' },
    ]);
    areaManagerGetLastKnownPositionMock.mockReturnValue(defaultAreaState.playerSpawnPosition);
    areaManagerGetSnapshotMock.mockReturnValue({
      currentAreaId: 'central-hub',
      discoveredAreas: ['central-hub'],
      exploredTiles: {},
      lastKnownPlayerPosition: { ...defaultAreaState.playerSpawnPosition },
    });
    mapOverlayIsVisibleMock.mockReturnValue(false);
    performanceMonitorStubs.monitorMock.mockClear();
    performanceMonitorStubs.update.mockClear();
    renderingPreferenceStubs.recordLowFpsEvent.mockClear();
    renderingPreferenceStubs.recordStableFpsEvent.mockClear();
    stubs.matterFactory.add.rectangle = vi.fn();
  });

  function createAreaStateFromDefinition(definition: AreaDefinition) {
    const { tileSize: stageTileSize, layout } = definition;
    const rows = layout.length;
    const columns = layout[0]?.length ?? 0;

    const symbolToTile = (symbol: string) => {
      switch (symbol) {
        case '#':
          return 'wall';
        case 'D':
          return 'door';
        case '.':
          return 'floor';
        case ' ':
          return 'void';
        default:
          return 'floor';
      }
    };

    const getTileAt = (column: number, row: number) => {
      if (column < 0 || column >= columns || row < 0 || row >= rows) {
        return undefined;
      }

      return symbolToTile(layout[row][column]);
    };

    const getTileAtWorldPosition = (position: { x: number; y: number }) => {
      const column = Math.floor(position.x / stageTileSize);
      const row = Math.floor(position.y / stageTileSize);
      return getTileAt(column, row);
    };

    const getClampedTileCoordinate = (position: { x: number; y: number }) => {
      const column = Math.min(Math.max(0, Math.floor(position.x / stageTileSize)), Math.max(0, columns - 1));
      const row = Math.min(Math.max(0, Math.floor(position.y / stageTileSize)), Math.max(0, rows - 1));
      return { column, row };
    };

    return {
      definition,
      tileMap: {
        tileSize: stageTileSize,
        columns,
        rows,
        getTileAt,
        getTileAtWorldPosition,
        getClampedTileCoordinate,
      },
      pixelBounds: { width: columns * stageTileSize, height: rows * stageTileSize },
      playerSpawnPosition: { ...definition.entryPoints.default.position },
    };
  }

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

  function makeKirdyStub(overrides: any = {}) {
    const spriteDefaults = {
      x: defaultAreaState.playerSpawnPosition.x,
      y: defaultAreaState.playerSpawnPosition.y,
      body: {
        position: {
          x: defaultAreaState.playerSpawnPosition.x,
          y: defaultAreaState.playerSpawnPosition.y,
        },
      },
      setPosition: vi.fn(),
      setVelocity: vi.fn(),
      setVelocityX: vi.fn(),
      setVelocityY: vi.fn(),
      setFlipX: vi.fn(),
      anims: { play: vi.fn() },
    };

    const sprite = { ...spriteDefaults, ...(overrides.sprite ?? {}) };

    const defaultMaxHP = overrides.maxHP ?? 6;
    let maxHP = defaultMaxHP;
    let currentHP = overrides.hp ?? defaultMaxHP;
    let score = overrides.score ?? 0;
    let ability: AbilityType | undefined = overrides.ability;

    return {
      update: vi.fn(),
      ...overrides,
      sprite,
      move: overrides.move ?? vi.fn(),
      jump: overrides.jump ?? vi.fn(() => false),
      startHover: overrides.startHover ?? vi.fn(() => false),
      stopHover: overrides.stopHover ?? vi.fn(),
      takeDamage:
        overrides.takeDamage ??
        vi.fn((amount: number) => {
          const normalized = Math.max(0, Math.floor(amount));
          if (normalized <= 0) {
            return currentHP;
          }
          currentHP = Math.max(0, currentHP - normalized);
          return currentHP;
        }),
      heal:
        overrides.heal ??
        vi.fn((amount: number) => {
          const normalized = Math.max(0, Math.floor(amount));
          if (normalized <= 0) {
            return currentHP;
          }
          currentHP = Math.min(maxHP, currentHP + normalized);
          return currentHP;
        }),
      setHP:
        overrides.setHP ??
        vi.fn((value: number) => {
          const normalized = Math.max(0, Math.floor(value));
          currentHP = Math.min(maxHP, normalized);
          return currentHP;
        }),
      setMaxHP:
        overrides.setMaxHP ??
        vi.fn((value: number) => {
          maxHP = Math.max(1, Math.floor(value));
          if (currentHP > maxHP) {
            currentHP = maxHP;
          }
          return maxHP;
        }),
      getHP: overrides.getHP ?? vi.fn(() => currentHP),
      getMaxHP: overrides.getMaxHP ?? vi.fn(() => maxHP),
      addScore:
        overrides.addScore ??
        vi.fn((amount: number) => {
          const normalized = Math.max(0, Math.floor(amount));
          if (normalized <= 0) {
            return score;
          }
          score += normalized;
          return score;
        }),
      setScore:
        overrides.setScore ??
        vi.fn((value: number) => {
          score = Math.max(0, Math.floor(value));
          return score;
        }),
      getScore: overrides.getScore ?? vi.fn(() => score),
      setAbility:
        overrides.setAbility ??
        vi.fn((next?: AbilityType) => {
          ability = next;
          return ability;
        }),
      getAbility: overrides.getAbility ?? vi.fn(() => ability),
      clearAbility:
        overrides.clearAbility ??
        vi.fn(() => {
          ability = undefined;
        }),
      toStatsSnapshot:
        overrides.toStatsSnapshot ??
        vi.fn(() => ({
          hp: currentHP,
          maxHP,
          score,
          ability,
        })),
    };
  }

  it('creates a Kirdy instance and player input manager during setup', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(createKirdyMock).toHaveBeenCalledWith(scene, defaultAreaState.playerSpawnPosition, expect.anything());
    expect(PlayerInputManagerMock).toHaveBeenCalledWith(scene);
    expect((scene as any).kirdy).toBe(kirdyInstance);
    expect((scene as any).playerInput).toBeDefined();
    expect(stubs.keyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(stubs.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
    expect(PhysicsSystemMock).toHaveBeenCalledWith(scene);
    expect(physicsRegisterPlayerMock).toHaveBeenCalledWith(kirdyInstance);
    expect(AreaManagerMock).toHaveBeenCalled();
  });

  it('メインカメラがKirdyを追従するよう設定する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(stubs.cameraSetViewport).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(stubs.cameraStartFollow).toHaveBeenCalledWith(
      kirdyInstance.sprite,
      true,
      0.1,
      0.1,
      0,
      -(HUD_SAFE_AREA_HEIGHT + HUD_WORLD_MARGIN),
    );
  });

  it('地形タイルに対応するコライダーをMatterに生成して物理システムへ登録する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const tileSize = 24;
    const layout: Array<Array<'wall' | 'floor'>> = [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall'],
    ];

    const customTileMap = {
      tileSize,
      columns: layout[0].length,
      rows: layout.length,
      getClampedTileCoordinate: vi.fn().mockReturnValue({ column: 1, row: 1 }),
      getTileAt: vi.fn((column: number, row: number) => layout[row]?.[column]),
    };

    const areaState = {
      definition: { id: 'central-hub' },
      tileMap: customTileMap,
      pixelBounds: { width: layout[0].length * tileSize, height: layout.length * tileSize },
      playerSpawnPosition: { x: tileSize * 1.5, y: tileSize * 1.5 },
    };

    areaManagerGetStateMock.mockReturnValue(areaState as any);
    areaManagerGetLastKnownPositionMock.mockReturnValue(areaState.playerSpawnPosition);
    areaManagerGetSnapshotMock.mockReturnValue({
      currentAreaId: 'central-hub',
      discoveredAreas: ['central-hub'],
      exploredTiles: {},
      lastKnownPlayerPosition: { ...areaState.playerSpawnPosition },
    });

    stubs.addRectangleMock.mockImplementation(() => {
      const rectangle = {
        setVisible: vi.fn().mockReturnThis(),
        setActive: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      return rectangle;
    });

    const createdColliders: any[] = [];
    stubs.matterFactory.add.existing.mockImplementation((gameObject: any) => {
      const collider = gameObject;
      collider.setStatic = vi.fn().mockReturnThis();
      collider.setIgnoreGravity = vi.fn().mockReturnThis();
      collider.setDepth = vi.fn().mockReturnThis();
      collider.setName = vi.fn().mockReturnThis();
      collider.body = { id: createdColliders.length + 1, gameObject: collider };
      createdColliders.push(collider);
      return collider;
    });

    scene.create();

    const expectedSolidTiles = layout.flat().filter((tile) => tile === 'wall').length;
    expect(stubs.addRectangleMock).toHaveBeenCalledTimes(expectedSolidTiles);
    expect(stubs.matterFactory.add.existing).toHaveBeenCalledTimes(expectedSolidTiles);
    expect(physicsRegisterTerrainMock).toHaveBeenCalledTimes(expectedSolidTiles);
    createdColliders.forEach((collider) => {
      expect(physicsRegisterTerrainMock).toHaveBeenCalledWith(collider);
      expect(collider.body?.gameObject).toBe(collider);
      expect(collider.setStatic).toHaveBeenCalledWith(true);
      expect(collider.setIgnoreGravity).toHaveBeenCalledWith(true);
      expect(collider.setDepth).toHaveBeenCalledWith(0);
      expect(collider.setName).toHaveBeenCalledWith('Terrain');
    });
  });

  it('壁タイルに対応する可視タイルを生成し、破棄時にクリーンアップする', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const tileSize = 24;
    const layout: Array<Array<'wall' | 'floor'>> = [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'wall'],
      ['wall', 'wall', 'wall'],
    ];

    const wallCoordinates: Array<{ column: number; row: number }> = [];
    layout.forEach((rowTiles, rowIndex) => {
      rowTiles.forEach((tile, columnIndex) => {
        if (tile === 'wall') {
          wallCoordinates.push({ column: columnIndex, row: rowIndex });
        }
      });
    });

    const customTileMap = {
      tileSize,
      columns: layout[0].length,
      rows: layout.length,
      getClampedTileCoordinate: vi.fn().mockReturnValue({ column: 1, row: 1 }),
      getTileAt: vi.fn((column: number, row: number) => layout[row]?.[column]),
    };

    const areaState = {
      definition: { id: 'central-hub' },
      tileMap: customTileMap,
      pixelBounds: { width: layout[0].length * tileSize, height: layout.length * tileSize },
      playerSpawnPosition: { x: tileSize * 1.5, y: tileSize * 1.5 },
    };

    areaManagerGetStateMock.mockReturnValue(areaState as any);
    areaManagerGetLastKnownPositionMock.mockReturnValue(areaState.playerSpawnPosition);
    areaManagerGetSnapshotMock.mockReturnValue({
      currentAreaId: 'central-hub',
      discoveredAreas: ['central-hub'],
      exploredTiles: {},
      lastKnownPlayerPosition: { ...areaState.playerSpawnPosition },
    });

    const createdImages: Array<{
      x: number;
      y: number;
      textureKey: string;
      frame: string | undefined;
      instance: ReturnType<typeof stubs.addImageMock>;
    }> = [];
    stubs.addImageMock.mockImplementation((x: number, y: number, textureKey: string, frame?: string) => {
      const image = {
        x,
        y,
        texture: textureKey,
        frame,
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(),
        setActive: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setFrame: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      createdImages.push({
        x,
        y,
        textureKey,
        frame,
        instance: image,
      });
      return image;
    });

    scene.create();

    const wallImages = createdImages.filter((entry) => entry.textureKey === 'wall-texture');
    expect(wallImages).toHaveLength(wallCoordinates.length);

    wallCoordinates.forEach((position) => {
      const centerX = position.column * tileSize + tileSize / 2;
      const centerY = position.row * tileSize + tileSize / 2;
      const entry = wallImages.find((image) => image.x === centerX && image.y === centerY);

      expect(entry).toBeDefined();
      const image = entry?.instance as any;
      expect(image.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
      expect(image.setDisplaySize).toHaveBeenCalledWith(tileSize, tileSize);
      expect(image.setDepth).toHaveBeenCalledWith(-50);
      expect(image.setFrame).not.toHaveBeenCalled();
    });

    const terrainTiles = ((scene as any).terrainTiles ?? []) as Array<
      { destroy: ReturnType<typeof vi.fn> }
    >;
    expect(terrainTiles).toHaveLength(wallCoordinates.length);
    wallImages.forEach((image) => {
      expect(terrainTiles).toContain(image.instance as any);
    });

    const destroyTerrainVisuals = (scene as any).destroyTerrainVisuals?.bind(scene);
    expect(destroyTerrainVisuals).toBeDefined();

    destroyTerrainVisuals?.();

    createdImages.forEach((image) => {
      expect(image.instance.destroy).toHaveBeenCalled();
    });
    expect((scene as any).terrainTiles).toHaveLength(0);
  });

  it('エリア切替用ドアタイルを視覚的に強調表示する', () => {
    const tileSize = defaultAreaState.tileMap.tileSize;
    const columns = defaultAreaState.tileMap.columns;
    const rows = defaultAreaState.tileMap.rows;

    const doorCoordinates = [
      { column: 1, row: Math.floor(rows / 2) },
      { column: columns - 2, row: Math.floor(rows / 2) },
      { column: Math.floor(columns / 2), row: 1 },
      { column: Math.floor(columns / 2), row: rows - 2 },
    ];

    const doorKey = new Set(doorCoordinates.map(({ column, row }) => `${column},${row}`));
    const originalGetTileAt = defaultAreaState.tileMap.getTileAt;
    const getTileAt = vi.fn((column: number, row: number) => {
      if (doorKey.has(`${column},${row}`)) {
        return 'door';
      }

      return originalGetTileAt(column, row);
    });

    const areaStateWithDoors = {
      ...defaultAreaState,
      tileMap: {
        ...defaultAreaState.tileMap,
        getTileAt,
      },
    };

    areaManagerGetStateMock.mockReturnValue(areaStateWithDoors as any);

    const createdImages: Array<{
      x: number;
      y: number;
      textureKey: string;
      frame: string | undefined;
      instance: {
        setOrigin: ReturnType<typeof vi.fn>;
        setDepth: ReturnType<typeof vi.fn>;
        setDisplaySize: ReturnType<typeof vi.fn>;
        setVisible: ReturnType<typeof vi.fn>;
        setActive: ReturnType<typeof vi.fn>;
        setFrame: ReturnType<typeof vi.fn>;
        setAlpha?: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
      };
    }> = [];

    stubs.addImageMock.mockImplementation((x: number, y: number, textureKey: string, frame?: string) => {
      const image = {
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setActive: vi.fn().mockReturnThis(),
        setFrame: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      createdImages.push({ x, y, textureKey, frame, instance: image });
      return image;
    });

    const scene = new GameScene();
    scene.create();

    const doorMarkers = ((scene as any).terrainTransitionMarkers ?? []) as Array<{ destroy?: () => void }>;
    expect(doorMarkers).toHaveLength(doorCoordinates.length);

    const DOOR_TEXTURE_KEY = 'door-marker';
    const doorImages = createdImages.filter((entry) => entry.textureKey === DOOR_TEXTURE_KEY);
    expect(doorImages).toHaveLength(doorCoordinates.length);

    doorCoordinates.forEach(({ column, row }) => {
      const centerX = column * tileSize + tileSize / 2;
      const centerY = row * tileSize + tileSize / 2;
      const imageEntry = doorImages.find((entry) => entry.x === centerX && entry.y === centerY);

      expect(imageEntry).toBeDefined();
      const image = imageEntry?.instance;
      expect(image?.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
      expect(image?.setDepth).toHaveBeenCalledWith(-46);
      expect(image?.setDisplaySize).toHaveBeenCalledWith(tileSize, tileSize);
      expect(image?.setVisible).toHaveBeenCalledWith(true);
      expect(image?.setActive).toHaveBeenCalledWith(true);
    });
  });

  it('spawns heal sprites for active heal items', () => {
    const getActiveHealsSpy = vi
      .spyOn(MapSystem.prototype, 'getActiveHealItems')
      .mockReturnValue([
        { id: 'dead-end-0', position: { x: 128, y: 160 }, reward: 'health' as const, consumed: false },
      ]);

    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(stubs.addSpriteMock).toHaveBeenCalledWith(128, 160, 'heal-orb');
    const sprite = ((scene as any).healSprites.get('dead-end-0')) as { setScrollFactor?: ReturnType<typeof vi.fn> } | undefined;
    expect(sprite?.setScrollFactor).toHaveBeenCalledWith(1, 1);
    getActiveHealsSpy.mockRestore();
  });

  it('consumes heal items and restores HP when Kirdy touches them', () => {
    const healItem: HealItemInstance = {
      id: 'dead-end-0',
      position: { x: 140, y: 180 },
      reward: 'health',
      consumed: false,
    };
    const getActiveHealsSpy = vi
      .spyOn(MapSystem.prototype, 'getActiveHealItems')
      .mockReturnValue([healItem]);
    const consumeHealSpy = vi.spyOn(MapSystem.prototype, 'consumeHeal').mockReturnValue(healItem);

    const kirdyStub = makeKirdyStub({
      sprite: {
        x: healItem.position.x,
        y: healItem.position.y,
        body: { position: { x: healItem.position.x, y: healItem.position.y } },
      },
    });
    createKirdyMock.mockReturnValue(kirdyStub);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    const scene = new GameScene();
    scene.create();

    const sprite = (scene as any).kirdy?.sprite as { x?: number; y?: number; body?: { position?: { x?: number; y?: number } } };
    if (sprite) {
      sprite.x = healItem.position.x;
      sprite.y = healItem.position.y;
      if (sprite.body?.position) {
        sprite.body.position.x = healItem.position.x;
        sprite.body.position.y = healItem.position.y;
      }
    }

    playerInputUpdateMock.mockReturnValue(createSnapshot());
    scene.update(0, 16);

    expect(consumeHealSpy).toHaveBeenCalledWith('central-hub', healItem.id);
    expect(kirdyStub.heal).toHaveBeenCalledWith(1);
    expect(((scene as any).healSprites.size)).toBe(0);

    getActiveHealsSpy.mockRestore();
    consumeHealSpy.mockRestore();
  });

  it('フレーム毎にパフォーマンスモニターを更新する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    scene.update(100, 16);

    expect(performanceMonitorStubs.monitorMock).toHaveBeenCalled();
    expect(performanceMonitorStubs.update).toHaveBeenCalledWith(16);
  });

  it('低FPS検出時にレンダリングモードの降格を記録しイベントを発火する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const options = performanceMonitorStubs.monitorMock.mock.calls[0]?.[0] as {
      onLowFps?: (metrics: any) => void;
    };

    expect(options?.onLowFps).toBeTypeOf('function');

    const metrics = {
      frameCount: 5,
      durationMs: 320,
      averageFps: 15,
      averageFrameTimeMs: 64,
      timestamp: Date.now(),
    };

    options?.onLowFps?.(metrics);

    expect(renderingPreferenceStubs.recordLowFpsEvent).toHaveBeenCalled();
    expect(stubs.events.emit).toHaveBeenCalledWith('performance:low-fps', metrics);
  });

  it('高FPS計測で低FPS記録をクリアする', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const options = performanceMonitorStubs.monitorMock.mock.calls[0]?.[0] as {
      onSample?: (metrics: any) => void;
    };

    expect(options?.onSample).toBeTypeOf('function');

    options?.onSample?.({
      frameCount: 6,
      durationMs: 100,
      averageFps: 60,
      averageFrameTimeMs: 16.6,
      timestamp: Date.now(),
    });

    expect(renderingPreferenceStubs.recordStableFpsEvent).toHaveBeenCalled();
  });

  it('ランタイム例外発生時にエラーハンドラへ処理を委譲してクラッシュを防ぐ', () => {
    const capturedError = { type: 'CRITICAL_GAME_ERROR', message: 'update crash' } as const;
    playerInputUpdateMock.mockImplementationOnce(() => {
      throw capturedError;
    });

    const handleSpy = vi.spyOn(ErrorHandler, 'handleGameError');

    const scene = new GameScene();
    scene.create();

    expect(() => scene.update(0, 16)).not.toThrow();

    expect(handleSpy).toHaveBeenCalledWith(capturedError, scene);

    handleSpy.mockRestore();
  });

  it('初期エリア生成時に敵を初期配置する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(createWabbleBeeMock).not.toHaveBeenCalled();

    scene.update(0, 16);

    expect(createWabbleBeeMock).toHaveBeenCalledTimes(3);

    const spawnArgs = createWabbleBeeMock.mock.calls as unknown as Array<[unknown, { x: number; y: number }]>;
    const spawns = spawnArgs.map(([, spawn]) => spawn);

    expect(spawns).toHaveLength(3);

    const tileMap = defaultAreaState.tileMap;
    const tileSize = tileMap.tileSize;
    const neighborOffsets = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    spawns.forEach((spawn) => {
      const tile = tileMap.getTileAtWorldPosition(spawn);
      expect(tile).toBe('floor');

      const column = Math.floor(spawn.x / tileSize);
      const row = Math.floor(spawn.y / tileSize);

      neighborOffsets.forEach(({ dx, dy }) => {
        const neighborTile = tileMap.getTileAt(column + dx, row + dy);
        expect(neighborTile).not.toBeUndefined();
        expect(neighborTile).not.toBe('wall');
        expect(neighborTile).not.toBe('void');
      });
    });
  });

  it('画面外の敵を一時的に非アクティブ化し、戻った際に復帰させる', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();
    scene.setEnemyAutoSpawnEnabled(false);

    const firstEnemy = scene.spawnWabbleBee({ x: 48, y: 48 });
    scene.update(0, 5000);
    scene.update(5000, 5000);
    const secondEnemy = scene.spawnWabbleBee({ x: 400, y: 400 });

    if (!firstEnemy || !secondEnemy) {
      throw new Error('Enemy spawn failed in test setup');
    }

    Object.assign(scene.cameras.main.worldView, { x: 0, y: 0, width: 120, height: 120 });

    firstEnemy.sprite.x = 60;
    firstEnemy.sprite.y = 60;
    secondEnemy.sprite.x = 500;
    secondEnemy.sprite.y = 500;

    scene.update(300, 16);

    const secondSprite = secondEnemy.sprite as unknown as EnemySpriteStub;

    expect(secondSprite.setActive).toHaveBeenCalledWith(false);
    expect(secondSprite.setVisible).toHaveBeenCalledWith(false);

    secondSprite.setActive.mockClear();
    secondSprite.setVisible.mockClear();

    secondEnemy.sprite.x = 80;
    secondEnemy.sprite.y = 80;

    scene.update(320, 16);

    expect(secondSprite.setActive).toHaveBeenCalledWith(true);
    expect(secondSprite.setVisible).toHaveBeenCalledWith(true);
  });

  it('repositions Kirdy when the area manager triggers an area transition', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    const entryPosition = { x: 96, y: 128 };
    areaManagerUpdateMock.mockReturnValueOnce({
      areaChanged: true,
      transition: {
        from: defaultAreaState.definition.id,
        to: 'mirror-corridor',
        via: 'east',
        entryPosition,
      },
    });

    scene.create();

    // move Kirdy onto the eastern door tile to trigger transition
    const tileSize = defaultAreaState.tileMap.tileSize;
    const doorColumn = defaultAreaState.tileMap.columns - 2;
    const doorRow = Math.floor(defaultAreaState.tileMap.rows / 2);
    const doorX = doorColumn * tileSize + tileSize / 2;
    const doorY = doorRow * tileSize + tileSize / 2;

    kirdyInstance.sprite.x = doorX;
    kirdyInstance.sprite.y = doorY;
    if (kirdyInstance.sprite.body?.position) {
      kirdyInstance.sprite.body.position.x = doorX;
      kirdyInstance.sprite.body.position.y = doorY;
    }

    scene.update(0, 16);

    expect(areaManagerUpdateMock).toHaveBeenCalledWith({
      x: kirdyInstance.sprite.x,
      y: kirdyInstance.sprite.y,
    });
    expect(kirdyInstance.sprite.setPosition).toHaveBeenCalledWith(entryPosition.x, entryPosition.y);
    expect(kirdyInstance.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it('aurora-spire の西扉を通過すると sky-sanctum へ遷移する', () => {
    const auroraState = createAreaStateFromDefinition(auroraSpire);
    const skyState = createAreaStateFromDefinition(skySanctum);

    defaultAreaState = auroraState;
    let currentState = auroraState;

    areaManagerGetStateMock.mockReset();
    areaManagerGetStateMock.mockImplementation(() => currentState);
    areaManagerGetLastKnownPositionMock.mockReset();
    areaManagerGetLastKnownPositionMock.mockImplementation(() => currentState.playerSpawnPosition);
    areaManagerGetDiscoveredMock.mockReturnValue([auroraState.definition.id]);

    areaManagerUpdateMock.mockReset();
    areaManagerUpdateMock.mockReturnValue({ areaChanged: false });

    const skyEntry = { ...skySanctum.entryPoints.east!.position };

    areaManagerUpdateMock.mockImplementationOnce(() => {
      currentState = skyState;
      return {
        areaChanged: true,
        transition: {
          from: auroraState.definition.id,
          to: skyState.definition.id,
          via: 'west',
          entryPosition: skyEntry,
        },
      };
    });

    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    const tileSize = auroraState.tileMap.tileSize;
    const doorRowIndex = auroraSpire.layout.findIndex((row) => row.indexOf('D') === 1);
    if (doorRowIndex < 0) {
      throw new Error('aurora-spire west door missing');
    }

    const doorColumn = 1;
    const doorX = doorColumn * tileSize + tileSize / 2;
    const doorY = doorRowIndex * tileSize + tileSize / 2;

    kirdyInstance.sprite.x = doorX;
    kirdyInstance.sprite.y = doorY;
    if (kirdyInstance.sprite.body?.position) {
      kirdyInstance.sprite.body.position.x = doorX;
      kirdyInstance.sprite.body.position.y = doorY;
    }

    scene.update(0, 16);

    expect(areaManagerUpdateMock).toHaveBeenCalledWith({
      x: doorX,
      y: doorY,
    });
    expect(kirdyInstance.sprite.setPosition).toHaveBeenCalledWith(skyEntry.x, skyEntry.y);
    expect(kirdyInstance.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    expect(currentState.definition.id).toBe(skyState.definition.id);
  });

  it('保存済みの進行状況を復元し、HUDを更新する', () => {
    const savedSnapshot = {
      player: {
        hp: 3,
        maxHP: 6,
        score: 450,
        ability: 'ice',
        position: { x: 480, y: 160 },
      },
      area: {
        currentAreaId: 'mirror-corridor',
        discoveredAreas: ['central-hub', 'mirror-corridor'],
        exploredTiles: {
          'mirror-corridor': ['0,0'],
        },
        lastKnownPlayerPosition: { x: 480, y: 160 },
      },
    } as any;

    const savedAreaState = {
      definition: { id: 'mirror-corridor' },
      tileMap: {
        tileSize: 32,
        columns: 20,
        rows: 10,
        getClampedTileCoordinate: vi.fn().mockReturnValue({ column: 12, row: 4 }),
      },
      pixelBounds: { width: 640, height: 320 },
      playerSpawnPosition: { x: 480, y: 160 },
    };

    areaManagerGetStateMock.mockReturnValue(savedAreaState as any);
    areaManagerGetLastKnownPositionMock.mockReturnValue(savedSnapshot.area.lastKnownPlayerPosition);
    saveManagerLoadMock.mockReturnValue(savedSnapshot);

    const scene = new GameScene();
    let capturedAbility: string | undefined;
    abilitySystemApplyPayloadMock.mockImplementationOnce((payload: { abilityType?: string }) => {
      capturedAbility = payload?.abilityType;
    });
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    kirdyInstance.setMaxHP?.(savedSnapshot.player.maxHP);
    kirdyInstance.setHP?.(savedSnapshot.player.hp);
    kirdyInstance.setScore?.(savedSnapshot.player.score);

    scene.create();

    const abilityAcquiredHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-acquired')?.[1];
    abilityAcquiredHandler?.({ abilityType: capturedAbility });

    expect(saveManagerLoadMock).toHaveBeenCalled();
    expect(createKirdyMock).toHaveBeenCalledWith(scene, savedSnapshot.area.lastKnownPlayerPosition, expect.anything());
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 3, max: 6 });
    expect(hudUpdateScoreMock).toHaveBeenCalledWith(450);
    expect(hudUpdateAbilityMock).toHaveBeenCalledWith('ice');
  });

  it('enemy-captured イベントで敵をサスペンドする', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    scene.create();

    const enemyManagerStub = {
      suspendEnemy: vi.fn(),
      resumeEnemy: vi.fn(),
      consumeEnemy: vi.fn(),
    };
    (scene as any).enemyManager = enemyManagerStub;

    const capturedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-captured')?.[1];
    expect(capturedHandler).toBeInstanceOf(Function);

    const sprite = { destroyed: false } as any;
    capturedHandler?.({ sprite });

    expect(enemyManagerStub.suspendEnemy).toHaveBeenCalledWith(sprite);
    expect(physicsSuspendEnemyMock).toHaveBeenCalledWith(sprite);
  });

  it('enemy-capture-released イベントで敵を再開する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    scene.create();

    const enemyManagerStub = {
      suspendEnemy: vi.fn(),
      resumeEnemy: vi.fn(),
      consumeEnemy: vi.fn(),
    };
    (scene as any).enemyManager = enemyManagerStub;

    const capturedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-captured')?.[1];
    const releasedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-capture-released')?.[1];

    expect(capturedHandler).toBeInstanceOf(Function);
    expect(releasedHandler).toBeInstanceOf(Function);

    const sprite = { destroyed: false } as any;
    capturedHandler?.({ sprite });
    releasedHandler?.({ sprite });

    expect(enemyManagerStub.resumeEnemy).toHaveBeenCalledWith(sprite);
    expect(physicsResumeEnemyMock).toHaveBeenCalledWith(sprite);
  });

  it('enemy-swallowed イベントで敵を消費し、再開処理を抑制する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    scene.create();

    const enemyManagerStub = {
      suspendEnemy: vi.fn(),
      resumeEnemy: vi.fn(),
      consumeEnemy: vi.fn(),
    };
    (scene as any).enemyManager = enemyManagerStub;

    const capturedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-captured')?.[1];
    const releasedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-capture-released')?.[1];
    const swallowedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-swallowed')?.[1];

    expect(capturedHandler).toBeInstanceOf(Function);
    expect(releasedHandler).toBeInstanceOf(Function);
    expect(swallowedHandler).toBeInstanceOf(Function);

    const sprite = { destroyed: false } as any;
    capturedHandler?.({ sprite });
    swallowedHandler?.({ sprite });

    expect(enemyManagerStub.consumeEnemy).toHaveBeenCalledWith(sprite);
    expect(physicsConsumeEnemyMock).toHaveBeenCalledWith(sprite);

    physicsResumeEnemyMock.mockClear();
    enemyManagerStub.resumeEnemy.mockClear();

    sprite.destroyed = true;
    releasedHandler?.({ sprite });

    expect(enemyManagerStub.resumeEnemy).not.toHaveBeenCalled();
    expect(physicsResumeEnemyMock).not.toHaveBeenCalled();
  });

  it('口内に敵がある時だけDOWNキー吸い込みを有効化する', () => {
    const scene = new GameScene();
    const mouthSprite = { name: 'captured-enemy' } as any;
    const getMouthContent = vi.fn().mockReturnValue(undefined);
    const kirdyInstance = makeKirdyStub({ getMouthContent });
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();
    scene.update(16, 16);

    expect(playerInputSetSwallowDownMock).toHaveBeenCalledWith(false);
    playerInputSetSwallowDownMock.mockClear();

    getMouthContent.mockReturnValue(mouthSprite);
    scene.update(16, 16);
    expect(playerInputSetSwallowDownMock).toHaveBeenCalledWith(true);

    playerInputSetSwallowDownMock.mockClear();
    getMouthContent.mockReturnValue(undefined);
    scene.update(16, 16);
    expect(playerInputSetSwallowDownMock).toHaveBeenCalledWith(false);
  });

  it('物理システムの敵衝突イベントでプレイヤーがダメージを受ける', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const takeDamageMock = kirdyInstance.takeDamage as ReturnType<typeof vi.fn>;
    takeDamageMock.mockClear();

    const collisionHandler = stubs.events.on.mock.calls.find(
      ([event]) => event === 'player-collided-with-enemy',
    )?.[1];

    expect(collisionHandler).toBeInstanceOf(Function);

    collisionHandler?.({ enemy: { sprite: {} } });

    expect(takeDamageMock).toHaveBeenCalledWith(1);
  });

  it('プレイヤーはダメージ後2秒間無敵となり再ダメージを受けない', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const takeDamageMock = kirdyInstance.takeDamage as ReturnType<typeof vi.fn>;
    takeDamageMock.mockClear();

    const collisionHandler = stubs.events.on.mock.calls.find(
      ([event]) => event === 'player-collided-with-enemy',
    )?.[1];

    expect(collisionHandler).toBeInstanceOf(Function);

    collisionHandler?.({ enemy: { sprite: {} } });
    expect(takeDamageMock).toHaveBeenCalledTimes(1);

    collisionHandler?.({ enemy: { sprite: {} } });
    expect(takeDamageMock).toHaveBeenCalledTimes(1);

    scene.update(16, 1000);
    collisionHandler?.({ enemy: { sprite: {} } });
    expect(takeDamageMock).toHaveBeenCalledTimes(1);

    scene.update(1016, 1000);
    collisionHandler?.({ enemy: { sprite: {} } });
    expect(takeDamageMock).toHaveBeenCalledTimes(2);
  });

  it('プレイヤーHPの変化時に進行状況を保存する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    saveManagerSaveMock.mockReset();

    scene.damagePlayer(2);

    expect(kirdyInstance.takeDamage).toHaveBeenCalledWith(2);

    playerInputUpdateMock.mockReturnValue(snapshot);
    scene.update(16, 16);

    expect(saveManagerSaveMock).toHaveBeenCalledTimes(1);
    const payload = saveManagerSaveMock.mock.calls[0][0];
    expect(payload.player.hp).toBe(4);
    expect(areaManagerGetSnapshotMock).toHaveBeenCalled();
  });

  it('セーブされる最終位置はエリア境界内にクランプされる', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    saveManagerSaveMock.mockReset();

    const outOfBoundsX = defaultAreaState.pixelBounds.width + 500;
    const outOfBoundsY = -250;
    kirdyInstance.sprite.x = outOfBoundsX;
    kirdyInstance.sprite.y = outOfBoundsY;
    kirdyInstance.sprite.body.position.x = outOfBoundsX;
    kirdyInstance.sprite.body.position.y = outOfBoundsY;

    (scene as any).progressDirty = true;

    playerInputUpdateMock.mockReturnValue(snapshot);
    scene.update(0, 16);

    expect(saveManagerSaveMock).toHaveBeenCalledTimes(1);
    const payload = saveManagerSaveMock.mock.calls[0][0];
    const expectedX = defaultAreaState.pixelBounds.width - 1;
    const expectedY = 0;
    expect(payload.area.lastKnownPlayerPosition).toEqual({ x: expectedX, y: expectedY });
    expect(payload.player.position).toEqual({ x: expectedX, y: expectedY });
  });

  it('toggles the world map overlay and populates summaries when opening', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    areaManagerGetDiscoveredMock.mockReturnValue(['central-hub']);
    areaManagerGetExplorationStateMock.mockImplementation((areaId: string) => {
      if (areaId === 'central-hub') {
        return { visitedTiles: 5, totalTiles: 20, completion: 0.25 };
      }

      return { visitedTiles: 0, totalTiles: 0, completion: 0 };
    });
    areaManagerGetAllDefinitionsMock.mockReturnValue([
      { id: 'central-hub', name: 'Central Hub' },
      { id: 'mirror-corridor', name: 'Mirror Corridor' },
    ]);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(MapOverlayMock).toHaveBeenCalledWith(scene);

    const mapToggleHandler = stubs.keyboard.on.mock.calls.find(([event]) => event === 'keydown-M')?.[1];
    expect(mapToggleHandler).toBeInstanceOf(Function);

    mapToggleHandler?.({});

    expect(mapOverlayUpdateMock).toHaveBeenCalledWith([
      {
        id: 'central-hub',
        name: 'Central Hub',
        discovered: true,
        isCurrent: true,
        exploration: { visitedTiles: 5, totalTiles: 20, completion: 0.25 },
      },
      {
        id: 'mirror-corridor',
        name: 'Mirror Corridor',
        discovered: false,
        isCurrent: false,
        exploration: { visitedTiles: 0, totalTiles: 0, completion: 0 },
      },
    ]);
    expect(mapOverlayShowMock).toHaveBeenCalled();
    expect(mapOverlayHideMock).not.toHaveBeenCalled();
    expect(areaManagerGetExplorationStateMock).toHaveBeenCalledWith('central-hub');
    expect(areaManagerGetExplorationStateMock).not.toHaveBeenCalledWith('mirror-corridor');
  });

  it('hides the world map overlay when already visible', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    mapOverlayIsVisibleMock.mockReturnValue(true);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    const mapToggleHandler = stubs.keyboard.on.mock.calls.find(([event]) => event === 'keydown-M')?.[1];
    expect(mapToggleHandler).toBeInstanceOf(Function);

    mapToggleHandler?.({});

    expect(mapOverlayHideMock).toHaveBeenCalled();
    expect(mapOverlayShowMock).not.toHaveBeenCalled();
    expect(mapOverlayUpdateMock).not.toHaveBeenCalled();
  });

  it('初期状態でHUDを生成しプレイヤー情報を表示する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(HudMock).toHaveBeenCalledWith(scene);
    expect(hudUpdateHPMock).toHaveBeenCalledWith({ current: 6, max: 6 });
    expect(hudUpdateAbilityMock).toHaveBeenCalledWith(undefined);
    expect(hudUpdateScoreMock).toHaveBeenCalledWith(0);
  });

  it('能力イベントを受けてHUDを更新する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const abilityAcquiredHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-acquired')?.[1];
    expect(abilityAcquiredHandler).toBeInstanceOf(Function);

    abilityAcquiredHandler?.({ abilityType: 'fire' });

    expect(hudUpdateAbilityMock).toHaveBeenLastCalledWith('fire');
    expect(kirdyInstance.setAbility).toHaveBeenCalledWith('fire');

    const abilityClearedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-cleared')?.[1];
    expect(abilityClearedHandler).toBeInstanceOf(Function);

    abilityClearedHandler?.({});

    expect(hudUpdateAbilityMock).toHaveBeenLastCalledWith(undefined);
    expect(kirdyInstance.clearAbility).toHaveBeenCalled();
  });

  it('敵撃破イベントでスコアを加算してHUDに反映する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const enemyDefeatedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-defeated')?.[1];
    expect(enemyDefeatedHandler).toBeInstanceOf(Function);

    enemyDefeatedHandler?.({ enemyType: 'wabble-bee' });
    expect(hudUpdateScoreMock).toHaveBeenLastCalledWith(100);
    expect(kirdyInstance.addScore).toHaveBeenCalledWith(100);

    enemyDefeatedHandler?.({ enemyType: 'dronto-durt' });
    expect(hudUpdateScoreMock).toHaveBeenLastCalledWith(200);
    expect(kirdyInstance.addScore).toHaveBeenLastCalledWith(100);
  });

  it('ダメージを受けるとHPを減算しゲームオーバー閾値までHUDを更新する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    hudUpdateHPMock.mockClear();

    expect(scene.damagePlayer).toBeInstanceOf(Function);

    scene.damagePlayer(2);
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 4, max: 6 });

    scene.damagePlayer(10);
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 4, max: 6 });

    scene.update(16, 2000);
    scene.damagePlayer(10);
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 0, max: 6 });
  });

  it('フレーム更新でKirdyのHP変化を検知しHUDを即時更新する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();
    hudUpdateHPMock.mockClear();

    kirdyInstance.setHP?.(3);
    expect(hudUpdateHPMock).not.toHaveBeenCalled();

    scene.update(100, 16);

    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 3, max: 6 });
  });

  it('HPが0になるとゲームオーバーシーンを起動する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const enemyDefeatedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-defeated')?.[1];
    enemyDefeatedHandler?.({ enemyType: 'wabble-bee' });

    const abilityAcquiredHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-acquired')?.[1];
    abilityAcquiredHandler?.({ abilityType: 'fire' });

    scene.damagePlayer(6);

    expect(stubs.scenePlugin.pause).toHaveBeenCalledWith(SceneKeys.Game);
    const launchCall = stubs.scenePlugin.launch.mock.calls.find(([sceneKey]) => sceneKey === SceneKeys.GameOver);
    expect(launchCall?.[1]).toEqual(expect.objectContaining({ score: 100, ability: 'fire' }));
  });

  it('シーンを停止して再開した後でもプレイヤー入力が再構築される', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownCall = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown');
    expect(shutdownCall?.[1]).toBeInstanceOf(Function);

    PlayerInputManagerMock.mockClear();
    playerInputSetSwallowDownMock.mockClear();
    playerInputDestroyMock.mockClear();

    shutdownCall?.[1]?.();

    expect(playerInputDestroyMock).toHaveBeenCalledTimes(1);

    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(PlayerInputManagerMock).toHaveBeenCalled();
    expect(playerInputDestroyMock).not.toHaveBeenCalledTimes(2);
    expect((scene as any).playerInput).toBeDefined();
  });

  it('ゲームオーバー後にタイトルへ戻る際はセーブデータをクリアする', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownCall = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown');
    expect(shutdownCall?.[1]).toBeInstanceOf(Function);
    const shutdownHandler = shutdownCall?.[1];

    scene.damagePlayer(6);
    saveManagerClearMock.mockClear();

    shutdownHandler?.();

    expect(saveManagerClearMock).toHaveBeenCalledTimes(1);
  });

  it('ゲームオーバーでない終了ではセーブデータを保持する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownCall = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown');
    expect(shutdownCall?.[1]).toBeInstanceOf(Function);
    const shutdownHandler = shutdownCall?.[1];

    saveManagerClearMock.mockClear();
    shutdownHandler?.();

    expect(saveManagerClearMock).not.toHaveBeenCalled();
  });

  it('ゲームオーバー状態のセーブデータで再開した場合はクリアして新規開始する', () => {
    const gameOverSnapshot = {
      player: {
        hp: 0,
        maxHP: 6,
        score: 1230,
        ability: 'fire',
        position: { x: 512, y: 512 },
      },
      area: {
        currentAreaId: 'central-hub',
        discoveredAreas: ['central-hub'],
        exploredTiles: { 'central-hub': ['10,10'] },
        lastKnownPlayerPosition: { x: 512, y: 512 },
        completedAreas: [],
        collectedItems: [],
      },
      settings: {
        volume: 0.4,
        controls: 'keyboard',
        difficulty: 'normal',
      },
    } as any;

    saveManagerLoadMock.mockReturnValueOnce(gameOverSnapshot);

    const scene = new GameScene();
    const kirdyStub = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyStub);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(saveManagerClearMock).toHaveBeenCalledTimes(1);
    expect(createKirdyMock).toHaveBeenCalledWith(scene, defaultAreaState.playerSpawnPosition, expect.anything());
    expect(kirdyStub.setHP).not.toHaveBeenCalledWith(0);
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 6, max: 6 });
  });

  it('ゲーム再開時に入力プラグインを再有効化する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownCall = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown');
    const shutdownHandler = shutdownCall?.[1];

    const inputPlugin = scene.input as unknown as {
      enabled: boolean;
      mouse?: { enabled?: boolean };
      touch?: { enabled?: boolean };
      keyboard: typeof stubs.keyboard | undefined;
    };

    inputPlugin.enabled = false;
    const keyboardPlugin = inputPlugin.keyboard;
    if (!keyboardPlugin) {
      throw new Error('keyboard plugin missing in test setup');
    }
    keyboardPlugin.enabled = false;
    keyboardPlugin.manager.enabled = false;
    if (inputPlugin.mouse) {
      inputPlugin.mouse.enabled = false;
    }
    if (inputPlugin.touch) {
      inputPlugin.touch.enabled = false;
    }
    stubs.keyboard.resetKeys.mockClear();
    stubs.keyboardManager.resetKeys.mockClear();
    stubs.keyboardManager.releaseAllKeys.mockClear();
    stubs.keyboardManager.clearCaptures.mockClear();

    shutdownHandler?.();

    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const refreshedInput = scene.input as unknown as {
      enabled: boolean;
      mouse?: { enabled?: boolean };
      touch?: { enabled?: boolean };
      keyboard?: typeof stubs.keyboard;
    };

    expect(refreshedInput.enabled).toBe(true);
    expect(refreshedInput.keyboard?.enabled).toBe(true);
    expect(stubs.keyboard.resetKeys).toHaveBeenCalled();
    expect(stubs.keyboardManager.enabled).toBe(true);
    expect(stubs.keyboardManager.resetKeys).toHaveBeenCalled();
    expect(stubs.keyboardManager.releaseAllKeys).toHaveBeenCalled();
    expect(stubs.keyboardManager.clearCaptures).toHaveBeenCalled();
    expect(refreshedInput.mouse?.enabled).toBe(true);
    expect(refreshedInput.touch?.enabled).toBe(true);
  });

  it('refreshes the world map overlay when the player discovers a new area while it is visible', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub({
      sprite: {
        x: defaultAreaState.playerSpawnPosition.x,
        y: defaultAreaState.playerSpawnPosition.y,
        body: {
          position: {
            x: defaultAreaState.playerSpawnPosition.x,
            y: defaultAreaState.playerSpawnPosition.y,
          },
        },
        setPosition: vi.fn(),
        setVelocity: vi.fn(),
      },
    });
    createKirdyMock.mockReturnValue(kirdyInstance);

    const mirrorCorridorState = {
      definition: { id: 'mirror-corridor' },
      tileMap: {
        tileSize: 32,
        columns: 20,
        rows: 5,
        getClampedTileCoordinate: vi.fn().mockReturnValue({ column: 15, row: 2 }),
      },
      pixelBounds: { width: 640, height: 160 },
      playerSpawnPosition: { x: 96, y: 96 },
    };

    let currentState = defaultAreaState;
    const areaStates = {
      'central-hub': defaultAreaState,
      'mirror-corridor': mirrorCorridorState,
    } as const;

    areaManagerGetStateMock.mockImplementation(() => currentState as any);

    let discoveredAreas: string[] = ['central-hub'];
    areaManagerGetDiscoveredMock.mockImplementation(() => [...discoveredAreas]);

    areaManagerGetExplorationStateMock.mockImplementation((areaId: string) => {
      if (areaId === 'central-hub') {
        return { visitedTiles: 8, totalTiles: 20, completion: 0.4 };
      }

      if (areaId === 'mirror-corridor') {
        return { visitedTiles: 2, totalTiles: 10, completion: 0.2 };
      }

      return { visitedTiles: 0, totalTiles: 0, completion: 0 };
    });

    areaManagerGetAllDefinitionsMock.mockReturnValue([
      { id: 'central-hub', name: 'Central Hub' },
      { id: 'mirror-corridor', name: 'Mirror Corridor' },
    ]);

    areaManagerUpdateMock.mockImplementationOnce(() => {
      currentState = mirrorCorridorState as any;
      discoveredAreas = ['central-hub', 'mirror-corridor'];
      return {
        areaChanged: true,
        transition: {
          from: 'central-hub',
          to: 'mirror-corridor',
          via: 'east',
          entryPosition: mirrorCorridorState.playerSpawnPosition,
        },
      };
    });
    areaManagerUpdateMock.mockImplementation(() => ({ areaChanged: false }));

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(MapOverlayMock).toHaveBeenCalledWith(scene);

    const mapToggleHandler = stubs.keyboard.on.mock.calls.find(([event]) => event === 'keydown-M')?.[1];
    expect(mapToggleHandler).toBeInstanceOf(Function);

    mapOverlayIsVisibleMock.mockReturnValue(false);
    mapToggleHandler?.({});

    expect(mapOverlayUpdateMock).toHaveBeenCalledWith([
      {
        id: 'central-hub',
        name: 'Central Hub',
        discovered: true,
        isCurrent: true,
        exploration: { visitedTiles: 8, totalTiles: 20, completion: 0.4 },
      },
      {
        id: 'mirror-corridor',
        name: 'Mirror Corridor',
        discovered: false,
        isCurrent: false,
        exploration: { visitedTiles: 0, totalTiles: 0, completion: 0 },
      },
    ]);

    mapOverlayUpdateMock.mockClear();
    mapOverlayIsVisibleMock.mockReturnValue(true);

    const boundsWidth = defaultAreaState.pixelBounds.width;
    kirdyInstance.sprite.x = boundsWidth + defaultAreaState.tileMap.tileSize;
    kirdyInstance.sprite.body.position.x = kirdyInstance.sprite.x;

    scene.update(0, 16);

    expect(mapOverlayUpdateMock).toHaveBeenCalledWith([
      {
        id: 'central-hub',
        name: 'Central Hub',
        discovered: true,
        isCurrent: false,
        exploration: { visitedTiles: 8, totalTiles: 20, completion: 0.4 },
      },
      {
        id: 'mirror-corridor',
        name: 'Mirror Corridor',
        discovered: true,
        isCurrent: true,
        exploration: { visitedTiles: 2, totalTiles: 10, completion: 0.2 },
      },
    ]);
  });

  it('updates the world map overlay while visible when exploration increases in the current area', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    let completion = 0.25;
    areaManagerGetExplorationStateMock.mockImplementation((areaId: string) => {
      if (areaId === 'central-hub') {
        return {
          visitedTiles: Math.round(20 * completion),
          totalTiles: 20,
          completion,
        };
      }

      return { visitedTiles: 0, totalTiles: 0, completion: 0 };
    });

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    const mapToggleHandler = stubs.keyboard.on.mock.calls.find(([event]) => event === 'keydown-M')?.[1];
    expect(mapToggleHandler).toBeInstanceOf(Function);

    mapToggleHandler?.({});

    expect(mapOverlayUpdateMock).toHaveBeenCalledWith([
      {
        id: 'central-hub',
        name: 'Central Hub',
        discovered: true,
        isCurrent: true,
        exploration: { visitedTiles: 5, totalTiles: 20, completion: 0.25 },
      },
      {
        id: 'mirror-corridor',
        name: 'Mirror Corridor',
        discovered: false,
        isCurrent: false,
        exploration: { visitedTiles: 0, totalTiles: 0, completion: 0 },
      },
    ]);

    mapOverlayUpdateMock.mockClear();
    mapOverlayIsVisibleMock.mockReturnValue(true);
    completion = 0.6;

    scene.update(0, 16);

    expect(mapOverlayUpdateMock).toHaveBeenCalledWith([
      {
        id: 'central-hub',
        name: 'Central Hub',
        discovered: true,
        isCurrent: true,
        exploration: { visitedTiles: 12, totalTiles: 20, completion: 0.6 },
      },
      {
        id: 'mirror-corridor',
        name: 'Mirror Corridor',
        discovered: false,
        isCurrent: false,
        exploration: { visitedTiles: 0, totalTiles: 0, completion: 0 },
      },
    ]);
  });

  it('壁タイル内に侵入したプレイヤーを直前の安全位置へ戻す', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    scene.update(0, 16);

    kirdyInstance.sprite.setPosition.mockClear();
    kirdyInstance.sprite.setVelocity.mockClear();

    const tileSize = defaultAreaState.tileMap.tileSize;
    const wallColumn = 0;
    const wallRow = 0;
    const wallX = wallColumn * tileSize + tileSize / 2;
    const wallY = wallRow * tileSize + tileSize / 2;

    kirdyInstance.sprite.x = wallX;
    kirdyInstance.sprite.y = wallY;
    kirdyInstance.sprite.body.position.x = wallX;
    kirdyInstance.sprite.body.position.y = wallY;

    scene.update(16, 16);

    const spawn = defaultAreaState.playerSpawnPosition;
    expect(kirdyInstance.sprite.setPosition).toHaveBeenCalledWith(spawn.x, spawn.y);
    expect(kirdyInstance.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it('spawns a Wabble Bee enemy and adds it to the update loop and inhale targets', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    const kirdyInstance = makeKirdyStub({
      update: updateSpy,
      sprite: { x: 160, y: 360 },
    });
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    const enemyMock = {
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(3),
      isDefeated: vi.fn().mockReturnValue(false),
      getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
      getAbilityType: vi.fn().mockReturnValue('fire'),
    };

    createWabbleBeeMock.mockReturnValueOnce(enemyMock as any);

    const enemy = scene.spawnWabbleBee({ x: 100, y: 200 });

    expect(enemy).toBe(enemyMock);
    expect(createWabbleBeeMock).toHaveBeenCalledWith(scene, { x: 100, y: 200 }, expect.objectContaining({
      getPlayerPosition: expect.any(Function),
    }));
    expect(inhaleSystemAddTargetMock).toHaveBeenCalledWith(enemyMock.sprite);
    expect(physicsRegisterEnemyMock).toHaveBeenCalledWith(enemyMock);

    scene.update(0, 16);
    expect(enemyMock.update).toHaveBeenCalledWith(16);
  });

  it('filters defeated enemies from the update loop', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 0, y: 0 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const updateFn = vi.fn();
    const isDefeated = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const enemyMock = {
      sprite: enemySpriteFactory(),
      update: updateFn,
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(1),
      isDefeated,
      getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
      getAbilityType: vi.fn(),
    };

    createWabbleBeeMock.mockReturnValueOnce(enemyMock as any);

    scene.spawnWabbleBee({ x: 0, y: 0 });

    scene.update(0, 16);
    scene.update(16, 16);

    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  it('spawns a Dronto Durt enemy with player tracking options', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 32, y: 48 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const dronto = {
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(4),
      isDefeated: vi.fn().mockReturnValue(false),
      getEnemyType: vi.fn().mockReturnValue('dronto-durt'),
      getAbilityType: vi.fn().mockReturnValue('sword'),
    };

    createDrontoDurtMock.mockReturnValueOnce(dronto as any);

    const result = scene.spawnDrontoDurt({ x: 200, y: 120 });

    expect(result).toBe(dronto);
    expect(createDrontoDurtMock).toHaveBeenCalledWith(scene, { x: 200, y: 120 }, expect.objectContaining({
      getPlayerPosition: expect.any(Function),
    }));
    expect(inhaleSystemAddTargetMock).toHaveBeenCalledWith(dronto.sprite);
    expect(physicsRegisterEnemyMock).toHaveBeenCalledWith(dronto);
  });

  it('limits active enemies to three and resumes spawning when a slot frees up', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 0, y: 0 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();
    scene.setEnemyAutoSpawnEnabled(false);

    const makeEnemy = () => ({
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(3),
      isDefeated: vi.fn().mockReturnValue(false),
      getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
      getAbilityType: vi.fn().mockReturnValue('fire'),
    });

    const enemy1 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy1 as any);
    const result1 = scene.spawnWabbleBee({ x: 0, y: 0 });
    expect(result1).toBe(enemy1);

    scene.update(0, 5000);
    const earlyBlocked = scene.spawnWabbleBee({ x: 16, y: 0 });
    expect(earlyBlocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(1);

    scene.update(5000, 5000);

    const enemy2 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy2 as any);
    const result2 = scene.spawnWabbleBee({ x: 16, y: 0 });
    expect(result2).toBe(enemy2);

    scene.update(0, 5000);
    const secondEarlyBlocked = scene.spawnWabbleBee({ x: 32, y: 0 });
    expect(secondEarlyBlocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(2);

    scene.update(5000, 5000);

    const enemy3 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy3 as any);
    const result3 = scene.spawnWabbleBee({ x: 32, y: 0 });
    expect(result3).toBe(enemy3);

    scene.update(0, 5000);
    const blocked = scene.spawnWabbleBee({ x: 48, y: 0 });
    expect(blocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(3);

    const enemy4 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy4 as any);

    enemy1.isDefeated.mockReturnValue(true);

    scene.update(0, 16);
    const reopenBlocked = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(reopenBlocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(3);

    scene.update(16, 5000);

    const reopened = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(reopened).toBe(enemy4);
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(4);
    expect(inhaleSystemAddTargetMock).toHaveBeenCalledTimes(4);
  });

  it('enforces a cooldown between enemy spawns', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 0, y: 0 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();
    scene.setEnemyAutoSpawnEnabled(false);

    const makeEnemy = () => ({
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(3),
      isDefeated: vi.fn().mockReturnValue(false),
      getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
      getAbilityType: vi.fn().mockReturnValue('fire'),
    });

    const firstEnemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(firstEnemy as any);
    const spawned = scene.spawnWabbleBee({ x: 0, y: 0 });
    expect(spawned).toBeDefined();
    expect(spawned?.sprite).toBe(firstEnemy.sprite);

    const secondEnemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(secondEnemy as any);
    const blocked = scene.spawnWabbleBee({ x: 32, y: 0 });
    expect(blocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(1);

    scene.update(100, 5000);
    const stillBlocked = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(stillBlocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(1);

    scene.update(5100, 5000);

    const allowed = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(allowed).toBeDefined();
    expect(allowed?.sprite).toBe(secondEnemy.sprite);
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(2);
  });

  it('ステージ設定に従って異なるタイプの敵を自動スポーンする', () => {
    const scene = new GameScene();
    defaultAreaState.definition.enemySpawns = {
      baseline: 3,
      entries: [
        { type: 'wabble-bee', limit: 2 },
        { type: 'dronto-durt', limit: 1 },
      ],
    };
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 0, y: 0 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    expect(createWabbleBeeMock).not.toHaveBeenCalled();
    expect(createDrontoDurtMock).not.toHaveBeenCalled();

    scene.update(0, 16);

    expect(createWabbleBeeMock).toHaveBeenCalled();
    expect(createDrontoDurtMock).toHaveBeenCalled();
  });

  it('disperses extra enemies when more than two cluster near Kirdy', () => {
    const kirdySprite = {
      x: 160,
      y: 360,
    };
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(
      makeKirdyStub({
        sprite: {
          ...kirdySprite,
        },
      }),
    );
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();
    scene.setEnemyAutoSpawnEnabled(false);

    const makeEnemy = () => {
      const sprite = enemySpriteFactory();
      return {
        sprite,
        update: vi.fn(),
        takeDamage: vi.fn(),
        getHP: vi.fn().mockReturnValue(3),
        isDefeated: vi.fn().mockReturnValue(false),
        getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
        getAbilityType: vi.fn().mockReturnValue('fire'),
        onDisperse: vi.fn(),
      };
    };

    const advanceCooldown = () => {
      scene.update(0, 5000);
      scene.update(5000, 5000);
    };

    const enemy1 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy1 as any);
    scene.spawnWabbleBee({ x: kirdySprite.x + 4, y: kirdySprite.y + 4 });
    enemy1.sprite.x = kirdySprite.x + 4;
    enemy1.sprite.y = kirdySprite.y + 4;

    advanceCooldown();

    const enemy2 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy2 as any);
    scene.spawnWabbleBee({ x: kirdySprite.x - 6, y: kirdySprite.y - 2 });
    enemy2.sprite.x = kirdySprite.x - 6;
    enemy2.sprite.y = kirdySprite.y - 2;

    advanceCooldown();

    const enemy3 = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy3 as any);
    scene.spawnWabbleBee({ x: kirdySprite.x + 2, y: kirdySprite.y });
    enemy3.sprite.x = kirdySprite.x + 2;
    enemy3.sprite.y = kirdySprite.y;

    const enemies = [enemy1, enemy2, enemy3];
    const initialPositionCounts = enemies.map((entry) => entry.sprite.setPosition.mock.calls.length);

    scene.update(0, 16);

    enemies.forEach((entry, index) => {
      expect(entry.sprite.setPosition.mock.calls.length).toBe(initialPositionCounts[index]);
    });

    const dispersed = enemies.filter((entry) => entry.onDisperse.mock.calls.length > 0);
    expect(dispersed.length).toBeGreaterThan(0);

    dispersed.forEach((entry) => {
      expect(entry.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
      const [context] = entry.onDisperse.mock.calls.at(-1) ?? [];
      expect(context).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      const dx = (context?.x ?? 0) - kirdySprite.x;
      const dy = (context?.y ?? 0) - kirdySprite.y;
      const distance = Math.hypot(dx, dy);
      expect(distance).toBeGreaterThanOrEqual(96);
    });
  });

  it('forwards sampled input snapshots to Kirdy on update', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    createKirdyMock.mockReturnValue(makeKirdyStub({ update: updateSpy }));

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
    const kirdyInstance = makeKirdyStub();
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
    const physicsInstance = PhysicsSystemMock.mock.results[0]?.value;
    expect(SwallowSystemMock).toHaveBeenCalledWith(scene, kirdyInstance, inhaleInstance, physicsInstance);

    scene.update(32, 16);

    expect(inhaleSystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
    expect(swallowSystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
  });

  it('creates the ability system and forwards action updates', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot({
      actions: {
        spit: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    const createdPhysics = PhysicsSystemMock.mock.results[0]?.value;
    expect(AbilitySystemMock).toHaveBeenCalledWith(
      scene,
      kirdyInstance,
      createdPhysics,
      expect.anything(),
    );

    scene.update(16, 16);

    expect(abilitySystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
  });

  it('applies swallowed payloads to the ability system', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    const payload = { abilityType: 'fire' };
    swallowSystemConsumeMock.mockReturnValueOnce(payload);

    scene.create();
    scene.update(0, 16);

    expect(abilitySystemApplyPayloadMock).toHaveBeenCalledWith(payload);
  });

  it('exposes helpers to manage inhalable targets from other systems', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
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
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const shutdownHandler = stubs.events.once.mock.calls.find(([event]) => event === 'shutdown')?.[1];
    expect(shutdownHandler).toBeInstanceOf(Function);

    shutdownHandler?.();

    expect(playerInputDestroyMock).toHaveBeenCalled();
    expect(mapOverlayDestroyMock).toHaveBeenCalled();
  });

  it('exposes the latest player input snapshot for other systems', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    createKirdyMock.mockReturnValue(makeKirdyStub({ update: updateSpy }));

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
