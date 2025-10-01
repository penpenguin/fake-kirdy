import { beforeEach, describe, expect, it, vi } from 'vitest';

const spriteFactory = vi.hoisted(() => () => ({
  x: 0,
  y: 0,
  setIgnoreGravity: vi.fn().mockReturnThis(),
  setFixedRotation: vi.fn().mockReturnThis(),
  setFrictionAir: vi.fn().mockReturnThis(),
  setName: vi.fn().mockReturnThis(),
  setData: vi.fn().mockReturnThis(),
  setVelocityX: vi.fn().mockReturnThis(),
  setVelocityY: vi.fn().mockReturnThis(),
  setFlipX: vi.fn().mockReturnThis(),
  setActive: vi.fn().mockReturnThis(),
  setVisible: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis(),
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
    expect(sprite.setData).toHaveBeenCalledWith('enemyType', 'wabble-bee');
    expect(sprite.setData).toHaveBeenCalledWith('abilityType', 'fire');
    expect(enemy.getAbilityType()).toBe('fire');
    expect(enemy.getHP()).toBeGreaterThan(0);
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
    expect(sprite.setData).toHaveBeenCalledWith('enemyType', 'dronto-durt');
    expect(sprite.setData).toHaveBeenCalledWith('abilityType', 'sword');
    expect(enemy.getAbilityType()).toBe('sword');

    sprite.x = 320;
    enemy.update(16);

    expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-90);
    expect(sprite.setFlipX).toHaveBeenLastCalledWith(true);
  });
});
