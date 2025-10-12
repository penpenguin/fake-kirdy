import type Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { KIRDY_MOVE_SPEED } from '../characters/Kirdy';

const DEFAULT_ENEMY_SPEED = Math.max(1, KIRDY_MOVE_SPEED / 2);

export type EnemyType = 'wabble-bee' | 'dronto-durt';

export interface EnemySpawn {
  x: number;
  y: number;
}

const WABBLE_BEE_SCALE = 0.65;
const DRONTO_DURT_SCALE = 0.75;
const WABBLE_BEE_BODY = { width: 42, height: 36 };
const DRONTO_DURT_BODY = { width: 48, height: 48 };

type TargetPosition = { x: number; y: number };

type EnemyDisperseContext = { x: number; y: number };

type TargetProvider = () => TargetPosition | undefined;

export interface EnemyCommonOptions {
  maxHP?: number;
  abilityType?: AbilityType;
  getPlayerPosition?: TargetProvider;
}

export interface Enemy {
  sprite: Phaser.Physics.Matter.Sprite;
  update(delta: number): void;
  takeDamage(amount: number): void;
  getHP(): number;
  isDefeated(): boolean;
  getEnemyType(): EnemyType;
  getAbilityType(): AbilityType | undefined;
  onDisperse?(context: EnemyDisperseContext): void;
}

interface BaseEnemyConfig extends EnemyCommonOptions {
  defaultHP: number;
  defaultAbility?: AbilityType;
}

abstract class BaseEnemy implements Enemy {
  public readonly sprite: Phaser.Physics.Matter.Sprite;
  protected readonly scene: Phaser.Scene;
  protected readonly getPlayerPosition?: TargetProvider;
  private readonly enemyType: EnemyType;
  private readonly abilityType?: AbilityType;
  private hp: number;
  private defeated = false;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Matter.Sprite, enemyType: EnemyType, config: BaseEnemyConfig) {
    this.scene = scene;
    this.sprite = sprite;
    this.enemyType = enemyType;
    this.getPlayerPosition = config.getPlayerPosition;

    const maxHP = Math.max(1, config.maxHP ?? config.defaultHP);
    this.hp = maxHP;

    const abilityType = config.abilityType ?? config.defaultAbility;
    this.abilityType = abilityType;

    this.sprite.setData?.('enemyType', enemyType);
    this.sprite.setData?.('maxHP', maxHP);
    this.sprite.setData?.('hp', this.hp);

    if (abilityType) {
      this.sprite.setData?.('abilityType', abilityType);
    }
  }

  update(delta: number) {
    if (this.defeated) {
      return;
    }

    this.updateAI(delta);
  }

  takeDamage(amount: number) {
    if (this.defeated) {
      return;
    }

    const clamped = Math.max(0, Math.floor(amount));
    if (clamped <= 0) {
      return;
    }

    this.hp = Math.max(0, this.hp - clamped);
    this.sprite.setData?.('hp', this.hp);

    if (this.hp <= 0) {
      this.handleDefeat();
    }
  }

  getHP() {
    return this.hp;
  }

  isDefeated() {
    return this.defeated;
  }

  getAbilityType() {
    return this.abilityType;
  }

  getEnemyType() {
    return this.enemyType;
  }

  protected abstract updateAI(delta: number): void;

  protected handleDefeat() {
    if (this.defeated) {
      return;
    }

    this.defeated = true;
    this.sprite.setActive?.(false);
    this.sprite.setVisible?.(false);
    this.sprite.destroy?.();
    this.scene.events?.emit?.('enemy-defeated', {
      enemyType: this.enemyType,
      abilityType: this.abilityType,
      sprite: this.sprite,
    });
  }

  onDisperse(_context: EnemyDisperseContext) {
    // default no-op
  }
}

export interface WabbleBeeOptions extends EnemyCommonOptions {
  patrolRadius?: number;
  patrolSpeed?: number;
  detectionRange?: number;
  chaseSpeed?: number;
}

class WabbleBee extends BaseEnemy {
  private spawnX: number;
  private readonly patrolRadius: number;
  private readonly patrolSpeed: number;
  private readonly detectionRange: number;
  private readonly chaseSpeed: number;
  private patrolDirection = 1;
  private disperseRecoveryMs = 0;
  private readonly disperseChaseLockMs = 2000;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Matter.Sprite, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
    super(scene, sprite, 'wabble-bee', {
      defaultHP: Math.max(1, options.maxHP ?? 3),
      defaultAbility: options.abilityType ?? 'fire',
      getPlayerPosition: options.getPlayerPosition,
      abilityType: options.abilityType,
      maxHP: options.maxHP,
    });

