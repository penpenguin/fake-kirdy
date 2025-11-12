import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap, InhaleSystem } from './InhaleSystem';
import type { PhysicsSystem, MatterGameObject } from '../physics/PhysicsSystem';
import { AbilitySystem } from './AbilitySystem';
import type { AbilityMetadata } from './AbilitySystem';
import { ObjectPool } from '../performance/ObjectPool';
import { configureProjectileHitbox, resolveForwardSpawnPosition } from './projectilePlacement';

export interface SwallowedPayload {
  abilityType?: string;
  ability?: AbilityMetadata;
}

const STAR_PROJECTILE_SPEED = 350;
const STAR_PROJECTILE_LIFETIME_MS = 1200;
const STAR_PROJECTILE_DAMAGE = 3;
const STAR_PROJECTILE_TEXTURE = 'star-bullet';
const STAR_PROJECTILE_POOL_SIZE = 6;

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
        const sprite = this.scene.matter?.add?.sprite?.(0, 0, STAR_PROJECTILE_TEXTURE);
        if (!sprite) {
          throw new Error('Failed to create star projectile');
        }

        sprite.setIgnoreGravity?.(true);
        sprite.setFixedRotation?.();
        sprite.setName?.('kirdy-star-projectile');
        sprite.setActive?.(false);
        sprite.setVisible?.(false);
        sprite.setData?.('pooledProjectile', true);
        sprite.setSensor?.(true);
        configureProjectileHitbox(sprite);
        return sprite;
      },
      onAcquire: (sprite) => {
        sprite.setActive?.(true);
        sprite.setVisible?.(true);
        sprite.setIgnoreGravity?.(true);
        sprite.setFixedRotation?.();
        sprite.setName?.('kirdy-star-projectile');
        sprite.setData?.('pooledProjectile', true);
        sprite.setSensor?.(true);
        configureProjectileHitbox(sprite);
      },
      onRelease: (sprite) => {
        sprite.setVelocity?.(0, 0);
        sprite.setActive?.(false);
        sprite.setVisible?.(false);
        sprite.setPosition?.(-10000, -10000);
        sprite.setOnCollide?.(() => undefined);
        sprite.setData?.('starProjectileExpire', undefined);
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
    let projectile = this.acquireStarProjectile(spawnPosition.x, spawnPosition.y);

    if (projectile) {
      const velocityX = direction * STAR_PROJECTILE_SPEED;
      try {
        projectile.setIgnoreGravity?.(true);
        projectile.setFixedRotation?.();
        projectile.setName?.('kirdy-star-projectile');
        projectile.setSensor?.(true);
        configureProjectileHitbox(projectile);
        projectile.setVelocityX?.(velocityX);
      } catch (error) {
        console.warn('[SwallowSystem] failed to prepare star projectile', error);
        this.disposeFailedProjectile(projectile);
        projectile = undefined;
      }
    }

    if (projectile) {
      const preparedProjectile = projectile;
      preparedProjectile.setOnCollide?.(() => this.handleStarProjectileCollision(preparedProjectile));

      const isPooled = preparedProjectile.getData?.('pooledProjectile') === true;
      if (!isPooled) {
        preparedProjectile.once?.('destroy', () => {
          this.scene.events?.emit?.('star-projectile-destroyed', preparedProjectile);
        });
      }

      const lifetime = this.scene.time?.delayedCall?.(STAR_PROJECTILE_LIFETIME_MS, () => {
        this.destroyProjectileSafely(preparedProjectile);
      });

      let registered = true;
      try {
        this.physicsSystem?.registerPlayerAttack(preparedProjectile, {
          damage: STAR_PROJECTILE_DAMAGE,
          recycle: (candidate) => this.recycleStarProjectile(candidate),
        });
      } catch (error) {
        registered = false;
        console.warn('[SwallowSystem] failed to register star projectile', error);
        lifetime?.remove?.();
        this.destroyProjectileSafely(preparedProjectile);
      }

      preparedProjectile.setData?.('starProjectileExpire', registered ? lifetime : undefined);
    }

    target.setData?.('inMouth', false);
    target.destroy?.();
    this.inhaleSystem.releaseCapturedTarget();
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
        fallback = this.scene.matter?.add?.sprite?.(x, y, STAR_PROJECTILE_TEXTURE) ?? undefined;
      } catch (creationError) {
        console.warn('[SwallowSystem] failed to spawn star projectile', { error, creationError });
        return undefined;
      }

      if (fallback) {
        fallback.setIgnoreGravity?.(true);
        fallback.setFixedRotation?.();
        fallback.setName?.('kirdy-star-projectile');
        fallback.setData?.('pooledProjectile', false);
        fallback.setSensor?.(true);
        configureProjectileHitbox(fallback);
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
    const timer = projectile.getData?.('starProjectileExpire') as { remove?: () => void } | undefined;
    timer?.remove?.();
    projectile.setData?.('starProjectileExpire', undefined);

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
    this.starProjectilePool.release(projectile as Phaser.Physics.Matter.Sprite);
    return true;
  }
}
