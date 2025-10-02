import { beforeEach, describe, expect, it, vi } from 'vitest';

const stubs = vi.hoisted(() => {
  const keyboard = {
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
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

  const matterFactory = {
    add: {
      existing: vi.fn(),
    },
  };

  const cameraStartFollow = vi.fn();

  class PhaserSceneMock {
    public input = { keyboard };
    public matter = matterFactory;
    public scene = scenePlugin;
    public events = events;
    public cameras = {
      main: {
        worldView: { x: 0, y: 0, width: 800, height: 600 },
        startFollow: cameraStartFollow,
      },
    };
  }

  return { keyboard, scenePlugin, matterFactory, events, cameraStartFollow, PhaserSceneMock };
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
    getAbilityType: vi.fn().mockReturnValue('fire'),
  })),
);

const createDrontoDurtMock = vi.hoisted(() =>
  vi.fn(() => ({
    sprite: enemySpriteFactory(),
    update: enemyUpdateMock,
    takeDamage: vi.fn(),
    getHP: vi.fn().mockReturnValue(4),
    isDefeated: enemyIsDefeatedMock,
    getAbilityType: vi.fn().mockReturnValue('sword'),
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
  vi.fn(() => ({
    updateHP: hudUpdateHPMock,
    updateAbility: hudUpdateAbilityMock,
    updateScore: hudUpdateScoreMock,
    destroy: hudDestroyMock,
  })),
);

vi.mock('../ui/Hud', () => ({
  Hud: HudMock,
}));

const physicsRegisterPlayerMock = vi.hoisted(() => vi.fn());
const physicsRegisterTerrainMock = vi.hoisted(() => vi.fn());
const physicsRegisterEnemyMock = vi.hoisted(() => vi.fn());
const physicsDestroyProjectileMock = vi.hoisted(() => vi.fn());

const PhysicsSystemMock = vi.hoisted(() =>
  vi.fn(() => ({
    registerPlayer: physicsRegisterPlayerMock,
    registerTerrain: physicsRegisterTerrainMock,
    registerEnemy: physicsRegisterEnemyMock,
    registerPlayerAttack: vi.fn(),
    destroyProjectile: physicsDestroyProjectileMock,
  })),
);

vi.mock('../physics/PhysicsSystem', () => ({
  PhysicsSystem: PhysicsSystemMock,
}));

import { GameScene, SceneKeys } from './index';

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
    physicsRegisterPlayerMock.mockClear();
    physicsRegisterTerrainMock.mockClear();
    physicsRegisterEnemyMock.mockClear();
    physicsDestroyProjectileMock.mockClear();
    PhysicsSystemMock.mockClear();
    AreaManagerMock.mockClear();
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

    defaultAreaState = {
      definition: { id: 'central-hub' },
      tileMap: {
        tileSize,
        columns,
        rows,
        getClampedTileCoordinate: tileKeyFn,
        getTileAt,
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
    stubs.cameraStartFollow.mockClear();
    stubs.matterFactory.add.rectangle = vi.fn();
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

    return {
      update: vi.fn(),
      ...overrides,
      sprite,
    };
  }

  it('creates a Kirdy instance and player input manager during setup', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(createKirdyMock).toHaveBeenCalledWith(scene, defaultAreaState.playerSpawnPosition);
    expect(PlayerInputManagerMock).toHaveBeenCalledWith(scene);
    expect((scene as any).kirdy).toBe(kirdyInstance);
    expect((scene as any).playerInput).toBeDefined();
    expect(stubs.keyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    expect(stubs.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
    expect(PhysicsSystemMock).toHaveBeenCalledWith(scene);
    expect(physicsRegisterPlayerMock).toHaveBeenCalledWith(kirdyInstance);
    expect(AreaManagerMock).toHaveBeenCalled();
  });

  it('メインカメラがカービィを追従するよう設定する', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot();
    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(stubs.cameraStartFollow).toHaveBeenCalled();
    expect(stubs.cameraStartFollow.mock.calls[0]?.[0]).toBe(kirdyInstance.sprite);
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

    const createdBodies: unknown[] = [];
    const rectangleStub = vi.fn(() => {
      const body = {};
      createdBodies.push(body);
      return body;
    });
    stubs.matterFactory.add.rectangle = rectangleStub;

    scene.create();

    const expectedSolidTiles = layout.flat().filter((tile) => tile === 'wall').length;
    expect(rectangleStub).toHaveBeenCalledTimes(expectedSolidTiles);
    expect(physicsRegisterTerrainMock).toHaveBeenCalledTimes(expectedSolidTiles);
    createdBodies.forEach((body) => {
      expect(physicsRegisterTerrainMock).toHaveBeenCalledWith(body);
    });
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

  it('画面外の敵を一時的に非アクティブ化し、戻った際に復帰させる', () => {
    const scene = new GameScene();
    const kirdyInstance = makeKirdyStub();
    createKirdyMock.mockReturnValue(kirdyInstance);
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const firstEnemy = scene.spawnWabbleBee({ x: 48, y: 48 });
    (scene as any).enemySpawnCooldownRemaining = 0;
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

    // move Kirdy beyond bounds to trigger transition
    kirdyInstance.sprite.x = defaultAreaState.pixelBounds.width + 10;
    kirdyInstance.sprite.y = defaultAreaState.playerSpawnPosition.y;
    if (kirdyInstance.sprite.body?.position) {
      kirdyInstance.sprite.body.position.x = kirdyInstance.sprite.x;
      kirdyInstance.sprite.body.position.y = kirdyInstance.sprite.y;
    }

    scene.update(0, 16);

    expect(areaManagerUpdateMock).toHaveBeenCalledWith({
      x: kirdyInstance.sprite.x,
      y: kirdyInstance.sprite.y,
    });
    expect(kirdyInstance.sprite.setPosition).toHaveBeenCalledWith(entryPosition.x, entryPosition.y);
    expect(kirdyInstance.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
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

    scene.create();

    const abilityAcquiredHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-acquired')?.[1];
    abilityAcquiredHandler?.({ abilityType: capturedAbility });

    expect(saveManagerLoadMock).toHaveBeenCalled();
    expect(createKirdyMock).toHaveBeenCalledWith(scene, savedSnapshot.area.lastKnownPlayerPosition);
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 3, max: 6 });
    expect(hudUpdateScoreMock).toHaveBeenCalledWith(450);
    expect(hudUpdateAbilityMock).toHaveBeenCalledWith('ice');
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
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const abilityAcquiredHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-acquired')?.[1];
    expect(abilityAcquiredHandler).toBeInstanceOf(Function);

    abilityAcquiredHandler?.({ abilityType: 'fire' });

    expect(hudUpdateAbilityMock).toHaveBeenLastCalledWith('fire');

    const abilityClearedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'ability-cleared')?.[1];
    expect(abilityClearedHandler).toBeInstanceOf(Function);

    abilityClearedHandler?.({});

    expect(hudUpdateAbilityMock).toHaveBeenLastCalledWith(undefined);
  });

  it('敵撃破イベントでスコアを加算してHUDに反映する', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub());
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const enemyDefeatedHandler = stubs.events.on.mock.calls.find(([event]) => event === 'enemy-defeated')?.[1];
    expect(enemyDefeatedHandler).toBeInstanceOf(Function);

    enemyDefeatedHandler?.({ enemyType: 'wabble-bee' });
    expect(hudUpdateScoreMock).toHaveBeenLastCalledWith(100);

    enemyDefeatedHandler?.({ enemyType: 'dronto-durt' });
    expect(hudUpdateScoreMock).toHaveBeenLastCalledWith(200);
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
    expect(hudUpdateHPMock).toHaveBeenLastCalledWith({ current: 0, max: 6 });
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

    const makeEnemy = () => ({
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(3),
      isDefeated: vi.fn().mockReturnValue(false),
      getAbilityType: vi.fn().mockReturnValue('fire'),
    });

    const enemy1 = makeEnemy();
    const enemy2 = makeEnemy();
    const enemy3 = makeEnemy();
    const enemy4 = makeEnemy();

    const advanceCooldown = () => {
      scene.update(0, 600);
      scene.update(600, 600);
    };

    createWabbleBeeMock.mockReturnValueOnce(enemy1 as any);
    const result1 = scene.spawnWabbleBee({ x: 0, y: 0 });
    expect(result1).toBe(enemy1);

    advanceCooldown();

    createWabbleBeeMock.mockReturnValueOnce(enemy2 as any);
    const result2 = scene.spawnWabbleBee({ x: 16, y: 0 });
    expect(result2).toBe(enemy2);

    advanceCooldown();

    createWabbleBeeMock.mockReturnValueOnce(enemy3 as any);
    const result3 = scene.spawnWabbleBee({ x: 32, y: 0 });
    expect(result3).toBe(enemy3);

    advanceCooldown();

    createWabbleBeeMock.mockReturnValueOnce(enemy4 as any);
    const blocked = scene.spawnWabbleBee({ x: 48, y: 0 });
    expect(blocked).toBeUndefined();
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(3);

    enemy1.isDefeated.mockReturnValue(true);
    scene.update(1200, 16);
    advanceCooldown();

    const reopened = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(reopened).toBe(enemy4);
    expect(inhaleSystemAddTargetMock).toHaveBeenCalledTimes(4);
  });

  it('enforces a cooldown between enemy spawns', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue(makeKirdyStub({ sprite: { x: 0, y: 0 } }));
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const makeEnemy = () => ({
      sprite: enemySpriteFactory(),
      update: vi.fn(),
      takeDamage: vi.fn(),
      getHP: vi.fn().mockReturnValue(3),
      isDefeated: vi.fn().mockReturnValue(false),
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

    scene.update(100, 600);
    scene.update(700, 600);

    const allowed = scene.spawnWabbleBee({ x: 64, y: 0 });
    expect(allowed).toBeDefined();
    expect(allowed?.sprite).toBe(secondEnemy.sprite);
    expect(createWabbleBeeMock).toHaveBeenCalledTimes(2);
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

    const makeEnemy = () => {
      const sprite = enemySpriteFactory();
      return {
        sprite,
        update: vi.fn(),
        takeDamage: vi.fn(),
        getHP: vi.fn().mockReturnValue(3),
        isDefeated: vi.fn().mockReturnValue(false),
        getAbilityType: vi.fn().mockReturnValue('fire'),
      };
    };

    const advanceCooldown = () => {
      scene.update(0, 600);
      scene.update(600, 600);
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

    scene.update(0, 16);

    const repositioned = [enemy1, enemy2, enemy3]
      .map((entry) => entry.sprite.setPosition.mock.calls.at(-1))
      .filter((call): call is [number, number] => Array.isArray(call));

    expect(repositioned.length).toBeGreaterThan(0);

    repositioned.forEach(([newX, newY]) => {
      const dx = newX - kirdySprite.x;
      const dy = newY - kirdySprite.y;
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
