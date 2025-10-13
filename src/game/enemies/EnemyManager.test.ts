import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { Enemy, EnemySpawn } from './index';

type Bounds = { left: number; right: number; top: number; bottom: number };

type PlayerPosition = { x: number; y: number } | undefined;

type TestEnemy = Enemy & {
  sprite: Enemy['sprite'] & {
    setActive: Mock;
    setVisible: Mock;
    setPosition: Mock;
    setVelocity: Mock;
    destroy: Mock;
  };
  update: Mock;
  takeDamage: Mock;
  getHP: Mock;
  isDefeated: Mock;
  getAbilityType: Mock;
  getEnemyType: Mock;
  onDisperse: Mock;
};

const createWabbleBeeMock = vi.hoisted(() => vi.fn());
const createFrostWabbleMock = vi.hoisted(() => vi.fn());
const createDrontoDurtMock = vi.hoisted(() => vi.fn());
const createGlacioDurtMock = vi.hoisted(() => vi.fn());

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>();
  return {
    ...actual,
    createWabbleBee: createWabbleBeeMock,
    createFrostWabble: createFrostWabbleMock,
    createDrontoDurt: createDrontoDurtMock,
    createGlacioDurt: createGlacioDurtMock,
  };
});

describe('EnemyManager', () => {
  const makeSprite = (): TestEnemy['sprite'] => {
    const sprite: any = {
      x: 0,
      y: 0,
      body: { position: { x: 0, y: 0 } },
      destroy: vi.fn(),
    };

    sprite.setActive = vi.fn(() => sprite);
    sprite.setVisible = vi.fn(() => sprite);
    sprite.setVelocity = vi.fn(() => sprite);
    sprite.setTint = vi.fn(() => sprite);
    sprite.clearTint = vi.fn(() => sprite);
    sprite.setPosition = vi.fn((x?: number, y?: number) => {
      if (Number.isFinite(x)) {
        sprite.x = x as number;
        if (sprite.body?.position) {
          sprite.body.position.x = x as number;
        }
      }
      if (Number.isFinite(y)) {
        sprite.y = y as number;
        if (sprite.body?.position) {
          sprite.body.position.y = y as number;
        }
      }
      return sprite;
    });

    return sprite as TestEnemy['sprite'];
  };

  const makeEnemy = (): TestEnemy => ({
    sprite: makeSprite(),
    update: vi.fn(),
    takeDamage: vi.fn(),
    getHP: vi.fn().mockReturnValue(3),
    isDefeated: vi.fn().mockReturnValue(false),
    getAbilityType: vi.fn(),
    getEnemyType: vi.fn().mockReturnValue('wabble-bee'),
    onDisperse: vi.fn(),
  });

  const makeSpawn = (x: number, y: number): EnemySpawn => ({ x, y });

  let EnemyManager: typeof import('./EnemyManager').EnemyManager;
  let manager: import('./EnemyManager').EnemyManager;
  let inhaleSystem: { addInhalableTarget: Mock; setInhalableTargets: Mock };
  let physicsSystem: { registerEnemy: Mock };
  let getPlayerPosition: Mock<[], PlayerPosition>;
  let getCullingBounds: Mock<[], Bounds | undefined>;
  let scene: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    createWabbleBeeMock.mockReset();
    createFrostWabbleMock.mockReset();
    createDrontoDurtMock.mockReset();
    createGlacioDurtMock.mockReset();

    const module = await import('./EnemyManager');
    EnemyManager = module.EnemyManager;

    inhaleSystem = {
      addInhalableTarget: vi.fn(),
      setInhalableTargets: vi.fn(),
    };

    physicsSystem = {
      registerEnemy: vi.fn(),
    };

    getPlayerPosition = vi.fn<[], PlayerPosition>(() => ({ x: 160, y: 360 }));
    getCullingBounds = vi.fn<[], Bounds | undefined>(() => ({ left: -32, right: 320, top: -32, bottom: 640 }));

    scene = { events: { emit: vi.fn() } };

    manager = new EnemyManager({
      scene,
      inhaleSystem,
      physicsSystem,
      getPlayerPosition,
      getCullingBounds,
      config: {
        maxActiveEnemies: 3,
        enemyClusterLimit: 2,
        enemySafetyRadius: 96,
        enemySpawnCooldownMs: 1200,
      },
    });
  });

  it('spawns a Wabble Bee and registers it with dependencies', () => {
    const enemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy);

    const spawn = makeSpawn(100, 200);
    const result = manager.spawnWabbleBee(spawn);

    expect(result).toBe(enemy);
    expect(createWabbleBeeMock).toHaveBeenCalledWith(scene, spawn, expect.objectContaining({
      getPlayerPosition: expect.any(Function),
    }));
    expect(inhaleSystem.addInhalableTarget).toHaveBeenCalledWith(enemy.sprite);
    expect(physicsSystem.registerEnemy).toHaveBeenCalledWith(enemy);
  });

  it('spawns a Frost Wabble and registers it with dependencies', () => {
    const enemy = makeEnemy();
    enemy.getEnemyType.mockReturnValue('frost-wabble');
    createFrostWabbleMock.mockReturnValueOnce(enemy);

    const spawn = makeSpawn(140, 260);
    const result = manager.spawnFrostWabble(spawn);

    expect(result).toBe(enemy);
    expect(createFrostWabbleMock).toHaveBeenCalledWith(scene, spawn, expect.objectContaining({
      getPlayerPosition: expect.any(Function),
    }));
    expect(inhaleSystem.addInhalableTarget).toHaveBeenCalledWith(enemy.sprite);
    expect(physicsSystem.registerEnemy).toHaveBeenCalledWith(enemy);
  });

  it('updates active enemies, prunes defeated ones, and refreshes inhale targets', () => {
    const activeEnemy = makeEnemy();
    const defeatedEnemy = makeEnemy();
    defeatedEnemy.isDefeated.mockReturnValueOnce(false).mockReturnValue(true);

    createWabbleBeeMock.mockReturnValueOnce(activeEnemy);
    createWabbleBeeMock.mockReturnValueOnce(defeatedEnemy);

    manager.spawnWabbleBee(makeSpawn(0, 0));
    manager.update(600);
    manager.update(600);
    manager.spawnWabbleBee(makeSpawn(32, 0));

    manager.update(16);

    expect(activeEnemy.update).toHaveBeenCalledWith(16);
    expect(defeatedEnemy.update).toHaveBeenCalledWith(16);

    manager.update(16);

    expect(inhaleSystem.setInhalableTargets).toHaveBeenLastCalledWith([activeEnemy.sprite]);
    expect(activeEnemy.update).toHaveBeenCalled();
    expect(defeatedEnemy.update).toHaveBeenCalledTimes(1);
    const lastActiveUpdate = activeEnemy.update.mock.calls.at(-1);
    expect(lastActiveUpdate).toEqual([16]);
  });

  it('enforces spawn limits and cooldown before allowing additional spawns', () => {
    const [enemy1, enemy2, enemy3, enemy4] = Array.from({ length: 4 }, makeEnemy);
    createWabbleBeeMock
      .mockReturnValueOnce(enemy1)
      .mockReturnValueOnce(enemy2)
      .mockReturnValueOnce(enemy3)
      .mockReturnValueOnce(enemy4);

    expect(manager.spawnWabbleBee(makeSpawn(0, 0))).toBe(enemy1);
    manager.update(600);
    manager.update(600);

    expect(manager.spawnWabbleBee(makeSpawn(16, 0))).toBe(enemy2);
    manager.update(600);
    manager.update(600);

    expect(manager.spawnWabbleBee(makeSpawn(32, 0))).toBe(enemy3);

    const blocked = manager.spawnWabbleBee(makeSpawn(48, 0));
    expect(blocked).toBeUndefined();

    enemy1.isDefeated.mockReturnValue(true);
    manager.update(16);
    manager.update(1200);

    const reopened = manager.spawnWabbleBee(makeSpawn(64, 0));
    expect(reopened).toBe(enemy4);
  });

  it('spawns a Glacio Durt variant through the dedicated factory', () => {
    const enemy = makeEnemy();
    enemy.getEnemyType.mockReturnValue('glacio-durt');
    createGlacioDurtMock.mockReturnValueOnce(enemy);

    const spawn = makeSpawn(220, 320);
    const result = manager.spawnGlacioDurt(spawn);

    expect(result).toBe(enemy);
    expect(createGlacioDurtMock).toHaveBeenCalledWith(scene, spawn, expect.objectContaining({
      getPlayerPosition: expect.any(Function),
    }));
    expect(inhaleSystem.addInhalableTarget).toHaveBeenCalledWith(enemy.sprite);
    expect(physicsSystem.registerEnemy).toHaveBeenCalledWith(enemy);
  });

  it('suspends captured enemies to stop AI updates and velocity', () => {
    const enemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy);

    manager.spawnWabbleBee(makeSpawn(0, 0));
    enemy.update.mockClear();
    enemy.sprite.setVelocity.mockClear();

    manager.suspendEnemy(enemy.sprite);
    manager.update(16);

    expect(enemy.update).not.toHaveBeenCalled();
    expect(enemy.sprite.setVelocity).toHaveBeenCalledWith(0, 0);

    manager.resumeEnemy(enemy.sprite);
    manager.update(16);

    expect(enemy.update).toHaveBeenCalledWith(16);
    expect(inhaleSystem.setInhalableTargets).toHaveBeenLastCalledWith([enemy.sprite]);
  });

  it('破棄された捕獲中の敵を update 中に安全に除去する', () => {
    const enemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy);

    manager.spawnWabbleBee(makeSpawn(0, 0));
    manager.update(16);

    manager.suspendEnemy(enemy.sprite);

    (enemy.sprite as any).destroyed = true;
    enemy.sprite.body = undefined as any;

    enemy.sprite.setActive.mockClear();
    enemy.sprite.setVisible.mockClear();
    enemy.sprite.setVelocity.mockClear();
    inhaleSystem.setInhalableTargets.mockClear();

    manager.update(16);

    expect(enemy.sprite.setActive).not.toHaveBeenCalled();
    expect(enemy.sprite.setVisible).not.toHaveBeenCalled();
    expect(enemy.sprite.setVelocity).not.toHaveBeenCalled();
    expect(manager.getActiveEnemyCount()).toBe(0);
    expect(inhaleSystem.setInhalableTargets).toHaveBeenCalledWith([]);
  });

  it('consumes suspended enemies to remove them from管理対象', () => {
    const enemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy);

    manager.spawnWabbleBee(makeSpawn(0, 0));
    manager.update(16);

    const removed = manager.consumeEnemy(enemy.sprite);

    expect(removed).toBe(true);
    expect(manager.getActiveEnemyCount()).toBe(0);
    expect(inhaleSystem.setInhalableTargets).toHaveBeenCalledWith([]);
  });

  it('disperses enemies that cluster too close to the player', () => {
    const enemies = Array.from({ length: 3 }, () => makeEnemy());
    createWabbleBeeMock
      .mockReturnValueOnce(enemies[0])
      .mockReturnValueOnce(enemies[1])
      .mockReturnValueOnce(enemies[2]);

    enemies.forEach((enemy, index) => {
      enemy.sprite.x = 160 + index * 2;
      enemy.sprite.y = 360 + index * 2;
    });

    manager.spawnWabbleBee(makeSpawn(160, 360));
    manager.update(600);
    manager.update(600);

    manager.spawnWabbleBee(makeSpawn(162, 362));
    manager.update(600);
    manager.update(600);

    manager.spawnWabbleBee(makeSpawn(164, 364));

    const initialPositionCounts = enemies.map((enemy) => enemy.sprite.setPosition.mock.calls.length);

    manager.update(16);

    enemies.forEach((enemy, index) => {
      expect(enemy.sprite.setPosition.mock.calls.length).toBe(initialPositionCounts[index]);
    });

    const dispersed = enemies.filter((enemy) => enemy.onDisperse.mock.calls.length > 0);
    expect(dispersed.length).toBeGreaterThan(0);
    dispersed.forEach((enemy) => {
      expect(enemy.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
      const [context] = enemy.onDisperse.mock.calls.at(-1) ?? [];
      expect(context).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      const dx = (context?.x ?? 0) - 160;
      const dy = (context?.y ?? 0) - 360;
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(96);
    });
  });

  it('deactivates enemies outside culling bounds without updating them', () => {
    const enemy = makeEnemy();
    enemy.sprite.x = 1000;
    enemy.sprite.y = 1000;

    createWabbleBeeMock.mockReturnValueOnce(enemy);

    manager.spawnWabbleBee(makeSpawn(1000, 1000));
    manager.update(16);

    expect(enemy.sprite.setActive).toHaveBeenCalledWith(false);
    expect(enemy.sprite.setVisible).toHaveBeenCalledWith(false);
    expect(enemy.update).not.toHaveBeenCalled();
  });

  it('destroys existing enemies when manager is destroyed', () => {
    const enemy = makeEnemy();
    createWabbleBeeMock.mockReturnValueOnce(enemy);

    manager.spawnWabbleBee(makeSpawn(64, 64));

    manager.destroy();

    expect(enemy.sprite.destroy).toHaveBeenCalled();
    expect(inhaleSystem.setInhalableTargets).toHaveBeenCalledWith([]);
  });

  it('repositions clustered enemies only while they remain inside the safety radius', () => {
    const enemies = Array.from({ length: 3 }, () => makeEnemy());

    createWabbleBeeMock
      .mockReturnValueOnce(enemies[0])
      .mockReturnValueOnce(enemies[1])
      .mockReturnValueOnce(enemies[2]);

    enemies.forEach((enemy, index) => {
      enemy.sprite.x = 160 + index * 4;
      enemy.sprite.y = 360 + index * 4;
    });

    manager.spawnWabbleBee(makeSpawn(160, 360));
    manager.update(600);
    manager.update(600);

    manager.spawnWabbleBee(makeSpawn(164, 364));
    manager.update(600);
    manager.update(600);

    manager.spawnWabbleBee(makeSpawn(168, 368));

    manager.update(16);

    const initialPositionCalls = enemies.map((enemy) => enemy.sprite.setPosition.mock.calls.length);
    expect(initialPositionCalls.every((count) => count === 0)).toBe(true);
    const initialDisperseCounts = enemies.map((enemy) => enemy.onDisperse.mock.calls.length);
    expect(initialDisperseCounts.some((count) => count > 0)).toBe(true);

    for (let i = 0; i < 10; i += 1) {
      manager.update(16);
    }

    enemies.forEach((enemy, index) => {
      expect(enemy.sprite.setPosition.mock.calls.length).toBe(initialPositionCalls[index]);
      expect(enemy.onDisperse.mock.calls.length).toBe(initialDisperseCounts[index]);
    });

    enemies.forEach((enemy, index) => {
      enemy.sprite.x = 160 + index * 2;
      enemy.sprite.y = 360 + index * 2;
    });

    manager.update(32);

    enemies.forEach((enemy, index) => {
      expect(enemy.sprite.setPosition.mock.calls.length).toBe(initialPositionCalls[index]);
      expect(enemy.onDisperse.mock.calls.length).toBe(initialDisperseCounts[index]);
    });
  });

  it('破棄済みのスプライトでも座標計算が例外にならない', () => {
    const enemy = makeEnemy();
    (enemy as any).sprite = undefined;

    let position: { x: number; y: number } | undefined;
    expect(() => {
      position = (manager as any).getEnemyPosition(enemy);
    }).not.toThrow();

    expect(position).toEqual({ x: 0, y: 0 });
  });
});
