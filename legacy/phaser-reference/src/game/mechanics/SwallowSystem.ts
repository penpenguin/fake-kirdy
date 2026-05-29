import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap, InhaleSystem } from './InhaleSystem';
import type { PhysicsSystem, MatterGameObject } from '../physics/PhysicsSystem';
import { PhysicsCategory } from '../physics/PhysicsSystem';
import { AbilitySystem } from './AbilitySystem';
import type { AbilityMetadata } from './AbilitySystem';
import { ObjectPool } from '../performance/ObjectPool';
import { configureProjectileHitbox, resolveForwardSpawnPosition } from './projectilePlacement';
import { attachProjectileTrail } from './projectileTrail';

export interface SwallowedPayload {
  abilityType?: string;
  ability?: AbilityMetadata;
}

const STAR_PROJECTILE_SPEED = 350;
const STAR_PROJECTILE_LIFETIME_MS = 2400;
const STAR_PROJECTILE_DAMAGE = 3;
const STAR_PROJECTILE_TEXTURE = 'star-bullet';
const STAR_PROJECTILE_POOL_SIZE = 6;
const STAR_PROJECTILE_TRAIL_TEXTURES = [STAR_PROJECTILE_TEXTURE, 'inhale-sparkle'] as const;
const STAR_PROJECTILE_FALLBACK_COLOR = '#FFD966';
const STAR_PROJECTILE_STEP_INTERVAL = 100;
const STAR_PROJECTILE_STEP_DISTANCE = (STAR_PROJECTILE_SPEED * STAR_PROJECTILE_STEP_INTERVAL) / 1000;
const STAR_PROJECTILE_STEP_COUNT = Math.max(1, Math.ceil(STAR_PROJECTILE_LIFETIME_MS / STAR_PROJECTILE_STEP_INTERVAL));

type TextureManagerLike = {
  exists?: (key: string) => boolean;
};

type CanvasContextLike = {
  fillStyle?: string;
  fillRect?: (x: number, y: number, width: number, height: number) => unknown;
};

type CanvasTextureLike = {
  fill?: (red: number, green: number, blue: number, alpha?: number) => unknown;
  refresh?: () => unknown;
  canvas?: { getContext?: (contextType: string) => CanvasContextLike | null };
  getContext?: (contextType: string) => CanvasContextLike | null;
  getCanvas?: () => { getContext?: (contextType: string) => CanvasContextLike | null };
  context?: CanvasContextLike | null;
};

type TextureManagerWithCanvas = TextureManagerLike & {
  createCanvas?: (key: string, width: number, height: number) => CanvasTextureLike | undefined;
};

