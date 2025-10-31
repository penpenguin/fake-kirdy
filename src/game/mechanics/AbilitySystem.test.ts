import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { ActionStateMap } from './InhaleSystem';
import { AbilitySystem, ABILITY_TYPES } from './AbilitySystem';
import { PhysicsSystem } from '../physics/PhysicsSystem';

function buildActions(
  overrides: Partial<{ [K in keyof ActionStateMap]: Partial<ActionStateMap[K]> }> = {},
): ActionStateMap {
  const base: ActionStateMap = {
    inhale: { isDown: false, justPressed: false },
    swallow: { isDown: false, justPressed: false },
    spit: { isDown: false, justPressed: false },
    discard: { isDown: false, justPressed: false },
  };

  (Object.keys(overrides) as Array<keyof ActionStateMap>).forEach((key) => {
    base[key] = { ...base[key], ...overrides[key] };
  });

  return base;
}

function createTextureDescriptor(frames: string[] = []) {
  const frameSet = new Set(frames);
  return {
    hasFrame: vi.fn((frame: string) => frameSet.has(frame)),
    has: vi.fn((frame: string) => frameSet.has(frame)),
    getFrame: vi.fn((frame: string) => (frameSet.has(frame) ? {} : undefined)),
    frames: Object.fromEntries(frames.map((frame) => [frame, {}])),
  };
}

