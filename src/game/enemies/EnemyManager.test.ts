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
  };
  update: Mock;
  takeDamage: Mock;
  getHP: Mock;
  isDefeated: Mock;
  getAbilityType: Mock;
};

const createWabbleBeeMock = vi.hoisted(() => vi.fn());
const createDrontoDurtMock = vi.hoisted(() => vi.fn());

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>();
  return {
    ...actual,
    createWabbleBee: createWabbleBeeMock,
    createDrontoDurt: createDrontoDurtMock,
  };
});

describe('EnemyManager', () => {
  const makeSprite = (): TestEnemy['sprite'] =>
    ({
      x: 0,
      y: 0,
      body: { position: { x: 0, y: 0 } },
      setActive: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
    } as unknown as TestEnemy['sprite']);

  const makeEnemy = (): TestEnemy => ({
    sprite: makeSprite(),
    update: vi.fn(),
    takeDamage: vi.fn(),
    getHP: vi.fn().mockReturnValue(3),
    isDefeated: vi.fn().mockReturnValue(false),
    getAbilityType: vi.fn(),
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
    createDrontoDurtMock.mockReset();

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

    manager.update(16);

    const repositioned = enemies.map((enemy) => enemy.sprite.setPosition.mock.calls.at(-1));

    expect(repositioned.filter((call): call is [number, number] => Array.isArray(call)).length).toBeGreaterThan(0);
    repositioned.forEach((call) => {
      if (!Array.isArray(call)) {
        return;
      }
      const [x, y] = call;
      const dx = x - 160;
      const dy = y - 360;
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
});
