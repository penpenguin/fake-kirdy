import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type Phaser from 'phaser';
import type { ActionStateMap } from './InhaleSystem';
import { AbilitySystem, ABILITY_TYPES } from './AbilitySystem';
import { PhysicsCategory, PhysicsSystem } from '../physics/PhysicsSystem';
import { resolveForwardSpawnPosition } from './projectilePlacement';

const FIRE_PROJECTILE_SPEED = 420;
const FIRE_PROJECTILE_LIFETIME = 700;
const FIRE_PROJECTILE_STEP_INTERVAL = 100;
const FIRE_PROJECTILE_STEP_DISTANCE = (FIRE_PROJECTILE_SPEED * FIRE_PROJECTILE_STEP_INTERVAL) / 1000;
const FIRE_PROJECTILE_STEP_COUNT = Math.ceil(FIRE_PROJECTILE_LIFETIME / FIRE_PROJECTILE_STEP_INTERVAL);
const ICE_AOE_MARGIN = 128;
const ICE_AOE_ALPHA = 0.6;
const ICE_TEXTURE_SIZE = 128;
const SWORD_STRIKE_WIDTH = 72;
const SWORD_STRIKE_HEIGHT = 64;
const SWORD_TEXTURE_WIDTH = 96;
const SWORD_TEXTURE_HEIGHT = 32;

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

function createCanvasTextureStub() {
  const context = {
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  };

  return {
    fill: vi.fn(),
    refresh: vi.fn(),
    canvas: {
      getContext: vi.fn(() => context),
    },
    getContext: vi.fn(() => context),
    getCanvas: vi.fn(() => ({
      getContext: vi.fn(() => context),
    })),
    context,
  };
}

type ProjectileStub = {
  x: number;
  y: number;
  setVelocityX: ReturnType<typeof vi.fn>;
  setIgnoreGravity: ReturnType<typeof vi.fn>;
  setFixedRotation: ReturnType<typeof vi.fn>;
  setName: ReturnType<typeof vi.fn>;
  setSensor: ReturnType<typeof vi.fn>;
  setCollidesWith: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setCircle: ReturnType<typeof vi.fn>;
  setBody: ReturnType<typeof vi.fn>;
  setRectangle: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  once: Mock<[string, () => void], ProjectileStub>;
  destroy: ReturnType<typeof vi.fn>;
};

