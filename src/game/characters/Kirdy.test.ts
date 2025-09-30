import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';

const stubFactory = vi.hoisted(() => {
  const createSprite = () => ({
    setFixedRotation: vi.fn().mockReturnThis(),
    setIgnoreGravity: vi.fn().mockReturnThis(),
    setFrictionAir: vi.fn().mockReturnThis(),
    setName: vi.fn().mockReturnThis(),
    setVelocityX: vi.fn().mockReturnThis(),
    setVelocityY: vi.fn().mockReturnThis(),
    setVelocity: vi.fn().mockReturnThis(),
    anims: {
      play: vi.fn().mockReturnThis(),
      isPlaying: false,
      currentAnim: { key: '' },
      stop: vi.fn(),
    },
    body: {
      velocity: { x: 0, y: 0 },
    },
    setFlipX: vi.fn().mockReturnThis(),
  });

  const createScene = () => {
    const sprite = createSprite();
    const matterAdd = {
      sprite: vi.fn().mockReturnValue(sprite),
    };

    const anims = {
      create: vi.fn(),
      exists: vi.fn().mockReturnValue(false),
    };

    const scene = {
      matter: {
        add: matterAdd,
      },
      anims,
    } as unknown as Phaser.Scene;

    return { scene, sprite, matterAdd, anims };
  };

  return { createScene };
});

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

import { Kirdy, createKirdy } from './Kirdy';

describe('Kirdy basics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Kirdy sprite with configured physics properties', () => {
    const { matterAdd, sprite, scene } = stubFactory.createScene();

    const kirdy = createKirdy(scene, { x: 48, y: 96 });

    expect(kirdy).toBeInstanceOf(Kirdy);
    expect(matterAdd.sprite).toHaveBeenCalledWith(48, 96, 'kirdy', undefined, expect.any(Object));
    expect(sprite.setFixedRotation).toHaveBeenCalled();
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(false);
    expect(sprite.setFrictionAir).toHaveBeenCalledWith(0.02);
    expect(sprite.setName).toHaveBeenCalledWith('Kirdy');
  });

  it('registers baseline animations when missing', () => {
    const { scene, anims } = stubFactory.createScene();

    createKirdy(scene, { x: 0, y: 0 });

    const keys = anims.create.mock.calls.map(([config]) => config.key);
    expect(keys).toEqual(expect.arrayContaining([
      'kirdy-idle',
      'kirdy-run',
      'kirdy-jump',
      'kirdy-hover',
      'kirdy-inhale',
    ]));
  });

  it('updates horizontal velocity when moving left or right', () => {
    const { scene, sprite } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    kirdy.update(0, 16, {
      left: true,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.setVelocityX).toHaveBeenCalledWith(-160);
    expect(sprite.setFlipX).toHaveBeenCalledWith(true);

    sprite.setVelocityX.mockClear();
    sprite.setFlipX.mockClear();

    kirdy.update(0, 16, {
      left: false,
      right: true,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.setVelocityX).toHaveBeenCalledWith(160);
    expect(sprite.setFlipX).toHaveBeenCalledWith(false);
  });

  it('stops horizontal movement when no direction is pressed', () => {
    const { scene, sprite } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    sprite.body.velocity.x = 42;

    kirdy.update(0, 16, {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.setVelocityX).toHaveBeenCalledWith(0);
  });

  it('performs a jump only on the rising edge of the jump input', () => {
    const { scene, sprite } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    sprite.setVelocityY.mockClear();
    sprite.body.velocity.y = 0;

    kirdy.update(0, 16, {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: false,
    });

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-260);

    sprite.setVelocityY.mockClear();
    sprite.body.velocity.y = -150;

    kirdy.update(16, 16, {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: false,
    });

    expect(sprite.setVelocityY).not.toHaveBeenCalled();

    sprite.body.velocity.y = 0;

    kirdy.update(32, 16, {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    });

    sprite.setVelocityY.mockClear();

    kirdy.update(48, 16, {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: false,
    });

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-260);
  });

  it('reverses downward fall when hovering mid-air', () => {
    const { scene, sprite } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    sprite.body.velocity.y = 320;

    kirdy.update(0, 16, {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: true,
    });

    expect(sprite.setVelocityY).toHaveBeenCalledWith(-40);
  });

  it('switches animations based on movement state', () => {
    const { scene, sprite } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    kirdy.update(0, 16, {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.anims.play).toHaveBeenCalledWith('kirdy-idle', true);

    sprite.anims.play.mockClear();
    sprite.body.velocity.y = 0;

    kirdy.update(16, 16, {
      left: false,
      right: true,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.anims.play).toHaveBeenCalledWith('kirdy-run', true);

    sprite.anims.play.mockClear();
    sprite.body.velocity.y = 0;

    kirdy.update(32, 16, {
      left: false,
      right: false,
      jumpPressed: true,
      hoverPressed: false,
    });

    expect(sprite.anims.play).toHaveBeenCalledWith('kirdy-jump', true);

    sprite.anims.play.mockClear();
    sprite.body.velocity.y = 200;

    kirdy.update(48, 16, {
      left: false,
      right: false,
      jumpPressed: false,
      hoverPressed: true,
    });

    expect(sprite.anims.play).toHaveBeenCalledWith('kirdy-hover', true);
  });

  it('tracks enemies stored in Kirdy\'s mouth for later actions', () => {
    const { scene } = stubFactory.createScene();
    const kirdy = createKirdy(scene, { x: 0, y: 0 });
    const captured = {} as unknown as Phaser.Physics.Matter.Sprite;

    expect(kirdy.getMouthContent()).toBeUndefined();

    kirdy.setMouthContent(captured);
    expect(kirdy.getMouthContent()).toBe(captured);

    kirdy.setMouthContent(undefined);
    expect(kirdy.getMouthContent()).toBeUndefined();
  });
});
