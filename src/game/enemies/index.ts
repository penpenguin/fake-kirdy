import type Phaser from 'phaser';
import type { AbilityType } from '../mechanics/AbilitySystem';
import { KIRDY_MOVE_SPEED } from '../characters/Kirdy';

const DEFAULT_ENEMY_SPEED = Math.max(1, KIRDY_MOVE_SPEED * 0.4);
const WABBLE_CHASE_SPEED = DEFAULT_ENEMY_SPEED * 1.125;
const FROST_WABBLE_PATROL_SPEED = DEFAULT_ENEMY_SPEED * 0.9;
const FROST_WABBLE_CHASE_SPEED = DEFAULT_ENEMY_SPEED;
const DRONTO_CHARGE_SPEED = DEFAULT_ENEMY_SPEED * 1.125;
const GLACIO_DURT_CHARGE_SPEED = DEFAULT_ENEMY_SPEED * 0.95;

export type EnemyType =
  | 'wabble-bee'
  | 'dronto-durt'
  | 'frost-wabble'
  | 'glacio-durt'
  | 'vine-hopper'
  | 'thorn-roller'
  | 'sap-spitter'
  | 'chill-wisp'
  | 'glacier-golem'
  | 'frost-archer'
  | 'ember-imp'
  | 'magma-crab'
  | 'blaze-strider'
  | 'stone-sentinel'
  | 'curse-bat'
  | 'relic-thief'
  | 'gale-kite'
  | 'nimbus-knight'
  | 'prism-wraith';

type WabbleBeeEnemyType = Extract<EnemyType, 'wabble-bee' | 'frost-wabble'>;
type DrontoDurtEnemyType = Extract<EnemyType, 'dronto-durt' | 'glacio-durt'>;

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

interface WabbleBeeVariantConfig {
  enemyType: WabbleBeeEnemyType;
  displayName: string;
  defaultAbility: AbilityType;
  tint?: number;
}

interface DrontoDurtVariantConfig {
  enemyType: DrontoDurtEnemyType;
  displayName: string;
  defaultAbility: AbilityType;
  tint?: number;
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

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    spawn: EnemySpawn,
    options: WabbleBeeOptions = {},
    variant: WabbleBeeVariantConfig = { enemyType: 'wabble-bee', displayName: 'Wabble Bee', defaultAbility: 'fire' },
  ) {
    const resolvedAbility = options.abilityType ?? variant.defaultAbility;
    const defaultHP = Math.max(1, options.maxHP ?? 1);
    super(scene, sprite, variant.enemyType, {
      defaultHP,
      defaultAbility: resolvedAbility,
      getPlayerPosition: options.getPlayerPosition,
      abilityType: resolvedAbility,
      maxHP: options.maxHP,
    });

    this.spawnX = spawn.x;
    this.patrolRadius = options.patrolRadius ?? 64;
    this.patrolSpeed = options.patrolSpeed ?? DEFAULT_ENEMY_SPEED;
    this.detectionRange = options.detectionRange ?? 160;
    this.chaseSpeed = options.chaseSpeed ?? WABBLE_CHASE_SPEED;

    sprite.setName?.(variant.displayName);
    if (variant.tint !== undefined) {
      sprite.setTint?.(variant.tint);
    } else {
      sprite.clearTint?.();
    }
  }

  protected updateAI(_delta: number) {
    if (Number.isFinite(_delta) && _delta > 0) {
      this.disperseRecoveryMs = Math.max(0, this.disperseRecoveryMs - _delta);
    }

    const sprite = this.sprite;
    const spriteX = sprite?.x ?? sprite?.body?.position?.x ?? 0;
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

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    spawn: EnemySpawn,
    options: DrontoDurtOptions = {},
    variant: DrontoDurtVariantConfig = { enemyType: 'dronto-durt', displayName: 'Dronto Durt', defaultAbility: 'sword' },
  ) {
    const resolvedAbility = options.abilityType ?? variant.defaultAbility;
    const defaultHP = Math.max(1, options.maxHP ?? 1);
    super(scene, sprite, variant.enemyType, {
      defaultHP,
      defaultAbility: resolvedAbility,
      getPlayerPosition: options.getPlayerPosition,
      abilityType: resolvedAbility,
      maxHP: options.maxHP,
    });

    this.detectionRange = options.detectionRange ?? 200;
    this.chargeSpeed = options.chargeSpeed ?? DRONTO_CHARGE_SPEED;
    // keep spawn reference to align y on ground if needed later
    void spawn; // avoids unused parameter linting

    sprite.setName?.(variant.displayName);
    if (variant.tint !== undefined) {
      sprite.setTint?.(variant.tint);
    } else {
      sprite.clearTint?.();
    }
  }

  protected updateAI(_delta: number) {
    const target = this.getPlayerPosition?.();
    const sprite = this.sprite;
    const spriteX = sprite?.x ?? sprite?.body?.position?.x ?? 0;

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

function configureWabbleSprite(sprite: Phaser.Physics.Matter.Sprite) {
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
}

function configureDrontoSprite(sprite: Phaser.Physics.Matter.Sprite) {
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
}

export function createWabbleBee(scene: Phaser.Scene, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'wabble-bee'),
    'wabble-bee',
  );

  configureWabbleSprite(sprite);

  return new WabbleBee(scene, sprite, spawn, options, {
    enemyType: 'wabble-bee',
    displayName: 'Wabble Bee',
    defaultAbility: 'fire',
  });
}