export class SwallowSystem {
  private swallowedPayload?: SwallowedPayload;
  private readonly starProjectilePool: ObjectPool<Phaser.Physics.Matter.Sprite>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kirdy: Kirdy,
    private readonly inhaleSystem: InhaleSystem,
    private readonly physicsSystem?: PhysicsSystem,
  ) {
    this.starProjectilePool = new ObjectPool<Phaser.Physics.Matter.Sprite>({
      create: () => {
        ensureStarProjectileTexture(this.scene);
        const sprite = spawnStarProjectileSprite(this.scene, 0, 0);
        if (!sprite) {
          throw new Error('Failed to create star projectile');
        }

        sprite.setActive?.(false);
        sprite.setVisible?.(false);
        sprite.setData?.('pooledProjectile', true);
        return sprite;
      },
      onAcquire: (sprite) => {
        sprite.setActive?.(true);
        sprite.setVisible?.(true);
        sprite.setData?.('pooledProjectile', true);
      },
      onRelease: (sprite) => {
        sprite.setVelocity?.(0, 0);
        sprite.setActive?.(false);
        sprite.setVisible?.(false);
        sprite.setPosition?.(-10000, -10000);
        sprite.setOnCollide?.(() => undefined);
        sprite.setData?.('starProjectileExpire', undefined);
        sprite.setData?.('starProjectileTrailTeardown', undefined);
      },
      maxSize: STAR_PROJECTILE_POOL_SIZE,
    });
  }

  update(actions: ActionStateMap) {
    const mouthContent = this.kirdy.getMouthContent?.();
    if (!mouthContent) {
      return;
    }

    if (actions.swallow?.justPressed) {
      this.handleSwallow(mouthContent);
      return;
    }

    if (actions.spit?.justPressed) {
      this.handleSpit(mouthContent);
    }
  }

  consumeSwallowedPayload() {
    const payload = this.swallowedPayload;
    this.swallowedPayload = undefined;
    return payload;
  }

  private handleSwallow(target: Phaser.Physics.Matter.Sprite) {
    this.scene.sound?.play?.('kirdy-swallow');
    this.kirdy.sprite.anims?.play?.('kirdy-swallow', true);

    target.setData?.('inMouth', false);

    const ability = AbilitySystem.copyAbility(target);
    this.swallowedPayload = ability ? { abilityType: ability.type, ability } : undefined;
    if (ability) {
      this.scene.events?.emit?.('enemy-swallowed', { sprite: target, abilityType: ability.type, ability });
    } else {
      this.scene.events?.emit?.('enemy-swallowed', { sprite: target });
    }

    target.destroy?.();
    this.inhaleSystem.releaseCapturedTarget();
  }

  private handleSpit(target: Phaser.Physics.Matter.Sprite) {
    this.scene.sound?.play?.('kirdy-spit');
    const facingLeft = this.kirdy.sprite.flipX === true;
    const direction = facingLeft ? -1 : 1;
    const spawnPosition = resolveForwardSpawnPosition(this.kirdy.sprite, direction);
    let projectile: Phaser.Physics.Matter.Sprite | undefined;
    try {
      projectile = this.acquireStarProjectile(spawnPosition.x, spawnPosition.y);
    } catch (error) {
      console.warn('[SwallowSystem] failed to prepare star projectile', error);
      projectile = undefined;
    }
    let projectileTrailTeardown: (() => void) | undefined;
    let cleanupTrail: (() => void) | undefined;
    let cancelStarMotion: (() => void) | undefined;
    let lifetimeTimer: { remove?: () => void } | undefined;

    if (projectile) {
      try {
        applyStarProjectilePhysics(projectile);
        projectile.setPosition?.(spawnPosition.x, spawnPosition.y);
        projectileTrailTeardown = attachProjectileTrail(this.scene, projectile, {
          textureKeys: STAR_PROJECTILE_TRAIL_TEXTURES,
        });
      } catch (error) {
        console.warn('[SwallowSystem] failed to prepare star projectile', error);
        cancelStarMotion?.();
        this.disposeFailedProjectile(projectile);
        projectile = undefined;
      }
    }

    if (projectile) {
      const preparedProjectile = projectile;
      cleanupTrail = () => {
        if (!projectileTrailTeardown) {
          return;
        }
        const teardown = projectileTrailTeardown;
        projectileTrailTeardown = undefined;
        teardown();
        preparedProjectile.setData?.('starProjectileTrailTeardown', undefined);
      };
      preparedProjectile.setData?.('starProjectileTrailTeardown', cleanupTrail);

      cancelStarMotion = this.startStarProjectileMotion({
        projectile: preparedProjectile,
        spawnX: spawnPosition.x,
        spawnY: this.kirdy.sprite.y ?? spawnPosition.y,
        direction,
        onComplete: () => {
          cleanupTrail?.();
          this.destroyProjectileSafely(preparedProjectile);
        },
      });
      preparedProjectile.setData?.('starProjectileMotionCancel', cancelStarMotion);

      preparedProjectile.setOnCollide?.(() => this.handleStarProjectileCollision(preparedProjectile));

      const isPooled = preparedProjectile.getData?.('pooledProjectile') === true;
      if (!isPooled) {
        preparedProjectile.once?.('destroy', () => {
          this.scene.events?.emit?.('star-projectile-destroyed', preparedProjectile);
        });
      }

      let registered = true;
      try {
        this.physicsSystem?.registerPlayerAttack(preparedProjectile, {
          damage: STAR_PROJECTILE_DAMAGE,
          recycle: (candidate) => this.recycleStarProjectile(candidate),
        });
        preparedProjectile.setCollisionCategory?.(PhysicsCategory.PlayerAttack);
        preparedProjectile.setCollidesWith?.(PhysicsCategory.Enemy);
      } catch (error) {
        registered = false;
        console.warn('[SwallowSystem] failed to register star projectile', error);
        cancelStarMotion?.();
        preparedProjectile.setData?.('starProjectileMotionCancel', undefined);
        cleanupTrail?.();
        this.destroyProjectileSafely(preparedProjectile);
      }

      if (registered) {
        lifetimeTimer = this.scene.time?.delayedCall?.(STAR_PROJECTILE_LIFETIME_MS, () => {
          this.stopStarProjectileMotion(preparedProjectile);
          cleanupTrail?.();
          this.destroyProjectileSafely(preparedProjectile);
        });
        preparedProjectile.setData?.('starProjectileExpire', lifetimeTimer);
      }
    }

    target.setData?.('inMouth', false);
    target.destroy?.();
    this.inhaleSystem.releaseCapturedTarget();
  }

  private startStarProjectileMotion(options: {
    projectile: Phaser.Physics.Matter.Sprite;
    spawnX: number;
    spawnY: number;
    direction: number;
    onComplete: () => void;
  }) {
    let stopped = false;
    const motionTimers: Array<{ remove?: () => void }> = [];

    const scheduleStep = (currentStep: number) => {
      const executeStep = () => {
        if (stopped) {
          return;
        }

        const nextStep = currentStep + 1;
        const offsetX = options.direction * STAR_PROJECTILE_STEP_DISTANCE * nextStep;
        options.projectile.setPosition?.(options.spawnX + offsetX, options.spawnY);

        if (nextStep >= STAR_PROJECTILE_STEP_COUNT) {
          stopped = true;
          options.projectile.setData?.('starProjectileMotionCancel', undefined);
          options.onComplete();
        } else {
          scheduleStep(nextStep);
        }
      };

      const timer = this.scene.time?.delayedCall?.(STAR_PROJECTILE_STEP_INTERVAL, executeStep);
      if (timer) {
        motionTimers.push(timer);
      } else {
        executeStep();
      }
    };

    options.projectile.setPosition?.(options.spawnX, options.spawnY);
    scheduleStep(0);

    const cancel = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      motionTimers.forEach((timer) => timer?.remove?.());
      options.projectile.setData?.('starProjectileMotionCancel', undefined);
    };

    options.projectile.once?.('destroy', () => cancel());

    return cancel;
  }

  private acquireStarProjectile(x: number, y: number) {
    try {
      const projectile = this.starProjectilePool.acquire();
      projectile.setPosition?.(x, y);
      projectile.setData?.('pooledProjectile', true);
      return projectile;
    } catch (error) {
      let fallback: Phaser.Physics.Matter.Sprite | undefined;
      try {
        ensureStarProjectileTexture(this.scene);
        fallback = spawnStarProjectileSprite(this.scene, x, y) ?? undefined;
      } catch (creationError) {
        console.warn('[SwallowSystem] failed to spawn star projectile', { error, creationError });
        return undefined;
      }

      if (fallback) {
        fallback.setData?.('pooledProjectile', false);
      }
      return fallback;
    }
  }

  private handleStarProjectileCollision(projectile: Phaser.Physics.Matter.Sprite) {
    if (this.physicsSystem) {
      // Let PhysicsSystem handle the collision so damage can be applied before cleanup.
      return;
    }

    this.destroyProjectileSafely(projectile);
  }

  private destroyProjectileSafely(projectile: Phaser.Physics.Matter.Sprite) {
    this.clearStarProjectileLifetime(projectile);
    this.stopStarProjectileMotion(projectile);
    this.cleanupStarProjectileTrail(projectile);
    if (this.physicsSystem) {
      try {
        this.physicsSystem.destroyProjectile(projectile);
        return;
      } catch (error) {
        console.warn('[SwallowSystem] failed to destroy star projectile', error);
      }
    }

    const recycled = this.recycleStarProjectile(projectile);
    if (!recycled) {
      projectile.destroy?.();
    }
  }

  private disposeFailedProjectile(projectile: Phaser.Physics.Matter.Sprite) {
    this.clearStarProjectileLifetime(projectile);
    this.stopStarProjectileMotion(projectile);
    this.cleanupStarProjectileTrail(projectile);
    try {
      projectile.setData?.('pooledProjectile', false);
    } catch {
      // ignore data sync issues for failed projectile disposal
    }

    try {
      projectile.setActive?.(false);
      projectile.setVisible?.(false);
    } catch {
      // ignore visibility toggles if the sprite is already torn down
    }

    try {
      projectile.destroy?.();
    } catch (error) {
      console.warn('[SwallowSystem] failed to dispose star projectile', error);
    }
  }

  private recycleStarProjectile(projectile: MatterGameObject) {
    this.clearStarProjectileLifetime(projectile as Phaser.Physics.Matter.Sprite);

    const sprite = projectile as Phaser.Physics.Matter.Sprite;
    this.stopStarProjectileMotion(sprite);
    this.cleanupStarProjectileTrail(sprite);

    this.scene.events?.emit?.('star-projectile-destroyed', projectile);

    const isPooled = projectile.getData?.('pooledProjectile') === true;
    if (!isPooled) {
      return false;
    }

    projectile.setVelocity?.(0, 0);
    projectile.setActive?.(false);
    projectile.setVisible?.(false);
    projectile.setPosition?.(-10000, -10000);
    projectile.setOnCollide?.(() => undefined);
    projectile.setData?.('starProjectileTrailTeardown', undefined);
    projectile.setData?.('starProjectileMotionCancel', undefined);
    this.starProjectilePool.release(projectile as Phaser.Physics.Matter.Sprite);
    return true;
  }

  private cleanupStarProjectileTrail(projectile: { getData?: (key: string) => unknown } | Phaser.Physics.Matter.Sprite) {
    const cleanup = (projectile as Phaser.Physics.Matter.Sprite)?.getData?.('starProjectileTrailTeardown');
    if (typeof cleanup === 'function') {
      cleanup();
      (projectile as Phaser.Physics.Matter.Sprite)?.setData?.('starProjectileTrailTeardown', undefined);
    }
  }

  private stopStarProjectileMotion(projectile?: Phaser.Physics.Matter.Sprite) {
    const cancel = projectile?.getData?.('starProjectileMotionCancel');
    if (typeof cancel === 'function') {
      cancel();
      projectile?.setData?.('starProjectileMotionCancel', undefined);
    }
  }

  private clearStarProjectileLifetime(projectile?: Phaser.Physics.Matter.Sprite | MatterGameObject) {
    const timer = projectile?.getData?.('starProjectileExpire') as { remove?: () => void } | undefined;
    timer?.remove?.();
    projectile?.setData?.('starProjectileExpire', undefined);
  }
}

