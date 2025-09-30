import Phaser from 'phaser';

export interface KirdySpawnConfig {
  x: number;
  y: number;
}

export interface KirdyInputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  hoverPressed: boolean;
}

const MOVE_SPEED = 160;
const JUMP_SPEED = 260;
const HOVER_ASCENT_SPEED = -40;
const GROUND_VELOCITY_TOLERANCE = 1;

export class Kirdy {
  public readonly sprite: Phaser.Physics.Matter.Sprite;
  private previousJumpPressed = false;
  private grounded = false;
  private currentAnimation?: string;

  constructor(sprite: Phaser.Physics.Matter.Sprite) {
    this.sprite = sprite;
  }

  update(_time: number, _delta: number, input: KirdyInputState) {
    const bodyVelocity = this.sprite.body?.velocity ?? { x: 0, y: 0 };

    const movingLeft = input.left && !input.right;
    const movingRight = input.right && !input.left;

    let velocityX = 0;
    if (movingLeft) {
      velocityX = -MOVE_SPEED;
      this.sprite.setFlipX(true);
    } else if (movingRight) {
      velocityX = MOVE_SPEED;
      this.sprite.setFlipX(false);
    }

    this.sprite.setVelocityX(velocityX);

    const isNearlyStationaryVertically = Math.abs(bodyVelocity.y) <= GROUND_VELOCITY_TOLERANCE;
    if (isNearlyStationaryVertically && bodyVelocity.y === 0) {
      this.grounded = true;
    }

    if (!isNearlyStationaryVertically && bodyVelocity.y < 0) {
      this.grounded = false;
    }

    if (bodyVelocity.y > GROUND_VELOCITY_TOLERANCE) {
      this.grounded = false;
    }

    const wantsToJump = input.jumpPressed && !this.previousJumpPressed;
    let animationKey: 'kirdy-idle' | 'kirdy-run' | 'kirdy-jump' | 'kirdy-hover' | undefined;

    if (wantsToJump && this.grounded) {
      this.sprite.setVelocityY(-JUMP_SPEED);
      this.grounded = false;
      animationKey = 'kirdy-jump';
    } else if (!this.grounded && input.hoverPressed) {
      const targetVelocityY = Math.min(bodyVelocity.y, HOVER_ASCENT_SPEED);
      this.sprite.setVelocityY(targetVelocityY);
      this.grounded = false;
      animationKey = 'kirdy-hover';
    } else if (!this.grounded) {
      animationKey = 'kirdy-jump';
    } else if (velocityX !== 0) {
      animationKey = 'kirdy-run';
    } else {
      animationKey = 'kirdy-idle';
    }

    if (animationKey) {
      this.playAnimation(animationKey);
    }

    this.previousJumpPressed = input.jumpPressed;
  }

  private playAnimation(key: 'kirdy-idle' | 'kirdy-run' | 'kirdy-jump' | 'kirdy-hover') {
    if (!this.sprite.anims?.play) {
      return;
    }

    if (this.currentAnimation === key) {
      return;
    }

    this.sprite.anims.play(key, true);
    this.currentAnimation = key;
  }
}

export function createKirdy(scene: Phaser.Scene, spawn: KirdySpawnConfig) {
  const sprite = scene.matter.add.sprite(spawn.x, spawn.y, 'kirdy', undefined, {
    label: 'kirdy-body',
  });

  sprite.setFixedRotation();
  sprite.setIgnoreGravity(false);
  sprite.setFrictionAir(0.02);
  sprite.setName('Kirdy');

  registerAnimations(scene);

  return new Kirdy(sprite);
}

function registerAnimations(scene: Phaser.Scene) {
  const animations: Array<{ key: 'kirdy-idle' | 'kirdy-run' | 'kirdy-jump' | 'kirdy-hover'; frameRate: number; repeat: number }> = [
    { key: 'kirdy-idle', frameRate: 6, repeat: -1 },
    { key: 'kirdy-run', frameRate: 12, repeat: -1 },
    { key: 'kirdy-jump', frameRate: 0, repeat: 0 },
    { key: 'kirdy-hover', frameRate: 8, repeat: -1 },
  ];

  animations.forEach((config) => {
    if (scene.anims?.exists?.(config.key)) {
      return;
    }

    scene.anims?.create?.({
      key: config.key,
      frames: [],
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  });
}
