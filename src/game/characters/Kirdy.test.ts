import { describe, expect, it, vi } from 'vitest';
import { Kirdy, createKirdy } from './Kirdy';
import type { AbilityType } from '../mechanics/AbilitySystem';

type SpriteLike = {
  body: { velocity: { x: number; y: number } };
  setVelocityX: (value: number) => void;
  setVelocityY: (value: number) => void;
  setVelocity: (x: number, y: number) => void;
  setFlipX: (value: boolean) => void;
  setIgnoreGravity: (value: boolean) => void;
  anims: { play: ReturnType<typeof vi.fn> };
};

function createSpriteStub(): Phaser.Physics.Matter.Sprite {
  const velocity = { x: 0, y: 0 };

  const stub: SpriteLike = {
    body: { velocity },
    setVelocityX: vi.fn((value: number) => {
      velocity.x = value;
    }),
    setVelocityY: vi.fn((value: number) => {
      velocity.y = value;
    }),
    setVelocity: vi.fn((x: number, y: number) => {
      velocity.x = x;
      velocity.y = y;
    }),
    setFlipX: vi.fn(),
    setIgnoreGravity: vi.fn(),
    anims: { play: vi.fn() },
  };

  return stub as unknown as Phaser.Physics.Matter.Sprite;
}

describe('Kirdy', () => {
  it('moves horizontally at reduced speed when input is held', () => {
    const sprite = createSpriteStub();
    const kirdy = new Kirdy(sprite);
    const setVelocityXMock = sprite.setVelocityX as unknown as ReturnType<typeof vi.fn>;

    const moveRightInput = {
      left: false,
      right: true,
      jumpPressed: false,
      hoverPressed: false,
    };

    kirdy.update(0, 16, moveRightInput);

    expect(setVelocityXMock).toHaveBeenLastCalledWith(10);
    expect((sprite.body as { velocity: { x: number } }).velocity.x).toBe(10);

    setVelocityXMock.mockClear();

    const moveLeftInput = {
      left: true,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    };

    kirdy.update(16, 16, moveLeftInput);

    expect(setVelocityXMock).toHaveBeenLastCalledWith(-10);
    expect((sprite.body as { velocity: { x: number } }).velocity.x).toBe(-10);
  });

  it('launches upward with reduced jump speed when jumping from ground', () => {
    const sprite = createSpriteStub();
    const kirdy = new Kirdy(sprite);
    const internals = kirdy as unknown as { grounded: boolean };
    internals.grounded = true;

    const input = {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: false,
    };

    kirdy.update(0, 16, input);

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-20);
    expect((sprite.body as { velocity: { y: number } }).velocity.y).toBe(-20);
  });

  it('tracks HP, score, and ability internally instead of GameScene', () => {
    const sprite = createSpriteStub();
    const kirdy = new Kirdy(sprite, { maxHP: 6, initialHP: 6, score: 0 });

    expect(kirdy.getHP()).toBe(6);
    expect(kirdy.getMaxHP()).toBe(6);
    expect(kirdy.getScore()).toBe(0);
    expect(kirdy.getAbility()).toBeUndefined();

    kirdy.takeDamage(2);
    expect(kirdy.getHP()).toBe(4);

    kirdy.heal(1);
    expect(kirdy.getHP()).toBe(5);

    kirdy.addScore(150);
    expect(kirdy.getScore()).toBe(150);

    const ability: AbilityType = 'fire';
    kirdy.setAbility(ability);
    expect(kirdy.getAbility()).toBe(ability);

    kirdy.clearAbility();
    expect(kirdy.getAbility()).toBeUndefined();
  });

  it('limits upward speed while hover is held', () => {
    const sprite = createSpriteStub();
    (sprite.body as { velocity: { y: number } }).velocity.y = -48;
    const kirdy = new Kirdy(sprite);
    const subject = kirdy as unknown as { previousJumpPressed: boolean };
    subject.previousJumpPressed = true;

    const input = {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: true,
    };

    kirdy.update(0, 16, input);

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-10);
    expect((sprite.body as { velocity: { y: number } }).velocity.y).toBe(-10);
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(true);

    const playMock = sprite.anims.play as unknown as ReturnType<typeof vi.fn>;
    const animationCalls = playMock.mock.calls;
    expect(animationCalls.length).toBeGreaterThan(0);
    const lastCall = animationCalls[animationCalls.length - 1];
    expect(lastCall?.[0]).toBe('kirdy-hover');
  });

  it('reverses descent into hover climb while hover is held', () => {
    const sprite = createSpriteStub();
    (sprite.body as { velocity: { y: number } }).velocity.y = 18;
    const kirdy = new Kirdy(sprite);
    const subject = kirdy as unknown as { previousJumpPressed: boolean };
    subject.previousJumpPressed = true;

    const input = {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: true,
    };

    kirdy.update(0, 16, input);

    const playMock = sprite.anims.play as unknown as ReturnType<typeof vi.fn>;
    const animationCalls = playMock.mock.calls;
    expect(animationCalls.length).toBeGreaterThan(0);
    const lastCall = animationCalls[animationCalls.length - 1];
    expect(lastCall?.[0]).toBe('kirdy-hover');

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-10);
    expect((sprite.body as { velocity: { y: number } }).velocity.y).toBe(-10);
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(true);
  });

  it('starts hover when vertical speed is nearly zero upward', () => {
    const sprite = createSpriteStub();
    (sprite.body as { velocity: { y: number } }).velocity.y = -0.5;
    const kirdy = new Kirdy(sprite);
    const subject = kirdy as unknown as { previousJumpPressed: boolean };
    subject.previousJumpPressed = true;

    const input = {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: true,
    };

    kirdy.update(0, 16, input);

    const playMock = sprite.anims.play as unknown as ReturnType<typeof vi.fn>;
    const animationCalls = playMock.mock.calls;
    expect(animationCalls.length).toBeGreaterThan(0);
    const lastCall = animationCalls[animationCalls.length - 1];
    expect(lastCall?.[0]).toBe('kirdy-hover');

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-10);
    expect((sprite.body as { velocity: { y: number } }).velocity.y).toBe(-10);
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(true);
  });

  it('falls normally when hover is not held during descent', () => {
    const sprite = createSpriteStub();
    (sprite.body as { velocity: { y: number } }).velocity.y = 22;
    const kirdy = new Kirdy(sprite);
    const subject = kirdy as unknown as { previousJumpPressed: boolean };
    subject.previousJumpPressed = true;

    const input = {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    };

    kirdy.update(0, 16, input);

    const playMock = sprite.anims.play as unknown as ReturnType<typeof vi.fn>;
    const animationCalls = playMock.mock.calls;
    expect(animationCalls.length).toBeGreaterThan(0);
    const lastCall = animationCalls[animationCalls.length - 1];
    expect(lastCall?.[0]).toBe('kirdy-jump');

    expect(sprite.setVelocityY).not.toHaveBeenCalled();
    expect((sprite.body as { velocity: { y: number } }).velocity.y).toBe(22);
    expect(sprite.setIgnoreGravity).not.toHaveBeenCalled();
  });

  it('restores gravity when hover input ends mid-air', () => {
    const sprite = createSpriteStub();
    (sprite.body as { velocity: { y: number } }).velocity.y = -2;
    const kirdy = new Kirdy(sprite);
    const subject = kirdy as unknown as { previousJumpPressed: boolean };
    subject.previousJumpPressed = true;

    const hoverInput = {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: true,
    };

    kirdy.update(0, 16, hoverInput);

    const hoverCalls = (sprite.setIgnoreGravity as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(hoverCalls.some(([value]) => value === true)).toBe(true);

    const fallInput = {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    };

    kirdy.update(16, 16, fallInput);

    const allCalls = (sprite.setIgnoreGravity as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(allCalls.some(([value]) => value === false)).toBe(true);
  });
});

describe('createKirdy', () => {
  it('disables ground friction so walls do not slow descent', () => {
    const sprite: Partial<Phaser.Physics.Matter.Sprite> = {
      setFixedRotation: vi.fn().mockReturnThis(),
      setIgnoreGravity: vi.fn().mockReturnThis(),
      setFrictionAir: vi.fn().mockReturnThis(),
      setName: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setFriction: vi.fn().mockReturnThis(),
      setFrictionStatic: vi.fn().mockReturnThis(),
    };

    const spriteFactory = vi.fn().mockReturnValue(sprite);

    const scene = {
      matter: {
        add: {
          sprite: spriteFactory,
        },
      },
      anims: {
        exists: vi.fn().mockReturnValue(false),
        create: vi.fn(),
      },
      textures: {
        exists: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue({
          getFrameNames: () => ['0'],
        }),
      },
    } as unknown as Phaser.Scene;

    createKirdy(scene, { x: 12, y: 34 });

    expect(spriteFactory).toHaveBeenCalledWith(12, 34, 'kirdy', undefined, expect.any(Object));
    expect(sprite.setFriction).toHaveBeenCalledWith(0, 0, 0);
    expect(sprite.setFrictionStatic).toHaveBeenCalledWith(0);
  });
});