export function createDrontoDurt(scene: Phaser.Scene, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'dronto-durt'),
    'dronto-durt',
  );

  configureDrontoSprite(sprite);

  return new DrontoDurt(scene, sprite, spawn, options, {
    enemyType: 'dronto-durt',
    displayName: 'Dronto Durt',
    defaultAbility: 'sword',
  });
}

export function createFrostWabble(scene: Phaser.Scene, spawn: EnemySpawn, options: WabbleBeeOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'wabble-bee'),
    'frost-wabble',
  );

  configureWabbleSprite(sprite);

  const frostOptions: WabbleBeeOptions = {
    ...options,
    abilityType: options.abilityType ?? 'ice',
    patrolSpeed: options.patrolSpeed ?? FROST_WABBLE_PATROL_SPEED,
    chaseSpeed: options.chaseSpeed ?? FROST_WABBLE_CHASE_SPEED,
    detectionRange: options.detectionRange ?? 200,
  };

  return new WabbleBee(scene, sprite, spawn, frostOptions, {
    enemyType: 'frost-wabble',
    displayName: 'Frost Wabble',
    defaultAbility: 'ice',
    tint: 0x7fe9ff,
  });
}

export function createGlacioDurt(scene: Phaser.Scene, spawn: EnemySpawn, options: DrontoDurtOptions = {}) {
  const sprite = ensureSprite(
    scene.matter?.add?.sprite?.(spawn.x, spawn.y, 'dronto-durt'),
    'glacio-durt',
  );

  configureDrontoSprite(sprite);

  const glacioOptions: DrontoDurtOptions = {
    ...options,
    abilityType: options.abilityType ?? 'ice',
    detectionRange: options.detectionRange ?? 220,
    chargeSpeed: options.chargeSpeed ?? GLACIO_DURT_CHARGE_SPEED,
  };

  return new DrontoDurt(scene, sprite, spawn, glacioOptions, {
    enemyType: 'glacio-durt',
    displayName: 'Glacio Durt',
    defaultAbility: 'ice',
    tint: 0x9fd8ff,
  });
}

class PassiveEnemy extends BaseEnemy {
  protected updateAI(_delta: number) {
    this.sprite.setVelocityX?.(0);
  }
}

type BehaviorEnemyConfig = {
  patrolRadius: number;
  patrolSpeed: number;
  chaseSpeed: number;
  detectionRange: number;
  attackRange: number;
  attackCooldownMs: number;
  attackType?: string;
  jumpSpeed?: number;
  keepDistance?: number;
  diveSpeed?: number;
  hover?: boolean;
};