type ParticleEffectStub = {
  startFollow: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
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
      displayWidth: number;
      displayHeight: number;
      body: {
        bounds: {
          min: { x: number; y: number };
          max: { x: number; y: number };
        };
      };
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
  let addParticles: ReturnType<typeof vi.fn>;
  let particleEffect: ParticleEffectStub;
  let projectileEvents: Record<string, Array<() => void>>;

  beforeEach(() => {
    projectile = {
      x: 128,
      y: 256,
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setCircle: vi.fn().mockReturnThis(),
      setBody: vi.fn().mockReturnThis(),
      setRectangle: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      once: vi.fn(),
      destroy: vi.fn(),
    };

    projectileEvents = {};
    projectile.once = vi.fn((event: string, handler: () => void) => {
      projectileEvents[event] = projectileEvents[event] ?? [];
      projectileEvents[event].push(handler);
      return projectile as unknown as ProjectileStub;
    });

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
      'fire-attack': createTextureDescriptor([]),
      'ice-attack': createTextureDescriptor([]),
      'sword-slash': createTextureDescriptor([]),
    };

    const createCanvas = vi.fn((key: string, width: number, height: number) => {
      const canvasContext = {
        fillStyle: '',
        fillRect: vi.fn(),
      };
      const canvasTexture = {
        fill: vi.fn(),
        refresh: vi.fn(),
        canvas: {
          getContext: vi.fn(() => canvasContext),
        },
        getContext: vi.fn(() => canvasContext),
      };
      textureDescriptors[key] = createTextureDescriptor([]);
      return canvasTexture;
    });

    textureManager = {
      exists: vi.fn((key: string) => Object.prototype.hasOwnProperty.call(textureDescriptors, key)),
      get: vi.fn((key: string) => textureDescriptors[key]),
      createCanvas,
    };

    sceneAnims = {
      exists: vi.fn().mockReturnValue(true),
    };

    worldOn = vi.fn();
    worldOff = vi.fn();

    particleEffect = {
      startFollow: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      setDepth: vi.fn(),
    };

    addParticles = vi.fn().mockReturnValue(particleEffect);

    scene = {
      matter: { add: { sprite: addSprite }, world: { on: worldOn, off: worldOff, remove: vi.fn() } },
      time: { delayedCall },
      sound: { play: playSound },
      events: { emit: eventsEmit },
      textures: textureManager,
      anims: sceneAnims,
      add: { particles: addParticles },
    } as unknown as Phaser.Scene;

    kirdy = {
      sprite: {
        x: 128,
        y: 256,
        flipX: false,
        displayWidth: 64,
        displayHeight: 64,
        body: {
          bounds: {
            min: { x: 96, y: 224 },
            max: { x: 160, y: 288 },
          },
        },
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
    const spawn = resolveForwardSpawnPosition(kirdy.sprite as any, 1);
    expect(projectile.setPosition).toHaveBeenCalledWith(spawn.x, kirdy.sprite.y);
    expect(scene.time?.delayedCall).toHaveBeenCalledWith(
      FIRE_PROJECTILE_STEP_INTERVAL,
      expect.any(Function),
    );
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

  it('moves a flame projectile forward every 0.1s until it expires', () => {
    const scheduledSteps: Array<() => void> = [];
    delayedCall.mockImplementation((delay: number, handler?: () => void) => {
      expect(delay).toBe(FIRE_PROJECTILE_STEP_INTERVAL);
      if (typeof handler === 'function') {
        scheduledSteps.push(handler);
      }
    });

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'fire-attack');
    const spawn = resolveForwardSpawnPosition(kirdy.sprite as any, 1);
    expect(projectile.setPosition).toHaveBeenCalledWith(spawn.x, kirdy.sprite.y);
    expect(projectile.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(projectile.setSensor).toHaveBeenCalledWith(true);
    expect(projectile.setRectangle).toHaveBeenCalledWith(64, 64);
    expect(scene.time?.delayedCall).toHaveBeenCalledWith(
      FIRE_PROJECTILE_STEP_INTERVAL,
      expect.any(Function),
    );
    expect(scheduledSteps.length).toBeGreaterThan(0);

    const runNextStep = () => {
      const callback = scheduledSteps.shift();
      callback?.();
    };

    runNextStep();
    expect(projectile.setPosition).toHaveBeenLastCalledWith(
      spawn.x + FIRE_PROJECTILE_STEP_DISTANCE,
      kirdy.sprite.y,
    );

    for (let i = 1; i < FIRE_PROJECTILE_STEP_COUNT; i += 1) {
      expect(scheduledSteps.length).toBeGreaterThan(0);
      runNextStep();
    }

    const expectedFinalX = spawn.x + FIRE_PROJECTILE_STEP_DISTANCE * FIRE_PROJECTILE_STEP_COUNT;
    expect(projectile.setPosition).toHaveBeenLastCalledWith(expectedFinalX, kirdy.sprite.y);
    expect(physicsSystem.destroyProjectile).toHaveBeenCalledWith(projectile as any);
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(projectile, { damage: 3 });
    expect(projectile.setCollidesWith).toHaveBeenCalledWith(PhysicsCategory.Enemy);
  });

  it('rebuilds the fire attack texture when missing so player sprites are never reused', () => {
    delete textureDescriptors['fire-attack'];
    const canvasTexture = createCanvasTextureStub();
    textureManager.createCanvas.mockImplementationOnce(() => canvasTexture);

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(textureManager.createCanvas).toHaveBeenCalledWith(
      'fire-attack',
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvasTexture.refresh).toHaveBeenCalled();
  });

  it('rebuilds the ice attack texture when missing so player sprites are never reused', () => {
    delete textureDescriptors['ice-attack'];
    const canvasTexture = createCanvasTextureStub();
    textureManager.createCanvas.mockImplementationOnce(() => canvasTexture);

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'ice' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(textureManager.createCanvas).toHaveBeenCalledWith('ice-attack', ICE_TEXTURE_SIZE, ICE_TEXTURE_SIZE);
    expect(canvasTexture.context.fillRect).toHaveBeenCalled();
    expect(canvasTexture.refresh).toHaveBeenCalled();
  });

  it('rebuilds the sword slash texture when missing so player sprites are never reused', () => {
    delete textureDescriptors['sword-slash'];
    const canvasTexture = createCanvasTextureStub();
    textureManager.createCanvas.mockImplementationOnce(() => canvasTexture);

    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'sword' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(textureManager.createCanvas).toHaveBeenCalledWith(
      'sword-slash',
      SWORD_TEXTURE_WIDTH,
      SWORD_TEXTURE_HEIGHT,
    );
    expect(canvasTexture.context.fillRect).toHaveBeenCalled();
    expect(canvasTexture.refresh).toHaveBeenCalled();
  });

  it('follows fired projectiles with a particle trail until they are destroyed', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'fire' });

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addParticles).toHaveBeenCalledWith(0, 0, 'fire-attack');
    expect(particleEffect.setDepth).toHaveBeenCalledWith(expect.any(Number));
    expect(particleEffect.startFollow).toHaveBeenCalledWith(projectile as any);

    projectileEvents.destroy?.forEach((handler) => handler());

    expect(particleEffect.stop).toHaveBeenCalledWith(true);
    expect(particleEffect.destroy).toHaveBeenCalled();
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

  it('creates an ice burst that damages around Kirdy', () => {
    const system = new AbilitySystem(scene, kirdy as any, physicsSystem as any);
    system.applySwallowedPayload({ abilityType: 'ice' });

    const iceProjectile = {
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setCircle: vi.fn().mockReturnThis(),
      setBody: vi.fn().mockReturnThis(),
      setRectangle: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    addSprite.mockReturnValueOnce(iceProjectile as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledWith(128, 256, 'ice-attack');
    expect(iceProjectile.setPosition).toHaveBeenCalledWith(kirdy.sprite.x, kirdy.sprite.y);
    expect(iceProjectile.setSensor).toHaveBeenCalledWith(true);
    const baseSize = Math.max(kirdy.sprite.displayWidth, 64);
    const expectedSize = baseSize + ICE_AOE_MARGIN * 2;
    expect(iceProjectile.setRectangle).toHaveBeenCalledWith(expectedSize, expectedSize);
    expect(iceProjectile.setCollidesWith).toHaveBeenCalledWith(PhysicsCategory.Enemy);
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(iceProjectile as any, { damage: 3 });
    expect(iceProjectile.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(iceProjectile.setAlpha).toHaveBeenCalledWith(ICE_AOE_ALPHA);
    expect(iceProjectile.setVelocityX).not.toHaveBeenCalled();
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
      setCollidesWith: vi.fn().mockReturnThis(),
      setCircle: vi.fn().mockReturnThis(),
      setBody: vi.fn().mockReturnThis(),
      setRectangle: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setAngle: vi.fn().mockReturnThis(),
      setFlipX: vi.fn().mockReturnThis(),
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
    expect(slashStub.setRectangle).toHaveBeenCalledWith(SWORD_STRIKE_WIDTH, expect.any(Number));
    const expectedX = kirdy.sprite.x + (SWORD_STRIKE_WIDTH / 2 + SWORD_STRIKE_WIDTH / 4);
    expect(slashStub.setPosition).toHaveBeenCalledWith(expectedX, kirdy.sprite.y);
    expect(slashStub.setCircle).not.toHaveBeenCalled();
    expect(slashStub.setBody).not.toHaveBeenCalled();
    expect(slashStub.setVelocityX).not.toHaveBeenCalled();
    expect(slashStub.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(slashStub.setAlpha).toHaveBeenCalledWith(0.9);
    expect(slashStub.setAngle).toHaveBeenCalledWith(12);
    expect(slashStub.setFlipX).toHaveBeenCalledWith(false);
    expect(slashStub.setCollidesWith).toHaveBeenCalledWith(PhysicsCategory.Enemy);
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
