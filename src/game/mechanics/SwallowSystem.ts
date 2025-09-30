import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { ActionStateMap, InhaleSystem } from './InhaleSystem';
import type { PhysicsSystem } from '../physics/PhysicsSystem';

export interface SwallowedPayload {
  abilityType?: string;
}

const STAR_PROJECTILE_SPEED = 350;
const STAR_PROJECTILE_LIFETIME_MS = 1200;
const STAR_PROJECTILE_DAMAGE = 2;

export class SwallowSystem {
  private swallowedPayload?: SwallowedPayload;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kirdy: Kirdy,
    private readonly inhaleSystem: InhaleSystem,
    private readonly physicsSystem?: PhysicsSystem,
  ) {}

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
    const projectile = this.scene.matter?.add?.sprite?.(spawnX, spawnY, 'star-bullet');

    if (projectile) {
      projectile.setIgnoreGravity?.(true);
      projectile.setFixedRotation?.();
      projectile.setName?.('kirdy-star-projectile');
      const velocityX = facingLeft ? -STAR_PROJECTILE_SPEED : STAR_PROJECTILE_SPEED;
      projectile.setVelocityX?.(velocityX);
      projectile.setOnCollide?.(() => {
        if (this.physicsSystem) {
          this.physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      });
      projectile.once?.('destroy', () => {
        this.scene.events?.emit?.('star-projectile-destroyed', projectile);
      });
      this.scene.time?.delayedCall?.(STAR_PROJECTILE_LIFETIME_MS, () => {
        if (this.physicsSystem) {
          this.physicsSystem.destroyProjectile(projectile);
        } else {
          projectile.destroy?.();
        }
      });
      this.physicsSystem?.registerPlayerAttack(projectile, { damage: STAR_PROJECTILE_DAMAGE });
    }

    target.setData?.('inMouth', false);
    target.destroy?.();
    this.inhaleSystem.releaseCapturedTarget();
  }
}