class BehaviorEnemy extends BaseEnemy {
  private readonly patrolRadius: number;
  private readonly patrolSpeed: number;
  private readonly chaseSpeed: number;
  private readonly detectionRange: number;
  private readonly attackRange: number;
  private readonly attackCooldownMs: number;
  private readonly attackType?: string;
  private readonly jumpSpeed?: number;
  private readonly keepDistance?: number;
  private readonly diveSpeed?: number;
  private readonly hover: boolean;
  private patrolDirection = 1;
  private attackCooldownRemaining = 0;
  private readonly spawnX: number;
  private readonly spawnY: number;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Matter.Sprite,
    enemyType: EnemyType,
    baseConfig: BaseEnemyConfig,
    behavior: BehaviorEnemyConfig,
    spawn: EnemySpawn,
  ) {
    super(scene, sprite, enemyType, baseConfig);
    this.spawnX = spawn.x;
    this.spawnY = spawn.y;
    this.patrolRadius = behavior.patrolRadius;
    this.patrolSpeed = behavior.patrolSpeed;
    this.chaseSpeed = behavior.chaseSpeed;
    this.detectionRange = behavior.detectionRange;
    this.attackRange = behavior.attackRange;
    this.attackCooldownMs = behavior.attackCooldownMs;
    this.attackType = behavior.attackType;
    this.jumpSpeed = behavior.jumpSpeed;
    this.keepDistance = behavior.keepDistance;
    this.diveSpeed = behavior.diveSpeed;
    this.hover = behavior.hover ?? false;
  }

  protected updateAI(delta: number) {
    if (Number.isFinite(delta) && delta > 0) {
      this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - delta);
    }

    const sprite = this.sprite;
    const spriteX = sprite?.x ?? sprite?.body?.position?.x ?? this.spawnX;
    const spriteY = sprite?.y ?? sprite?.body?.position?.y ?? this.spawnY;
    const target = this.getPlayerPosition?.();

    let acted = false;

    if (target) {
      const dx = target.x - spriteX;
      const dy = target.y - spriteY;
      const distance = Math.hypot(dx, dy);

      if (distance <= this.detectionRange) {
        acted = true;
        const direction = dx === 0 ? 0 : dx < 0 ? -1 : 1;

        if (this.chaseSpeed > 0) {
          // keep distance for ranged kiting enemies
          if (this.keepDistance && Math.abs(dx) < this.keepDistance) {
            sprite.setVelocityX?.(-direction * this.chaseSpeed);
            sprite.setFlipX?.(direction > 0);
          } else {
            sprite.setVelocityX?.(direction * this.chaseSpeed);
            sprite.setFlipX?.(direction < 0);
          }
        }

        if (this.jumpSpeed && distance <= this.attackRange) {
          sprite.setVelocityY?.(-this.jumpSpeed);
        }

        if (this.diveSpeed && Math.abs(dx) < this.attackRange) {
          sprite.setVelocityY?.(this.diveSpeed);
        }

        if (this.attackType && distance <= this.attackRange && this.attackCooldownRemaining <= 0) {
          this.scene.events?.emit?.('enemy-attack', {
            enemyType: this.getEnemyType(),
            abilityType: this.getAbilityType(),
            attackType: this.attackType,
            sprite,
            target,
            damage: 1,
          });
          this.attackCooldownRemaining = this.attackCooldownMs;
        }
      }
    }

    if (!acted) {
      if (this.patrolSpeed > 0) {
        const offset = spriteX - this.spawnX;
        if (offset >= this.patrolRadius) {
          this.patrolDirection = -1;
        } else if (offset <= -this.patrolRadius) {
          this.patrolDirection = 1;
        }
        sprite.setVelocityX?.(this.patrolDirection * this.patrolSpeed);
        sprite.setFlipX?.(this.patrolDirection < 0);
      } else {
        sprite.setVelocityX?.(0);
      }
    }

    if (this.hover) {
      sprite.setVelocityY?.(0);
    }
  }
}

type PlaceholderEnemyOptions = EnemyCommonOptions & {
  scale?: number;
  tint?: number;
  ignoreGravity?: boolean;
  body?: { width: number; height: number; isSensor?: boolean };
  displayName?: string;
};

function createBehaviorEnemy(
  scene: Phaser.Scene,
  spawn: EnemySpawn,
  config: {
    enemyType: EnemyType;
    defaultAbility: AbilityType;
    textureKey: string;
    defaultHP?: number;
    displayName?: string;
    scale?: number;
    tint?: number;
    ignoreGravity?: boolean;
    body?: { width: number; height: number; isSensor?: boolean };
    behavior: BehaviorEnemyConfig;
  },
  options: PlaceholderEnemyOptions = {},
) {
  const sprite = ensureSprite(scene.matter?.add?.sprite?.(spawn.x, spawn.y, config.textureKey), config.enemyType);
  sprite.setName?.(config.displayName ?? config.enemyType);
  sprite.setOrigin?.(0.5, 0.5);
  sprite.setFixedRotation?.();
  sprite.setIgnoreGravity?.(config.ignoreGravity ?? options.ignoreGravity ?? false);
  sprite.setScale?.(config.scale ?? options.scale ?? 0.85);
  if (config.tint !== undefined) {
    sprite.setTint?.(config.tint);
  } else {
    sprite.clearTint?.();
  }

  const bodyConfig = config.body ?? options.body;
  if (bodyConfig) {
    if (typeof sprite.setBody === 'function') {
      sprite.setBody?.({
        type: 'rectangle',
        width: bodyConfig.width,
        height: bodyConfig.height,
      });
    } else {
      sprite.setRectangle?.(bodyConfig.width, bodyConfig.height);
    }
    if (bodyConfig.isSensor) {
      sprite.setSensor?.(true);
    }
  }

  const resolvedAbility = options.abilityType ?? config.defaultAbility;
  const defaultHP = Math.max(1, options.maxHP ?? config.defaultHP ?? 1);

  return new BehaviorEnemy(
    scene,
    sprite,
    config.enemyType,
    {
      defaultHP,
      defaultAbility: resolvedAbility,
      abilityType: resolvedAbility,
      getPlayerPosition: options.getPlayerPosition,
      maxHP: options.maxHP,
    },
    config.behavior,
    spawn,
  );
}

