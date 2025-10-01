import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { ActionStateMap } from './InhaleSystem';
import { SwallowSystem } from './SwallowSystem';

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
  destroy: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setActive: ReturnType<typeof vi.fn>;
  setIgnoreGravity: ReturnType<typeof vi.fn>;
  setStatic: ReturnType<typeof vi.fn>;
  getData: ReturnType<typeof vi.fn>;
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
      flipX: boolean;
      anims: { play: ReturnType<typeof vi.fn> };
    };
    getMouthContent: ReturnType<typeof vi.fn>;
  };
  let inhaleSystem: {
    releaseCapturedTarget: ReturnType<typeof vi.fn>;
  };
  let target: FakeTarget;
  let starProjectile: {
    setVelocityX: ReturnType<typeof vi.fn>;
    setIgnoreGravity: ReturnType<typeof vi.fn>;
    setCollisionCategory: ReturnType<typeof vi.fn>;
    setCollidesWith: ReturnType<typeof vi.fn>;
    setOnCollide: ReturnType<typeof vi.fn>;
    setName: ReturnType<typeof vi.fn>;
    setFixedRotation: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    setVelocity: ReturnType<typeof vi.fn>;
    setData: ReturnType<typeof vi.fn>;
    getData: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
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

    starProjectile = {
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setCollisionCategory: vi.fn().mockReturnThis(),
      setCollidesWith: vi.fn().mockReturnThis(),
      setOnCollide: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setActive: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setVelocity: vi.fn().mockReturnThis(),
      setData: vi.fn((key: string, value: unknown) => {
        starProjectileData.set(key, value);
        return starProjectile;
      }),
      getData: vi.fn((key: string) => starProjectileData.get(key)),
      once: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    addSprite = vi.fn().mockReturnValue(starProjectile);

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
    expect(payload).toEqual({ abilityType: 'fire' });
    expect(system.consumeSwallowedPayload()).toBeUndefined();
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
    expect(starProjectile.setPosition).toHaveBeenCalledWith(128, 256);
    expect(starProjectile.setVelocityX).toHaveBeenCalledWith(350);
    expect(starProjectile.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(starProjectile.setOnCollide).toHaveBeenCalledWith(expect.any(Function));
    expect(starProjectile.once).not.toHaveBeenCalled();
    expect(delayedCall).toHaveBeenCalled();
    expect(physicsSystem.registerPlayerAttack).toHaveBeenCalledWith(
      starProjectile,
      expect.objectContaining({ damage: 2, recycle: expect.any(Function) }),
    );
    expect(target.destroy).toHaveBeenCalled();
    expect(inhaleSystem.releaseCapturedTarget).toHaveBeenCalled();
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
    const recycleCallbacks: Array<() => boolean> = [];
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
    expect(starProjectile.setPosition).toHaveBeenCalledWith(128, 256);
  });
});