    this.spawnX = spawn.x;
    this.patrolRadius = options.patrolRadius ?? 64;
    this.patrolSpeed = options.patrolSpeed ?? DEFAULT_ENEMY_SPEED;
    this.detectionRange = options.detectionRange ?? 160;
    this.chaseSpeed = options.chaseSpeed ?? DEFAULT_ENEMY_SPEED;
  }

  protected updateAI(_delta: number) {
    if (Number.isFinite(_delta) && _delta > 0) {
      this.disperseRecoveryMs = Math.max(0, this.disperseRecoveryMs - _delta);
    }

    const spriteX = this.sprite.x ?? this.sprite.body?.position?.x ?? 0;
    const target = this.getPlayerPosition?.();

    if (target && this.disperseRecoveryMs <= 0) {
      const deltaX = target.x - spriteX;
      if (Math.abs(deltaX) <= this.detectionRange) {
        const direction = deltaX < 0 ? -1 : deltaX > 0 ? 1 : 0;
        if (direction !== 0) {
          this.sprite.setVelocityX?.(direction * this.chaseSpeed);
          this.sprite.setFlipX?.(direction < 0);
          return;
        }
      }
    }

    const offsetFromSpawn = spriteX - this.spawnX;
    if (offsetFromSpawn >= this.patrolRadius) {
      this.patrolDirection = -1;
    } else if (offsetFromSpawn <= -this.patrolRadius) {
      this.patrolDirection = 1;
    }

    this.sprite.setVelocityX?.(this.patrolDirection * this.patrolSpeed);
    this.sprite.setFlipX?.(this.patrolDirection < 0);
  }

  onDisperse(context: EnemyDisperseContext) {
    this.spawnX = context.x;
    this.patrolDirection = 1;
    this.disperseRecoveryMs = this.disperseChaseLockMs;
  }
}

export interface DrontoDurtOptions extends EnemyCommonOptions {
  detectionRange?: number;
  chargeSpeed?: number;
}

class DrontoDurt extends BaseEnemy {
  private readonly detectionRange: number;
  private readonly chargeSpeed: number;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Matter.Sprite, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
    super(scene, sprite, 'dronto-durt', {
      defaultHP: Math.max(1, options.maxHP ?? 4),
      defaultAbility: options.abilityType ?? 'sword',
      getPlayerPosition: options.getPlayerPosition,
      abilityType: options.abilityType,
      maxHP: options.maxHP,
    });

    this.detectionRange = options.detectionRange ?? 200;
    this.chargeSpeed = options.chargeSpeed ?? DEFAULT_ENEMY_SPEED;
    // keep spawn reference to align y on ground if needed later
    void spawn; // avoids unused parameter linting
  }

  protected updateAI(_delta: number) {
    const target = this.getPlayerPosition?.();
    const spriteX = this.sprite.x ?? this.sprite.body?.position?.x ?? 0;

    if (!target) {
      this.sprite.setVelocityX?.(0);
      return;
    }

    const deltaX = target.x - spriteX;
    if (Math.abs(deltaX) > this.detectionRange) {
      this.sprite.setVelocityX?.(0);
      return;
    }

    const direction = deltaX < 0 ? -1 : deltaX > 0 ? 1 : 0;
    this.sprite.setVelocityX?.(direction * this.chargeSpeed);
    this.sprite.setFlipX?.(direction < 0);
  }
}

function ensureSprite<T extends Phaser.Physics.Matter.Sprite | undefined>(
  sprite: T,
  enemyType: EnemyType,
): Phaser.Physics.Matter.Sprite {
  if (!sprite) {
    throw new Error(`Failed to create sprite for ${enemyType}`);
  }

  return sprite;
}

export function createWabbleBee(scene: Phaser.Scene, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'wabble-bee'),
    'wabble-bee',
  );

  sprite.setOrigin?.(0.5, 0.5);
  if (typeof sprite.setBody === 'function') {
    sprite.setBody?.({
      type: 'rectangle',
      width: WABBLE_BEE_BODY.width,
      height: WABBLE_BEE_BODY.height,
    });
  } else {
    sprite.setRectangle?.(WABBLE_BEE_BODY.width, WABBLE_BEE_BODY.height);
  }
  sprite.setScale?.(WABBLE_BEE_SCALE);
  sprite.setIgnoreGravity?.(true);
  sprite.setFixedRotation?.();
  sprite.setFrictionAir?.(0.02);
  sprite.setName?.('Wabble Bee');

  return new WabbleBee(scene, sprite, spawn, options);
}

export function createDrontoDurt(scene: Phaser.Scene, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'dronto-durt'),
    'dronto-durt',
  );

  sprite.setOrigin?.(0.5, 0.5);
  if (typeof sprite.setBody === 'function') {
    sprite.setBody?.({
      type: 'rectangle',
      width: DRONTO_DURT_BODY.width,
      height: DRONTO_DURT_BODY.height,
    });
  } else {
    sprite.setRectangle?.(DRONTO_DURT_BODY.width, DRONTO_DURT_BODY.height);
  }
  sprite.setScale?.(DRONTO_DURT_SCALE);
  sprite.setIgnoreGravity?.(false);
  sprite.setFixedRotation?.();
  sprite.setFrictionAir?.(0.05);
  sprite.setName?.('Dronto Durt');

  return new DrontoDurt(scene, sprite, spawn, options);
}