export function createVineHopper(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'vine-hopper',
      defaultAbility: 'leaf',
      textureKey: 'vine-hopper',
      displayName: 'Vine Hopper',
      behavior: {
        patrolRadius: 48,
        patrolSpeed: 60,
        chaseSpeed: 100,
        detectionRange: 140,
        attackRange: 64,
        attackCooldownMs: 800,
        attackType: 'hop-stomp',
        jumpSpeed: 6,
      },
    },
    options,
  );
}

export function createThornRoller(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'thorn-roller',
      defaultAbility: 'spike',
      textureKey: 'thorn-roller',
      displayName: 'Thorn Roller',
      body: { width: 40, height: 32 },
      behavior: {
        patrolRadius: 96,
        patrolSpeed: 90,
        chaseSpeed: 150,
        detectionRange: 200,
        attackRange: 64,
        attackCooldownMs: 700,
        attackType: 'roll-strike',
      },
    },
    options,
  );
}

export function createSapSpitter(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'sap-spitter',
      defaultAbility: 'sticky',
      textureKey: 'sap-spitter',
      displayName: 'Sap Spitter',
      body: { width: 32, height: 28 },
      behavior: {
        patrolRadius: 0,
        patrolSpeed: 0,
        chaseSpeed: 0,
        detectionRange: 240,
        attackRange: 240,
        attackCooldownMs: 1200,
        attackType: 'sap-shot',
      },
    },
    options,
  );
}

export function createChillWisp(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'chill-wisp',
      defaultAbility: 'ice',
      textureKey: 'chill-wisp',
      displayName: 'Chill Wisp',
      ignoreGravity: true,
      scale: 0.75,
      behavior: {
        patrolRadius: 48,
        patrolSpeed: 40,
        chaseSpeed: 70,
        detectionRange: 200,
        attackRange: 180,
        attackCooldownMs: 1400,
        attackType: 'frost-burst',
        hover: true,
      },
    },
    options,
  );
}

export function createGlacierGolem(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'glacier-golem',
      defaultAbility: 'guard',
      textureKey: 'glacier-golem',
      displayName: 'Glacier Golem',
      scale: 1.1,
      body: { width: 48, height: 56 },
      defaultHP: 3,
      behavior: {
        patrolRadius: 32,
        patrolSpeed: 20,
        chaseSpeed: 60,
        detectionRange: 180,
        attackRange: 70,
        attackCooldownMs: 1400,
        attackType: 'shoulder-charge',
      },
    },
    options,
  );
}

export function createFrostArcher(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'frost-archer',
      defaultAbility: 'ice-arrow',
      textureKey: 'frost-archer',
      displayName: 'Frost Archer',
      body: { width: 30, height: 46 },
      behavior: {
        patrolRadius: 16,
        patrolSpeed: 0,
        chaseSpeed: 80,
        detectionRange: 260,
        attackRange: 260,
        attackCooldownMs: 900,
        attackType: 'ice-arrow',
        keepDistance: 140,
      },
    },
    options,
  );
}

export function createEmberImp(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'ember-imp',
      defaultAbility: 'fire',
      textureKey: 'ember-imp',
      displayName: 'Ember Imp',
      ignoreGravity: true,
      scale: 0.8,
      behavior: {
        patrolRadius: 40,
        patrolSpeed: 60,
        chaseSpeed: 150,
        detectionRange: 200,
        attackRange: 150,
        attackCooldownMs: 900,
        attackType: 'fire-burst',
        hover: true,
      },
    },
    options,
  );
}

