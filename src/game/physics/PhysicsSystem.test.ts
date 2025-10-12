import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Physics: {
      Matter: {
        Sprite: class {},
      },
    },
  },
}));

import { PhysicsCategory, PhysicsSystem } from './PhysicsSystem';

type SpriteStub = ReturnType<typeof createSpriteStub>;

describe('PhysicsSystem', () => {
  let scene: Phaser.Scene;
  let worldOn: ReturnType<typeof vi.fn>;
  let worldOff: ReturnType<typeof vi.fn>;
  let setGravity: ReturnType<typeof vi.fn>;
  let setBounds: ReturnType<typeof vi.fn>;
  let eventsOnce: ReturnType<typeof vi.fn>;
  let eventsEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    worldOn = vi.fn();
    worldOff = vi.fn();
    setGravity = vi.fn();
    setBounds = vi.fn();
    eventsOnce = vi.fn();
    eventsEmit = vi.fn();

    scene = {
      matter: {
        world: {
          on: worldOn,
          off: worldOff,
          setGravity,
          setBounds,
        },
      },
      events: {
        once: eventsOnce,
        emit: eventsEmit,
      },
    } as unknown as Phaser.Scene;
  });

  it('configures player and terrain collisions and marks ground contact', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    expect(playerSprite.setCollisionCategory).toHaveBeenCalledWith(PhysicsCategory.Player);
    expect(playerSprite.setCollidesWith).toHaveBeenCalledWith(
      PhysicsCategory.Terrain | PhysicsCategory.Enemy | PhysicsCategory.EnemyAttack,
    );

    const terrainSprite = createSpriteStub();
    system.registerTerrain(terrainSprite as any);

    expect(terrainSprite.setStatic).toHaveBeenCalledWith(true);
    expect(terrainSprite.setCollisionCategory).toHaveBeenCalledWith(PhysicsCategory.Terrain);
    expect(terrainSprite.setCollidesWith).toHaveBeenCalledWith(
      PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Enemy,
    );
    expect(terrainSprite.setFriction).toHaveBeenCalledWith(0, 0, 0);
    expect(terrainSprite.setFrictionStatic).toHaveBeenCalledWith(0);

    const collisionHandler = getCollisionStartHandler(worldOn);
    expect(collisionHandler).toBeDefined();

    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 1001 } as any,
          bodyB: { gameObject: terrainSprite, id: 2001 } as any,
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', true);
  });

  it('registers enemy collision categories including terrain', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const enemySprite = createSpriteStub();
    const enemy = {
      sprite: enemySprite,
      takeDamage: vi.fn(),
      isDefeated: vi.fn().mockReturnValue(false),
    };
    system.registerEnemy(enemy as any);

    expect(enemySprite.setCollisionCategory).toHaveBeenCalledWith(PhysicsCategory.Enemy);
    expect(enemySprite.setCollidesWith).toHaveBeenCalledWith(
      PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Terrain,
    );
  });

  it('emits an event when the player collides with an enemy', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const enemySprite = createSpriteStub();
    const enemy = {
      sprite: enemySprite,
      takeDamage: vi.fn(),
      isDefeated: vi.fn().mockReturnValue(false),
    };
    system.registerEnemy(enemy as any);

    const collisionHandler = getCollisionStartHandler(worldOn);
    expect(collisionHandler).toBeDefined();

    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(eventsEmit).toHaveBeenCalledWith('player-collided-with-enemy', { enemy });
  });

  it('applies damage when a player attack hits an enemy', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const enemySprite = createSpriteStub();
    const enemy = {
      sprite: enemySprite,
      takeDamage: vi.fn(),
      isDefeated: vi.fn().mockReturnValue(false),
    };
    system.registerEnemy(enemy as any);

    const projectileSprite = createSpriteStub();
    projectileSprite.destroy = vi.fn();
    system.registerPlayerAttack(projectileSprite as any, { damage: 3 });

    const collisionHandler = getCollisionStartHandler(worldOn);
    expect(collisionHandler).toBeDefined();

    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: projectileSprite },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(enemy.takeDamage).toHaveBeenCalledWith(3);
    expect(projectileSprite.destroy).toHaveBeenCalled();
    expect(eventsEmit).toHaveBeenCalledWith('player-attack-hit-enemy', { enemy, damage: 3 });
  });

  it('suspends enemy collisions when requested and restores them on resume', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const enemySprite = createSpriteStub();
    const enemy = {
      sprite: enemySprite,
      takeDamage: vi.fn(),
      isDefeated: vi.fn().mockReturnValue(false),
    };
    system.registerEnemy(enemy as any);

    const projectileSprite = createSpriteStub();
    projectileSprite.destroy = vi.fn();
    system.registerPlayerAttack(projectileSprite as any, { damage: 1 });

    system.suspendEnemy(enemySprite as any);
    expect(enemySprite.setCollidesWith).toHaveBeenLastCalledWith(0);

    const collisionHandler = getCollisionStartHandler(worldOn);
    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
        {
          bodyA: { gameObject: projectileSprite },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(eventsEmit).not.toHaveBeenCalledWith('player-collided-with-enemy', expect.anything());
    expect(enemy.takeDamage).not.toHaveBeenCalled();

    system.resumeEnemy(enemySprite as any);
    expect(enemySprite.setCollidesWith).toHaveBeenLastCalledWith(
      PhysicsCategory.Player | PhysicsCategory.PlayerAttack | PhysicsCategory.Terrain,
    );

    const projectileSprite2 = createSpriteStub();
    projectileSprite2.destroy = vi.fn();
    system.registerPlayerAttack(projectileSprite2 as any, { damage: 1 });

    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: projectileSprite2 },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(enemy.takeDamage).toHaveBeenCalledWith(1);
    expect(projectileSprite2.destroy).toHaveBeenCalled();
  });

  it('keeps the player grounded while any terrain contact remains', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const terrainA = createSpriteStub();
    const terrainB = createSpriteStub();
    system.registerTerrain(terrainA as any);
    system.registerTerrain(terrainB as any);

    const collisionStart = getCollisionStartHandler(worldOn);
    const collisionEnd = getCollisionEndHandler(worldOn);

    expect(collisionStart).toBeDefined();
    expect(collisionEnd).toBeDefined();

    collisionStart?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 1001 } as any,
          bodyB: { gameObject: terrainA, id: 2001 } as any,
          isSensor: false,
        },
      ],
    } as any);

    collisionStart?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 1001 } as any,
          bodyB: { gameObject: terrainB, id: 2002 } as any,
          isSensor: false,
        },
      ],
    } as any);

    playerSprite.setData.mockClear();

    collisionEnd?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 1001 } as any,
          bodyB: { gameObject: terrainA, id: 2001 } as any,
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).not.toHaveBeenCalled();

    collisionEnd?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 1001 } as any,
          bodyB: { gameObject: terrainB, id: 2002 } as any,
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', false);
  });

  it('clears terrain contacts when resetting terrain registrations', () => {
    const system = new PhysicsSystem(scene);
    const playerSprite = createSpriteStub();
    system.registerPlayer({ sprite: playerSprite } as any);

    const terrainA = createSpriteStub();
    system.registerTerrain(terrainA as any);

    const collisionStart = getCollisionStartHandler(worldOn);
    expect(collisionStart).toBeDefined();

    collisionStart?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 5001 } as any,
          bodyB: { gameObject: terrainA, id: 6001 } as any,
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', true);

    playerSprite.setData.mockClear();

    system.clearTerrain();

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', false);

    const terrainB = createSpriteStub();
    system.registerTerrain(terrainB as any);

    collisionStart?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite, id: 5001 } as any,
          bodyB: { gameObject: terrainB, id: 6002 } as any,
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', true);
  });

  it('uses recycle handlers when destroying projectiles', () => {
    const system = new PhysicsSystem(scene);
    const projectileSprite = createSpriteStub();
    const recycle = vi.fn().mockReturnValue(true);

    system.registerPlayerAttack(projectileSprite as any, { damage: 1, recycle });
    system.destroyProjectile(projectileSprite as any);

    expect(recycle).toHaveBeenCalledWith(projectileSprite);
    expect(projectileSprite.destroy).not.toHaveBeenCalled();
  });
});

function createSpriteStub() {
  return {
    setCollisionCategory: vi.fn().mockReturnThis(),
    setCollidesWith: vi.fn().mockReturnThis(),
    setOnCollide: vi.fn().mockReturnThis(),
    setOnCollideEnd: vi.fn().mockReturnThis(),
    setStatic: vi.fn().mockReturnThis(),
    setFriction: vi.fn().mockReturnThis(),
    setFrictionStatic: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    getData: vi.fn(),
  };
}

function getCollisionStartHandler(worldOn: ReturnType<typeof vi.fn>) {
  const entry = worldOn.mock.calls.find(([event]) => event === 'collisionstart');
  return entry?.[1] as ((event: unknown) => void) | undefined;
}

function getCollisionEndHandler(worldOn: ReturnType<typeof vi.fn>) {
  const entry = worldOn.mock.calls.find(([event]) => event === 'collisionend');
  return entry?.[1] as ((event: unknown) => void) | undefined;
}
