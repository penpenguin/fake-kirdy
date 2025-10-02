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
    setCollisionCategory: vi.fn().mockReturnThis(),
    setCollidesWith: vi.fn().mockReturnThis(),
    setOnCollide: vi.fn().mockReturnThis(),
    setOnCollideEnd: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    anims: {
      play: vi.fn().mockReturnThis(),
      isPlaying: false,
      currentAnim: { key: '' },
      stop: vi.fn(),
      animationManager: {
        exists: vi.fn().mockReturnValue(true),
      },
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

    const textures = {
      exists: vi.fn().mockReturnValue(false),
      get: vi.fn(),
    };

    const scene = {
      matter: {
        add: matterAdd,
      },
      anims,
      textures,
    } as unknown as Phaser.Scene;

    return { scene, sprite, matterAdd, anims, textures };
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

  it('registers only animations that have available frames', () => {
    const { scene, anims, textures } = stubFactory.createScene();

    textures.exists.mockImplementation((key: string) => key === 'kirdy-idle');
    textures.get.mockImplementation(() => ({
      getFrameNames: () => ['__BASE'],
      frames: { __BASE: {} },
    }));

    createKirdy(scene, { x: 0, y: 0 });

    expect(anims.create).toHaveBeenCalledTimes(1);
    expect(anims.create).toHaveBeenCalledWith(expect.objectContaining({
      key: 'kirdy-idle',
    }));

    const idleCall = anims.create.mock.calls.find(([config]) => config.key === 'kirdy-idle');
    expect(idleCall?.[0].frames).toEqual([
      expect.objectContaining({ key: 'kirdy-idle', frame: '__BASE' }),
    ]);
  });

  it('registers additional animations when their frames are available', () => {
    const { scene, anims, textures } = stubFactory.createScene();

    textures.exists.mockReturnValue(true);
    textures.get.mockImplementation((key: string) => ({
      getFrameNames: () => [`${key}-0`, `${key}-1`],
      frames: {
        [`${key}-0`]: {},
        [`${key}-1`]: {},
      },
    }));

    createKirdy(scene, { x: 0, y: 0 });

    const runCall = anims.create.mock.calls.find(([config]) => config.key === 'kirdy-run');
    expect(runCall?.[0].frames).toEqual([
      { key: 'kirdy-run', frame: 'kirdy-run-0' },
      { key: 'kirdy-run', frame: 'kirdy-run-1' },
    ]);
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
    sprite.anims.animationManager.exists.mockImplementation(() => true);
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

  it('skips registering animations without available frames', () => {
    const { scene, anims, textures } = stubFactory.createScene();

    textures.exists.mockImplementation(() => false);
    textures.get.mockReturnValue({
      getFrameNames: () => [],
      frames: {},
    });

    createKirdy(scene, { x: 0, y: 0 });

    expect(anims.create).not.toHaveBeenCalled();
  });

  it('falls back to idle animation when target animation is missing', () => {
    const { scene, sprite, textures } = stubFactory.createScene();

    textures.exists.mockImplementation((key: string) => key === 'kirdy-idle');
    textures.get.mockReturnValue({
      getFrameNames: () => ['__BASE'],
      frames: { __BASE: {} },
    });

    const kirdy = createKirdy(scene, { x: 0, y: 0 });

    sprite.anims.animationManager.exists.mockImplementation((key: string) => key === 'kirdy-idle');

    sprite.body.velocity.y = 0;

    kirdy.update(0, 16, {
      left: false,
      right: true,
      jumpPressed: false,
      hoverPressed: false,
    });

    expect(sprite.anims.play).toHaveBeenCalledWith('kirdy-idle', true);
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