export function createMagmaCrab(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'magma-crab',
      defaultAbility: 'magma-shield',
      textureKey: 'magma-crab',
      displayName: 'Magma Crab',
      body: { width: 42, height: 28 },
      scale: 0.9,
      behavior: {
        patrolRadius: 0,
        patrolSpeed: 0,
        chaseSpeed: 0,
        detectionRange: 200,
        attackRange: 200,
        attackCooldownMs: 1300,
        attackType: 'magma-shot',
      },
    },
    options,
  );
}

export function createBlazeStrider(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'blaze-strider',
      defaultAbility: 'dash-fire',
      textureKey: 'blaze-strider',
      displayName: 'Blaze Strider',
      scale: 0.95,
      body: { width: 40, height: 32 },
      behavior: {
        patrolRadius: 96,
        patrolSpeed: 110,
        chaseSpeed: 180,
        detectionRange: 220,
        attackRange: 90,
        attackCooldownMs: 800,
        attackType: 'dash-fire',
      },
    },
    options,
  );
}

export function createStoneSentinel(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'stone-sentinel',
      defaultAbility: 'beam',
      textureKey: 'stone-sentinel',
      displayName: 'Stone Sentinel',
      scale: 1.05,
      body: { width: 52, height: 52 },
      defaultHP: 3,
      behavior: {
        patrolRadius: 0,
        patrolSpeed: 0,
        chaseSpeed: 0,
        detectionRange: 240,
        attackRange: 240,
        attackCooldownMs: 1500,
        attackType: 'beam',
      },
    },
    options,
  );
}

export function createCurseBat(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'curse-bat',
      defaultAbility: 'curse',
      textureKey: 'curse-bat',
      displayName: 'Curse Bat',
      ignoreGravity: true,
      scale: 0.8,
      behavior: {
        patrolRadius: 40,
        patrolSpeed: 50,
        chaseSpeed: 120,
        detectionRange: 200,
        attackRange: 80,
        attackCooldownMs: 1000,
        attackType: 'dive',
        hover: true,
        diveSpeed: 200,
      },
    },
    options,
  );
}

export function createRelicThief(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'relic-thief',
      defaultAbility: 'warp',
      textureKey: 'relic-thief',
      displayName: 'Relic Thief',
      scale: 0.9,
      body: { width: 32, height: 36 },
      behavior: {
        patrolRadius: 96,
        patrolSpeed: 80,
        chaseSpeed: 160,
        detectionRange: 220,
        attackRange: 120,
        attackCooldownMs: 1200,
        attackType: 'steal',
      },
    },
    options,
  );
}

export function createGaleKite(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'gale-kite',
      defaultAbility: 'wind',
      textureKey: 'gale-kite',
      displayName: 'Gale Kite',
      ignoreGravity: true,
      scale: 0.85,
      behavior: {
        patrolRadius: 80,
        patrolSpeed: 70,
        chaseSpeed: 120,
        detectionRange: 200,
        attackRange: 180,
        attackCooldownMs: 1100,
        attackType: 'wind-blast',
        hover: true,
        keepDistance: 140,
      },
    },
    options,
  );
}

export function createNimbusKnight(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'nimbus-knight',
      defaultAbility: 'thunder',
      textureKey: 'nimbus-knight',
      displayName: 'Nimbus Knight',
      ignoreGravity: true,
      scale: 1,
      body: { width: 42, height: 46 },
      defaultHP: 2,
      behavior: {
        patrolRadius: 32,
        patrolSpeed: 40,
        chaseSpeed: 90,
        detectionRange: 220,
        attackRange: 200,
        attackCooldownMs: 1500,
        attackType: 'lightning',
        hover: true,
      },
    },
    options,
  );
}

export function createPrismWraith(scene: Phaser.Scene, spawn: EnemySpawn, options: PlaceholderEnemyOptions = {}) {
  return createBehaviorEnemy(
    scene,
    spawn,
    {
      enemyType: 'prism-wraith',
      defaultAbility: 'prism',
      textureKey: 'prism-wraith',
      displayName: 'Prism Wraith',
      ignoreGravity: true,
      scale: 0.9,
      behavior: {
        patrolRadius: 80,
        patrolSpeed: 70,
        chaseSpeed: 130,
        detectionRange: 240,
        attackRange: 200,
        attackCooldownMs: 1300,
        attackType: 'prism-beam',
        hover: true,
      },
    },
    options,
  );
}