type ProjectileStub = {
  setVelocityX: ReturnType<typeof vi.fn>;
  setIgnoreGravity: ReturnType<typeof vi.fn>;
  setFixedRotation: ReturnType<typeof vi.fn>;
  setName: ReturnType<typeof vi.fn>;
  setSensor: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

describe('AbilitySystem', () => {
  let scene: Phaser.Scene;
  let addSprite: ReturnType<typeof vi.fn>;
  let delayedCall: ReturnType<typeof vi.fn>;
  let playSound: ReturnType<typeof vi.fn>;
  let eventsEmit: ReturnType<typeof vi.fn>;
  let projectile: ProjectileStub;
  let physicsSystem: {
    registerPlayerAttack: ReturnType<typeof vi.fn>;
    destroyProjectile: ReturnType<typeof vi.fn>;
  };
  let worldOn: ReturnType<typeof vi.fn>;
  let worldOff: ReturnType<typeof vi.fn>;
  let kirdy: {
    sprite: {
      x: number;
      y: number;
      flipX: boolean;
      setTint: ReturnType<typeof vi.fn>;
      clearTint: ReturnType<typeof vi.fn>;
      setTexture: ReturnType<typeof vi.fn>;
      setData: ReturnType<typeof vi.fn>;
      anims: { play: ReturnType<typeof vi.fn> };
    };
  };
  let textureDescriptors: Record<string, ReturnType<typeof createTextureDescriptor>>;
  let textureManager: any;
  let sceneAnims: {
    exists: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    projectile = {
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    addSprite = vi.fn().mockReturnValue(projectile);
    delayedCall = vi.fn();
    playSound = vi.fn();
    eventsEmit = vi.fn();
    physicsSystem = {
      registerPlayerAttack: vi.fn(),
      destroyProjectile: vi.fn(),
    };

    textureDescriptors = {
      kirdy: createTextureDescriptor(['fire', 'ice', 'sword']),
      'kirdy-fire': createTextureDescriptor([]),
      'kirdy-ice': createTextureDescriptor([]),
      'kirdy-sword': createTextureDescriptor([]),
      'kirdy-idle': createTextureDescriptor([]),
    };

    textureManager = {
      exists: vi.fn((key: string) => Object.prototype.hasOwnProperty.call(textureDescriptors, key)),
      get: vi.fn((key: string) => textureDescriptors[key]),
    };

    sceneAnims = {
      exists: vi.fn().mockReturnValue(true),
    };

    worldOn = vi.fn();
    worldOff = vi.fn();

    scene = {
      matter: { add: { sprite: addSprite }, world: { on: worldOn, off: worldOff, remove: vi.fn() } },
      time: { delayedCall },
      sound: { play: playSound },
      events: { emit: eventsEmit },
      textures: textureManager,
      anims: sceneAnims,
    } as unknown as Phaser.Scene;

    kirdy = {
      sprite: {
        x: 128,
        y: 256,
        flipX: false,
        setTint: vi.fn().mockReturnThis(),
        clearTint: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        setData: vi.fn().mockReturnThis(),
        anims: {
          play: vi.fn().mockReturnThis(),
        },
      },
    };
  });

  it('publishes ability metadata through the static catalogue', () => {
    expect(AbilitySystem.abilities.fire).toMatchObject({
      type: 'fire',
      name: 'Fire',
      attack: 'fire-attack',
      color: expect.stringMatching(/^#/),
      damage: expect.any(Number),
    });
    expect(Object.keys(AbilitySystem.abilities)).toEqual(expect.arrayContaining(['fire', 'ice', 'sword']));
  });

  it('copies ability metadata from enemies exposing ability types', () => {
    const enemy = {
      getAbilityType: vi.fn(() => 'fire'),
    };

    const ability = AbilitySystem.copyAbility(enemy);

    expect(enemy.getAbilityType).toHaveBeenCalled();
    expect(ability).toBe(AbilitySystem.abilities.fire);
  });

  it('executes static ability attacks using the provided context', () => {
    const ability = AbilitySystem.abilities.fire;

    AbilitySystem.executeAbility(ability, {
      scene,
      kirdy: kirdy as any,
      physicsSystem: physicsSystem as any,
    });

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'fire-attack');
    expect(projectile.setVelocityX).toHaveBeenCalledWith(420);
  });

  it('exposes all core ability types', () => {
    expect(ABILITY_TYPES).toEqual(expect.arrayContaining(['fire', 'ice', 'sword']));
  });

  it('applies appearance changes when an ability is copied', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);

    system.applySwallowedPayload({ abilityType: 'fire' });

    expect(kirdy.sprite.setTint).toHaveBeenCalled();
    expect(kirdy.sprite.setTexture).toHaveBeenCalled();
    expect(kirdy.sprite.setData).toHaveBeenCalledWith('equippedAbility', 'fire');
    expect(system.getCurrentAbilityType()).toBe('fire');
  });

  it('falls back to an ability texture when the base frame is missing', () => {
    textureDescriptors.kirdy = createTextureDescriptor([]);

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);

    system.applySwallowedPayload({ abilityType: 'fire' });

    expect(kirdy.sprite.setTexture).toHaveBeenCalledWith('kirdy-fire');
    expect(kirdy.sprite.setTexture).not.toHaveBeenCalledWith('kirdy', 'fire');
  });

  it('uses the idle texture when clearing an ability without the base texture', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    kirdy.sprite.setTexture.mockClear();
    delete textureDescriptors.kirdy;

    system.applySwallowedPayload({ abilityType: 'ice' });

    expect(kirdy.sprite.setTexture.mock.calls[0]).toEqual(['kirdy-idle']);
    expect(kirdy.sprite.setTexture.mock.calls[1]).toEqual(['kirdy-ice']);
  });

  it('notifies listeners when a new ability is acquired', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);

    system.applySwallowedPayload({ abilityType: 'fire' });

    expect(eventsEmit).toHaveBeenCalledWith('ability-acquired', { abilityType: 'fire' });
  });

  it('replaces an existing ability when a new one is copied', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);

    system.applySwallowedPayload({ abilityType: 'fire' });
    system.applySwallowedPayload({ abilityType: 'ice' });

    expect(kirdy.sprite.clearTint).toHaveBeenCalled();
    expect(kirdy.sprite.setData).toHaveBeenCalledWith('equippedAbility', 'ice');
    expect(system.getCurrentAbilityType()).toBe('ice');
  });

  it('fires a flame projectile when Fire ability attacks', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'fire-attack');
    expect(projectile.setVelocityX).toHaveBeenCalledWith(420);
    expect(projectile.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(scene.time?.delayedCall).toHaveBeenCalled();
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(projectile, { damage: 3 });
  });

  it('routes ability attack sounds through the audio manager when available', () => {
    const audioManager = {
      playSfx: vi.fn(),
    };

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any, audioManager as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(audioManager.playSfx).toHaveBeenCalledWith('ability-fire-attack');
    expect(playSound).not.toHaveBeenCalled();
  });

  it('plays the ability attack animation when available', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(sceneAnims.exists).toHaveBeenCalledWith('kirdy-fire-attack');
    expect(kirdy.sprite.anims.play).toHaveBeenCalledWith('kirdy-fire-attack', true);
  });

  it('skips playing the ability attack animation when missing', () => {
    sceneAnims.exists.mockImplementation((key: string) => key !== 'kirdy-fire-attack');
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });
    kirdy.sprite.anims.play.mockClear();

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(kirdy.sprite.anims.play).not.toHaveBeenCalledWith('kirdy-fire-attack', true);
  });

  it('launches ice shards in the faced direction', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'ice' });

    const iceProjectile = {
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    addSprite.mockReturnValueOnce(iceProjectile as any);

    kirdy.sprite.flipX = true;

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'ice-attack');
    expect(iceProjectile.setVelocityX).toHaveBeenCalledWith(-300);
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(iceProjectile as any, { damage: 3 });
  });

  it('triggers a sword slash sensor instead of projectile', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'sword' });

    const slashStub = {
      width: 64,
      height: 64,
      displayWidth: 64,
      displayHeight: 64,
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setCircle: vi.fn().mockReturnThis(),
      setBody: vi.fn().mockReturnThis(),
      setRectangle: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    addSprite.mockReturnValueOnce(slashStub as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'sword-slash');
    expect(slashStub.setSensor).toHaveBeenCalledWith(true);
    expect(slashStub.setCircle).toHaveBeenCalledWith(32, 0, 0);
    expect(slashStub.setBody).not.toHaveBeenCalled();
    expect(slashStub.setPosition).toHaveBeenCalledWith(128, 256);
    expect(slashStub.setVelocityX).not.toHaveBeenCalled();
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(slashStub as any, { damage: 3 });
  });

  it('discards the active ability when the discard action is triggered', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        discard: { isDown: true, justPressed: true },
      }),
    );

    expect(kirdy.sprite.clearTint).toHaveBeenCalled();
    expect(kirdy.sprite.setData).toHaveBeenCalledWith('equippedAbility', undefined);
    expect(eventsEmit).toHaveBeenCalledWith('ability-discarded', { abilityType: 'fire' });
    expect(system.getCurrentAbilityType()).toBeUndefined();
  });

  it('emits ability-cleared when the current ability is removed', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });
    eventsEmit.mockClear();

    system.update(
      buildActions({
        discard: { isDown: true, justPressed: true },
      }),
    );

    expect(eventsEmit).toHaveBeenCalledWith('ability-cleared', {});
  });

  it('deals damage to active enemies when an ability projectile collides', () => {
    const physics = new PhysicsSystem(scene);
    const collisionStartHandler = worldOn.mock.calls.find(([event]) => event === 'collisionstart')?.[1];
    if (!collisionStartHandler) {
      throw new Error('collisionstart handler not registered');
    }

    const createPhysicsSprite = () => ({
      setCollisionCategory: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setData: vi.fn().mockReturnThis(),
      setStatic: vi.fn().mockReturnThis(),
      setVelocity: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    });

    const playerSprite = createPhysicsSprite();
    physics.registerPlayer({ sprite: playerSprite } as any);

    const enemySprite = createPhysicsSprite();
    const enemy = {
      sprite: enemySprite,
      takeDamage: vi.fn(),
      isDefeated: vi.fn().mockReturnValue(false),
    };
    physics.registerEnemy(enemy as any);

    const system = new AbilitySystem(scene, kirdy as any, physics);
    system.applySwallowedPayload({ abilityType: 'fire' });

    const projectileStub = {
      setCollisionCategory: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setData: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    addSprite.mockReturnValueOnce(projectileStub as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    collisionStartHandler({
      pairs: [
        {
          bodyA: { gameObject: projectileStub },
          bodyB: { gameObject: enemySprite },
          isSensor: false,
        },
      ],
    } as any);

    expect(enemy.takeDamage).toHaveBeenCalledWith(3);
  });

  it('does nothing when an unknown ability type is provided', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);

    system.applySwallowedPayload({ abilityType: 'unknown' as any });

    expect(kirdy.sprite.setTint).not.toHaveBeenCalled();
    expect(system.getCurrentAbilityType()).toBeUndefined();
  });
});
