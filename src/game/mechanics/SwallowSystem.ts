import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap, InhaleSystem } from './InhaleSystem';
import type { PhysicsSystem, MatterGameObject } from '../physics/PhysicsSystem';
import { ObjectPool } from '../performance/ObjectPool';

export interface SwallowedPayload {
  abilityType?: string;
}

const STAR_PROJECTILE_SPEED = 350;
const STAR_PROJECTILE_LIFETIME_MS = 1200;
const STAR_PROJECTILE_DAMAGE = 2;
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
        return sprite;
      },
      onAcquire: (sprite) => {
        sprite.setActive?.(true);
        sprite.setVisible?.(true);
        sprite.setIgnoreGravity?.(true);
        sprite.setFixedRotation?.();
        sprite.setName?.('kirdy-star-projectile');
        sprite.setData?.('pooledProjectile', true);
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

    const abilityType = target.getData?.('abilityType');
    if (abilityType !== undefined) {
      this.swallowedPayload = { abilityType };
    } else {
      this.swallowedPayload = undefined;
    }

    target.destroy?.();
    this.inhaleSystem.releaseCapturedTarget();
  }

  private handleSpit(target: Phaser.Physics.Matter.Sprite) {
    this.scene.sound?.play?.('kirdy-spit');
    const spawnX = this.kirdy.sprite.x ?? 0;
    const spawnY = this.kirdy.sprite.y ?? 0;
    const facingLeft = this.kirdy.sprite.flipX === true;
    const projectile = this.acquireStarProjectile(spawnX, spawnY);

    if (projectile) {
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setName?.('kirdy-star-projectile');
      const velocityX = facingLeft ? -STAR_PROJECTILE_SPEED : STAR_PROJECTILE_SPEED;
      projectile.setVelocityX?.(velocityX);
      projectile.setOnCollide?.(() => this.handleStarProjectileCollision(projectile));

      const isPooled = projectile.getData?.('pooledProjectile') === true;
      if (!isPooled) {
        projectile.once?.('destroy', () => {
          this.scene.events?.emit?.('star-projectile-destroyed', projectile);
        });
      }

      const lifetime = this.scene.time?.delayedCall?.(STAR_PROJECTILE_LIFETIME_MS, () => {
        if (this.physicsSystem) {
          this.physicsSystem.destroyProjectile(projectile);
        } else {
          const recycled = this.recycleStarProjectile(projectile);
          if (!recycled) {
            projectile.destroy?.();
          }
        }
      });

      projectile.setData?.('starProjectileExpire', lifetime);

      this.physicsSystem?.registerPlayerAttack(projectile, {
        damage: STAR_PROJECTILE_DAMAGE,
        recycle: (candidate) => this.recycleStarProjectile(candidate),
      });
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
    } catch {
      const fallback = this.scene.matter?.add?.sprite?.(x, y, STAR_PROJECTILE_TEXTURE);
      if (fallback) {
        fallback.setIgnoreGravity?.(true);
        fallback.setFixedRotation?.();
        fallback.setName?.('kirdy-star-projectile');
        fallback.setData?.('pooledProjectile', false);
      }
      return fallback;
    }
  }

  private handleStarProjectileCollision(projectile: Phaser.Physics.Matter.Sprite) {
    if (this.physicsSystem) {
      this.physicsSystem.destroyProjectile(projectile);
      return;
    }

    const recycled = this.recycleStarProjectile(projectile);
    if (!recycled) {
      projectile.destroy?.();
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
