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

const MOVE_SPEED = 20;
const JUMP_SPEED = 40;
const HOVER_ASCENT_SPEED = -20;
const GROUND_VELOCITY_TOLERANCE = 1;

type KirdyAnimationKey =
  | 'kirdy-idle'
  | 'kirdy-run'
  | 'kirdy-jump'
  | 'kirdy-hover'
  | 'kirdy-inhale'
  | 'kirdy-swallow'
  | 'kirdy-spit';

export class Kirdy {
  public readonly sprite: Phaser.Physics.Matter.Sprite;
  private previousJumpPressed = false;
  private grounded = false;
  private currentAnimation?: string;
  private mouthContent?: Phaser.Physics.Matter.Sprite;

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
    let animationKey: KirdyAnimationKey | undefined;

    if (wantsToJump && this.grounded) {
      this.sprite.setVelocityY(-JUMP_SPEED);
      this.grounded = false;
      animationKey = 'kirdy-jump';
    } else if (!this.grounded && input.hoverPressed) {
      let targetVelocityY = bodyVelocity.y;
      if (bodyVelocity.y > 0) {
        targetVelocityY = HOVER_ASCENT_SPEED;
      } else if (bodyVelocity.y < HOVER_ASCENT_SPEED) {
        targetVelocityY = HOVER_ASCENT_SPEED;
      }

      if (targetVelocityY !== bodyVelocity.y) {
        this.sprite.setVelocityY(targetVelocityY);
      }
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

  private playAnimation(key: KirdyAnimationKey) {
    if (!this.sprite.anims?.play) {
      return;
    }

    let targetKey: KirdyAnimationKey = key;

    const animationManager = this.sprite.anims.animationManager;
    if (animationManager?.exists) {
      const hasTarget = animationManager.exists(targetKey);
      const fallbackKey: KirdyAnimationKey = 'kirdy-idle';

      if (!hasTarget) {
        if (targetKey !== fallbackKey && animationManager.exists(fallbackKey)) {
          targetKey = fallbackKey;
        } else {
          return;
        }
      }
    }

    if (this.currentAnimation === targetKey) {
      return;
    }

    this.sprite.anims.play(targetKey, true);
    this.currentAnimation = targetKey;
  }

  setMouthContent(target?: Phaser.Physics.Matter.Sprite) {
    this.mouthContent = target;
  }

  getMouthContent() {
    return this.mouthContent;
  }
}

export function createKirdy(scene: Phaser.Scene, spawn: KirdySpawnConfig) {
  const textureKey = resolvePrimaryTextureKey(scene);

  const sprite = scene.matter.add.sprite(spawn.x, spawn.y, textureKey, undefined, {
    label: 'kirdy-body',
  });

  sprite.setFixedRotation();
  sprite.setIgnoreGravity(false);
  sprite.setFrictionAir(0.02);
  sprite.setName('Kirdy');
  sprite.setScale?.(0.3);

  registerAnimations(scene);

  return new Kirdy(sprite);
}

function registerAnimations(scene: Phaser.Scene) {
  const animations: Array<{
    key: KirdyAnimationKey;
    frameRate: number;
    repeat: number;
    textureCandidates: string[];
  }> = [
    { key: 'kirdy-idle', frameRate: 6, repeat: -1, textureCandidates: ['kirdy', 'kirdy-idle'] },
    { key: 'kirdy-run', frameRate: 12, repeat: -1, textureCandidates: ['kirdy-run', 'kirdy'] },
    { key: 'kirdy-jump', frameRate: 0, repeat: 0, textureCandidates: ['kirdy-jump', 'kirdy'] },
    { key: 'kirdy-hover', frameRate: 8, repeat: -1, textureCandidates: ['kirdy-hover', 'kirdy'] },
    { key: 'kirdy-inhale', frameRate: 10, repeat: -1, textureCandidates: ['kirdy-inhale', 'kirdy'] },
    { key: 'kirdy-swallow', frameRate: 12, repeat: 0, textureCandidates: ['kirdy-swallow', 'kirdy'] },
    { key: 'kirdy-spit', frameRate: 12, repeat: 0, textureCandidates: ['kirdy-spit', 'kirdy'] },
  ];

  animations.forEach((config) => {
    if (scene.anims?.exists?.(config.key)) {
      return;
    }

    const frames = resolveFrames(scene, config.textureCandidates);
    if (frames.length === 0) {
      return;
    }

    scene.anims?.create?.({
      key: config.key,
      frames,
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  });
}

function resolveFrames(
  scene: Phaser.Scene,
  textureCandidates: string[],
): Phaser.Types.Animations.AnimationFrame[] {
  const textures = (scene as any).textures;
  if (!textures) {
    return [];
  }

  for (const candidate of textureCandidates) {
    if (typeof textures.exists === 'function' && !textures.exists(candidate)) {
      continue;
    }

    const texture = textures.get?.(candidate);
    if (!texture) {
      continue;
    }

    const frameNamesSource =
      typeof texture.getFrameNames === 'function'
        ? texture.getFrameNames()
        : Object.keys(texture.frames ?? {});

    const frameNames = Array.isArray(frameNamesSource) ? [...frameNamesSource] : [];

    if (frameNames.length === 0 && texture.frames && texture.frames.__BASE) {
      frameNames.push('__BASE');
    }

    const uniqueNames: string[] = [];
    const seen = new Set<string>();

    frameNames.forEach((name) => {
      if (typeof name === 'string' && name.length > 0 && !seen.has(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    });

    if (uniqueNames.length === 0) {
      continue;
    }

    return uniqueNames.map((frame) => ({ key: candidate, frame }));
  }

  return [];
}

function resolvePrimaryTextureKey(scene: Phaser.Scene): string {
  const textures = (scene as any).textures;
  if (textures?.exists?.('kirdy')) {
    return 'kirdy';
  }

  if (textures?.exists?.('kirdy-idle')) {
    return 'kirdy-idle';
  }

  return 'kirdy';
}
