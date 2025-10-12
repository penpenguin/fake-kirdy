import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { InhaleSystem, type ActionStateMap } from './InhaleSystem';

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

let scene: Phaser.Scene;
let playSound: ReturnType<typeof vi.fn>;
let playAnimation: ReturnType<typeof vi.fn>;
let addParticles: ReturnType<typeof vi.fn>;
let particleManager: {
  startFollow: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
};
let textureManager: {
  exists: ReturnType<typeof vi.fn>;
};
let kirdy: {
  sprite: {
    anims: { play: ReturnType<typeof vi.fn> };
    x: number;
    y: number;
    flipX: boolean;
  };
  setMouthContent?: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  playSound = vi.fn();
  playAnimation = vi.fn();

  particleManager = {
    startFollow: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    setDepth: vi.fn(),
  };
  particleManager.setDepth.mockReturnValue(particleManager);

  addParticles = vi.fn().mockReturnValue(particleManager);

  textureManager = {
    exists: vi.fn().mockReturnValue(true),
  };

  scene = {
    sound: {
      play: playSound,
    },
    add: {
      particles: addParticles,
    },
    textures: textureManager,
  } as unknown as Phaser.Scene;

  kirdy = {
    sprite: {
      anims: {
        play: playAnimation,
      },
      x: 0,
      y: 0,
      flipX: false,
    },
    setMouthContent: vi.fn(),
  };
});

describe('InhaleSystem core behavior', () => {

  it('plays the inhale animation and sound when the action is triggered', () => {
    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(playAnimation).toHaveBeenCalledWith('kirdy-inhale', true);
    expect(playSound).toHaveBeenCalledWith('kirdy-inhale');
  });

  it('does not replay sound while the inhale action remains held', () => {
    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    playSound.mockClear();
    playAnimation.mockClear();

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: false },
      }),
    );

    expect(playSound).not.toHaveBeenCalled();
    expect(playAnimation).toHaveBeenCalledWith('kirdy-inhale', true);
  });

  it('allows the inhale cue to trigger again after release', () => {
    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    system.update(
      buildActions({
        inhale: { isDown: false, justPressed: false },
      }),
    );

    playSound.mockClear();
    playAnimation.mockClear();

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(playSound).toHaveBeenCalledWith('kirdy-inhale');
    expect(playAnimation).toHaveBeenCalledWith('kirdy-inhale', true);
  });

  it('spawns and disposes the inhale particle effect in sync with the action state', () => {
    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(addParticles).toHaveBeenCalledWith(0, 0, 'inhale-sparkle');
    expect(particleManager.startFollow).toHaveBeenCalledWith(kirdy.sprite);
    expect(particleManager.setDepth).toHaveBeenCalled();

    system.update(
      buildActions({
        inhale: { isDown: false, justPressed: false },
      }),
    );

    expect(particleManager.stop).toHaveBeenCalled();
    expect(particleManager.destroy).toHaveBeenCalled();
  });

  it('falls back to the inhale texture when the sparkle particle is missing', () => {
    textureManager.exists.mockImplementation((key: string) => key !== 'inhale-sparkle');
    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(addParticles).toHaveBeenCalledWith(0, 0, 'kirdy-inhale');
  });

  it('skips the inhale particle effect when no textures are available', () => {
    textureManager.exists.mockReturnValue(false);
    addParticles.mockClear();

    const system = new InhaleSystem(scene, kirdy as any);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(addParticles).not.toHaveBeenCalled();
  });
});

describe('InhaleSystem target capture', () => {
  function createTarget(x: number, y: number) {
    const raw = {
      x,
      y,
      active: true,
      setActive: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setVelocity: vi.fn().mockReturnThis(),
      setStatic: vi.fn().mockReturnThis(),
      setData: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      body: {
        position: { x, y },
      },
    };

    return { sprite: raw as unknown as Phaser.Physics.Matter.Sprite, raw };
  }

  it('captures the closest target within the frontal inhale range', () => {
    const system = new InhaleSystem(scene, kirdy as any);
    const nearby = createTarget(60, 8);
    const farther = createTarget(120, 12);

    system.setInhalableTargets([farther.sprite, nearby.sprite]);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(system.getCapturedTarget()).toBe(nearby.sprite);
    expect(kirdy.setMouthContent).toHaveBeenCalledWith(nearby.sprite);
    expect(nearby.raw.setActive).toHaveBeenCalledWith(false);
    expect(nearby.raw.setVisible).toHaveBeenCalledWith(false);
    expect(nearby.raw.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(nearby.raw.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it('does not capture targets that are behind Kirdy', () => {
    const system = new InhaleSystem(scene, kirdy as any);
    const target = createTarget(40, 0);
    kirdy.sprite.flipX = true; // facing left

    system.setInhalableTargets([target.sprite]);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(system.getCapturedTarget()).toBeUndefined();
    expect(kirdy.setMouthContent).not.toHaveBeenCalled();
  });

  it('ignores targets that are outside the vertical inhale window', () => {
    const system = new InhaleSystem(scene, kirdy as any);
    const target = createTarget(40, 80);

    system.setInhalableTargets([target.sprite]);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    expect(system.getCapturedTarget()).toBeUndefined();
  });

  it('keeps the captured target aligned with Kirdy even after inhaling stops', () => {
    const system = new InhaleSystem(scene, kirdy as any);
    const target = createTarget(60, 0);

    system.setInhalableTargets([target.sprite]);

    system.update(
      buildActions({
        inhale: { isDown: true, justPressed: true },
      }),
    );

    kirdy.sprite.x = 128;
    kirdy.sprite.y = 32;

    target.raw.setPosition.mockClear();

    system.update(
      buildActions({
        inhale: { isDown: false, justPressed: false },
      }),
    );

    expect(target.raw.setPosition).toHaveBeenCalledWith(128, 32);
  });
});
