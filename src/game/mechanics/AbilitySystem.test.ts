import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { ActionStateMap } from './InhaleSystem';
import { AbilitySystem, ABILITY_TYPES } from './AbilitySystem';

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

    scene = {
      matter: { add: { sprite: addSprite } },
      time: { delayedCall },
      sound: { play: playSound },
      events: { emit: eventsEmit },
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

  it('exposes all core ability types', () => {
    expect(ABILITY_TYPES).toEqual(expect.arrayContaining(['fire', 'ice', 'sword']));
  });

  it('applies appearance changes when an ability is copied', () => {
    const system = new AbilitySystem(scene, kirdy as any);

    system.applySwallowedPayload({ abilityType: 'fire' });

    expect(kirdy.sprite.setTint).toHaveBeenCalled();
    expect(kirdy.sprite.setTexture).toHaveBeenCalled();
    expect(kirdy.sprite.setData).toHaveBeenCalledWith('equippedAbility', 'fire');
    expect(system.getCurrentAbilityType()).toBe('fire');
  });

  it('replaces an existing ability when a new one is copied', () => {
    const system = new AbilitySystem(scene, kirdy as any);

    system.applySwallowedPayload({ abilityType: 'fire' });
    system.applySwallowedPayload({ abilityType: 'ice' });

    expect(kirdy.sprite.clearTint).toHaveBeenCalled();
    expect(kirdy.sprite.setData).toHaveBeenCalledWith('equippedAbility', 'ice');
    expect(system.getCurrentAbilityType()).toBe('ice');
  });

  it('fires a flame projectile when Fire ability attacks', () => {
    const system = new AbilitySystem(scene, kirdy as any);
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
  });

  it('launches ice shards in the faced direction', () => {
    const system = new AbilitySystem(scene, kirdy as any);
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
  });

  it('triggers a sword slash sensor instead of projectile', () => {
    const system = new AbilitySystem(scene, kirdy as any);
    system.applySwallowedPayload({ abilityType: 'sword' });

    const slashStub = {
      setVelocityX: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFixedRotation: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setSensor: vi.fn().mockReturnThis(),
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
    expect(slashStub.setVelocityX).not.toHaveBeenCalled();
  });

  it('discards the active ability when the discard action is triggered', () => {
    const system = new AbilitySystem(scene, kirdy as any);
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

  it('does nothing when an unknown ability type is provided', () => {
    const system = new AbilitySystem(scene, kirdy as any);

    system.applySwallowedPayload({ abilityType: 'unknown' as any });

    expect(kirdy.sprite.setTint).not.toHaveBeenCalled();
    expect(system.getCurrentAbilityType()).toBeUndefined();
  });
});
