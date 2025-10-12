import { beforeEach, describe, expect, it, vi } from 'vitest';

const spriteFactory = vi.hoisted(() => () => ({
  x: 0,
  y: 0,
  setIgnoreGravity: vi.fn().mockReturnThis(),
  setFixedRotation: vi.fn().mockReturnThis(),
  setFrictionAir: vi.fn().mockReturnThis(),
  setName: vi.fn().mockReturnThis(),
  setOrigin: vi.fn().mockReturnThis(),
  setData: vi.fn().mockReturnThis(),
  setVelocityX: vi.fn().mockReturnThis(),
  setVelocityY: vi.fn().mockReturnThis(),
  setFlipX: vi.fn().mockReturnThis(),
  setActive: vi.fn().mockReturnThis(),
  setVisible: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis(),
  setScale: vi.fn().mockReturnThis(),
  setBody: vi.fn().mockReturnThis(),
  setRectangle: vi.fn().mockReturnThis(),
  setTint: vi.fn().mockReturnThis(),
  clearTint: vi.fn().mockReturnThis(),
  destroy: vi.fn(),
}));

const addSpriteMock = vi.hoisted(() => vi.fn());
const eventsEmitMock = vi.hoisted(() => vi.fn());

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

describe('enemy system', () => {
  let sprite: ReturnType<typeof spriteFactory>;
  let scene: any;

  beforeEach(() => {
    sprite = spriteFactory();
    addSpriteMock.mockReturnValue(sprite);
    eventsEmitMock.mockReset();
    sprite.setData.mockReset();
    sprite.setVelocityX.mockReset();
    sprite.setFlipX.mockReset();
    sprite.destroy.mockReset();
    sprite.setBody.mockReset();
    sprite.setOrigin.mockReset();

    scene = {
      matter: { add: { sprite: addSpriteMock } },
      events: { emit: eventsEmitMock },
    };
  });

  it('creates a Wabble Bee with flying defaults and fire ability payload', async () => {
    const { createWabbleBee } = await import('./index');

    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => ({ x: 400, y: 200 }),
    });

    expect(addSpriteMock).toHaveBeenCalledWith(100, 200, 'wabble-bee');
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(true);
    expect(sprite.setFixedRotation).toHaveBeenCalledWith();
    expect(sprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(sprite.setScale).toHaveBeenCalledWith(0.65);
    expect(sprite.setBody).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rectangle',
      width: 42,
      height: 36,
    }));
    expect(sprite.setData).toHaveBeenCalledWith('enemyType', 'wabble-bee');
    expect(sprite.setData).toHaveBeenCalledWith('abilityType', 'fire');
    expect(enemy.getAbilityType()).toBe('fire');
    expect(enemy.getHP()).toBeGreaterThan(0);
  });

  it('uses Kirdy move speed for default Wabble Bee patrols', async () => {
    const { createWabbleBee } = await import('./index');
    const { KIRDY_MOVE_SPEED } = await import('../characters/Kirdy');
    const expectedSpeed = KIRDY_MOVE_SPEED * 0.4;

    const enemy = createWabbleBee(scene, { x: 160, y: 200 }, {
      getPlayerPosition: () => undefined,
    });

    sprite.x = 160;
    enemy.update(16);

    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(expectedSpeed);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(false);
  });

  it('patrols horizontally and flips at patrol bounds when player is distant', async () => {
    const { createWabbleBee } = await import('./index');

    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => ({ x: 400, y: 200 }),
      patrolRadius: 40,
      patrolSpeed: 70,
    });

    sprite.x = 100;
    enemy.update(16);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(70);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(false);

    sprite.setVelocityX.mockClear();
    sprite.setFlipX.mockClear();
    sprite.x = 142; // beyond right bound
    enemy.update(16);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-70);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(true);

    sprite.setVelocityX.mockClear();
    sprite.setFlipX.mockClear();
    sprite.x = 58; // beyond left bound
    enemy.update(16);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(70);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(false);
  });

  it('switches to chase mode when player enters detection range', async () => {
    const { createWabbleBee } = await import('./index');

    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => ({ x: 40, y: 200 }),
      detectionRange: 100,
      chaseSpeed: 120,
    });

    sprite.x = 120;
    enemy.update(16);

    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-120);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(true);
  });

  it('uses Kirdy move speed for default Wabble Bee chases', async () => {
    const { createWabbleBee } = await import('./index');
    const { KIRDY_MOVE_SPEED } = await import('../characters/Kirdy');
    const expectedSpeed = KIRDY_MOVE_SPEED * 0.45;

    const enemy = createWabbleBee(scene, { x: 200, y: 200 }, {
      getPlayerPosition: () => ({ x: 120, y: 200 }),
    });

    sprite.x = 200;
    enemy.update(16);

    const [[chaseVelocity]] = sprite.setVelocityX.mock.calls.slice(-1);
    expect(Math.abs(chaseVelocity)).toBe(expectedSpeed);
  });

  it('re-baselines the patrol center when dispersed to a new position', async () => {
    const { createWabbleBee } = await import('./index');

    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => undefined,
      patrolRadius: 40,
      patrolSpeed: 80,
    });

    sprite.x = 100;
    enemy.update(16);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(80);

    sprite.setVelocityX.mockClear();
    enemy.onDisperse?.({ x: 200, y: 200 });
    sprite.x = 200;
    enemy.update(16);

    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(80);
  });

  it('resumes chasing after disperse recovery expires', async () => {
    const { createWabbleBee } = await import('./index');

    const target = { x: 40, y: 200 };
    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => target,
      patrolRadius: 40,
      patrolSpeed: 80,
      chaseSpeed: 120,
      detectionRange: 160,
    });

    sprite.x = 200;
    enemy.onDisperse?.({ x: 200, y: 200 });

    enemy.update(16);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(80);

    sprite.setVelocityX.mockClear();
    enemy.update(2000);
    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-120);
  });

  it('reduces HP and destroys the enemy when HP reaches zero', async () => {
    const { createWabbleBee } = await import('./index');

    const enemy = createWabbleBee(scene, { x: 100, y: 200 }, {
      getPlayerPosition: () => ({ x: 400, y: 200 }),
      maxHP: 2,
    });

    enemy.takeDamage(1);
    expect(enemy.getHP()).toBe(1);
    expect(sprite.destroy).not.toHaveBeenCalled();

    enemy.takeDamage(1);
    expect(enemy.isDefeated()).toBe(true);
    expect(sprite.setActive).toHaveBeenCalledWith(false);
    expect(sprite.setVisible).toHaveBeenCalledWith(false);
    expect(sprite.destroy).toHaveBeenCalled();
    expect(eventsEmitMock).toHaveBeenCalledWith('enemy-defeated', expect.objectContaining({
      enemyType: 'wabble-bee',
      abilityType: 'fire',
    }));
  });

  it('creates a Dronto Durt that charges within range and uses sword ability payload', async () => {
    const { createDrontoDurt } = await import('./index');

    const enemy = createDrontoDurt(scene, { x: 300, y: 240 }, {
      getPlayerPosition: () => ({ x: 200, y: 240 }),
      detectionRange: 150,
      chargeSpeed: 90,
    });

    expect(addSpriteMock).toHaveBeenCalledWith(300, 240, 'dronto-durt');
    expect(sprite.setIgnoreGravity).toHaveBeenCalledWith(false);
    expect(sprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(sprite.setScale).toHaveBeenCalledWith(0.75);
    expect(sprite.setBody).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rectangle',
      width: 48,
      height: 48,
    }));
    expect(sprite.setData).toHaveBeenCalledWith('enemyType', 'dronto-durt');
    expect(sprite.setData).toHaveBeenCalledWith('abilityType', 'sword');
    expect(enemy.getAbilityType()).toBe('sword');

    sprite.x = 320;
    enemy.update(16);

    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-90);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(true);
  });

  it('uses Kirdy move speed for default Dronto Durt charges', async () => {
    const { createDrontoDurt } = await import('./index');
    const { KIRDY_MOVE_SPEED } = await import('../characters/Kirdy');
    const expectedSpeed = KIRDY_MOVE_SPEED * 0.45;

    const enemy = createDrontoDurt(scene, { x: 240, y: 240 }, {
      getPlayerPosition: () => ({ x: 200, y: 240 }),
    });

    sprite.x = 240;
    enemy.update(16);

    const [[chargeVelocity]] = sprite.setVelocityX.mock.calls.slice(-1);
    expect(Math.abs(chargeVelocity)).toBe(expectedSpeed);
  });
});