function applyStarProjectilePhysics(sprite?: Phaser.Physics.Matter.Sprite) {
  if (!sprite) {
    return;
  }

  sprite.setIgnoreGravity?.(true);
  sprite.setFixedRotation?.();
  sprite.setName?.('kirdy-star-projectile');
  sprite.setSensor?.(true);
  sprite.setCollidesWith?.(PhysicsCategory.Enemy);
  configureProjectileHitbox(sprite);
}

function spawnStarProjectileSprite(scene: Phaser.Scene, x: number, y: number) {
  ensureStarProjectileTexture(scene);
  return scene.matter?.add?.sprite?.(x, y, STAR_PROJECTILE_TEXTURE);
}

function ensureStarProjectileTexture(scene: Phaser.Scene) {
  const textures = scene?.textures as TextureManagerWithCanvas | undefined;
  if (!textures || textures.exists?.(STAR_PROJECTILE_TEXTURE)) {
    return;
  }

  if (typeof textures.createCanvas !== 'function') {
    return;
  }

  const size = 8;
  const canvasTexture = textures.createCanvas(STAR_PROJECTILE_TEXTURE, size, size);
  if (!canvasTexture) {
    return;
  }

  const { red, green, blue } = parseHexColor(STAR_PROJECTILE_FALLBACK_COLOR);

  if (typeof canvasTexture.fill === 'function') {
    canvasTexture.fill(red, green, blue);
  } else {
    const fallbackCanvas = canvasTexture.getCanvas?.();
    const context =
      canvasTexture.context ??
      canvasTexture.getContext?.('2d') ??
      canvasTexture.canvas?.getContext?.('2d') ??
      fallbackCanvas?.getContext?.('2d');
    if (context) {
      if (typeof context.fillStyle === 'string') {
        context.fillStyle = STAR_PROJECTILE_FALLBACK_COLOR;
      }
      context.fillRect?.(0, 0, size, size);
    }
  }

  canvasTexture.refresh?.();
}

function parseHexColor(color: string) {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return { red: 255, green: 255, blue: 255 };
  }
  return {
    red: (parsed >> 16) & 0xff,
    green: (parsed >> 8) & 0xff,
    blue: parsed & 0xff,
  };
}
