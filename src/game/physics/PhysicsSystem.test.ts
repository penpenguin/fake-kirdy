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

    const collisionHandler = getCollisionStartHandler(worldOn);
    expect(collisionHandler).toBeDefined();

    collisionHandler?.({
      pairs: [
        {
          bodyA: { gameObject: playerSprite },
          bodyB: { gameObject: terrainSprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(playerSprite.setData).toHaveBeenCalledWith('isGrounded', true);
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
});

function createSpriteStub() {
  return {
    setCollisionCategory: vi.fn().mockReturnThis(),
    setCollidesWith: vi.fn().mockReturnThis(),
    setOnCollide: vi.fn().mockReturnThis(),
    setOnCollideEnd: vi.fn().mockReturnThis(),
    setStatic: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    getData: vi.fn(),
  };
}

function getCollisionStartHandler(worldOn: ReturnType<typeof vi.fn>) {
  const entry = worldOn.mock.calls.find(([event]) => event === 'collisionstart');
  return entry?.[1] as ((event: unknown) => void) | undefined;
}
