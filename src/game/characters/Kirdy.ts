import Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';

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

export interface KirdyOptions {
  maxHP?: number;
  initialHP?: number;
  score?: number;
  ability?: AbilityType;
}

export interface KirdyStatsSnapshot {
  hp: number;
  maxHP: number;
  score: number;
  ability?: AbilityType;
}

export type KirdyMoveDirection = 'left' | 'right' | 'none';

const MOVE_SPEED = 10;
const JUMP_SPEED = 20;
const HOVER_ASCENT_SPEED = -10;
const GROUND_VELOCITY_TOLERANCE = 1;
const DEFAULT_MAX_HP = 6;

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
  private hitPoints: number;
  private maxHitPoints: number;
  private score: number;
  private currentAbility?: AbilityType;
  private hovering = false;

  constructor(sprite: Phaser.Physics.Matter.Sprite, options: KirdyOptions = {}) {
    this.sprite = sprite;
    const normalizedMax = normalizePositive(options.maxHP ?? DEFAULT_MAX_HP, DEFAULT_MAX_HP);
    this.maxHitPoints = normalizedMax;
    this.hitPoints = clampInt(options.initialHP ?? normalizedMax, 0, normalizedMax);
    this.score = Math.max(0, Math.floor(options.score ?? 0));
    this.currentAbility = options.ability;
    if (this.currentAbility) {
      this.sprite.setData?.('equippedAbility', this.currentAbility);
    }
  }

  update(_time: number, _delta: number, input: KirdyInputState) {
    const direction = this.resolveMoveDirection(input);
    const bodyVelocity = this.sprite.body?.velocity ?? { x: 0, y: 0 };

    this.move(direction);
    this.refreshGroundedState(bodyVelocity);

    const wantsToJump = input.jumpPressed && !this.previousJumpPressed;

    if (wantsToJump) {
      const jumped = this.jump();
      if (jumped) {
        this.previousJumpPressed = input.jumpPressed;
        return;
      }
    }

    const verticalVelocity = this.sprite.body?.velocity?.y ?? 0;

    if (!this.grounded && input.hoverPressed) {
      this.startHover();
    } else {
      this.stopHover();
    }

    if (this.hovering) {
      this.playAnimation('kirdy-hover');
    } else if (!this.grounded) {
      this.playAnimation('kirdy-jump');
    } else if (direction !== 'none') {
      this.playAnimation('kirdy-run');
    } else {
      this.playAnimation('kirdy-idle');
    }

    this.previousJumpPressed = input.jumpPressed;
  }

  move(direction: KirdyMoveDirection) {
    let velocityX = 0;
    if (direction === 'left') {
      velocityX = -MOVE_SPEED;
      this.sprite.setFlipX(true);
    } else if (direction === 'right') {
      velocityX = MOVE_SPEED;
      this.sprite.setFlipX(false);
    }

    this.sprite.setVelocityX(velocityX);
    return velocityX;
  }

  jump() {
    if (!this.isGrounded()) {
      return false;
    }

    this.stopHover();
    this.sprite.setVelocityY(-JUMP_SPEED);
    this.grounded = false;
    this.playAnimation('kirdy-jump');
    return true;
  }

  startHover() {
    if (!this.hovering) {
      this.sprite.setIgnoreGravity?.(true);
    }

    const bodyVelocity = this.sprite.body?.velocity ?? { x: 0, y: 0 };
    if (bodyVelocity.y !== HOVER_ASCENT_SPEED) {
      this.sprite.setVelocityY(HOVER_ASCENT_SPEED);
    }

    this.grounded = false;
    this.hovering = true;
    this.playAnimation('kirdy-hover');
  }

  stopHover() {
    if (this.hovering) {
      this.sprite.setIgnoreGravity?.(false);
    }

    this.hovering = false;
  }

  inhale() {
    this.playAnimation('kirdy-inhale');
  }

  swallow() {
    this.playAnimation('kirdy-swallow');
  }

  spit() {
    this.playAnimation('kirdy-spit');
  }

  useAbility() {
    return this.currentAbility;
  }

  getHP() {
    return this.hitPoints;
  }

  getMaxHP() {
    return this.maxHitPoints;
  }

  setHP(value: number) {
    this.hitPoints = clampInt(value, 0, this.maxHitPoints);
    return this.hitPoints;
  }

  setMaxHP(value: number) {
    this.maxHitPoints = normalizePositive(value, this.maxHitPoints);
    if (this.hitPoints > this.maxHitPoints) {
      this.hitPoints = this.maxHitPoints;
    }
    return this.maxHitPoints;
  }

  takeDamage(amount: number) {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return this.hitPoints;
    }

    this.hitPoints = Math.max(0, this.hitPoints - normalized);
    return this.hitPoints;
  }

  heal(amount: number) {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return this.hitPoints;
    }

    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + normalized);
    return this.hitPoints;
  }

  addScore(amount: number) {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) {
      return this.score;
    }

    this.score += normalized;
    return this.score;
  }

  setScore(value: number) {
    this.score = Math.max(0, Math.floor(value));
    return this.score;
  }

  getScore() {
    return this.score;
  }

  setAbility(ability?: AbilityType) {
    this.currentAbility = ability;
    if (ability) {
      this.sprite.setData?.('equippedAbility', ability);
    } else {
      this.sprite.setData?.('equippedAbility', undefined);
    }
    return this.currentAbility;
  }

  clearAbility() {
    this.setAbility(undefined);
  }

  getAbility() {
    return this.currentAbility;
  }

  toStatsSnapshot(): KirdyStatsSnapshot {
    return {
      hp: this.hitPoints,
      maxHP: this.maxHitPoints,
      score: this.score,
      ability: this.currentAbility,
    };
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

  private resolveMoveDirection(input: KirdyInputState): KirdyMoveDirection {
    if (input.left && !input.right) {
      return 'left';
    }

    if (input.right && !input.left) {
      return 'right';
    }

    return 'none';
  }

  private refreshGroundedState(bodyVelocity: { x: number; y: number }) {
    const physicsGrounded = this.sprite.getData?.('isGrounded');
    if (physicsGrounded === true) {
      this.grounded = true;
      this.stopHover();
      return;
    }

    if (physicsGrounded === false) {
      this.grounded = false;
    }

    const isNearlyStationaryVertically = Math.abs(bodyVelocity.y) <= GROUND_VELOCITY_TOLERANCE;
    if (isNearlyStationaryVertically && bodyVelocity.y === 0) {
      this.grounded = true;
      this.stopHover();
      return;
    }

    if (!isNearlyStationaryVertically && bodyVelocity.y < 0) {
      this.grounded = false;
      return;
    }

    if (bodyVelocity.y > GROUND_VELOCITY_TOLERANCE) {
      this.grounded = false;
    }
  }

  private isGrounded() {
    const physicsGrounded = this.sprite.getData?.('isGrounded');
    if (physicsGrounded === true) {
      this.grounded = true;
    } else if (physicsGrounded === false) {
      this.grounded = false;
    }

    return this.grounded;
  }
}

export function createKirdy(scene: Phaser.Scene, spawn: KirdySpawnConfig, options: KirdyOptions = {}) {
  const textureKey = resolvePrimaryTextureKey(scene);

  const sprite = scene.matter.add.sprite(spawn.x, spawn.y, textureKey, undefined, {
    label: 'kirdy-body',
  });

  sprite.setFixedRotation();
  sprite.setIgnoreGravity(false);
  sprite.setFriction?.(0, 0, 0);
  sprite.setFrictionStatic?.(0);
  sprite.setFrictionAir(0.02);
  sprite.setName('Kirdy');
  sprite.setScale?.(0.3);

  registerAnimations(scene);

  return new Kirdy(sprite, options);
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  const normalized = Math.floor(value);
  if (normalized < min) {
    return min;
  }

  if (normalized > max) {
    return max;
  }

  return normalized;
}

function normalizePositive(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return Math.max(1, Math.floor(fallback));
  }

  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return Math.max(1, Math.floor(fallback));
  }

  return normalized;
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
