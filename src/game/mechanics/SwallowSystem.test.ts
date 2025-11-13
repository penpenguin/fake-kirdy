import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { ActionStateMap } from './InhaleSystem';
import { AbilitySystem } from './AbilitySystem';
import { SwallowSystem } from './SwallowSystem';
import { resolveForwardSpawnPosition } from './projectilePlacement';

type MockFn = ReturnType<typeof vi.fn>;

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

type FakeTarget = Phaser.Physics.Matter.Sprite & {
  destroy: MockFn;
  setVisible: MockFn;
  setActive: MockFn;
  setIgnoreGravity: MockFn;
  setStatic: MockFn;
  getData: MockFn;
};

type StarProjectileStub = {
  x: number;
  y: number;
  setVelocityX: MockFn;
  setIgnoreGravity: MockFn;
  setCollisionCategory: MockFn;
  setCollidesWith: MockFn;
  setOnCollide: MockFn;
  setName: MockFn;
  setFixedRotation: MockFn;
  setCircle: MockFn;
  setBody: MockFn;
  setRectangle: MockFn;
  setSensor: MockFn;
  setActive: MockFn;
  setVisible: MockFn;
  setPosition: MockFn;
  setVelocity: MockFn;
  setData: MockFn;
  getData: MockFn;
  once: MockFn;
  destroy: MockFn;
};

