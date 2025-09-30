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
  setData: vi.fn(),
  setActive: vi.fn(),
  setVisible: vi.fn(),
  destroy: vi.fn(),
}));

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

import { GameScene } from './index';

describe('GameScene player integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enemyIsDefeatedMock.mockReset();
    enemyIsDefeatedMock.mockReturnValue(false);
    enemyUpdateMock.mockReset();
    createWabbleBeeMock.mockClear();
    createDrontoDurtMock.mockClear();
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

  it('spawns a Wabble Bee enemy and adds it to the update loop and inhale targets', () => {
    const scene = new GameScene();
    const updateSpy = vi.fn();
    const kirdySprite = { x: 160, y: 360 };
    createKirdyMock.mockReturnValue({ update: updateSpy, sprite: kirdySprite });

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

    scene.update(0, 16);
    expect(enemyMock.update).toHaveBeenCalledWith(16);
  });

  it('filters defeated enemies from the update loop', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue({ update: vi.fn(), sprite: { x: 0, y: 0 } });
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
    createKirdyMock.mockReturnValue({ update: vi.fn(), sprite: { x: 32, y: 48 } });
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
  });

  it('limits active enemies to three and resumes spawning when a slot frees up', () => {
    const scene = new GameScene();
    createKirdyMock.mockReturnValue({ update: vi.fn(), sprite: { x: 0, y: 0 } });
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
    createKirdyMock.mockReturnValue({ update: vi.fn(), sprite: { x: 0, y: 0 } });
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
    const kirdySprite = { x: 160, y: 360 };
    const scene = new GameScene();
    createKirdyMock.mockReturnValue({ update: vi.fn(), sprite: kirdySprite });
    playerInputUpdateMock.mockReturnValue(createSnapshot());

    scene.create();

    const makeEnemy = () => {
      const sprite = enemySpriteFactory();
      sprite.setPosition = vi.fn();
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

  it('creates the ability system and forwards action updates', () => {
    const scene = new GameScene();
    const kirdyInstance = { update: vi.fn() };
    createKirdyMock.mockReturnValue(kirdyInstance);

    const snapshot = createSnapshot({
      actions: {
        spit: { isDown: true, justPressed: true },
      },
    });

    playerInputUpdateMock.mockReturnValue(snapshot);

    scene.create();

    expect(AbilitySystemMock).toHaveBeenCalledWith(scene, kirdyInstance);

    scene.update(16, 16);

    expect(abilitySystemUpdateMock).toHaveBeenCalledWith(snapshot.actions);
  });

  it('applies swallowed payloads to the ability system', () => {
    const scene = new GameScene();
    const kirdyInstance = { update: vi.fn() };
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
