import type Phaser from 'phaser';
import type { Kirdy } from '../characters/Kirdy';
import type { InputButtonState, PlayerAction } from '../input/PlayerInputManager';

const INHALE_HORIZONTAL_RANGE = 96;
const INHALE_VERTICAL_RANGE = 48;

type ParticleEffect = {
  startFollow?: (target: Phaser.GameObjects.GameObject) => void;
  stop?: () => void;
  destroy?: () => void;
  setDepth?: (value: number) => void;
};

export type ActionStateMap = Record<PlayerAction, InputButtonState>;

export class InhaleSystem {
  private isInhaling = false;
  private inhalableTargets: Phaser.Physics.Matter.Sprite[] = [];
  private capturedTarget?: Phaser.Physics.Matter.Sprite;
  private inhaleEffect?: ParticleEffect;

  constructor(private readonly scene: Phaser.Scene, private readonly kirdy: Kirdy) {}

  update(actions: ActionStateMap) {
    this.alignCapturedTarget();
    const inhaleState = actions.inhale;

    if (!inhaleState?.isDown) {
      this.stopInhale();
      return;
    }

    if (inhaleState.justPressed || !this.isInhaling) {
      this.startInhale();
    } else {
      this.ensureInhaleEffect();
    }

    this.kirdy.sprite.anims?.play?.('kirdy-inhale', true);

    if (!this.capturedTarget) {
      this.captureClosestTarget();
    }

    this.alignCapturedTarget();
  }

  setInhalableTargets(targets: Phaser.Physics.Matter.Sprite[]) {
    this.inhalableTargets = targets;
  }

  addInhalableTarget(target: Phaser.Physics.Matter.Sprite) {
    this.inhalableTargets.push(target);
  }

  getCapturedTarget() {
    return this.capturedTarget;
  }

  releaseCapturedTarget() {
    this.capturedTarget = undefined;
    this.kirdy.setMouthContent?.(undefined);
  }

  private startInhale() {
    this.isInhaling = true;
    this.kirdy.sprite.anims?.play?.('kirdy-inhale', true);
    this.scene.sound?.play?.('kirdy-inhale');
    this.ensureInhaleEffect();
    this.captureClosestTarget();
  }

  private stopInhale() {
    if (!this.isInhaling) {
      return;
    }

    this.isInhaling = false;
    this.teardownEffect();
  }

  private ensureInhaleEffect() {
    if (this.inhaleEffect || !this.scene.add?.particles) {
      return;
    }

    const effect = this.scene.add.particles('inhale-sparkle');
    effect?.startFollow?.(this.kirdy.sprite as unknown as Phaser.GameObjects.GameObject);
    effect?.setDepth?.(1000);
    this.inhaleEffect = effect ?? undefined;
  }

  private teardownEffect() {
    this.inhaleEffect?.stop?.();
    this.inhaleEffect?.destroy?.();
    this.inhaleEffect = undefined;
  }

  private captureClosestTarget() {
    const candidate = this.findCaptureCandidate();
    if (!candidate) {
      return;
    }

    this.capturedTarget = candidate;

    candidate.setVelocity?.(0, 0);
    candidate.setIgnoreGravity?.(true);
    candidate.setStatic?.(true);
    candidate.setActive?.(false);
    candidate.setVisible?.(false);
    candidate.setData?.('inMouth', true);
    candidate.setPosition?.(this.kirdy.sprite.x, this.kirdy.sprite.y);

    this.kirdy.setMouthContent?.(candidate);

    this.inhalableTargets = this.inhalableTargets.filter((target) => target !== candidate);
  }

  private alignCapturedTarget() {
    if (!this.capturedTarget) {
      return;
    }

    this.capturedTarget.setPosition?.(this.kirdy.sprite.x, this.kirdy.sprite.y);
  }

  private findCaptureCandidate() {
    const originX = this.kirdy.sprite.x ?? 0;
    const originY = this.kirdy.sprite.y ?? 0;
    const facingLeft = this.kirdy.sprite.flipX === true;

    const viable = this.inhalableTargets.filter((target) => {
      if (target?.active === false) {
        return false;
      }

      const targetX = target?.x ?? target?.body?.position?.x ?? 0;
      const targetY = target?.y ?? target?.body?.position?.y ?? 0;
      const deltaX = targetX - originX;
      const deltaY = Math.abs(targetY - originY);

      if (deltaY > INHALE_VERTICAL_RANGE) {
        return false;
      }

      if (facingLeft) {
        return deltaX <= 0 && deltaX >= -INHALE_HORIZONTAL_RANGE;
      }

      return deltaX >= 0 && deltaX <= INHALE_HORIZONTAL_RANGE;
    });

    viable.sort((a, b) => {
      const ax = a?.x ?? a?.body?.position?.x ?? 0;
      const bx = b?.x ?? b?.body?.position?.x ?? 0;
      return Math.abs(ax - originX) - Math.abs(bx - originX);
    });

    return viable[0];
  }
}