describe('SwallowSystem', () => {
  let scene: Phaser.Scene;
  let playSound: ReturnType<typeof vi.fn>;
  let addSprite: ReturnType<typeof vi.fn>;
  let delayedCall: ReturnType<typeof vi.fn>;
  let physicsSystem: {
    registerPlayerAttack: ReturnType<typeof vi.fn>;
    destroyProjectile: ReturnType<typeof vi.fn>;
  };
  let kirdy: {
    sprite: {
      x: number;
      y: number;
      displayWidth: number;
      displayHeight: number;
      body: {
        bounds: {
          min: { x: number; y: number };
          max: { x: number; y: number };
        };
      };
      flipX: boolean;
      anims: { play: ReturnType<typeof vi.fn> };
    };
    getMouthContent: ReturnType<typeof vi.fn>;
  };
  let inhaleSystem: {
    releaseCapturedTarget: ReturnType<typeof vi.fn>;
  };
  let target: FakeTarget;
  let starProjectile: StarProjectileStub;
  let emitEvent: ReturnType<typeof vi.fn>;
  let addParticles: ReturnType<typeof vi.fn>;
  let particleEffect: {
    startFollow: MockFn;
    stop: MockFn;
    destroy: MockFn;
    setDepth: MockFn;
  };

  beforeEach(() => {
    playSound = vi.fn();
    const removeTimer = vi.fn();
    delayedCall = vi.fn().mockReturnValue({ remove: removeTimer });
    physicsSystem = {
      registerPlayerAttack: vi.fn(),
      destroyProjectile: vi.fn(),
    };

    const starProjectileData = new Map<string, unknown>();

    const projectile: Partial<StarProjectileStub> = {
      x: 0,
      y: 0,
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setCollisionCategory: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setOnCollide: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setCircle: vi.fn().mockReturnThis(),
      setBody: vi.fn().mockReturnThis(),
      setRectangle: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setVelocity: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    projectile.setData = vi.fn((key: string, value: unknown) => {
      starProjectileData.set(key, value);
      return projectile as StarProjectileStub;
    }) as unknown as MockFn;

    projectile.getData = vi.fn((key: string) => starProjectileData.get(key)) as unknown as MockFn;

    starProjectile = projectile as StarProjectileStub;

    addSprite = vi.fn().mockReturnValue(starProjectile);

    emitEvent = vi.fn();

    particleEffect = {
      startFollow: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      setDepth: vi.fn(),
    };

    addParticles = vi.fn().mockReturnValue(particleEffect);

    scene = {
      sound: {
        play: playSound,
      },
      matter: {
        add: {
          sprite: addSprite,
        },
      },
      time: {
        delayedCall,
      },
      events: {
        emit: emitEvent,
      },
      add: {
        particles: addParticles,
      },
    } as unknown as Phaser.Scene;

    target = {
      destroy: vi.fn(),
      setVisible: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setStatic: vi.fn().mockReturnThis(),
      getData: vi.fn(),
    } as unknown as FakeTarget;

    inhaleSystem = {
      releaseCapturedTarget: vi.fn(),
    };

    kirdy = {
      sprite: {
        x: 128,
        y: 256,
        displayWidth: 64,
        displayHeight: 64,
        body: {
          bounds: {
            min: { x: 96, y: 224 },
            max: { x: 160, y: 288 },
          },
        },
        flipX: false,
        anims: {
          play: vi.fn(),
        },
      },
      getMouthContent: vi.fn().mockReturnValue(target),
    };
  });

  it('swallows the captured enemy and records ability metadata', () => {
    target.getData.mockReturnValueOnce('fire');

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        swallow: { isDown: true, justPressed: true },
      }),
    );

    expect(playSound).toHaveBeenCalledWith('kirdy-swallow');
    expect(kirdy.sprite.anims.play).toHaveBeenCalledWith('kirdy-swallow', true);
    expect(target.destroy).toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).toHaveBeenCalled();

    const payload = system.consumeSwallowedPayload();
    expect(payload).toEqual({ abilityType: 'fire', ability: AbilitySystem.abilities.fire });
    expect(system.consumeSwallowedPayload()).toBeUndefined();
    expect(emitEvent).toHaveBeenCalledWith('enemy-swallowed', {
      sprite: target,
      abilityType: 'fire',
      ability: AbilitySystem.abilities.fire,
    });
  });

  it('does nothing when swallow is triggered without mouth content', () => {
    kirdy.getMouthContent.mockReturnValue(undefined);

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        swallow: { isDown: true, justPressed: true },
      }),
    );

    expect(playSound).not.toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).not.toHaveBeenCalled();
  });

  it('spits a star projectile forward using the captured enemy', () => {
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(playSound).toHaveBeenCalledWith('kirdy-spit');
    expect(addSprite).toHaveBeenCalledWith(0, 0, 'star-bullet');
    const spawn = resolveForwardSpawnPosition(kirdy.sprite as any, 1);
    expect(starProjectile.setPosition).toHaveBeenCalledWith(spawn.x, spawn.y);
    expect(starProjectile.setVelocityX).toHaveBeenCalledWith(350);
    expect(starProjectile.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(starProjectile.setRectangle).toHaveBeenCalledWith(64, 64);
    expect(starProjectile.setSensor).toHaveBeenCalledWith(true);
    expect(starProjectile.setOnCollide).toHaveBeenCalledWith(expect.any(Function));
    expect(starProjectile.once).toHaveBeenCalledWith('destroy', expect.any(Function));
    expect(delayedCall).toHaveBeenCalled();
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(
      starProjectile,
      expect.objectContaining({ damage: 3, recycle: expect.any(Function) }),
    );
    expect(target.destroy).toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).toHaveBeenCalled();
  });

  it('attaches a particle trail that follows the spit projectile', () => {
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addParticles).toHaveBeenCalledWith(0, 0, 'inhale-sparkle');
    expect(particleEffect.setDepth).toHaveBeenCalledWith(expect.any(Number));
    expect(particleEffect.startFollow).toHaveBeenCalledWith(starProjectile as any);
  });

  it('stops the projectile trail when the recycled projectile re-enters the pool', () => {
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    const registerArgs = physicsSystem.registerPlayerAttack.mock.calls[0];
    const recycle = registerArgs?.[1]?.recycle;
    expect(recycle).toBeInstanceOf(Function);

    recycle?.(starProjectile as any);

    expect(particleEffect.stop).toHaveBeenCalledWith(true);
    expect(particleEffect.destroy).toHaveBeenCalled();
  });

  it('defers star projectile cleanup to the physics collision handler when available', () => {
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    const collideHandler = starProjectile.setOnCollide.mock.calls[0]?.[0];
    expect(collideHandler).toBeInstanceOf(Function);

    const emitCallsBefore = emitEvent.mock.calls.length;
    collideHandler?.();

    expect(physicsSystem.destroyProjectile).not.toHaveBeenCalled();
    expect(emitEvent.mock.calls.length).toBe(emitCallsBefore);
    expect(starProjectile.destroy).not.toHaveBeenCalled();
  });

  it('disposes star projectiles locally when collisions occur without physics support', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    starProjectile.setData('pooledProjectile', false);
    const collideHandler = starProjectile.setOnCollide.mock.calls[0]?.[0];
    expect(collideHandler).toBeInstanceOf(Function);

    collideHandler?.();

    expect(physicsSystem.destroyProjectile).not.toHaveBeenCalled();
    expect(emitEvent).toHaveBeenCalledWith('star-projectile-destroyed', starProjectile);
    expect(starProjectile.destroy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('logs and cleans up when registering the projectile with physics fails', () => {
    physicsSystem.registerPlayerAttack.mockImplementation(() => {
      throw new Error('register failed');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    expect(() =>
      system.update(
        buildActions({
          spit: { isDown: true, justPressed: true },
        }),
      ),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith('[SwallowSystem] failed to register star projectile', expect.any(Error));
    expect(physicsSystem.destroyProjectile).toHaveBeenCalledWith(starProjectile);

    warnSpy.mockRestore();
  });

  it('still disposes the projectile if timed destruction fails', () => {
    physicsSystem.destroyProjectile.mockImplementation(() => {
      throw new Error('timer destroy failed');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    starProjectile.setData('pooledProjectile', false);

    const timerCallback = delayedCall.mock.calls[0]?.[1];
    expect(timerCallback).toBeInstanceOf(Function);

    expect(() => timerCallback?.()).not.toThrow();
    expect(physicsSystem.destroyProjectile).toHaveBeenCalledWith(starProjectile);
    expect(warnSpy).toHaveBeenCalledWith('[SwallowSystem] failed to destroy star projectile', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('skips projectile spawning gracefully when Matter sprite creation fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    addSprite.mockImplementation(() => {
      throw new Error('texture missing');
    });

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    expect(() =>
      system.update(
        buildActions({
          spit: { isDown: true, justPressed: true },
        }),
      ),
    ).not.toThrow();

    expect(physicsSystem.registerPlayerAttack).not.toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('handles star projectile setup errors without crashing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setupError = new Error("Cannot read properties of undefined (reading 'position')");
    starProjectile.setVelocityX.mockImplementation(() => {
      throw setupError;
    });

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    expect(() =>
      system.update(
        buildActions({
          spit: { isDown: true, justPressed: true },
        }),
      ),
    ).not.toThrow();

    expect(playSound).toHaveBeenCalledWith('kirdy-spit');
    expect(physicsSystem.registerPlayerAttack).not.toHaveBeenCalled();
    expect(starProjectile.destroy).toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[SwallowSystem] failed to prepare star projectile', setupError);

    warnSpy.mockRestore();
  });

  it('syncs swallowed ability payload safely when textures lack atlas frames', () => {
    target.getData.mockReturnValueOnce('fire');

    const swallowSystem = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);
    swallowSystem.update(
      buildActions({
        swallow: { isDown: true, justPressed: true },
      }),
    );

    const payload = swallowSystem.consumeSwallowedPayload();
    expect(payload?.abilityType).toBe('fire');

    const setTexture = vi.fn((key: string, frame?: string) => {
      if (key === 'kirdy' && frame === 'fire') {
        throw new Error('missing frame');
      }
      return undefined;
    });

    const abilityKirdy = {
      sprite: {
        setTint: vi.fn(),
        clearTint: vi.fn(),
        setTexture,
        setData: vi.fn(),
        anims: { play: vi.fn() },
      },
    };

    const textureDescriptors: Record<string, { hasFrame: MockFn; has: MockFn; frames: Record<string, unknown> }> = {
      kirdy: {
        hasFrame: vi.fn().mockReturnValue(false),
        has: vi.fn().mockReturnValue(false),
        frames: {},
      },
      'kirdy-fire': {
        hasFrame: vi.fn().mockReturnValue(true),
        has: vi.fn().mockReturnValue(true),
        frames: { default: {} },
      },
      'kirdy-idle': {
        hasFrame: vi.fn().mockReturnValue(true),
        has: vi.fn().mockReturnValue(true),
        frames: { default: {} },
      },
    };

    const textureManager = {
      exists: vi.fn((key: string) => Object.prototype.hasOwnProperty.call(textureDescriptors, key)),
      get: vi.fn((key: string) => textureDescriptors[key]),
    };

    const abilityScene = {
      textures: textureManager,
      events: { emit: vi.fn() },
      sound: { play: vi.fn() },
    } as unknown as Phaser.Scene;

    const abilitySystem = new AbilitySystem(abilityScene, abilityKirdy as any, physicsSystem as any);

    expect(() => abilitySystem.applySwallowedPayload(payload)).not.toThrow();
    expect(setTexture).toHaveBeenCalledWith('kirdy-fire');
    expect(setTexture).not.toHaveBeenCalledWith('kirdy', 'fire');
  });

  it('flips projectile direction when Kirdy faces left', () => {
    kirdy.sprite.flipX = true;

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(starProjectile.setVelocityX).toHaveBeenCalledWith(-350);
  });

  it('does not spit when no enemy is captured', () => {
    kirdy.getMouthContent.mockReturnValue(undefined);

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).not.toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).not.toHaveBeenCalled();
  });

  it('reuses a pooled star projectile after it is recycled', () => {
    const recycleCallbacks: Array<(projectile: unknown) => boolean> = [];
    physicsSystem.registerPlayerAttack.mockImplementation((_, options) => {
      if (options?.recycle) {
        recycleCallbacks.push(options.recycle);
      }
    });

    const secondTarget: FakeTarget = {
      destroy: vi.fn(),
      setVisible: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setStatic: vi.fn().mockReturnThis(),
      getData: vi.fn(),
    } as unknown as FakeTarget;

    kirdy.getMouthContent
      .mockReturnValueOnce(target)
      .mockReturnValueOnce(secondTarget);

    const system = new SwallowSystem(scene, kirdy as any, inhaleSystem as any, physicsSystem as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledTimes(1);

    const recycler = recycleCallbacks.pop();
    expect(recycler).toBeTypeOf('function');
    recycler?.(starProjectile as any);

    system.update(
      buildActions({
        spit: { isDown: true, justPressed: true },
      }),
    );

    expect(addSprite).toHaveBeenCalledTimes(1);
    expect(starProjectile.setActive).toHaveBeenCalledWith(true);
    expect(starProjectile.setVisible).toHaveBeenCalledWith(true);
    const spawn = resolveForwardSpawnPosition(kirdy.sprite as any, 1);
    expect(starProjectile.setPosition).toHaveBeenCalledWith(spawn.x, spawn.y);
  });
});
