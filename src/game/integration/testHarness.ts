import type Phaser from 'phaser';
import { vi } from 'vitest';
import { Kirdy } from '../characters/Kirdy';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { AbilitySystem } from '../mechanics/AbilitySystem';
import type { ActionStateMap } from '../mechanics/InhaleSystem';
import { InhaleSystem } from '../mechanics/InhaleSystem';
import { SwallowSystem } from '../mechanics/SwallowSystem';
import type { InputButtonState, PlayerAction } from '../input/PlayerInputManager';

type TimerCallback = (...args: unknown[]) => void;

class FakeTimer {
  public removed = false;

  constructor(public readonly delay: number, private readonly callback?: TimerCallback) {}

  trigger() {
    if (this.removed) {
      return;
    }

    this.callback?.();
  }

  remove() {
    this.removed = true;
  }
}

class FakeParticleEffect {
  public startFollow = vi.fn();
  public stop = vi.fn();
  public destroy = vi.fn();
  public setDepth = vi.fn();
}

export class FakeMatterSprite {
  public x = 0;
  public y = 0;
  public flipX = false;
  public active = true;
  public visible = true;
  public name?: string;
  public destroyed = false;
  public data = new Map<string, unknown>();
  public readonly body = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
  };

  public readonly anims = {
    play: vi.fn(),
  };

  private onceHandlers = new Map<string, TimerCallback>();
  private collideHandler?: Phaser.Types.Physics.Matter.SetCollideCallback;

  constructor(public texture: string) {}

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.body.position.x = x;
    this.body.position.y = y;
    return this;
  }

  setVelocity(x: number, y: number) {
    this.body.velocity.x = x;
    this.body.velocity.y = y;
    return this;
  }

  setVelocityX(x: number) {
    this.body.velocity.x = x;
    return this;
  }

  setVelocityY(y: number) {
    this.body.velocity.y = y;
    return this;
  }

  setFixedRotation() {
    return this;
  }

  setIgnoreGravity(_value: boolean) {
    return this;
  }

  setStatic(_value: boolean) {
    return this;
  }

  setActive(value: boolean) {
    this.active = value;
    return this;
  }

  setVisible(value: boolean) {
    this.visible = value;
    return this;
  }

  setName(value: string) {
    this.name = value;
    return this;
  }

  setData<T>(key: string, value: T) {
    this.data.set(key, value);
    return this;
  }

  getData<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  setOnCollide(handler: Phaser.Types.Physics.Matter.SetCollideCallback | undefined) {
    this.collideHandler = handler;
    return this;
  }

  once(event: string, handler: TimerCallback) {
    this.onceHandlers.set(event, handler);
    return this;
  }

  emit(event: string) {
    const handler = this.onceHandlers.get(event);
    if (handler) {
      this.onceHandlers.delete(event);
      handler();
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.emit('destroy');
  }
}

export class FakeScene {
  public readonly sound = {
    play: vi.fn(),
  };

  public readonly events = {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  };

  public readonly time = {
    delayedCall: (delay: number, callback?: TimerCallback) => {
      const timer = new FakeTimer(delay, callback);
      this.timers.push(timer);
      return timer;
    },
  };

  public readonly matter = {
    add: {
      sprite: (x: number, y: number, texture: string) => new FakeMatterSprite(texture).setPosition(x, y),
    },
  };

  public readonly add = {
    particles: vi.fn(() => new FakeParticleEffect()),
    container: vi.fn(),
    text: vi.fn(),
  };

  public readonly scale = {
    width: 800,
    height: 600,
  };

  public readonly textures = {
    exists: vi.fn().mockReturnValue(false),
  };

  public readonly anims = {
    exists: vi.fn().mockReturnValue(false),
    create: vi.fn(),
  };

  public readonly cameras = {
    main: {
      worldView: { x: 0, y: 0, width: 800, height: 600 },
    },
  };

  public readonly input = {
    keyboard: {
      addKey: vi.fn(() => ({ isDown: false })),
      once: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  };

  private readonly timers: FakeTimer[] = [];

  asScene(): Phaser.Scene {
    return this as unknown as Phaser.Scene;
  }

  runAllTimers() {
    this.timers.forEach((timer) => timer.trigger());
  }
}

export interface GameplayHarness {
  scene: FakeScene;
  kirdy: Kirdy;
  enemy: FakeMatterSprite;
  inhaleSystem: InhaleSystem;
  swallowSystem: SwallowSystem;
  abilitySystem: AbilitySystem;
  physicsSystem: {
    registerPlayerAttack: ReturnType<typeof vi.fn>;
    destroyProjectile: ReturnType<typeof vi.fn>;
  };
}

export function createGameplayHarness(options: { abilityType: AbilityType }): GameplayHarness {
  const scene = new FakeScene();
  const playerSprite = new FakeMatterSprite('kirdy').setPosition(160, 360);
  const kirdy = new Kirdy(playerSprite as Phaser.Physics.Matter.Sprite);

  const enemy = new FakeMatterSprite('test-enemy').setPosition(200, 360);
  enemy.setData('abilityType', options.abilityType);

  const physicsSystem = {
    registerPlayerAttack: vi.fn(),
    destroyProjectile: vi.fn(),
  };

  const inhaleSystem = new InhaleSystem(scene.asScene(), kirdy);
  const swallowSystem = new SwallowSystem(scene.asScene(), kirdy, inhaleSystem, physicsSystem as unknown as any);
  const abilitySystem = new AbilitySystem(scene.asScene(), kirdy, physicsSystem as unknown as any, undefined);

  inhaleSystem.addInhalableTarget(enemy as unknown as Phaser.Physics.Matter.Sprite);

  return {
    scene,
    kirdy,
    enemy,
    inhaleSystem,
    swallowSystem,
    abilitySystem,
    physicsSystem,
  };
}

export function actionState(
  overrides: Partial<Record<PlayerAction, Partial<InputButtonState>>> = {},
): ActionStateMap {
  const base: ActionStateMap = {
    inhale: { isDown: false, justPressed: false },
    swallow: { isDown: false, justPressed: false },
    spit: { isDown: false, justPressed: false },
    discard: { isDown: false, justPressed: false },
  };

  (Object.keys(overrides) as PlayerAction[]).forEach((action) => {
    base[action] = {
      ...base[action],
      ...(overrides[action] ?? {}),
    };
  });

  return base;
}
