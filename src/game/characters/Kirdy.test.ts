import { describe, expect, it, vi } from 'vitest';
import { Kirdy } from './Kirdy';
import type { AbilityType } from '../mechanics/AbilitySystem';

type SpriteLike = {
  body: { velocity: { x: number; y: number } };
  setVelocityX: (value: number) => void;
  setVelocityY: (value: number) => void;
  setVelocity: (x: number, y: number) => void;
  setFlipX: (value: boolean) => void;
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
    anims: { play: vi.fn() },
  };

  return stub as unknown as Phaser.Physics.Matter.Sprite;
}

describe('Kirdy', () => {
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
});
